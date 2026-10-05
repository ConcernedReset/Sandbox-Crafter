// Machines that work the air, mixed into World.prototype: fans, and pipe
// networks of pipes and pumps.
//
// A pipe network is a 4-connected group of Pipe and Pump cells, drawn one
// cell wide. Its openings are at its ends: the empty or gas cell beyond each
// pipe cell that has only one neighbour in the network. (Every cell touching
// a pump is that pump's intake.) Each frame the openings share their
// pressure (each moves PIPE_SHARE of the way to their average), so a pipe
// through a wall evens out the two sides. A powered pump moves PUMP_RATE of
// pressure a frame from the air beside it (its intake) out through the
// network's other openings; an unpowered pump is shut.
//
// An opening is remembered as two blocks: the block of the cell beside the
// pipe, and the next block out. The first can be sealed by the pipe itself
// (a pipe crossing a block seals it), so the second stands in for it then.
//
// Pipe cells list themselves (pipeCells) as the frame's update reaches them;
// the networks are rebuilt from that list every PIPE_REBUILD frames, or as
// soon as the number of pipe cells changes. With no pipes nothing runs.

import { DEFS, ID } from './elements.js';
import { CELL } from './air.js';
import { GASLIKE } from './lookups.js';

const { PIPE, PUMP } = ID;
const FAN_PUSH = 0.25;
const PIPE_SHARE = 0.2;
const PUMP_RATE = 4;
const PIPE_REBUILD = 10;
const DX4 = [1, -1, 0, 0];
const DY4 = [0, 0, 1, -1];

export const AirMachines = {
  // Push the air away from every open face of a fan. The push goes into the
  // next air block along, so the two sides of a thin fan don't cancel out.
  blowOut(x, y) {
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const u = this.type[ny * this.w + nx];
      if (u !== 0 && !DEFS[u].displaceable) continue;
      const a = this.air.at(x + DX4[k] * CELL, y + DY4[k] * CELL);
      if (!this.air.blocked[a]) this.air.addVelocity(a, DX4[k] * FAN_PUSH, DY4[k] * FAN_PUSH);
    }
  },

  // Find every network and its openings (see the top of this file).
  buildPipeNets(cells) {
    const { w, h, type, flood, floodMark } = this;
    const nets = [];
    const stamp = ++this.floodStamp;
    for (const start of cells) {
      if (floodMark[start] === stamp || (type[start] !== PIPE && type[start] !== PUMP)) continue;
      const open = new Map(); // block -> the next block out
      const pumps = [];
      let n = 0;
      floodMark[start] = stamp;
      flood[n++] = start;
      while (n > 0) {
        const c = flood[--n];
        const cx = c % w, cy = (c / w) | 0;
        const pump = type[c] === PUMP;
        const intake = pump ? new Map() : null;
        const gaps = []; // directions with room beside this cell
        let links = 0; // neighbours in the network
        for (let k = 0; k < 4; k++) {
          const nx = cx + DX4[k], ny = cy + DY4[k];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const m = ny * w + nx, u = type[m];
          if (u === PIPE || u === PUMP) {
            links++;
            if (floodMark[m] !== stamp) { floodMark[m] = stamp; flood[n++] = m; }
          } else if (u === 0 || GASLIKE[u]) {
            gaps.push(k);
          }
        }
        // A pump draws from every side; a pipe opens only at an end.
        if (!pump && links > 1) continue;
        for (const k of gaps) {
          const nx = cx + DX4[k], ny = cy + DY4[k];
          const fx = Math.min(w - 1, Math.max(0, cx + DX4[k] * CELL));
          const fy = Math.min(h - 1, Math.max(0, cy + DY4[k] * CELL));
          (intake ?? open).set(this.air.at(nx, ny), this.air.at(fx, fy));
        }
        if (intake && intake.size) pumps.push({ cell: c, intake: [...intake] });
      }
      // A block beside both a pump and a pipe end is the pump's.
      for (const q of pumps) for (const [a] of q.intake) open.delete(a);
      nets.push({ open: [...open], pumps });
    }
    this.pipeNets = nets;
  },

  // Share and pump the air through every pipe network. Called once a frame.
  stepPipes() {
    const cells = this.pipeCells;
    if (cells.length === 0) {
      this.pipeNets.length = 0;
      this.pipeCount = 0;
      return;
    }
    if (cells.length !== this.pipeCount || this.tick % PIPE_REBUILD === 0) this.buildPipeNets(cells);
    this.pipeCount = cells.length;
    cells.length = 0;
    const air = this.air, p = air.p, blocked = air.blocked;
    // The block an opening uses this frame: its own, or the next one out.
    const pick = ([a, b]) => (!blocked[a] ? a : !blocked[b] ? b : -1);
    for (const net of this.pipeNets) {
      const out = [];
      for (const o of net.open) { const a = pick(o); if (a >= 0) out.push(a); }
      if (out.length > 1) {
        let sum = 0;
        for (const a of out) sum += p[a];
        const mean = sum / out.length;
        for (const a of out) p[a] += (mean - p[a]) * PIPE_SHARE;
      }
      for (const pump of net.pumps) {
        if (this.type[pump.cell] !== PUMP || this.life[pump.cell] === 0 || out.length === 0) continue;
        const intake = [];
        for (const o of pump.intake) { const a = pick(o); if (a >= 0) intake.push(a); }
        if (intake.length === 0) continue;
        for (const a of intake) air.addPressure(a, -PUMP_RATE / intake.length);
        for (const a of out) air.addPressure(a, PUMP_RATE / out.length);
      }
    }
  },
};
