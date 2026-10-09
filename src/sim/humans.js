// Humans: shaped creatures (creatures.js) with minds of their own. A human
// makes a camp, gathers fuel into a pile beside it and lights it by
// rubbing sticks, builds a small hut nearby, shelters there from cold and
// rain, and runs from danger. It decides what to do every THINK_EVERY
// steps (think) and works at it in between (act). Humans near one camp
// share it and split the work. Mixed into World.prototype.

import { DEFS, ID, NUM, State } from './elements.js';
import { SHAPED, SUFFOCATE_EVERY, BODY } from './creatures.js';

const { SOLID, POWDER, LIQUID, GAS, ENERGY } = State;
const { COAL, SALT, GUNPOWDER, WOOD } = ID;
const setOf = (keys) => {
  const s = new Uint8Array(NUM);
  for (const k of keys) s[ID[k]] = 1;
  return s;
};

export const THINK_EVERY = 8;
export const WALK_EVERY = 4; // steps per cell walked
export const RUN_EVERY = 2; // and run
const CLIMB = 2; // the highest step it climbs
const PASS_REACH = 14; // how far it squeezes past other humans in its way
const SWAP_EVERY = 40; // steps between trading places with another human
const SWIM_CLIMB = 6; // or swims up, getting out of water
export const GIVE_UP = 300; // steps without getting closer before it gives up on a target
export const BAN_FOR = 1800; // and leaves that target alone
const FELL_MAX = 800; // the most cells of a tree that come down when it's felled
const TREE = setOf(['WOOD', 'LEAVES']);
const BAN_R = 5; // (and what's like it this close: the rest of that log is no easier to reach)
export const DANGER_R = 16; // it runs from danger this close
const SAFE_R = 24; // until there's none this close
// °C: anything this hot (but a gas) is danger. Its body holds BODY_T, so
// ground warmed by a fire is safe to walk on.
const HOT = 150;
const BLAST_FEAR = 4; // and air pressure this high, from a blast
export const BREATH = 600; // steps it can hold its breath
const BODY_T = 37; // it keeps its body at this temperature,
const KEEP_WARM = 0.2; // this much of the way back each step
const SHORE_R = 40; // how far it looks for a shore
export const FRAME_KNEEL = 2, FRAME_SIT = 3;
const NEAR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const DANGER = setOf(['LAVA', 'ACID', 'NAPALM', 'GREEK_FIRE', 'GREY_GOO', 'VIRUS', 'ANTIMATTER', 'BLACK_HOLE']);
const CAMP_JOIN = 60; // it joins a camp this close
export const FUEL_R = 120; // and fetches fuel this far from it
const PILE_LIGHT = 6; // fuel in the pile before it's lit
const PILE_LOW = 4; // a burning pile with less is topped up
const RUB_FOR = 180; // steps rubbing sticks before the pile catches
const LIGHT_U = 4; // where it kneels to light the pile (across from its middle)
const REST_U = 7; // and sits by it
const SCORCH = 100; // °C: anything this hot (but a gas) within SCORCH_R cells, it steps back at once
const SCORCH_R = 2; // (flames move a cell a step, and burn in one touch)
const REACH = 3; // how far across it reaches to pick something up
const FUEL = setOf(['WOOD', 'COAL', 'PEAT', 'SAWDUST']);
const FIRE_SET = setOf(['FIRE', 'CAMPFIRE']);
const FLAMES = setOf(['FIRE']); // real fire, which it won't walk through
const ON_FIRE = setOf(['WOOD', 'COAL', 'PEAT', 'SAWDUST', 'CAMPFIRE']); // fuel on a burning pile, alight or not
export const HUT_W = 9; // the hut's width
export const HUT_WALL = 8; // its walls' height
export const DOOR = 6; // the doorway's height
const HUT_GAP = 4; // the least space between the hut and the pile
const STONE_R = 120; // how far from the camp it fetches building material
const HUT_R = 40; // how far from the pile it looks for a site for the hut
const COLD_AIR = 10; // °C: air this cold sends it to shelter
const RAIN_R = 20; // as does rain, snow or hail falling this close
const MATERIAL = setOf(['STONE', 'BRICK', 'GRANITE', 'CONCRETE']);
// Growth it clears away for a building site: plants, leaves, flowers, moss.
const CLEARABLE = Uint8Array.from(DEFS, (d) => (d.state === SOLID && d.cat === 'life' && d.strength > 0 && d.strength <= 6 ? 1 : 0));
export const HAND_DIG = 30; // the strongest solid it digs by hand (sandstone); powders always
export const TOOL_DIG = 150; // and with a pickaxe (stone, granite, most metals)
export const DIG_EVERY = 8; // steps per cell dug
// How hard each thing is to dig: 1 for powders, a solid's strength, 0 for
// what it never digs (creatures, dangers, anything that can't be broken).
const DIG = Uint16Array.from(DEFS, (d) => (d.shape || DANGER[d.id] || d.indestructible ? 0
  : d.state === POWDER ? 1 : d.state === SOLID ? d.strength : 0));
const METALS = Uint8Array.from(DEFS, (d) => (d.state === SOLID && (d.cat === 'metal' || d.cat === 'alloy') ? 1 : 0));
export const RESOURCES = { coal: setOf(['COAL']), salt: setOf(['SALT']), metal: METALS };
// What it keeps when it digs through it: fuel, salt, metal, building stone.
export const USEFUL = Uint8Array.from(DEFS, (d) => (FUEL[d.id] || METALS[d.id] || MATERIAL[d.id] || d.key === 'SALT' ? 1 : 0));
export const MINE_R = 120; // how far from the camp it looks for coal, salt and metal
export const CRAFT_FIRE_TIME = 3000; // steps its camp's fire has burned before it crafts
const PICK_WOOD = 3; // a pickaxe: 3 Wood
const GUN_METAL = 5, GUN_WOOD = 1; // a gun: 5 metal and a Wood stock
const ARMOUR_METAL = 8; // armour: 8 metal
export const ARMOUR_HITS = 10; // hits armour absorbs before it breaks
const AMMO_LOW = 4; // gunpowder below this, it goes for more
export const PELLETS = 4; // a shot: 4 pellets in a tight spread
const SPREAD = 0.035; // radians between pellets
const SHOT_R = 48; // how far a pellet flies
export const FIRE_EVERY = 40; // steps between shots
const FIGHT_R = 40; // it shoots at threats and rivals this close
const THREAT = setOf(['SPIDER', 'PHOENIX']);
const HUNT_EVERY = 2000; // steps between hunts
const HUNT_FOR = 400; // and the longest a hunt goes on
const TRACER = 4; // frames a pellet's path is drawn
export const SEAM_R = 8; // and how near the last one it looks for more of the same
export const WOOD_ONLY = setOf(['WOOD']);
export const STACK = 10; // the most of any one element it carries
export const HELD_PICKAXE = -1, HELD_GUN = -2; // what it shows in its hand, besides a pixel
const FEED = setOf(['WOOD', 'PEAT', 'SAWDUST']); // fuel it feeds the fire before coal

export function newBrain() {
  return {
    job: 'wandering', // what it's doing (shown in the inspect line)
    think: 0, // steps to its next decision
    pace: 0, // steps since its last step taken
    camp: null,
    target: -1, // the cell it's going for
    best: Infinity, // its closest yet to the target
    stuck: 0, // steps without getting closer
    banned: new Map(), // cell -> tick until which it's left alone
    items: new Map(), // element -> how many it carries (up to STACK)
    tool: 0, weapon: 0, // a pickaxe, a gun (1 if it has one)
    armour: 0, // hits its armour can still take (0: none)
    held: 0, // what it shows in its hand: an element, HELD_PICKAXE or HELD_GUN
    fetchSet: null, fetchR: 0, fetchSide: false, // what it's fetching, and where from
    mineKey: '', wantN: 0, // what it's mining (a RESOURCES key) and how many it wants
    skip: new Map(), // resource key -> tick until which it doesn't look for it
    refill: true, // it wants gunpowder (a full stack the first time)
    tun: null, // the tunnel it's travelling or digging (tunnels.js)
    tunnelWood: false, // it has run out of lining wood before: gathers some first
    hold: false, // holding on in a tunnel (no falling) this step
    bailed: 0, // liquid cells bailed out of the spot it's clearing
    swapAt: -SWAP_EVERY, // when it last traded places with another human
    reload: 0, foe: 0, huntAt: 0, huntUntil: 0, // shooting: steps since the last shot, what at
    rub: 0, // steps spent rubbing sticks
    breath: 0, // steps with its head under
    fleeDir: 1,
    shore: 0, // the way to the nearest shore, while swimming
    heading: 0, // the way it was last walking (it swims on that way)
    wasJob: 'wandering', // what it was doing before it fell in
    goalX: -1, goalY: -1, // where it's wandering to
  };
}

// What a human carries, for the inspect line: "wood 7, coal 3; pickaxe, gun".
export function inventoryNote(b) {
  const items = [...b.items].map(([t, k]) => `${DEFS[t].name.toLowerCase()} ${k}`).join(', ');
  const gear = [b.tool && 'pickaxe', b.weapon && 'gun', b.armour > 0 && 'armour'].filter(Boolean).join(', ');
  return [items, gear].filter(Boolean).join('; ');
}

export const Humans = {
  stepHuman(e) {
    if (e.brain === null) e.brain = newBrain();
    const b = e.brain;
    this.keepWarm(e);
    const under = this.headUnder(e); // the liquid it's in, or 0
    if (under === 0) b.breath = 0;
    else if (++b.breath > BREATH && (b.breath - BREATH) % SUFFOCATE_EVERY === 0) this.drown(e, under);
    // In a liquid it swims, and takes up what it was doing once it's out.
    if (this.inLiquid(e, under)) {
      if (b.job !== 'swimming') b.wasJob = b.job;
      b.job = 'swimming';
      this.swimHuman(e, b, under);
      return;
    }
    if (b.job === 'swimming') b.job = b.wasJob;
    // Holding on in a tunnel (a shaft, stairs), it doesn't fall; nor does it
    // drop into a tunnel's mouth, crossing it overland as if on boards.
    const hold = b.hold;
    b.hold = false;
    if (!hold && !this.overTunnel(e) && this.fall(e)) return;
    // A reflex: with flames or anything scorching right beside it, it steps
    // back from them at once, whatever it was doing (even by its own fire).
    const away = this.scorched(e);
    if (away !== 0) {
      this.stepAcross(e, away, CLIMB, false);
      return;
    }
    if (--b.think <= 0) {
      b.think = THINK_EVERY;
      this.think(e, b);
    }
    this.act(e, b);
  },

  // Is anything hotter than SCORCH (not a gas) within SCORCH_R cells of
  // e's body? The way (1 or -1) away from the hottest such thing, or 0.
  scorched(e) {
    const { w, type, temp } = this;
    let hottest = SCORCH, side = 0;
    const R = SCORCH_R;
    for (let y = e.y - 6 - R; y <= e.y + R; y++) {
      for (let x = e.x - 1 - R; x <= e.x + 1 + R; x++) {
        if (!this.inBounds(x, y)) continue;
        const j = y * w + x, t = type[j];
        if (t === 0 || temp[j] <= hottest || DEFS[t].state === GAS || this.ownCell(e, j)) continue;
        if (!this.nearBody(e, x, y, R)) continue;
        hottest = temp[j];
        const a = (x - e.x) * e.gy - (y - e.y) * e.gx;
        side = a > 0 ? -1 : a < 0 ? 1 : -e.facing;
      }
    }
    return side;
  },

  // Is (x, y) within r cells (either way) of one of e's pixels?
  nearBody(e, x, y, r) {
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = e.cells[p];
      if (Math.abs((c % this.w) - x) <= r && Math.abs(((c / this.w) | 0) - y) <= r) return true;
    }
    return false;
  },

  // Warm-blooded: its body drifts back to BODY_T.
  keepWarm(e) {
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = e.cells[p];
      this.temp[c] += (BODY_T - this.temp[c]) * KEEP_WARM;
    }
  },

  // Out of breath: a pixel lost, and the liquid closes over where it was
  // (it doesn't leave a pocket of air to breathe from).
  drown(e, liquid) {
    const p = this.randomPixel(e);
    if (p < 0) return;
    const c = e.cells[p];
    this.clearCell(c);
    this.hurt(e, p, false);
    this.spawn(c, liquid);
  },

  // Is its head under: no air beside its topmost pixel left, and liquid
  // there? The liquid, or 0. (Pressed against a lid under water, it still
  // can't breathe.)
  headUnder(e) {
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = e.cells[p], x = c % this.w, y = (c / this.w) | 0;
      let wet = 0;
      for (const [dx, dy] of NEAR4) {
        if (!this.inBounds(x + dx, y + dy)) continue;
        const j = (y + dy) * this.w + x + dx, t = this.type[j];
        if (this.ownCell(e, j)) continue;
        if (t === 0 || DEFS[t].state === GAS) return 0; // air: it breathes
        if (DEFS[t].state === LIQUID) wet = t;
      }
      return wet;
    }
    return 0;
  },

  // In a liquid: its head under, or liquid under its feet (most of the
  // ground under it: a drop of something in a puddle isn't water to swim).
  inLiquid(e, under) {
    if (under !== 0) return true;
    let wet = 0;
    for (let k = -1; k <= 1; k++) {
      const x = e.x + k * e.gy + e.gx, y = e.y - k * e.gx + e.gy;
      if (this.inBounds(x, y) && DEFS[this.type[y * this.w + x]].state === LIQUID) wet++;
    }
    return wet >= 2;
  },

  // Swim up for air, then on the way it was going (or, going nowhere, to
  // the nearest shore), climbing out at the far side.
  swimHuman(e, b, under) {
    if (++b.pace < 3) return;
    b.pace = 0;
    if (under !== 0 && this.moveBody(e, e.x - e.gx, e.y - e.gy, 0, e.facing, e.gx, e.gy)) return;
    if (b.heading !== 0) {
      this.stepAcross(e, b.heading, SWIM_CLIMB, false);
      return;
    }
    if (b.shore === 0 || this.tick % 60 === 0) b.shore = this.findShore(e);
    this.stepAcross(e, b.shore || e.facing, SWIM_CLIMB, false);
  },

  // The way (1 or -1) to the nearest column within SHORE_R with ground at
  // most SWIM_CLIMB cells above its feet and no liquid on it; 0 if none.
  findShore(e) {
    for (let d = 1; d <= SHORE_R; d++) {
      for (const dir of [1, -1]) {
        for (let up = 0; up <= SWIM_CLIMB; up++) {
          const x = e.x + d * dir * e.gy - up * e.gx, y = e.y - d * dir * e.gx - up * e.gy;
          const ax = x - e.gx, ay = y - e.gy;
          if (!this.inBounds(x, y) || !this.inBounds(ax, ay)) continue;
          const t = this.type[y * this.w + x], s = DEFS[t].state;
          const above = DEFS[this.type[ay * this.w + ax]].state;
          if ((s === SOLID || s === POWDER) && above !== LIQUID && !SHAPED[t]) return dir;
        }
      }
    }
    return 0;
  },

  // One step across the down arrow, `dir` (1 or -1) becoming the way it
  // faces: on the level, or up a step of up to `climb` cells. Running
  // (`leap`), it carries on over a gap of up to 2 cells. Another human in
  // the way: they squeeze past each other. Returns whether it moved.
  stepAcross(e, dir, climb, leap, giveWay = true) {
    const rx = e.gy * dir, ry = -e.gx * dir;
    const fr = e.frame === 0 ? 1 : 0;
    for (let up = 0; up <= climb; up++) {
      if (!this.moveBody(e, e.x + rx - up * e.gx, e.y + ry - up * e.gy, fr, dir, e.gx, e.gy)) continue;
      if (leap && up === 0) {
        for (let more = 0; more < 2 && !this.supported(e); more++) {
          if (!this.moveBody(e, e.x + rx, e.y + ry, fr, dir, e.gx, e.gy)) break;
        }
      }
      return true;
    }
    const other = this.creatureAhead(e, rx, ry);
    if (other === null || other.kind !== e.kind) return false;
    if (this.passBy(e, other, rx, ry, dir) || this.swapPlaces(e, other)) return true;
    // Head to head and no way past: the younger gives way, stepping back.
    if (giveWay && other.brain !== null && other.brain.heading === -dir && e.id > other.id) this.stepAcross(e, -dir, CLIMB, false, false);
    return false;
  },

  // Two humans in each other's way trade places: e takes o's exact cells
  // and pose, and o takes e's. Together they fill the same cells as before,
  // so it always fits, on a slope or in a tunnel alike. Only whole bodies,
  // and not too often (so they don't trade back and forth).
  swapPlaces(e, o) {
    if (o.brain === null || o.kind !== e.kind || e.grow >= 0 || o.grow >= 0) return false;
    if (this.tick - e.brain.swapAt < SWAP_EVERY || this.tick - o.brain.swapAt < SWAP_EVERY) return false;
    for (let p = 0; p < e.n; p++) if (e.pix[p] !== BODY || o.pix[p] !== BODY) return false;
    const te = this.bodyTemp(e), to = this.bodyTemp(o);
    const ec = Int32Array.from(e.cells), oc = Int32Array.from(o.cells);
    const pose = (a) => ({ x: a.x, y: a.y, frame: a.frame, facing: a.facing, gx: a.gx, gy: a.gy, fallV: 0 });
    const pe = pose(e), po = pose(o);
    for (let p = 0; p < e.n; p++) this.writePixel(e, p, oc[p], te, po.frame);
    for (let p = 0; p < o.n; p++) this.writePixel(o, p, ec[p], to, pe.frame);
    Object.assign(e, po);
    Object.assign(o, pe);
    e.brain.swapAt = o.brain.swapAt = this.tick;
    return true;
  },

  // Squeeze past the humans ahead of it (rx, ry): to the first place beyond
  // them where it fits, up to PASS_REACH cells on, as long as nothing but
  // air and creatures lies between.
  passBy(e, o, rx, ry, dir) {
    for (let k = 2; k <= PASS_REACH; k++) {
      // The column k cells across, from its feet to its head.
      for (let up = 0; up < 6; up++) {
        const x = e.x + k * rx - up * e.gx, y = e.y + k * ry - up * e.gy;
        if (!this.inBounds(x, y)) return false;
        const t = this.type[y * this.w + x];
        if (!SHAPED[t] && !this.roomForBody(e, y * this.w + x)) return false;
      }
      if (k < 3) continue;
      for (let up = 0; up <= CLIMB; up++) {
        if (this.moveBody(e, e.x + k * rx - up * e.gx, e.y + k * ry - up * e.gy, 0, dir, e.gx, e.gy)) return true;
      }
    }
    return false;
  },

  // The creature in the column just past e's side (rx, ry), from its feet
  // to its head, or null.
  creatureAhead(e, rx, ry) {
    for (let up = 0; up < 6; up++) {
      const x = e.x + 2 * rx - up * e.gx, y = e.y + 2 * ry - up * e.gy;
      if (!this.inBounds(x, y)) continue;
      const a = y * this.w + x;
      if (SHAPED[this.type[a]] && !this.ownCell(e, a)) {
        const o = this.creatureById[this.ctype[a]];
        if (o && o.kind === this.type[a]) return o;
      }
    }
    return null;
  },

  // Walk (a step every `every` steps) towards (tx, ty) across the down
  // arrow. True once it's within `near` cells across and the target is
  // level with its body (from 9 cells above its feet to 4 below). No
  // closer for GIVE_UP steps: it gives up (giveUp).
  walkTo(e, b, tx, ty, near, every) {
    if (this.leaveTunnel(e, b)) return false; // out of a tunnel first (tunnels.js)
    const a = (tx - e.x) * e.gy - (ty - e.y) * e.gx; // across: + is the way "right" points
    const v = (tx - e.x) * e.gx + (ty - e.y) * e.gy; // along: + is down
    if (Math.abs(a) <= near && v >= -9 && v <= 4) {
      b.stuck = 0;
      b.best = Infinity;
      return true;
    }
    // It won't walk through its camp's fire: it waits for it to burn down
    // (and wanders somewhere else), standing back from it.
    if (b.camp !== null && this.acrossFire(b.camp, e.x, e.y, tx, ty)) {
      b.stuck = 0;
      b.goalX = -1;
      const u = (e.x - b.camp.x) * b.camp.gy - (e.y - b.camp.y) * b.camp.gx;
      if (Math.abs(u) < REST_U && ++b.pace >= every) {
        b.pace = 0;
        this.stepAcross(e, u > 0 ? 1 : -1, CLIMB, false);
      } else this.pose(e, 0);
      return false;
    }
    const dist = Math.abs(a) + Math.abs(v);
    if (dist < b.best) {
      b.best = dist;
      b.stuck = 0;
    } else if (++b.stuck > GIVE_UP) {
      this.giveUp(e, b);
      return false;
    }
    if (++b.pace < every) return false;
    b.pace = 0;
    b.heading = a > 0 ? 1 : a < 0 ? -1 : e.facing; // remembered for swimming
    // Something in the way it can dig: it digs through it, a cell at a
    // time (up a step, if the target is above it, or down one). Digging
    // counts as getting closer.
    const vdir = v < -1 ? -1 : v > 4 ? 1 : 0;
    if (!this.stepAcross(e, b.heading, CLIMB, every === RUN_EVERY) && this.digToward(e, b, b.heading, vdir)) {
      b.stuck = 0;
      b.pace = every - DIG_EVERY;
    }
    return false;
  },

  // Dig out one cell of what stops e stepping across the way `dir`: level,
  // up a step or down one (first, as `vdir` says: -1 up, 1 down), whichever
  // has only things it can dig in it. Useful things go into its pockets.
  // Returns whether it dug.
  digToward(e, b, dir, vdir) {
    const out = this.footB, rx = e.gy * dir, ry = -e.gx * dir;
    const fr = e.frame === 0 ? 1 : 0, limit = this.digLimit(b);
    for (const up of vdir < 0 ? [1, 2, 0] : vdir > 0 ? [-1, 0] : [0, 1, 2]) {
      if (!this.placeCells(e.kind, e.x + rx - up * e.gx, e.y + ry - up * e.gy, fr, dir, e.gx, e.gy, out)) continue;
      let first = -1, ok = true;
      for (let p = 0; p < e.n && ok; p++) {
        if (e.pix[p] !== BODY || this.roomForBody(e, out[p])) continue;
        if (!this.diggable(out[p], limit)) ok = false;
        else if (first < 0) first = out[p];
      }
      if (ok && first >= 0) {
        if (USEFUL[this.type[first]]) this.stow(b, this.type[first]);
        this.clearCell(first);
        if (b.tool !== 0) b.held = HELD_PICKAXE;
        return true;
      }
    }
    return false;
  },

  // Can a human dig out cell c, digging things up to strength `limit`: not
  // too hard, not hot, and not something a human put there (but tunnel
  // lining in its way it can: left standing when the dirt round it went, it
  // would wall humans in; a tunnel that needs it is re-lined when used)?
  diggable(c, limit = HAND_DIG) {
    const s = DIG[this.type[c]];
    return s > 0 && s <= limit && this.temp[c] < HOT && (!this.madeByHuman(c) || (this.tunnels.mask[c] & 2) !== 0);
  },

  digLimit(b) {
    return b.tool !== 0 ? TOOL_DIG : HAND_DIG;
  },

  // Did a human put what's in cell c there (and is it still there)?
  madeByHuman(c) {
    const t = this.humanMade.get(c);
    if (t === undefined) return false;
    if (t === this.type[c]) return true;
    this.humanMade.delete(c);
    return false;
  },

  // A human puts element t in cell c, remembering it did.
  putDown(c, t) {
    if (this.type[c] !== 0) this.clearCell(c);
    this.spawn(c, t);
    this.humanMade.set(c, this.type[c]);
  },

  has(b, t) {
    return b.items.get(t) ?? 0;
  },

  // How many it carries of everything in `set`.
  holding(b, set) {
    let n = 0;
    for (const [t, k] of b.items) if (set[t]) n += k;
    return n;
  },

  // Put one t in its inventory, if it has room: true if it did.
  stow(b, t) {
    const k = this.has(b, t);
    if (k >= STACK) return false;
    b.items.set(t, k + 1);
    b.held = t;
    this.mixPowder(b);
    return true;
  },

  takeOut(b, t) {
    const k = this.has(b, t);
    if (k === 0) return false;
    if (k === 1) b.items.delete(t);
    else b.items.set(t, k - 1);
    return true;
  },

  // Take out one of whatever in `set` it has most of: that element, or 0.
  takeAny(b, set) {
    let best = 0, most = 0;
    for (const [t, k] of b.items) {
      if (set[t] && k > most) {
        best = t;
        most = k;
      }
    }
    if (best !== 0) this.takeOut(b, best);
    return best;
  },

  // Coal and Salt carried together make Gunpowder (the game's own Coal +
  // Salt reaction), two at a time, up to a full stack.
  mixPowder(b) {
    while (this.has(b, COAL) > 0 && this.has(b, SALT) > 0 && this.has(b, GUNPOWDER) <= STACK - 2) {
      this.takeOut(b, COAL);
      this.takeOut(b, SALT);
      b.items.set(GUNPOWDER, this.has(b, GUNPOWDER) + 2);
    }
  },

  // Set off to fetch the nearest thing in `set` (within `radius` of the camp,
  // open to one side if `side`): true if there was one.
  gather(e, b, camp, set, radius, job, side = false) {
    const t = this.findWanted(e, camp, set, radius, side);
    if (t < 0) return false;
    this.claim(b, camp, t);
    b.fetchSet = set;
    b.fetchR = radius;
    b.fetchSide = side;
    b.job = job;
    return true;
  },

  // Wood taken from (x, y) with more trunk above it: the tree comes down. Its
  // wood and leaves (but nothing humans put there) fall loose, like sand,
  // and pile up where they can be gathered.
  fell(x, y) {
    const { gravity: g, w } = this;
    const ax = x - g.downX, ay = y - g.downY;
    if (!this.inBounds(ax, ay) || this.type[ay * w + ax] !== WOOD || this.madeByHuman(ay * w + ax)) return;
    const seen = new Set([ay * w + ax]), todo = [ay * w + ax];
    while (todo.length > 0 && seen.size < FELL_MAX) {
      const c = todo.pop();
      this.loose[c] = 1;
      const cx = c % w, cy = (c / w) | 0;
      for (const [dx, dy] of NEAR4) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.inBounds(nx, ny)) continue;
        const j = ny * w + nx;
        if (!seen.has(j) && TREE[this.type[j]] && !this.madeByHuman(j)) {
          seen.add(j);
          todo.push(j);
        }
      }
    }
  },

  // A human that dies drops the pixels it carried round where it lay; its
  // tool, weapon and armour are lost.
  dropInventory(e) {
    const b = e.brain;
    for (const [t, k] of b.items) {
      for (let n = 0; n < k; n++) {
        const c = this.freeSpaceNear(e.y * this.w + e.x);
        if (c >= 0) this.spawn(c, t);
      }
    }
    b.items.clear();
  },

  pose(e, fr) {
    if (e.frame !== fr) this.moveBody(e, e.x, e.y, fr, e.facing, e.gx, e.gy);
  },

  // The nearest danger within r of e (a cell index), or -1: something in
  // DANGER, anything but a gas hotter than HOT (its own campfire aside), or
  // a blast's pressure (then the cell beside it on the side the pressure
  // is higher).
  findDanger(e, r) {
    const { w, h, type, temp } = this;
    const camp = e.brain.camp;
    let best = -1, bd = Infinity;
    for (let y = Math.max(0, e.y - r); y <= Math.min(h - 1, e.y + r); y++) {
      for (let x = Math.max(0, e.x - r); x <= Math.min(w - 1, e.x + r); x++) {
        const i = y * w + x, t = type[i];
        if (t === 0 || t === e.kind) continue;
        if (!DANGER[t] && (temp[i] <= HOT || DEFS[t].state === GAS)) continue;
        if (camp !== null && this.inCampFire(camp, x, y, DEFS[t].state === ENERGY)) continue;
        const d = (x - e.x) ** 2 + (y - e.y) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    }
    // Unarmed (or out of gunpowder), it fears armed humans of other camps
    // within shot.
    if (!this.armed(e.brain)) {
      for (const o of this.creatures) {
        if (o.brain === null || o === e || !this.rival(e.brain, o.brain) || !this.armed(o.brain)) continue;
        if (Math.max(Math.abs(o.x - e.x), Math.abs(o.y - e.y)) > SHOT_R) continue;
        const d = (o.x - e.x) ** 2 + (o.y - e.y) ** 2;
        if (d < bd) {
          bd = d;
          best = o.y * w + o.x;
        }
      }
    }
    if (best < 0 && this.air.p[this.air.at(e.x, e.y)] > BLAST_FEAR) {
      const l = this.pressureAt(Math.max(0, e.x - 8), e.y), rt = this.pressureAt(Math.min(w - 1, e.x + 8), e.y);
      best = e.y * w + (l > rt ? Math.max(0, e.x - 1) : Math.min(w - 1, e.x + 1));
    }
    return best;
  },

  // Is (x, y) part of its camp's fire: flames (`flame`) right over the
  // pile, or anything else hot round it (the ground it has warmed)?
  inCampFire(camp, x, y, flame) {
    const u = (x - camp.x) * camp.gy - (y - camp.y) * camp.gx;
    const v = (x - camp.x) * camp.gx + (y - camp.y) * camp.gy;
    const r = flame ? 2 : 6;
    return u >= -r && u <= r && v >= -20 && v <= 4;
  },

  think(e, b) {
    const danger = this.findDanger(e, b.job === 'fleeing' ? SAFE_R : DANGER_R);
    if (danger >= 0) {
      const a = ((danger % this.w) - e.x) * e.gy - (((danger / this.w) | 0) - e.y) * e.gx;
      b.fleeDir = a > 0 ? -1 : a < 0 ? 1 : -e.facing;
      b.job = 'fleeing';
      return;
    }
    if (b.job === 'fleeing') b.job = 'wandering';
    if (this.armed(b)) {
      const foe = this.findFoe(e, b);
      if (foe !== null) {
        if (b.foe !== foe.id) b.reload = FIRE_EVERY - 8; // a gun at the ready
        b.foe = foe.id;
        b.job = 'shooting';
        return;
      }
    }
    if (b.job === 'shooting') b.job = 'wandering';
    this.chooseWork(e, b);
  },

  // Its camp's needs, in order: light a pile that's ready, build the first
  // pile, then (once a fire has been lit) the hut, then keep the fire fed,
  // then rest by it (or wander, before it's lit). A job under way carries on.
  chooseWork(e, b) {
    if (b.camp === null) b.camp = this.joinOrMakeCamp(e);
    const camp = b.camp;
    if (camp === null) {
      b.job = 'wandering';
      return;
    }
    if (this.shouldShelter(e, camp)) {
      b.job = 'sheltering';
      return;
    }
    if (this.carryingOn(e, b, camp)) return;
    this.release(b);
    const burning = this.pileCount(camp, FIRE_SET) > 0;
    const fuel = this.pileCount(camp, burning ? ON_FIRE : FUEL); // a burning pile's own campfire counts
    if (burning) camp.lit = true;
    if (camp.lighter !== 0 && this.creatureById[camp.lighter]?.brain?.job !== 'lighting the fire') camp.lighter = 0;
    if (!burning && fuel >= PILE_LIGHT && camp.lighter === 0) {
      camp.lighter = e.id;
      b.rub = 0;
      b.job = 'lighting the fire';
      return;
    }
    // Everyone helps build the first pile. After that the hut comes first,
    // and then one human is enough to keep the fire going, from its stock.
    if (camp.lit && this.hutWork(e, b, camp)) return;
    if (fuel < (burning ? PILE_LOW : PILE_LIGHT) && !(camp.lit && this.tending(e, camp))) {
      if (this.holding(b, FUEL) > 0) {
        b.job = 'carrying wood';
        return;
      }
      if (this.gather(e, b, camp, FUEL, FUEL_R, 'gathering wood')) return;
    }
    if (this.craftWork(e, b, camp)) return;
    // With nothing else to do, now and then it goes hunting.
    if (camp.lit && this.armed(b) && this.has(b, GUNPOWDER) >= AMMO_LOW && this.tick >= b.huntAt) {
      const prey = this.findPrey(e);
      if (prey !== null) {
        b.foe = prey.id;
        b.huntAt = this.tick + HUNT_EVERY;
        b.huntUntil = this.tick + HUNT_FOR;
        b.reload = FIRE_EVERY - 8;
        b.job = 'hunting';
        return;
      }
    }
    b.job = camp.lit ? 'resting by the fire' : 'wandering';
  },

  // Make a pickaxe, a gun or armour from what it carries: true if it could.
  craft(b, what) {
    if (what === 'pickaxe') {
      if (b.tool !== 0 || this.has(b, WOOD) < PICK_WOOD) return false;
      for (let k = 0; k < PICK_WOOD; k++) this.takeOut(b, WOOD);
      b.tool = 1;
      b.held = HELD_PICKAXE;
      return true;
    }
    if (what === 'gun') {
      if (b.weapon !== 0 || this.holding(b, METALS) < GUN_METAL || this.has(b, WOOD) < GUN_WOOD) return false;
      for (let k = 0; k < GUN_METAL; k++) this.takeAny(b, METALS);
      for (let k = 0; k < GUN_WOOD; k++) this.takeOut(b, WOOD);
      b.weapon = 1;
      b.held = HELD_GUN;
      return true;
    }
    if (what === 'armour') {
      if (b.armour > 0 || this.holding(b, METALS) < ARMOUR_METAL) return false;
      for (let k = 0; k < ARMOUR_METAL; k++) this.takeAny(b, METALS);
      b.armour = ARMOUR_HITS;
      return true;
    }
    return false;
  },

  // Crafting starts once the camp is settled: its hut built and its fire
  // burned for a while.
  canCraft(camp) {
    return camp.hut !== null && camp.hut.done === true && camp.burned >= CRAFT_FIRE_TIME;
  },

  // Gunpowder wanted: a full stack the first time, and again once it's low.
  wantsPowder(b) {
    const gp = this.has(b, GUNPOWDER);
    if (gp >= STACK) b.refill = false;
    else if (gp < AMMO_LOW) b.refill = true;
    return b.refill;
  },

  // Its next crafting step, in order: a pickaxe, coal and salt for
  // gunpowder, metal for a gun, then armour. Crafting is instant once it
  // has what's needed; otherwise it sets off to get it. True if that gave it
  // a job. A resource out of reach is skipped for a while (startMining).
  craftWork(e, b, camp) {
    if (!this.canCraft(camp)) return false;
    if (b.tool === 0 && !this.craft(b, 'pickaxe')) {
      return this.gather(e, b, camp, WOOD_ONLY, FUEL_R, 'gathering wood');
    }
    if (this.wantsPowder(b)) {
      const pairs = Math.ceil((STACK - this.has(b, GUNPOWDER)) / 2);
      if (this.has(b, COAL) < pairs && this.startMining(e, b, camp, 'coal', pairs)) return true;
      if (this.has(b, COAL) > 0 && this.startMining(e, b, camp, 'salt', 0)) return true;
    }
    if (b.weapon === 0 && !this.craft(b, 'gun')) {
      if (this.holding(b, METALS) < GUN_METAL) return this.startMining(e, b, camp, 'metal', GUN_METAL);
      return this.gather(e, b, camp, WOOD_ONLY, FUEL_R, 'gathering wood');
    }
    if (b.weapon !== 0 && b.armour === 0 && !this.craft(b, 'armour')) {
      return this.startMining(e, b, camp, 'metal', ARMOUR_METAL);
    }
    return false;
  },

  // A gun and gunpowder for it.
  armed(b) {
    return b.weapon !== 0 && this.has(b, GUNPOWDER) > 0;
  },

  // Is the human with brain ob of a rival camp?
  rival(b, ob) {
    return ob !== null && ob.camp !== null && b.camp !== null && ob.camp !== b.camp;
  },

  // Where its gun's muzzle is: in front of its chest.
  muzzle(e) {
    return [e.x + 2 * e.facing * e.gy - 4 * e.gx, e.y - 2 * e.facing * e.gx - 4 * e.gy];
  },

  // A cell of o's body to aim at (its first whole pixel), or -1.
  aimAt(o) {
    for (let p = 0; p < o.n; p++) if (o.pix[p] === BODY) return o.cells[p];
    return -1;
  },

  // Can e see o: is o the first thing on the line from its muzzle?
  sees(e, o) {
    const c = this.aimAt(o);
    if (c < 0) return false;
    const [mx, my] = this.muzzle(e);
    return this.lineFirst(e, mx, my, c % this.w, (c / this.w) | 0) === o;
  },

  // The first creature (not e) on the straight line from (x0, y0) to
  // (x1, y1), before anything solid: the creature, or null.
  lineFirst(e, x0, y0, x1, y1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 1; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
      if (!this.inBounds(x, y)) return null;
      const c = y * this.w + x, t = this.type[c];
      if (t === 0 || this.ownCell(e, c)) continue;
      const o = this.creatureAt(c);
      if (o !== null) return o;
      const s = DEFS[t].state;
      if (s === SOLID || s === POWDER) return null;
    }
    return null;
  },

  // The nearest threat (a Spider or Phoenix) or rival human within FIGHT_R
  // of e or its camp, that it can see: a creature, or null.
  findFoe(e, b) {
    let best = null, bd = Infinity;
    for (const o of this.creatures) {
      if (o === e || o.grow >= 0) continue;
      if (!THREAT[o.kind] && !(o.brain !== null && this.rival(b, o.brain))) continue;
      const d = Math.max(Math.abs(o.x - e.x), Math.abs(o.y - e.y));
      const dc = b.camp === null ? Infinity : Math.max(Math.abs(o.x - b.camp.x), Math.abs(o.y - b.camp.y));
      if (Math.min(d, dc) > FIGHT_R || d > SHOT_R || d >= bd || !this.sees(e, o)) continue;
      best = o;
      bd = d;
    }
    return best;
  },

  // An animal within FIGHT_R that it can see: a creature, or null.
  findPrey(e) {
    let best = null, bd = Infinity;
    for (const o of this.creatures) {
      if (o === e || o.grow >= 0 || o.brain !== null || THREAT[o.kind]) continue;
      const d = Math.max(Math.abs(o.x - e.x), Math.abs(o.y - e.y));
      if (d > FIGHT_R || d >= bd || !this.sees(e, o)) continue;
      best = o;
      bd = d;
    }
    return best;
  },

  // Face the foe and fire every FIRE_EVERY steps, aiming at a random pixel
  // of it, but only while nothing else is in the way.
  shootAt(e, b) {
    const o = b.foe === 0 ? null : this.creatureById[b.foe];
    if (o == null || o.id !== b.foe || !this.armed(b) || (b.job === 'hunting' && this.tick > b.huntUntil)) {
      b.foe = 0;
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    b.held = HELD_GUN;
    const a = (o.x - e.x) * e.gy - (o.y - e.y) * e.gx;
    const face = a > 0 ? 1 : a < 0 ? -1 : e.facing;
    if (face !== e.facing || e.frame !== 0) this.moveBody(e, e.x, e.y, 0, face, e.gx, e.gy);
    if (++b.reload < FIRE_EVERY) return;
    const aim = this.randomCell(o);
    if (aim < 0) return;
    const [mx, my] = this.muzzle(e), ax = aim % this.w, ay = (aim / this.w) | 0;
    if (this.lineFirst(e, mx, my, ax, ay) !== o) return; // holds its fire
    b.reload = 0;
    this.shoot(e, b, mx, my, ax, ay);
  },

  // Fire one shot from (mx, my) at (ax, ay): PELLETS pellets in a tight
  // spread, for one gunpowder, and a puff of smoke.
  shoot(e, b, mx, my, ax, ay) {
    if (!this.takeOut(b, GUNPOWDER)) return;
    const base = Math.atan2(ay - my, ax - mx);
    for (let k = 0; k < PELLETS; k++) {
      const a = base + (k - (PELLETS - 1) / 2) * SPREAD + (this.rand() - 0.5) * SPREAD;
      this.pellet(e, mx, my, Math.cos(a), Math.sin(a));
    }
    if (this.inBounds(mx, my)) {
      const s = this.spawnNear(mx, my, ID.SMOKE);
      if (s >= 0) this.temp[s] = 45;
    }
  },

  // A pellet from (x0, y0) along (dx, dy): it flies through air, gases and
  // liquids, and stops at the first solid, powder or creature (which loses
  // the pixel it hit). Its path is kept for drawing.
  pellet(e, x0, y0, dx, dy) {
    let x = x0 + 0.5, y = y0 + 0.5, cx = x0, cy = y0;
    for (let k = 0; k < SHOT_R; k++) {
      const nx = Math.floor(x), ny = Math.floor(y);
      if (!this.inBounds(nx, ny)) break;
      cx = nx;
      cy = ny;
      const c = cy * this.w + cx, t = this.type[c];
      if (t !== 0 && !this.ownCell(e, c)) {
        const o = this.creatureAt(c);
        if (o !== null) {
          this.pelletHits(o, c);
          break;
        }
        const s = DEFS[t].state;
        if (s === SOLID || s === POWDER) break;
      }
      x += dx;
      y += dy;
    }
    this.shots.push({ x0, y0, x1: cx, y1: cy, ttl: TRACER });
  },

  // A pellet hits creature o at cell c: armour takes it half the time;
  // otherwise that pixel is lost.
  pelletHits(o, c) {
    if (o.brain !== null && o.brain.armour > 0 && this.rand() < 0.5) {
      o.brain.armour--;
      return;
    }
    for (let p = 0; p < o.n; p++) {
      if (o.cells[p] !== c || o.pix[p] !== BODY) continue;
      this.clearCell(c);
      this.hurt(o, p, false);
      o.shot = true;
      return;
    }
  },

  // A job under way carries on: something still there to fetch, a load
  // still to deliver, the fire it's lighting.
  carryingOn(e, b, camp) {
    switch (b.job) {
      case 'gathering wood':
      case 'fetching stone': return b.target >= 0 && b.fetchSet[this.type[b.target]] === 1;
      case 'carrying wood': return this.holding(b, FUEL) > 0;
      case 'building the hut': return camp.hut !== null && !camp.hut.done
        && (this.holding(b, MATERIAL) > 0 || (camp.hut.wood && this.has(b, WOOD) > 0));
      case 'lighting the fire': return camp.lighter === e.id;
      case 'mining': return b.tun !== null;
      case 'hunting': return b.foe !== 0 && this.creatureById[b.foe] != null && this.tick <= b.huntUntil;
      default: return false;
    }
  },

  // Is another member of the camp already fetching fuel?
  tending(e, camp) {
    for (const id of camp.members) {
      const o = this.creatureById[id];
      if (o && o !== e && o.brain !== null && (o.brain.job === 'gathering wood' || o.brain.job === 'carrying wood')) return true;
    }
    return false;
  },

  // Once the camp's fire has been lit, a hut beside it: fetch material for
  // it. True if that gave e a job.
  hutWork(e, b, camp) {
    if (!camp.lit) return false;
    if (camp.hut === null) {
      if (this.tick < camp.hutRetry) return false;
      camp.hut = this.planHut(camp);
      if (camp.hut === null) {
        camp.hutRetry = this.tick + 600;
        return false;
      }
      this.clearSite(camp, camp.hut);
    }
    const hut = camp.hut;
    if (hut.done) return false;
    if (this.nextHutCell(hut) < 0) {
      hut.done = true;
      return false;
    }
    if (this.holding(b, MATERIAL) > 0 || (hut.wood && this.has(b, WOOD) > 0 && b.job === 'building the hut')) {
      b.job = 'building the hut';
      return true;
    }
    // From blocks and boulders, not the ground it stands on.
    if (this.gather(e, b, camp, MATERIAL, STONE_R, 'fetching stone', true)) return true;
    if (this.gather(e, b, camp, WOOD_ONLY, STONE_R, 'fetching stone', true)) {
      hut.wood = true;
      return true;
    }
    return false;
  },

  // A site for the hut: HUT_W columns side by side, at least HUT_GAP cells
  // past the pile (up to HUT_R), on ground within a climbable step of flat,
  // with room for it and a way there (walkable).
  planHut(camp) {
    for (let off = 3 + HUT_GAP; off <= HUT_R; off++) {
      for (const side of [1, -1]) {
        const plan = this.hutAt(camp, side > 0 ? off : -off - (HUT_W - 1), side);
        if (plan !== null) return plan;
      }
    }
    return null;
  },

  // The blueprint for a hut over columns u0 .. u0 + HUT_W - 1 (side: which
  // side of the pile it's on), or null. Both walls have a doorway DOOR cells
  // high, so the hut doesn't cut the camp off from what lies beyond it. In
  // build order: the two cells over the far doorway, the two over the near
  // one (facing the fire), then the roof from the far wall across.
  hutAt(camp, u0, side) {
    let top = Infinity, bottom = -Infinity;
    for (let u = u0; u < u0 + HUT_W; u++) {
      const g = this.groundAt(camp, u);
      if (g === null) return null;
      top = Math.min(top, g);
      bottom = Math.max(bottom, g);
    }
    if (bottom - top > CLIMB) return null; // a step it can climb, inside
    if (!this.walkable(camp, side > 0 ? 2 : -2, side > 0 ? u0 : u0 + HUT_W - 1)) return null;
    const floor = top - 1; // the row it stands in
    for (let v = floor; v >= floor - HUT_WALL; v--) {
      for (let u = u0; u < u0 + HUT_W; u++) {
        const c = this.campCell(camp, u, v);
        if (c < 0 || this.groundCell(c)) return null;
      }
    }
    const farU = side > 0 ? u0 + HUT_W - 1 : u0, doorU = side > 0 ? u0 : u0 + HUT_W - 1;
    const order = [];
    for (let v = floor - DOOR; v > floor - HUT_WALL; v--) order.push([farU, v]);
    for (let v = floor - DOOR; v > floor - HUT_WALL; v--) order.push([doorU, v]);
    for (let k = 0; k < HUT_W; k++) order.push([farU - side * k, floor - HUT_WALL]);
    const cells = order.map(([u, v]) => this.campCell(camp, u, v));
    return { cells, us: order.map(([u]) => u), set: new Set(cells), u0, floor, side, done: false, wood: false };
  },

  // The ground in column u near the camp: the topmost solid (or powder)
  // cell with open space above it, from 8 cells above the camp's spot to 8
  // below. Its v, or null.
  groundAt(camp, u) {
    for (let v = -8; v <= 8; v++) {
      const c = this.campCell(camp, u, v), a = this.campCell(camp, u, v - 1);
      if (c < 0 || a < 0) continue;
      if (this.groundCell(c) && !this.groundCell(a)) return v;
    }
    return null;
  },

  // Can a human get from column ua to column ub of the camp's frame, on
  // the level of ua's ground: nothing too hard to dig by hand (rock, metal)
  // in a body's height above that level, all the way? (Dirt, wood and
  // growth it walks over or digs through.)
  walkable(camp, ua, ub) {
    const s = ub >= ua ? 1 : -1, g = this.groundAt(camp, ua);
    if (g === null) return false;
    for (let u = ua; u !== ub + s; u += s) {
      for (let v = g - 1; v >= g - 6; v--) {
        const c = this.campCell(camp, u, v);
        if (c < 0 || (this.groundCell(c) && !this.diggable(c, HAND_DIG))) return false;
      }
    }
    return true;
  },

  // Is cell c ground to build on, or in the way of building: built (solid
  // or powder), and not growth it would clear away?
  groundCell(c) {
    return this.builtAt(c) && !CLEARABLE[this.type[c]];
  },

  // Clear the growth off a hut's site, from its floor to its roof.
  clearSite(camp, hut) {
    for (let v = hut.floor; v >= hut.floor - HUT_WALL; v--) {
      for (let u = hut.u0; u < hut.u0 + HUT_W; u++) {
        const c = this.campCell(camp, u, v);
        if (c >= 0 && CLEARABLE[this.type[c]]) this.clearCell(c);
      }
    }
  },

  // Is cell c solid (or powder), and not a creature?
  builtAt(c) {
    const t = this.type[c];
    if (t === 0 || SHAPED[t]) return false;
    const s = DEFS[t].state;
    return s === SOLID || s === POWDER;
  },

  nextHutCell(hut) {
    for (let k = 0; k < hut.cells.length; k++) if (!this.builtAt(hut.cells[k])) return k;
    return -1;
  },

  // Carry the material to the hut and put it in the lowest unfinished
  // cell, standing inside where it can reach.
  build(e, b) {
    const camp = b.camp, hut = camp === null ? null : camp.hut;
    const k = hut === null ? -1 : this.nextHutCell(hut);
    if (k < 0) {
      if (hut !== null) hut.done = true;
      b.job = 'wandering'; // it keeps what it carries
      b.think = 0;
      return;
    }
    const u = Math.min(hut.u0 + HUT_W - 3, Math.max(hut.u0 + 2, hut.us[k]));
    const s = this.campCell(camp, u, hut.floor);
    if (s < 0 || !this.walkTo(e, b, s % this.w, (s / this.w) | 0, 0, WALK_EVERY)) return;
    this.pose(e, 0);
    const c = hut.cells[k], t = this.type[c];
    if (t !== 0 && (SHAPED[t] || DEFS[t].state === LIQUID)) return; // wait for it to move
    const m = this.takeAny(b, MATERIAL) || (hut.wood && this.takeOut(b, WOOD) ? WOOD : 0);
    if (m === 0) {
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    this.putDown(c, m); // and on to the next cell, while it has more
  },

  // A finished hut to go to, and cold air or rain, snow or hail falling nearby.
  shouldShelter(e, camp) {
    if (camp.hut === null || !camp.hut.done) return false;
    if (this.air.heat && this.air.t[this.air.at(e.x, e.y)] < COLD_AIR) return true;
    return this.precipitation(e);
  },

  // Water, snow or hail falling (nothing under it) within RAIN_R above it.
  precipitation(e) {
    const { w, type } = this;
    for (let v = -RAIN_R; v < 0; v++) {
      for (let u = -RAIN_R; u <= RAIN_R; u++) {
        const x = e.x + u * e.gy + v * e.gx, y = e.y - u * e.gx + v * e.gy;
        if (!this.inBounds(x, y) || !this.inBounds(x + e.gx, y + e.gy)) continue;
        const t = type[y * w + x];
        if ((t === ID.WATER || t === ID.SNOW || t === ID.HAIL) && type[(y + e.gy) * w + x + e.gx] === 0) return true;
      }
    }
    return false;
  },

  // Go into the hut and sit in the middle.
  shelter(e, b) {
    const camp = b.camp, hut = camp.hut;
    const s = this.campCell(camp, hut.u0 + (HUT_W >> 1), hut.floor);
    if (s >= 0 && this.walkTo(e, b, s % this.w, (s / this.w) | 0, 1, WALK_EVERY)) this.pose(e, FRAME_SIT);
  },

  act(e, b) {
    switch (b.job) {
      case 'fleeing':
        if (++b.pace >= RUN_EVERY) {
          b.pace = 0;
          b.heading = b.fleeDir;
          this.stepAcross(e, b.fleeDir, CLIMB, true);
        }
        break;
      case 'gathering wood':
      case 'fetching stone': this.fetch(e, b); break;
      case 'carrying wood': this.carryToPile(e, b); break;
      case 'lighting the fire': this.lightFire(e, b); break;
      case 'resting by the fire': this.restByFire(e, b); break;
      case 'building the hut': this.build(e, b); break;
      case 'mining': this.mine(e, b); break;
      case 'shooting':
      case 'hunting': this.shootAt(e, b); break;
      case 'sheltering': this.shelter(e, b); break;
      default: this.wander(e, b);
    }
  },

  makeCamp(x, y, gx = this.gravity.downX, gy = this.gravity.downY) {
    const camp = {
      x, y, gx, gy, // the pile's middle (on the ground), and the way down there
      lit: false, // its fire has been lit (it may have burned out since)
      burned: 0, // steps its fire has burned, in all
      hut: null, hutRetry: 0, // the hut's blueprint
      members: new Set(), // the humans' ids
      claims: new Set(), // cells someone is on their way to fetch
      lighter: 0, // who is lighting the fire
    };
    this.camps.push(camp);
    return camp;
  },

  // The camp within CAMP_JOIN, or a new one on flat dry ground a few cells
  // beside e. null if there's nowhere for one.
  joinOrMakeCamp(e) {
    let camp = this.camps.find((c) => Math.max(Math.abs(c.x - e.x), Math.abs(c.y - e.y)) <= CAMP_JOIN) ?? null;
    if (camp === null) {
      for (const u of [3, -3, 4, -4, 5, -5, 6, -6]) {
        const x = e.x + u * e.gy, y = e.y - u * e.gx;
        if (this.campSpot(x, y, e.gx, e.gy)) {
          camp = this.makeCamp(x, y, e.gx, e.gy);
          this.clearFirePit(camp);
          break;
        }
      }
    }
    if (camp !== null) camp.members.add(e.id);
    return camp;
  },

  // Flat dry ground for a pile at (x, y): it and the cells either side
  // empty with solid ground (or powder) under them, and no liquid beside.
  campSpot(x, y, gx, gy) {
    for (let u = -1; u <= 1; u++) {
      const cx = x + u * gy, cy = y - u * gx;
      if (!this.inBounds(cx, cy) || !this.inBounds(cx + gx, cy + gy)) return false;
      if (this.type[cy * this.w + cx] !== 0) return false;
      const g = this.type[(cy + gy) * this.w + cx + gx], s = DEFS[g].state;
      if (g === 0 || SHAPED[g] || (s !== SOLID && s !== POWDER)) return false;
      for (const [dx, dy] of [[gy, -gx], [-gy, gx], [-gx, -gy]]) {
        if (this.inBounds(cx + dx, cy + dy) && DEFS[this.type[(cy + dy) * this.w + cx + dx]].state === LIQUID) return false;
      }
    }
    return true;
  },

  // A new camp clears its fire pit: grass (or anything else that burns)
  // in the ground under and beside the pile is scraped back to dirt.
  clearFirePit(camp) {
    for (let u = -3; u <= 3; u++) {
      for (let v = 1; v <= 2; v++) {
        const c = this.campCell(camp, u, v);
        if (c >= 0 && this.type[c] !== 0 && DEFS[this.type[c]].flammable > 0) this.convert(c, ID.DIRT, false, -1);
      }
    }
  },

  // The cell u across and v down from the camp's spot, in its frame; -1
  // outside the world.
  campCell(camp, u, v) {
    const x = camp.x + u * camp.gy + v * camp.gx, y = camp.y - u * camp.gx + v * camp.gy;
    return this.inBounds(x, y) ? y * this.w + x : -1;
  },

  // Are (x0, y0) and (x1, y1) on opposite sides of the camp's pile, while
  // it's burning?
  acrossFire(camp, x0, y0, x1, y1) {
    const u0 = (x0 - camp.x) * camp.gy - (y0 - camp.y) * camp.gx;
    const u1 = (x1 - camp.x) * camp.gy - (y1 - camp.y) * camp.gx;
    if (!((u0 > 2 && u1 < -2) || (u0 < -2 && u1 > 2))) return false;
    return this.pileCount(camp, FLAMES) > 0;
  },

  // The pile and the flames over it.
  inPile(camp, x, y) {
    const u = (x - camp.x) * camp.gy - (y - camp.y) * camp.gx;
    const v = (x - camp.x) * camp.gx + (y - camp.y) * camp.gy;
    return u >= -2 && u <= 2 && v >= -4 && v <= 0;
  },

  pileCount(camp, set) {
    let n = 0;
    for (let v = -4; v <= 0; v++) {
      for (let u = -2; u <= 2; u++) {
        const c = this.campCell(camp, u, v);
        if (c >= 0 && set[this.type[c]]) n++;
      }
    }
    return n;
  },

  // Where the next piece of fuel goes: the lowest cell of the pile that's
  // empty, or holds only ash from the last fire or something weak that
  // fell or drifted in (it clears it out).
  pileSpace(camp) {
    for (let v = 0; v >= -1; v--) { // two rows: low enough to step over
      for (const u of [0, -1, 1]) {
        const c = this.campCell(camp, u, v);
        if (c < 0) continue;
        const t = this.type[c];
        if (t === 0 || t === ID.ASH || (!FUEL[t] && this.diggable(c))) return c;
      }
    }
    return -1;
  },

  // The nearest cell to e within `radius` of the camp holding something in
  // `set`, open to the air (`side`: open to one side, so it isn't the
  // ground underfoot), within reach of ground a human stands on, and not in
  // the pile or the hut, nor claimed or given up on. -1 if none.
  findWanted(e, camp, set, radius, side = false) {
    const { w, h, type } = this;
    const b = e.brain, hut = camp.hut;
    let best = -1, bd = Infinity;
    for (let y = Math.max(0, camp.y - radius); y <= Math.min(h - 1, camp.y + radius); y++) {
      for (let x = Math.max(0, camp.x - radius); x <= Math.min(w - 1, camp.x + radius); x++) {
        const i = y * w + x;
        if (!set[type[i]]) continue;
        const d = Math.abs(x - e.x) + Math.abs(y - e.y);
        if (d >= bd || camp.claims.has(i) || this.isBanned(b, i) || this.inPile(camp, x, y)) continue;
        if ((hut !== null && hut.set.has(i)) || this.madeByHuman(i)) continue; // not its hut, nor tunnel lining
        if (!this.openAt(x, y) || !this.nearGround(x, y, e.gx, e.gy)) continue;
        if (side && !this.openSide(x, y, e.gx, e.gy)) continue;
        if (this.acrossFire(camp, e.x, e.y, x, y)) continue;
        best = i;
        bd = d;
      }
    }
    return best;
  },

  // Is there empty space beside (x, y), across the down arrow?
  openSide(x, y, gx, gy) {
    for (const s of [1, -1]) {
      const nx = x + s * gy, ny = y - s * gx;
      if (this.inBounds(nx, ny) && this.type[ny * this.w + nx] === 0) return true;
    }
    return false;
  },

  openAt(x, y) {
    const { w, h, type } = this;
    const i = y * w + x;
    return (x + 1 < w && type[i + 1] === 0) || (x > 0 && type[i - 1] === 0)
      || (y + 1 < h && type[i + w] === 0) || (y > 0 && type[i - w] === 0);
  },

  // Is there a place within 3 cells of (x, y) a human could stand: empty,
  // with solid ground or powder under it, and room for its body (3 wide, 6
  // tall) above?
  nearGround(x, y, gx, gy) {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!this.inBounds(nx, ny) || !this.inBounds(nx + gx, ny + gy)) continue;
        if (this.type[ny * this.w + nx] !== 0) continue;
        const g = this.type[(ny + gy) * this.w + nx + gx], s = DEFS[g].state;
        if (g !== 0 && (s === SOLID || s === POWDER) && this.roomToStand(nx, ny, gx, gy)) return true;
      }
    }
    return false;
  },

  // Room for a human's body standing at (x, y): nothing solid or powder in
  // the 3x6 box above its feet (creatures, liquids and gases don't count).
  roomToStand(x, y, gx, gy) {
    for (let up = 0; up < 6; up++) {
      for (let k = -1; k <= 1; k++) {
        const cx = x + k * gy - up * gx, cy = y - k * gx - up * gy;
        if (!this.inBounds(cx, cy)) return false;
        const t = this.type[cy * this.w + cx];
        if (t !== 0 && !SHAPED[t] && (DEFS[t].state === SOLID || DEFS[t].state === POWDER)) return false;
      }
    }
    return true;
  },

  isBanned(b, i) {
    const t = b.banned.get(i);
    return t !== undefined && t > this.tick;
  },

  // The cell `u` across from the camp's spot on the side e is on.
  besideCamp(e, camp, u) {
    const side = (e.x - camp.x) * camp.gy - (e.y - camp.y) * camp.gx >= 0 ? 1 : -1;
    return this.campCell(camp, side * u, 0);
  },

  // The nearest cell of `set` within MINE_R of the camp (and within `near`
  // of e) that it can dig, buried or not: not something a human put there,
  // claimed, or given up on. -1 if none.
  findDeposit(e, camp, set, limit, near = Infinity) {
    const { w, h, type } = this;
    const b = e.brain;
    let best = -1, bd = Infinity;
    for (let y = Math.max(0, camp.y - MINE_R); y <= Math.min(h - 1, camp.y + MINE_R); y++) {
      for (let x = Math.max(0, camp.x - MINE_R); x <= Math.min(w - 1, camp.x + MINE_R); x++) {
        const i = y * w + x;
        if (!set[type[i]]) continue;
        const d = Math.abs(x - e.x) + Math.abs(y - e.y);
        if (d >= bd || d > near || camp.claims.has(i) || this.isBanned(b, i) || !this.diggable(i, limit)) continue;
        best = i;
        bd = d;
      }
    }
    return best;
  },

  // Does it want more of what it's mining? Salt goes into gunpowder as it's
  // mined, so it wants salt while it still has coal to go with it.
  wantsMore(b) {
    if (b.mineKey === 'salt') return this.has(b, COAL) > 0 && this.has(b, GUNPOWDER) < STACK;
    return this.holding(b, b.fetchSet) < b.wantN;
  },

  // Walk to the target and pick it up; then the nearest more of the same,
  // until its hands are full or there's no more. Stone fetched for the hut
  // then goes to build it.
  fetch(e, b) {
    const t = b.target;
    if (t < 0 || !b.fetchSet[this.type[t]]) {
      this.release(b);
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    if (!this.walkTo(e, b, t % this.w, (t / this.w) | 0, REACH, WALK_EVERY)) return;
    const u = this.type[t];
    this.release(b);
    if (this.stow(b, u)) {
      this.clearCell(t);
      if (u === WOOD) this.fell(t % this.w, (t / this.w) | 0);
      if (this.holding(b, b.fetchSet) < STACK && this.gather(e, b, b.camp, b.fetchSet, b.fetchR, b.job, b.fetchSide)) return;
    }
    b.job = b.job === 'fetching stone' ? 'building the hut' : 'wandering';
    b.think = 0;
  },

  // Take the fuel to the camp and put it on the pile (or down beside a
  // full one, so its hands are free to light it).
  carryToPile(e, b) {
    const camp = b.camp;
    if (camp === null) {
      b.think = 0;
      return;
    }
    if (!this.walkTo(e, b, camp.x, camp.y, REACH + 1, WALK_EVERY)) return; // not into the flames
    // A piece a step: up to what lighting needs, or until a burning fire has
    // enough (coal last; the rest it keeps).
    const want = this.pileCount(camp, FIRE_SET) > 0 ? PILE_LOW : PILE_LIGHT;
    const c = this.pileSpace(camp);
    if (c >= 0 && this.pileCount(camp, want === PILE_LOW ? ON_FIRE : FUEL) < want) {
      const t = this.takeAny(b, FEED) || this.takeAny(b, FUEL);
      if (t !== 0) {
        this.putDown(c, t);
        return;
      }
    }
    b.job = 'wandering';
    b.think = 0;
  },

  // Kneel beside the pile and rub sticks; after RUB_FOR steps it catches.
  lightFire(e, b) {
    const camp = b.camp, s = this.besideCamp(e, camp, LIGHT_U);
    if (s < 0 || !this.walkTo(e, b, s % this.w, (s / this.w) | 0, 0, WALK_EVERY)) return;
    this.pose(e, FRAME_KNEEL);
    if (++b.rub < RUB_FOR) return;
    b.rub = 0;
    if (this.lightPile(camp)) camp.lit = true;
    camp.lighter = 0;
    b.job = 'wandering';
    b.think = 0;
  },

  lightPile(camp) {
    for (let v = 0; v >= -2; v--) {
      for (let u = -1; u <= 1; u++) {
        const c = this.campCell(camp, u, v);
        if (c >= 0 && FUEL[this.type[c]]) {
          this.kindle(c);
          return true;
        }
      }
    }
    return false;
  },

  // Sit a few cells from the fire, on the side away from the hut (its
  // doorway would be in the way).
  restByFire(e, b) {
    const camp = b.camp, hut = camp.hut;
    const s = hut === null ? this.besideCamp(e, camp, REST_U) : this.campCell(camp, -hut.side * REST_U, 0);
    if (s >= 0 && this.walkTo(e, b, s % this.w, (s / this.w) | 0, 1, WALK_EVERY)) this.pose(e, FRAME_SIT);
  },

  // Amble about near its camp (or where it is), stopping now and then.
  wander(e, b) {
    if (b.goalX < 0) {
      const cx = b.camp !== null ? b.camp.x : e.x, cy = b.camp !== null ? b.camp.y : e.y;
      const d = ((this.rand() * 21) | 0) - 10;
      b.goalX = Math.min(this.w - 1, Math.max(0, cx + d * e.gy));
      b.goalY = Math.min(this.h - 1, Math.max(0, cy - d * e.gx));
    }
    if (this.walkTo(e, b, b.goalX, b.goalY, 1, WALK_EVERY)) {
      this.pose(e, 0);
      if (this.rand() < 0.01) b.goalX = -1;
    }
  },

  // No closer for GIVE_UP steps: leave that target alone for a while.
  giveUp(e, b) {
    if (b.job === 'mining') b.skip.set(b.mineKey, this.tick + BAN_FOR);
    b.tun = null;
    if (b.target >= 0) {
      const t = this.type[b.target], x0 = b.target % this.w, y0 = (b.target / this.w) | 0;
      for (let y = Math.max(0, y0 - BAN_R); y <= Math.min(this.h - 1, y0 + BAN_R); y++) {
        for (let x = Math.max(0, x0 - BAN_R); x <= Math.min(this.w - 1, x0 + BAN_R); x++) {
          const i = y * this.w + x;
          if (i === b.target || (t !== 0 && this.type[i] === t)) b.banned.set(i, this.tick + BAN_FOR);
        }
      }
      this.release(b);
    }
    b.goalX = -1;
    b.stuck = 0;
    b.best = Infinity;
    b.job = 'wandering';
    b.think = 0;
  },

  claim(b, camp, t) {
    b.target = t;
    camp.claims.add(t);
    b.best = Infinity;
    b.stuck = 0;
  },

  release(b) {
    if (b.target >= 0 && b.camp !== null) b.camp.claims.delete(b.target);
    b.target = -1;
  },

  // Once a step: each camp counts the time its fire burns, and shot tracers
  // fade.
  stepCamps() {
    for (const camp of this.camps) if (this.pileCount(camp, FIRE_SET) > 0) camp.burned++;
    const s = this.shots;
    for (let k = s.length - 1; k >= 0; k--) if (--s[k].ttl <= 0) s.splice(k, 1);
  },

  // A human that dies leaves its camp; a camp with nobody left is forgotten.
  leaveCamp(e) {
    const b = e.brain, camp = b.camp;
    if (camp === null) return;
    this.release(b);
    camp.members.delete(e.id);
    if (camp.lighter === e.id) camp.lighter = 0;
    if (camp.members.size === 0) this.camps.splice(this.camps.indexOf(camp), 1);
    b.camp = null;
  },
};
