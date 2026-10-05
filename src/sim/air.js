// Coarse air simulation, modelled on The Powder Toy.
//
// The world is divided into CELL x CELL blocks, each holding a pressure value.
// Velocities live on the faces between blocks (a staggered grid): vx[i] is
// the flow from block i to the block on its right, vy[i] the flow to the
// block below. Each step, as in The Powder Toy:
//   1. pressure changes by how much air flows in or out (divergence)
//   2. velocity is pushed from high pressure towards low pressure
//   3. pressure and velocity are both blurred over each block and its eight
//      neighbours (KERNEL): blurring the flow is viscosity, and it's what
//      makes the air thick, so a blast pushes out a slow, smooth front
//   4. the flow carries itself along (ADVECT), so gusts keep going and curl
//      into eddies
// A ring of blocks around the edge is held at zero pressure, so air can
// escape the map, and blocked blocks (Wall, or a line of strong solid across
// the block) stop flow entirely so sealed boxes hold pressure.
//
// With convection on (`heat`), each block also has an air temperature.
// Particles trade heat with it (world.js, warmAir). Warm air presses
// harder: a block's pressure includes EXPAND for every degree its air is
// above room temperature (levelling off when very hot, see thermal), so
// heating sealed air raises the pressure while it stays hot, and in the
// open hot air pushes out and is drawn back as it cools, with nothing left
// over once it has; air warmer than the air around it is pushed against
// gravity and cooler air sinks, so a plume rises over something hot,
// spreads, comes down at the sides and is drawn back in at the base; the
// flow carries the heat along; and the air gives its heat back to the room.
// The border ring stays at room temperature.

import { AMBIENT } from './constants.js';

export const CELL = 4;

// Convection. A degree lost by a particle warms its block's air by
// AIR_SHARE degrees (air holds little heat), and each degree of air above
// room temperature adds EXPAND to the pressure. Air is pushed against gravity by BUOYANCY
// per degree it is warmer than the air within MEAN_RADIUS blocks, per g, per
// frame (cooler air is pushed with it), and gives AIR_TEMP_LOSS of its
// excess heat back to the room a frame. HEAT_SMOOTH blurs it a little, like the
// pressure.
export const AIR_SHARE = 3;
export const EXPAND = 0.008;
// ...but not without limit: the pressure heat adds levels off towards
// THERMAL_MAX (see thermal), so a pocket of million-degree air pushes hard
// without pinning the pressure at its maximum, or leaving a vacuum behind as
// it cools. Buoyancy counts at most BUOYANT_MAX degrees of difference.
const THERMAL_MAX = 40;
const BUOYANT_MAX = 1000;
const BUOYANCY = 0.0015;
const AIR_TEMP_LOSS = 0.01;
// Very hot air also radiates its heat away, the faster the hotter (real
// radiation grows with the fourth power of temperature, so the share of the
// excess lost a frame grows with its cube): RADIATE_AT kelvin doubles the
// loss, and at most RADIATE_MAX of the excess goes a frame. So air beside a
// star is searing, but the heat doesn't flood the whole world.
const RADIATE_AT = 2000;
const RADIATE_MAX = 0.9;
// The flow carries heat at most this many blocks a frame, however hard it blows.
const HEAT_REACH = 1.5;
const HEAT_SMOOTH = 0.2;
const MEAN_RADIUS = 14;

const PRESSURE_STEP = 0.3;
const VELOCITY_STEP = 0.4;
const PRESSURE_LOSS = 0.9999;
const VELOCITY_LOSS = 0.999;
const ADVECT = 0.3; // the share of each face's flow traced back along the flow
const ADVECT_MAX = 3; // how many blocks back, at most
const MAX_PRESSURE = 256;
// The Powder Toy's blur kernel, exp(-2 r²) normalised: the block itself,
// its four sides and its four corners.
const K_SUM = 1 + 4 * Math.exp(-2) + 4 * Math.exp(-4);
const K_SELF = 1 / K_SUM, K_SIDE = Math.exp(-2) / K_SUM, K_CORNER = Math.exp(-4) / K_SUM;

// Pressure moves boiling and melting points. ATM pressure units make one
// atmosphere (0 is normal air). A boiling point, in kelvin, is divided by
// 1 - ln(P) / TROUTON, P in atmospheres (Trouton's rule, near enough for
// most liquids): water boils at about 150 °C at +30 and below room
// temperature in a deep vacuum. Melting points rise more gently under
// pressure (MELT_STIFF in place of TROUTON) and don't fall in a vacuum.
// `boil` and `melt` hold the factor for each block, worked out once a
// frame; with no pressure both are exactly 1.
const ATM = 10;
const P_MIN = 0.01; // the deepest vacuum, in atmospheres
const TROUTON = 10.5;
const MELT_STIFF = 25;
const PHASE_DEADBAND = 0.25; // pressure this close to normal counts as normal (under 1 °C off)

// Void edges of the world (world.js, setVoidEdges) let pressure waves and
// warm air out instead of bouncing them back: the last SPONGE blocks before
// one damp the air more and more towards the edge, up to SPONGE_DAMP a
// frame, so a wave dies away on its way out. Bits match world.js.
const SPONGE = 6;
const SPONGE_DAMP = 0.3;
const SIDE_TOP = 1, SIDE_BOTTOM = 2, SIDE_LEFT = 4, SIDE_RIGHT = 8;
// How far a boiling point can fall, and any phase change can rise.
export const BOIL_LOWEST = 1 / (1 - Math.log(P_MIN) / TROUTON);
export const PHASE_HIGHEST = 1 / (1 - Math.log(1 + MAX_PRESSURE / ATM) / TROUTON);

// The share of its excess heat air at temperature t gives the room a frame.
function airLoss(t) {
  if (t < 600) return AIR_TEMP_LOSS;
  const k = (t + 273) / RADIATE_AT;
  const loss = AIR_TEMP_LOSS * (1 + k * k * k);
  return loss < RADIATE_MAX ? loss : RADIATE_MAX;
}

// The pressure air at temperature t adds: EXPAND a degree near room
// temperature, levelling off towards THERMAL_MAX.
export function thermal(t) {
  return THERMAL_MAX * Math.tanh(((t - AMBIENT) * EXPAND) / THERMAL_MAX);
}

// How far back along the flow a face looks, in blocks.
function clampBack(v) {
  const d = v * ADVECT;
  return d > ADVECT_MAX ? ADVECT_MAX : d < -ADVECT_MAX ? -ADVECT_MAX : d;
}

// Blur `f` into `out` with the kernel, where `open`; a closed neighbour
// counts as the block's own value. Closed entries are copied as they are.
function blur(f, open, out, W, H) {
  for (let y = 0; y < H; y++) {
    for (let x = 0, i = y * W; x < W; x++, i++) {
      const own = f[i];
      if (!open[i]) { out[i] = own; continue; }
      let s = own * K_SELF;
      const l = x > 0, r = x < W - 1, u = y > 0, d = y < H - 1;
      s += (l && open[i - 1] ? f[i - 1] : own) * K_SIDE;
      s += (r && open[i + 1] ? f[i + 1] : own) * K_SIDE;
      s += (u && open[i - W] ? f[i - W] : own) * K_SIDE;
      s += (d && open[i + W] ? f[i + W] : own) * K_SIDE;
      s += (l && u && open[i - W - 1] ? f[i - W - 1] : own) * K_CORNER;
      s += (r && u && open[i - W + 1] ? f[i - W + 1] : own) * K_CORNER;
      s += (l && d && open[i + W - 1] ? f[i + W - 1] : own) * K_CORNER;
      s += (r && d && open[i + W + 1] ? f[i + W + 1] : own) * K_CORNER;
      out[i] = s;
    }
  }
}

// `f` at (x, y) in its own grid's units, blended from the four entries
// around; a closed one counts as `own`.
function sample(f, open, W, H, x, y, own) {
  if (x < 0) x = 0; else if (x > W - 1) x = W - 1;
  if (y < 0) y = 0; else if (y > H - 1) y = H - 1;
  const x0 = x | 0, y0 = y | 0;
  const x1 = x0 < W - 1 ? x0 + 1 : x0, y1 = y0 < H - 1 ? y0 + 1 : y0;
  const fx = x - x0, fy = y - y0;
  const a = y0 * W + x0, b = y0 * W + x1, c = y1 * W + x0, d = y1 * W + x1;
  const va = open[a] ? f[a] : own, vb = open[b] ? f[b] : own;
  const vc = open[c] ? f[c] : own, vd = open[d] ? f[d] : own;
  return (va * (1 - fx) + vb * fx) * (1 - fy) + (vc * (1 - fx) + vd * fx) * fy;
}

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
    this.tPressed = new Float32Array(n).fill(AMBIENT); // the temperature already counted in p
    this.heat = false;
    this.voidSides = 0; // which edges are a void (see SPONGE)
    this.np = new Float32Array(n); // the next pressure and flow, being worked out
    this.nvx = new Float32Array(n);
    this.nvy = new Float32Array(n);
    this.open = new Uint8Array(n); // which blocks and faces air can be in (see step)
    this.openX = new Uint8Array(n);
    this.openY = new Uint8Array(n);
    this.boil = new Float32Array(n).fill(1); // boiling point factor (see ATM)
    this.melt = new Float32Array(n).fill(1); // melting point factor
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
    this.tPressed.fill(AMBIENT);
  }

  // Convection off: the air forgets its heat, and the pressure it made.
  coolAll() {
    const { p, t, tPressed, blocked } = this;
    for (let i = 0; i < p.length; i++) if (!blocked[i] && tPressed[i] !== AMBIENT) p[i] -= thermal(tPressed[i]);
    t.fill(AMBIENT);
    tPressed.fill(AMBIENT);
  }

  // `gravity` (gravity.js) is only read with convection on.
  step(gravity) {
    const { W, H, p, vx, vy, blocked } = this;

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

    // 2. Velocity from the pressure gradient across each face.
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

    this.thicken();
    if (this.heat) this.stepHeat(gravity.gx, gravity.gy);
    if (this.voidSides !== 0) this.sponge();

  }

  // 3. Viscosity: blur the pressure and the flow (see KERNEL). 4. The flow
  // carries itself along: each face takes ADVECT of the flow traced back
  // from it. The border ring keeps no pressure; blocked blocks and the faces
  // beside them hold no air and no flow, and count as their neighbour's own
  // value in a blur.
  thicken() {
    const { W, H, p, vx, vy, blocked, np, nvx, nvy, open, openX, openY } = this;
    for (let y = 0; y < H; y++) {
      for (let x = 0, i = y * W; x < W; x++, i++) {
        const inside = x > 0 && y > 0 && x < W - 1 && y < H - 1;
        open[i] = inside && !blocked[i] ? 1 : 0;
        openX[i] = x < W - 1 && !blocked[i] && !blocked[i + 1] ? 1 : 0;
        openY[i] = y < H - 1 && !blocked[i] && !blocked[i + W] ? 1 : 0;
      }
    }
    blur(p, open, np, W, H);
    blur(vx, openX, nvx, W, H);
    blur(vy, openY, nvy, W, H);
    p.set(np);
    for (let y = 0; y < H; y++) {
      for (let x = 0, i = y * W; x < W; x++, i++) {
        if (openX[i]) {
          // The flow at this face, and where it came from.
          const u = vx[i];
          const v = (vy[i] + vy[i + 1] + (y > 0 ? vy[i - W] + vy[i - W + 1] : 0)) * 0.25;
          const s = sample(vx, openX, W, H, x - clampBack(u), y - clampBack(v), u);
          nvx[i] = nvx[i] * (1 - ADVECT) + s * ADVECT;
        }
        if (openY[i]) {
          const v = vy[i];
          const u = (vx[i] + vx[i + W] + (x > 0 ? vx[i - 1] + vx[i + W - 1] : 0)) * 0.25;
          const s = sample(vy, openY, W, H, x - clampBack(u), y - clampBack(v), v);
          nvy[i] = nvy[i] * (1 - ADVECT) + s * ADVECT;
        }
      }
    }
    vx.set(nvx);
    vy.set(nvy);
  }

  // Damp the air near void edges (see SPONGE): pressure and flow fade out,
  // and warm or cold air settles to room temperature, the nearer the edge
  // the faster.
  sponge() {
    const { W, H, p, vx, vy, t, voidSides: v } = this;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        let d = SPONGE;
        if ((v & SIDE_LEFT) !== 0 && x - 1 < d) d = x - 1;
        if ((v & SIDE_RIGHT) !== 0 && W - 2 - x < d) d = W - 2 - x;
        if ((v & SIDE_TOP) !== 0 && y - 1 < d) d = y - 1;
        if ((v & SIDE_BOTTOM) !== 0 && H - 2 - y < d) d = H - 2 - y;
        if (d >= SPONGE) continue;
        const r = (SPONGE - d) / SPONGE, loss = SPONGE_DAMP * r * r, k = 1 - loss;
        p[i] *= k;
        vx[i] *= k;
        vy[i] *= k;
        vx[i - 1] *= k;
        vy[i - W] *= k;
        if (this.heat) t[i] += (AMBIENT - t[i]) * loss;
      }
    }
  }

  // How the pressure in each block moves boiling and melting points. Sealed
  // blocks (inside a solid, or with a wall through them) have no air of
  // their own, but what's in them is squeezed by the air around: they take
  // the strongest effect from their neighbours, spread a few sweeps deep.
  phaseFactors() {
    const { p, boil, melt, blocked, W } = this;
    const n = p.length;
    let any = false;
    for (let i = 0; i < n; i++) {
      const v = p[i];
      if ((v < PHASE_DEADBAND && v > -PHASE_DEADBAND) || blocked[i]) { boil[i] = 1; melt[i] = 1; continue; }
      any = true;
      const P = 1 + v / ATM;
      const l = Math.log(P > P_MIN ? P : P_MIN);
      boil[i] = 1 / (1 - l / TROUTON);
      melt[i] = l > 0 ? 1 / (1 - l / MELT_STIFF) : 1;
    }
    if (!any) return;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = W; i < n - W; i++) if (blocked[i]) this.squeeze(i);
      for (let i = n - W - 1; i >= W; i--) if (blocked[i]) this.squeeze(i);
    }
  }

  // A sealed block takes the furthest-from-normal factors beside it.
  squeeze(i) {
    const W = this.W;
    this.squeezeFrom(i, i - 1);
    this.squeezeFrom(i, i + 1);
    this.squeezeFrom(i, i - W);
    this.squeezeFrom(i, i + W);
  }

  squeezeFrom(i, b) {
    const { boil, melt } = this;
    if (Math.abs(boil[b] - 1) > Math.abs(boil[i] - 1)) boil[i] = boil[b];
    if (melt[b] > melt[i]) melt[i] = melt[b];
  }

  // The average temperature of the open air within MEAN_RADIUS blocks of
  // each block (a box blur done with running sums, sealed blocks left out).
  localMean() {
    const { W, H, t, blocked } = this;
    const n = W * H;
    if (!this.mean) {
      this.mean = new Float32Array(n);
      this.rowSum = new Float32Array(n);
      this.rowCount = new Float32Array(n);
    }
    const { mean, rowSum, rowCount } = this;
    const R = MEAN_RADIUS;
    for (let y = 0; y < H; y++) {
      const o = y * W;
      let s = 0, c = 0;
      for (let x = 0; x < Math.min(R, W); x++) if (!blocked[o + x]) { s += t[o + x]; c++; }
      for (let x = 0; x < W; x++) {
        const add = x + R, drop = x - R - 1;
        if (add < W && !blocked[o + add]) { s += t[o + add]; c++; }
        if (drop >= 0 && !blocked[o + drop]) { s -= t[o + drop]; c--; }
        rowSum[o + x] = s;
        rowCount[o + x] = c;
      }
    }
    for (let x = 0; x < W; x++) {
      let s = 0, c = 0;
      for (let y = 0; y < Math.min(R, H); y++) { s += rowSum[y * W + x]; c += rowCount[y * W + x]; }
      for (let y = 0; y < H; y++) {
        const add = y + R, drop = y - R - 1;
        if (add < H) { s += rowSum[add * W + x]; c += rowCount[add * W + x]; }
        if (drop >= 0) { s -= rowSum[drop * W + x]; c -= rowCount[drop * W + x]; }
        mean[y * W + x] = c > 0 ? s / c : AMBIENT;
      }
    }
    return mean;
  }

  // Convection: buoyancy, then the flow carrying the heat, then blurring and
  // cooling. (gx, gy) is the pull of gravity per block, in g.
  stepHeat(gx, gy) {
    const { W, H, t, vx, vy, p, blocked, scratch } = this;

    // 1. Air warmer than the air around it on average is pushed against
    // gravity, and cooler air sinks: so air that has risen off something hot
    // and cooled comes back down, and the loop closes.
    const mean = this.localMean();
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        if (blocked[i]) continue;
        if (!blocked[i + 1]) {
          let e = (t[i] + t[i + 1] - mean[i] - mean[i + 1]) * 0.5;
          if (e > BUOYANT_MAX) e = BUOYANT_MAX; else if (e < -BUOYANT_MAX) e = -BUOYANT_MAX;
          vx[i] -= BUOYANCY * e * (gx[i] + gx[i + 1]) * 0.5;
        }
        if (!blocked[i + W]) {
          let e = (t[i] + t[i + W] - mean[i] - mean[i + W]) * 0.5;
          if (e > BUOYANT_MAX) e = BUOYANT_MAX; else if (e < -BUOYANT_MAX) e = -BUOYANT_MAX;
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
        let dx = this.cvx(i) / CELL, dy = this.cvy(i) / CELL;
        if (dx > HEAT_REACH) dx = HEAT_REACH; else if (dx < -HEAT_REACH) dx = -HEAT_REACH;
        if (dy > HEAT_REACH) dy = HEAT_REACH; else if (dy < -HEAT_REACH) dy = -HEAT_REACH;
        let sx = x - dx, sy = y - dy;
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

    // 3. A little blurring, and 4. the room soaks up the heat.
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
        t[i] = v + (AMBIENT - v) * airLoss(v);
      }
    }

    // 5. The pressure follows the temperature, however it changed this
    // frame (particles, tools, the flow, cooling).
    const { tPressed } = this;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === tPressed[i]) continue;
      if (!blocked[i]) p[i] += thermal(t[i]) - thermal(tPressed[i]);
      tPressed[i] = t[i];
    }
  }
}
