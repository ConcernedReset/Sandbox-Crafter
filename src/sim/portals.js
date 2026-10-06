// Portals: pairs of lines. Anything crossing one end comes out of the other
// at the same fraction of the way along, on the far side, still going, its
// direction turned by the angle between the two lines: a window between two
// places, always two-way. Each end is read in whichever direction makes the
// turn 90° or less, so parallel ends never flip anything.
//
// World.portalAt marks the cells of every end: ((slot + 1) << 17) |
// (end << 16) | position along the end. Portal cells are ordinary empty
// space as far as movement goes, except that a move stops on one; a
// particle sitting on one goes through when it's next updated
// (crossPortal). Flying particles go through as they enter the cell
// (portalProjectile). The air on each side of one end evens out with the air
// on the matching side of the other (stepPortalAir). Mixed into
// World.prototype; initPortals sets up the storage.

import { DEFS, State } from './elements.js';
import { CELL } from './air.js';

export const MAX_PORTALS = 32;
export const PORTAL_SHARE = 0.2;
const { SOLID, POWDER, LIQUID, GAS, ENERGY } = State;
// Pairs of hues for the two ends: blue and orange, green and magenta, ...
const HUES = [[210, 30], [120, 300], [55, 235], [170, 350], [270, 90], [0, 180], [85, 265], [145, 325]];
export const portalHues = (slot) => {
  const [a, b] = HUES[slot % HUES.length];
  const shift = Math.floor(slot / HUES.length) * 15;
  return [(a + shift) % 360, (b + shift) % 360];
};

export function initPortals(world) {
  world.portals = []; // slot → { a, b, cos, sin } or null; b is null until drawn
  world.portalAt = new Int32Array(world.w * world.h);
  world.portalCells = 0;
}

// The cells of a straight line from (x0, y0) to (x1, y1), 4-connected so
// nothing slips between them diagonally.
function lineCells(x0, y0, x1, y1) {
  const out = [[x0, y0]];
  const dx = x1 - x0, dy = y1 - y0;
  const n = Math.max(Math.abs(dx), Math.abs(dy));
  let px = x0, py = y0;
  for (let s = 1; s <= n; s++) {
    const x = Math.round(x0 + (dx * s) / n), y = Math.round(y0 + (dy * s) / n);
    if (x !== px && y !== py) out.push([x, py]); // fill the corner
    out.push([x, y]);
    px = x;
    py = y;
  }
  return out;
}

// An end: its cells, its unit tangent (first cell to last) and normal.
function makeEnd(cells, w) {
  const xa = cells[0] % w, ya = (cells[0] / w) | 0;
  const last = cells[cells.length - 1];
  const xb = last % w, yb = (last / w) | 0;
  const len = Math.hypot(xb - xa, yb - ya) || 1;
  const tx = cells.length > 1 ? (xb - xa) / len : 1, ty = cells.length > 1 ? (yb - ya) / len : 0;
  return { cells, tx, ty, nx: -ty, ny: tx };
}

const sign = (v) => (v < 0 ? -1 : 1);

export const Portals = {
  // Draw an end from (x0, y0) to (x1, y1). It's the second end of the pair
  // waiting for one, if there is one; otherwise the first end of a new pair.
  // Returns { slot, end }, 'full' when there are MAX_PORTALS pairs already,
  // or null when no cell of the line is free.
  addPortal(x0, y0, x1, y1) {
    const { w, h, portalAt, portals } = this;
    const open = portals.findIndex((p) => p !== null && p.b === null);
    let slot = open;
    if (slot < 0) {
      slot = portals.indexOf(null);
      if (slot < 0) slot = portals.length;
      if (slot >= MAX_PORTALS) return 'full';
    }
    const cells = [];
    for (const [x, y] of lineCells(x0, y0, x1, y1)) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x;
      if (portalAt[i] === 0 && !cells.includes(i)) cells.push(i);
    }
    if (cells.length === 0) return null;
    const end = open < 0 ? 0 : 1;
    const e = makeEnd(cells, w);
    if (end === 0) {
      portals[slot] = { a: e, b: null, cos: 1, sin: 0 };
    } else {
      const p = portals[slot];
      p.b = e;
      // Read b the way that turns things least.
      let ang = Math.atan2(e.ty, e.tx) - Math.atan2(p.a.ty, p.a.tx);
      ang = Math.atan2(Math.sin(ang), Math.cos(ang));
      if (Math.abs(ang) > Math.PI / 2 + 1e-9) {
        e.cells.reverse();
        e.tx = -e.tx; e.ty = -e.ty; e.nx = -e.nx; e.ny = -e.ny;
        ang = Math.atan2(Math.sin(ang + Math.PI), Math.cos(ang + Math.PI));
      }
      p.cos = Math.cos(ang);
      p.sin = Math.sin(ang);
    }
    e.cells.forEach((i, pos) => { portalAt[i] = ((slot + 1) << 17) | (end << 16) | pos; });
    this.portalCells += e.cells.length;
    return { slot, end };
  },

  // Remove the pair that cell i belongs to. Returns whether there was one.
  removePortalAt(i) {
    const v = this.portalAt[i];
    if (v === 0) return false;
    const slot = (v >> 17) - 1, p = this.portals[slot];
    for (const e of [p.a, p.b]) {
      if (e === null) continue;
      for (const c of e.cells) this.portalAt[c] = 0;
      this.portalCells -= e.cells.length;
    }
    this.portals[slot] = null;
    return true;
  },

  clearPortals() {
    this.portals.length = 0;
    this.portalAt.fill(0);
    this.portalCells = 0;
  },

  // Which pair and end cell i is on, for the inspect line.
  portalInfo(i) {
    const v = this.portalAt[i];
    if (v === 0) return null;
    const slot = (v >> 17) - 1;
    return { slot, end: (v >> 16) & 1, paired: this.portals[slot].b !== null };
  },

  // From portal cell i, going to the `side` (+1 or -1) of its end: the
  // cell just past the matching place on the other end, and the turn
  // (cos, sin) to apply. null when the pair isn't complete.
  portalExit(i, side) {
    const v = this.portalAt[i];
    const p = this.portals[(v >> 17) - 1];
    if (p.b === null) return null;
    const endNo = (v >> 16) & 1, pos = v & 0xffff;
    const from = endNo === 0 ? p.a : p.b, to = endNo === 0 ? p.b : p.a;
    const k = from.cells.length > 1
      ? Math.round((pos * (to.cells.length - 1)) / (from.cells.length - 1)) : 0;
    const base = to.cells[k];
    // One cell out, along the 4-neighbour closest to the normal on that side.
    const nx = to.nx * side, ny = to.ny * side;
    const ox = Math.abs(nx) >= Math.abs(ny) ? sign(nx) : 0, oy = ox === 0 ? sign(ny) : 0;
    const j = this.cellAt((base % this.w) + ox, ((base / this.w) | 0) + oy);
    // Going from a to b turns by (cos, sin); from b to a by the opposite.
    return { j, cos: p.cos, sin: endNo === 0 ? p.sin : -p.sin };
  },

  // A particle sitting on a portal cell goes through, if it moves at all.
  // Returns true when it went (or is waiting on the line for room).
  crossPortal(i, x, y, t) {
    const d = DEFS[t];
    const moves = d.state === POWDER || d.state === LIQUID || d.state === GAS
      || (d.state === ENERGY && !d.fixed) || (d.state === SOLID && (this.loose[i] || d.cat === 'creature'));
    if (!moves) return false;
    const v = this.portalAt[i];
    const p = this.portals[(v >> 17) - 1];
    if (p.b === null) return false;
    const e = ((v >> 16) & 1) === 0 ? p.a : p.b;
    // Which side it's going: its velocity across the end, or its fall (a
    // gas rises), or either.
    let s = this.vx[i] * e.nx + this.vy[i] * e.ny;
    if (Math.abs(s) < 0.05) {
      const g = this.gravity, a = this.air.at(x, y);
      const down = (g.ux[a] * e.nx + g.uy[a] * e.ny) * (d.state === GAS || d.state === ENERGY ? -1 : 1);
      s = Math.abs(down) > 0.05 ? down : this.rand() - 0.5;
    }
    const out = this.portalExit(i, sign(s));
    if (out === null) return false;
    const { j, cos, sin } = out;
    if (j < 0 || this.portalAt[j] !== 0 || !this.canEnter(d, j, 0)) return true; // waits
    this.swap(i, j);
    const vx = this.vx[j], vy = this.vy[j];
    this.vx[j] = vx * cos - vy * sin;
    this.vy[j] = vx * sin + vy * cos;
    return true;
  },

  // A flying particle k entering portal cell j: out of the other end,
  // turned. Returns true if it went through.
  portalProjectile(k, j) {
    const v = this.portalAt[j];
    const p = this.portals[(v >> 17) - 1];
    if (p.b === null) return false;
    const e = ((v >> 16) & 1) === 0 ? p.a : p.b;
    const vx = this.pvx[k], vy = this.pvy[k];
    const out = this.portalExit(j, sign(vx * e.nx + vy * e.ny));
    if (out === null || out.j < 0) return false;
    const { cos, sin } = out;
    this.px[k] = (out.j % this.w) + 0.5;
    this.py[k] = ((out.j / this.w) | 0) + 0.5;
    this.pvx[k] = vx * cos - vy * sin;
    this.pvy[k] = vx * sin + vy * cos;
    return true;
  },

  // Every CELL cells along each pair, the air two cells past one end on
  // its −n side evens out with the air two cells past the other on its +n
  // side, and the other way round: pressure, and air heat (moving heat
  // moves no pressure, so tPressed moves with it).
  stepPortalAir() {
    const { air, w, h } = this;
    const { p, t, tPressed, blocked } = air;
    const share = (a, b) => {
      if (a < 0 || b < 0 || a === b || blocked[a] || blocked[b]) return;
      const dp = (p[b] - p[a]) * PORTAL_SHARE;
      p[a] += dp;
      p[b] -= dp;
      if (air.heat) {
        const dt = (t[b] - t[a]) * PORTAL_SHARE;
        t[a] += dt; t[b] -= dt;
        tPressed[a] += dt; tPressed[b] -= dt;
      }
    };
    const blockAt = (c, ox, oy) => {
      const x = Math.round((c % w) + ox), y = Math.round(((c / w) | 0) + oy);
      return x < 0 || y < 0 || x >= w || y >= h ? -1 : air.at(x, y);
    };
    for (const pr of this.portals) {
      if (pr === null || pr.b === null) continue;
      const { a, b } = pr;
      for (let k = 0; k < a.cells.length; k += CELL) {
        const kb = a.cells.length > 1 ? Math.round((k * (b.cells.length - 1)) / (a.cells.length - 1)) : 0;
        const ca = a.cells[k], cb = b.cells[kb];
        share(blockAt(ca, -2 * a.nx, -2 * a.ny), blockAt(cb, 2 * b.nx, 2 * b.ny));
        share(blockAt(cb, -2 * b.nx, -2 * b.ny), blockAt(ca, 2 * a.nx, 2 * a.ny));
      }
    }
  },
};
