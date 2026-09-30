// Gravity: the direction and strength set on the Physics panel, and,
// optionally, Newtonian gravity, where mass pulls on mass.
//
// Movement reads a table with one entry per air block (4 x 4 cells): the
// pull there in g (1 g is the normal GRAVITY acceleration), its unit
// vector, and the two nearest of the 8 neighbour directions with the chance
// of picking the second, so an in-between angle averages out right. With
// Newtonian gravity off every block holds the same values, filled once when
// a setting changes. With it on, the pull of every block's mass on every
// other block is solved every other frame by an FFT convolution (Solver
// below) and the table is refilled after each solve. Nothing for it is
// built until it is first switched on.
//
// Angles are degrees clockwise on screen from straight down: 0 down, 90
// left, 180 up, 270 right.

import { FFT } from './fft.js';

// Newtonian gravity. G is the pull, in g, of one unit of mass (a cell of
// water) one air block away; the pull falls off as 1/r², softened inside a
// block by SOFT (blocks squared). LENS is how hard the field bends the path
// of a flying particle, per g per frame.
export const G = 0.0125;
export const SOFT = 0.5;
export const LENS = 0.05;

// The 8 neighbour directions, clockwise from down: S, SW, W, NW, N, NE, E, SE.
export const DX8 = Int8Array.of(0, -1, -1, -1, 0, 1, 1, 1);
export const DY8 = Int8Array.of(1, 1, 0, -1, -1, -1, 0, 1);
export const MAX_STRENGTH = 10;

// Scan rows or columns from the downhill end when gravity leans within
// about 67 degrees of that axis.
const LEAN = 0.38;

// sin(180°) comes out as 1e-16; round such crumbs to 0 (and -0 to 0).
const clean = (v) => (Math.abs(v) < 1e-12 ? 0 : v + 0);

// The ring direction nearest a unit vector, the next one clockwise, and the
// chance of picking that one instead.
function ringOf(ux, uy) {
  let e = Math.atan2(-ux, uy) * (4 / Math.PI);
  if (e < 0) e += 8;
  let k = Math.floor(e), f = e - k;
  if (f < 1e-6) f = 0;
  else if (f > 1 - 1e-6) { k++; f = 0; }
  return [k & 7, (k + 1) & 7, f];
}

export class Gravity {
  constructor(air) {
    this.air = air;
    const n = air.W * air.H;
    this.gx = new Float32Array(n); // pull in g
    this.gy = new Float32Array(n);
    this.ux = new Float32Array(n); // its unit vector (0, 0 with no pull)
    this.uy = new Float32Array(n);
    this.mag = new Float32Array(n);
    this.dirA = new Int8Array(n); // nearest ring direction, -1 with no pull
    this.dirB = new Int8Array(n);
    this.mix = new Float32Array(n); // chance of dirB instead
    this.angle = 0;
    this.strength = 1;
    this.newtonian = false;
    this.solver = null; // built the first time Newtonian gravity is switched on
    this.fx = null; // the Newtonian part of the pull per block, in g
    this.fy = null;
    this.stale = false; // switched on since the last solve
    this.apply();
  }

  set({ angle = this.angle, strength = this.strength, newtonian = this.newtonian } = {}) {
    this.angle = ((Math.round(angle) % 360) + 360) % 360;
    const s = Number(strength);
    this.strength = Number.isFinite(s) ? Math.min(MAX_STRENGTH, Math.max(0, s)) : 0;
    if (newtonian && !this.newtonian) {
      if (this.solver === null) {
        const n = this.gx.length;
        this.solver = new Solver(this.air.cols, this.air.rows);
        this.fx = new Float32Array(n);
        this.fy = new Float32Array(n);
      }
      this.fx.fill(0);
      this.fy.fill(0);
      this.stale = true;
    }
    this.newtonian = !!newtonian;
    this.apply();
  }

  // Solve the field from the mass the world has put in solver.mass.
  solve() {
    this.solver.solve(this.fx, this.fy);
    this.stale = false;
    this.fill();
  }

  apply() {
    const a = (this.angle * Math.PI) / 180;
    const sx = clean(-Math.sin(a)), sy = clean(Math.cos(a));
    const s = this.strength;
    // The arrow snapped to down, left, up or right, for behaviours.
    const q = Math.round(this.angle / 90) & 3;
    this.downX = [0, -1, 0, 1][q];
    this.downY = [1, 0, -1, 0][q];
    this.ugx = Math.fround(s * sx) + 0;
    this.ugy = Math.fround(s * sy) + 0;
    // Gases rise against the arrow and sink along it; with no gravity they
    // just spread out.
    [this.gasDir, this.gasDirB, this.gasMix] = ringOf(sx, sy);
    this.lift = s < 1 ? s : 1;
    this.gasUx = s > 0 ? sx : 0;
    this.gasUy = s > 0 ? sy : 0;
    // Scan from the end gravity pulls towards, so a column of grains falls
    // together; alternate where it is mostly sideways or off.
    this.scanRows = s === 0 ? 0 : sy > LEAN ? 1 : sy < -LEAN ? -1 : 0;
    this.scanCols = s === 0 ? 0 : sx > LEAN ? 1 : sx < -LEAN ? -1 : 0;
    // Straight down at normal strength or more: movement can take its fast
    // path (world.js).
    this.straight = !this.newtonian && this.angle === 0 && s >= 1;
    this.fill();
  }

  // Refill the per-block table: the uniform pull, plus the field when on.
  fill() {
    if (this.newtonian) {
      const { fx, fy, ugx, ugy } = this;
      for (let i = 0; i < fx.length; i++) this.setBlock(i, ugx + fx[i], ugy + fy[i]);
      return;
    }
    this.setBlock(0, this.ugx, this.ugy);
    this.gx.fill(this.gx[0]);
    this.gy.fill(this.gy[0]);
    this.ux.fill(this.ux[0]);
    this.uy.fill(this.uy[0]);
    this.mag.fill(this.mag[0]);
    this.dirA.fill(this.dirA[0]);
    this.dirB.fill(this.dirB[0]);
    this.mix.fill(this.mix[0]);
  }

  setBlock(i, gx, gy) {
    this.gx[i] = gx;
    this.gy[i] = gy;
    const m = Math.sqrt(gx * gx + gy * gy);
    this.mag[i] = m;
    if (m < 1e-6) {
      this.ux[i] = 0; this.uy[i] = 0; this.dirA[i] = -1; this.dirB[i] = -1; this.mix[i] = 0;
      return;
    }
    const ux = gx / m + 0, uy = gy / m + 0;
    this.ux[i] = ux;
    this.uy[i] = uy;
    let e = Math.atan2(-ux, uy) * (4 / Math.PI);
    if (e < 0) e += 8;
    let k = Math.floor(e), f = e - k;
    if (f < 1e-6) f = 0;
    else if (f > 1 - 1e-6) { k++; f = 0; }
    this.dirA[i] = k & 7;
    this.dirB[i] = (k + 1) & 7;
    this.mix[i] = f;
  }
}

const pow2 = (n) => {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
};

// The pull at every air block from the mass in every other: a convolution
// of the mass grid with the pull of one unit of mass, done with FFTs on a
// grid padded to twice the size so the pull doesn't wrap round the edges.
// The x and y pulls are solved together as the real and imaginary parts of
// one transform: the kernel is Kx + i*Ky, and both results are real.
export class Solver {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    const nx = pow2(2 * cols), ny = pow2(2 * rows);
    this.nx = nx;
    this.ny = ny;
    this.fftX = new FFT(nx);
    this.fftY = new FFT(ny);
    this.mass = new Float64Array(cols * rows);
    this.re = new Float64Array(nx * ny);
    this.im = new Float64Array(nx * ny);
    this.kr = new Float64Array(nx * ny);
    this.ki = new Float64Array(nx * ny);
    for (let ey = 1 - rows; ey < rows; ey++) {
      for (let ex = 1 - cols; ex < cols; ex++) {
        if (ex === 0 && ey === 0) continue;
        // A block at offset (ex, ey) from the mass is pulled back towards it.
        const r2 = ex * ex + ey * ey + SOFT;
        const f = -G / (r2 * Math.sqrt(r2));
        const k = ((ey + ny) % ny) * nx + ((ex + nx) % nx);
        this.kr[k] = f * ex;
        this.ki[k] = f * ey;
      }
    }
    this.transform(this.kr, this.ki, false, ny, ny);
  }

  // A 2D transform in place. Going forwards, rows from `rowsIn` on are all
  // zero, so their transforms are skipped; going back, only rows below
  // `rowsOut` are wanted.
  transform(re, im, inverse, rowsIn, rowsOut) {
    const { nx, fftX } = this;
    if (!inverse) {
      for (let y = 0; y < rowsIn; y++) fftX.run(re, im, y * nx, 1, false);
      this.columns(re, im, false);
    } else {
      this.columns(re, im, true);
      for (let y = 0; y < rowsOut; y++) fftX.run(re, im, y * nx, 1, true);
    }
  }

  // Transform every column at once, a whole row of butterflies at a time:
  // memory is read in order, where doing one column at a time would jump a
  // row between every value.
  columns(re, im, inverse) {
    const { nx, ny } = this;
    const { rev, cos, sin } = this.fftY;
    for (let i = 0; i < ny; i++) {
      const j = rev[i];
      if (j <= i) continue;
      const a = i * nx, b = j * nx;
      for (let x = 0; x < nx; x++) {
        let t = re[a + x]; re[a + x] = re[b + x]; re[b + x] = t;
        t = im[a + x]; im[a + x] = im[b + x]; im[b + x] = t;
      }
    }
    const sign = inverse ? 1 : -1;
    for (let size = 2; size <= ny; size <<= 1) {
      const half = size >> 1, step = ny / size;
      for (let start = 0; start < ny; start += size) {
        for (let k = 0; k < half; k++) {
          const wr = cos[k * step], wi = sign * sin[k * step];
          const a = (start + k) * nx, b = a + half * nx;
          for (let x = 0; x < nx; x++) {
            const br = re[b + x], bi = im[b + x];
            const xr = br * wr - bi * wi, xi = br * wi + bi * wr;
            const ar = re[a + x], ai = im[a + x];
            re[b + x] = ar - xr;
            im[b + x] = ai - xi;
            re[a + x] = ar + xr;
            im[a + x] = ai + xi;
          }
        }
      }
    }
  }

  // Solve the pull from `this.mass` (cols x rows, row by row) into fx, fy,
  // laid out like the air grid (a border one block wide round the outside).
  solve(fx, fy) {
    const { cols, rows, nx, ny, re, im, kr, ki, mass } = this;
    re.fill(0);
    im.fill(0);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) re[y * nx + x] = mass[y * cols + x];
    }
    this.transform(re, im, false, rows, ny);
    for (let k = 0; k < re.length; k++) {
      const a = re[k], b = im[k], c = kr[k], d = ki[k];
      re[k] = a * c - b * d;
      im[k] = a * d + b * c;
    }
    this.transform(re, im, true, ny, rows);
    const s = 1 / (nx * ny), W = cols + 2;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const o = (y + 1) * W + x + 1;
        fx[o] = re[y * nx + x] * s;
        fy[o] = im[y * nx + x] * s;
      }
    }
  }
}
