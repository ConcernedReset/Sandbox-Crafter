// War: what a settled camp builds once its humans are armed, and its raids
// on other camps (humans.js runs the humans; aircraft.js flies the
// helicopter and the missiles).
//
// Building: one human at a time (camp.engineer), with its own gun and
// armour, builds the camp's war machines in order: a helicopter (its pad on
// the hut's roof, or on the lawn if the roof has no room above it) or an
// anti-air gun first (camp.firstWar, picked at random), then the other,
// then a missile launcher at the far end of the lawn. Stone it fetches,
// metal it mines (as for its gun). A helicopter is 10 metal brought to its
// pad; it builds itself there. The anti-air gun is kept loaded with
// gunpowder; the launcher is loaded with gunpowder and metal, and a
// missile is made in its tube. Anything destroyed is built again, the hut
// too (from scratch somewhere else if its ground is gone).
//
// The anti-air gun shoots at anything that flies near the camp (another
// camp's missiles first, then its helicopters, phoenixes, birds, and
// insects): slow shells, aimed ahead of where the target is going, that
// burst near the distance they were set for: not very accurate. Never at
// anything low over the camp or near its own people.
//
// Raids: from the camp's first war machine on, every 5 to 10 minutes it
// sends a quarter of its people (armed ones, never the engineer), its
// helicopter and its missile against the nearest other camp. Raiders walk
// there and fight (their usual shooting), and come home when the raid is
// over.
//
// Births: a camp with its hut up (or none to be had) and its fire burning
// gains a human every BIRTH_EVERY steps (born in the hut), up to POP_CAP.
//
// Mixed into World.prototype.

import { DEFS, ID, State } from './elements.js';
import { SHAPED } from './creatures.js';
import {
  HUT_W, HUT_WALL, WALK_EVERY, MATERIAL, METALS, AMMO_LOW, STONE_R,
} from './humans.js';

const { SOLID, POWDER, LIQUID } = State;
const { GUNPOWDER, COAL, HUMAN, HELICOPTER, MISSILE, SMOKE, WOOD } = ID;

export const HELI_METAL = 10; // metal for a helicopter
export const AA_CAP = 20; // gunpowder the anti-air gun holds, a shell each
export const AA_LOW = 8; // it's topped up when it has less than this
export const MISSILE_POWDER = 4, MISSILE_METAL = 2; // what a missile takes
export const AA_R = 100; // how far it shoots
const AA_UP = 6; // only at what's at least this high above the gun
const AA_SAFE = 8; // and no nearer the middle of any of its own people than this (a burst reaches 4)
export const AA_EVERY = 30; // steps between shells
const AA_TURN = 0.15; // radians a step the barrel turns
const AA_AIMED = 0.08; // and how near the aim it has to be to fire
const AA_JITTER = 0.035; // radians either way a shell may go off its aim
const AA_FUSE_ERR = 0.12; // and how far out its fuse may be (a share of it)
const AA_LOOK = 6; // steps between looks for something better to shoot at
const AA_SCAN = 30; // and between looks round for insects
export const SHELL_SPEED = 2.5; // cells a step
const FLAK_BLAST = 6; // a shell's burst
const FLAK_R = 3; // insects this close to it are killed
export const BARREL = 4; // the barrel's length (drawn)
export const RAID_MIN = 18000, RAID_MAX = 36000; // steps between raids: 5 to 10 minutes
export const RAID_FOR = 5000; // the longest a raid goes on
export const RAID_SHARE = 0.25; // of the camp's people go
const RAID_RETRY = 1200; // nobody to raid, or to go: it tries again this much later
const RAID_NEAR = 10; // raiders make for this close to the enemy's fire
const HOME_NEAR = 10; // and come home to this close to their own
export const BIRTH_EVERY = 3000; // steps between births in a camp
export const POP_CAP = 10; // and the most people a camp grows to
const PLAN_RETRY = 600; // a war machine with nowhere to go: it looks again this much later
const CHORES_EVERY = 60; // steps between a camp's checks on births, its hut and raids
const BUILD_EVERY = 6; // steps per cell built
const SKY = 12; // rows of open sky (but for wild growth) a helipad needs over it
const PIT_U = 6, PIT_UP = 12; // the fire pit kept clear of growth: columns either side, rows up
// Growth (plants, leaves, saplings, moss...) and the wood of trees: cleared
// from a war machine's site.
const GROWTH = Uint8Array.from(DEFS, (d) => (d.cat === 'life' && (d.state === SOLID || d.state === POWDER) && !d.shape ? 1 : 0));
const FIRE = Uint8Array.from(DEFS, (d) => (d.key === 'FIRE' || d.key === 'CAMPFIRE' ? 1 : 0));
// Insects that fly: single cells, not creatures with bodies.
const FLIER = Uint8Array.from(DEFS, (d) => (d.critter && !d.shape && d.critter.moves === 'fly' ? 1 : 0));
const BLOCKED = { blocked: true }; // (aaSight: something not alive in the way)

export const War = {
  // ---- the camp's chores: births, the hut, raids, the anti-air gun ---------------

  // Once a step: shells in flight, every camp's anti-air gun, and (once a
  // second, each camp on its own beat) births, hut repairs and raids.
  stepWar() {
    if (this.flak.length !== 0) this.stepFlak();
    if (this.charges.length !== 0) this.stepCharges(); // (grudges.js)
    for (const camp of this.camps) {
      const aa = camp.aa;
      if (aa !== null) {
        aa.done = this.nextWarCell(aa) < 0;
        if (aa.done) this.stepAA(camp, aa);
      }
      if ((this.tick + camp.id) % CHORES_EVERY === 0) this.campChores(camp);
    }
  },

  campChores(camp) {
    const hut = camp.hut;
    // The fire pit is kept clear of growth: a sapling there grows into a
    // tree that walls one side of the camp off from the other.
    for (let v = 0; v >= -PIT_UP; v--) {
      for (let u = -PIT_U; u <= PIT_U; u++) {
        const c = this.campCell(camp, u, v);
        if (c >= 0 && GROWTH[this.type[c]] === 1 && !this.madeByHuman(c)) this.clearCell(c);
      }
    }
    // Births.
    if ((camp.noHut || (hut !== null && hut.done)) && this.canCraft(camp) && camp.members.size < POP_CAP && this.burning(camp)) {
      if (camp.birthAt === 0) camp.birthAt = this.tick + BIRTH_EVERY;
      else if (this.tick >= camp.birthAt && this.bear(camp)) camp.birthAt = this.tick + BIRTH_EVERY;
    }
    // A damaged hut is mended; one whose ground has gone is built again
    // somewhere else (and the lawn levelled round it).
    if (hut !== null && hut.done && this.nextHutCell(hut) >= 0) {
      let floor = 0;
      for (let u = hut.u0; u < hut.u0 + HUT_W; u++) {
        for (let v = hut.floor + 1; v <= hut.floor + 3; v++) { // (a hut may stand on a slope 2 cells high)
          const c = this.campCell(camp, u, v);
          if (c >= 0 && this.builtAt(c)) {
            floor++;
            break;
          }
        }
      }
      if (floor >= HUT_W - 2) {
        hut.done = false;
      } else {
        camp.hut = null;
        camp.hutFails = 0;
        camp.flat = false;
        camp.flattener = 0;
        if (camp.pad !== null && camp.pad.roof) camp.pad = null;
      }
    }
    // Anger, and hitting back (grudges.js).
    this.campAnger(camp);
    // Trees running out: it plants more (planting.js).
    this.plantChores(camp);
    // Raids: the clock starts with the camp's first war machine.
    if (camp.raid !== null) {
      if (this.raidOver(camp)) this.endRaid(camp);
    } else if (camp.raidAt === 0) {
      if (this.alive(camp.heli) || (camp.aa !== null && camp.aa.done)) camp.raidAt = this.tick + this.raidGap();
    } else if (this.tick >= camp.raidAt && !this.startRaid(camp)) {
      camp.raidAt = this.tick + RAID_RETRY;
    }
  },

  raidGap() {
    return RAID_MIN + Math.floor(this.rand() * (RAID_MAX - RAID_MIN));
  },

  // A human born in the camp's hut (or by its fire, with no hut): a seed
  // of one on its floor, which grows (and joins the camp when it first
  // thinks). True if there was room.
  bear(camp) {
    const hut = camp.hut;
    // In the hut, or (a camp that does without one) a few cells from its
    // fire, either side: where there's room for a body.
    const spots = hut !== null ? [4, 3, 5, 2, 6].map((k) => [hut.u0 + k, hut.floor])
      : [5, -5, 7, -7, 9, -9, 11, -11].map((u) => [u, (this.groundAt(camp, u) ?? 1) - 1]);
    for (const [u, v] of spots) {
      const c = this.campCell(camp, u, v);
      if (c >= 0 && this.type[c] === 0 && this.roomForBaby(c % this.w, (c / this.w) | 0, camp.gx, camp.gy)) {
        this.spawn(c, HUMAN);
        return true;
      }
    }
    return false;
  },

  // Nothing but air (or gas) in the 3x6 box over (x, y): room for a body to
  // grow.
  roomForBaby(x, y, gx, gy) {
    for (let up = 0; up < 6; up++) {
      for (let k = -1; k <= 1; k++) {
        const cx = x + k * gy - up * gx, cy = y - k * gx - up * gy;
        if (!this.inBounds(cx, cy)) return false;
        const t = this.type[cy * this.w + cx];
        if (t !== 0 && DEFS[t].state !== State.GAS) return false;
      }
    }
    return true;
  },

  // ---- raids --------------------------------------------------------------------

  // The nearest other camp with anyone in it, or null.
  nearestRival(camp) {
    let best = null, bd = Infinity;
    for (const c of this.camps) {
      if (c === camp || c.members.size === 0) continue;
      const d = Math.max(Math.abs(c.x - camp.x), Math.abs(c.y - camp.y));
      if (d < bd) {
        best = c;
        bd = d;
      }
    }
    return best;
  },

  // Where a missile is aimed at camp c: its hut's roof, or its fire.
  aimPoint(c) {
    const cell = c.hut !== null ? this.campCell(c, c.hut.u0 + (HUT_W >> 1), c.hut.floor - HUT_WALL) : this.campCell(c, 0, -2);
    return cell >= 0 ? [cell % this.w, (cell / this.w) | 0] : [c.x, c.y];
  },

  // Send a quarter of the camp (rounded up; armed humans, not the
  // engineer, nearest the enemy first), its helicopter and its missile
  // against the nearest other camp. False if there's nobody to raid, or
  // nothing to raid with.
  startRaid(camp, enemy = this.nearestRival(camp)) {
    if (enemy === null) return false;
    const want = Math.ceil(camp.members.size * RAID_SHARE);
    const pick = [];
    for (const id of camp.members) {
      const o = this.creatureById[id];
      if (!o || o.brain === null || o.grow >= 0 || id === camp.engineer || camp.sap?.id === id) continue;
      const b = o.brain;
      if (!this.armed(b) || this.has(b, GUNPOWDER) < AMMO_LOW || b.raid !== null) continue;
      if (b.job === 'swimming' || b.job === 'fleeing' || this.isInside(o.x, o.y)) continue;
      pick.push(o);
    }
    const far = (o) => Math.max(Math.abs(o.x - enemy.x), Math.abs(o.y - enemy.y));
    pick.sort((a, c) => far(a) - far(c));
    const party = pick.slice(0, want);
    const ln = camp.launcher;
    const missile = ln !== null && this.alive(ln.missile) && ln.missile.grow < 0 ? ln.missile : null;
    const heli = this.alive(camp.heli) && camp.heli.grow < 0 ? camp.heli : null;
    if (party.length === 0 && missile === null && heli === null) return false;
    for (const o of party) {
      const b = o.brain;
      this.release(b);
      b.tun = null;
      b.raid = enemy;
      b.job = 'raiding';
      b.think = 0;
      b.path = null;
      b.goalX = -1;
      b.stuck = 0;
      b.best = Infinity;
      b.climbing = false;
    }
    camp.raid = { enemy, until: this.tick + RAID_FOR, start: this.tick, party: party.map((o) => o.id) };
    camp.raidAt = -1;
    camp.raids++;
    // The first raid between two camps is war, for both (grudges.js).
    this.goToWar(camp, enemy);
    this.goToWar(enemy, camp);
    if (missile !== null) {
      const [tx, ty] = this.aimPoint(enemy);
      this.launch(missile, tx + Math.round((this.rand() - 0.5) * 6), ty);
      ln.missile = null; // on its way: the launcher can be loaded again
    }
    return true;
  },

  // Is camp's raid over: its time up, the enemy camp gone, or nobody (nor
  // its helicopter) still at it?
  raidOver(camp) {
    const r = camp.raid;
    if (this.tick >= r.until || !this.camps.includes(r.enemy)) return true;
    if (this.tick - r.start < 300) return false;
    const heli = camp.heli;
    if (this.alive(heli) && heli.craft.state === 'flying' && heli.craft.goal === r.enemy) return false;
    return !r.party.some((id) => this.creatureById[id]?.brain?.raid === r.enemy);
  },

  endRaid(camp) {
    camp.raid = null;
    camp.raidAt = this.tick + this.raidGap();
  },

  // A raider's part, ahead of everything else it might do: making for the
  // enemy's camp while the raid is on (its fights it picks as usual), then
  // home. True if that gave it a job.
  raidWork(e, b, camp) {
    if (b.raid === null) return false;
    const r = camp.raid;
    if (r !== null && r.enemy === b.raid && this.camps.includes(b.raid) && this.armed(b)) {
      b.job = 'raiding';
      return true;
    }
    b.raid = null;
    b.awayAt = -1; // from now on it can stray, if it never gets home
    b.path = null;
    b.job = 'going home';
    return true;
  },

  raidMarch(e, b) {
    const enemy = b.raid;
    if (enemy === null || !this.camps.includes(enemy)) {
      b.think = 0;
      return;
    }
    if (this.walkTo(e, b, enemy.x, enemy.y, RAID_NEAR, WALK_EVERY)) this.pose(e, 0);
  },

  goHome(e, b) {
    const camp = b.camp;
    if (camp === null || this.walkTo(e, b, camp.x, camp.y, HOME_NEAR, WALK_EVERY)) {
      b.job = 'wandering';
      b.think = 0;
    }
  },

  // ---- blueprints ---------------------------------------------------------------

  // A war machine's blueprint: its cells, in the order they're built, what
  // each is made of ('stone' or 'metal'), and where its builder stands.
  blueprint(name, camp, parts, extra) {
    const cells = [], mats = [], us = [];
    for (const [u, v, m] of parts) {
      const c = this.campCell(camp, u, v);
      if (c < 0) return null;
      cells.push(c);
      mats.push(m);
      us.push(u);
    }
    return { name, cells, mats, us, set: new Set(cells), done: false, waitUntil: 0, tries: 0, ...extra };
  },

  // The next cell of blueprint s still to build (its index), or -1.
  nextWarCell(s) {
    for (let k = 0; k < s.cells.length; k++) if (!this.builtAt(s.cells[k])) return k;
    return -1;
  },

  // The camp's blueprint for `what` ('pad', 'aa' or 'launcher'), planning
  // it if it has none yet: or null (nowhere for it, for now).
  warPlan(camp, what) {
    if (camp[what] !== null) return camp[what];
    if (this.tick < camp.planRetry[what]) return null;
    const plan = what === 'pad' ? this.planPad(camp) : what === 'aa' ? this.planAA(camp) : this.planLauncher(camp);
    if (plan === null) camp.planRetry[what] = this.tick + PLAN_RETRY;
    camp[what] = plan;
    return plan;
  },

  // Is cell c clear for building in (or for a body): empty, a gas or a
  // flame, wild growth or wood (cleared away when it's built), or a
  // creature passing by?
  clearForBuilding(c) {
    const t = this.type[c];
    if (t === 0 || SHAPED[t] || this.wild(c)) return true;
    const s = DEFS[t].state;
    return s !== SOLID && s !== POWDER && s !== LIQUID;
  },

  // Is cell c growth, or wood nobody put there (a tree)?
  wild(c) {
    const t = this.type[c];
    return (GROWTH[t] === 1 || t === WOOD) && !this.madeByHuman(c);
  },

  // Clear the wild growth and wood out of the box u0..u1, v0..v1 (v0 the
  // lower) of the camp's frame: room for a war machine to be built, and to
  // fly out.
  clearWild(camp, u0, u1, v0, v1) {
    for (let v = v0; v >= v1; v--) {
      for (let u = u0; u <= u1; u++) {
        const c = this.campCell(camp, u, v);
        if (c < 0 || this.type[c] === 0 || !this.wild(c)) continue;
        const wood = this.type[c] === WOOD;
        this.clearCell(c);
        if (wood) this.fell(c % this.w, (c / this.w) | 0); // (the rest of the tree comes down)
      }
    }
  },

  // Where its pad goes: on the hut's roof (a row of stone a cell wider
  // than the hut either side), with room for a helicopter above (once wild
  // growth is cleared); or else at the far end of the lawn.
  planPad(camp) {
    const hut = camp.hut, v = hut.floor - HUT_WALL - 1;
    let room = true;
    for (let u = hut.u0 - 3; u <= hut.u0 + HUT_W + 2 && room; u++) {
      for (let vv = v; vv >= v - SKY && room; vv--) {
        const c = this.campCell(camp, u, vv);
        room = c >= 0 && this.clearForBuilding(c);
      }
    }
    if (room) {
      const parts = [];
      for (let k = 0; k <= HUT_W + 1; k++) parts.push([hut.u0 - 1 + k, v, 'stone']);
      const at = this.campCell(camp, hut.u0 + (HUT_W >> 1), v - 1);
      const s = this.blueprint('helipad', camp, parts, { roof: true, u0: hut.u0 - 1, w: HUT_W + 2, base: v });
      if (s !== null && at >= 0) return { ...s, hx: at % this.w, hy: (at / this.w) | 0, facing: hut.side };
    }
    const W = 13, site = this.findSite(camp, W, SKY, true);
    if (site === null) return null;
    const { u0, base } = site, parts = this.supports(site, 1, W - 2);
    for (let k = 1; k < W - 1; k++) parts.push([u0 + k, base, 'stone']);
    const at = this.campCell(camp, u0 + (W >> 1), base - 1);
    const s = this.blueprint('helipad', camp, parts, { roof: false, u0, w: W, base });
    return s === null || at < 0 ? null : { ...s, hx: at % this.w, hy: (at / this.w) | 0, facing: 1 };
  },

  // The anti-air gun: a stone base 5 wide, a metal mount 3 wide on it, and
  // the barrel (drawn) pivoting above the mount. Near the hut.
  planAA(camp) {
    const W = 5, site = this.findSite(camp, W, 7, false);
    if (site === null) return null;
    const { u0, base } = site, parts = this.supports(site, 0, W - 1);
    for (let k = 0; k < W; k++) parts.push([u0 + k, base, 'stone']);
    for (let k = 1; k < W - 1; k++) parts.push([u0 + k, base - 1, 'metal']);
    const p = this.campCell(camp, u0 + 2, base - 2);
    const s = this.blueprint('anti-air gun', camp, parts, { roof: false, u0, w: W, base });
    if (s === null || p < 0) return null;
    return {
      ...s, px: p % this.w, py: (p / this.w) | 0,
      ammo: 0, filling: true, reload: 0, aim: Math.atan2(-camp.gy, -camp.gx), target: null, track: null, shots: 0,
    };
  },

  // The launcher: a tube of two metal walls 6 high, 3 apart, on a floor;
  // the missile is made in it. At the far end of the lawn (it's too tall
  // to walk over).
  planLauncher(camp) {
    const W = 5, site = this.findSite(camp, W, 14, true);
    if (site === null) return null;
    const { u0, base } = site, parts = this.supports(site, 0, W - 1);
    for (let v = base; v > base - 6; v--) parts.push([u0, v, 'metal'], [u0 + W - 1, v, 'metal']);
    const m = this.campCell(camp, u0 + 2, base);
    const s = this.blueprint('launcher', camp, parts, { roof: false, u0, w: W, base });
    if (s === null || m < 0) return null;
    return { ...s, mx: m % this.w, my: (m / this.w) | 0, powder: 0, metal: 0, missile: null };
  },

  // Stone to fill the dips under a site's columns k0..k1 (counted from its
  // first), up to the row it's built on: [u, v, 'stone'], bottom first.
  supports(site, k0, k1) {
    const parts = [];
    for (let k = k0; k <= k1; k++) {
      for (let v = site.ground[k] - 1; v > site.base; v--) parts.push([site.u0 + k, v, 'stone']);
    }
    return parts;
  },

  // A site near the hut for something W columns wide and H high: ground
  // within 2 cells of the lawn's level all the way across (its dips are
  // filled), room above it, clear of the fire, the places to rest by it,
  // the hut and the other war machines; on the lawn if it can be, and
  // nearest the hut, or (`far`) as far from it as can be. { u0, base (the
  // row it's built on), ground (each column's ground row) }, or null.
  findSite(camp, W, H, far) {
    const hut = camp.hut, l = this.lawn(camp);
    if (hut === null || l === null) return null;
    const rest = -hut.side; // the side of the fire it rests on
    const busy = [[-6, 6], [Math.min(rest * 3, rest * 12), Math.max(rest * 3, rest * 12)], [hut.u0 - 2, hut.u0 + HUT_W + 1]];
    for (const s of [camp.pad, camp.aa, camp.launcher]) if (s !== null && !s.roof) busy.push([s.u0 - 2, s.u0 + s.w + 1]);
    const mid = hut.u0 + (HUT_W >> 1);
    let best = null, bs = Infinity;
    for (let u0 = l.u0 - 12; u0 + W - 1 <= l.u1 + 12; u0++) {
      const u1 = u0 + W - 1;
      if (busy.some(([a, b]) => u0 <= b && u1 >= a) || camp.badSites.some(([a, b]) => u0 <= b && u1 >= a)) continue;
      const d = Math.abs(u0 + (W >> 1) - mid);
      const score = (u0 >= l.u0 && u1 <= l.u1 ? 0 : 1000) + (far ? -d : d);
      if (score >= bs) continue;
      const site = this.siteAt(camp, u0, W, H, l.level);
      if (site === null) continue;
      best = site;
      bs = score;
    }
    return best;
  },

  siteAt(camp, u0, W, H, level) {
    const ground = [];
    let top = Infinity;
    for (let k = 0; k < W; k++) {
      const g = this.groundAt(camp, u0 + k);
      if (g === null || Math.abs(g - level) > 2) return null;
      const c = this.campCell(camp, u0 + k, g);
      if (c < 0 || this.isInside(c % this.w, (c / this.w) | 0)) return null;
      ground.push(g);
      top = Math.min(top, g);
    }
    const base = top - 1;
    for (let k = 0; k < W; k++) {
      for (let v = ground[k] - 1; v >= base - H; v--) {
        const c = this.campCell(camp, u0 + k, v);
        if (c < 0 || !this.clearForBuilding(c)) return null;
      }
    }
    return { u0, base, ground };
  },

  // Where to stand to build cell k of s (or to work at s, k -1): in the
  // hut for its roof; beside it, on the side nearer e, on the ground.
  standFor(camp, s, k, e) {
    if (s.roof) {
      const hut = camp.hut;
      if (hut === null) return -1;
      const u = k < 0 ? hut.u0 + (HUT_W >> 1) : Math.min(hut.u0 + HUT_W - 3, Math.max(hut.u0 + 2, s.us[k]));
      return this.campCell(camp, u, hut.floor);
    }
    const spot = (u) => {
      const g = this.groundAt(camp, u);
      return this.campCell(camp, u, (g ?? s.base + 1) - 1);
    };
    const a = spot(s.u0 - 3), b = spot(s.u0 + s.w + 2); // (clear of it, even a cell off)
    if (a < 0) return b;
    if (b < 0) return a;
    const d = (c) => Math.abs((c % this.w) - e.x) + Math.abs(((c / this.w) | 0) - e.y);
    return d(a) <= d(b) ? a : b;
  },

  // ---- the engineer ---------------------------------------------------------------

  // Is the camp ready for war machines: its hut up, its lawn level, its
  // fire burned long enough to craft?
  warReady(camp) {
    return camp.hut !== null && camp.hut.done && camp.flat && this.canCraft(camp);
  },

  // Its camp's war machines, for a human with its own gun and armour: if
  // nobody else is the engineer, the next thing to build, load or fetch for
  // (going on to the next machine when one can't be got on with). True if
  // that gave it a job.
  warWork(e, b, camp) {
    if (b.weapon === 0 || b.armour === 0 || !this.warReady(camp)) {
      if (camp.engineer === e.id) camp.engineer = 0; // (someone else can take it on)
      return false;
    }
    if (camp.engineer !== 0 && camp.engineer !== e.id) {
      const o = this.creatureById[camp.engineer];
      if (o && o.brain !== null && o.brain.camp === camp) return false;
      camp.engineer = 0;
    }
    if (camp.firstWar === null) camp.firstWar = this.rand() < 0.5 ? 'heli' : 'aa';
    const order = camp.firstWar === 'aa' ? ['aa', 'heli', 'launcher'] : ['heli', 'aa', 'launcher'];
    for (const what of order) {
      // The launcher only once the other two are up (or have nowhere to go):
      // not with the metal it's been getting for the helicopter, say.
      if (what === 'launcher' && !((this.alive(camp.heli) || camp.pad === null) && (camp.aa === null || camp.aa.done))) break;
      if (this.warStep(e, b, camp, what) === 'busy') {
        camp.engineer = e.id;
        return true;
      }
    }
    if (camp.engineer === e.id) camp.engineer = 0;
    return false;
  },

  // The next thing to do for one war machine: 'busy' (that's its job now),
  // 'done' (nothing needed) or 'stuck' (needed, but not now).
  warStep(e, b, camp, what) {
    if (what === 'heli') {
      const pad = this.warPlan(camp, 'pad');
      if (pad === null) return 'stuck';
      const r = this.buildStep(e, b, camp, pad);
      if (r !== 'done') return r;
      if (this.alive(camp.heli)) {
        // A new pad (the hut was built again somewhere else): it moves there.
        const k = camp.heli.craft;
        if (k.homeX !== pad.hx || k.homeY !== pad.hy || k.homeFacing !== pad.facing) {
          k.homeX = pad.hx;
          k.homeY = pad.hy;
          k.homeFacing = pad.facing;
          if (k.state === 'parked' || k.state === 'down') {
            k.state = 'home';
            k.blocked = 0;
            k.pace = 0;
          }
        }
        return 'done';
      }
      if (this.tick < pad.waitUntil) return 'stuck';
      this.share(e, b, camp, 'metal', HELI_METAL - this.holding(b, METALS));
      if (this.holding(b, METALS) >= HELI_METAL) return this.warJob(b, pad, 'building the helicopter');
      return this.startMining(e, b, camp, 'metal', HELI_METAL) ? 'busy' : 'stuck';
    }
    if (what === 'aa') {
      const aa = this.warPlan(camp, 'aa');
      if (aa === null) return 'stuck';
      const r = this.buildStep(e, b, camp, aa);
      if (r !== 'done') return r;
      if (aa.ammo < AA_LOW) aa.filling = true;
      if (aa.ammo >= AA_CAP) aa.filling = false;
      if (!aa.filling) return 'done';
      const need = AA_CAP - aa.ammo;
      this.share(e, b, camp, 'gunpowder', need - (this.has(b, GUNPOWDER) - AMMO_LOW));
      const spare = this.has(b, GUNPOWDER) - AMMO_LOW;
      if (spare >= need || spare >= 6) return this.warJob(b, aa, 'loading the anti-air gun');
      return this.powderFor(e, b, camp, need);
    }
    const ln = this.warPlan(camp, 'launcher');
    if (ln === null) return 'stuck';
    const r = this.buildStep(e, b, camp, ln);
    if (r !== 'done') return r;
    if (this.alive(ln.missile) || this.tick < ln.waitUntil) return 'done';
    const metal = MISSILE_METAL - ln.metal, powder = MISSILE_POWDER - ln.powder;
    this.share(e, b, camp, 'metal', metal - this.holding(b, METALS));
    this.share(e, b, camp, 'gunpowder', powder - (this.has(b, GUNPOWDER) - AMMO_LOW));
    if (metal > 0 && this.holding(b, METALS) < metal) return this.startMining(e, b, camp, 'metal', metal) ? 'busy' : 'stuck';
    if (powder > 0 && this.has(b, GUNPOWDER) - AMMO_LOW < powder) return this.powderFor(e, b, camp, powder);
    return this.warJob(b, ln, 'loading the launcher');
  },

  warJob(b, s, job) {
    b.war = s;
    b.job = job;
    b.pace = 0;
    return 'busy';
  },

  // The next cell of s: build it, with the stone or metal in hand, or go
  // and get some.
  buildStep(e, b, camp, s) {
    if (this.tick < s.waitUntil) return 'stuck'; // (it couldn't get to it lately)
    const k = this.nextWarCell(s);
    if (k < 0) {
      s.done = true;
      return 'done';
    }
    s.done = false;
    if (s.mats[k] === 'stone') {
      if (this.holding(b, MATERIAL) > 0) return this.warJob(b, s, `building the ${s.name}`);
      return this.gather(e, b, camp, MATERIAL, STONE_R, 'fetching stone', true) ? 'busy' : 'stuck';
    }
    let need = 0;
    for (let j = k; j < s.cells.length; j++) if (s.mats[j] === 'metal' && !this.builtAt(s.cells[j])) need++;
    if (this.holding(b, METALS) === 0) this.share(e, b, camp, 'metal', need);
    if (this.holding(b, METALS) > 0) return this.warJob(b, s, `building the ${s.name}`);
    return this.startMining(e, b, camp, 'metal', need) ? 'busy' : 'stuck';
  },

  // Mine coal and salt for `need` gunpowder over the AMMO_LOW it keeps for
  // its own gun.
  powderFor(e, b, camp, need) {
    const want = AMMO_LOW + need, pairs = Math.ceil((want - this.has(b, GUNPOWDER)) / 2);
    if (this.has(b, COAL) < pairs) return this.startMining(e, b, camp, 'coal', pairs) ? 'busy' : 'stuck';
    return this.startMining(e, b, camp, 'salt', want) ? 'busy' : 'stuck';
  },

  // Does war job `job` carry on (carryingOn)? null if it isn't one.
  warCarryingOn(e, b, camp) {
    // (Still one of the camp's: a roof pad goes with its hut.)
    const s = b.war !== null && (b.war === camp.pad || b.war === camp.aa || b.war === camp.launcher) ? b.war : null;
    switch (b.job) {
      case 'building the helipad':
      case 'building the anti-air gun':
      case 'building the launcher': {
        if (s === null || camp.engineer !== e.id) return false;
        const k = this.nextWarCell(s);
        return k >= 0 && this.holding(b, s.mats[k] === 'metal' ? METALS : MATERIAL) > 0;
      }
      case 'building the helicopter':
        return s !== null && camp.engineer === e.id && !this.alive(camp.heli) && this.holding(b, METALS) >= HELI_METAL;
      case 'loading the anti-air gun':
        return s !== null && camp.engineer === e.id && s.ammo < AA_CAP && this.has(b, GUNPOWDER) > AMMO_LOW;
      case 'loading the launcher':
        return s !== null && camp.engineer === e.id && !this.alive(s.missile);
      case 'raiding': return b.raid !== null;
      case 'going home': return Math.max(Math.abs(e.x - camp.x), Math.abs(e.y - camp.y)) > HOME_NEAR;
      default: return null;
    }
  },

  // Walk to where it works at s (for cell k): true once it's there.
  atWork(e, b, s, k) {
    const camp = b.camp, c = camp === null ? -1 : this.standFor(camp, s, k, e);
    if (c < 0) {
      b.job = 'wandering';
      b.think = 0;
      return false;
    }
    if (this.walkTo(e, b, c % this.w, (c / this.w) | 0, 1, WALK_EVERY)) return true;
    if (b.job === 'wandering') {
      // It gave up getting there: that machine waits a while (it gets on
      // with another); one it can never get to, with nothing built yet, is
      // planned again somewhere else.
      s.waitUntil = this.tick + PLAN_RETRY;
      // (Counted once from each place it tried from: from where it rests,
      // say, the way can be shut a while by its own fire pile.)
      if (s.failX === undefined || Math.abs(e.x - s.failX) + Math.abs(e.y - s.failY) > 12) {
        s.fails = (s.fails ?? 0) + 1;
        s.failX = e.x;
        s.failY = e.y;
      }
      const key = s === camp.pad ? 'pad' : s === camp.aa ? 'aa' : s === camp.launcher ? 'launcher' : null;
      if (key !== null && s.fails >= 3 && this.nextWarCell(s) === 0 && !(key === 'pad' && this.alive(camp.heli))) {
        if (!s.roof) camp.badSites.push([s.u0, s.u0 + s.w - 1]); // (not there again)
        camp[key] = null;
      }
    }
    return false;
  },

  // Build the next cell of its war machine with what it carries.
  warBuild(e, b) {
    const camp = b.camp, s = b.war;
    const k = s === null || camp === null || (s !== camp.pad && s !== camp.aa && s !== camp.launcher) ? -1 : this.nextWarCell(s);
    if (k < 0) {
      if (s !== null) s.done = true;
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    if (!this.atWork(e, b, s, k)) return;
    this.pose(e, 0);
    if (++b.pace < BUILD_EVERY) return;
    b.pace = 0;
    const c = s.cells[k], t = this.type[c];
    if (t !== 0 && SHAPED[t]) { // wait for it to move (liquid it builds into)
      if (this.ownCell(e, c)) this.stepAcross(e, this.across(e, e.x - (c % this.w), e.y - ((c / this.w) | 0)) >= 0 ? 1 : -1, 2, false); // (itself: it steps back)
      return;
    }
    const m = this.takeAny(b, s.mats[k] === 'metal' ? METALS : MATERIAL);
    if (m === 0) {
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    this.putDown(c, m);
  },

  // Bring its metal to the pad: a helicopter builds itself there.
  buildHeli(e, b) {
    const camp = b.camp, pad = b.war;
    if (camp === null || pad === null || pad !== camp.pad || this.alive(camp.heli) || this.holding(b, METALS) < HELI_METAL) {
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    if (!this.atWork(e, b, pad, -1)) return;
    this.pose(e, 0);
    if (++b.pace < BUILD_EVERY) return;
    b.pace = 0;
    // Wild growth over the pad is cleared (room to fly out); anything
    // else in the way, it waits a while.
    this.clearWild(camp, pad.u0 - 2, pad.u0 + pad.w + 1, pad.base - 1, pad.base - SKY);
    const craft = {
      kind: 'heli', camp, state: 'parked', mend: true, homeX: pad.hx, homeY: pad.hy, homeFacing: pad.facing,
      goal: null, foe: null, reload: 0, quiet: 0, pace: 0, blocked: 0, downFor: 0,
    };
    const heli = this.buildCraft(HELICOPTER, pad.hx, pad.hy, pad.facing, camp.gx, camp.gy, craft, { b: camp.id - 1 });
    if (heli === null) {
      if (++pad.tries > 10) { // something solid in the way: later
        pad.tries = 0;
        pad.waitUntil = this.tick + PLAN_RETRY;
        b.job = 'wandering';
        b.think = 0;
      }
      return;
    }
    for (let k = 0; k < HELI_METAL; k++) this.takeAny(b, METALS);
    camp.heli = heli;
    b.job = 'wandering';
    b.think = 0;
  },

  // Load the anti-air gun with the gunpowder it can spare.
  loadAA(e, b) {
    const aa = b.war;
    if (aa === null || !this.atWork(e, b, aa, -1)) return;
    this.pose(e, 0);
    while (aa.ammo < AA_CAP && this.has(b, GUNPOWDER) > AMMO_LOW && this.takeOut(b, GUNPOWDER)) aa.ammo++;
    b.job = 'wandering';
    b.think = 0;
  },

  // Load the launcher with gunpowder and metal; with enough of both, a
  // missile is made in its tube.
  loadLauncher(e, b) {
    const ln = b.war, camp = b.camp;
    if (ln === null || camp === null || !this.atWork(e, b, ln, -1)) return;
    this.pose(e, 0);
    while (ln.metal < MISSILE_METAL && this.takeAny(b, METALS) !== 0) ln.metal++;
    while (ln.powder < MISSILE_POWDER && this.has(b, GUNPOWDER) > AMMO_LOW && this.takeOut(b, GUNPOWDER)) ln.powder++;
    if (ln.metal >= MISSILE_METAL && ln.powder >= MISSILE_POWDER && !this.alive(ln.missile)) {
      this.clearWild(camp, ln.u0 + 1, ln.u0 + ln.w - 2, ln.base, ln.base - 14); // its way out
      const craft = { kind: 'missile', camp, state: 'loaded', mend: false };
      const m = this.buildCraft(MISSILE, ln.mx, ln.my, 1, camp.gx, camp.gy, craft);
      if (m !== null) {
        ln.missile = m;
        ln.metal = 0;
        ln.powder = 0;
      } else {
        ln.waitUntil = this.tick + PLAN_RETRY; // something in the tube
      }
    }
    b.job = 'wandering';
    b.think = 0;
  },

  // ---- the anti-air gun ---------------------------------------------------------

  // Pick a target, turn the barrel toward where it will be when a shell
  // gets there, and fire when it's on.
  stepAA(camp, aa) {
    aa.reload++;
    if (this.tick % AA_LOOK === 0 || !this.aaStill(camp, aa)) aa.target = this.aaTarget(camp, aa);
    const tg = aa.target;
    if (tg === null) {
      aa.track = null;
      return;
    }
    // Where it is, and how fast it's going (smoothed).
    const x = tg.o !== null ? tg.o.x - 2 * tg.o.gx : tg.x, y = tg.o !== null ? tg.o.y - 2 * tg.o.gy : tg.y;
    const tr = aa.track;
    if (tr !== null && tr.o === tg.o && tr.t === tg.t) {
      tr.vx = 0.6 * tr.vx + 0.4 * (x - tr.x);
      tr.vy = 0.6 * tr.vy + 0.4 * (y - tr.y);
      tr.x = x;
      tr.y = y;
    } else {
      aa.track = { o: tg.o, t: tg.t, x, y, vx: 0, vy: 0 };
    }
    const { vx, vy } = aa.track;
    // Lead it: where it will be by the time a shell has flown there.
    let px = x, py = y;
    for (let n = 0; n < 3; n++) {
      const t = Math.hypot(px - aa.px, py - aa.py) / SHELL_SPEED;
      px = x + vx * t;
      py = y + vy * t;
    }
    const want = Math.atan2(py - aa.py, px - aa.px);
    let d = want - aa.aim;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    aa.aim += Math.max(-AA_TURN, Math.min(AA_TURN, d));
    if (Math.abs(d) > AA_AIMED || aa.reload < AA_EVERY || aa.ammo <= 0 || this.nearOwn(camp, px, py)) return;
    aa.reload = 0;
    aa.ammo--;
    aa.shots++;
    const a = want + (this.rand() - 0.5) * 2 * AA_JITTER;
    const dist = Math.hypot(px - aa.px, py - aa.py);
    const fuse = Math.max(2, (dist / SHELL_SPEED) * (1 + (this.rand() - 0.5) * 2 * AA_FUSE_ERR));
    const cx = Math.cos(a), cy = Math.sin(a);
    this.flak.push({ x: aa.px + 0.5 + cx * 2, y: aa.py + 0.5 + cy * 2, vx: cx * SHELL_SPEED, vy: cy * SHELL_SPEED, fuse, lx: aa.px, ly: aa.py });
    const s = this.spawnNear(aa.px, aa.py, SMOKE);
    if (s >= 0) this.temp[s] = 45;
  },

  // Is any of camp's people within AA_SAFE of (x, y)?
  // Is any of camp's people (measured from the middle of its body), or its
  // missile waiting in its tube or helicopter on its pad, within AA_SAFE of
  // (x, y)?
  nearOwn(camp, x, y) {
    const near = (o, up) => Math.max(Math.abs(o.x - up * o.gx - x), Math.abs(o.y - up * o.gy - y)) <= AA_SAFE;
    for (const id of camp.members) {
      const o = this.creatureById[id];
      if (o && near(o, 3)) return true;
    }
    const m = camp.launcher === null ? null : camp.launcher.missile;
    if (this.alive(m) && near(m, 2)) return true;
    return this.alive(camp.heli) && camp.heli.craft.state === 'parked' && near(camp.heli, 3);
  },

  // How high (x, y) is above the gun, in its camp's frame.
  aboveGun(camp, aa, x, y) {
    return -((x - aa.px) * camp.gx + (y - aa.py) * camp.gy);
  },

  // Is its target still there, and still one to shoot at? (An insect,
  // a cell that flits about: found again if it moved a cell.)
  aaStill(camp, aa) {
    const tg = aa.target;
    if (tg === null) return true;
    if (tg.o !== null) return this.alive(tg.o) && (tg.o.craft === null || this.flying(tg.o));
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = tg.x + dx, y = tg.y + dy;
        if (this.inBounds(x, y) && this.type[y * this.w + x] === tg.t) {
          tg.x = x;
          tg.y = y;
          return true;
        }
      }
    }
    return false;
  },

  // The thing to shoot at: another camp's missile in flight, then its
  // helicopter in the air, then a phoenix, then any other flier, then
  // insects; nearest first, within AA_R, high enough, away from its own
  // people, and in sight. { o: creature, or null for an insect at (x, y)
  // of type t }, or null.
  aaTarget(camp, aa) {
    let best = null, bs = Infinity;
    for (const o of this.creatures) {
      if (o.grow >= 0) continue;
      let rank;
      if (o.craft !== null) {
        if (o.craft.camp === camp || !this.flying(o)) continue;
        rank = o.craft.kind === 'missile' ? 0 : 1;
      } else if (o.brain === null && DEFS[o.kind].critter.moves === 'fly') {
        rank = o.kind === ID.PHOENIX ? 2 : 3;
      } else {
        continue;
      }
      const d = Math.max(Math.abs(o.x - aa.px), Math.abs(o.y - aa.py));
      const s = rank * 1000 + d;
      // (Near its own: judged where it would aim, the middle of the body.)
      if (d > AA_R || s >= bs || this.aboveGun(camp, aa, o.x, o.y) < AA_UP || this.nearOwn(camp, o.x - 2 * o.gx, o.y - 2 * o.gy)) continue;
      const c = this.aimAt(o);
      if (c < 0 || this.aaSight(aa.px, aa.py, c % this.w, (c / this.w) | 0) !== o) continue;
      best = { o, x: o.x, y: o.y, t: 0 };
      bs = s;
    }
    if (best !== null || this.tick % AA_SCAN !== 0) return best;
    // Insects: the nearest in sight.
    let bd = Infinity;
    const { w, h, type } = this;
    for (let y = Math.max(0, aa.py - AA_R); y <= Math.min(h - 1, aa.py + AA_R); y++) {
      for (let x = Math.max(0, aa.px - AA_R); x <= Math.min(w - 1, aa.px + AA_R); x++) {
        const t = type[y * w + x];
        if (FLIER[t] === 0) continue;
        const d = Math.max(Math.abs(x - aa.px), Math.abs(y - aa.py));
        if (d >= bd || this.aboveGun(camp, aa, x, y) < AA_UP || this.nearOwn(camp, x, y) || this.aaSight(aa.px, aa.py, x, y) !== null) continue;
        best = { o: null, x, y, t };
        bd = d;
      }
    }
    return best;
  },

  // What the gun sees first on the line from (x0, y0) toward (x1, y1),
  // up to just before it: a creature, BLOCKED (anything else in the way
  // but leaves and other growth, which shells fly through), or null (the
  // way is clear).
  aaSight(x0, y0, x1, y1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 1; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
      const c = y * this.w + x;
      if (this.shellPasses(c)) continue;
      const o = this.creatureAt(c);
      if (o !== null) return o;
      if (k < n) return BLOCKED;
    }
    return null;
  },

  // Does a shell fly through cell c: empty, a gas or flame, or growth?
  shellPasses(c) {
    const t = this.type[c];
    if (t === 0 || GROWTH[t] === 1) return true;
    if (SHAPED[t]) return false;
    const s = DEFS[t].state;
    return s !== SOLID && s !== POWDER && s !== LIQUID;
  },

  // Shells fly on until their fuse runs out, or they hit something; then
  // they burst.
  stepFlak() {
    const f = this.flak;
    for (let k = f.length - 1; k >= 0; k--) {
      const s = f[k];
      s.lx = s.x;
      s.ly = s.y;
      let hit = false, gone = false;
      for (let n = 0; n < 3 && !hit; n++) {
        s.x += s.vx / 3;
        s.y += s.vy / 3;
        const x = Math.floor(s.x), y = Math.floor(s.y);
        if (!this.inBounds(x, y)) {
          gone = true;
          break;
        }
        if (!this.shellPasses(y * this.w + x)) hit = true;
      }
      if (!gone && (hit || --s.fuse <= 0)) {
        this.flakBurst(Math.floor(s.x), Math.floor(s.y));
        gone = true;
      }
      if (gone) f.splice(k, 1);
    }
  },

  // A shell bursts at (x, y): a small blast (it hurts what's alive near
  // it), insects caught in it killed, and a puff of smoke.
  flakBurst(x, y) {
    x = Math.max(0, Math.min(this.w - 1, x));
    y = Math.max(0, Math.min(this.h - 1, y));
    this.blast(x, y, FLAK_BLAST);
    for (let dy = -FLAK_R; dy <= FLAK_R; dy++) {
      for (let dx = -FLAK_R; dx <= FLAK_R; dx++) {
        const nx = x + dx, ny = y + dy;
        if (this.inBounds(nx, ny) && FLIER[this.type[ny * this.w + nx]]) this.clearCell(ny * this.w + nx);
      }
    }
    const c = y * this.w + x;
    if (this.type[c] === 0) this.spawn(c, SMOKE);
  },

  // Is the camp's fire burning?
  burning(camp) {
    for (let v = 0; v >= -4; v--) {
      for (let u = -2; u <= 2; u++) {
        const c = this.campCell(camp, u, v);
        if (c >= 0 && FIRE[this.type[c]]) return true;
      }
    }
    return false;
  },
};
