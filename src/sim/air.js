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
// escape the map. With convection on, the edge also drags on the air going
// through it (EDGE_DRAG), as in The Powder Toy, so a slow warm current turns
// along the edge instead of pouring out of it. Blocked blocks (Wall, or a line of strong solid across the block) stop flow
// entirely so sealed boxes hold pressure.
//
// With a pair of edges looped (setLoops), the border ring on those sides
// holds a copy of the inside of the opposite side, so the air carries on
// across the join (wrapRing, syncSeams), and those sides let nothing out.
//
// The open blocks fall into separate pockets (`region`, see label): the
// room, joined to the border ring, and any pocket shut off from it, such as
// the inside of a sealed box. Nothing is blurred, carried or sampled from one
// pocket into another, and only the room loses pressure and heat to the
// world beyond, so a sealed box keeps both for as long as it stays shut.
//
// With convection on (`heat`), each block also has an air temperature.
// Particles trade heat with it (world.js, warmAir). Air that takes in heat
// swells: its pressure rises by EXPAND a degree (levelling off when very hot,
// see thermal), and falls again as it gives the heat up, so heating sealed
// air raises the pressure while it stays hot, and in the open hot air pushes
// out and is drawn back as it cools. Heat the flow merely carries from one
// block to the next moves no pressure, so a rising plume doesn't set off
// pressure waves as it goes. Air warmer than the room is pushed gently
// against gravity, and colder air sinks (The Powder Toy's Boussinesq
// convection), so a plume rises over something hot, spreads out along the
// top, comes down at the sides and is drawn back in at the base: two steady
// rolls. The flow carries the heat along, and the air gives its heat back to
// the room. The border ring stays at room temperature.

import { AMBIENT } from './constants.js';

export const CELL = 4;
// The region of the room: the border ring and every block joined to it.
export const OUTSIDE = 1;

// Convection. A degree lost by a particle warms its block's air by
// AIR_SHARE degrees (air holds little heat), and each degree of air above
// room temperature adds EXPAND to the pressure. Air is pushed against
// gravity by BUOYANCY per degree it is warmer than the room, per g, per
// frame, but by no more than BUOYANT_MAX (colder air sinks), and gives
// AIR_TEMP_LOSS of its excess heat back to the room a frame. HEAT_SMOOTH
// blurs it a little, like the pressure.
export const AIR_SHARE = 3;
export const EXPAND = 0.008;
// ...but not without limit: the pressure heat adds levels off towards
// THERMAL_MAX (see thermal), so a pocket of million-degree air pushes hard
// without pinning the pressure at its maximum, or leaving a vacuum behind as
// it cools.
const THERMAL_MAX = 40;
const BUOYANCY = 0.0001;
const BUOYANT_MAX = 0.01;
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

const PRESSURE_STEP = 0.3;
const VELOCITY_STEP = 0.4;
const PRESSURE_LOSS = 0.9999;
const VELOCITY_LOSS = 0.999;
const ADVECT = 0.3; // the share of each face's flow traced back along the flow
const ADVECT_MAX = 3; // how many blocks back, at most
const EDGE_DRAG = 0.9; // the share of the flow through the map's edge kept a frame
const MAX_PRESSURE = 256;
// Air this close to rest (pressure and wind within AIR_STILL, air within
// HEAT_STILL degrees of room temperature) is at rest: it's set to exactly
// still and not stepped until something stirs it (see settle).
export const AIR_STILL = 0.01;
export const HEAT_STILL = 0.1;
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

// Blur `f` into `out` with the kernel. `key` is each entry's region (0
// where it's closed): a neighbour in another region, or closed, counts as
// the entry's own value. Closed entries are copied as they are.
function blur(f, key, out, W, H) {
  for (let y = 0; y < H; y++) {
    for (let x = 0, i = y * W; x < W; x++, i++) {
      const own = f[i], k = key[i];
      if (!k) { out[i] = own; continue; }
      let s = own * K_SELF;
      const l = x > 0, r = x < W - 1, u = y > 0, d = y < H - 1;
      s += (l && key[i - 1] === k ? f[i - 1] : own) * K_SIDE;
      s += (r && key[i + 1] === k ? f[i + 1] : own) * K_SIDE;
      s += (u && key[i - W] === k ? f[i - W] : own) * K_SIDE;
      s += (d && key[i + W] === k ? f[i + W] : own) * K_SIDE;
      s += (l && u && key[i - W - 1] === k ? f[i - W - 1] : own) * K_CORNER;
      s += (r && u && key[i - W + 1] === k ? f[i - W + 1] : own) * K_CORNER;
      s += (l && d && key[i + W - 1] === k ? f[i + W - 1] : own) * K_CORNER;
      s += (r && d && key[i + W + 1] === k ? f[i + W + 1] : own) * K_CORNER;
      out[i] = s;
    }
  }
}

// `f` at (x, y) in its own grid's units, blended from the four entries
// around; one not in region `k` counts as `own`.
function sample(f, key, W, H, x, y, own, k) {
  if (x < 0) x = 0; else if (x > W - 1) x = W - 1;
  if (y < 0) y = 0; else if (y > H - 1) y = H - 1;
  const x0 = x | 0, y0 = y | 0;
  const x1 = x0 < W - 1 ? x0 + 1 : x0, y1 = y0 < H - 1 ? y0 + 1 : y0;
  const fx = x - x0, fy = y - y0;
  const a = y0 * W + x0, b = y0 * W + x1, c = y1 * W + x0, d = y1 * W + x1;
  const va = key[a] === k ? f[a] : own, vb = key[b] === k ? f[b] : own;
  const vc = key[c] === k ? f[c] : own, vd = key[d] === k ? f[d] : own;
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
    this.tPressed = new Float32Array(n).fill(AMBIENT); // the temperature the pressure has caught up with
    this.heat = false;
    this.still = false; // the last step found the grid at rest (settle)
    this.voidSides = 0; // which edges are a void (see SPONGE)
    this.loopX = false; // which pairs of edges are joined (see setLoops)
    this.loopY = false;
    this.np = new Float32Array(n); // the next pressure and flow, being worked out
    this.nvx = new Float32Array(n);
    this.nvy = new Float32Array(n);
    // The region of each block (see label), and of each block and face the
    // air can be in (0 where it can't).
    this.region = new Int32Array(n);
    this.regions = OUTSIDE; // how many regions label found
    this.labelled = false; // labelled since the blocked map last changed hands
    this.labelledFor = new Uint8Array(n); // the blocked map the regions are for
    this.labelledOnce = false;
    this.stack = new Int32Array(n);
    this.open = new Int32Array(n);
    this.openX = new Int32Array(n);
    this.openY = new Int32Array(n);
    this.boil = new Float32Array(n).fill(1); // boiling point factor (see ATM)
    this.melt = new Float32Array(n).fill(1); // melting point factor
  }

  // Which pairs of edges are joined (world.js, setEdges). See wrapRing.
  setLoops(x, y) {
    this.loopX = x;
    this.loopY = y;
    this.labelledOnce = false; // the pockets join up differently now
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

  // Number the pockets of air: open blocks joined side to side share a
  // region. The border ring and all joined to it are OUTSIDE (the room);
  // each pocket shut off from it gets a number of its own. Blocked blocks
  // are 0. The world calls this once the frame's blocked map is in place;
  // while the map stays the same, so do the regions.
  label() {
    const { W, H, blocked, region, stack, labelledFor } = this;
    this.labelled = true;
    const loops = this.loopX || this.loopY;
    let same = this.labelledOnce;
    for (let i = 0; same && i < W * H; i++) same = blocked[i] === labelledFor[i];
    if (same) return;
    labelledFor.set(blocked);
    this.labelledOnce = true;
    region.fill(0);
    let top = 0;
    const edge = (i) => {
      if (!blocked[i] && region[i] === 0 && !(loops && this.loopRing(i))) { region[i] = OUTSIDE; stack[top++] = i; }
    };
    for (let x = 0; x < W; x++) { edge(x); edge((H - 1) * W + x); }
    for (let y = 1; y < H - 1; y++) { edge(y * W); edge(y * W + W - 1); }
    const { loopX, loopY } = this;
    let id = OUTSIDE;
    for (let start = 0; ; ) {
      while (top > 0) {
        const i = stack[--top], r = region[i], x = i % W, y = (i / W) | 0;
        for (let k = 0; k < 4; k++) {
          let nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
          // Across a looped join to the inside of the opposite side.
          if (loopX && nx === 0 && x === 1) nx = W - 2; else if (loopX && nx === W - 1 && x === W - 2) nx = 1;
          if (loopY && ny === 0 && y === 1) ny = H - 2; else if (loopY && ny === H - 1 && y === H - 2) ny = 1;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (!blocked[j] && region[j] === 0 && !(loops && this.loopRing(j))) { region[j] = r; stack[top++] = j; }
        }
      }
      while (start < W * H && (blocked[start] || region[start] !== 0 || (loops && this.loopRing(start)))) start++;
      if (start === W * H) break;
      region[start] = ++id;
      stack[top++] = start;
    }
    // A looped ring block belongs to the pocket of the block it copies.
    if (loops) for (let i = 0; i < W * H; i++) if (this.loopRing(i)) region[i] = region[this.mirror(i)];
    this.regions = id;
  }

  // Is block i a border-ring block on a looped side?
  loopRing(i) {
    const { W, H } = this, x = i % W, y = (i / W) | 0;
    return ((x === 0 || x === W - 1) && this.loopX) || ((y === 0 || y === H - 1) && this.loopY);
  }

  // The inside block a looped ring block copies.
  mirror(i) {
    const { W, H } = this;
    let x = i % W, y = (i / W) | 0;
    if (this.loopX) x = x === 0 ? W - 2 : x === W - 1 ? 1 : x;
    if (this.loopY) y = y === 0 ? H - 2 : y === H - 1 ? 1 : y;
    return y * W + x;
  }

  // On a looped side the border ring is a copy of the inside of the
  // opposite side, so blurs, gradients and traces carry on across the join.
  wrapRing() {
    if (!this.loopX && !this.loopY) return;
    const { W, H, p, t } = this;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (x !== 0 && y !== 0 && x !== W - 1 && y !== H - 1) continue;
        const i = y * W + x;
        if (!this.loopRing(i)) continue;
        const j = this.mirror(i);
        const jx = j % W, jy = (j / W) | 0;
        if (jx === 0 || jy === 0 || jx === W - 1 || jy === H - 1) continue; // a corner on a side that doesn't loop
        p[i] = p[j];
        t[i] = t[j];
      }
    }
  }

  // The face between the ring and the first column on one side is the same
  // face as the one between the last column and the ring on the other: keep
  // them equal, so what flows out of one side flows into the other.
  syncSeams() {
    const { W, H, vx, vy } = this;
    if (this.loopX) {
      for (let y = 0; y < H; y++) {
        const a = y * W, b = y * W + W - 2, v = (vx[a] + vx[b]) * 0.5;
        vx[a] = v;
        vx[b] = v;
      }
    }
    if (this.loopY) {
      for (let x = 0; x < W; x++) {
        const a = x, b = (H - 2) * W + x, v = (vy[a] + vy[b]) * 0.5;
        vy[a] = v;
        vy[b] = v;
      }
    }
  }

  // Is the whole grid at rest? Then make it exactly still and say so, so
  // the step can be skipped. Cheap: one pass over the grid.
  settle() {
    const { p, vx, vy, t } = this;
    const n = p.length;
    for (let i = 0; i < n; i++) {
      if (p[i] > AIR_STILL || p[i] < -AIR_STILL) return (this.still = false);
      if (vx[i] > AIR_STILL || vx[i] < -AIR_STILL || vy[i] > AIR_STILL || vy[i] < -AIR_STILL) return (this.still = false);
    }
    if (this.heat) {
      for (let i = 0; i < n; i++) {
        const d = t[i] - AMBIENT;
        if (d > HEAT_STILL || d < -HEAT_STILL) return (this.still = false);
      }
    }
    if (!this.still) {
      p.fill(0);
      vx.fill(0);
      vy.fill(0);
      t.fill(AMBIENT);
      this.tPressed.fill(AMBIENT);
    }
    return (this.still = true);
  }

  // `gravity` (gravity.js) is only read with convection on.
  step(gravity) {
    if (!this.labelled) this.label();
    this.labelled = false;
    if (this.settle()) return; // nothing to move
    const { W, H, p, vx, vy, blocked, region } = this;
    const loops = this.loopX || this.loopY;
    if (loops) this.wrapRing();

    // 1. Pressure from divergence of the face velocities. Only the room
    // leaks pressure away.
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        if (blocked[i]) { p[i] = 0; continue; }
        const div = vx[i] - vx[i - 1] + vy[i] - vy[i - W];
        let v = (region[i] === OUTSIDE ? p[i] * PRESSURE_LOSS : p[i]) - div * PRESSURE_STEP;
        if (v > MAX_PRESSURE) v = MAX_PRESSURE; else if (v < -MAX_PRESSURE) v = -MAX_PRESSURE;
        p[i] = v;
      }
    }
    if (loops) this.wrapRing();

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

    // With convection on, the map's edge drags on the air going through it,
    // so warm air rising off something hot turns along the top instead of
    // pouring out of it, and comes back down.
    if (this.heat) {
      if (!this.loopX) for (let y = 0; y < H; y++) { vx[y * W] *= EDGE_DRAG; vx[y * W + W - 2] *= EDGE_DRAG; }
      if (!this.loopY) for (let x = 0; x < W; x++) { vy[x] *= EDGE_DRAG; vy[(H - 2) * W + x] *= EDGE_DRAG; }
    }
    if (loops) this.syncSeams();

    this.thicken();
    if (loops) { this.syncSeams(); this.wrapRing(); }
    if (this.heat) this.stepHeat(gravity.gx, gravity.gy);
    if (this.voidSides !== 0) this.sponge();

  }

  // 3. Viscosity: blur the pressure and the flow (see KERNEL). 4. The flow
  // carries itself along: each face takes ADVECT of the flow traced back
  // from it. The border ring keeps no pressure; blocked blocks and the faces
  // beside them hold no air and no flow, and they and anything in another
  // pocket count as the block's own value in a blur or a trace.
  thicken() {
    const { W, H, p, vx, vy, blocked, region, np, nvx, nvy, open, openX, openY } = this;
    for (let y = 0; y < H; y++) {
      for (let x = 0, i = y * W; x < W; x++, i++) {
        // The border ring holds no air, unless its side loops (wrapRing).
        const ring = x === 0 || y === 0 || x === W - 1 || y === H - 1;
        const open1 = !ring || ((this.loopX || (x > 0 && x < W - 1)) && (this.loopY || (y > 0 && y < H - 1)));
        open[i] = open1 && !blocked[i] ? region[i] : 0;
        openX[i] = x < W - 1 && !blocked[i] && !blocked[i + 1] ? region[i] : 0;
        openY[i] = y < H - 1 && !blocked[i] && !blocked[i + W] ? region[i] : 0;
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
          const s = sample(vx, openX, W, H, x - clampBack(u), y - clampBack(v), u, openX[i]);
          nvx[i] = nvx[i] * (1 - ADVECT) + s * ADVECT;
        }
        if (openY[i]) {
          const v = vy[i];
          const u = (vx[i] + vx[i + W] + (x > 0 ? vx[i - 1] + vx[i + W - 1] : 0)) * 0.25;
          const s = sample(vy, openY, W, H, x - clampBack(u), y - clampBack(v), v, openY[i]);
          nvy[i] = nvy[i] * (1 - ADVECT) + s * ADVECT;
        }
      }
    }
    vx.set(nvx);
    vy.set(nvy);
  }

  // Damp the air near void edges (see SPONGE): pressure and flow fade out,
  // and warm or cold air settles to room temperature, the nearer the edge
  // the faster. A sealed pocket is left alone.
  sponge() {
    const { W, H, p, vx, vy, t, region, voidSides: v } = this;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        if (region[i] !== OUTSIDE) continue;
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

  // Convection: buoyancy, then the flow carrying the heat, then blurring and
  // cooling. (gx, gy) is the pull of gravity per block, in g.
  stepHeat(gx, gy) {
    const { W, H, t, vx, vy, p, blocked, region, scratch, tPressed } = this;

    // 0. Air that took in or gave up heat since last frame (from particles,
    // the tools) swells or shrinks.
    for (let i = 0; i < t.length; i++) {
      if (t[i] !== tPressed[i] && !blocked[i]) p[i] += thermal(t[i]) - thermal(tPressed[i]);
    }

    // 1. Air warmer than the room is pushed against gravity, gently, and
    // colder air sinks. Where air rises, air flows in below to take its
    // place and the air above is pushed aside, so the loop closes.
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        if (blocked[i]) continue;
        if (!blocked[i + 1]) {
          let e = ((t[i] + t[i + 1]) * 0.5 - AMBIENT) * BUOYANCY;
          if (e > BUOYANT_MAX) e = BUOYANT_MAX;
          vx[i] -= e * (gx[i] + gx[i + 1]) * 0.5;
        }
        if (!blocked[i + W]) {
          let e = ((t[i] + t[i + W]) * 0.5 - AMBIENT) * BUOYANCY;
          if (e > BUOYANT_MAX) e = BUOYANT_MAX;
          vy[i] -= e * (gy[i] + gy[i + W]) * 0.5;
        }
      }
    }

    // 2. The flow carries the heat: each block takes the temperature of the
    // air that arrives in it, traced back along the flow. Sealed blocks
    // neither give nor take any, and the trace doesn't reach into another
    // pocket.
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
        const own = scratch[i], r = region[i];
        const a = y0 * W + x0, b = y0 * W + x1, c = y1 * W + x0, d = y1 * W + x1;
        const ta = region[a] === r ? scratch[a] : own, tb = region[b] === r ? scratch[b] : own;
        const tc = region[c] === r ? scratch[c] : own, td = region[d] === r ? scratch[d] : own;
        t[i] = (ta * (1 - fx) + tb * fx) * (1 - fy) + (tc * (1 - fx) + td * fx) * fy;
      }
    }

    // 3. A little blurring, and 4. the world beyond soaks up the room's
    // heat (and the air shrinks as it goes). A sealed pocket keeps its own.
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
        if (region[i] === OUTSIDE) {
          const c = v + (AMBIENT - v) * airLoss(v);
          p[i] += thermal(c) - thermal(v);
          v = c;
        }
        t[i] = v;
      }
    }

    tPressed.set(t); // the temperature the pressure has caught up with
    this.wrapRing();
  }
}
