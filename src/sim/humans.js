// Humans: shaped creatures (creatures.js) with minds of their own. A human
// makes a camp, gathers fuel into a pile beside it and lights it by
// rubbing sticks, builds a small hut nearby, shelters there from cold and
// rain, and runs from danger. It decides what to do every THINK_EVERY
// steps (think) and works at it in between (act). Humans near one camp
// share it and split the work. Mixed into World.prototype.

import { DEFS, ID, NUM, State } from './elements.js';
import { SHAPED, SUFFOCATE_EVERY, BODY } from './creatures.js';

const { SOLID, POWDER, LIQUID, GAS, ENERGY } = State;
const setOf = (keys) => {
  const s = new Uint8Array(NUM);
  for (const k of keys) s[ID[k]] = 1;
  return s;
};

export const THINK_EVERY = 8;
export const WALK_EVERY = 4; // steps per cell walked
export const RUN_EVERY = 2; // and run
const CLIMB = 2; // the highest step it climbs
const SWIM_CLIMB = 6; // or swims up, getting out of water
const GIVE_UP = 300; // steps without getting closer before it gives up on a target
const BAN_FOR = 1800; // and leaves that target alone
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
const DANGER = setOf(['LAVA', 'ACID', 'NAPALM', 'GREEK_FIRE', 'GREY_GOO', 'VIRUS', 'ANTIMATTER', 'BLACK_HOLE']);
const CAMP_JOIN = 60; // it joins a camp this close
const FUEL_R = 60; // and fetches fuel this far from it
const PILE_LIGHT = 6; // fuel in the pile before it's lit
const PILE_LOW = 4; // a burning pile with less is topped up
const RUB_FOR = 180; // steps rubbing sticks before the pile catches
const LIGHT_U = 4; // where it kneels to light the pile (across from its middle)
const REST_U = 5; // and sits by it
const REACH = 3; // how far across it reaches to pick something up
const FUEL = setOf(['WOOD', 'COAL', 'PEAT', 'SAWDUST']);
const FIRE_SET = setOf(['FIRE']);

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
    carry: 0, // the element in its hands
    carryJob: 'wandering', // what it's doing with it
    rub: 0, // steps spent rubbing sticks
    breath: 0, // steps with its head under
    fleeDir: 1,
    shore: 0, // the way to the nearest shore, while swimming
    goalX: -1, goalY: -1, // where it's wandering to
  };
}

export const Humans = {
  stepHuman(e) {
    if (e.brain === null) e.brain = newBrain();
    const b = e.brain;
    this.keepWarm(e);
    const under = this.headUnder(e); // the liquid it's in, or 0
    if (under === 0) b.breath = 0;
    else if (++b.breath > BREATH && (b.breath - BREATH) % SUFFOCATE_EVERY === 0) this.drown(e, under);
    if (this.inLiquid(e, under)) {
      b.job = 'swimming';
      this.swimHuman(e, b, under);
      return;
    }
    if (b.job === 'swimming') b.job = 'wandering';
    if (this.fall(e)) return;
    if (--b.think <= 0) {
      b.think = THINK_EVERY;
      this.think(e, b);
    }
    this.act(e, b);
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

  // In a liquid: its head under, or liquid under its feet.
  inLiquid(e, under) {
    if (under !== 0) return true;
    const x = e.x + e.gx, y = e.y + e.gy;
    return this.inBounds(x, y) && DEFS[this.type[y * this.w + x]].state === LIQUID;
  },

  // Swim up for air, then towards the nearest shore, climbing out there.
  swimHuman(e, b, under) {
    if (++b.pace < 3) return;
    b.pace = 0;
    if (under !== 0 && this.moveBody(e, e.x - e.gx, e.y - e.gy, 0, e.facing, e.gx, e.gy)) return;
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
  // (`leap`), it carries on over a gap of up to 2 cells. Returns whether it
  // moved.
  stepAcross(e, dir, climb, leap) {
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
    return false;
  },

  // Walk (a step every `every` steps) towards (tx, ty) across the down
  // arrow. True once it's within `near` cells across and the target is
  // level with its body (from 9 cells above its feet to 2 below). No
  // closer for GIVE_UP steps: it gives up (giveUp).
  walkTo(e, b, tx, ty, near, every) {
    const a = (tx - e.x) * e.gy - (ty - e.y) * e.gx; // across: + is the way "right" points
    const v = (tx - e.x) * e.gx + (ty - e.y) * e.gy; // along: + is down
    if (Math.abs(a) <= near && v >= -9 && v <= 2) {
      b.stuck = 0;
      b.best = Infinity;
      return true;
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
    this.stepAcross(e, a > 0 ? 1 : a < 0 ? -1 : e.facing, CLIMB, every === RUN_EVERY);
    return false;
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
    this.chooseWork(e, b);
  },

  // Its camp's needs, in order: light a pile that's ready, keep the pile
  // fed, build the hut, then rest by the fire (or wander, before it's lit).
  // A job under way carries on.
  chooseWork(e, b) {
    if (b.camp === null) b.camp = this.joinOrMakeCamp(e);
    const camp = b.camp;
    if (camp === null) {
      b.job = 'wandering';
      return;
    }
    if (b.carry !== 0) {
      b.job = b.carryJob;
      return;
    }
    if ((b.job === 'gathering wood' && b.target >= 0 && FUEL[this.type[b.target]])
      || (b.job === 'fetching stone' && b.target >= 0 && SHAPED[this.type[b.target]] === 0 && this.type[b.target] !== 0)
      || (b.job === 'lighting the fire' && camp.lighter === e.id)) return;
    this.release(b);
    const fuel = this.pileCount(camp, FUEL), burning = this.pileCount(camp, FIRE_SET) > 0;
    if (burning) camp.lit = true;
    if (camp.lighter !== 0 && this.creatureById[camp.lighter]?.brain?.job !== 'lighting the fire') camp.lighter = 0;
    if (!burning && fuel >= PILE_LIGHT && camp.lighter === 0) {
      camp.lighter = e.id;
      b.rub = 0;
      b.job = 'lighting the fire';
      return;
    }
    if (fuel < (burning ? PILE_LOW : PILE_LIGHT)) {
      const t = this.findWanted(e, camp, FUEL, FUEL_R);
      if (t >= 0) {
        this.claim(b, camp, t);
        b.job = 'gathering wood';
        return;
      }
    }
    if (this.hutWork(e, b, camp)) return;
    b.job = camp.lit ? 'resting by the fire' : 'wandering';
  },

  // The hut.
  hutWork(e, b, camp) {
    return false;
  },

  act(e, b) {
    switch (b.job) {
      case 'fleeing':
        if (++b.pace >= RUN_EVERY) {
          b.pace = 0;
          this.stepAcross(e, b.fleeDir, CLIMB, true);
        }
        break;
      case 'gathering wood':
      case 'fetching stone': this.fetch(e, b); break;
      case 'carrying wood': this.carryToPile(e, b); break;
      case 'lighting the fire': this.lightFire(e, b); break;
      case 'resting by the fire': this.restByFire(e, b); break;
      default: this.wander(e, b);
    }
  },

  makeCamp(x, y, gx = this.gravity.downX, gy = this.gravity.downY) {
    const camp = {
      x, y, gx, gy, // the pile's middle (on the ground), and the way down there
      lit: false, // its fire has been lit (it may have burned out since)
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

  // The cell u across and v down from the camp's spot, in its frame; -1
  // outside the world.
  campCell(camp, u, v) {
    const x = camp.x + u * camp.gy + v * camp.gx, y = camp.y - u * camp.gx + v * camp.gy;
    return this.inBounds(x, y) ? y * this.w + x : -1;
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

  // Where the next piece of fuel goes: the lowest empty cell of the pile.
  pileSpace(camp) {
    for (let v = 0; v >= -2; v--) {
      for (const u of [0, -1, 1]) {
        const c = this.campCell(camp, u, v);
        if (c >= 0 && this.type[c] === 0) return c;
      }
    }
    return -1;
  },

  // The nearest cell to e within `radius` of the camp holding something in
  // `set`, open to the air, within reach of ground a human stands on, and
  // not in the pile or the hut, nor claimed or given up on. -1 if none.
  findWanted(e, camp, set, radius) {
    const { w, h, type } = this;
    const b = e.brain, hut = camp.hut;
    let best = -1, bd = Infinity;
    for (let y = Math.max(0, camp.y - radius); y <= Math.min(h - 1, camp.y + radius); y++) {
      for (let x = Math.max(0, camp.x - radius); x <= Math.min(w - 1, camp.x + radius); x++) {
        const i = y * w + x;
        if (!set[type[i]]) continue;
        const d = Math.abs(x - e.x) + Math.abs(y - e.y);
        if (d >= bd || camp.claims.has(i) || this.isBanned(b, i) || this.inPile(camp, x, y)) continue;
        if (hut !== null && hut.set.has(i)) continue;
        if (!this.openAt(x, y) || !this.nearGround(x, y, e.gx, e.gy)) continue;
        best = i;
        bd = d;
      }
    }
    return best;
  },

  openAt(x, y) {
    const { w, h, type } = this;
    const i = y * w + x;
    return (x + 1 < w && type[i + 1] === 0) || (x > 0 && type[i - 1] === 0)
      || (y + 1 < h && type[i + w] === 0) || (y > 0 && type[i - w] === 0);
  },

  // Is there a place within 3 cells of (x, y) a human could stand: empty,
  // with solid ground or powder under it?
  nearGround(x, y, gx, gy) {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!this.inBounds(nx, ny) || !this.inBounds(nx + gx, ny + gy)) continue;
        if (this.type[ny * this.w + nx] !== 0) continue;
        const g = this.type[(ny + gy) * this.w + nx + gx], s = DEFS[g].state;
        if (g !== 0 && (s === SOLID || s === POWDER)) return true;
      }
    }
    return false;
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

  // Walk to the target and pick it up.
  fetch(e, b) {
    const t = b.target;
    if (t < 0 || this.type[t] === 0 || SHAPED[this.type[t]]) {
      this.release(b);
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    if (!this.walkTo(e, b, t % this.w, (t / this.w) | 0, REACH, WALK_EVERY)) return;
    b.carry = this.type[t];
    b.carryJob = b.job === 'gathering wood' ? 'carrying wood' : 'building the hut';
    b.job = b.carryJob;
    this.clearCell(t);
    this.release(b);
  },

  // Take the fuel to the camp and put it on the pile (or wait by a full one).
  carryToPile(e, b) {
    const camp = b.camp;
    if (camp === null) {
      b.think = 0;
      return;
    }
    if (!this.walkTo(e, b, camp.x, camp.y, REACH + 1, WALK_EVERY)) return; // not into the flames
    const c = this.pileSpace(camp);
    if (c < 0) {
      this.pose(e, FRAME_SIT);
      return;
    }
    this.spawn(c, b.carry);
    b.carry = 0;
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
        if (c >= 0 && FUEL[this.type[c]] && this.ignite(c, c % this.w, (c / this.w) | 0)) return true;
      }
    }
    return false;
  },

  // Sit a couple of cells from the fire.
  restByFire(e, b) {
    const s = this.besideCamp(e, b.camp, REST_U);
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
    if (b.target >= 0) {
      b.banned.set(b.target, this.tick + BAN_FOR);
      this.release(b);
    }
    b.goalX = -1;
    b.stuck = 0;
    b.best = Infinity;
    if (b.carry === 0) b.job = 'wandering';
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
