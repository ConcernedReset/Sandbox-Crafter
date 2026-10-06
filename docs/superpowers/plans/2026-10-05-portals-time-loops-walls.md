# Portals, Time Brush, Looping Edges and Wall Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two-way portals, a time-speed brush, looping world edges, and walls that let chosen things through.

**Architecture:** Each feature is a per-cell layer on `World` (`portalAt`, `speed`, `wall`) or a world setting (`loopX`/`loopY`), checked at the few choke points every particle goes through: `canEnter`, `swap`, `clearCell`, the step loop, `cellAt` (new), `moveProjectile` and `hitCell`, and the air step. New logic lives in focused mix-ins (`portals.js`, `time.js`) and a constants module (`walls.js`). Every layer is guarded by a count, so a world that uses none of them costs nothing extra.

**Tech Stack:** Plain ES modules, no dependencies; `node:test`; Node is run through VS Code's Electron.

**Spec:** `docs/superpowers/specs/2026-10-05-portals-time-loops-walls-design.md`

## Global Constraints

- Run tests with `ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" --test test/<file>.test.js < /dev/null` (Node isn't installed; always redirect stdin).
- No new dependencies. Plain ES modules, matching the surrounding code's comment density and naming.
- A world with no portals, no time zones, no loops and only plain walls must behave exactly as now: every existing test keeps passing, and the demo scene steps as fast (bench: `scratchpad/bench.mjs`, about 3 ms/step).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never add `.claude/` (`git add -A -- . ':!.claude'`). Don't push.
- Wall pass bits (verbatim from the spec): WALL_HERE 256; SOLID 1, POWDER 2, LIQUID 4, GAS 8, ENERGY 16, PARTICLES 32, HEAT 64, AIR 128.
- Time speeds: ¼×, ½×, 2×, 4×; codes 1..4 in `World.speed` (0 normal).
- At most 32 portal pairs. PORTAL_SHARE 0.2.
- Heat-passing walls conduct at 0.9.
- Edge states: `'solid' | 'void' | 'loop'`; loops come in pairs.

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `src/sim/walls.js` (new) | Wall layer constants: `WALL_HERE`, `PASS`, `PASS_BIT` (which bit lets an element through), `PASS_ORDER` (names for the inspect line) |
| `src/sim/time.js` (new) | `TimeZones` mix-in: `paintSpeed`, the extra fast passes, speed constants |
| `src/sim/portals.js` (new) | `Portals` mix-in: drawing, removing, crossing, projectile crossing, air links, colours |
| `src/sim/world.js` | Layers' storage; `setEdges`/`cellAt`; wall-aware `canEnter`, `swap`, `clearCell`, step loop, heat; time-aware step and heat; hooks for portals |
| `src/sim/air.js` | Looping ring, seam sync, regions across loops, edge drag only on non-loop sides |
| `src/sim/particles.js` | Wall layer, speed, loops and portals for flying particles |
| `src/game/physics-panel.js` | Three-state edges (`nextEdges`), old boolean settings still load |
| `src/game/tool-options.js` (new) | Wall checklist and time speed: defaults, load, save |
| `src/game/cell-notes.js` (new) | Extra inspect-line notes for a cell (wall, speed, portal) |
| `src/game/input.js` | Portal and Time tools; wall mask when painting walls |
| `src/game/ui.js`, `index.html`, `style.css`, `src/main.js` | Tools grid 3 × 4, options strip, inspect notes, portal results |
| `src/render/renderer.js` | Wall mesh, time tint and crawling border, portals, loop markers |
| `test/loops.test.js`, `test/wall-filters.test.js`, `test/time.test.js`, `test/portals.test.js` (new) | Feature tests |
| `test/physics-panel.test.js`, `test/render.test.js`, `test/hard-mode.test.js` | Updated/added tests |

---

### Task 1: Edge helper and looping movement

**Files:**
- Modify: `src/sim/world.js` (constructor, `setVoidEdges` → `setEdges`, new `cellAt`, `travel`, `travelAlong`, `movePowder`, `moveLiquid`, `moveGas`, `randomNeighbor`, `conductHeat`)
- Test: `test/loops.test.js` (create)

**Interfaces:**
- Produces: `World.setEdges({ top, bottom, left, right })` with `'solid' | 'void' | 'loop'`; `World.loopX`, `World.loopY` (booleans); `World.cellAt(x, y) → index | -1` (wraps across looped edges, -1 off a solid or void edge). `setVoidEdges` keeps its signature.

- [ ] **Step 1: Write the failing tests**

Create `test/loops.test.js`:

```js
// Looping edges: opposite edges of the world join up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, countOf, run } from './helpers.js';

test('sand falling off the bottom of a top-bottom loop comes in at the top', () => {
  const w = makeWorld(40, 40);
  w.setEdges({ top: 'loop', bottom: 'loop' });
  fillRect(w, 18, 30, 21, 33, ID.SAND);
  let high = 0;
  run(w, 40, () => { for (let i = 0; i < 40 * 10; i++) if (w.type[i] === ID.SAND) high++; });
  assert.equal(countOf(w, ID.SAND), 16, 'no sand lost');
  assert.ok(high > 0, 'sand came in at the top');
});

test('water flows across the join of a left-right loop', () => {
  const w = makeWorld(60, 20);
  w.setEdges({ left: 'loop', right: 'loop' });
  fillRect(w, 0, 19, 59, 19, ID.WALL); // floor
  fillRect(w, 30, 0, 30, 18, ID.WALL); // a dam: the water can only spread right, across the join
  fillRect(w, 48, 10, 59, 18, ID.WATER);
  run(w, 300);
  let across = 0;
  for (let y = 0; y < 20; y++) for (let x = 0; x < 15; x++) if (w.type[y * 60 + x] === ID.WATER) across++;
  assert.ok(across > 10, `${across} water cells came round the join`);
});

test('a void edge still swallows things and setVoidEdges still works', () => {
  const a = makeWorld(30, 20);
  a.setEdges({ bottom: 'void' });
  fillRect(a, 10, 15, 12, 17, ID.SAND);
  run(a, 30);
  assert.equal(countOf(a, ID.SAND), 0);
  const b = makeWorld(30, 20);
  b.setVoidEdges({ bottom: true });
  assert.equal(b.loopX || b.loopY, false);
  fillRect(b, 10, 15, 12, 17, ID.SAND);
  run(b, 30);
  assert.equal(countOf(b, ID.SAND), 0);
});

test('a loop overrides a void on the other side of the pair', () => {
  const w = makeWorld(30, 20);
  w.setEdges({ left: 'loop', right: 'void' });
  assert.equal(w.loopX, true);
  assert.equal(w.voidEdges, 0);
});

test('heat conducts across the join', () => {
  const w = makeWorld(40, 10);
  w.setEdges({ left: 'loop', right: 'loop' });
  fillRect(w, 0, 5, 3, 5, ID.METAL);
  fillRect(w, 36, 5, 39, 5, ID.METAL);
  for (let x = 36; x < 40; x++) w.temp[5 * 40 + x] = 1000;
  run(w, 30);
  assert.ok(w.temp[5 * 40] > 100, `the far end of the join warmed to ${w.temp[5 * 40].toFixed(0)}`);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" --test test/loops.test.js < /dev/null`
Expected: FAIL, `w.setEdges is not a function`.

- [ ] **Step 3: Implement**

In `src/sim/world.js` constructor, after `this.voidEdges = 0; ...`:

```js
    this.loopX = false; // the left and right edges are joined (see setEdges)
    this.loopY = false; // the top and bottom edges are joined
```

Replace `setVoidEdges` with:

```js
  // What each edge of the world is: 'solid' (the default), 'void' (whatever
  // moves out through it is gone; pressure waves and heat go out too) or
  // 'loop' (it joins the opposite edge: what leaves one comes in at the
  // other). Loops come in pairs, so a loop on either side of a pair loops
  // both.
  setEdges({ top = 'solid', bottom = 'solid', left = 'solid', right = 'solid' } = {}) {
    this.loopX = left === 'loop' || right === 'loop';
    this.loopY = top === 'loop' || bottom === 'loop';
    const v = (side, bit) => (side === 'void' ? bit : 0);
    this.voidEdges = (this.loopY ? 0 : v(top, VOID_TOP) | v(bottom, VOID_BOTTOM))
      | (this.loopX ? 0 : v(left, VOID_LEFT) | v(right, VOID_RIGHT));
    this.air.voidSides = this.voidEdges; // and the air lets waves and heat out there
    this.air.setLoops(this.loopX, this.loopY);
  }

  // The older form: which edges are a void, as booleans.
  setVoidEdges({ top = false, bottom = false, left = false, right = false } = {}) {
    const s = (on) => (on ? 'void' : 'solid');
    this.setEdges({ top: s(top), bottom: s(bottom), left: s(left), right: s(right) });
  }

  // The index of cell (x, y), across a looped edge if it's just off one;
  // -1 off a solid or void edge.
  cellAt(x, y) {
    const { w, h } = this;
    if (x < 0 || x >= w) {
      if (!this.loopX) return -1;
      x = x < 0 ? x + w : x - w;
    }
    if (y < 0 || y >= h) {
      if (!this.loopY) return -1;
      y = y < 0 ? y + h : y - h;
    }
    return y * w + x;
  }
```

`Air.setLoops` comes in Task 2; for now add a stub to `src/sim/air.js` `Air` class so this task's tests run:

```js
  // Which pairs of edges are joined (world.js, setEdges). See wrapRing.
  setLoops(x, y) {
    this.loopX = x;
    this.loopY = y;
    this.labelledOnce = false; // the regions join up differently now
  }
```

and in the `Air` constructor: `this.loopX = false; this.loopY = false;`.

In `travel` and `travelAlong`, replace the bounds block and index:

```js
      if (nx === cx && ny === cy) continue;
      const j = this.cellAt(nx, ny);
      if (j < 0) {
        if (this.voidEdges !== 0 && this.offEdge(nx, ny)) { this.clearCell(cur); this.vanished = true; return cur; }
        this.blockedMoving = true;
        break;
      }
```

(delete the old `if (nx < 0 || ...) {...}` block and the old `const j = ny * this.w + nx;` line; the rest is unchanged).

The straight-down fast paths index rows directly, so use the general code when anything loops. In `movePowder`, `moveLiquid` and `moveGas` change `if (g.straight)` to:

```js
    if (g.straight && !this.loopX && !this.loopY) {
```

In `movePowder`'s slide, replace

```js
    if (this.inBounds(x + DX8[k], y + DY8[k])) {
      let s = this.rand() < 0.5 ? 1 : 7;
      for (let n = 0; n < 2; n++, s = 8 - s) {
        const r = (k + s) & 7;
        const nx = x + DX8[r], ny = y + DY8[r];
        if (!this.inBounds(nx, ny)) continue;
        const jj = ny * this.w + nx;
```

with

```js
    if (this.cellAt(x + DX8[k], y + DY8[k]) >= 0) {
      let s = this.rand() < 0.5 ? 1 : 7;
      for (let n = 0; n < 2; n++, s = 8 - s) {
        const r = (k + s) & 7;
        const jj = this.cellAt(x + DX8[r], y + DY8[r]);
        if (jj < 0) continue;
```

In `moveLiquid`, the same change for "Diagonal down":

```js
    if (this.cellAt(x + fx, y + fy) >= 0) {
      for (let n = 0, dir = flow; n < 2; n++, dir = -dir) {
        const r = (k + (dir > 0 ? 7 : 1)) & 7;
        const jj = this.cellAt(x + DX8[r], y + DY8[r]);
        if (jj < 0) continue;
```

and for the sideways part:

```js
    const aj = this.cellAt(x - fx, y - fy);
    const above = aj >= 0 ? DEFS[this.type[aj]].state : 0;
    const pushed = above === LIQUID || above === POWDER;
    const bj = this.cellAt(x + fx, y + fy);
    const creep = bj >= 0 && DEFS[this.type[bj]].state === LIQUID ? 0.1 : 0.01;
    for (let n = 0, dir = flow; n < 2; n++, dir = -dir) {
      const r = (k + (dir > 0 ? 6 : 2)) & 7;
      const sx = DX8[r], sy = DY8[r];
      let target = -1;
      let drop = false;
      for (let s = 1; s <= d.spread; s++) {
        const nx = x + sx * s, ny = y + sy * s;
        const jj = this.cellAt(nx, ny);
        if (jj < 0) {
          // A void side is a cliff edge: the liquid pours off it.
          if (this.voidEdges !== 0 && this.offEdge(nx, ny)) { if (s === 1) { this.clearCell(i); return; } drop = true; }
          break;
        }
        if (!this.canEnter(d, jj, 0)) break;
        target = jj;
        const dj = this.cellAt(nx + fx, ny + fy);
        if (dj >= 0 && this.canEnter(d, dj, 1)) { drop = true; break; }
      }
      if (target < 0) continue;
      if (!drop && !pushed) {
        if (this.rand() < creep) target = this.cellAt(x + sx, y + sy); else continue;
      }
```

(the rest of the loop, `this.swap(i, target)` onward, is unchanged).

In `moveGas`, the last two lines become:

```js
    const jj = this.cellAt(x + side * cx, y + side * cy);
    if (jj >= 0) { if (this.canEnter(d, jj, 0)) this.swap(i, jj); }
    else if (this.voidEdges !== 0 && this.offEdge(x + side * cx, y + side * cy)) this.clearCell(i);
```

`randomNeighbor`:

```js
  randomNeighbor(x, y) {
    const r = (this.rand() * 4) | 0;
    let nx = x, ny = y;
    if (r === 0) nx++; else if (r === 1) nx--; else if (r === 2) ny++; else ny--;
    return this.cellAt(nx, ny);
  }
```

In `conductHeat`, after the main double loop and before `this.count = count;`, add heat across the joins:

```js
    // Across a looped edge, touching particles trade heat as neighbours do.
    if (this.loopX) for (let y = 0; y < h; y++) this.conductPair(y * w + w - 1, y * w);
    if (this.loopY) for (let x = 0; x < w; x++) this.conductPair((h - 1) * w + x, x);
```

and the helper after `conductHeat`:

```js
  // Two touching cells trade heat (both non-empty), as in conductHeat.
  conductPair(i, j) {
    const { type, temp } = this;
    const a = type[i], b = type[j];
    if (a === 0 || b === 0) return;
    const ka = COND[a], kb = COND[b];
    const k = (ka < kb ? ka : kb) * CONDUCT_RATE;
    if (k <= 0) return;
    const f = (temp[i] - temp[j]) * k;
    temp[i] -= f;
    temp[j] += f;
  }
```

- [ ] **Step 4: Run tests**

Run: `... --test test/loops.test.js test/edges.test.js test/physics.test.js < /dev/null`
Expected: PASS.

- [ ] **Step 5: Run the whole suite and commit**

Run: `... --test test/*.test.js < /dev/null` — expected: all pass.

```bash
git add -A -- . ':!.claude'
git commit -m "Looping edges: things and heat cross the join

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Looping air and flying particles

**Files:**
- Modify: `src/sim/air.js` (`setLoops`, new `wrapRing`, `syncSeams`, `label`, `step`, edge drag)
- Modify: `src/sim/particles.js` (`moveProjectile`)
- Test: `test/loops.test.js` (append)

**Interfaces:**
- Consumes: `Air.setLoops(x, y)` (Task 1 stub), `World.loopX/loopY`.
- Produces: `Air.wrapRing()` (copies the inside of each looped side into the opposite border ring), `Air.syncSeams()` (makes the two faces that are the same face across a loop equal).

- [ ] **Step 1: Write the failing tests** (append to `test/loops.test.js`)

```js
test('a gust of pressure crosses the join', () => {
  const most = (loop) => {
    const w = makeWorld(80, 40);
    if (loop) w.setEdges({ left: 'loop', right: 'loop' });
    w.pressurize(76, 20, 3, 60);
    let m = 0;
    run(w, 40, () => { m = Math.max(m, w.pressureAt(4, 20)); });
    return m;
  };
  const looped = most(true), plain = most(false);
  assert.ok(looped > 2, `across the join it reached ${looped.toFixed(2)}`);
  assert.ok(plain < 0.5, `without the loop ${plain.toFixed(2)}`);
});

test('a world looped on all four sides is sealed: it keeps its pressure', () => {
  const w = makeWorld(60, 40);
  w.setEdges({ top: 'loop', bottom: 'loop', left: 'loop', right: 'loop' });
  w.pressurize(30, 20, 8, 40);
  const a = w.air;
  const total = () => {
    let s = 0;
    for (let y = 1; y < a.H - 1; y++) for (let x = 1; x < a.W - 1; x++) s += a.p[y * a.W + x];
    return s;
  };
  run(w, 1);
  const t0 = total();
  run(w, 1000);
  assert.ok(Math.abs(total() - t0) < t0 * 0.01, `${t0.toFixed(0)} -> ${total().toFixed(0)}`);
});

test('a photon wraps round a looped edge', () => {
  const w = makeWorld(40, 20);
  w.setEdges({ left: 'loop', right: 'loop' });
  w.spawnProjectile(ID.PHOTON, 37.5, 10.5, 3, 0);
  run(w, 3);
  assert.equal(w.pn, 1);
  assert.ok(w.px[0] < 10, `at ${w.px[0].toFixed(1)}`);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `... --test test/loops.test.js < /dev/null`
Expected: the three new tests FAIL (gust 0, pressure leaks, photon killed: `pn` 0).

- [ ] **Step 3: Implement the air**

In `src/sim/air.js`, add after `setLoops`:

```js
  // On a looped side the border ring is a copy of the inside of the opposite
  // side, so blurs, gradients and traces carry on across the join.
  wrapRing() {
    if (!this.loopX && !this.loopY) return;
    const { W, H, p, t } = this;
    const mx = (x) => (!this.loopX ? x : x === 0 ? W - 2 : x === W - 1 ? 1 : x);
    const my = (y) => (!this.loopY ? y : y === 0 ? H - 2 : y === H - 1 ? 1 : y);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (x !== 0 && y !== 0 && x !== W - 1 && y !== H - 1) continue;
        const sx = mx(x), sy = my(y);
        if (sx === x && sy === y) continue; // a ring cell on a side that doesn't loop
        if (sx === 0 || sx === W - 1 || sy === 0 || sy === H - 1) continue;
        const i = y * W + x, j = sy * W + sx;
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
```

In `step(gravity)`: call `this.wrapRing();` right after the label lines (before step 1), again after the step-1 loop (before step 2), then after the step-2 loop call `this.syncSeams();`, and after `this.thicken()` call `this.syncSeams(); this.wrapRing();`, and at the end of `stepHeat` (after `tPressed.set(t)`) call `this.wrapRing();`.

Make the edge drag skip looped sides:

```js
    if (this.heat) {
      if (!this.loopX) for (let y = 0; y < H; y++) { vx[y * W] *= EDGE_DRAG; vx[y * W + W - 2] *= EDGE_DRAG; }
      if (!this.loopY) for (let x = 0; x < W; x++) { vy[x] *= EDGE_DRAG; vy[(H - 2) * W + x] *= EDGE_DRAG; }
    }
```

In `thicken`, a looped side's ring must count as open (with the region of the block it copies) so the blur reads it: change the `inside` line to

```js
        const ring = x === 0 || y === 0 || x === W - 1 || y === H - 1;
        const looped = ring && (this.loopX ? true : x > 0 && x < W - 1) && (this.loopY ? true : y > 0 && y < H - 1);
        open[i] = (!ring || looped) && !blocked[i] ? region[i] : 0;
```

In `label()`: seeds only on sides that don't loop, the flood crosses a looped seam, and afterwards a looped ring cell takes its mirror's region. Replace the seeding lines with

```js
    for (let x = 0; x < W; x++) { if (!this.loopY) { edge(x); edge((H - 1) * W + x); } }
    for (let y = 1; y < H - 1; y++) { if (!this.loopX) { edge(y * W); edge(y * W + W - 1); } }
```

replace the four neighbour lines in the flood with a helper that maps across the seam:

```js
      while (top > 0) {
        const i = stack[--top], r = region[i], x = i % W, y = (i / W) | 0;
        for (let k = 0; k < 4; k++) {
          let nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
          if (this.loopX && nx === 0 && x === 1) nx = W - 2; else if (this.loopX && nx === W - 1 && x === W - 2) nx = 1;
          if (this.loopY && ny === 0 && y === 1) ny = H - 2; else if (this.loopY && ny === H - 1 && y === H - 2) ny = 1;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (!blocked[j] && region[j] === 0) { region[j] = r; stack[top++] = j; }
        }
      }
```

and the start-scan so it doesn't start pockets on looped ring cells:

```js
      while (start < W * H && (blocked[start] || region[start] !== 0 || this.loopRing(start))) start++;
```

with, after the flood loop ends (before `this.regions = id;`):

```js
    // A looped ring cell belongs to the pocket of the block it copies.
    if (this.loopX || this.loopY) {
      for (let i = 0; i < W * H; i++) if (this.loopRing(i)) region[i] = region[this.mirror(i)];
    }
```

and the two helpers:

```js
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
```

Also guard `edge()` in label with `if (!blocked[i] && region[i] === 0 && !this.loopRing(i))`.

- [ ] **Step 4: Implement flying particles**

In `src/sim/particles.js` `moveProjectile`, replace

```js
      const nx = x + sx, ny = y + sy;
      const ix = Math.floor(nx), iy = Math.floor(ny);
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) { this.killProjectile(k); return; }
```

with

```js
      let nx = x + sx, ny = y + sy;
      // Across a looped edge, on round to the other side.
      if (nx < 0 || nx >= w) { if (!this.loopX) { this.killProjectile(k); return; } nx += nx < 0 ? w : -w; }
      if (ny < 0 || ny >= h) { if (!this.loopY) { this.killProjectile(k); return; } ny += ny < 0 ? h : -h; }
      const ix = Math.floor(nx), iy = Math.floor(ny);
```

and change `const nx`/`ny` uses accordingly (they are now `let`). The diagonal check `type[cy * w + ix]`/`type[iy * w + cx]` stays valid (all in range).

- [ ] **Step 5: Run tests, full suite, commit**

Run: `... --test test/loops.test.js test/edges.test.js test/pressure.test.js test/convection.test.js test/walls.test.js < /dev/null` — expected PASS; then the whole suite.

```bash
git add -A -- . ':!.claude'
git commit -m "Looping edges: air and flying particles wrap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Three-state edges in the Physics panel, and loop markers

**Files:**
- Modify: `src/game/physics-panel.js`, `index.html` (edge button titles), `style.css` (`.edge` states), `src/render/renderer.js` (`drawVoidEdges` → `drawEdges`)
- Test: `test/physics-panel.test.js`

**Interfaces:**
- Produces: `nextEdges(edges, side) → edges` (pure); `DEFAULTS.edges = { top: 'solid', bottom: 'solid', left: 'solid', right: 'solid' }`; `loadSettings` accepts the old booleans (`true` → `'void'`).

- [ ] **Step 1: Write the failing tests**

In `test/physics-panel.test.js`, import `nextEdges` and replace the round-trip test's `edges` with strings; add:

```js
test('clicking an edge cycles it solid, void, loop, and loops come in pairs', () => {
  const S = 'solid', V = 'void', L = 'loop';
  let e = { ...DEFAULTS.edges };
  e = nextEdges(e, 'left');
  assert.deepEqual(e, { top: S, bottom: S, left: V, right: S });
  e = nextEdges(e, 'left');
  assert.deepEqual(e, { top: S, bottom: S, left: L, right: L });
  e = nextEdges(e, 'right');
  assert.deepEqual(e, { top: S, bottom: S, left: S, right: S }, 'leaving a loop puts both sides back to solid');
  e = nextEdges({ top: V, bottom: V, left: S, right: S }, 'top');
  assert.deepEqual(e, { top: L, bottom: L, left: S, right: S }, 'a loop takes over the other side');
});

test('edges saved by an older version (true or false) still load', () => {
  const store = new Map([['sandbox-crafter:physics', JSON.stringify({ edges: { top: true, bottom: false } })]]);
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.deepEqual(loadSettings(storage).edges, { top: 'void', bottom: 'solid', left: 'solid', right: 'solid' });
});
```

Round trip: `const edges = { top: 'solid', bottom: 'void', left: 'loop', right: 'loop' };`.

- [ ] **Step 2: Run to verify they fail**

Run: `... --test test/physics-panel.test.js < /dev/null` — FAIL (`nextEdges` not exported).

- [ ] **Step 3: Implement**

`src/game/physics-panel.js`:

```js
const SOLID_EDGES = Object.freeze({ top: 'solid', bottom: 'solid', left: 'solid', right: 'solid' });
export const DEFAULTS = Object.freeze({ angle: 0, strength: 1, newtonian: false, convection: true, edges: SOLID_EDGES });
const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
const CYCLE = { solid: 'void', void: 'loop', loop: 'solid' };

// One edge's saved state: 'solid', 'void' or 'loop' (older saves stored
// true for a void).
const edgeState = (v) => (v === true || v === 'void' ? 'void' : v === 'loop' ? 'loop' : 'solid');

// Loops come in pairs: if either side of a pair loops, both do.
function pairLoops(e) {
  for (const [a, b] of [['top', 'bottom'], ['left', 'right']]) {
    if (e[a] === 'loop' || e[b] === 'loop') { e[a] = 'loop'; e[b] = 'loop'; }
  }
  return e;
}

// The edges after clicking `side`: solid → void → loop → solid. A loop
// takes the opposite side with it, and leaving a loop puts both back to solid.
export function nextEdges(edges, side) {
  const e = { ...edges };
  const now = CYCLE[e[side]];
  e[side] = now;
  if (now === 'loop') e[OPPOSITE[side]] = 'loop';
  else if (edges[side] === 'loop') e[OPPOSITE[side]] = 'solid';
  return e;
}
```

In `loadSettings`: `edges: pairLoops({ top: edgeState(data.edges?.top), bottom: edgeState(data.edges?.bottom), left: edgeState(data.edges?.left), right: edgeState(data.edges?.right) }),`.

In `apply()`: `this.world.setEdges(s.edges);` and

```js
    for (const b of this.edges) {
      const st = s.edges[b.dataset.edge];
      b.dataset.state = st;
      b.setAttribute('aria-pressed', String(st !== 'solid'));
      b.setAttribute('aria-label', `${b.dataset.name}: ${st}`);
    }
```

The click handler: `this.update({ edges: nextEdges(this.settings.edges, b.dataset.edge) });`.

In `index.html`, each edge button gets `data-name` ("Roof", "Left wall", "Right wall", "Floor"), and the `.edges` title becomes "Click a side: solid, then a void (things that leave vanish), then a loop (they come back in at the opposite side)". The reset button's title: "Gravity down at strength 1, Newtonian off, convection on, solid edges".

`style.css`: the existing pressed style stays for `[data-state='void']`; add

```css
.edge[data-state='loop'] { background: repeating-linear-gradient(90deg, #4fd1c5 0 3px, transparent 3px 6px); border-color: #4fd1c5; }
.edge-left[data-state='loop'], .edge-right[data-state='loop'] { background: repeating-linear-gradient(0deg, #4fd1c5 0 3px, transparent 3px 6px); }
```

(check the existing `.edge[aria-pressed='true']` rule and scope it to `[data-state='void']`).

`src/render/renderer.js`: rename `drawVoidEdges` to `drawEdges` (and its call in `draw`), keep the void bars, then add the loop markers:

```js
    if (world.loopX || world.loopY) {
      ctx.save();
      ctx.strokeStyle = 'rgba(79, 209, 197, 0.9)';
      ctx.lineWidth = t;
      ctx.setLineDash([t * 2, t * 2]);
      ctx.beginPath();
      if (world.loopX) { ctx.moveTo(x0 + t / 2, y0); ctx.lineTo(x0 + t / 2, y1); ctx.moveTo(x1 - t / 2, y0); ctx.lineTo(x1 - t / 2, y1); }
      if (world.loopY) { ctx.moveTo(x0, y0 + t / 2); ctx.lineTo(x1, y0 + t / 2); ctx.moveTo(x0, y1 - t / 2); ctx.lineTo(x1, y1 - t / 2); }
      ctx.stroke();
      ctx.restore();
    }
```

(move the `if (!v) return;` so it only skips the void bars).

- [ ] **Step 4: Run tests, full suite, commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Edges panel: solid, void or loop

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The wall layer

**Files:**
- Create: `src/sim/walls.js`
- Modify: `src/sim/world.js` (constructor, `clearCell`, `clearAll`, `spawn`, `swap`, `paintArea`, `eraseArea`, step loop, `airOf`, `wallBetween`), `src/sim/particles.js` (`WALLS` → wall layer), `src/render/renderer.js` (glow mask)
- Test: `test/wall-filters.test.js` (create)

**Interfaces:**
- Produces: `WALL_HERE`, `PASS` (`{ solid: 1, powder: 2, liquid: 4, gas: 8, energy: 16, particles: 32, heat: 64, air: 128 }`), `PASS_BIT` (Uint8Array by element id), `PASS_ORDER` (array of `[name, bit]` for the inspect line); `World.wall` (Uint16Array), `World.wallMask` (number, read by `spawn` for WALL), `World.meshCount` (cells whose wall lets anything through), `World.setWall(i, v)`.

- [ ] **Step 1: Write the failing tests**

Create `test/wall-filters.test.js`:

```js
// The Wall tool's checklist: each wall cell can let chosen things through.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { WALL_HERE, PASS } from '../src/sim/walls.js';
import { makeWorld, fillRect, wallBox, countOf, run } from './helpers.js';

// A wall line from (x, y0) down to (x, y1) that lets `mask` through.
function grate(w, x, y0, y1, mask) {
  w.wallMask = mask;
  for (let y = y0; y <= y1; y++) w.spawn(y * w.w + x, ID.WALL);
  w.wallMask = 0;
}

test('painting Wall sets the wall layer; erasing or Replace removes it', () => {
  const w = makeWorld(20, 10);
  const a = 5 * 20 + 5, b = 5 * 20 + 8;
  w.paint(5, 5, 0, ID.WALL);
  assert.equal(w.wall[a], WALL_HERE);
  w.wallMask = PASS.liquid;
  w.paint(8, 5, 0, ID.WALL);
  w.wallMask = 0;
  assert.equal(w.wall[b], WALL_HERE | PASS.liquid);
  assert.equal(w.meshCount, 1);
  w.erase(5, 5, 0);
  assert.equal(w.wall[a], 0);
  assert.equal(w.type[a], 0);
  w.replace = true;
  w.paint(8, 5, 0, ID.STONE);
  assert.equal(w.wall[b], 0);
  assert.equal(w.type[b], ID.STONE);
  assert.equal(w.meshCount, 0);
});

test('walls stay where they are while things pass through them', () => {
  const w = makeWorld(10, 3);
  grate(w, 5, 1, 1, PASS.liquid);
  w.spawn(14, ID.WATER);
  w.swap(14, 15); // into the wall
  assert.equal(w.type[15], ID.WATER);
  assert.equal(w.type[14], 0);
  w.swap(15, 16); // and out
  assert.equal(w.type[15], ID.WALL);
  assert.equal(w.type[16], ID.WATER);
  w.swap(16, 15);
  w.clearCell(15); // used up inside the wall
  assert.equal(w.type[15], ID.WALL, 'the wall is still there');
});

test('Clear removes walls and their layer', () => {
  const w = makeWorld(20, 10);
  grate(w, 5, 0, 9, PASS.gas);
  w.clearAll();
  assert.equal(countOf(w, ID.WALL), 0);
  assert.ok(w.wall.every((v) => v === 0));
  assert.equal(w.meshCount, 0);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `... --test test/wall-filters.test.js < /dev/null` — FAIL (no module `walls.js`).

- [ ] **Step 3: Implement**

Create `src/sim/walls.js`:

```js
// The wall layer: where walls stand, and what each lets through (the Wall
// tool's checklist). World.wall holds, per cell, 0 for no wall, or
// WALL_HERE plus a PASS bit for each kind of thing that may pass. A wall
// cell's type is WALL when nothing is passing through it; something passing
// through sits in the cell, with the wall layer still set underneath, the
// way a spark sits on a wire.

import { DEFS, State } from './elements.js';

export const WALL_HERE = 256;
export const PASS = Object.freeze({
  solid: 1, powder: 2, liquid: 4, gas: 8, energy: 16, particles: 32, heat: 64, air: 128,
});

// For the inspect line, in checklist order.
export const PASS_ORDER = [
  ['solids', PASS.solid], ['powders', PASS.powder], ['liquids', PASS.liquid], ['gases', PASS.gas],
  ['energy', PASS.energy], ['particles', PASS.particles], ['heat', PASS.heat], ['air', PASS.air],
];

// The bit that lets each element through a wall: by its state (only solid
// things that move ever try: loose debris and creatures), flying particles
// by PARTICLES.
export const PASS_BIT = Uint8Array.from(DEFS, (d) => {
  if (d.projectile) return PASS.particles;
  switch (d.state) {
    case State.SOLID: return PASS.solid;
    case State.POWDER: return PASS.powder;
    case State.LIQUID: return PASS.liquid;
    case State.GAS: return PASS.gas;
    case State.ENERGY: return PASS.energy;
    default: return 0;
  }
});

// Does the wall layer value `v` stop `bit`? (No wall stops nothing.)
export const stops = (v, bit) => v !== 0 && (v & bit) === 0;
```

In `src/sim/world.js`: `import { WALL_HERE, PASS, PASS_BIT, stops } from './walls.js';`. Constructor:

```js
    this.wall = new Uint16Array(n); // the wall layer (walls.js)
    this.wallMask = 0; // what the next Wall placed lets through (the Wall tool sets it)
    this.meshCount = 0; // wall cells that let anything through (for the renderer)
```

New method:

```js
  // Set cell i's wall layer, keeping meshCount up to date.
  setWall(i, v) {
    const was = this.wall[i];
    if ((was & 255) !== 0) this.meshCount--;
    if ((v & 255) !== 0) this.meshCount++;
    this.wall[i] = v;
  }
```

`clearCell(i)`: at the end, `if (this.wall[i] !== 0) this.type[i] = WALL; // a wall stays when what passed through it is gone`.

`clearAll()`: add `this.wall.fill(0); this.meshCount = 0;`.

`spawn(i, t)`: after `this.type[i] = t;` add `if (t === WALL) this.setWall(i, WALL_HERE | this.wallMask);`.

`swap(i, j)`: at the end,

```js
    // Walls stay where they are: something passing through one leaves it
    // standing behind it.
    if ((this.wall[i] | this.wall[j]) !== 0) { this.keepWall(i); this.keepWall(j); }
```

and

```js
  keepWall(c) {
    if (this.wall[c] !== 0) {
      if (this.type[c] === 0) { this.type[c] = WALL; this.temp[c] = AMBIENT; this.vx[c] = 0; this.vy[c] = 0; }
    } else if (this.type[c] === WALL) {
      this.clearCell(c);
    }
  }
```

`paintArea` (Replace path): `if (u !== 0) { if (this.wall[i] !== 0) this.setWall(i, 0); this.clearCell(i); }`.

`eraseArea`: inside the visitor, before `if (this.type[i]) this.clearCell(i);` add `if (this.wall[i] !== 0) this.setWall(i, 0);`.

Step loop: replace `if (t === WALL) { next[air.at(x, y)] = 1; continue; }` with

```js
        const wl = wall[i];
        if (wl !== 0) {
          if ((wl & PASS.air) === 0) next[air.at(x, y)] = 1;
          if (t === WALL) continue;
        }
```

(add `wall` to the destructuring at the top of `step`).

`airOf`: `if (stops(this.wall[j], PASS.air) || (AIRTIGHT[u] && !loose[j])) break;`
`wallBetween`: `if (stops(this.wall[y * this.w + x], PASS.air)) return true;`

`src/sim/particles.js`: `import { stops, PASS } from './walls.js';` Diagonal check:

```js
        if (ix !== cx && iy !== cy && stops(this.wall[cy * w + ix], PASS.particles) && stops(this.wall[iy * w + cx], PASS.particles)) {
```

`hitCell` start:

```js
    const wl = this.wall[j];
    if (wl !== 0) {
      if ((wl & PASS.particles) === 0) { this.bounce(k, ix, iy, lx, ly, WALLS); return BOUNCE; }
      if (u === WALL) return PASS; // through the wall, as through empty space
    }
```

(rename the local `PASS` result constant in particles.js to `THROUGH` first, since it clashes: `const THROUGH = 0, DEAD = 1, BOUNCE = 2;` and replace every `return PASS;` with `return THROUGH;`).

Renderer glow mask: `if (world.wall[i] !== 0 && (world.wall[i] & 32) === 0) glowWall[...] = 1;` (32 = PASS.particles; import `PASS` from walls.js and use `PASS.particles`).

- [ ] **Step 4: Run tests**

Run: `... --test test/wall-filters.test.js test/walls.test.js < /dev/null`, then the whole suite. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Wall layer: walls stay put under whatever passes through

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: What the checklist lets through

**Files:**
- Modify: `src/sim/world.js` (`canEnter`, `conductHeat`, `heatArea`, `warmAir` rate for walls)
- Test: `test/wall-filters.test.js` (append)

**Interfaces:**
- Consumes: `World.wall`, `PASS`, `PASS_BIT`, `stops` (Task 4).
- Produces: `WALL_COND = 0.9` in world.js.

- [ ] **Step 1: Write the failing tests** (append)

```js
test('a liquids-only wall lets water through and stops sand', () => {
  const w = makeWorld(40, 20);
  fillRect(w, 0, 19, 39, 19, ID.WALL);
  grate(w, 20, 0, 18, PASS.liquid);
  fillRect(w, 2, 10, 15, 18, ID.WATER);
  fillRect(w, 2, 2, 15, 6, ID.SAND);
  run(w, 400);
  let water = 0, sand = 0;
  for (let y = 0; y < 19; y++) {
    for (let x = 21; x < 40; x++) {
      const t = w.type[y * 40 + x];
      if (t === ID.WATER) water++;
      if (t === ID.SAND) sand++;
    }
  }
  assert.ok(water > 20, `${water} water got through`);
  assert.equal(sand, 0, 'no sand got through');
  for (let y = 0; y < 19; y++) assert.notEqual(w.wall[y * 40 + 20], 0, 'the wall is all still there');
});

test('a gases-only box lets smoke out and keeps water in', () => {
  const w = makeWorld(60, 40);
  w.wallMask = PASS.gas;
  const box = wallBox(w, 20, 10, 40, 30);
  w.wallMask = 0;
  fillRect(w, box.x0, box.y0, box.x1, box.y0 + 4, ID.SMOKE);
  fillRect(w, box.x0, box.y1 - 4, box.x1, box.y1, ID.WATER);
  const water = countOf(w, ID.WATER);
  run(w, 300);
  let out = 0;
  for (let i = 0; i < w.type.length; i++) {
    const x = i % 60, y = (i / 60) | 0;
    if (w.type[i] === ID.SMOKE && (x < 20 || x > 40 || y < 10 || y > 30)) out++;
  }
  assert.ok(out > 5, `${out} smoke got out`);
  assert.equal(countOf(w, ID.WATER), water, 'the water stayed in');
});

test('light goes through a particles wall and bounces off a plain one', () => {
  const through = (mask) => {
    const w = makeWorld(60, 20);
    grate(w, 30, 0, 19, mask);
    for (let n = 0; n < 10; n++) w.spawnProjectile(ID.PHOTON, 20.5, 5.5 + n, 3, 0);
    run(w, 6);
    let right = 0;
    for (let k = 0; k < w.pn; k++) if (w.px[k] > 30) right++;
    return right;
  };
  assert.equal(through(PASS.particles), 10);
  assert.equal(through(0), 0);
});

test('a heat wall conducts and warms; a plain one stays at room temperature', () => {
  const far = (mask) => {
    const w = makeWorld(40, 10);
    fillRect(w, 5, 5, 19, 5, ID.METAL);
    grate(w, 20, 5, 5, mask);
    fillRect(w, 21, 5, 35, 5, ID.METAL);
    run(w, 200, () => { for (let x = 5; x < 10; x++) w.temp[5 * 40 + x] = 1000; });
    return { far: w.temp[5 * 40 + 25], wall: w.temp[5 * 40 + 20] };
  };
  const hot = far(PASS.heat), plain = far(0);
  assert.ok(hot.far > 100, `through a heat wall the far side reached ${hot.far.toFixed(0)}`);
  assert.ok(hot.wall > 100, 'and the wall itself warmed');
  assert.ok(plain.far < 30 && plain.wall === 22, `plain: far ${plain.far.toFixed(0)}, wall ${plain.wall}`);
});

test('an air wall lets the pressure out of a box; a plain one holds it', () => {
  const left = (mask) => {
    const w = makeWorld(60, 40);
    w.wallMask = mask;
    const box = wallBox(w, 21, 13, 38, 30);
    w.wallMask = 0;
    w.pressurizeArea((fn) => w.forRect(box.x0, box.y0, box.x1, box.y1, fn), 40);
    run(w, 300);
    return w.pressureAt(30, 22);
  };
  assert.ok(left(PASS.air) < 2, 'it leaked away');
  assert.ok(left(0) > 35, 'it held');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `... --test test/wall-filters.test.js < /dev/null` — the liquids, gases and heat tests FAIL (walls stop everything; the heat wall stays at 22). The particles and air tests may already pass after Task 4: that's fine.

- [ ] **Step 3: Implement**

`canEnter(d, j, dy)`, after `if (u === 0) return true;`:

```js
    // A wall lets in what its checklist lets through (see walls.js).
    if (u === WALL) return (this.wall[j] & PASS_BIT[d.id]) !== 0;
```

`conductHeat`: near the top, `const wall = this.wall;` and `const WALL_TOUCH = WALL_COND * AIR_TOUCH;`. Replace the wall line with

```js
        // Wall is a perfect insulator, unless it lets heat through: then it
        // conducts like metal.
        let ka = COND[t];
        if (t === WALL) {
          if ((wall[i] & PASS.heat) === 0) { temp[i] = AMBIENT; continue; }
          ka = WALL_COND;
        }
```

(remove the old `const ka = COND[t];`), and in the two neighbour exchanges use

```js
            const kb = u === WALL ? ((wall[i + 1] & PASS.heat) !== 0 ? WALL_COND : 0) : COND[u];
```

(`i + w` for the second). In the convection branch, `const r = t === WALL ? WALL_TOUCH : TOUCH[t];`. In `conductPair` (Task 1) treat WALL the same way (a WALL without the heat bit has conductivity 0).

`heatArea`: `if (t === WALL && (this.wall[i] & PASS.heat) === 0) return;`

Add near the other heat constants: `const WALL_COND = 0.9; // a wall that lets heat through conducts like metal`.

- [ ] **Step 4: Run tests, full suite, commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Wall checklist: solids, powders, liquids, gases, energy, particles, heat and air

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Time zones

**Files:**
- Create: `src/sim/time.js`
- Modify: `src/sim/world.js` (constructor, `clock` stamps → `pass`, step loop, `clearAll`, conduction rate), `src/sim/behaviors.js:324`, `src/sim/machines-motion.js:37`, `src/sim/particles.js` (`moveProjectile`)
- Test: `test/time.test.js` (create)

**Interfaces:**
- Produces: `SPEEDS = [1, 0.25, 0.5, 2, 4]`, `SLOW_EVERY = [1, 4, 2, 1, 1]`, `EXTRA_PASSES = [0, 0, 0, 1, 3]` (time.js); `World.speed` (Uint8Array), `World.zoneCount`, `World.zoneBox` (`[x0, y0, x1, y1]` of fast cells or null), `World.pass`; `World.paintSpeed(area, code)`; `World.fastPasses(fromBottom)`.

- [ ] **Step 1: Write the failing tests**

Create `test/time.test.js`:

```js
// The Time brush: areas that run at ¼×, ½×, 2× or 4× speed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, countOf, run } from './helpers.js';

const zone = (w, x0, y0, x1, y1, code) => w.paintSpeed((fn) => w.forRect(x0, y0, x1, y1, fn), code);
const QUARTER = 1, HALF = 2, DOUBLE = 3, QUADRUPLE = 4;

// How far a grain dropped at (x, 5) has fallen.
const fallen = (w, x) => {
  for (let y = 0; y < w.h; y++) if (w.type[y * w.w + x] === ID.SAND) return y - 5;
  return -1;
};

test('sand falls a quarter as fast in a ¼× area and faster in a 4× area', () => {
  const w = makeWorld(60, 200);
  zone(w, 25, 0, 35, 199, QUARTER);
  zone(w, 45, 0, 55, 199, QUADRUPLE);
  for (const x of [10, 30, 50]) w.spawn(5 * 60 + x, ID.SAND);
  run(w, 16);
  const normal = fallen(w, 10), slow = fallen(w, 30), fast = fallen(w, 50);
  assert.ok(slow < normal / 2.5, `slow ${slow} vs normal ${normal}`);
  assert.ok(fast > normal * 2, `fast ${fast} vs normal ${normal}`);
});

test('a fire in a 4× area burns out much sooner', () => {
  const burnout = (code) => {
    const w = makeWorld(40, 40);
    if (code) zone(w, 0, 0, 39, 39, code);
    fillRect(w, 15, 30, 25, 35, ID.WOOD);
    w.paint(20, 29, 2, ID.FIRE);
    let f = 0;
    run(w, 3000, () => { if (f === 0 && countOf(w, ID.WOOD) === 0 && countOf(w, ID.FIRE) === 0) f = w.tick; });
    return f || 3000;
  };
  const normal = burnout(0), fast = burnout(QUADRUPLE);
  assert.ok(fast < normal / 2, `4×: ${fast} frames, normal: ${normal}`);
});

test('a photon slows down crossing a ½× area', () => {
  const at = (code) => {
    const w = makeWorld(120, 20);
    if (code) zone(w, 30, 0, 89, 19, code);
    w.spawnProjectile(ID.PHOTON, 5.5, 10.5, 3, 0);
    run(w, 20);
    return w.px[0];
  };
  assert.ok(at(HALF) < at(0) - 10, `${at(HALF).toFixed(1)} vs ${at(0).toFixed(1)}`);
});

test('heat crosses a 4× bar faster, and never overshoots', () => {
  const far = (code) => {
    const w = makeWorld(60, 10);
    fillRect(w, 5, 5, 54, 5, ID.STONE);
    if (code) zone(w, 0, 0, 59, 9, code);
    let ok = true;
    run(w, 60, () => {
      w.temp[5 * 60 + 5] = 1000;
      for (let x = 5; x < 55; x++) { const T = w.temp[5 * 60 + x]; if (T > 1000.01 || T < 21.99) ok = false; }
    });
    return { T: w.temp[5 * 60 + 20], ok };
  };
  const fast = far(QUADRUPLE), normal = far(0);
  assert.ok(fast.T > normal.T + 20, `${fast.T.toFixed(0)} vs ${normal.T.toFixed(0)}`);
  assert.ok(fast.ok, 'stayed between the two temperatures');
});

test('painting normal speed removes a zone, and Clear removes them all', () => {
  const w = makeWorld(40, 40);
  zone(w, 0, 0, 9, 9, DOUBLE);
  assert.equal(w.zoneCount, 100);
  zone(w, 0, 0, 4, 9, 0);
  assert.equal(w.zoneCount, 50);
  zone(w, 20, 20, 29, 29, QUARTER);
  w.clearAll();
  assert.equal(w.zoneCount, 0);
  assert.ok(w.speed.every((v) => v === 0));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `... --test test/time.test.js < /dev/null` — FAIL (`w.paintSpeed is not a function`).

- [ ] **Step 3: Implement**

Create `src/sim/time.js`:

```js
// Time zones: the Time brush paints areas that run slower or faster than
// the rest of the world. World.speed holds a code per cell: 0 normal, then
// ¼×, ½×, 2× and 4×. The speed belongs to the place, not to what's in it.
// Mixed into World.prototype.

export const SPEEDS = [1, 0.25, 0.5, 2, 4];
// A slow cell's particle is updated on every SLOW_EVERY-th frame; a fast
// one gets EXTRA_PASSES more updates after the frame's normal pass.
export const SLOW_EVERY = [1, 4, 2, 1, 1];
export const EXTRA_PASSES = [0, 0, 0, 1, 3];

export const TimeZones = {
  // Set every cell in `area` to speed `code`.
  paintSpeed(area, code) {
    const { speed } = this;
    area((i) => {
      const was = speed[i];
      if (was === code) return;
      if (was === 0) this.zoneCount++;
      if (code === 0) this.zoneCount--;
      speed[i] = code;
    });
    this.findFastBox();
  },

  // The box round every fast cell, so the extra passes only visit that.
  findFastBox() {
    const { w, h, speed } = this;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    if (this.zoneCount > 0) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (EXTRA_PASSES[speed[y * w + x]] === 0) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    this.zoneBox = x1 < 0 ? null : [x0, y0, x1, y1];
  },

  clearZones() {
    this.speed.fill(0);
    this.zoneCount = 0;
    this.zoneBox = null;
  },

  // After the frame's normal pass: extra passes over the fast area, one
  // for 2× cells, three for 4×, in the same order as the normal pass.
  fastPasses(fromBottom) {
    const box = this.zoneBox;
    if (box === null) return;
    const [x0, y0, x1, y1] = box;
    const { w, type, clock, speed } = this;
    const WALL_ID = this.WALL_ID;
    for (let p = 1; p <= 3; p++) {
      const pass = ++this.pass;
      for (let n = 0; n <= y1 - y0; n++) {
        const y = fromBottom ? y1 - n : y0 + n;
        const leftToRight = ((this.tick + y + p) & 1) === 0;
        for (let k = 0; k <= x1 - x0; k++) {
          const x = leftToRight ? x0 + k : x1 - k;
          const i = y * w + x;
          if (EXTRA_PASSES[speed[i]] < p) continue;
          const t = type[i];
          if (t === 0 || t === WALL_ID || clock[i] === pass) continue;
          clock[i] = pass;
          this.update(i, x, y, t);
        }
      }
    }
  },
};
```

In `src/sim/world.js`: `import { TimeZones, SPEEDS, SLOW_EVERY } from './time.js';`, add `TimeZones` to the `Object.assign(World.prototype, ...)` list, and in the constructor:

```js
    this.speed = new Uint8Array(n); // time zones (time.js): 0 normal, 1-4 ¼× ½× 2× 4×
    this.zoneCount = 0;
    this.zoneBox = null;
    this.pass = 1; // one higher for every update pass; `clock` holds the pass a cell was last updated in
    this.WALL_ID = WALL;
```

Replace every `this.clock[...] = this.tick` in `world.js` (`spawn`, `convert`, `swap`) with `this.pass`, and in `behaviors.js:324` likewise; in `machines-motion.js:37` compare `this.clock[j] === this.pass`.

In `step()`: after `const tick = ++this.tick;` add `const pass = ++this.pass;` and `const { speed } = this; const zones = this.zoneCount !== 0;`. The update lines become:

```js
        if (clock[i] === pass) continue;
        clock[i] = pass;
        // A slow area's particles sit out the frames in between.
        if (zones && speed[i] !== 0 && tick % SLOW_EVERY[speed[i]] !== 0) continue;
        this.update(i, x, y, t);
```

and after the scan loop (before the SEAL_COUNT loop): `if (this.zoneBox !== null) this.fastPasses(fromBottom);`.

`clearAll()`: add `this.clearZones();`.

Heat at zone speeds — in `conductHeat`, when `this.zoneCount !== 0`, scale each neighbour exchange: write the exchange as

```js
            let k = (ka < kb ? ka : kb) * CONDUCT_RATE;
            if (zones && (speed[i] | speed[i + 1]) !== 0) k = zoneRate(k, speed[i], speed[i + 1]);
```

with, at module level in world.js:

```js
// A pair's heat exchange share k at the slower of two time-zone speeds:
// as many steps of k as the speed says (a fraction of one for a slow
// area), so a 4× cell conducts as four steps would and never overshoots.
function zoneRate(k, a, b) {
  const s = Math.min(SPEEDS[a], SPEEDS[b]);
  return (1 - (1 - 2 * k) ** s) / 2;
}
```

(the same in the `i + w` exchange; `zones` and `speed` are read once at the top of `conductHeat`). Air contact (`TOUCH`, `AIR_COOL`) stays as it is.

`src/sim/particles.js` `moveProjectile`: replace `if (--this.plife[k] <= 0) { ... }` with

```js
    // In a time zone a particle moves (and ages) at that area's speed.
    let zone = 0;
    if (this.zoneCount !== 0) zone = this.speed[(this.py[k] | 0) * this.w + (this.px[k] | 0)];
    const age = zone === 0 ? 1 : SPEEDS[zone] >= 1 ? SPEEDS[zone] : (this.tick % SLOW_EVERY[zone] === 0 ? 1 : 0);
    this.plife[k] -= age;
    if (this.plife[k] <= 0) { this.expireProjectile(k, t); return; }
```

and after the light-speed scaling: `if (zone !== 0) { vx *= SPEEDS[zone]; vy *= SPEEDS[zone]; }`. Import `SPEEDS, SLOW_EVERY` from `./time.js`.

- [ ] **Step 4: Run tests, full suite, bench, commit**

Run the time tests, then the suite; then the demo bench (`ELECTRON_RUN_AS_NODE=1 ... "<scratchpad>/bench.mjs" < /dev/null`, the one in the earlier session's scratchpad) — expected about the same ms/step as before.

```bash
git add -A -- . ':!.claude'
git commit -m "Time brush: areas at quarter, half, double and four times speed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Portals

**Files:**
- Create: `src/sim/portals.js`
- Modify: `src/sim/world.js` (init, `update` hook, `step` hook, `clearAll`, `eraseArea`), `src/sim/particles.js` (`moveProjectile` hook)
- Test: `test/portals.test.js` (create)

**Interfaces:**
- Produces: `initPortals(world)`, `Portals` mix-in, `MAX_PORTALS = 32`, `PORTAL_SHARE = 0.2`, `portalHues(slot) → [hueA, hueB]`; `World.portals` (array of pairs or null), `World.portalAt` (Int32Array: 0, or `((slot + 1) << 17) | (end << 16) | pos`), `World.portalCells`; `World.addPortal(x0, y0, x1, y1) → { slot, end } | 'full' | null`; `World.removePortalAt(i) → boolean`; `World.clearPortals()`; `World.portalInfo(i) → { slot, end, paired } | null`; `World.crossPortal(i, x, y, t) → boolean`; `World.portalProjectile(k, j) → boolean`; `World.stepPortalAir()`.

- [ ] **Step 1: Write the failing tests**

Create `test/portals.test.js`:

```js
// Portals: two lines; anything crossing one comes out of the other.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { MAX_PORTALS } from '../src/sim/portals.js';
import { makeWorld, fillRect, wallBox, countOf, run } from './helpers.js';

test('sand falling through a floor portal comes out of a ceiling portal, round and round', () => {
  const w = makeWorld(60, 60);
  w.addPortal(20, 50, 40, 50);
  w.addPortal(20, 5, 40, 5);
  fillRect(w, 28, 40, 32, 44, ID.SAND);
  let topSeen = 0;
  run(w, 120, () => { for (let i = 6 * 60; i < 20 * 60; i++) if (w.type[i] === ID.SAND) topSeen++; });
  assert.ok(topSeen > 0, 'sand came out under the ceiling portal');
  assert.equal(countOf(w, ID.SAND), 25, 'none lost');
  for (let i = 51 * 60; i < 60 * 60; i++) assert.notEqual(w.type[i], ID.SAND, 'none fell past the floor portal');
});

test('a lone end does nothing', () => {
  const w = makeWorld(40, 40);
  w.addPortal(10, 20, 30, 20);
  fillRect(w, 18, 10, 22, 12, ID.SAND);
  run(w, 80);
  let below = 0;
  for (let i = 21 * 40; i < 40 * 40; i++) if (w.type[i] === ID.SAND) below++;
  assert.equal(below, 15, 'all the sand fell past it');
});

test('light is turned by perpendicular ends and keeps its way through parallel ones', () => {
  const exit = (bx0, by0, bx1, by1) => {
    const w = makeWorld(100, 100);
    w.addPortal(20, 10, 20, 30); // a vertical end
    w.addPortal(bx0, by0, bx1, by1);
    w.spawnProjectile(ID.PHOTON, 10.5, 20.5, 2, 0);
    run(w, 8);
    return [w.pvx[0], w.pvy[0]];
  };
  const [vx1, vy1] = exit(60, 10, 60, 30); // parallel
  assert.ok(vx1 > 1.9 && Math.abs(vy1) < 0.1, `parallel: ${vx1}, ${vy1}`);
  const [vx2, vy2] = exit(50, 60, 70, 60); // horizontal: a quarter turn
  assert.ok(Math.abs(vx2) < 0.1 && Math.abs(vy2) > 1.9, `perpendicular: ${vx2}, ${vy2}`);
});

test('smoke drifts out of a box through a portal pair', () => {
  const w = makeWorld(80, 40);
  const box = wallBox(w, 5, 5, 30, 35);
  w.addPortal(box.x0 + 2, 10, box.x1 - 2, 10); // inside, near the top
  w.addPortal(50, 20, 70, 20); // outside
  fillRect(w, box.x0, box.y0 + 8, box.x1, box.y1, ID.SMOKE);
  run(w, 400);
  let out = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.SMOKE && i % 80 > 35) out++;
  assert.ok(out > 5, `${out} smoke came out`);
});

test('pressure on one side of an end reaches the matching side of the other', () => {
  const w = makeWorld(80, 40);
  w.addPortal(10, 20, 30, 20); // normal points down: its −n side is above
  w.addPortal(50, 20, 70, 20);
  run(w, 60, () => w.pressurize(20, 13, 3, 1));
  const below = w.pressureAt(60, 26), above = w.pressureAt(60, 14);
  assert.ok(below > above + 0.5, `below the other end ${below.toFixed(2)}, above it ${above.toFixed(2)}`);
});

test('with the way out blocked, things wait on the line', () => {
  const w = makeWorld(60, 60);
  w.addPortal(20, 50, 40, 50);
  w.addPortal(20, 5, 40, 5);
  fillRect(w, 18, 6, 42, 6, ID.WALL); // right under the ceiling end
  fillRect(w, 28, 44, 32, 46, ID.SAND);
  run(w, 60);
  let onLine = 0;
  for (let x = 20; x <= 40; x++) if (w.type[50 * 60 + x] === ID.SAND) onLine++;
  assert.ok(onLine > 0, 'sand is waiting on the floor end');
  assert.equal(countOf(w, ID.SAND), 15);
});

test('removing a pair: right-click, erase and Clear', () => {
  const w = makeWorld(60, 60);
  w.addPortal(10, 10, 30, 10);
  w.addPortal(10, 40, 30, 40);
  assert.ok(w.removePortalAt(10 * 60 + 15));
  assert.ok(w.portalAt.every((v) => v === 0) && w.portalCells === 0);
  w.addPortal(10, 10, 30, 10);
  w.addPortal(10, 40, 30, 40);
  w.erase(20, 40, 1);
  assert.ok(w.portalAt.every((v) => v === 0), 'erasing one end removes the pair');
  w.addPortal(10, 10, 30, 10);
  w.clearAll();
  assert.ok(w.portalAt.every((v) => v === 0) && w.portals.every((p) => p === null));
});

test("ends can't overlap, and there are at most 32 pairs", () => {
  const w = makeWorld(200, 200);
  w.addPortal(10, 10, 50, 10);
  const r = w.addPortal(30, 0, 30, 20); // crosses the first at (30, 10)
  assert.equal(w.portalInfo(10 * 200 + 30).slot, 0, 'the crossing cell still belongs to the first');
  assert.equal(r.slot, 0);
  for (let k = 1; k < MAX_PORTALS; k++) { w.addPortal(5, 20 + k * 5, 40, 20 + k * 5); w.addPortal(60, 20 + k * 5, 90, 20 + k * 5); }
  assert.equal(w.addPortal(100, 10, 150, 10), 'full');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `... --test test/portals.test.js < /dev/null` — FAIL (no module `portals.js`).

- [ ] **Step 3: Implement `src/sim/portals.js`**

```js
// Portals: pairs of lines. Anything crossing one end comes out of the other
// at the same fraction of the way along, on the far side, still going, its
// direction turned by the angle between the two lines: a window between two
// places, always two-way. Each end is read in whichever direction makes the
// turn 90° or less, so parallel ends never flip anything.
//
// World.portalAt marks the cells of every end: ((slot + 1) << 17) |
// (end << 16) | position along the end. Portal cells are ordinary empty
// space as far as movement goes; a particle that ends a move on one goes
// through when it's next updated (crossPortal). Flying particles go through
// as they enter the cell (portalProjectile). The air on each side of one
// end evens out with the air on the matching side of the other
// (stepPortalAir). Mixed into World.prototype; initPortals sets up storage.

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

// An end: its cells, where it starts, its unit tangent and normal.
function makeEnd(cells, w) {
  const [xa, ya] = [cells[0] % w, (cells[0] / w) | 0];
  const last = cells[cells.length - 1];
  const [xb, yb] = [last % w, (last / w) | 0];
  const len = Math.hypot(xb - xa, yb - ya) || 1;
  const tx = (xb - xa) / len, ty = (yb - ya) / len;
  return { cells, tx, ty, nx: -ty, ny: tx };
}

const sign = (v) => (v < 0 ? -1 : 1);

export const Portals = {
  // Draw an end from (x0, y0) to (x1, y1). It's the second end of the last
  // pair if that has only one; otherwise the first end of a new pair.
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
    if (end === 0) portals[slot] = { a: e, b: null, cos: 1, sin: 0 };
    else {
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
  // Returns true when it went (or is waiting on the line).
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

  // A flying particle entering portal cell j: out of the other end,
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
  // side, and the other way round: pressure, and air heat (which moves no
  // pressure, so tPressed moves with it).
  stepPortalAir() {
    const { air, w } = this;
    const { p, t, tPressed, blocked } = air;
    const share = (a, b) => {
      if (a < 0 || b < 0 || a === b || blocked[a] || blocked[b]) return;
      const dp = (p[b] - p[a]) * PORTAL_SHARE;
      p[a] += dp; p[b] -= dp;
      if (air.heat) {
        const dt = (t[b] - t[a]) * PORTAL_SHARE;
        t[a] += dt; t[b] -= dt; tPressed[a] += dt; tPressed[b] -= dt;
      }
    };
    const blockAt = (c, ox, oy) => {
      const x = Math.round((c % w) + ox), y = Math.round(((c / w) | 0) + oy);
      return x < 0 || y < 0 || x >= w || y >= this.h ? -1 : air.at(x, y);
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
```

- [ ] **Step 4: Hook it into the world**

`src/sim/world.js`: `import { Portals, initPortals } from './portals.js';`, add `Portals` to the mix-in list, call `initPortals(this);` in the constructor after `initMachines(this)`.

At the very top of `update(i, x, y, t)`:

```js
    // Something sitting on a portal goes through it (portals.js).
    if (this.portalCells !== 0 && this.portalAt[i] !== 0 && this.crossPortal(i, x, y, t)) return;
```

In `step()`, after `this.stepPipes();`: `if (this.portalCells !== 0) this.stepPortalAir();`.

`clearAll()`: add `this.clearPortals();`.

`eraseArea`: inside the visitor add `if (this.portalAt[i] !== 0) this.removePortalAt(i);`.

`src/sim/particles.js` `moveProjectile`, inside `if (ix !== cx || iy !== cy) {` right after the diagonal wall check:

```js
        // Into a portal: out of the other end, turned. The rest of this
        // frame's travel is dropped (at most one frame's step).
        const jp = iy * w + ix;
        if (this.portalCells !== 0 && this.portalAt[jp] !== 0 && this.portalProjectile(k, jp)) {
          x = this.px[k];
          y = this.py[k];
          cx = x | 0;
          cy = y | 0;
          break;
        }
```

After the loop, the existing `this.px[k] = x; this.py[k] = y;` stores the new place.

- [ ] **Step 5: Run tests, full suite, commit**

Run: `... --test test/portals.test.js < /dev/null` then the suite.

```bash
git add -A -- . ':!.claude'
git commit -m "Portals: two-way windows for things, light and air

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Tools, options strip and inspect notes

**Files:**
- Create: `src/game/tool-options.js`, `src/game/cell-notes.js`
- Modify: `src/game/input.js`, `src/game/ui.js`, `src/main.js`, `index.html`, `style.css`
- Test: `test/tools.test.js` (append), `test/hard-mode.test.js` (append)

**Interfaces:**
- Consumes: `World.addPortal`, `removePortalAt`, `paintSpeed`, `wallMask`, `portalInfo`, `speed`, `wall`, `PASS_ORDER`.
- Produces: `TOOLS` gains `'portal'`, `'time'`; `loadToolOptions(storage) → { wallMask, timeSpeed }`, `saveToolOptions(options, storage)`, `TOOL_OPTION_DEFAULTS = { wallMask: 0, timeSpeed: 1 }`; `cellNotes(world, i) → string[]`; `Input.onPortal` callback `(result) => void`; `game.toolOptions` and `game.setToolOptions(change)`.

- [ ] **Step 1: Write the failing tests** (append to `test/tools.test.js`)

```js
import { Input, TOOLS, HARD_BLOCKED } from '../src/game/input.js';
import { loadToolOptions, saveToolOptions, TOOL_OPTION_DEFAULTS } from '../src/game/tool-options.js';
import { cellNotes } from '../src/game/cell-notes.js';
import { PASS } from '../src/sim/walls.js';

const stubCanvas = { addEventListener() {}, setPointerCapture() {} };
const inputFor = (w, sel, extra = {}) => new Input(stubCanvas, () => w,
  { selection: sel, brush: 0, brushShape: 'circle', replace: false, toolOptions: { ...TOOL_OPTION_DEFAULTS, ...extra } }, null);

test('the Portal and Time tools are in the grid, and hard mode keeps them', () => {
  assert.ok(TOOLS.includes('portal') && TOOLS.includes('time'));
  assert.ok(!HARD_BLOCKED.has('portal') && !HARD_BLOCKED.has('time'));
});

test('the Time tool paints the chosen speed; right-dragging sets it back', () => {
  const w = makeWorld(20, 20);
  const input = inputFor(w, { kind: 'tool', id: 'time' }, { timeSpeed: 4 });
  const area = (fn) => w.forRect(2, 2, 5, 5, fn);
  input.act(w, area, 0, 0, false);
  assert.equal(w.speed[3 * 20 + 3], 4);
  input.act(w, area, 0, 0, true);
  assert.equal(w.zoneCount, 0, 'right-drag resets, rather than erasing');
});

test('the Wall tool paints walls with the ticked boxes', () => {
  const w = makeWorld(20, 20);
  const input = inputFor(w, { kind: 'tool', id: 'wall' }, { wallMask: PASS.gas | PASS.heat });
  input.act(w, (fn) => fn(5 * 20 + 5, 5, 5), 0, 0, false);
  assert.equal(w.wall[5 * 20 + 5] & 255, PASS.gas | PASS.heat);
  assert.equal(w.wallMask, 0, 'the world is left painting plain walls');
});

test('tool options survive a save and load; bad storage gives the defaults', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  saveToolOptions({ wallMask: PASS.liquid, timeSpeed: 3 }, storage);
  assert.deepEqual(loadToolOptions(storage), { wallMask: PASS.liquid, timeSpeed: 3 });
  store.set('sandbox-crafter:tool-options', '{bad');
  assert.deepEqual(loadToolOptions(storage), TOOL_OPTION_DEFAULTS);
  assert.deepEqual(loadToolOptions(undefined), TOOL_OPTION_DEFAULTS);
});

test('the inspect line notes walls that let things through, time zones and portals', () => {
  const w = makeWorld(20, 20);
  w.wallMask = PASS.liquid | PASS.gas;
  w.spawn(5, ID.WALL);
  w.wallMask = 0;
  assert.deepEqual(cellNotes(w, 5), ['lets liquids, gases through']);
  w.paintSpeed((fn) => fn(6, 6, 0), 1);
  assert.deepEqual(cellNotes(w, 6), ['¼× speed']);
  w.addPortal(0, 10, 10, 10);
  assert.deepEqual(cellNotes(w, 10 * 20 + 3), ['Portal 1, blue end (draw the other end)']);
  w.addPortal(0, 15, 10, 15);
  assert.deepEqual(cellNotes(w, 15 * 20 + 3), ['Portal 1, orange end']);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `... --test test/tools.test.js < /dev/null` — FAIL (no `tool-options.js`).

- [ ] **Step 3: Implement the modules**

`src/game/tool-options.js`:

```js
// The options strip under the tools: the Wall checklist (a PASS mask, see
// walls.js) and the Time brush's speed (1-4: ¼× ½× 2× 4×). Kept in
// localStorage, guarded like the other saved settings.

const KEY = 'sandbox-crafter:tool-options';
export const TOOL_OPTION_DEFAULTS = Object.freeze({ wallMask: 0, timeSpeed: 1 });

export function loadToolOptions(storage = globalThis.localStorage) {
  try {
    const data = JSON.parse(storage.getItem(KEY));
    if (!data || typeof data !== 'object') return { ...TOOL_OPTION_DEFAULTS };
    const m = Number(data.wallMask), s = Number(data.timeSpeed);
    return {
      wallMask: Number.isInteger(m) && m >= 0 && m <= 255 ? m : 0,
      timeSpeed: Number.isInteger(s) && s >= 1 && s <= 4 ? s : TOOL_OPTION_DEFAULTS.timeSpeed,
    };
  } catch {
    return { ...TOOL_OPTION_DEFAULTS };
  }
}

export function saveToolOptions(options, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(options));
  } catch {
    // Nothing to do; the options just won't be remembered.
  }
}
```

`src/game/cell-notes.js`:

```js
// Extra notes for the inspect line about cell i: a wall that lets things
// through, a time zone, a portal.

import { PASS_ORDER } from '../sim/walls.js';

const SPEED_NAMES = ['', '¼×', '½×', '2×', '4×'];

export function cellNotes(world, i) {
  const notes = [];
  const wl = world.wall[i] & 255;
  if (wl !== 0) notes.push(`lets ${PASS_ORDER.filter(([, b]) => wl & b).map(([n]) => n).join(', ')} through`);
  const s = world.speed[i];
  if (s !== 0) notes.push(`${SPEED_NAMES[s]} speed`);
  const p = world.portalInfo(i);
  if (p) {
    // The first pair is blue and orange; later pairs have other colours.
    const name = p.slot === 0 ? (p.end === 0 ? 'blue' : 'orange') : (p.end === 0 ? 'first' : 'second');
    notes.push(`Portal ${p.slot + 1}, ${name} end${p.paired ? '' : ' (draw the other end)'}`);
  }
  return notes;
}
```

- [ ] **Step 4: Implement the tools**

`src/game/input.js`:

```js
export const TOOLS = ['erase', 'wall', 'spark', 'heat', 'cool', 'wind', 'mix', 'pressure', 'vacuum', 'portal', 'time'];
```

In the constructor: `this.onPortal = null; // told what drawing a portal end did`.

In `pointerDown`, after `this.over = true;` and before the Shift/Ctrl check:

```js
    const sel = this.state.selection;
    if (sel.kind === 'tool' && sel.id === 'portal') {
      // Drag a line for a portal end; right-click removes a pair.
      if (e.button === 2) {
        const world = this.getWorld();
        world.removePortalAt(this.y * world.w + this.x);
      } else {
        this.shape = { kind: 'portal', x0: this.x, y0: this.y, erase: false };
      }
      this.hover();
      return;
    }
```

In `commitShape`, first line: `if (shape.kind === 'portal') { const r = this.getWorld().addPortal(shape.x0, shape.y0, this.x, this.y); if (this.onPortal) this.onPortal(r); return; }`.

In `act`, replace the first line with

```js
    const sel = this.state.selection;
    if (erasing) {
      // Right-dragging with the Time brush sets the area back to normal speed.
      if (sel.kind === 'tool' && sel.id === 'time') world.paintSpeed(area, 0);
      else world.eraseArea(area);
      return;
    }
```

(remove the later duplicate `const sel = ...`), and the cases:

```js
      case 'wall':
        world.wallMask = this.state.toolOptions.wallMask;
        world.paintArea(area, ID.WALL, 1);
        world.wallMask = 0;
        break;
      case 'time': world.paintSpeed(area, this.state.toolOptions.timeSpeed); break;
      case 'portal': break; // drawn as a line on release (commitShape)
```

`src/main.js`: import `loadToolOptions, saveToolOptions` and add to `game`:

```js
  toolOptions: loadToolOptions(),
  setToolOptions(change) {
    Object.assign(this.toolOptions, change);
    saveToolOptions(this.toolOptions);
    ui.renderToolOptions();
  },
```

In `brushOutline()`, a portal drag previews as a one-cell line: `if (shape) outline.from = { kind: shape.kind === 'portal' ? 'line' : shape.kind, x: shape.x0, y: shape.y0 };` and `if (sel.kind === 'tool' && sel.id === 'portal') outline.r = 0;`. Set `input.onPortal = (r) => { if (r === 'full') ui.flash('32 portal pairs is the most: remove one first'); };` (add a small `flash(text)` to ui.js that shows the text in `#hud-cell` for two seconds; it can set `this.flashUntil = performance.now() + 2000` and `renderHud` shows it while `performance.now() < this.flashUntil`).

Call `ui.renderToolOptions()` in `game.select` after `ui.renderInspect()`.

- [ ] **Step 5: Implement the UI**

`src/game/ui.js` `TOOL_INFO`:

```js
  portal: {
    name: 'Portal', color: '#5aa8ff',
    icon: '<path d="M6 3c-2 2-2 12 0 14M14 3c2 2 2 12 0 14M3 10h4M13 10h4M5.5 8L7 10l-1.5 2M15.5 8L17 10l-1.5 2"/>',
    desc: 'Drag a line for one end of a portal, then another for the other end. Anything crossing one end comes out of the other, still going, and air flows through. Right-click a portal to remove the pair.',
  },
  time: {
    name: 'Time', color: '#ffb347',
    icon: '<path d="M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM10 6.5V10l2.5 2"/>',
    desc: 'Paint an area that runs slower or faster than the rest of the world. Right-click to put an area back to normal speed. Clear removes every area.',
  },
```

and the Wall description: 'Indestructible and airtight. Tick boxes below to let things through the walls you paint next: a grate for water, a vent for gas, a window for light.'

`renderToolOptions()`:

```js
  // The options strip: the Wall checklist, or the Time brush's speeds.
  renderToolOptions() {
    const box = $('tool-options');
    const { selection: sel, toolOptions: o } = this.game;
    const id = sel.kind === 'tool' ? sel.id : null;
    if (id === 'wall') {
      box.innerHTML = `<div class="opt-head">Lets through</div><div class="opt-grid">${PASS_ORDER.map(([name, bit]) =>
        `<label class="opt-check"><input type="checkbox" data-pass="${bit}"${o.wallMask & bit ? ' checked' : ''}> ${name[0].toUpperCase()}${name.slice(1)}</label>`).join('')}</div>`;
    } else if (id === 'time') {
      box.innerHTML = `<div class="opt-head">Speed</div><div class="opt-speeds" role="radiogroup" aria-label="Speed">${['¼×', '½×', '2×', '4×'].map((s, k) =>
        `<button type="button" role="radio" data-speed="${k + 1}" aria-checked="${o.timeSpeed === k + 1}">${s}</button>`).join('')}</div>`;
    } else {
      box.innerHTML = '';
    }
    box.hidden = id !== 'wall' && id !== 'time';
  }
```

and in `buildTools()` one listener for both:

```js
    $('tool-options').addEventListener('change', (e) => {
      const bit = Number(e.target.dataset.pass);
      if (!bit) return;
      const m = this.game.toolOptions.wallMask;
      this.game.setToolOptions({ wallMask: e.target.checked ? m | bit : m & ~bit });
    });
    $('tool-options').addEventListener('click', (e) => {
      const b = e.target.closest('[data-speed]');
      if (b) this.game.setToolOptions({ timeSpeed: Number(b.dataset.speed) });
    });
```

`renderHud`: after the `name` is worked out, `const notes = cellNotes(world, i);` and append `${notes.length ? sep + esc(notes.join(' · ')) : ''}` after the bold name. Import `cellNotes` and `PASS_ORDER`.

`index.html`: after `<div class="tools" id="tools"></div>` add `<div class="tool-options" id="tool-options" hidden></div>`.

`style.css`: update the comment on `.tools` ("rows of three"), and add

```css
.tool-options { margin-top: 6px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; font-size: 12px; }
.tool-options .opt-head { color: var(--muted); margin-bottom: 4px; }
.opt-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px 8px; }
.opt-check { display: flex; align-items: center; gap: 4px; cursor: pointer; }
.opt-speeds { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.opt-speeds button { padding: 3px 0; border: 1px solid var(--line); border-radius: 4px; background: transparent; color: var(--text); cursor: pointer; }
.opt-speeds button[aria-checked='true'] { border-color: var(--brass); background: var(--brass-soft); color: var(--brass); }
```

(check these custom properties exist in `style.css`; use the names it already uses for tool buttons).

`test/hard-mode.test.js`: append an assertion that `HARD_BLOCKED` doesn't include `'portal'` or `'time'` (already covered in tools.test.js; skip if duplicate).

- [ ] **Step 6: Run tests, full suite, build, commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Portal and Time tools, the options strip, and inspect notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Drawing walls, time zones, portals

**Files:**
- Modify: `src/render/renderer.js` (`paint` → `paintOverlays`, exported helpers)
- Test: `test/render.test.js` (append)

**Interfaces:**
- Consumes: `World.wall`, `meshCount`, `speed`, `zoneCount`, `portals`, `portalAt`, `portalCells`, `portalHues`.
- Produces: `zoneTint(code) → { rgb: [r, g, b], strength }`, `portalRGB(slot, end) → [r, g, b]` (exported, pure); `Renderer.paintOverlays()`.

- [ ] **Step 1: Write the failing tests** (append to `test/render.test.js`)

```js
import { zoneTint, portalRGB } from '../src/render/renderer.js';

test('time zones are tinted blue when slow and orange when fast, more so further from normal', () => {
  const [q, h, d, f] = [1, 2, 3, 4].map(zoneTint);
  assert.ok(q.rgb[2] > q.rgb[0] && h.rgb[2] > h.rgb[0], 'slow is blue');
  assert.ok(d.rgb[0] > d.rgb[2] && f.rgb[0] > f.rgb[2], 'fast is orange');
  assert.ok(q.strength > h.strength && f.strength > d.strength);
});

test('portal ends have their own colours', () => {
  const seen = new Set();
  for (let s = 0; s < 8; s++) for (const e of [0, 1]) seen.add(portalRGB(s, e).join());
  assert.equal(seen.size, 16);
  const [r, , b] = portalRGB(0, 0);
  assert.ok(b > r, 'the first end of the first pair is blue');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `... --test test/render.test.js < /dev/null` — FAIL (no export `zoneTint`).

- [ ] **Step 3: Implement**

In `src/render/renderer.js` (imports: `portalHues` from `../sim/portals.js`, `PASS` from `../sim/walls.js`; the `hsl` helper already exists from the heat view):

```js
// How a time zone is tinted: blue for slow, orange for fast, stronger the
// further from normal speed.
const ZONE_TINT = [null,
  { rgb: [90, 160, 255], strength: 0.32 }, { rgb: [90, 160, 255], strength: 0.16 },
  { rgb: [255, 150, 60], strength: 0.16 }, { rgb: [255, 150, 60], strength: 0.32 }];
export const zoneTint = (code) => ZONE_TINT[code];

// The colour of end `end` (0 or 1) of portal pair `slot`.
export const portalRGB = (slot, end) => hsl(portalHues(slot)[end], 0.62);
const WALL_LIGHT = [124, 132, 148]; // the lighter cells of a wall's mesh
```

In `paint()`, call `this.paintOverlays();` after the cell loop and before `this.paintProjectiles(heatView);`. The method:

```js
  // Drawn over the cells: walls that let things through (a mesh), time
  // zones (a tint, and a crawling dashed border), portals.
  paintOverlays() {
    const { world, pixels, frame } = this;
    const { w, h } = world;
    const blend = (i, rgb, a) => {
      const c = pixels[i];
      const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
      pixels[i] = pack((r + (rgb[0] - r) * a) | 0, (g + (rgb[1] - g) * a) | 0, (b + (rgb[2] - b) * a) | 0);
    };
    if (world.meshCount !== 0) {
      const wall = world.wall;
      for (let y = 0; y < h; y++) {
        for (let x = (y & 1); x < w; x += 2) { // every other cell: a checkerboard
          const i = y * w + x;
          if ((wall[i] & 255) !== 0) blend(i, WALL_LIGHT, 0.55);
        }
      }
    }
    if (world.zoneCount !== 0) {
      const speed = world.speed;
      const crawl = frame >> 2;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x, s = speed[i];
          if (s === 0) continue;
          const tint = ZONE_TINT[s];
          const edge = (x > 0 && speed[i - 1] !== s) || (x < w - 1 && speed[i + 1] !== s)
            || (y > 0 && speed[i - w] !== s) || (y < h - 1 && speed[i + w] !== s);
          if (edge) {
            // A dashed border that crawls along: backwards when slow, forwards when fast.
            const on = (((x + y + (s <= 2 ? -crawl : crawl)) >> 1) & 1) === 0;
            blend(i, tint.rgb, on ? 0.95 : tint.strength * 1.6);
          } else {
            blend(i, tint.rgb, tint.strength);
          }
        }
      }
    }
    if (world.portalCells !== 0) {
      world.portals.forEach((p, slot) => {
        if (p === null) return;
        [p.a, p.b].forEach((e, end) => {
          if (e === null) return;
          const rgb = portalRGB(slot, end);
          const c = pack(rgb[0], rgb[1], rgb[2]);
          e.cells.forEach((i, pos) => {
            // A lone end is dashed until its partner is drawn.
            if (p.b === null && ((pos >> 1) & 1) === 1) return;
            pixels[i] = c;
          });
        });
      });
    }
  }
```

- [ ] **Step 4: Run tests and check in the browser**

Run the render tests and the suite. Then `preview_start` `sandbox-crafter`, temporarily add `window.__dbg = { world, renderer }; // TEMP` after the renderer in `src/main.js`, and check: a wall box with a liquids mesh and water seeping through, a ¼× and a 4× zone (tint and crawling border, empty and full), a portal pair (blue and orange, a lone dashed end), looped edges' dotted markers; the options strip for Wall and Time; the inspect line notes. Remove the TEMP line afterwards (check `grep -c __dbg src/main.js` is 0).

- [ ] **Step 5: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Draw wall meshes, time zones and portals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Docs, build, speed check

**Files:**
- Modify: `README.md`, `HANDOFF.md`, `dist/sandbox-crafter.html` (rebuilt)

- [ ] **Step 1: README**

Under the controls: the tools list gains Portal and Time; describe the options strip (Wall checklist with its eight boxes; Time's four speeds; right-click to reset; Clear removes zones); a **Portals** paragraph (drawing, two-way window, what goes through, right-click/erase/Clear, 32 pairs); the Edges control's three states; the tests section gains the four new test files' coverage; bump the test count ("About 1,4x0 tests" — count with the suite's `ℹ tests` line, rounded down to ten).

- [ ] **Step 2: HANDOFF**

Add bullets: `portalAt` packing and the crossing rule (`crossPortal` on update, `portalProjectile`, `stepPortalAir`, ends read to turn ≤ 90°); `speed`, `SLOW_EVERY`/`EXTRA_PASSES`, `fastPasses`, and that `clock` is a pass stamp (`World.pass`) while `tick` stays per frame; `cellAt` and that every edge-checking step must use it, the fast paths being off while anything loops, `Air.wrapRing`/`syncSeams`/`loopRing`; the wall layer (`walls.js`, `setWall`, `keepWall` in `swap`, `clearCell` restoring WALL, `canEnter` by `PASS_BIT`); update the test count.

- [ ] **Step 3: Build, full suite, bench**

```bash
ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" scripts/build.js < /dev/null
ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" --test test/*.test.js < /dev/null
```

Expected: build reports 30+ modules; all tests pass; the demo bench within noise of before (about 3 ms/step without convection, 3.3 with).

- [ ] **Step 4: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Docs and build for portals, time zones, looping edges and wall checklist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
