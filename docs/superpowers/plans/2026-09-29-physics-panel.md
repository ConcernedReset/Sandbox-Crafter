# Physics Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Physics strip under the game with a gravity direction dial, a gravity strength box, a Newtonian gravity checkbox and a convection checkbox, plus the simulation behind each.

**Architecture:** A new `Gravity` object (per air block table of the pull, filled once for uniform gravity, refilled after each FFT solve when Newtonian gravity is on) drives every place that assumed "down". Convection adds an air temperature grid to `Air`. A new `PhysicsPanel` module wires the controls to `World.setGravity` / `World.setConvection`.

**Tech Stack:** Plain ES modules, no dependencies. Tests: `node --test` (run here through VS Code's bundled runtime, see below).

**Spec:** `docs/superpowers/specs/2026-09-29-physics-panel-design.md`

## Global Constraints

- Defaults (angle 0, strength 1, Newtonian off, convection off) must give **bit-identical** simulation results to today, apart from the sign of zero: the baseline probe (`baseprobe.mjs check` in the scratchpad, which hashes positions, temperatures, velocities with -0 folded into 0, pressure and particles after seeded runs of two scenes) must print `SAME` for both scenes after every task. All 1,289 existing tests keep passing unchanged.
- Newtonian gravity off costs nothing: no mass pass, no FFT, no solver allocation.
- Convection off: `air.t` is never touched; `conductHeat` takes the old branch.
- Angles: degrees clockwise on screen from straight down (0 down, 90 left, 180 up, 270 right). Strength 0 to 10.
- Content line (HANDOFF): nothing here touches recipes; keep it that way.
- Code style: match the surrounding files (short comments that say why, `const` destructuring of `this`, no semicolon-free style, 2-space indent).
- The folder is **not a git repository**: skip every commit step.
- Node is not installed. Run scripts and tests with the scratchpad helper:
  `& "$s\t.ps1" -Test test\x.test.js` (tests) or `& "$s\t.ps1" "$s\probe.mjs"` (scripts), where `$s` is the scratchpad path. It prints failures and the summary.

---

### Task 1: FFT

**Files:**
- Create: `src/sim/fft.js`
- Test: `test/fft.test.js`

**Interfaces:**
- Produces: `class FFT { constructor(n: power of two); run(re: Float64Array, im: Float64Array, offset = 0, stride = 1, inverse = false): void }` — in place, unscaled inverse.

- [ ] **Step 1: Write the failing test** (`test/fft.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FFT } from '../src/sim/fft.js';

// A slow discrete Fourier transform to check against.
function dft(re, im, inverse) {
  const n = re.length;
  const or = new Float64Array(n), oi = new Float64Array(n);
  const s = inverse ? 1 : -1;
  for (let k = 0; k < n; k++) {
    for (let t = 0; t < n; t++) {
      const a = (s * 2 * Math.PI * k * t) / n;
      or[k] += re[t] * Math.cos(a) - im[t] * Math.sin(a);
      oi[k] += re[t] * Math.sin(a) + im[t] * Math.cos(a);
    }
  }
  return [or, oi];
}

const close = (a, b) => Math.abs(a - b) < 1e-9;

test('the FFT matches a slow DFT, and the inverse brings the input back', () => {
  const n = 16;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) { re[i] = Math.sin(i * 1.3) + i * 0.1; im[i] = Math.cos(i * 0.7); }
  const [er, ei] = dft(re, im, false);
  const r = re.slice(), m = im.slice();
  const fft = new FFT(n);
  fft.run(r, m);
  for (let i = 0; i < n; i++) assert.ok(close(r[i], er[i]) && close(m[i], ei[i]), `bin ${i}`);
  fft.run(r, m, 0, 1, true);
  for (let i = 0; i < n; i++) assert.ok(close(r[i] / n, re[i]) && close(m[i] / n, im[i]), `sample ${i}`);
});

test('a strided transform works on one column of a grid', () => {
  const w = 4, h = 8;
  const re = new Float64Array(w * h), im = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) re[i] = (i * 37) % 11;
  const col = 2;
  const cr = new Float64Array(h), ci = new Float64Array(h);
  for (let y = 0; y < h; y++) cr[y] = re[y * w + col];
  new FFT(h).run(cr, ci);
  new FFT(h).run(re, im, col, w);
  for (let y = 0; y < h; y++) assert.ok(close(re[y * w + col], cr[y]) && close(im[y * w + col], ci[y]));
  assert.equal(re[1], (1 * 37) % 11, 'other columns are left alone');
});

test('a length that is not a power of two is refused', () => {
  assert.throws(() => new FFT(12), /power of two/);
});
```

- [ ] **Step 2: Run it and see it fail** — `& "$s\t.ps1" -Test test\fft.test.js`. Expected: fails, module not found.

- [ ] **Step 3: Write `src/sim/fft.js`**

```js
// Radix-2 fast Fourier transforms, in place, on separate real and imaginary
// arrays. The Newtonian gravity field (gravity.js) uses them to add up the
// pull of every air block on every other in O(n log n) instead of O(n²).

export class FFT {
  // A transform for one power-of-two length: the bit-reversed order and the
  // twiddle factors are worked out once.
  constructor(n) {
    if (n < 1 || (n & (n - 1)) !== 0) throw new Error(`FFT length ${n} is not a power of two`);
    this.n = n;
    let bits = 0;
    while ((1 << bits) < n) bits++;
    this.rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.cos = new Float64Array(n >> 1);
    this.sin = new Float64Array(n >> 1);
    for (let i = 0; i < n >> 1; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / n);
      this.sin[i] = Math.sin((2 * Math.PI * i) / n);
    }
  }

  // Transform n values of re/im in place, starting at `offset` and `stride`
  // apart (so a grid's columns can be done where they are). The inverse is
  // not divided by n.
  run(re, im, offset = 0, stride = 1, inverse = false) {
    const { n, rev, cos, sin } = this;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        const a = offset + i * stride, b = offset + j * stride;
        let t = re[a]; re[a] = re[b]; re[b] = t;
        t = im[a]; im[a] = im[b]; im[b] = t;
      }
    }
    const sign = inverse ? 1 : -1;
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let start = 0; start < n; start += size) {
        for (let k = 0; k < half; k++) {
          const wr = cos[k * step], wi = sign * sin[k * step];
          const a = offset + (start + k) * stride;
          const b = a + half * stride;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run the test and see it pass.**

---

### Task 2: Gravity settings and the per-block table

**Files:**
- Create: `src/sim/gravity.js`
- Test: `test/gravity.test.js`

**Interfaces:**
- Consumes: `Air` (`src/sim/air.js`): `cols`, `rows`, `W = cols + 2`, `H = rows + 2`.
- Produces (used by Tasks 3-8):
  - `DX8`, `DY8` (Int8Array, ring S, SW, W, NW, N, NE, E, SE), `MAX_STRENGTH = 10`.
  - `class Gravity(air)` with fields `angle`, `strength`, `newtonian`; per block (length `W*H`) `gx, gy, ux, uy, mag, mix` (Float32Array), `dirA, dirB` (Int8Array, -1 = none); uniform `ugx, ugy`; 4-way arrow `downX, downY`; gases `gasDir, gasDirB, gasMix, lift, gasUx, gasUy`; scan order `scanRows, scanCols` (1, -1 or 0); method `set({ angle?, strength?, newtonian? })`.

- [ ] **Step 1: Write the failing test** (start `test/gravity.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Air } from '../src/sim/air.js';
import { Gravity } from '../src/sim/gravity.js';

const B = 12; // an air block inside a 10 x 6 grid

test('straight down at strength 1 is the old gravity, exactly', () => {
  const g = new Gravity(new Air(10, 6));
  assert.equal(g.gx[B], 0);
  assert.ok(Object.is(g.ux[B], 0), 'no negative zero');
  assert.equal(g.gy[B], 1);
  assert.equal(g.mag[B], 1);
  assert.equal(g.dirA[B], 0);
  assert.equal(g.mix[B], 0);
  assert.deepEqual([g.downX, g.downY, g.scanRows, g.scanCols], [0, 1, 1, 0]);
  assert.deepEqual([g.gasDir, g.gasMix, g.lift, g.gasUx, g.gasUy], [0, 0, 1, 0, 1]);
});

test('the arrow turns gravity: left, up, and angles in between', () => {
  const g = new Gravity(new Air(10, 6));
  g.set({ angle: 90 });
  assert.deepEqual([g.gx[B], g.gy[B], g.dirA[B], g.mix[B]], [-1, 0, 2, 0]);
  assert.deepEqual([g.downX, g.downY, g.scanRows, g.scanCols], [-1, 0, 0, -1]);
  g.set({ angle: 180 });
  assert.deepEqual([g.gx[B], g.gy[B], g.dirA[B], g.scanRows], [0, -1, 4, -1]);
  g.set({ angle: 30 });
  assert.equal(g.dirA[B], 0);
  assert.equal(g.dirB[B], 1);
  assert.ok(Math.abs(g.mix[B] - 30 / 45) < 1e-6);
  assert.deepEqual([g.downX, g.downY], [0, 1]);
  g.set({ angle: 300 });
  assert.deepEqual([g.dirA[B], g.dirB[B], g.downX, g.downY], [6, 7, 1, 0]);
});

test('strength scales the pull and stays between 0 and 10; angles wrap', () => {
  const g = new Gravity(new Air(10, 6));
  g.set({ strength: 2.5 });
  assert.equal(g.mag[B], 2.5);
  g.set({ strength: 50 });
  assert.equal(g.strength, 10);
  g.set({ strength: 0 });
  assert.deepEqual([g.mag[B], g.dirA[B], g.scanRows, g.gasUy, g.lift], [0, -1, 0, 0, 0]);
  assert.deepEqual([g.downX, g.downY], [0, 1], 'the arrow still points somewhere');
  g.set({ angle: -90 });
  assert.equal(g.angle, 270);
  g.set({ angle: 725 });
  assert.equal(g.angle, 5);
});
```

- [ ] **Step 2: Run it and see it fail** (module not found).

- [ ] **Step 3: Write `src/sim/gravity.js` (uniform gravity only; Task 5 adds Newtonian)**

```js
// Gravity: the direction and strength set on the Physics panel, and,
// optionally, Newtonian gravity, where mass pulls on mass.
//
// Movement reads a table with one entry per air block (4 x 4 cells): the
// pull there in g (1 g is the normal GRAVITY acceleration), its unit
// vector, and the two nearest of the 8 neighbour directions with the chance
// of picking the second, so an in-between angle averages out right. With
// Newtonian gravity off every block holds the same values, filled once when
// a setting changes.
//
// Angles are degrees clockwise on screen from straight down: 0 down, 90
// left, 180 up, 270 right.

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
    this.apply();
  }

  set({ angle = this.angle, strength = this.strength } = {}) {
    this.angle = ((Math.round(angle) % 360) + 360) % 360;
    const s = Number(strength);
    this.strength = Number.isFinite(s) ? Math.min(MAX_STRENGTH, Math.max(0, s)) : 0;
    this.apply();
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
    this.fill();
  }

  // Refill the per-block table.
  fill() {
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
```

- [ ] **Step 4: Run the test and see it pass.**

---

### Task 3: Movement follows gravity

**Files:**
- Modify: `src/sim/world.js` (imports, constructor, `step`, `canEnter`, `travel`, `pushByAir`, `movePowder`, `moveLiquid`, `moveGas`; new `setGravity`, `downAt`, `stopAlong`)
- Modify: `src/sim/behaviors.js:508-515` (`updateGlitter` calls `travel` — pass its block's unit vector)
- Test: `test/gravity.test.js` (append)

**Interfaces:**
- Consumes: Task 2's `Gravity`, `DX8`, `DY8`.
- Produces: `world.gravity`; `world.setGravity({ angle?, strength?, newtonian? })`; `world.travel(i, x, y, vx, vy, d, ux = 0, uy = 1)`; `world.pushByAir(i, a, d, gx, gy)`; `world.downAt(a)` (ring index or -1); `world.stopAlong(i, ux, uy, keep)`.

- [ ] **Step 1: Write the failing tests** (append to `test/gravity.test.js`)

```js
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, wallBox, countOf, meanY, run } from './helpers.js';

function meanX(world, t) {
  let sum = 0, n = 0;
  for (let i = 0; i < world.type.length; i++) if (world.type[i] === t) { sum += i % world.w; n++; }
  return n ? sum / n : NaN;
}

test('sideways gravity piles sand against the side wall', () => {
  const w = makeWorld(60, 40);
  wallBox(w, 0, 0, 59, 39);
  fillRect(w, 25, 10, 35, 20, ID.SAND);
  w.setGravity({ angle: 90 }); // pulls left
  run(w, 300);
  assert.equal(countOf(w, ID.SAND), 121);
  assert.ok(meanX(w, ID.SAND) < 8, `sand at x ${meanX(w, ID.SAND).toFixed(1)}`);
});

test('upside-down gravity sends water to the ceiling and steam to the floor', () => {
  const w = makeWorld(40, 40);
  wallBox(w, 0, 0, 39, 39);
  fillRect(w, 5, 25, 34, 34, ID.WATER);
  w.setGravity({ angle: 180 });
  run(w, 300);
  assert.ok(meanY(w, ID.WATER) < 12, `water at y ${meanY(w, ID.WATER).toFixed(1)}`);
  const s = makeWorld(40, 40);
  wallBox(s, 0, 0, 39, 39);
  fillRect(s, 10, 5, 29, 12, ID.STEAM);
  s.setGravity({ angle: 180 });
  run(s, 150);
  assert.ok(meanY(s, ID.STEAM) > 25, `steam at y ${meanY(s, ID.STEAM).toFixed(1)}`);
});

test('a slanted arrow slants the fall', () => {
  const w = makeWorld(120, 120);
  fillRect(w, 80, 5, 84, 9, ID.SAND);
  w.setGravity({ angle: 30 }); // down and a little to the left
  const x0 = meanX(w, ID.SAND), y0 = meanY(w, ID.SAND);
  run(w, 25);
  const dx = meanX(w, ID.SAND) - x0, dy = meanY(w, ID.SAND) - y0;
  assert.ok(dy > 10, `fell ${dy.toFixed(1)}`);
  const slope = -dx / dy; // tan 30° is 0.58
  assert.ok(slope > 0.35 && slope < 0.85, `slope ${slope.toFixed(2)}`);
});

test('with no gravity sand hangs in the air, and double gravity falls faster', () => {
  const w = makeWorld(60, 60);
  fillRect(w, 25, 10, 34, 19, ID.SAND);
  w.setGravity({ strength: 0 });
  const y0 = meanY(w, ID.SAND);
  run(w, 120);
  assert.ok(Math.abs(meanY(w, ID.SAND) - y0) < 0.5, 'still hanging');
  const one = makeWorld(60, 200), two = makeWorld(60, 200);
  for (const v of [one, two]) fillRect(v, 25, 0, 34, 4, ID.SAND);
  two.setGravity({ strength: 2 });
  run(one, 20); run(two, 20);
  assert.ok(meanY(two, ID.SAND) > meanY(one, ID.SAND) + 3,
    `${meanY(two, ID.SAND).toFixed(1)} vs ${meanY(one, ID.SAND).toFixed(1)}`);
});

test('gases rise against the arrow', () => {
  const w = makeWorld(80, 40);
  wallBox(w, 0, 0, 79, 39);
  fillRect(w, 35, 15, 44, 24, ID.STEAM);
  w.setGravity({ angle: 90 }); // pulls left, so steam drifts right
  const x0 = meanX(w, ID.STEAM);
  run(w, 150);
  assert.ok(meanX(w, ID.STEAM) > x0 + 10, `steam moved ${(meanX(w, ID.STEAM) - x0).toFixed(1)}`);
});
```

- [ ] **Step 2: Run them and see them fail** (`setGravity` is not a function).

- [ ] **Step 3: Update the baseline probe to fold -0 into 0, and re-save the baseline before touching `world.js`**

In `baseprobe.mjs`, replace the `mix(...)` call on float arrays with a folded copy:

```js
const fold = (arr) => Float32Array.from(arr, (v) => v + 0);
mix(w.type); mix(fold(w.temp)); mix(fold(w.vx)); mix(fold(w.vy)); mix(w.life); mix(w.ctype); mix(fold(w.air.p));
```

Run `& "$s\t.ps1" "$s\baseprobe.mjs" save`.

- [ ] **Step 4: Edit `src/sim/world.js`**

Imports and constructor:

```js
import { Gravity, DX8, DY8 } from './gravity.js';
```

```js
    this.air = new Air(Math.ceil(width / CELL), Math.ceil(height / CELL));
    this.gravity = new Gravity(this.air);
```

New methods after `randomNeighbor`:

```js
  // Settings from the Physics panel: { angle, strength, newtonian }.
  setGravity(opts) {
    this.gravity.set(opts);
  }
```

`step()` scan loop — rows and columns start from the downhill end:

```js
    const g = this.gravity;
    const fromBottom = g.scanRows === 0 ? (tick & 1) === 0 : g.scanRows > 0;
    for (let n = 0; n < h; n++) {
      const y = fromBottom ? h - 1 - n : n;
      const leftToRight = g.scanCols === 0 ? ((tick + y) & 1) === 0 : g.scanCols < 0;
      const row = y * w;
      ...unchanged...
```

`canEnter` comment: "`dy` is the direction of the move along gravity (+1 with it, -1 against, 0 across)" — code unchanged.

`travel` gets the gravity unit vector:

```js
  // Move along (vx, vy) one cell at a time, stopping at the first obstacle.
  // (ux, uy) is which way is down, for deciding what the particle can sink
  // or rise through. Returns the particle's new index. Sets
  // this.blockedMoving if it hit something.
  travel(i, x, y, vx, vy, d, ux = 0, uy = 1) {
    ...
      const j = ny * this.w + nx;
      const along = (nx - cx) * ux + (ny - cy) * uy;
      if (!this.canEnter(d, j, along > 0.3 ? 1 : along < -0.3 ? -1 : 0)) { this.blockedMoving = true; break; }
```

`pushByAir` takes the block and the pull in g:

```js
  // Wind pushes the particle along, drag slows it down, gravity pulls it:
  // (gx, gy) is the pull in g at air block a.
  pushByAir(i, a, d, gx, gy) {
    const k = d.airDrag;
    const drag = 1 - d.drag;
    let vx = this.vx[i] * drag + this.air.cvx(a) * k + gx * GRAVITY;
    let vy = this.vy[i] * drag + this.air.cvy(a) * k + gy * GRAVITY;
    ...clamp and store unchanged...
  }

  // Which way a particle in air block a falls this frame: a ring direction,
  // or -1 when there's no gravity or it's too weak to pull it a cell.
  downAt(a) {
    const g = this.gravity;
    let k = g.dirA[a];
    if (k < 0) return -1;
    const m = g.mag[a];
    if (m < 1 && this.rand() >= m) return -1;
    const mix = g.mix[a];
    if (mix > 0 && this.rand() < mix) k = g.dirB[a];
    return k;
  }

  // Stop cell i's motion along gravity and keep `keep` of the rest, as a
  // grain does when it lands.
  stopAlong(i, ux, uy, keep) {
    const vx = this.vx[i], vy = this.vy[i];
    const along = vx * ux + vy * uy;
    this.vx[i] = (vx - along * ux) * keep;
    this.vy[i] = (vy - along * uy) * keep;
  }
```

`movePowder`:

```js
  movePowder(i, x, y, d) {
    const a = this.air.at(x, y);
    const g = this.gravity;
    this.pushByAir(i, a, d, g.gx[a], g.gy[a]);
    if (d.fallRate < 1 && this.rand() > d.fallRate) return;
    const ux = g.ux[a], uy = g.uy[a];
    const k = this.downAt(a);
    let vx = this.vx[i], vy = this.vy[i];
    // A slow grain still drops a cell a frame.
    if (k >= 0) {
      const along = vx * ux + vy * uy;
      if (along < 1 && along > -0.5) { vx = vx - along * ux + ux; vy = vy - along * uy + uy; }
    }
    const j = this.travel(i, x, y, vx, vy, d, ux, uy);
    if (j !== i) {
      if (this.blockedMoving) this.stopAlong(j, ux, uy, 0.5);
      return;
    }
    if (k < 0) { // not falling this frame: just drifting
      if (this.blockedMoving) this.stopAlong(i, ux, uy, 0.5);
      return;
    }
    // Blocked straight away: slide off diagonally, like a grain on a slope.
    if (this.inBounds(x + DX8[k], y + DY8[k])) {
      let s = this.rand() < 0.5 ? 1 : 7;
      for (let n = 0; n < 2; n++, s = 8 - s) {
        const r = (k + s) & 7;
        const nx = x + DX8[r], ny = y + DY8[r];
        if (!this.inBounds(nx, ny)) continue;
        const jj = ny * this.w + nx;
        if (this.canEnter(d, jj, 1)) {
          this.swap(i, jj);
          this.vx[jj] = 0.5 * ux;
          this.vy[jj] = 0.5 * uy;
          return;
        }
      }
    }
    this.stopAlong(i, ux, uy, 0.5);
  }
```

`moveLiquid`:

```js
  moveLiquid(i, x, y, d) {
    const a = this.air.at(x, y);
    const g = this.gravity;
    this.pushByAir(i, a, d, g.gx[a], g.gy[a]);
    const ux = g.ux[a], uy = g.uy[a];
    const k = this.downAt(a);
    const pvx = this.vx[i], pvy = this.vy[i];
    let vx = pvx, vy = pvy;
    if (k >= 0) {
      const along = vx * ux + vy * uy;
      if (along < 1 && along > -0.5) { vx = vx - along * ux + ux; vy = vy - along * uy + uy; }
    }
    const j = this.travel(i, x, y, vx, vy, d, ux, uy);
    if (j !== i) {
      if (this.blockedMoving) this.stopAlong(j, ux, uy, 1);
      return;
    }
    if (k < 0) {
      if (this.blockedMoving) this.stopAlong(i, ux, uy, 1);
      return;
    }
    const { w } = this;
    // "Sideways" is across gravity: +1 is (px, py), a quarter turn
    // anticlockwise from down (right, when down is down).
    const px = uy, py = -ux;
    const across = pvx * px + pvy * py;
    const flow = across > 0.05 ? 1 : across < -0.05 ? -1 : (this.rand() < 0.5 ? -1 : 1);
    const fx = DX8[k], fy = DY8[k];

    // Diagonal down.
    if (this.inBounds(x + fx, y + fy)) {
      for (let n = 0, dir = flow; n < 2; n++, dir = -dir) {
        const r = (k + (dir > 0 ? 7 : 1)) & 7;
        const nx = x + DX8[r], ny = y + DY8[r];
        if (!this.inBounds(nx, ny)) continue;
        const jj = ny * w + nx;
        if (this.canEnter(d, jj, 1)) {
          this.swap(i, jj);
          this.vx[jj] = dir * 0.5 * px + 0.5 * ux;
          this.vy[jj] = dir * 0.5 * py + 0.5 * uy;
          return;
        }
      }
    }

    // (keep the existing comment block about rushing sideways)
    this.stopAlong(i, ux, uy, 1);
    if (d.viscosity > 0 && this.rand() < d.viscosity) return;
    const ax = x - fx, ay = y - fy;
    const above = this.inBounds(ax, ay) ? DEFS[this.type[ay * w + ax]].state : 0;
    const pushed = above === LIQUID || above === POWDER;
    const bx = x + fx, by = y + fy;
    const creep = this.inBounds(bx, by) && DEFS[this.type[by * w + bx]].state === LIQUID ? 0.1 : 0.01;
    for (let n = 0, dir = flow; n < 2; n++, dir = -dir) {
      const r = (k + (dir > 0 ? 6 : 2)) & 7;
      const sx = DX8[r], sy = DY8[r];
      let target = -1;
      let drop = false;
      for (let s = 1; s <= d.spread; s++) {
        const nx = x + sx * s, ny = y + sy * s;
        if (!this.inBounds(nx, ny)) break;
        const jj = ny * w + nx;
        if (!this.canEnter(d, jj, 0)) break;
        target = jj;
        const dx = nx + fx, dy = ny + fy;
        if (this.inBounds(dx, dy) && this.canEnter(d, dy * w + dx, 1)) { drop = true; break; }
      }
      if (target < 0) continue;
      if (!drop && !pushed) {
        if (this.rand() < creep) target = (y + sy) * w + x + sx; else continue;
      }
      this.swap(i, target);
      this.vx[target] = dir * 0.5 * px;
      this.vy[target] = dir * 0.5 * py;
      return;
    }
    this.vx[i] = -flow * 0.1 * px;
    this.vy[i] = -flow * 0.1 * py;
  }
```

`moveGas`:

```js
  // Gases (and drifting energy) rise against the gravity arrow and sink
  // along it, with a random jitter across it. Newtonian gravity pulls them
  // through their velocity only.
  moveGas(i, x, y, d) {
    const g = this.gravity;
    const a = this.air.at(x, y);
    this.pushByAir(i, a, d, 0, 0);
    const vx = this.vx[i], vy = this.vy[i];
    if (d.drift < 1 && this.rand() > d.drift && vx * vx + vy * vy < 0.25) return;
    let k = g.gasDir;
    if (g.gasMix > 0 && this.rand() < g.gasMix) k = g.gasDirB;
    const c = (k + 6) & 7; // across, a quarter turn from down
    const cx = DX8[c], cy = DY8[c], fx = DX8[k], fy = DY8[k];
    const lift = g.lift;
    const rise = lift > 0 ? d.rise * lift : ZERO_G_RISE;
    const sink = lift > 0 ? d.sink * lift : ZERO_G_SINK;
    const jitter = ((this.rand() * 3) | 0) - 1;
    const driftX = Math.floor(vx + this.rand());
    const lean = this.rand() < rise ? -1 : this.rand() < sink ? 1 : 0;
    const driftY = Math.floor(vy + this.rand());
    let dx = jitter * cx + lean * fx + driftX;
    let dy = jitter * cy + lean * fy + driftY;
    if (dx > 3) dx = 3; else if (dx < -3) dx = -3;
    if (dy > 3) dy = 3; else if (dy < -3) dy = -3;
    if (dx === 0 && dy === 0) return;
    const j = this.travel(i, x, y, dx, dy, d, g.gasUx, g.gasUy);
    if (j !== i) return;
    const side = this.rand() < 0.5 ? -1 : 1;
    const nx = x + side * cx, ny = y + side * cy;
    if (this.inBounds(nx, ny) && this.canEnter(d, ny * this.w + nx, 0)) this.swap(i, ny * this.w + nx);
  }
```

with module constants near `SEAL_COUNT`:

```js
// With no gravity, gases spread evenly: as likely to step either way.
const ZERO_G_RISE = 0.3;
const ZERO_G_SINK = 0.3 / 0.7;
```

(Task 5 adds the Newtonian pull to `moveGas`'s `pushByAir` call.)

- [ ] **Step 5: Edit `updateGlitter` in `src/sim/behaviors.js`**

```js
  updateGlitter(i, x, y, d) {
    if (--this.life[i] <= 0) { this.clearCell(i); return true; }
    const g = this.gravity, a = this.air.at(x, y);
    const vx = this.vx[i] * 0.96 + 0.04 * g.gx[a], vy = this.vy[i] * 0.96 + 0.04 * g.gy[a];
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.travel(i, x, y, vx, vy, d, g.ux[a], g.uy[a]);
    return true;
  },
```

- [ ] **Step 6: Run the new tests, the whole suite, and the baseline probe**

`& "$s\t.ps1" -Test test\gravity.test.js`, then `& "$s\t.ps1" -Test`, then `& "$s\t.ps1" "$s\baseprobe.mjs" check`. Expected: all pass; both scenes `SAME`. If a scene differs, find the formula that doesn't reduce exactly for `ux = 0, uy = 1` and fix it; don't touch the baseline.

---

### Task 4: Behaviours follow the arrow

**Files:**
- Modify: `src/sim/behaviors.js` (`burnOut`, `updateCloud`, `updateLightning`, `strike`, `updateGrow`, `updateSeed`, `updateFirework`, `updateSuperfluid`, `updateCritter`, `updateStalk`, `updateMeteor`)
- Modify: `src/sim/world.js` (`radiate` produce, `blast`)
- Modify: `src/sim/machines.js:71-76` (the plate)
- Test: `test/gravity.test.js` (append)

**Interfaces:**
- Consumes: `world.gravity.downX/downY` (4-way arrow), `world.gravity.dirA` (meteor), `world.inBounds`.

Rule for every edit: "below" is `(x + downX, y + downY)`, "above" is `(x - downX, y - downY)`, and "across" (right, when down is down) is `(x + px, y + py)` with `(px, py) = (downY, -downX)`, which is (1, 0) when down is (0, 1). Every bounds test becomes `this.inBounds(...)` on the new cell, evaluated in the same order as today's test so the random numbers line up.

- [ ] **Step 1: Write the failing tests** (append)

```js
test('a firework climbs against a sideways arrow', () => {
  const w = makeWorld(80, 40);
  const i = 20 * 80 + 60;
  w.spawn(i, ID.FIREWORK);
  w.ctype[i] = 1;
  w.life[i] = 30;
  w.setGravity({ angle: 270 }); // pulls right, so it climbs left
  run(w, 5);
  let x = -1;
  for (let k = 0; k < w.type.length; k++) if (w.type[k] === ID.FIREWORK) x = k % 80;
  assert.ok(x >= 0 && x < 55, `firework at x ${x}`);
});

test('a seed under a ceiling of dirt grows its trunk downwards when gravity points up', () => {
  const w = makeWorld(40, 40);
  fillRect(w, 5, 0, 34, 3, ID.DIRT);
  w.spawn(20 * 40 + 20, ID.SEED);
  w.setGravity({ angle: 180 });
  run(w, 600);
  let deepest = -1;
  for (let k = 0; k < w.type.length; k++) if (w.type[k] === ID.WOOD) deepest = Math.max(deepest, (k / 40) | 0);
  assert.ok(deepest > 6, `trunk reaches y ${deepest}`);
});

test('clouds rain along the arrow', () => {
  const w = makeWorld(60, 60);
  fillRect(w, 25, 25, 34, 29, ID.CLOUD);
  w.setGravity({ angle: 90, strength: 0 }); // no pull, but rain still falls left
  run(w, 400);
  let left = 0, right = 0;
  for (let k = 0; k < w.type.length; k++) {
    if (w.type[k] !== ID.WATER) continue;
    if (k % 60 < 25) left++; else if (k % 60 > 34) right++;
  }
  assert.ok(left > right, `${left} drops left, ${right} right`);
});
```

(If the cloud test proves flaky because water drifts with no gravity, raise the frame count or check water that is outside the cloud's box on each side, but keep the assertion's meaning.)

- [ ] **Step 2: Run them and see them fail** (firework still climbs up; seed trunk goes up; rain falls down).

- [ ] **Step 3: Edit each behaviour.** The replacements (old line → new):

`burnOut`, ember flames:
```js
        const { downX, downY } = this.gravity;
        const ax = x - downX, ay = y - downY;
        if (this.inBounds(ax, ay) && this.rand() < 0.25 && this.type[ay * this.w + ax] === 0) {
          const j = ay * this.w + ax;
```

`updateCloud`:
```js
  updateCloud(i, x, y) {
    const { downX, downY } = this.gravity;
    const bx = x + downX, by = y + downY;
    if (this.inBounds(bx, by) && this.rand() < 0.002) {
      const j = by * this.w + bx;
```

`updateLightning` (strikes along down, forking across):
```js
    const { downX, downY } = this.gravity;
    const px = downY, py = -downX;
    let cur = i, cx = x, cy = y;
    for (let s = 0; s < 4; s++) {
      const fork = ((this.rand() * 3) | 0) - 1;
      const nx = cx + fork * px + downX, ny = cy + fork * py + downY;
      if (!this.inBounds(nx, ny)) { this.strike(cur, cx, cy); return true; }
```

`strike` (the area turns with the arrow: 1 cell back, 3 ahead, 2 either side):
```js
    const { downX, downY } = this.gravity;
    const px = downY, py = -downX;
    for (let a = -1; a <= 3; a++) {
      for (let b = -2; b <= 2; b++) {
        const nx = x + b * px + a * downX, ny = y + b * py + a * downY;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
```

`updateGrow`:
```js
      if (j >= 0 && g.into[this.type[j]] && (!g.surface || this.openAbove(j))) {
```
with a new helper in `Behaviors`:
```js
  // Is the cell above j (against the gravity arrow) empty and in the world?
  openAbove(j) {
    const { downX, downY } = this.gravity;
    const x = (j % this.w) - downX, y = ((j / this.w) | 0) - downY;
    return this.inBounds(x, y) && this.type[y * this.w + x] === 0;
  },
```

`updateSeed`:
```js
    const { w, type } = this;
    const { downX, downY } = this.gravity;
    if (this.ctype[i] === 0) {
      const bx = x + downX, by = y + downY;
      if (this.inBounds(bx, by)) {
        const b = type[by * w + bx];
        ...
    }
    if (this.rand() > 0.12) return true;
    const ax = x - downX, ay = y - downY;
    if (this.life[i] > 0 && this.inBounds(ax, ay) && type[ay * w + ax] === 0) {
      const j = ay * w + ax;
      ...
    } else {
      const px = downY, py = -downX;
      const r = 3 + ((this.rand() * 3) | 0);
      for (let a = -r; a <= 1; a++) {
        for (let b = -r; b <= r; b++) {
          const nx = x + b * px + a * downX, ny = y + b * py + a * downY;
          if (nx < 0 || ny < 0 || nx >= w || ny >= this.h) continue;
          if ((b * b) / (r * r) + (a * a) / (r * r * 0.6) > 1) continue;
          const j = ny * w + nx;
          if (type[j] === 0 && this.rand() < 0.8) this.spawn(j, PLANT);
        }
      }
```

`updateFirework`:
```js
    const { w, type } = this;
    const { downX, downY } = this.gravity;
    if (--this.life[i] <= 0) { this.burst(i, x, y); return true; }
    const bx = x + downX, by = y + downY;
    if (this.inBounds(bx, by) && type[by * w + bx] === 0 && this.rand() < 0.6) {
      const t = by * w + bx;
      this.spawn(t, FIRE);
      this.life[t] = 6 + ((this.rand() * 8) | 0);
    }
    let cur = i, cx = x, cy = y;
    for (let s = 0; s < 2; s++) {
      const nx = cx - downX, ny = cy - downY;
      if (!this.inBounds(nx, ny)) { this.burst(cur, cx, cy); return true; }
      const next = ny * w + nx;
      const u = type[next];
      if (u !== 0 && !DEFS[u].displaceable) { this.burst(cur, cx, cy); return true; }
      this.swap(cur, next);
      cur = next; cx = nx; cy = ny;
    }
    return true;
```

`updateSuperfluid`:
```js
    const { w, type } = this;
    const { downX, downY } = this.gravity;
    const px = downY, py = -downX;
    const lx = x - px, ly = y - py, rx = x + px, ry = y + py;
    const l = this.inBounds(lx, ly) ? type[ly * w + lx] : WALL;
    const r = this.inBounds(rx, ry) ? type[ry * w + rx] : WALL;
    if (DEFS[l].state !== SOLID && DEFS[r].state !== SOLID) return false;
    const ax = x - downX, ay = y - downY;
    if (this.inBounds(ax, ay) && type[ay * w + ax] === 0 && this.rand() < 0.35) this.swap(i, ay * w + ax);
    return true;
```

`updateCritter` fall and walk:
```js
    const { downX, downY } = this.gravity;
    if (stranded || c.moves === 'walk' || c.moves === 'burrow') {
      // Fall if there is nothing underneath.
      const bx = x + downX, by = y + downY;
      if (this.inBounds(bx, by)) {
        const b = by * w + bx;
        const u = type[b];
        ...unchanged...
      }
    }
    ...
    if (c.moves === 'walk') {
      if (this.ctype[i] === 0) this.ctype[i] = this.rand() < 0.5 ? 1 : 2;
      const dir = this.ctype[i] === 1 ? 1 : -1;
      const sx = dir * downY, sy = -dir * downX; // a step across the arrow
      const nx = x + sx, ny = y + sy;
      if (!this.inBounds(nx, ny)) { this.ctype[i] = 3 - this.ctype[i]; return false; }
      const ax = x - downX, ay = y - downY;
      if (type[ny * w + nx] === 0) j = ny * w + nx;
      else if (this.inBounds(ax, ay) && type[ay * w + ax] === 0 && type[(ay + sy) * w + ax + sx] === 0) j = (ay + sy) * w + ax + sx; // climb a step
      else { this.ctype[i] = 3 - this.ctype[i]; return false; }
    }
```

`updateStalk`:
```js
    const { downX, downY } = this.gravity;
    const ax = x - downX, ay = y - downY;
    if (this.life[i] > 0 && this.inBounds(ax, ay) && this.rand() < s.rate) {
      const j = ay * this.w + ax;
```

`updateMeteor` (falls with the local pull, so it uses the block table):
```js
  updateMeteor(i, x, y, d) {
    const k = this.gravity.dirA[this.air.at(x, y)];
    if (k < 0) return false; // nothing to fall towards: it just drifts
    const nx = x + DX8[k], ny = y + DY8[k];
    if (this.inBounds(nx, ny) && this.canEnter(d, ny * this.w + nx, 1)) return false;
```
(import `DX8, DY8` from `./gravity.js` in behaviors.js)

`world.js` `radiate`, dropped fruit:
```js
      const { downX, downY } = this.gravity;
      const bx = x + downX, by = y + downY;
      const j = this.inBounds(bx, by) && this.type[by * this.w + bx] === 0 ? by * this.w + bx : -1;
```

`world.js` `blast`, turned to the arrow:
```js
    const { downX, downY } = this.gravity;
    const px = downY, py = -downX;
    ...
        const dist = Math.sqrt(d2);
        const f = (strength * 0.7) / dist;
        const across = dx * px + dy * py, along = dx * downX + dy * downY;
        const pushAcross = (across / dist) * f;
        const pushAlong = (along < 0 ? along / dist : -0.5 * along / dist) * f - f * 0.4;
        this.vx[j] += pushAcross * px + pushAlong * downX;
        this.vy[j] += pushAcross * py + pushAlong * downY;
```

`machines.js` plate:
```js
        const { downX, downY } = this.gravity;
        const ax = x - downX, ay = y - downY;
        const u = this.inBounds(ax, ay) ? this.type[ay * this.w + ax] : 0;
```

- [ ] **Step 4: Run the new tests, the whole suite and the probe** — all pass, both scenes `SAME`.

---

### Task 5: Newtonian gravity

**Files:**
- Modify: `src/sim/gravity.js` (add `G`, `SOFT`, `LENS`, `class Solver`, Newtonian handling in `set`/`fill`, `solve()`)
- Modify: `src/sim/lookups.js` (add `MASS`)
- Modify: `src/sim/world.js` (`stepGravity`, call it in `step`; gases get the field)
- Modify: `src/sim/particles.js` (`moveProjectile` bends paths)
- Test: `test/newtonian.test.js`

**Interfaces:**
- Produces: `Solver(cols, rows)` with `mass` (Float64Array cols*rows), `solve(fx, fy)`; `Gravity` gains `solver` (null until first use), `fx`, `fy` (null until first use), `stale`, `solve()`; `G`, `SOFT`, `LENS` exports; `MASS` in lookups; `world.stepGravity()`.

- [ ] **Step 1: Write the failing tests** (`test/newtonian.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { Solver, G, SOFT } from '../src/sim/gravity.js';
import { makeWorld, fillRect, run } from './helpers.js';

test('the FFT field matches adding up every pull directly', () => {
  const cols = 9, rows = 5, W = cols + 2;
  const s = new Solver(cols, rows);
  for (let k = 0; k < s.mass.length; k++) s.mass[k] = (k * 7919) % 13 === 0 ? 5 + (k % 3) : (k % 4) * 0.25;
  const fx = new Float32Array(W * (rows + 2)), fy = new Float32Array(W * (rows + 2));
  s.solve(fx, fy);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let ex = 0, ey = 0;
      for (let qy = 0; qy < rows; qy++) {
        for (let qx = 0; qx < cols; qx++) {
          if (qx === x && qy === y) continue;
          const dx = qx - x, dy = qy - y, r2 = dx * dx + dy * dy + SOFT;
          const f = (G * s.mass[qy * cols + qx]) / (r2 * Math.sqrt(r2));
          ex += f * dx; ey += f * dy;
        }
      }
      const o = (y + 1) * W + x + 1;
      assert.ok(Math.abs(fx[o] - ex) < 1e-5 && Math.abs(fy[o] - ey) < 1e-5, `block ${x},${y}`);
    }
  }
});

test('with Newtonian gravity off nothing is built; switching it off restores plain gravity', () => {
  const w = makeWorld(60, 40);
  fillRect(w, 20, 20, 30, 30, ID.SAND);
  run(w, 20);
  assert.equal(w.gravity.solver, null);
  assert.equal(w.gravity.fx, null);
  w.setGravity({ newtonian: true });
  run(w, 2);
  assert.ok(w.gravity.solver !== null);
  w.setGravity({ newtonian: false });
  const a = w.air.at(10, 10);
  assert.deepEqual([w.gravity.gx[a], w.gravity.gy[a]], [0, 1]);
});

test('a heavy block pulls loose sand in when there is no other gravity', () => {
  const w = makeWorld(120, 80);
  w.setGravity({ strength: 0, newtonian: true });
  fillRect(w, 50, 30, 69, 49, ID.STONE); // 400 cells of stone, 1000 units of mass
  const grains = [];
  for (let a = 0; a < 24; a++) {
    const x = Math.round(60 + Math.cos((a / 24) * Math.PI * 2) * 32);
    const y = Math.round(40 + Math.sin((a / 24) * Math.PI * 2) * 32);
    if (w.inBounds(x, y) && !w.type[y * 120 + x]) { w.spawn(y * 120 + x, ID.SAND); grains.push(1); }
  }
  const spread = () => {
    let sum = 0, n = 0;
    for (let i = 0; i < w.type.length; i++) {
      if (w.type[i] !== ID.SAND) continue;
      sum += Math.hypot((i % 120) - 59.5, ((i / 120) | 0) - 39.5); n++;
    }
    return sum / n;
  };
  const d0 = spread();
  run(w, 150);
  assert.ok(spread() < d0 - 8, `mean distance ${d0.toFixed(1)} to ${spread().toFixed(1)}`);
});

test('mass pulls towards itself, and a White Hole pushes away', () => {
  const w = makeWorld(80, 60);
  w.setGravity({ strength: 0, newtonian: true });
  fillRect(w, 38, 28, 41, 31, ID.STONE);
  w.step();
  const g = w.gravity;
  assert.ok(g.gx[w.air.at(60, 30)] < 0, 'right of the stone, the pull is to the left');
  assert.ok(g.gy[w.air.at(40, 10)] > 0, 'above it, the pull is down');
  const v = makeWorld(80, 60);
  v.setGravity({ strength: 0, newtonian: true });
  v.spawn(30 * 80 + 40, ID.WHITE_HOLE);
  v.step();
  assert.ok(v.gravity.gx[v.air.at(60, 30)] > 0, 'right of the White Hole, the push is to the right');
});

test('light bends as it passes a heavy mass', () => {
  const w = makeWorld(160, 100);
  w.setGravity({ strength: 0, newtonian: true });
  fillRect(w, 70, 60, 89, 79, ID.STONE);
  w.step();
  const k = w.spawnProjectile(ID.PHOTON, 5.5, 45.5, 2, 0);
  for (let f = 0; f < 30; f++) w.step();
  assert.ok(w.pvy[k] > 0.05, `photon now heading ${w.pvx[k].toFixed(2)}, ${w.pvy[k].toFixed(2)}`);
  assert.ok(Math.abs(Math.hypot(w.pvx[k], w.pvy[k]) - 2) < 1e-4, 'light keeps its speed');
});
```

(`k` stays valid only while no earlier-index particle dies; this world has one particle. Check `DEFS[PHOTON].life` is at least 31 frames; if not, lower the frame count and the threshold.)

- [ ] **Step 2: Run and see them fail.**

- [ ] **Step 3: Add `MASS` to `src/sim/lookups.js`**

```js
// Mass for Newtonian gravity: an element's density, except that walls,
// energy and flying particles weigh nothing, a few cosmic objects weigh a
// great deal, and a White Hole pushes instead of pulling.
export const MASS = new Float32Array(NUM);
for (const d of DEFS) {
  MASS[d.id] = d.id === 0 || d.id === ID.WALL || d.state === ENERGY || d.projectile ? 0 : d.density;
}
MASS[ID.BLACK_HOLE] = 2000;
MASS[ID.PULSAR] = 1000;
MASS[ID.STAR] = 200;
MASS[ID.DARK_MATTER] = 50; // invisible, but it weighs something
MASS[ID.WHITE_HOLE] = -500;
```

- [ ] **Step 4: Add the solver and Newtonian handling to `src/sim/gravity.js`**

```js
import { FFT } from './fft.js';

// Newtonian gravity. G is the pull, in g, of one unit of mass (a cell of
// water) one air block away; the pull falls off as 1/r², softened inside a
// block by SOFT (blocks squared). LENS is how hard the field bends the path
// of a flying particle, per g per frame.
export const G = 0.0125;
export const SOFT = 0.5;
export const LENS = 0.05;
```

Add to the header comment: "With Newtonian gravity on, the pull of every block's mass on every other block is solved every other frame by an FFT convolution (Solver below), and the table is refilled after each solve. Nothing is built until it is first switched on."

```js
const pow2 = (n) => { let p = 1; while (p < n) p <<= 1; return p; };

// The pull at every air block from the mass in every other: a convolution
// of the mass grid with the pull of one unit of mass, done with FFTs on a
// grid padded to twice the size (so the pull doesn't wrap around). The x
// and y pulls are solved together as the real and imaginary parts of one
// transform: the kernel is Kx + i*Ky, and both results are real.
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
    const { nx, fftX, fftY } = this;
    if (!inverse) {
      for (let y = 0; y < rowsIn; y++) fftX.run(re, im, y * nx, 1, false);
      for (let x = 0; x < nx; x++) fftY.run(re, im, x, nx, false);
    } else {
      for (let x = 0; x < nx; x++) fftY.run(re, im, x, nx, true);
      for (let y = 0; y < rowsOut; y++) fftX.run(re, im, y * nx, 1, true);
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
```

In `Gravity`: constructor adds

```js
    this.solver = null; // built the first time Newtonian gravity is switched on
    this.fx = null; // the Newtonian part of the pull per block, in g
    this.fy = null;
    this.stale = false; // switched on since the last solve
```

`set` becomes:

```js
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
```

`fill` becomes:

```js
  fill() {
    if (this.newtonian) {
      const { fx, fy, ugx, ugy } = this;
      for (let i = 0; i < fx.length; i++) this.setBlock(i, ugx + fx[i], ugy + fy[i]);
      return;
    }
    ...the uniform fill from Task 2...
  }
```

- [ ] **Step 5: Wire it into the world** (`src/sim/world.js`)

Import `MASS` from `./lookups.js`. In `step()`, right after `const tick = ++this.tick;`:

```js
    this.stepGravity();
```

New method (after `step`):

```js
  // Newtonian gravity: weigh each air block and solve the pull every other
  // frame (and straight away after it's switched on). Nothing runs while
  // it's off.
  stepGravity() {
    const g = this.gravity;
    if (!g.newtonian || (!g.stale && (this.tick & 1) === 1)) return;
    const { mass, cols } = g.solver;
    mass.fill(0);
    const { w, h, type } = this;
    for (let y = 0; y < h; y++) {
      const row = ((y / CELL) | 0) * cols, base = y * w;
      for (let x = 0; x < w; x++) {
        const t = type[base + x];
        if (t !== 0) mass[row + ((x / CELL) | 0)] += MASS[t];
      }
    }
    g.solve();
  }
```

`moveGas`'s first lines:

```js
    if (g.newtonian) this.pushByAir(i, a, d, g.fx[a], g.fy[a]);
    else this.pushByAir(i, a, d, 0, 0);
```

- [ ] **Step 6: Bend flying particles** (`src/sim/particles.js`, in `moveProjectile` after the magnet block; import `LENS` from `./gravity.js`)

```js
    // Newtonian gravity bends every flying particle's path; its speed holds.
    const g = this.gravity;
    if (g.newtonian) {
      const a = this.air.at(this.px[k] | 0, this.py[k] | 0);
      const fx = g.fx[a], fy = g.fy[a];
      if (fx !== 0 || fy !== 0) {
        const vx = this.pvx[k], vy = this.pvy[k];
        const nx = vx + fx * LENS, ny = vy + fy * LENS;
        const f = Math.hypot(vx, vy) / (Math.hypot(nx, ny) || 1);
        this.pvx[k] = nx * f;
        this.pvy[k] = ny * f;
      }
    }
```

- [ ] **Step 7: Run the tests; tune `G` and `LENS` with a probe if needed**

Run `test/newtonian.test.js`. If "pulls loose sand in" or "light bends" miss, write `newtonprobe.mjs` printing the field at the stone's surface and the mean distance over time, and adjust `G` (target: about 1 g at the surface of a 40-cell sand disc) or `LENS`. Then run the whole suite and the probe: all pass, both `SAME`.

- [ ] **Step 8: Measure** the demo scene ms/step with Newtonian on (probe: `sceneprobe.mjs` variant calling `w.setGravity({ newtonian: true })` after loading). Target: under 2 ms extra per step on average. If over, solve every third frame.

---

### Task 6: Convection

**Files:**
- Modify: `src/sim/air.js` (temperature grid, `stepHeat`, constants)
- Modify: `src/sim/world.js` (`setConvection`, `conductHeat`, `air.step(this.gravity)`)
- Test: `test/convection.test.js`

**Interfaces:**
- Produces: `air.t` (Float32Array, `W*H`), `air.heat` (boolean), `air.step(gravity)`, exports `AIR_SHARE`, `EXPAND`; `world.setConvection(on)`.

- [ ] **Step 1: Write the failing tests** (`test/convection.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID, AMBIENT } from '../src/sim/elements.js';
import { SNUFF_AT } from '../src/sim/behaviors.js';
import { makeWorld, fillRect, wallBox, countOf, run } from './helpers.js';

// A block of metal at 1400 degrees hanging in the middle of an open world.
function hotBlock(angle = 0) {
  const w = makeWorld(100, 80);
  fillRect(w, 44, 36, 55, 43, ID.METAL);
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.METAL) w.temp[i] = 1400;
  w.setGravity({ angle });
  w.setConvection(true);
  return w;
}

const airT = (w, x, y) => w.air.t[w.air.at(x, y)];
const avgTemp = (w) => {
  let s = 0, n = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.METAL) { s += w.temp[i]; n++; }
  return s / n;
};

test('with convection off the air has no temperature of its own', () => {
  const w = makeWorld(60, 40);
  fillRect(w, 25, 15, 34, 24, ID.METAL);
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.METAL) w.temp[i] = 1400;
  run(w, 100);
  assert.ok(w.air.t.every((t) => t === AMBIENT));
});

test('a hot block heats the air above it, and the warm air rises', () => {
  const w = hotBlock();
  run(w, 300);
  const above = airT(w, 50, 28), below = airT(w, 50, 52);
  assert.ok(above > below + 5, `above ${above.toFixed(1)}, below ${below.toFixed(1)}`);
  assert.ok(w.air.cvy(w.air.at(50, 30)) < -0.05, 'air above is moving up');
});

test('turning the arrow turns the plume', () => {
  const w = hotBlock(180);
  run(w, 300);
  assert.ok(airT(w, 50, 52) > airT(w, 50, 28) + 5, 'with gravity up, the warm air goes down');
});

test('cool air flows in towards the base of the plume', () => {
  const w = hotBlock();
  run(w, 300);
  const left = w.air.cvx(w.air.at(38, 44)), right = w.air.cvx(w.air.at(62, 44));
  assert.ok(left > 0 && right < 0, `left ${left.toFixed(3)}, right ${right.toFixed(3)}`);
});

test('heating pushes the air out; the block slowly cools', () => {
  const w = hotBlock();
  run(w, 5);
  assert.ok(w.pressureAt(50, 33) > 0, 'pressure rises beside the hot block');
  const t0 = avgTemp(w);
  run(w, 600);
  assert.ok(avgTemp(w) < t0 - 20, `cooled from ${t0.toFixed(0)} to ${avgTemp(w).toFixed(0)}`);
});

test('a fire in a sealed box still goes out with convection on', () => {
  const w = makeWorld(60, 50);
  w.setConvection(true);
  const box = wallBox(w, 10, 10, 49, 49);
  fillRect(w, box.x0, 40, box.x1, box.y1, ID.WOOD);
  const wood = countOf(w, ID.WOOD);
  fillRect(w, box.x0, 38, box.x1, 39, ID.FIRE);
  let lowest = 0;
  run(w, 1500, () => { lowest = Math.min(lowest, w.pressureAt(30, 30)); });
  assert.ok(lowest < SNUFF_AT, `lowest ${lowest.toFixed(1)}`);
  assert.equal(countOf(w, ID.FIRE), 0, 'the fire went out');
  assert.ok(countOf(w, ID.WOOD) > wood * 0.5);
});
```

(`AMBIENT` is exported from `elements.js`; if not, import it from `constants.js`.)

- [ ] **Step 2: Run and see them fail** (`setConvection` is not a function).

- [ ] **Step 3: Add air temperature to `src/sim/air.js`**

Header comment addition: "With convection on (`heat`), each block also has an air temperature. Particles trade heat with it (world.js, conductHeat); heating the air raises its pressure and cooling lowers it; warm air is pushed against gravity; the flow carries the heat along; and the air slowly gives its heat back to the room. The border ring stays at room temperature."

```js
import { AMBIENT } from './constants.js';

// Convection. A degree lost by a particle warms its block's air by
// AIR_SHARE degrees (air holds little heat); each degree the air gains
// raises its pressure by EXPAND. Warm air is pushed against gravity by
// BUOYANCY per degree per g per frame, and loses AIR_TEMP_LOSS of its
// excess heat a frame. HEAT_SMOOTH blurs it a little, like the pressure.
export const AIR_SHARE = 3;
export const EXPAND = 0.004;
const BUOYANCY = 0.0002;
const AIR_TEMP_LOSS = 0.004;
const HEAT_SMOOTH = 0.1;
```

Constructor:

```js
    this.t = new Float32Array(n).fill(AMBIENT); // air temperature, with convection on
    this.heat = false;
```

`clear()` adds `this.t.fill(AMBIENT);`.

`step()` becomes `step(gravity)` and ends with:

```js
    if (this.heat) this.stepHeat(gravity.gx, gravity.gy);
```

New method:

```js
  stepHeat(gx, gy) {
    const { W, H, t, vx, vy, p, blocked, scratch } = this;

    // 1. Warm air is pushed against gravity; cool air sinks with it.
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

    // 2. The flow carries the heat: each block takes the temperature from
    // where its air came from, traced back along the flow.
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
        const at = (j) => (blocked[j] ? own : scratch[j]);
        const top = at(y0 * W + x0) * (1 - fx) + at(y0 * W + x1) * fx;
        const bottom = at(y1 * W + x0) * (1 - fx) + at(y1 * W + x1) * fx;
        t[i] = top * (1 - fy) + bottom * fy;
      }
    }

    // 3. A little blurring, then 4. the room soaks up the heat; air that
    // cools contracts.
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
```

(The `at` closure allocates per block; if the speed check in Step 6 shows it matters, inline it.)

- [ ] **Step 4: Update `src/sim/world.js`**

Import `AIR_SHARE, EXPAND` from `./air.js`. In `step()`: `air.step(this.gravity);`.

```js
  // Convection on or off. Off, the air forgets any heat it held.
  setConvection(on) {
    this.air.heat = !!on;
    if (!on) this.air.t.fill(AMBIENT);
  }
```

`conductHeat`: take `const { air } = this; const heat = air.heat, airT = air.t, airP = air.p, sealed = air.blocked;` at the top and replace the open-air line with:

```js
        if (open) {
          if (heat) {
            const a = air.at(x, y);
            if (sealed[a]) T += (AMBIENT - T) * AIR_COOL[t] * open;
            else {
              // Trade heat with the block's air; the air warms more than
              // the particle cools, and swells as it warms.
              const f = (airT[a] - T) * AIR_COOL[t] * open;
              T += f;
              let na = airT[a] - f * AIR_SHARE;
              if ((f < 0 && na > T) || (f > 0 && na < T)) na = T; // never past the particle
              airP[a] += (na - airT[a]) * EXPAND;
              airT[a] = na;
            }
          } else {
            T += (AMBIENT - T) * AIR_COOL[t] * open;
          }
        }
```

- [ ] **Step 5: Run the convection tests and tune** with `convprobe.mjs` (prints air temperature above/below, `cvy` above, `cvx` at the base, pressure beside, the block's mean temperature every 50 frames). Adjust `AIR_SHARE`, `BUOYANCY`, `EXPAND`, `AIR_TEMP_LOSS` until the tests pass with margin; then the sealed-fire test; then the whole suite and the probe (`SAME`: convection is off there).

- [ ] **Step 6: Measure** demo-scene ms/step with convection on. Target: under 1 ms extra.

---

### Task 7: Views

**Files:**
- Modify: `src/render/renderer.js` (`paint`, empty cells in the heat view)
- Modify: `src/game/ui.js` (`renderHud`)

- [ ] **Step 1: Heat view shows the air's temperature** — in `paint`, the empty-cell branch:

```js
        if (t === 0) {
          if (doorTimer[i] !== 0 && !heatView) {
            ...unchanged...
          } else {
            if (airHeat) {
              // With convection on, the heat view shows warm and cold air.
              const at = air.t[air.at(x, y)];
              if (at > AMBIENT + 2 || at < AMBIENT - 2) {
                const k = heatIndex(at) * 3;
                pixels[i] = pack((bgR + (HEAT[k] - bgR) * 0.45) | 0, (bgG + (HEAT[k + 1] - bgG) * 0.45) | 0,
                  (bgB + (HEAT[k + 2] - bgB) * 0.45) | 0);
                continue;
              }
            }
            if (!pressureView) { pixels[i] = bg; continue; }
            r = bgR; g = bgG; b = bgB;
          }
```

with `const airHeat = heatView && air.heat;` next to `heatView`, and `AMBIENT` imported from `../sim/elements.js` (check the renderer's existing imports; `elements.js` re-exports it).

- [ ] **Step 2: HUD shows the air temperature** (`renderHud`):

```js
      const airTemp = world.air.heat ? `${sep}air ${fmtTemp(world.air.t[world.air.at(hover.x, hover.y)])}` : '';
      cell.innerHTML = `<b>${esc(name)}</b>${temp}${airTemp}${sep}pressure ...`;
```

- [ ] **Step 3: Check** in the browser pane during Task 8 (heat view with convection on shows a plume over a hot block).

---

### Task 8: Physics panel

**Files:**
- Create: `src/game/physics-panel.js`
- Modify: `index.html` (section between `.hud` and `.tree`), `style.css`, `src/main.js`
- Test: `test/physics-panel.test.js`

**Interfaces:**
- Consumes: `world.setGravity`, `world.setConvection`, `MAX_STRENGTH`.
- Produces: `angleText(deg)`, `parseStrength(text)`, `dialAngle(dx, dy, snap)`, `loadSettings(storage)`, `saveSettings(settings, storage)`, `DEFAULTS`, `class PhysicsPanel(world, doc = document)`.

- [ ] **Step 1: Write the failing tests** (`test/physics-panel.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angleText, parseStrength, dialAngle, loadSettings, saveSettings, DEFAULTS } from '../src/game/physics-panel.js';

test('angles read as directions at multiples of 45 degrees', () => {
  assert.equal(angleText(0), 'Down');
  assert.equal(angleText(90), 'Left');
  assert.equal(angleText(225), 'Up-right');
  assert.equal(angleText(30), '30°');
});

test('the strength box accepts numbers from 0 to 10', () => {
  assert.equal(parseStrength('2.5'), 2.5);
  assert.equal(parseStrength(' 3x '), 3);
  assert.equal(parseStrength('1,5'), 1.5);
  assert.equal(parseStrength('40'), 10);
  assert.equal(parseStrength('-2'), 0);
  assert.equal(parseStrength('abc'), null);
  assert.equal(parseStrength(''), null);
});

test('the dial turns to where the pointer is', () => {
  assert.equal(dialAngle(0, 10), 0); // below the centre: down
  assert.equal(dialAngle(-10, 0), 90); // left
  assert.equal(dialAngle(0, -10), 180); // up
  assert.equal(dialAngle(10, 0), 270); // right
  assert.equal(dialAngle(-10, 12, true), 45, 'Shift snaps to 45');
});

test('settings survive a save and load, and bad or missing storage gives the defaults', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  saveSettings({ angle: 30, strength: 2, newtonian: true, convection: true }, storage);
  assert.deepEqual(loadSettings(storage), { angle: 30, strength: 2, newtonian: true, convection: true });
  store.set('sandbox-crafter:physics', '{bad json');
  assert.deepEqual(loadSettings(storage), DEFAULTS);
  assert.deepEqual(loadSettings(undefined), DEFAULTS);
});
```

- [ ] **Step 2: Run and see them fail.**

- [ ] **Step 3: Write `src/game/physics-panel.js`**

```js
// The Physics panel under the game: which way gravity pulls (a dial you
// turn), how hard (a text box), Newtonian gravity and convection. Settings
// are kept in localStorage, guarded like saved progress, and applied to the
// world at start.

import { MAX_STRENGTH } from '../sim/gravity.js';

const KEY = 'sandbox-crafter:physics';
export const DEFAULTS = Object.freeze({ angle: 0, strength: 1, newtonian: false, convection: false });
const NAMES = ['Down', 'Down-left', 'Left', 'Up-left', 'Up', 'Up-right', 'Right', 'Down-right'];
const TURN = { ArrowRight: 15, ArrowUp: 15, ArrowLeft: -15, ArrowDown: -15, PageUp: 45, PageDown: -45 };

const wrap = (a) => ((Math.round(a) % 360) + 360) % 360;

// "Down", "Up-left"... at multiples of 45 degrees, otherwise the angle.
export function angleText(deg) {
  return deg % 45 === 0 ? NAMES[deg / 45] : `${deg}°`;
}

// The strength typed into the box (a trailing x is fine), kept to 0-10,
// or null if it can't be read.
export function parseStrength(text) {
  const s = String(text ?? '').trim().replace(/\s*[x×]$/i, '').replace(',', '.');
  if (s === '') return null;
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return Math.min(MAX_STRENGTH, Math.max(0, Math.round(v * 100) / 100));
}

// The dial's angle for a pointer (dx, dy) from its centre: whole degrees
// clockwise from straight down, 0-359. `snap` rounds to 45.
export function dialAngle(dx, dy, snap = false) {
  const a = (Math.atan2(-dx, dy) * 180) / Math.PI;
  const step = snap ? 45 : 1;
  return wrap(Math.round(a / step) * step);
}

export function loadSettings(storage = globalThis.localStorage) {
  try {
    const data = JSON.parse(storage.getItem(KEY));
    if (!data || typeof data !== 'object') return { ...DEFAULTS };
    return {
      angle: Number.isFinite(data.angle) ? wrap(data.angle) : DEFAULTS.angle,
      strength: parseStrength(data.strength) ?? DEFAULTS.strength,
      newtonian: !!data.newtonian,
      convection: !!data.convection,
    };
  } catch {
    return { ...DEFAULTS }; // unreadable or unavailable storage
  }
}

export function saveSettings(settings, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Nothing to do; the settings just won't be remembered.
  }
}

export class PhysicsPanel {
  constructor(world, doc = document) {
    this.world = world;
    this.doc = doc;
    const $ = (id) => doc.getElementById(id);
    this.dial = $('grav-dial');
    this.arrow = $('grav-arrow');
    this.readout = $('grav-angle');
    this.box = $('grav-strength');
    this.newton = $('grav-newton');
    this.convect = $('convection');
    this.settings = loadSettings();
    this.bind($('physics-reset'));
    this.apply();
  }

  // Push the settings into the world and the controls, and save them.
  apply() {
    const s = this.settings;
    this.world.setGravity({ angle: s.angle, strength: s.strength, newtonian: s.newtonian });
    this.world.setConvection(s.convection);
    this.arrow.setAttribute('transform', `rotate(${s.angle})`);
    this.dial.setAttribute('aria-valuenow', String(s.angle));
    this.dial.setAttribute('aria-valuetext', angleText(s.angle));
    this.readout.textContent = angleText(s.angle);
    if (this.doc.activeElement !== this.box) this.box.value = String(s.strength);
    this.newton.checked = s.newtonian;
    this.convect.checked = s.convection;
    saveSettings(s);
  }

  update(change) {
    Object.assign(this.settings, change);
    this.apply();
  }

  bind(reset) {
    const { dial, box } = this;
    const turnTo = (e) => {
      const r = dial.getBoundingClientRect();
      const a = dialAngle(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), e.shiftKey);
      if (a !== this.settings.angle) this.update({ angle: a });
    };
    dial.addEventListener('pointerdown', (e) => { dial.setPointerCapture(e.pointerId); turnTo(e); });
    dial.addEventListener('pointermove', (e) => { if (dial.hasPointerCapture(e.pointerId)) turnTo(e); });
    dial.addEventListener('dblclick', () => this.update({ angle: 0 }));
    dial.addEventListener('keydown', (e) => {
      let a;
      if (TURN[e.key] !== undefined) a = wrap(this.settings.angle + TURN[e.key]);
      else if (e.key === 'Home') a = 0;
      else return;
      e.preventDefault();
      e.stopPropagation(); // arrow keys would also pan the camera
      this.update({ angle: a });
    });
    const commit = () => {
      const v = parseStrength(box.value);
      if (v !== null && v !== this.settings.strength) this.update({ strength: v });
      box.value = String(this.settings.strength);
    };
    box.addEventListener('change', commit);
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { commit(); box.blur(); }
      else if (e.key === 'Escape') { box.value = String(this.settings.strength); box.blur(); }
    });
    this.newton.addEventListener('change', () => this.update({ newtonian: this.newton.checked }));
    this.convect.addEventListener('change', () => this.update({ convection: this.convect.checked }));
    reset.addEventListener('click', () => { this.settings = { ...DEFAULTS }; this.apply(); });
  }
}
```

- [ ] **Step 4: Markup** — in `index.html`, between `</div>` closing `.hud` and `<section class="tree"`:

```html
      <section class="physics" aria-labelledby="physics-title">
        <h2 class="physics-title" id="physics-title">Physics</h2>
        <div class="physics-gravity">
          <span class="physics-label" id="grav-label">Gravity</span>
          <button type="button" class="dial" id="grav-dial" role="slider" aria-labelledby="grav-label"
            aria-valuemin="0" aria-valuemax="359" aria-valuenow="0" aria-valuetext="Down"
            title="Drag to turn gravity (Shift snaps to 45°). Arrow keys turn it 15°, double-click resets.">
            <svg viewBox="-20 -20 40 40" aria-hidden="true">
              <path class="dial-ticks" d="M0 -18v3M0 15v3M-18 0h3M15 0h3"/>
              <g id="grav-arrow"><path class="dial-arrow" d="M-2 -12h4v12h5L0 13-7 0h5z"/></g>
            </svg>
          </button>
          <output id="grav-angle" for="grav-dial">Down</output>
        </div>
        <label class="physics-strength">Strength
          <input type="text" id="grav-strength" inputmode="decimal" autocomplete="off" spellcheck="false" value="1" aria-describedby="grav-strength-hint">
          <span aria-hidden="true">×</span>
          <span class="sr-only" id="grav-strength-hint">Times normal gravity, from 0 to 10</span>
        </label>
        <label class="physics-toggle"><input type="checkbox" id="grav-newton"> Newtonian gravity</label>
        <label class="physics-toggle"><input type="checkbox" id="convection"> Convection</label>
        <button type="button" class="physics-reset" id="physics-reset" title="Down, strength 1, both off">Reset</button>
      </section>
```

- [ ] **Step 5: Styles** — in `style.css`, a new block before the recipe-tree block:

```css
/* ---- physics panel ------------------------------------------------------ */

.physics {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 18px;
  width: 100%;
  max-width: var(--screen-w);
  min-width: min(100%, 320px);
  margin-inline: auto;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  font-size: 13px;
}
.physics-title { margin: 0; font: 700 15px/1 var(--font-display); }
.physics-gravity { display: flex; align-items: center; gap: 8px; }
.physics-label, .physics-strength { color: var(--muted); }
.dial {
  display: block;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  background: var(--panel-2);
  touch-action: none;
  cursor: grab;
}
.dial:active { cursor: grabbing; }
.dial:hover { border-color: var(--brass); }
.dial svg { display: block; width: 100%; height: 100%; }
.dial-ticks { fill: none; stroke: var(--faint); stroke-width: 1.5; }
.dial-arrow { fill: var(--brass); }
#grav-angle { min-width: 10ch; font: 12px var(--font-mono); color: var(--text); }
.physics-strength { display: flex; align-items: center; gap: 6px; }
.physics-strength input {
  width: 6ch;
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--panel-2);
  color: var(--text);
  font: 13px var(--font-mono);
  text-align: right;
}
.physics-strength input:focus-visible { outline: 2px solid var(--brass); outline-offset: 0; border-color: transparent; }
.physics-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.physics-toggle input { margin: 0; accent-color: var(--brass); }
.physics-reset {
  margin-left: auto;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--panel-2);
  font-size: 12px;
}
.physics-reset:hover { border-color: var(--brass); }
```

Also: add `.physics` to the `@media (max-width: 980px)` rule's `max-width: none` list, and change `--screen-w` to `calc((100dvh - 310px) * 5 / 3)` with the comment "leaves room below for the HUD and the Physics strip" (check in the browser that the game and the strip both fit at 1080p and 768p heights; adjust the 310).

- [ ] **Step 6: Wire it in `src/main.js`**

```js
import { PhysicsPanel } from './game/physics-panel.js';
```

after `loadDemoScene(world);`:

```js
new PhysicsPanel(world);
```

- [ ] **Step 7: Run the panel tests, then check in the browser pane** (dev server `npm start` via `preview_start`): the strip sits between the HUD and the tree; dragging the dial turns sand sideways; typing 0 leaves sand hanging; Newtonian with strength 0 gathers a blob; convection plus the heat view shows a plume over a heated metal block; reload keeps the settings; no console errors; narrow width (375px) wraps cleanly.

---

### Task 9: Docs, build, full check

**Files:**
- Modify: `README.md`, `HANDOFF.md`
- Build: `dist/sandbox-crafter.html`

- [ ] **Step 1: README** — a "Physics panel" section after the view/controls section:

```markdown
### Physics panel

Under the game, between the status line and the recipe tree:

- **Gravity dial.** Drag the arrow to point gravity any way you like (Shift
  snaps to 45°; arrow keys turn it 15°; double-click resets it to down).
  Sand piles against whichever wall is "down", water pools on the ceiling
  when it points up, and smoke and steam rise the other way. Trees, stalks,
  fireworks, rain and walking creatures follow the arrow too.
- **Strength.** A multiple of normal gravity, from 0 to 10. At 0 nothing
  falls: grains and drops hang where you paint them and drift with the air.
- **Newtonian gravity.** Everything with mass pulls on everything else, as in
  The Powder Toy. Mass is density (Water is 1), so a lump of lead pulls
  harder than a cloud of steam; Neutronium, Pulsars and Black Holes are very
  heavy, and a White Hole pushes things away. Light bends as it passes heavy
  things. Set the strength to 0 and draw a big blob to make a planet: loose
  sand falls onto it from every side and gases gather round it.
- **Convection.** The air gets a temperature. Hot things warm the air around
  them, the warm air swells and rises (against the arrow), cools as it goes,
  and cooler air flows back in underneath, so a hot block slowly cools in a
  loop of moving air. Smoke and steam ride the currents. The Heat view shows
  the warm air.
- **Reset** puts everything back: down, strength 1, both off. The settings are
  remembered in your browser.
```

Plus: add the new files to the layout block (`src/sim/gravity.js`, `src/sim/fft.js`, `src/game/physics-panel.js`), and update the test count.

- [ ] **Step 2: HANDOFF** — layout rows for `gravity.js` (gravity table, Newtonian solver), `fft.js`, `physics-panel.js`; a "Gravity" note: movement reads `world.gravity`'s per-block table (`gx, gy, ux, uy, mag, dirA/dirB/mix`); behaviours use the 4-way `downX/downY`; the default must stay bit-identical (the scratchpad fingerprint approach); Newtonian gravity is built lazily and solved every other frame; `MASS` is in lookups. A "Convection" note: `air.t`, `AIR_SHARE`, `EXPAND`, `BUOYANCY`, `AIR_TEMP_LOSS`; off means `conductHeat`'s old branch. Update the test count; add the three new source files to the published file list.

- [ ] **Step 3: Build** — `& "$s\t.ps1" scripts\build.js`; `test/build.test.js` passes (it checks every module is inlined).

- [ ] **Step 4: Full run** — whole suite passes; baseline probe `SAME`; ms/step for the demo scene with defaults, Newtonian on, convection on, both on. Open `dist/sandbox-crafter.html` in the browser pane from disk and check the panel works there too.
