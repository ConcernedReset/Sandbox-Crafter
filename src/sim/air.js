// Coarse air simulation, modelled on The Powder Toy.
//
// The world is divided into CELL x CELL blocks, each holding a pressure value.
// Velocities live on the faces between blocks (a staggered grid): vx[i] is
// the flow from block i to the block on its right, vy[i] the flow to the
// block below. Each step:
//   1. pressure changes by how much air flows in or out (divergence)
//   2. velocity is pushed from high pressure towards low pressure
// A ring of blocks around the edge is held at zero pressure, so air can
// escape the map, and Wall blocks stop flow entirely so sealed boxes hold
// pressure.

export const CELL = 4;

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
    this.scratch = new Float32Array(n);
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
  }

  step() {
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
  }
}
