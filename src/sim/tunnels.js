// Tunnels: humans' mine workings (humans.js). A tunnel is a straight run of
// standing spots (where a human's feet go) in one of 8 directions, at 45°
// steps; its inside is the 3x6 box a body covers at each spot. Loose cells
// that could fall in (a powder with the inside below it, or diagonally
// below) are swapped for wood first, then the spot is dug out from the top
// down. Every run is kept in one network for the whole world
// (world.tunnels): nodes at entrances, junctions, bends and ends, and
// straight edges between them, which humans path along, climbing shafts
// and stairs. Mixed into World.prototype.

import { DEFS, ID, State } from './elements.js';
import { SHAPED } from './creatures.js';
import { USEFUL } from './humans.js';

const { POWDER } = State;
const { WOOD } = ID;
const INSIDE = 1, LINED = 2; // world.tunnels.mask bits
const BOX_UP = 6; // a spot's box: 3 wide, 6 tall

export function initTunnels(world) {
  world.tunnels = {
    nodes: new Map(), // id -> { id, x, y, entrance, edges: Set of edge ids }
    edges: new Map(), // id -> { id, a, b, dx, dy, len }: node b is len steps of (dx, dy) from a
    next: 1,
    gx: 0, gy: 1, // the way down it was dug with
    mask: new Uint8Array(world.w * world.h), // INSIDE, LINED
  };
  world.tunnelBox = new Int32Array(BOX_UP * 3);
}

export const Tunnels = {
  // The cells of the box a body covers standing at (x, y), with down (gx,
  // gy), into `out`, from the bottom row up. False if it leaves the world.
  boxCells(x, y, gx, gy, out) {
    let n = 0;
    for (let up = 0; up < BOX_UP; up++) {
      for (let k = -1; k <= 1; k++) {
        const cx = x + k * gy - up * gx, cy = y - k * gx - up * gy;
        if (!this.inBounds(cx, cy)) return false;
        out[n++] = cy * this.w + cx;
      }
    }
    return true;
  },

  isInside(x, y) {
    return this.inBounds(x, y) && (this.tunnels.mask[y * this.w + x] & INSIDE) !== 0;
  },

  // The spot at (x, y) is (to be) part of a tunnel.
  markInside(x, y) {
    const { gx, gy, mask } = this.tunnels, box = this.tunnelBox;
    if (!this.boxCells(x, y, gx, gy, box)) return;
    for (const c of box) mask[c] |= INSIDE;
  },

  // The loose cells round the box at (x, y) that could fall into a tunnel:
  // powders with the inside directly below them, or diagonally below.
  looseRound(x, y) {
    const { gx, gy, mask } = this.tunnels;
    const out = [];
    for (let up = 1; up <= BOX_UP; up++) {
      for (let k = -2; k <= 2; k++) {
        if (up < BOX_UP && k >= -1 && k <= 1) continue; // the box itself
        const cx = x + k * gy - up * gx, cy = y - k * gx - up * gy;
        if (!this.inBounds(cx, cy)) continue;
        const c = cy * this.w + cx, t = this.type[c];
        if (t === 0 || SHAPED[t] || DEFS[t].state !== POWDER || (mask[c] & INSIDE) !== 0) continue;
        const dx = cx + gx, dy = cy + gy;
        if (this.isInside(dx, dy) || this.isInside(dx + gy, dy - gx) || this.isInside(dx - gy, dy + gx)) out.push(c);
      }
    }
    return out;
  },

  // Swap a loose cell for lining wood from its pack: false if it has none.
  lineCell(b, c) {
    if (!this.takeOut(b, WOOD)) return false;
    this.clearCell(c);
    this.spawn(c, WOOD);
    this.humanMade.set(c, WOOD);
    this.tunnels.mask[c] |= LINED;
    return true;
  },

  // One piece of work on the spot (x, y): line one loose cell round it, or
  // else dig out one cell of its box (the top row first; lining wood in the
  // way goes back in its pack, useful things too). 'work' while there's
  // more, 'clear' once the box is open, 'wood' when lining is needed and it
  // has none, 'blocked' for something it can't dig, 'wait' for a creature.
  workSpot(e, b, x, y) {
    const { gx, gy, mask } = this.tunnels, box = this.tunnelBox;
    if (!this.boxCells(x, y, gx, gy, box)) return 'blocked';
    this.markInside(x, y);
    const loose = this.looseRound(x, y);
    if (loose.length > 0) return this.lineCell(b, loose[0]) ? 'work' : 'wood';
    for (let n = box.length - 1; n >= 0; n--) {
      const c = box[n], t = this.type[c];
      if (t === 0 || this.roomForBody(e, c)) continue;
      if (SHAPED[t]) return 'wait';
      if (t === WOOD && (mask[c] & LINED) !== 0) this.stow(b, WOOD); // its own lining
      else if (!this.diggable(c, this.digLimit(b))) return 'blocked';
      else if (USEFUL[t]) this.stow(b, t);
      mask[c] &= ~LINED;
      this.clearCell(c);
      return 'work';
    }
    return 'clear';
  },
};
