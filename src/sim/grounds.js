// Grounds: once its hut is up, a camp levels the ground round it (humans.js).
// The lawn is the LAWN_R columns either side of the hut; its level is the
// hut's ground row. One human at a time (camp.flattener), with a pickaxe
// and before its gun, digs away what rises above the level (up to LAWN_UP
// high) and fills the dips below it (up to LAWN_DOWN deep) with
// scaffolding, working out from the hut a column at a time. Nobody opens a
// mine in the lawn, nor digs for a deposit just under it. Mixed into
// World.prototype.

import { DEFS, ID, State, SPECIAL } from './elements.js';
import { SHAPED } from './creatures.js';
import { USEFUL, HUT_W, WALK_EVERY, DIG_EVERY, HELD_PICKAXE, WOOD_ONLY, FUEL_R } from './humans.js';

const { SOLID, LIQUID, GAS } = State;
const { WOOD, SCAFFOLDING } = ID;
export const LAWN_R = 10; // columns either side of the hut that are levelled
const LAWN_UP = 10; // what rises this high above the level is dug away
const LAWN_DOWN = 4; // and dips are filled this deep (a deeper one is bridged)
export const LAWN_DEEP = 8; // no deposit is mined nearer the lawn's surface than this
const PIT_U = 3; // the fire pit's columns either side of the pile, left alone
const LAWN_REACH = 3; // how far across it works from where it stands
// Growth it clears away at once: plants, leaves, flowers, moss.
const CLEARABLE = Uint8Array.from(DEFS, (d) => (d.state === SOLID && d.cat === 'life' && d.strength > 0 && d.strength <= 6 ? 1 : 0));

export const Grounds = {
  // The lawn's columns (u0 .. u1, in the camp's frame) and the row of its
  // ground, once the camp has a hut planned; or null.
  lawn(camp) {
    const hut = camp.hut;
    if (hut === null) return null;
    return { u0: hut.u0 - LAWN_R, u1: hut.u0 + HUT_W - 1 + LAWN_R, level: hut.floor + 1 };
  },

  // Is (x, y) in some camp's lawn, no deeper than `deep` under its level?
  inLawn(x, y, deep = LAWN_DEEP) {
    for (const camp of this.camps) {
      const l = this.lawn(camp);
      if (l === null) continue;
      const u = (x - camp.x) * camp.gy - (y - camp.y) * camp.gx;
      const v = (x - camp.x) * camp.gx + (y - camp.y) * camp.gy;
      if (u >= l.u0 && u <= l.u1 && v < l.level + deep) return true;
    }
    return false;
  },

  // The work left in column u of the lawn, into `out` (cells, in the order
  // to do them): what rises above the level from the top down, then the
  // dip below it from the bottom up. Each is [cell, fill].
  lawnColumn(camp, l, u, limit, b, out) {
    out.length = 0;
    for (let v = l.level - LAWN_UP; v < l.level; v++) {
      const c = this.campCell(camp, u, v);
      if (c < 0 || !this.builtAt(c) || this.isBanned(b, c)) continue;
      if (camp.hut.set.has(c) || this.isInside(c % this.w, (c / this.w) | 0)) continue;
      if (CLEARABLE[this.type[c]] || this.diggable(c, limit)) out.push([c, false]);
    }
    // The dip: the open cells from the level down, until the ground.
    let bottom = l.level;
    while (bottom < l.level + LAWN_DOWN) {
      const c = this.campCell(camp, u, bottom);
      if (c < 0 || this.builtAt(c) || this.isInside(c % this.w, (c / this.w) | 0)) break;
      const t = this.type[c];
      if (t !== 0 && DEFS[t].state === LIQUID) return; // a pond: left alone
      bottom++;
    }
    for (let v = bottom - 1; v >= l.level; v--) {
      const c = this.campCell(camp, u, v), t = this.type[c];
      if (this.isBanned(b, c)) continue;
      if (t === 0 || (!SHAPED[t] && DEFS[t].state === GAS)) out.push([c, true]); // not under a creature
    }
  },

  // The next cell of the lawn for e to work on: the column nearest the hut
  // with work left, on e's side first. { c, fill } or null when it's level.
  lawnWork(e, b, camp) {
    const l = this.lawn(camp);
    if (l === null) return null;
    const hut = camp.hut, out = this.lawnCells ??= [];
    const eu = (e.x - camp.x) * camp.gy - (e.y - camp.y) * camp.gx;
    const mid = hut.u0 + (HUT_W >> 1), limit = this.digLimit(b);
    for (const s of eu >= mid ? [1, -1] : [-1, 1]) {
      for (let k = 0; k < LAWN_R; k++) {
        const u = s > 0 ? hut.u0 + HUT_W + k : hut.u0 - 1 - k;
        if (u >= -PIT_U && u <= PIT_U) break; // the fire pit: no further that way
        this.lawnColumn(camp, l, u, limit, b, out);
        if (out.length > 0) return { c: out[0][0], fill: out[0][1] };
      }
    }
    return null;
  },

  // Levelling the lawn, after a pickaxe and before a gun: one human at a
  // time. Scaffolding for the dips is cut from wood it fetches. True if
  // that gave e a job; once there's nothing left to do, the camp is flat.
  flattenWork(e, b, camp) {
    if (camp.flat || camp.hut === null || !camp.hut.done || b.tool === 0) return false;
    if (camp.flattener !== 0 && camp.flattener !== e.id) {
      const o = this.creatureById[camp.flattener];
      const job = o?.brain?.job;
      if (o && o.brain.camp === camp && (job === 'flattening the camp' || job === 'gathering wood')) return false;
    }
    const w = this.lawnWork(e, b, camp);
    if (w === null) {
      camp.flat = true;
      camp.flattener = 0;
      return false;
    }
    camp.flattener = e.id;
    if (w.fill && this.liningInHand(b) === 0) {
      if (this.gather(e, b, camp, WOOD_ONLY, FUEL_R, 'gathering wood')) return true;
      camp.flattener = 0; // no wood to be had: later
      return false;
    }
    this.claim(b, camp, w.c);
    b.job = 'flattening the camp';
    if (!w.fill) b.held = HELD_PICKAXE;
    return true;
  },

  // Walk within reach of the cell, then dig it out or fill it, a cell every
  // DIG_EVERY steps; then on to the next.
  flatten(e, b) {
    const camp = b.camp, c = b.target;
    if (camp === null || c < 0 || camp.flattener !== e.id) {
      this.release(b);
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    if (!this.walkTo(e, b, c % this.w, (c / this.w) | 0, LAWN_REACH, WALK_EVERY)) return;
    if (++b.pace < DIG_EVERY) return;
    b.pace = 0;
    this.pose(e, 0);
    // The lawn may have changed on the way (sand slid in, say): the work
    // left, first.
    const w = this.lawnWork(e, b, camp);
    if (w === null || w.c !== c) {
      this.release(b);
      if (w !== null && !(w.fill && this.liningInHand(b) === 0)) this.claim(b, camp, w.c);
      else {
        b.job = 'wandering';
        b.think = 0;
      }
      return;
    }
    const t = this.type[c];
    if (w.fill) {
      if (this.has(b, SCAFFOLDING) === 0) this.cutScaffolding(b);
      if (this.takeOut(b, SCAFFOLDING)) {
        this.putDown(c, SCAFFOLDING);
        this.record(SCAFFOLDING, SPECIAL['human-scaffolding']);
      }
    } else if (CLEARABLE[t] || this.diggable(c, this.digLimit(b))) {
      if (USEFUL[t]) this.stow(b, t);
      this.clearCell(c);
      if (t === WOOD) this.fell(c % this.w, (c / this.w) | 0);
      if (b.tool !== 0) b.held = HELD_PICKAXE;
    }
    this.release(b);
    // The next cell, straight on (or, needing wood, back to choosing).
    const next = this.lawnWork(e, b, camp);
    if (next !== null && !(next.fill && this.liningInHand(b) === 0)) this.claim(b, camp, next.c);
    else {
      b.job = 'wandering';
      b.think = 0;
    }
  },
};
