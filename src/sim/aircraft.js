// Aircraft: a camp's helicopter and its missiles (war.js builds them).
// Each is a shaped creature (Helicopter, Missile) with no pilot: its mind
// is `e.craft` (a human's is `e.brain`), stepped by stepCraft in place of
// an animal's or a human's step. Like any creature, its pixels can be shot
// away, blasted or burned; a helicopter that loses half comes down in
// pieces, and a missile that loses one goes off.
//
// The helicopter waits on its pad (mending while it's there) until its
// camp raids another, or raiders (people: not an enemy helicopter or
// missile) come near home; then it flies out at cruising height and makes
// flyby passes over the enemy: down low on one side, straight across,
// climbing away past the far side, round, and back the other way. All the
// while it shoots, a round every few steps, at whatever enemy it sees
// close enough. It flies home when the raid is over, the fight is, or it's
// badly hit.
//
// A missile sits in its launch tube until a raid; then it flies straight
// up, turns toward the enemy's hut, speeding up, and blows a crater in
// whatever it hits (or where it was aimed). It points the way it flies,
// in eight directions (its "down" is the way it came from).
//
// Mixed into World.prototype.

import { DEFS, ID, State, AMBIENT } from './elements.js';
import { SHAPED, BODY } from './creatures.js';

const { SOLID, POWDER, LIQUID } = State;

const HELI_EVERY = 1; // steps per cell it flies
const HELI_CRUISE = 14; // the least it flies above the ground on the way somewhere
const HELI_HOVER = 10; // how high it comes in over its pad before it sets down
// Flybys: a pass runs PASS_HALF either side of the enemy, STRAFE_H over
// them; past the far end it climbs away, PASS_OUT on, to CLIMB_H, and comes
// round. A point of the pattern within PASS_NEAR is reached; one not
// reached in PASS_MAX steps (a hill in the way, say) is given up on.
export const PASS_HALF = 40, PASS_OUT = 15, STRAFE_H = 10, CLIMB_H = 30;
const PASS_NEAR = 2, PASS_MAX = 300;
const NEXT_PHASE = { approach: 'dive', dive: 'pass', pass: 'climb', climb: 'dive' };
export const HELI_GUN_R = 20; // it fires at what's this close
export const HELI_GUN_EVERY = 3; // steps between rounds
const HELI_SPREAD = 0.06; // radians either way a round may stray
const HELI_LOOK = 70; // how far from the fight it looks for something to shoot
export const HELI_RETREAT = 0.4; // this much of it shot away, it flies home
export const MEND_STUCK = 300; // on its pad it mends all the way before it flies again, unless no pixel has mended for this long
export const DEFEND_R = 60; // raiders this close to its camp send it up
const HELI_STAY = 600; // steps defending with nothing to shoot before it goes home
const HELI_LOOK_EVERY = 8;
const MISSILE_SPEED = 2; // cells a step, at full speed
const MISSILE_ACCEL = 0.08;
const MISSILE_BOOST = 24; // cells straight up out of the tube
const MISSILE_TURN = 0.07; // radians a step it can turn
const NOSE = 4; // how far its nose is ahead of its tail (where it's anchored)
const APEX = 80; // how high over the higher end of its way it flies
const APEX_NEAR = 14; // this near a point of its way, it turns for the next
const TURN_ROOM = 24; // and its way keeps this far inside the world (room to turn)
const MISSILE_FUEL = 1500; // steps it flies before it comes down wherever it is
const MISSILE_HOLD = 120; // steps it waits for its own side to get out of its way
const HELI_WAIT = 90; // steps a raid's helicopter waits for its missile to get clear
const HELI_DOWN_FOR = 1200; // steps set down away from its pad before it tries for home again
const HELI_STALL = 60; // moves within a few cells of one spot: it's boxed in
const HELI_ESCAPE = 24; // and moves any way it can this many times to get out
const EDGE = 9; // the least it keeps from the world's edges, going somewhere
const ESCAPE = [[1, 1], [0, 1], [-1, 1], [1, 0], [-1, 0], [1, -1], [0, -1], [-1, -1]];
export const HELI_ARMOUR = 0.85; // the share of bullets its plating turns (blasts it doesn't)
export const MISSILE_ARMOUR = 0.9; // and a missile's (an anti-air burst is what stops one)
const MISSILE_TOUGH = 3; // pixels a missile can lose before it goes off
export const CRATER_R = 8; // a missile's crater
const CRATER_BLAST = 30;
const WRECK_BLAST = 8; // a helicopter coming down

// The eight directions, as angles' nearest: [dx, dy].
const DIR8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
function dir8(hx, hy) {
  const k = Math.round(Math.atan2(hy, hx) / (Math.PI / 4));
  return DIR8[(k + 8) % 8];
}

export const Aircraft = {
  // A war machine of kind t (Helicopter or Missile) is built at anchor
  // (x, y), standing along (gx, gy), facing `facing`: it grows ring by ring
  // from its middle, as a creature hatches. `look` picks the colour of
  // palette letters ({ b: 2 }). Its mind is `craft`. The creature, or null
  // with no room.
  buildCraft(t, x, y, facing, gx, gy, craft, look = null) {
    const sh = DEFS[t].shape, f = sh.frames[0], out = this.footA;
    if (!this.placeCells(t, x, y, 0, facing, gx, gy, out)) return null;
    const probe = { kind: t, id: -1, wades: false };
    // Loose stuff, liquid or growth where it goes (scrap, rubble, sand, a
    // puddle, leaves) is swept aside; anything else, and there's no room.
    for (let q = 0; q < sh.n; q++) {
      const c = out[q], u = this.type[c];
      if (this.roomForBody(probe, c)) continue;
      if (SHAPED[u] || this.wall[c] !== 0 || !(DEFS[u].state === POWDER || DEFS[u].state === LIQUID || this.loose[c] || this.wild(c))) return null;
    }
    for (let q = 0; q < sh.n; q++) if (!this.roomForBody(probe, out[q])) this.makeRoom(out[q], out, sh.n);
    if (!this.placeCells(t, x, y, 0, facing, gx, gy, out)) return null;
    const e = this.newCreature(t, x, y, facing, gx, gy);
    if (e === null) return null;
    e.craft = craft;
    if (look !== null) {
      for (const [letter, k] of Object.entries(look)) {
        const l = sh.letters.indexOf(letter);
        if (l >= 0) e.look[l] = k % sh.options[l];
      }
    }
    const p = sh.order[0];
    for (let q = 0; q < sh.n; q++) e.ring[q] = Math.max(Math.abs(f.dx[q] - f.dx[p]), Math.abs(f.dy[q] - f.dy[p]));
    e.seed = p;
    this.placeCells(t, x, y, 0, facing, gx, gy, out);
    if (this.type[out[p]] !== 0) this.clearCell(out[p]);
    this.writePixel(e, p, out[p], AMBIENT, 0);
    e.pix[p] = BODY;
    return e;
  },

  // Is creature o still the one we mean (ids are reused at once)?
  alive(o) {
    return o !== null && o !== undefined && this.creatureById[o.id] === o;
  },

  stepCraft(e) {
    const k = e.craft;
    if (k.camp !== null && !this.camps.includes(k.camp)) k.camp = null; // its camp is gone
    if (k.kind === 'heli') this.stepHeli(e, k);
    else this.stepMissile(e, k);
  },

  // ---- the helicopter -----------------------------------------------------------

  // Where to go and fight: the camp its own is raiding, or its own with
  // raiders near (people: an enemy helicopter alone doesn't send it up,
  // two of them can't fight it out); null if neither.
  heliCall(k) {
    const camp = k.camp;
    if (camp === null) return null;
    if (camp.raid !== null && this.camps.includes(camp.raid.enemy)) return camp.raid.enemy;
    return this.enemyNear(camp, camp.x, camp.y, DEFEND_R, true) !== null ? camp : null;
  },

  // Is creature o one of camp's enemies: a human of another camp, or
  // another camp's aircraft (up and about)?
  enemyOf(camp, o) {
    if (o.grow >= 0) return false;
    if (o.brain !== null) return o.brain.camp !== null && o.brain.camp !== camp;
    if (o.craft !== null) return o.craft.camp !== camp && this.flying(o);
    return false;
  },

  // An aircraft in the air (not parked, nor waiting in its tube)?
  flying(o) {
    const k = o.craft;
    return k !== null && (k.kind === 'heli' ? k.state !== 'parked' : k.state === 'flying');
  },

  // camp's nearest enemy within r of (x, y) (`people`: humans only): a
  // creature, or null.
  enemyNear(camp, x, y, r, people = false) {
    let best = null, bd = Infinity;
    for (const o of this.creatures) {
      if ((people && o.brain === null) || !this.enemyOf(camp, o)) continue;
      const d = Math.max(Math.abs(o.x - x), Math.abs(o.y - y));
      if (d <= r && d < bd) {
        best = o;
        bd = d;
      }
    }
    return best;
  },

  stepHeli(e, k) {
    k.mend = k.state === 'parked';
    if (k.state === 'parked') {
      // Mended all the way first (it used to go again as soon as it was
      // less than HELI_RETREAT hurt, only to come straight back), unless
      // it's stopped mending: a pixel's place taken by something.
      if (e.lost > 0) {
        if (k.lostWas !== e.lost) {
          k.lostWas = e.lost;
          k.mendAt = this.tick;
        }
        if (this.tick - k.mendAt < MEND_STUCK) return;
      }
      const goal = this.heliCall(k);
      if (goal === null) return;
      if (goal !== k.camp && this.tick - k.camp.raid.start < HELI_WAIT) return; // the missile goes first
      k.goal = goal;
      k.state = 'flying';
      k.quiet = 0;
      k.pace = 0;
      k.phase = null; // (its passes start afresh)
    }
    if (k.camp === null) k.state = 'down';
    if (k.state === 'down') {
      // Nowhere to go home to (or no way down onto its pad): it settles
      // where it is, and now and then tries for home again.
      if (k.camp !== null && (k.downFor = (k.downFor ?? 0) + 1) > HELI_DOWN_FOR) {
        k.downFor = 0;
        k.blocked = 0;
        k.state = 'home';
        return;
      }
      if (++k.pace >= HELI_EVERY && !this.supported(e)) {
        k.pace = 0;
        this.heliMove(e, 0, -1);
      }
      return;
    }
    const camp = k.camp;
    if (k.state === 'flying') {
      const raid = camp.raid;
      const over = k.goal !== camp ? raid === null || raid.enemy !== k.goal || !this.camps.includes(k.goal) : k.quiet > HELI_STAY;
      if (over || e.lost > e.n * HELI_RETREAT) {
        k.state = 'home';
        k.foe = null;
        k.phase = null;
      }
    }
    if (k.state === 'flying') this.heliFight(e, k);
    if (k.state === 'home') this.heliHome(e, k);
  },

  // Over the fight: flyby passes, centred on the enemy people nearest the
  // goal (or, with none, the goal's fire). First out to its own side of
  // them, up at CLIMB_H ('approach'); then down to STRAFE_H at the near end
  // of the pass ('dive'), straight across to the far end ('pass'), on and
  // up away from them ('climb'), and round: the next pass goes back the
  // other way. It shoots whatever enemy it sees, all the while.
  heliFight(e, k) {
    const goal = k.goal;
    if (this.tick % HELI_LOOK_EVERY === 0 || k.cx === undefined) {
      const foe = this.enemyNear(k.camp, goal.x, goal.y, HELI_LOOK, true);
      if (foe === null && goal === k.camp) k.quiet += HELI_LOOK_EVERY;
      else if (foe !== null) k.quiet = 0;
      const c = foe ?? goal;
      k.cx = c.x;
      k.cy = c.y;
    }
    if (k.phase == null) {
      k.dir = this.across(e, k.cx - e.x, k.cy - e.y) >= 0 ? 1 : -1; // (passes start from its own side)
      k.phase = 'approach';
      k.phaseAt = this.tick;
    }
    const along = k.phase === 'dive' ? -PASS_HALF : k.phase === 'pass' ? PASS_HALF : k.phase === 'climb' ? PASS_HALF + PASS_OUT : -(PASS_HALF + PASS_OUT);
    const low = k.phase === 'dive' || k.phase === 'pass';
    let [tx, ty] = this.heliOffset(e, k.cx, k.cy, k.dir * along, low ? STRAFE_H : CLIMB_H);
    tx = Math.max(EDGE, Math.min(this.w - 1 - EDGE, tx));
    ty = Math.max(EDGE, Math.min(this.h - 1 - EDGE, ty));
    if (Math.max(Math.abs(e.x - tx), Math.abs(e.y - ty)) <= PASS_NEAR || this.tick - k.phaseAt > PASS_MAX) {
      if (k.phase === 'climb') k.dir = -k.dir; // round for a pass back the other way
      k.phase = NEXT_PHASE[k.phase];
      k.phaseAt = this.tick;
    }
    this.heliToward(e, k, tx, ty, false, low);
    this.heliShoot(e, k);
  },

  // Fly home and set down on its pad.
  heliHome(e, k) {
    const camp = k.camp;
    const du = this.across(e, k.homeX - e.x, k.homeY - e.y), dv = this.upOf(e, k.homeX - e.x, k.homeY - e.y);
    if (du === 0 && dv === 0) {
      k.state = 'parked';
      k.foe = null;
      if (e.facing !== k.homeFacing) this.moveBody(e, e.x, e.y, 0, k.homeFacing, e.gx, e.gy);
      return;
    }
    if (Math.abs(du) > 0) {
      // Across at the height it's at (or higher, over what's in the way),
      // then straight down.
      const [tx, ty] = this.heliOffset(e, k.homeX, k.homeY, 0, Math.max(HELI_HOVER, -dv));
      this.heliToward(e, k, Math.abs(du) <= 1 ? k.homeX : tx, Math.abs(du) <= 1 ? k.homeY : ty, true);
      return;
    }
    if (++k.pace < HELI_EVERY) return;
    k.pace = 0;
    if (!this.heliMove(e, 0, Math.sign(dv)) && camp !== null && dv < 0) k.blocked = (k.blocked ?? 0) + 1;
    else k.blocked = 0;
    if ((k.blocked ?? 0) > 600) { // its pad is buried: it lands where it can (and tries again later)
      k.state = 'down';
      k.downFor = 0;
    }
  },

  // (dx, dy) across e's down arrow (positive the way facing 1 looks), and
  // up it.
  across(e, dx, dy) {
    return dx * e.gy - dy * e.gx;
  },
  upOf(e, dx, dy) {
    return -(dx * e.gx + dy * e.gy);
  },

  // The point `u` across and `v` up from (x, y), in e's frame.
  heliOffset(e, x, y, u, v) {
    return [x + u * e.gy - v * e.gx, y - u * e.gx - v * e.gy];
  },

  // How far below e the ground is (cells of open space under its skids),
  // up to `max`.
  clearance(e, max) {
    for (let d = 1; d <= max; d++) {
      const x = e.x + d * e.gx, y = e.y + d * e.gy;
      if (!this.inBounds(x, y)) return d - 1;
      const t = this.type[y * this.w + x];
      if (t === 0) continue;
      const s = DEFS[t].state;
      if (s === SOLID || s === POWDER || s === LIQUID) return d - 1;
    }
    return max;
  },

  // A cell a step (every HELI_EVERY steps) toward (tx, ty): across, and
  // up or down, keeping well above the ground on the way there (but on a
  // `low` pass over the enemy); climbing over whatever's in its way.
  heliToward(e, k, tx, ty, homing = false, low = false) {
    if (++k.pace < HELI_EVERY) return;
    k.pace = 0;
    // Boxed in (another helicopter, a human, an overhang), it shuffles back
    // and forth on the spot: it gets out of there any way it can for a bit.
    if ((k.escape ?? 0) > 0) {
      k.escape--;
      const s = (this.rand() * 8) | 0;
      for (let n = 0; n < 8; n++) {
        const [a, b] = ESCAPE[(s + n) & 7];
        if (this.heliMove(e, a, b)) break;
      }
      return;
    }
    // Its way there keeps clear of the world's edges.
    tx = Math.max(EDGE, Math.min(this.w - 1 - EDGE, tx));
    ty = Math.max(EDGE, Math.min(this.h - 1 - EDGE, ty));
    const du = this.across(e, tx - e.x, ty - e.y), dv = this.upOf(e, tx - e.x, ty - e.y);
    const far = Math.abs(du) > 24 && !low;
    const under = this.clearance(e, HELI_CRUISE + 2);
    let su = Math.sign(du), sv = Math.sign(dv);
    // On the way: at cruising height; over the fight: never right down on
    // the ground.
    if (far && under < HELI_CRUISE) sv = 1;
    else if (far && sv < 0 && under <= HELI_CRUISE) sv = 0;
    else if (!homing && sv < 0 && under <= 4) sv = 0;
    if (su === 0 && sv === 0) return;
    this.heliStep(e, su, sv);
    // Getting nowhere (within a few cells for HELI_STALL moves)?
    if (Math.abs(e.x - (k.atX ?? e.x)) + Math.abs(e.y - (k.atY ?? e.y)) > 3 || k.atX === undefined) {
      k.atX = e.x;
      k.atY = e.y;
      k.stall = 0;
    } else if (++k.stall > HELI_STALL) {
      k.stall = 0;
      k.escape = HELI_ESCAPE;
    }
  },

  // A cell toward (su, sv); with something in the way, up over it, or
  // straight across; or, boxed in, back the other way, or down.
  heliStep(e, su, sv) {
    if (this.heliMove(e, su, sv)) return;
    const back = su !== 0 ? -su : e.facing;
    for (const [a, b] of [[su, 1], [0, 1], [su, 0], [back, 1], [back, 0], [0, -1], [su, -1], [back, -1]]) {
      if ((a !== su || b !== sv) && (a !== 0 || b !== 0) && this.heliMove(e, a, b)) return;
    }
  },

  // A cell `du` across and `dv` up (each -1, 0 or 1), turning to face the
  // way it's going across. False if it couldn't.
  heliMove(e, du, dv) {
    const x = e.x + du * e.gy - dv * e.gx, y = e.y - du * e.gx - dv * e.gy;
    const face = du !== 0 ? du : e.facing;
    for (const f of face !== e.facing ? [face, e.facing] : [face]) {
      if (this.moveBody(e, x, y, 0, f, e.gx, e.gy)) return true;
      // Loose stuff in the way (a leaf caught in its tail, dust, rubble)
      // is swept aside.
      if (this.sweepFor(e, x, y, f) && this.moveBody(e, x, y, 0, f, e.gx, e.gy)) return true;
    }
    return false;
  },

  // Sweep what's loose (powders, rubble) or wild (leaves, plants, the wood
  // of trees: never what humans built) out of the cells e's body would take
  // at (x, y) facing f: pushed aside, or cleared. False (sweeping nothing)
  // if anything else is in the way. `leavesOnly`: just what's wild
  // (growth and tree wood: a missile tearing through a tree), which is
  // cleared away.
  sweepFor(e, x, y, f, leavesOnly = false) {
    const out = this.footB;
    if (!this.placeCells(e.kind, x, y, 0, f, e.gx, e.gy, out)) return false;
    const loose = [];
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = out[p];
      if (this.roomForBody(e, c)) continue;
      const t = this.type[c], d = DEFS[t];
      if (SHAPED[t] || this.wall[c] !== 0) return false;
      if (leavesOnly ? !this.wild(c) : !(d.state === POWDER || this.loose[c] || this.wild(c))) return false;
      loose.push(c);
    }
    for (const c of loose) {
      if (leavesOnly) this.clearCell(c); // torn through
      else this.makeRoom(c, out, e.n);
    }
    return loose.length > 0;
  },

  // Where its gun is: under its nose.
  heliMuzzle(e) {
    const f = e.facing;
    return [e.x + 5 * f * e.gy - 2 * e.gx, e.y - 5 * f * e.gx - 2 * e.gy];
  },

  // A round every HELI_GUN_EVERY steps at a random pixel of the nearest
  // enemy (person or aircraft) within HELI_GUN_R that it can see: nothing
  // else first on the line. (k.foe: what it last shot at.)
  heliShoot(e, k) {
    if (++k.reload < HELI_GUN_EVERY) return;
    const [mx, my] = this.heliMuzzle(e);
    if (!this.inBounds(mx, my)) return;
    const near = [];
    for (const o of this.creatures) {
      if (!this.enemyOf(k.camp, o)) continue;
      const d = Math.max(Math.abs(o.x - mx), Math.abs(o.y - my));
      if (d <= HELI_GUN_R) near.push([d, o]);
    }
    near.sort((p, q) => p[0] - q[0]);
    for (let n = 0; n < near.length && n < 4; n++) {
      const o = near[n][1], aim = this.randomCell(o);
      if (aim < 0) continue;
      const ax = aim % this.w, ay = (aim / this.w) | 0;
      if (this.lineFirst(e, mx, my, ax, ay) !== o) continue;
      k.reload = 0;
      k.foe = o;
      const a = Math.atan2(ay - my, ax - mx) + (this.rand() - 0.5) * 2 * HELI_SPREAD;
      this.pellet(e, mx, my, Math.cos(a), Math.sin(a));
      return;
    }
  },

  // ---- missiles -----------------------------------------------------------------

  // Send the missile waiting in its tube at (tx, ty).
  launch(e, tx, ty) {
    const k = e.craft;
    if (k.state !== 'flying') {
      k.state = 'flying';
      k.fx = e.x;
      k.fy = e.y;
      k.hx = -e.gx; // straight up out of the tube
      k.hy = -e.gy;
      k.speed = 0.3;
      k.boost = MISSILE_BOOST;
      k.fuel = MISSILE_FUEL;
      k.held = 0;
    }
    k.tx = tx;
    k.ty = ty;
    // Over the hills and trees between: straight up to APEX over the
    // higher end of its way (in its tube's frame), across at that height,
    // and straight down on the target (so only what's right over it is in
    // the way).
    const gx = e.gx, gy = e.gy, up = (x, y) => -(x * gx + y * gy);
    const top = Math.max(up(tx, ty), up(e.x, e.y)) + APEX;
    const over = (x, y) => [
      Math.max(TURN_ROOM, Math.min(this.w - 1 - TURN_ROOM, x - gx * (top - up(x, y)))),
      Math.max(TURN_ROOM, Math.min(this.h - 1 - TURN_ROOM, y - gy * (top - up(x, y)))),
    ];
    k.way = [over(e.x, e.y), over(tx, ty)];
    k.leg = 0;
  },

  stepMissile(e, k) {
    if (e.lost >= MISSILE_TOUGH) { // hit hard enough: it goes off
      this.detonate(e);
      return;
    }
    if (k.state !== 'flying') return;
    k.speed = Math.min(MISSILE_SPEED, k.speed + MISSILE_ACCEL);
    if (k.boost > 0) {
      k.boost -= k.speed;
    } else {
      // Turn its nose toward the next point of its way, then the target, a
      // little at a time.
      const way = k.way ?? [];
      if (k.leg < way.length && Math.hypot(way[k.leg][0] - k.fx - NOSE * k.hx, way[k.leg][1] - k.fy - NOSE * k.hy) < APEX_NEAR) k.leg++;
      const [qx, qy] = k.leg < way.length ? way[k.leg] : [k.tx, k.ty];
      const want = Math.atan2(qy - k.fy - NOSE * k.hy, qx - k.fx - NOSE * k.hx), now = Math.atan2(k.hy, k.hx);
      let d = want - now;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      const a = now + Math.max(-MISSILE_TURN, Math.min(MISSILE_TURN, d));
      k.hx = Math.cos(a);
      k.hy = Math.sin(a);
    }
    k.fx += k.hx * k.speed;
    k.fy += k.hy * k.speed;
    if (--k.fuel <= 0) {
      this.detonate(e);
      return;
    }
    // Its body follows, a cell at a time, pointing the way it flies.
    const [dx, dy] = dir8(k.hx, k.hy);
    for (let n = 0; n < 3; n++) {
      const sx = Math.sign(Math.round(k.fx) - e.x), sy = Math.sign(Math.round(k.fy) - e.y);
      if (sx === 0 && sy === 0) break;
      const nx = e.x + sx, ny = e.y + sy;
      // Leaving its tube and climbing over its own camp, it pushes through
      // what's loose or growing (sand on its fins, a tree over the tube);
      // after that it tears through what's soft and wild (leaves and other
      // growth, and the wood of trees: wild, never what humans built), and
      // goes off on anything else it hits.
      if (!this.moveBody(e, nx, ny, 0, 1, -dx, -dy) && !this.moveBody(e, nx, ny, 0, 1, e.gx, e.gy)
        && !(this.sweepFor(e, nx, ny, 1, k.boost <= 0 && k.leg > 0) && this.moveBody(e, nx, ny, 0, 1, e.gx, e.gy))) {
        // Its own side in the way (its helicopter taking off, say): it
        // waits for it to move, a little while.
        if (this.ownInWay(e, k, sx, sy) && ++k.held < MISSILE_HOLD) {
          k.fx = e.x;
          k.fy = e.y;
          return;
        }
        this.detonate(e); // it hit something (or the edge of the world)
        return;
      }
    }
    if (e.gx !== -dx || e.gy !== -dy) this.moveBody(e, e.x, e.y, 0, 1, -dx, -dy);
    if (k.boost <= 0 && Math.hypot(k.tx - k.fx - NOSE * k.hx, k.ty - k.fy - NOSE * k.hy) <= 2) this.detonate(e);
  },

  // Is a creature of its own camp (a human, or its helicopter) in the way
  // of missile e moving (sx, sy)?
  ownInWay(e, k, sx, sy) {
    const out = this.footA;
    if (k.camp === null || !this.placeCells(e.kind, e.x + sx, e.y + sy, 0, 1, e.gx, e.gy, out)) return false;
    for (let p = 0; p < e.n; p++) {
      const o = this.creatureAt(out[p]);
      if (o === null || o === e) continue;
      if ((o.brain !== null && o.brain.camp === k.camp) || (o.craft !== null && o.craft.camp === k.camp)) return true;
    }
    return false;
  },

  // The missile goes off: it's gone, and where its nose was there's a
  // crater.
  detonate(e) {
    const nose = e.pix[0] === BODY ? e.cells[0] : e.y * this.w + e.x;
    const k = e.craft;
    if (k.camp !== null && k.camp.launcher !== null && k.camp.launcher.missile === e) k.camp.launcher.missile = null;
    this.removeCreature(e);
    this.crater(nose % this.w, (nose / this.w) | 0, CRATER_R);
    if (k.camp !== null) this.missileLanded(nose % this.w, (nose / this.w) | 0, k.camp); // (grudges.js)
  },

  // A crater of radius r at (x, y): the middle blown away (into smoke and a
  // little fire), the solids round it broken loose to fall as rubble, then
  // a blast that throws what's loose and hurts what's alive.
  crater(x, y, r) {
    const { w, h } = this;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy, d2 = dx * dx + dy * dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || d2 > r * r) continue;
        const c = ny * w + nx, t = this.type[c];
        if (t === 0 || SHAPED[t] || this.wall[c] !== 0 || DEFS[t].indestructible) continue;
        if (d2 <= r * r * 0.45) {
          this.clearCell(c);
          const roll = this.rand();
          if (roll < 0.25) this.spawn(c, ID.SMOKE);
          else if (roll < 0.33) this.spawn(c, ID.FIRE);
        } else if (DEFS[t].state === SOLID && this.rand() < 0.7) {
          this.loose[c] = 1; // rubble
          this.wakeAt(nx, ny);
        }
      }
    }
    this.blast(x, y, CRATER_BLAST);
  },

  // A war machine dies: a helicopter comes down in pieces (scrap metal,
  // falling loose, and a small blast); a missile goes off.
  craftDies(e) {
    const k = e.craft;
    if (k.kind === 'missile') {
      this.detonate(e);
      return;
    }
    if (k.camp !== null && k.camp.heli === e) k.camp.heli = null;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = e.cells[p];
      if (this.rand() < 0.6) {
        this.convert(c, ID.METAL, false, -1);
        this.loose[c] = 1;
      } else {
        this.clearCell(c);
        if (this.rand() < 0.3) this.spawn(c, ID.SMOKE);
      }
    }
    this.forgetCreature(e);
    this.blast(e.x, e.y, WRECK_BLAST);
  },
};

