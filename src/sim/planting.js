// Planting: a camp whose trees are running out plants more (humans.js runs
// the humans; trees.js grows the trees).
//
// Every PLANT_EVERY steps (from its chores, war.js) a camp with its fire
// lit counts the tree wood within FUEL_R of its fire (not what humans put
// there: the pile, the hut, tunnel lining). Under WOOD_LOW, with fewer than
// SAPLINGS_MAX saplings growing there already, one of its humans with
// nothing else to do becomes its planter (camp.planter): it walks out to up
// to PLANT_N spots (plantSpots: soil with open sky over it, past the lawn,
// not over a tunnel, PLANT_GAP from any tree and from each other), kneels
// beside each a while and plants a sapling there, free. The saplings grow
// into trees like any others, and their wood is anyone's to gather.
//
// Mixed into World.prototype.

import { DEFS, ID, State } from './elements.js';
import { FUEL_R, WALK_EVERY, FRAME_KNEEL } from './humans.js';

const { GAS } = State;
const { SAPLING, WOOD, DIRT, GRASS, MUD, SAND } = ID;
const SOIL = new Set([DIRT, GRASS, MUD, SAND]); // (what a sapling takes root in: trees.js)
export const PLANT_EVERY = 600; // steps between a camp's counts of its trees
export const WOOD_LOW = 60; // tree wood near the camp (about two trees) under which it plants more
export const SAPLINGS_MAX = 4; // but not with this many saplings growing near it already
export const PLANT_N = 3; // saplings a planter plants on one trip
export const PLANT_GAP = 12; // cells across kept between a new sapling and any tree, sapling or other spot
const PLANT_FROM = 8; // spots from this far past the lawn's edge (or the fire, with no lawn)
export const PLANT_R = 80; // out to this far across from the fire
const SKY = 16; // rows of open sky a spot needs over it (room for a trunk)
const TREE_UP = 30; // how high over a spot it looks for trees in the way
const NO_TUNNEL = 8; // nor any tunnel this near under it
const STAND = 3; // where the planter kneels: this far nearer the camp than the spot
export const PLANT_FOR = 60; // steps kneeling to plant a sapling

export const Planting = {
  // Once a second (war.js's chores): let go of a planter that's stopped
  // planting; every PLANT_EVERY, if the camp's trees are running out, set
  // an idle human (nearest the fire) planting.
  plantChores(camp) {
    if (camp.planter !== 0) {
      const o = this.creatureById[camp.planter];
      if (o && o.brain !== null && o.brain.camp === camp && o.brain.job === 'planting saplings') return;
      camp.planter = 0;
    }
    if (!camp.lit || this.tick < camp.plantAt) return;
    camp.plantAt = this.tick + PLANT_EVERY;
    const { wood, saplings } = this.treesNear(camp);
    if (wood >= WOOD_LOW || saplings >= SAPLINGS_MAX) return;
    let best = null, bd = Infinity;
    for (const id of camp.members) {
      const o = this.creatureById[id];
      if (!o || o.brain === null || o.grow >= 0 || id === camp.engineer) continue;
      const b = o.brain;
      if ((b.job !== 'resting by the fire' && b.job !== 'wandering') || b.raid !== null || (camp.sap !== null && camp.sap.id === id)) continue;
      const d = Math.max(Math.abs(o.x - camp.x), Math.abs(o.y - camp.y));
      if (d < bd) {
        best = o;
        bd = d;
      }
    }
    if (best === null) return;
    const spots = this.plantSpots(camp, Math.min(PLANT_N, SAPLINGS_MAX - saplings));
    if (spots.length === 0) return;
    const b = best.brain;
    this.release(b);
    b.plant = spots;
    b.pace = 0;
    b.path = null;
    b.stuck = 0;
    b.job = 'planting saplings';
    camp.planter = best.id;
  },

  // The tree wood (not put there by humans) and the saplings within FUEL_R
  // of the camp's fire: { wood, saplings }.
  treesNear(camp) {
    const { w, h, type } = this;
    let wood = 0, saplings = 0;
    for (let y = Math.max(0, camp.y - FUEL_R); y <= Math.min(h - 1, camp.y + FUEL_R); y++) {
      for (let x = Math.max(0, camp.x - FUEL_R); x <= Math.min(w - 1, camp.x + FUEL_R); x++) {
        const i = y * w + x, t = type[i];
        if (t === SAPLING) saplings++;
        else if (t === WOOD && !this.madeByHuman(i)) wood++;
      }
    }
    return { wood, saplings };
  },

  // Up to n places to plant a sapling, nearest the camp first, either side:
  // soil on top, nothing in the cell over it, SKY rows of open air over
  // that, outside every lawn, no tunnel within NO_TUNNEL under it, and
  // PLANT_GAP across from any tree (wood nobody put there) or sapling and
  // from each other. [{ u, x, y (where the sapling goes), sx, sy (where the
  // planter kneels) }].
  plantSpots(camp, n) {
    const { w, type } = this, lawn = this.lawn(camp), out = [];
    const open = (c) => c >= 0 && (type[c] === 0 || DEFS[type[c]].state === GAS);
    const from = (s) => (lawn === null ? 0 : s > 0 ? lawn.u1 : -lawn.u0) + PLANT_FROM;
    for (let d = 0; out.length < n && d <= PLANT_R; d++) {
      for (const s of [1, -1]) {
        const u = s * (from(s) + d);
        if (out.length >= n || Math.abs(u) > PLANT_R || out.some((p) => Math.abs(p.u - u) < PLANT_GAP)) continue;
        const g = this.groundAt(camp, u);
        if (g === null) continue;
        const c = this.campCell(camp, u, g), a = this.campCell(camp, u, g - 1);
        if (c < 0 || a < 0 || !SOIL.has(type[c]) || this.madeByHuman(c) || type[a] !== 0) continue;
        let ok = true;
        for (let v = g - 2; v >= g - SKY && ok; v--) ok = open(this.campCell(camp, u, v));
        for (let v = g; v <= g + NO_TUNNEL && ok; v++) {
          const k = this.campCell(camp, u, v);
          ok = k < 0 || !this.isInside(k % w, (k / w) | 0);
        }
        const x = a % w, y = (a / w) | 0;
        if (!ok || this.inLawn(x, y) || this.treeNear(camp, u, g)) continue;
        const su = u - s * STAND, sg = this.groundAt(camp, su);
        const st = this.campCell(camp, su, (sg ?? g) - 1);
        if (st < 0) continue;
        out.push({ u, x, y, sx: st % w, sy: (st / w) | 0 });
      }
    }
    return out;
  },

  // Is there a tree (wood nobody put there) or a sapling within PLANT_GAP
  // across of column u, from ground g up TREE_UP?
  treeNear(camp, u, g) {
    for (let du = -PLANT_GAP + 1; du < PLANT_GAP; du++) {
      for (let v = g - 1; v >= g - TREE_UP; v--) {
        const c = this.campCell(camp, u + du, v);
        if (c < 0) continue;
        const t = this.type[c];
        if (t === SAPLING || (t === WOOD && !this.madeByHuman(c))) return true;
      }
    }
    return false;
  },

  // The planter's job: to each spot in turn, kneel beside it PLANT_FOR
  // steps and plant a sapling; a spot it can't get to, or that's no good
  // any more, it skips. Done, it's free again.
  plantWork(e, b) {
    const camp = b.camp;
    if (camp === null || b.plant === null || b.plant.length === 0 || camp.planter !== e.id) {
      if (camp !== null && camp.planter === e.id) camp.planter = 0;
      b.plant = null;
      this.pose(e, 0);
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    const p = b.plant[0], c = p.y * this.w + p.x, below = (p.y + e.gy) * this.w + p.x + e.gx;
    if (this.type[c] !== 0 || !SOIL.has(this.type[below])) {
      b.plant.shift();
      b.pace = 0;
      return;
    }
    if (!this.walkTo(e, b, p.sx, p.sy, 1, WALK_EVERY)) {
      if (b.job === 'wandering') { // it gave up getting there: on to the next
        b.plant.shift();
        b.pace = 0;
        b.job = 'planting saplings';
      }
      return;
    }
    const a = (p.x - e.x) * e.gy - (p.y - e.y) * e.gx, face = a > 0 ? 1 : a < 0 ? -1 : e.facing;
    if (e.frame !== FRAME_KNEEL || e.facing !== face) this.moveBody(e, e.x, e.y, FRAME_KNEEL, face, e.gx, e.gy);
    if (++b.pace < PLANT_FOR) return;
    b.pace = 0;
    this.spawn(c, SAPLING); // (not put down: the tree it grows into is anyone's)
    camp.planted++;
    b.plant.shift();
  },
};
