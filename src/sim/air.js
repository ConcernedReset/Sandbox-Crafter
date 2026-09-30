// Coarse air simulation, modelled on The Powder Toy.
//
// The world is divided into CELL x CELL blocks, each holding a pressure value.
// Velocities live on the faces between blocks (a staggered grid): vx[i] is
// the flow from block i to the block on its right, vy[i] the flow to the
// block below. Each step:
//   1. pressure changes by how much air flows in or out (divergence)
//   2. velocity is pushed from high pressure towards low pressure
// A ring of blocks around the edge is held at zero pressure, so air can
// escape the map, and blocked blocks (Wall, or a line of strong solid across
// the block) stop flow entirely so sealed boxes hold pressure.
//
// With convection on (`heat`), each block also has an air temperature.
// Particles trade heat with it (world.js, warmAir); air that warms swells,
// raising its pressure, and air that cools shrinks; warm air is pushed
// against gravity; the flow carries the heat along; and the air slowly gives
// its heat back to the room. The border ring stays at room temperature.

import { AMBIENT } from './constants.js';

export const CELL = 4;

// Convection. A degree lost by a particle warms its block's air by
// AIR_SHARE degrees (air holds little heat), and each degree the air gains
// raises its pressure by EXPAND. Warm air is pushed against gravity by
// BUOYANCY per degree per g per frame, and gives AIR_TEMP_LOSS of its excess
// heat back to the room a frame. HEAT_SMOOTH blurs it a little, like the
// pressure.
export const AIR_SHARE = 3;
export const EXPAND = 0.004;
const BUOYANCY = 0.00004;
const AIR_TEMP_LOSS = 0.004;
const HEAT_SMOOTH = 0.1;

const PRESSURE_STEP = 0.3;
const VELOCITY_STEP = 0.4;
const PRESSURE_LOSS = 0.9995;
const VELOCITY_LOSS = 0.995;
const SMOOTHING = 0.15;
const MAX_PRESSURE = 256;

export class Air {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.W = cols + 2; // +2 for the zero-pressure border ring
    this.H = rows + 2;
    const n = this.W * this.H;
    this.p = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.blocked = new Uint8Array(n);
    this.next = new Uint8Array(n); // blocked map being built by the current frame's scan
    this.solid = new Uint8Array(n); // airtight particles counted in each block this frame
    this.scratch = new Float32Array(n);
    this.t = new Float32Array(n).fill(AMBIENT); // air temperature, with convection on
    this.heat = false;
  }

  // Index of the air block that contains world cell (x, y).
  at(x, y) {
    return ((y / CELL) | 0) * this.W + this.W + ((x / CELL) | 0) + 1;
  }

  // Air velocity at the centre of block i.
  cvx(i) { return (this.vx[i - 1] + this.vx[i]) * 0.5; }
  cvy(i) { return (this.vy[i - this.W] + this.vy[i]) * 0.5; }

  addPressure(i, amount) {
    if (this.blocked[i]) return;
    const v = this.p[i] + amount;
    this.p[i] = v > MAX_PRESSURE ? MAX_PRESSURE : v < -MAX_PRESSURE ? -MAX_PRESSURE : v;
  }

  addVelocity(i, dx, dy) {
    this.vx[i] += dx;
    this.vx[i - 1] += dx;
    this.vy[i] += dy;
    this.vy[i - this.W] += dy;
  }

  clear() {
    this.p.fill(0);
    this.vx.fill(0);
    this.vy.fill(0);
    this.t.fill(AMBIENT);
  }

  // `gravity` (gravity.js) is only read with convection on.
  step(gravity) {
    const { W, H, p, vx, vy, blocked, scratch } = this;

    // 1. Pressure from divergence of the face velocities.
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        if (blocked[i]) { p[i] = 0; continue; }
        const div = vx[i] - vx[i - 1] + vy[i] - vy[i - W];
        let v = p[i] * PRESSURE_LOSS - div * PRESSURE_STEP;
        if (v > MAX_PRESSURE) v = MAX_PRESSURE; else if (v < -MAX_PRESSURE) v = -MAX_PRESSURE;
        p[i] = v;
      }
    }

    // 2. Light smoothing to keep the grid from ringing.
    scratch.set(p);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        if (blocked[i]) continue;
        let sum = 0, n = 0;
        if (!blocked[i - 1]) { sum += scratch[i - 1]; n++; }
        if (!blocked[i + 1]) { sum += scratch[i + 1]; n++; }
        if (!blocked[i - W]) { sum += scratch[i - W]; n++; }
        if (!blocked[i + W]) { sum += scratch[i + W]; n++; }
        if (n) p[i] += (sum / n - scratch[i]) * SMOOTHING;
      }
    }

    // 3. Velocity from the pressure gradient across each face.
    for (let y = 0; y < H; y++) {
      for (let x = 0, i = y * W; x < W; x++, i++) {
        if (x < W - 1) {
          if (blocked[i] || blocked[i + 1]) vx[i] = 0;
          else vx[i] = vx[i] * VELOCITY_LOSS + (p[i] - p[i + 1]) * VELOCITY_STEP;
        }
        if (y < H - 1) {
          if (blocked[i] || blocked[i + W]) vy[i] = 0;
          else vy[i] = vy[i] * VELOCITY_LOSS + (p[i] - p[i + W]) * VELOCITY_STEP;
        }
      }
    }

    if (this.heat) this.stepHeat(gravity.gx, gravity.gy);
  }

  // Convection: buoyancy, then the flow carrying the heat, then blurring and
  // cooling. (gx, gy) is the pull of gravity per block, in g.
  stepHeat(gx, gy) {
    const { W, H, t, vx, vy, p, blocked, scratch } = this;

    // 1. Warm air is pushed against gravity; cold air sinks with it.
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        if (blocked[i]) continue;
        if (!blocked[i + 1]) {
          const e = (t[i] + t[i + 1]) * 0.5 - AMBIENT;
          vx[i] -= BUOYANCY * e * (gx[i] + gx[i + 1]) * 0.5;
        }
        if (!blocked[i + W]) {
          const e = (t[i] + t[i + W]) * 0.5 - AMBIENT;
          vy[i] -= BUOYANCY * e * (gy[i] + gy[i + W]) * 0.5;
        }
      }
    }

    // 2. The flow carries the heat: each block takes the temperature of the
    // air that arrives in it, traced back along the flow. Sealed blocks
    // neither give nor take any.
    scratch.set(t);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        if (blocked[i]) continue;
        let sx = x - this.cvx(i) / CELL, sy = y - this.cvy(i) / CELL;
        if (sx < 0) sx = 0; else if (sx > W - 1) sx = W - 1;
        if (sy < 0) sy = 0; else if (sy > H - 1) sy = H - 1;
        const x0 = sx | 0, y0 = sy | 0;
        const x1 = x0 < W - 1 ? x0 + 1 : x0, y1 = y0 < H - 1 ? y0 + 1 : y0;
        const fx = sx - x0, fy = sy - y0;
        const own = scratch[i];
        const a = y0 * W + x0, b = y0 * W + x1, c = y1 * W + x0, d = y1 * W + x1;
        const ta = blocked[a] ? own : scratch[a], tb = blocked[b] ? own : scratch[b];
        const tc = blocked[c] ? own : scratch[c], td = blocked[d] ? own : scratch[d];
        t[i] = (ta * (1 - fx) + tb * fx) * (1 - fy) + (tc * (1 - fx) + td * fx) * fy;
      }
    }

    // 3. A little blurring, and 4. the room soaks up the heat; air that
    // cools shrinks.
    scratch.set(t);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        if (blocked[i]) continue;
        let sum = 0, n = 0;
        if (!blocked[i - 1]) { sum += scratch[i - 1]; n++; }
        if (!blocked[i + 1]) { sum += scratch[i + 1]; n++; }
        if (!blocked[i - W]) { sum += scratch[i - W]; n++; }
        if (!blocked[i + W]) { sum += scratch[i + W]; n++; }
        let v = scratch[i];
        if (n) v += (sum / n - v) * HEAT_SMOOTH;
        const d = (AMBIENT - v) * AIR_TEMP_LOSS;
        t[i] = v + d;
        p[i] += d * EXPAND;
      }
    }
  }
}
