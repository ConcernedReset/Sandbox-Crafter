# Sleeping Areas and Performance Setting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skip the simulation where nothing is happening (sleeping chunks, still air), and add an Auto/High/Medium/Low performance setting.

**Architecture:** A `Sleep` mix-in keeps an awake flag per 16 × 16 chunk, compares each chunk with a snapshot after every step to wake it (and its neighbours) on any change, and lets a chunk sleep after 8 quiet steps when a restless check finds nothing that can change on its own. The step skips `update` and most of `conductHeat` for sleeping chunks; the air skips its whole step while still. Quality levels set how often heat and air run and the flying-particle cap; a small Auto controller in `src/game/performance.js` picks the level from frame times.

**Tech Stack:** Plain ES modules, `node:test`, Node via VS Code's Electron.

**Spec:** `docs/superpowers/specs/2026-10-06-sleeping-areas-performance-design.md`

## Global Constraints

- Run tests with `ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" --test test/<file>.test.js < /dev/null` (always redirect stdin).
- No new dependencies; match the surrounding comment density and naming.
- At the default setting (Auto starting at High) the game must behave as now: every existing test passes.
- CHUNK = 16; SLEEP_AFTER = 8; AIR_STILL = 0.01 (pressure and wind); HEAT_STILL = 0.1 °C (air and particles).
- Medium: heat every other step at two steps' rate, air every other step. Low: Medium + one step per drawn frame + 4,000 flying particles. Auto: down after AUTO_DOWN = 60 frames over budget (1000/60 ms), up after AUTO_UP = 180 frames under half; starts at High.
- Saved key: `sandbox-crafter:performance` ('auto' | 'high' | 'medium' | 'low'; bad storage → 'auto').
- Gas and Glow are untouched at every level.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; never add `.claude/`. Don't push.

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `src/sim/sleep.js` (new) | `Sleep` mix-in and `initSleep`: chunk arrays, snapshot compare, waking, restless check, `wakeAll`, `asleepAt` |
| `src/sim/air.js` | `settle()`: the still-air check, snap and skip |
| `src/sim/world.js` | Hooks: skip sleeping updates and heat, call `stepSleep`, `wakeAll` in setters, `setQuality` and the heat/air rates |
| `src/game/performance.js` (new) | `LEVELS`, `AutoQuality`, `loadPerformance`, `savePerformance` |
| `src/main.js`, `index.html`, `style.css` | Menu entries, Auto feeding and readout, one step per frame at Low |
| `src/render/renderer.js` | Sleeping-area outlines |
| `test/sleep.test.js`, `test/performance.test.js` (new) | Tests |

---

### Task 1: Still air

**Files:**
- Modify: `src/sim/air.js` (new `settle()`, called at the top of `step`)
- Test: `test/sleep.test.js` (create)

**Interfaces:**
- Produces: `Air.still` (boolean, true after a step that found the grid still), `Air.settle() → boolean`; `AIR_STILL = 0.01`, `HEAT_STILL = 0.1` exported from `air.js`.

- [ ] **Step 1: Write the failing test**

Create `test/sleep.test.js`:

```js
// Sleeping areas: what isn't changing isn't simulated, until something
// reaches it. The world must behave just as it would awake.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, run } from './helpers.js';

test('the air rests when it is still, and wakes when stirred', () => {
  const w = makeWorld(80, 40);
  w.setConvection(true);
  run(w, 5);
  assert.equal(w.air.still, true, 'still air rests');
  w.pressurize(40, 20, 3, 5);
  run(w, 1);
  assert.equal(w.air.still, false, 'a puff wakes it');
  run(w, 2000);
  assert.equal(w.air.still, true, 'and it settles again');
  assert.ok(w.air.p.every((v) => v === 0), 'settled to exactly nothing');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `... --test test/sleep.test.js < /dev/null` — FAIL (`w.air.still` undefined).

- [ ] **Step 3: Implement**

In `src/sim/air.js`, near the other constants:

```js
// Air this close to rest (pressure and wind within AIR_STILL, air within
// HEAT_STILL degrees of room temperature) is at rest: it's set to exactly
// still and not stepped until something stirs it (see settle).
export const AIR_STILL = 0.01;
export const HEAT_STILL = 0.1;
```

Constructor: `this.still = false;`. Method:

```js
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
    p.fill(0);
    vx.fill(0);
    vy.fill(0);
    t.fill(AMBIENT);
    this.tPressed.fill(AMBIENT);
    return (this.still = true);
  }
```

In `step(gravity)`, right after the label lines (`this.labelled = false;`):

```js
    if (this.settle()) return; // nothing to move
```

- [ ] **Step 4: Run the test and the suite**

Run: `... --test test/sleep.test.js test/pressure.test.js test/convection.test.js test/walls.test.js < /dev/null`, then all tests. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Still air: skip the air step while nothing stirs it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Sleeping chunks

**Files:**
- Create: `src/sim/sleep.js`
- Modify: `src/sim/world.js` (constructor, step loop, end of step, `conductHeat`, `setGravity`, `setConvection`, `setEdges`, mix-in list), `src/sim/portals.js` (`addPortal`, `removePortalAt`), `src/sim/time.js` (`paintSpeed`)
- Test: `test/sleep.test.js` (append)

**Interfaces:**
- Consumes: `Air.still`, `AIR_STILL`, `HEAT_STILL` (Task 1).
- Produces: `initSleep(world)`; `World.chunkAwake` (Uint8Array, cw × ch), `World.cw`, `World.ch`, `World.sleeping` (boolean, default true; tests can turn it off), `World.stepSleep()`, `World.wakeAll()`, `World.asleepAt(x, y) → boolean`, `World.restless(c) → boolean`; constants `CHUNK = 16`, `SLEEP_AFTER = 8` exported from `sleep.js`.

- [ ] **Step 1: Write the failing tests** (append to `test/sleep.test.js`)

```js
// A walled tray: sand on the left, water filling whole rows on the right.
function tray() {
  const w = makeWorld(64, 64);
  fillRect(w, 0, 63, 63, 63, ID.WALL);
  fillRect(w, 32, 40, 32, 62, ID.WALL);
  fillRect(w, 63, 40, 63, 62, ID.WALL);
  fillRect(w, 0, 48, 31, 62, ID.SAND);
  fillRect(w, 33, 50, 62, 62, ID.WATER);
  return w;
}

test('a settled pile of sand and a still pool fall asleep', () => {
  const w = tray();
  run(w, 100);
  assert.equal(w.asleepAt(10, 56), true, 'the sand');
  assert.equal(w.asleepAt(45, 58), true, 'the water');
});

test('a sleeping area wakes when a tool reaches it', () => {
  const w = tray();
  run(w, 100);
  w.paint(10, 40, 2, ID.SAND);
  run(w, 1);
  assert.equal(w.asleepAt(10, 40), false, 'painting');
  run(w, 100);
  w.heat(45, 58, 2, 300);
  run(w, 1);
  assert.equal(w.asleepAt(45, 58), false, 'heating');
});

test('taking sand from under a sleeping pile brings it down', () => {
  const w = tray();
  run(w, 100);
  const before = (() => { let n = 0; for (let x = 0; x < 32; x++) if (w.type[48 * 64 + x] === ID.SAND) n++; return n; })();
  w.erase(8, 60, 3); // a hole low in the pile, in the chunk below
  run(w, 60);
  let top = 0;
  for (let x = 0; x < 32; x++) if (w.type[48 * 64 + x] === ID.SAND) top++;
  assert.ok(top < before, 'the top of the pile slumped into the hole');
});

test('heat reaches a sleeping area from next door', () => {
  const w = makeWorld(64, 32);
  fillRect(w, 0, 10, 63, 12, ID.STONE);
  run(w, 50);
  assert.equal(w.asleepAt(40, 11), true);
  run(w, 200, () => { for (let x = 0; x < 4; x++) w.temp[11 * 64 + x] = 1000; });
  assert.ok(w.temp[11 * 64 + 20] > 30, `warmed to ${w.temp[11 * 64 + 20].toFixed(1)}`);
});

test('a puff of air wakes the area under it', () => {
  const w = tray();
  run(w, 100);
  w.pressurize(10, 40, 4, 20);
  run(w, 2);
  assert.equal(w.asleepAt(10, 44), false);
});

test('nothing sleeps with Newtonian gravity on', () => {
  const w = tray();
  w.setGravity({ newtonian: true });
  run(w, 100);
  assert.ok(w.chunkAwake.every((v) => v === 1));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `... --test test/sleep.test.js < /dev/null` — the new tests FAIL (`w.asleepAt is not a function`).

- [ ] **Step 3: Implement `src/sim/sleep.js`**

```js
// Sleeping areas. The world is divided into CHUNK × CHUNK chunks; a chunk
// where nothing has changed for SLEEP_AFTER steps, and where nothing can
// change on its own (see restless), falls asleep: its particles aren't
// updated and its heat isn't worked out (world.js). After every step each
// chunk is compared with how it was after the step before: any change, from
// whatever cause (a tool, a blast, heat or a particle from next door), wakes
// it and the chunks round it. So does air that isn't still over it.
// Mixed into World.prototype; initSleep sets up the storage.

import { DEFS, NUM, REACT, State, AMBIENT } from './elements.js';
import { AIR_STILL, HEAT_STILL } from './air.js';

export const CHUNK = 16;
export const SLEEP_AFTER = 8;
const SHIFT = 4; // log2(CHUNK)
const { GAS, ENERGY, LIQUID } = State;

// Elements that can change on their own, wherever they are.
const RESTLESS = Uint8Array.from(DEFS, (d) => (d.id !== 0 && (
  d.state === GAS || (d.state === ENERGY && !d.fixed) || d.behavior !== null || d.active
  || d.holdTemp || d.machine !== null) ? 1 : 0));

export function initSleep(world) {
  const cw = Math.ceil(world.w / CHUNK), ch = Math.ceil(world.h / CHUNK);
  world.cw = cw;
  world.ch = ch;
  world.chunkAwake = new Uint8Array(cw * ch).fill(1);
  world.chunkQuiet = new Uint8Array(cw * ch); // steps in a row with no change
  world.chunkWake = new Uint8Array(cw * ch); // woken this step
  world.snapType = world.type.slice();
  world.snapTemp = world.temp.slice();
  world.sleeping = true;
}

export const Sleep = {
  // Is (x, y) in a sleeping chunk?
  asleepAt(x, y) {
    return this.chunkAwake[(y >> SHIFT) * this.cw + (x >> SHIFT)] === 0;
  },

  wakeAll() {
    this.chunkAwake.fill(1);
    this.chunkQuiet.fill(0);
  },

  // After a step: wake what changed (and the chunks round it), and put to
  // sleep what has been quiet long enough with nothing restless in it.
  stepSleep() {
    const { cw, ch, w, h, type, temp, snapType, snapTemp, chunkAwake, chunkQuiet, chunkWake } = this;
    if (!this.sleeping || this.gravity.newtonian) { if (!chunkAwake.every((v) => v === 1)) this.wakeAll(); return; }
    chunkWake.fill(0);
    for (let cy = 0; cy < ch; cy++) {
      const y0 = cy << SHIFT, y1 = Math.min(h, y0 + CHUNK);
      for (let cx = 0; cx < cw; cx++) {
        const x0 = cx << SHIFT, x1 = Math.min(w, x0 + CHUNK);
        let changed = false;
        for (let y = y0; y < y1; y++) {
          for (let i = y * w + x0, e = y * w + x1; i < e; i++) {
            if (type[i] !== snapType[i] || temp[i] !== snapTemp[i]) {
              changed = true;
              snapType[i] = type[i];
              snapTemp[i] = temp[i];
            }
          }
        }
        if (!changed) continue;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy;
          if (ny < 0 || ny >= ch) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            if (nx >= 0 && nx < cw) chunkWake[ny * cw + nx] = 1;
          }
        }
      }
    }
    const air = this.air;
    for (let c = 0; c < cw * ch; c++) {
      if (chunkWake[c] || (!chunkAwake[c] && !air.still && this.airStirs(c))) {
        chunkAwake[c] = 1;
        chunkQuiet[c] = 0;
      } else if (chunkAwake[c]) {
        if (chunkQuiet[c] < SLEEP_AFTER) chunkQuiet[c]++;
        else if (!this.restless(c)) chunkAwake[c] = 0;
      }
    }
  },

  // Is the air over chunk c stirring (pressure, wind, or warm or cold air)?
  airStirs(c) {
    const air = this.air;
    const { p, vx, vy, t } = air;
    const cx = c % this.cw, cy = (c / this.cw) | 0;
    const bx0 = (cx << SHIFT) >> 2, by0 = (cy << SHIFT) >> 2; // air blocks are 4 × 4 cells
    for (let by = by0; by < by0 + CHUNK / 4 && by < air.rows; by++) {
      for (let bx = bx0; bx < bx0 + CHUNK / 4 && bx < air.cols; bx++) {
        const a = (by + 1) * air.W + bx + 1;
        if (Math.abs(p[a]) > AIR_STILL || Math.abs(vx[a]) > AIR_STILL || Math.abs(vy[a]) > AIR_STILL) return true;
        if (air.heat && Math.abs(t[a] - AMBIENT) > HEAT_STILL) return true;
      }
    }
    return false;
  },

  // Can anything in chunk c change on its own? Temperatures within
  // HEAT_STILL of room temperature are set to exactly room temperature
  // (and the snapshot with them, so that isn't a change).
  restless(c) {
    const { w, h, type, temp, life, loose, vx, vy, snapTemp } = this;
    const cx = c % this.cw, cy = (c / this.cw) | 0;
    const x0 = cx << SHIFT, y0 = cy << SHIFT;
    const x1 = Math.min(w, x0 + CHUNK), y1 = Math.min(h, y0 + CHUNK);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * w + x;
        const t = type[i];
        if (t === 0) continue;
        if (RESTLESS[t] || life[i] > 0 || loose[i]) return true;
        const d = DEFS[t];
        if (d.state !== LIQUID && (Math.abs(vx[i]) >= 0.01 || Math.abs(vy[i]) >= 0.01)) return true;
        const T = temp[i];
        if (T !== AMBIENT) {
          if (Math.abs(T - AMBIENT) > HEAT_STILL) return true;
          temp[i] = AMBIENT;
          snapTemp[i] = AMBIENT;
        }
        if (d.high !== null && AMBIENT >= d.high.temp) return true;
        if (d.low !== null && !d.low.restore && AMBIENT <= d.low.temp) return true;
        if (d.burn !== null && AMBIENT >= d.ignite) return true;
        if (this.portalCells !== 0 && this.portalAt[i] !== 0) return true;
        if (this.zoneCount !== 0 && this.speed[i] !== 0) return true;
        if (d.reactive) {
          for (let k = 0; k < 4; k++) {
            const j = this.cellAt(x + (k === 0 ? 1 : k === 1 ? -1 : 0), y + (k === 2 ? 1 : k === 3 ? -1 : 0));
            if (j < 0 || type[j] === 0) continue;
            const r = REACT[t * NUM + type[j]];
            if (r !== null && (AMBIENT >= r.minTemp || temp[j] >= r.minTemp)) return true;
          }
        }
      }
    }
    return false;
  },
};
```


- [ ] **Step 4: Hook it into the world**

`src/sim/world.js`: `import { Sleep, initSleep } from './sleep.js';` (and `CHUNK` if used), add `Sleep` to the `Object.assign(World.prototype, ...)` list, and in the constructor after `initPortals(this);`: `initSleep(this);`.

In `step()`, destructure `chunkAwake, cw` and compute `const sleepy = this.sleeping && !this.gravity.newtonian;`. In the scan, after the AIRTIGHT counting line and before the clock check:

```js
        // A sleeping area's particles aren't updated (sleep.js).
        if (sleepy && chunkAwake[(y >> 4) * cw + (x >> 4)] === 0) continue;
```

At the very end of `step()` (after `air.step(...)`): `this.stepSleep();`.

`conductHeat`: destructure `chunkAwake, cw`, compute `sleepy` the same way, and right after `count++;`:

```js
        // A sleeping area's heat isn't worked out, except along its right and
        // bottom edges, which trade heat with the chunks beside and below.
        if (sleepy && chunkAwake[(y >> 4) * cw + (x >> 4)] === 0 && (x & 15) !== 15 && (y & 15) !== 15) continue;
```

`setGravity(opts)` (after `this.gravity.set(opts)`), `setConvection(on)` and `setEdges(...)` (at the end) each get:

```js
    if (this.chunkAwake) this.wakeAll(); // the rules changed: everything may move
```

(the guard covers calls made while the world is still being built, before `initSleep`).

`src/sim/portals.js`: at the end of `addPortal` (before `return { slot, end }`) and in `removePortalAt` (before `return true`): `this.wakeAll();`. `src/sim/time.js` `paintSpeed`: after `this.findFastBox();`: `this.wakeAll();`.

- [ ] **Step 5: Run tests, then the whole suite**

Run `test/sleep.test.js`, then all tests. If an existing test fails, find what the restless check misses (the failing test's element or process) and add it to `restless` or `RESTLESS`, with a comment; don't loosen the test.

- [ ] **Step 6: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Sleeping areas: settled chunks aren't simulated until something reaches them

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Slow processes, the starting scene, and speed

**Files:**
- Test: `test/sleep.test.js` (append); fixes in `src/sim/sleep.js` if a test exposes a missed restless case

**Interfaces:**
- Consumes: `World.sleeping`, `asleepAt`, `chunkAwake` (Task 2).

- [ ] **Step 1: Write the tests** (append)

```js
import { loadDemoScene } from '../src/game/scene.js';
import { World } from '../src/sim/world.js';

test('slow changes still happen in a settled scene: water still turns dirt to mud', () => {
  const mud = (sleeping) => {
    const w = makeWorld(64, 40, 3);
    w.sleeping = sleeping;
    fillRect(w, 0, 39, 63, 39, ID.WALL);
    fillRect(w, 0, 30, 63, 38, ID.DIRT);
    fillRect(w, 0, 0, 0, 29, ID.WALL);
    fillRect(w, 63, 0, 63, 29, ID.WALL);
    fillRect(w, 1, 26, 62, 29, ID.WATER);
    run(w, 600);
    let n = 0;
    for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.MUD) n++;
    return n;
  };
  const asleep = mud(true), awake = mud(false);
  assert.ok(asleep > awake * 0.7, `${asleep} mud cells with sleeping, ${awake} without`);
});

test('radioactive elements and plants keep their areas awake', () => {
  const w = makeWorld(64, 40);
  fillRect(w, 0, 39, 63, 39, ID.WALL);
  fillRect(w, 5, 35, 8, 38, ID.URANIUM);
  fillRect(w, 40, 36, 60, 38, ID.DIRT);
  w.spawn(35 * 64 + 50, ID.SEED);
  run(w, 200);
  assert.equal(w.asleepAt(6, 36), false, 'uranium');
  assert.equal(w.asleepAt(50, 36), false, 'a seed in soil');
});

test('the starting scene settles until nearly everything sleeps, and steps much faster', () => {
  const time = (sleeping) => {
    const w = new World(400, 240, 3);
    loadDemoScene(w);
    w.setConvection(true);
    w.sleeping = sleeping;
    for (let f = 0; f < 300; f++) w.step();
    const t0 = performance.now();
    for (let f = 0; f < 200; f++) w.step();
    return { ms: (performance.now() - t0) / 200, w };
  };
  const on = time(true), off = time(false);
  const w = on.w;
  let full = 0, asleep = 0;
  for (let c = 0; c < w.cw * w.ch; c++) {
    const x0 = (c % w.cw) * 16, y0 = ((c / w.cw) | 0) * 16;
    let any = false;
    for (let y = y0; y < Math.min(w.h, y0 + 16) && !any; y++) for (let x = x0; x < Math.min(w.w, x0 + 16); x++) if (w.type[y * w.w + x]) { any = true; break; }
    if (!any) continue;
    full++;
    if (!w.chunkAwake[c]) asleep++;
  }
  assert.ok(asleep >= full * 0.9, `${asleep} of ${full} chunks asleep`);
  assert.equal(w.air.still, true, 'and the air rests');
  assert.ok(on.ms * 3 < off.ms, `${on.ms.toFixed(2)} ms a step asleep, ${off.ms.toFixed(2)} awake`);
});
```

- [ ] **Step 2: Run, and fix what fails**

Run: `... --test test/sleep.test.js < /dev/null`. Expected: PASS. If the mud test fails, the reaction check in `restless` is missing a case (check `d.reactive` is set for DIRT and WATER and that `REACT` holds DIRT + WATER); if the speed test fails, profile `stepSleep` (the per-step snapshot compare should be well under 0.5 ms) and the scan loop.

- [ ] **Step 3: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Sleeping areas: slow reactions, radioactivity and plants keep going

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Quality levels in the world

**Files:**
- Modify: `src/sim/world.js` (constructor, `setQuality`, `step`, `conductHeat` rates)
- Test: `test/performance.test.js` (create)

**Interfaces:**
- Produces: `World.setQuality(level)` with `'high' | 'medium' | 'low'`; `World.quality`; `World.heatSteps` (1 or 2), `World.airEvery` (1 or 2); `World.pCap` 12000 or 4000.

- [ ] **Step 1: Write the failing tests**

Create `test/performance.test.js`:

```js
// The performance setting: quality levels in the world, and Auto.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, run } from './helpers.js';

test('Medium conducts heat at the same speed for half the work', () => {
  const far = (level) => {
    const w = makeWorld(60, 10);
    w.sleeping = false;
    w.setQuality(level);
    fillRect(w, 5, 5, 54, 5, ID.METAL);
    run(w, 100, () => { w.temp[5 * 60 + 5] = 1000; });
    return w.temp[5 * 60 + 25];
  };
  const high = far('high'), medium = far('medium');
  assert.ok(Math.abs(medium - high) < high * 0.05 + 2, `high ${high.toFixed(1)}, medium ${medium.toFixed(1)}`);
});

test('Medium steps the air every other step', () => {
  const w = makeWorld(40, 20);
  w.setQuality('medium');
  w.pressurize(20, 10, 3, 30); // keep the air busy
  let steps = 0;
  const real = w.air.step.bind(w.air);
  w.air.step = (g) => { steps++; return real(g); };
  run(w, 10);
  assert.equal(steps, 5);
});

test('Low launches at most 4,000 flying particles', () => {
  const w = makeWorld(100, 100);
  w.setQuality('low');
  for (let k = 0; k < 5000; k++) w.spawnProjectile(ID.PHOTON, 50.5, 50.5, 0, 0);
  assert.equal(w.pn, 4000);
  w.setQuality('high');
  for (let k = 0; k < 1000; k++) w.spawnProjectile(ID.PHOTON, 50.5, 50.5, 0, 0);
  assert.equal(w.pn, 5000);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `... --test test/performance.test.js < /dev/null` — FAIL (`w.setQuality is not a function`).

- [ ] **Step 3: Implement**

In `src/sim/world.js` constructor (after `initParticles(this)` so `pCap` exists): `this.setQuality('high');`. Method (near `setConvection`):

```js
  // How hard the simulation works (the Performance setting): 'high' as it
  // is; 'medium' works out heat every other step, at the rate two steps
  // would, and steps the air every other step; 'low' does the same and
  // launches at most LOW_PARTICLES flying particles at once.
  setQuality(level) {
    this.quality = level;
    this.heatSteps = level === 'high' ? 1 : 2;
    this.airEvery = level === 'high' ? 1 : 2;
    this.pCap = level === 'low' ? LOW_PARTICLES : this.px.length;
  }
```

with `const LOW_PARTICLES = 4000;` near the other constants.

In `step()`, replace `this.conductHeat();` and `air.step(this.gravity);` with:

```js
    // At lower quality heat and air take turns, every other step each.
    if (this.heatSteps === 1 || (tick & 1) === 0) this.conductHeat();
    if (this.airEvery === 1 || (tick & 1) === 1) air.step(this.gravity);
```

In `conductHeat`: read `const hs = this.heatSteps;` once. In both neighbour exchanges, after the zone line:

```js
            if (hs === 2) k = 2 * k * (1 - k); // two steps' worth: (1 - (1 - 2k)²) / 2
```

and the open-air cooling and convection rates: `T += (AMBIENT - T) * AIR_COOL[t] * room * hs;` and `const r = (t === WALL ? WALL_TOUCH : TOUCH[t]) * hs;`.

- [ ] **Step 4: Run tests, the suite, commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Quality levels: heat and air every other step, fewer flying particles at Low

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Auto, and saving the setting

**Files:**
- Create: `src/game/performance.js`
- Test: `test/performance.test.js` (append)

**Interfaces:**
- Produces: `LEVELS = ['high', 'medium', 'low']`; `class AutoQuality { level; feed(ms, budget = 1000 / 60) → level }`; `AUTO_DOWN = 60`, `AUTO_UP = 180`; `loadPerformance(storage) → 'auto' | 'high' | 'medium' | 'low'`, `savePerformance(choice, storage)`.

- [ ] **Step 1: Write the failing tests** (append)

```js
import { AutoQuality, AUTO_DOWN, AUTO_UP, loadPerformance, savePerformance } from '../src/game/performance.js';

test('Auto drops a level after a second of slow frames and climbs back after three quick seconds', () => {
  const a = new AutoQuality();
  assert.equal(a.level, 'high');
  for (let f = 0; f < AUTO_DOWN - 1; f++) a.feed(25);
  assert.equal(a.level, 'high', 'not yet');
  a.feed(25);
  assert.equal(a.level, 'medium');
  for (let f = 0; f < AUTO_DOWN; f++) a.feed(25);
  assert.equal(a.level, 'low');
  for (let f = 0; f < AUTO_DOWN; f++) a.feed(25);
  assert.equal(a.level, 'low', 'no lower than Low');
  for (let f = 0; f < AUTO_UP; f++) a.feed(4);
  assert.equal(a.level, 'medium');
  for (let f = 0; f < AUTO_UP - 1; f++) a.feed(4);
  a.feed(12); // in between: neither slow nor quick, starts the count again
  for (let f = 0; f < AUTO_UP - 1; f++) a.feed(4);
  assert.equal(a.level, 'medium');
  a.feed(4);
  assert.equal(a.level, 'high');
});

test('the Performance choice is saved; bad storage gives Auto', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  savePerformance('low', storage);
  assert.equal(loadPerformance(storage), 'low');
  store.set('sandbox-crafter:performance', '"fastest"');
  assert.equal(loadPerformance(storage), 'auto');
  assert.equal(loadPerformance(undefined), 'auto');
});
```

- [ ] **Step 2: Run to verify they fail** — FAIL (no module).

- [ ] **Step 3: Implement `src/game/performance.js`**

```js
// The Performance setting: Auto, High, Medium or Low (World.setQuality),
// saved in localStorage. Auto watches how long each drawn frame takes
// (simulation steps and drawing) and drops a level when frames run over
// their time for AUTO_DOWN frames in a row, or climbs back when they take
// under half of it for AUTO_UP frames in a row.

const KEY = 'sandbox-crafter:performance';
export const LEVELS = ['high', 'medium', 'low'];
export const CHOICES = ['auto', ...LEVELS];
export const AUTO_DOWN = 60;
export const AUTO_UP = 180;

export class AutoQuality {
  constructor() {
    this.level = 'high';
    this.slow = 0;
    this.quick = 0;
  }

  // A drawn frame took `ms`; `budget` is the time it has. Returns the level.
  feed(ms, budget = 1000 / 60) {
    if (ms > budget) { this.slow++; this.quick = 0; }
    else if (ms < budget / 2) { this.quick++; this.slow = 0; }
    else { this.slow = 0; this.quick = 0; }
    const k = LEVELS.indexOf(this.level);
    if (this.slow >= AUTO_DOWN && k < LEVELS.length - 1) { this.level = LEVELS[k + 1]; this.slow = 0; }
    else if (this.quick >= AUTO_UP && k > 0) { this.level = LEVELS[k - 1]; this.quick = 0; }
    return this.level;
  }
}

export function loadPerformance(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(KEY));
    return CHOICES.includes(v) ? v : 'auto';
  } catch {
    return 'auto'; // unreadable or unavailable storage
  }
}

export function savePerformance(choice, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(choice));
  } catch {
    // Nothing to do; the choice just won't be remembered.
  }
}
```

- [ ] **Step 4: Run tests, commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Performance setting: Auto picks the level from frame times; the choice is saved

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The menu, the main loop, and sleeping-area outlines

**Files:**
- Modify: `index.html` (⋯ menu), `style.css`, `src/main.js` (menu wiring, frame loop), `src/render/renderer.js` (outlines)
- Test: browser check (no unit test: DOM and timing)

**Interfaces:**
- Consumes: `World.setQuality`, `AutoQuality`, `loadPerformance`, `savePerformance`, `World.chunkAwake`, `cw`, `ch`.
- Produces: `Renderer.showSleep` (boolean).

- [ ] **Step 1: Menu markup**

In `index.html`, in the ⋯ menu after the hard-mode toggle:

```html
          <label class="menu-select" title="Auto lowers the quality when the game can't keep up, and raises it again when it can. Medium works out heat and air every other step; Low also runs in slow motion rather than stuttering, with fewer flying particles.">Performance
            <select id="menu-perf">
              <option value="auto">Auto</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label class="menu-toggle"><input type="checkbox" id="menu-sleep"> Show sleeping areas</label>
```

`style.css`: `.menu-select { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; font-size: 13px; } .menu-select select { font: inherit; background: var(--panel-2); color: var(--text); border: 1px solid var(--line); border-radius: 4px; padding: 2px 4px; }` (match `.menu-toggle`'s spacing).

- [ ] **Step 2: Wire it in `src/main.js`**

```js
import { AutoQuality, loadPerformance, savePerformance } from './game/performance.js';

let perfChoice = loadPerformance();
const auto = new AutoQuality();
const perfSelect = $('menu-perf');
const levelName = (l) => l[0].toUpperCase() + l.slice(1);
function applyPerf() {
  const level = perfChoice === 'auto' ? auto.level : perfChoice;
  if (world.quality !== level) world.setQuality(level);
  perfSelect.value = perfChoice;
  perfSelect.options[0].textContent = perfChoice === 'auto' ? `Auto (${levelName(auto.level)})` : 'Auto';
}
perfSelect.addEventListener('change', () => { perfChoice = perfSelect.value; savePerformance(perfChoice); applyPerf(); });
applyPerf();
$('menu-sleep').addEventListener('change', (e) => { renderer.showSleep = e.target.checked; });
```

In `frame(now)`: `const t0 = performance.now();` before the step loop; the loop limit becomes `const maxSteps = world.quality === 'low' ? 1 : 3;` (`while (acc >= STEP_MS && steps < maxSteps)` and `if (steps === maxSteps) acc = 0;`); after `renderer.draw(...)`:

```js
  if (perfChoice === 'auto' && !game.paused && steps > 0) {
    const was = auto.level;
    auto.feed(performance.now() - t0);
    if (auto.level !== was) applyPerf();
  }
```

- [ ] **Step 3: Outlines in `src/render/renderer.js`**

Constructor: `this.showSleep = false;`. At the end of `paintOverlays()`:

```js
    // Show sleeping areas: a faint outline round each sleeping chunk.
    if (this.showSleep) {
      const { chunkAwake, cw, ch } = world;
      for (let c = 0; c < cw * ch; c++) {
        if (chunkAwake[c]) continue;
        const x0 = (c % cw) * 16, y0 = ((c / cw) | 0) * 16;
        const x1 = Math.min(w, x0 + 16) - 1, y1 = Math.min(h, y0 + 16) - 1;
        for (let x = x0; x <= x1; x++) { blend(y0 * w + x, SLEEP_RGB, 0.35); blend(y1 * w + x, SLEEP_RGB, 0.35); }
        for (let y = y0 + 1; y < y1; y++) { blend(y * w + x0, SLEEP_RGB, 0.35); blend(y * w + x1, SLEEP_RGB, 0.35); }
      }
    }
```

with `const SLEEP_RGB = [120, 200, 255];` near the other overlay colours.

- [ ] **Step 4: Check in the browser**

`preview_start` `sandbox-crafter`; with a temporary `window.__dbg = { world, renderer, game }; // TEMP` after the renderer in `main.js`: load the scene, let it settle, tick Show sleeping areas and confirm outlines cover the settled ground and disappear where you paint; switch Performance to Low and confirm `world.quality === 'low'`, then Auto and confirm the label reads "Auto (High)"; check the console for errors. Remove the TEMP line (`grep -c __dbg src/main.js` → 0).

- [ ] **Step 5: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Performance menu, Show sleeping areas, slow motion at Low

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs, build, speed check

**Files:**
- Modify: `README.md`, `HANDOFF.md`, `dist/sandbox-crafter.html`

- [ ] **Step 1: README**: in the menu description, add Performance (the four choices and what each trades) and Show sleeping areas; in "How the physics works", a paragraph on sleeping areas and still air (nothing changes in how the world behaves; settled parts cost almost nothing); the tests paragraph gains the sleep and performance tests; bump the test count.

- [ ] **Step 2: HANDOFF**: a bullet on `sleep.js` (chunks, the snapshot compare, `restless`: anything new that can change on its own must be added there or to `RESTLESS`, or it will stall while its area sleeps), `Air.settle`, `World.setQuality` (heat at two steps' rate is `2k(1 − k)`), and the Auto controller; bump the test count.

- [ ] **Step 3: Build, run everything, measure**

```bash
ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" scripts/build.js < /dev/null
ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" --test test/*.test.js < /dev/null
```

Then the demo bench (settled and busy scenes) against the previous commit's code, and report the numbers.

- [ ] **Step 4: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Docs and build for sleeping areas and the performance setting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
