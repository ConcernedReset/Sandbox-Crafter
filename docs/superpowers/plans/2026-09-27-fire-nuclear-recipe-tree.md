# Fire, Nuclear Stability and Recipe Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flames use up air and go out in a vacuum; Radioactive-category elements stay quiet until pressure or particles disturb them; the Recipe book tab becomes a draggable recipe tree viewport under the game.

**Architecture:** The fire and nuclear changes are small edits to the existing simulation (`behaviors.js`, `world.js`, `particles.js`, `elements.js`) plus test updates. The tree is two new modules: `src/game/tree.js` (pure layout, tested in Node) and `src/render/tree-view.js` (canvas drawing and pointer handling), wired in by `main.js`, `ui.js`, `index.html` and `style.css`.

**Tech Stack:** Plain ES modules, Canvas 2D, `node:test`. No dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-09-27-fire-nuclear-recipe-tree-design.md`

## Global Constraints

- No new dependencies and no build step; everything stays plain ES modules.
- Node is not installed on this machine. Run tests with VS Code's runtime:
  `$env:ELECTRON_RUN_AS_NODE=1; & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" --test test/<file>.test.js`
  (`npm test` wherever Node exists).
- The folder is not a git repository: skip commit steps.
- Match the existing code style: two-space indent, single quotes, short plain-English comments, British spellings in player-facing text ("colour", "oxidiser").
- Every recipe must keep passing `test/recipes.test.js`, and every element must stay reachable from the starting four.
- Balance numbers are tuned by tests; the values below are starting points.

---

### Task 1: Flames use up air

**Files:**
- Modify: `src/sim/behaviors.js` (`burnOut`, new `snuff`, constants)
- Modify: `src/sim/world.js` (`ignite` returns a boolean and refuses in thin air; `update` uses the return value)
- Modify: `test/physics.test.js` (two new tests)
- Modify: `test/recipes.test.js` (burn lab gets an opening)

**Interfaces:**
- Produces: `export const FIRE_DRAW`, `export const SNUFF_AT` from `behaviors.js`; `World.ignite(i, x, y) -> boolean` (true if the cell changed).

- [ ] **Step 1: Write the failing tests** (append to `test/physics.test.js`, and import `SNUFF_AT` from `../src/sim/behaviors.js`)

```js
test('a fire in a sealed box uses up the air and goes out, leaving most of the fuel', () => {
  const w = makeWorld(60, 50);
  const box = wallBox(w, 10, 10, 49, 49);
  fillRect(w, box.x0, 40, box.x1, box.y1, ID.WOOD);
  const wood = countOf(w, ID.WOOD);
  fillRect(w, box.x0, 38, box.x1, 39, ID.FIRE);
  let lowest = 0;
  run(w, 1500, () => { lowest = Math.min(lowest, w.pressureAt(30, 30)); });
  assert.ok(lowest < SNUFF_AT, `the air inside was used up (lowest ${lowest.toFixed(1)})`);
  assert.equal(countOf(w, ID.FIRE), 0, 'the fire went out');
  assert.ok(countOf(w, ID.WOOD) > wood * 0.5, `${countOf(w, ID.WOOD)} of ${wood} wood left`);
});

test('nothing catches fire in thin air, and hot fuel lights once air gets back in', () => {
  const w = makeWorld(60, 40);
  const box = wallBox(w, 10, 10, 49, 39);
  fillRect(w, box.x0, 30, box.x1, box.y1, ID.WOOD);
  const keepHot = () => { for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.WOOD) w.temp[i] = 600; };
  const thin = () => {
    for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) w.air.p[w.air.at(x, y)] = SNUFF_AT - 5;
  };
  run(w, 200, () => { thin(); keepHot(); });
  assert.equal(countOf(w, ID.FIRE), 0, 'hot wood did not light without air');
  for (let x = 10; x <= 49; x++) w.clearCell(10 * w.w + x); // take the lid off
  let lit = false;
  run(w, 400, () => { keepHot(); if (countOf(w, ID.FIRE) > 0) lit = true; });
  assert.ok(lit, 'the wood caught once air came back');
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `...Code.exe --test test/physics.test.js`
Expected: both new tests FAIL (the sealed fire burns on; the wood lights in thin air). `SNUFF_AT` import fails first until Step 3.

- [ ] **Step 3: Implement.** In `src/sim/behaviors.js`, next to `LOOSE_FLAME`:

```js
// Flames use up the air around them, so a fire pulls air in. Where the
// pressure has fallen below SNUFF_AT (a sealed room that has burned its air
// away), flames go out and nothing new catches.
export const FIRE_DRAW = 0.04;
export const SNUFF_AT = -3;
const SNUFF_RATE = 0.15; // chance per frame per unit of pressure below SNUFF_AT

// Fuels that burn in place as embers rather than being used up as a flame.
function burnsInPlace(f) {
  return f.state === SOLID || f.sticky || (f.state === POWDER && f.explode === 0);
}
```

In `burnOut`, right after `const fuel = c & ~LOOSE_FLAME;` (`smoky` is true only for Fire; plasma is not a flame):

```js
    if (smoky) {
      const a = this.air.at(x, y);
      this.air.addPressure(a, -FIRE_DRAW);
      const p = this.air.p[a];
      if (p < SNUFF_AT && this.rand() < (SNUFF_AT - p) * SNUFF_RATE) {
        this.snuff(i, fuel, c & LOOSE_FLAME);
        return true;
      }
    }
```

and change the ember check further down to `if (burnsInPlace(f)) {`. Add after `burnOut`:

```js
  // Put a flame out. An ember turns back into its fuel, still hot, and
  // catches again once there's air.
  snuff(i, fuel, loose) {
    if (fuel && !loose && burnsInPlace(DEFS[fuel])) this.convert(i, fuel, true, -1);
    else this.clearCell(i);
  },
```

In `src/sim/world.js`, import `SNUFF_AT` alongside `Behaviors`, and change `ignite`:

```js
  // Set cell i alight. Returns true if the cell changed. Fire needs air:
  // explosives carry their own, and fuels that burn into something other
  // than flame (thermite) don't need it.
  ignite(i, x, y) {
    const t = this.type[i];
    const d = DEFS[t];
    const b = d.burn;
    if (!b) return false;
    if (b.launch) { // fireworks take off instead of burning
      if (this.ctype[i] !== 1) {
        this.ctype[i] = 1;
        this.life[i] = 25 + ((this.rand() * 25) | 0);
      }
      return true;
    }
    if (!d.explode && b.to === FIRE && this.air.p[this.air.at(x, y)] < SNUFF_AT) return false;
    // ...rest unchanged, each path ending in `return true;`
  }
```

In `update`, so hot fuel in thin air still falls and flows:

```js
    if (d.burn !== null && T >= d.ignite && this.rand() < d.igniteChance && this.ignite(i, x, y)) return;
```

- [ ] **Step 4: Open the burn lab** in `test/recipes.test.js` (`case 'burn'`), so air reaches the flames: gases rise, so open the floor under gas fuel and the lid over everything else.

```js
    case 'burn': {
      // Fuel in one half, fresh flames lit in the empty half next to it. Flames
      // need air, so the box is open on the side away from the fuel.
      fill(home(a), a);
      const edge = isGas(a) ? box.y1 + 1 : box.y0 - 1;
      for (let x = box.x0; x <= box.x1; x++) w.clearCell(edge * w.w + x);
      hooks.push((f) => {
        if (f % 15 === 0) w.paint(midX, isGas(a) ? midY + 2 : midY - 1, 3, ID.FIRE);
      });
      break;
    }
```

- [ ] **Step 5: Run the full suite and tune.** Run: `...Code.exe --test test/*.test.js`. Expected: all pass. If the open-air wood test (`fire burns wood away...`) fails, lower `FIRE_DRAW`; if the sealed test keeps burning, raise it or `SNUFF_RATE`.

### Task 2: Nuclear elements stay quiet until disturbed

**Files:**
- Modify: `src/sim/constants.js` (activity constants)
- Modify: `src/sim/elements.js` (`stable` flag, `'decay'` rule kind and label)
- Modify: `src/sim/world.js` (`radiate` scales by activity; new `activity`, `decayCell`)
- Modify: `src/sim/particles.js` (`kick` in `hitCell`)
- Modify: `src/sim/elements-expansion.js`, `src/sim/elements-periodic.js` (hints, a few descriptions)
- Modify: `test/radiation.test.js`, `test/mechanics.test.js`, `test/recipes.test.js`

**Interfaces:**
- Produces: `DEFS[i].stable` (boolean); rule kind `'decay'` with label `"X + Decay"`; `World.activity(x, y, d) -> number`; `World.decayCell(i, x, y, outcome)`; `World.kick(j, x, y, def)`.

- [ ] **Step 1: Write the failing tests** (append to `test/radiation.test.js`)

```js
// A bed of polonium in a sealed box. `each` runs every frame.
function polonium(frames, each) {
  const w = makeWorld(40, 40);
  const box = wallBox(w, 0, 0, 39, 39);
  fillRect(w, box.x0, 26, box.x1, box.y1, ID.POLONIUM);
  const before = types(w, ID.POLONIUM);
  run(w, frames, (f) => each?.(w, f));
  return before - types(w, ID.POLONIUM);
}

test('radioactive elements sit almost perfectly still when left alone', () => {
  assert.ok(polonium(1200) <= 6, 'hardly any polonium decayed');
});

test('pressure wakes a radioactive pile up', () => {
  const decayed = polonium(600, (w) => w.pressurize(20, 12, 8, 2));
  assert.ok(decayed > 50, `${decayed} decayed under pressure`);
});

test('a burst of neutrons sets radioactive atoms off', () => {
  const decayed = polonium(300, (w, f) => {
    if (f < 60) for (let k = 0; k < 4; k++) w.spawnProjectile(ID.NEUTRON, 2.5 + k * 9, 20.5, 0.3, 2);
  });
  assert.ok(decayed > 10, `${decayed} decayed after the neutrons went through`);
});
```

- [ ] **Step 2: Run them and watch them fail.** Expected: the "left alone" test FAILS (today polonium decays about 350 times in 1200 frames).

- [ ] **Step 3: Constants** (`src/sim/constants.js`):

```js
// Radioactive elements (the Radioactive category) are stable until something
// disturbs them. At rest they run at REST times their listed rates; pressure
// past PRESSURE_WAKE raises that by 1 for every PRESSURE_FULL, up to
// MAX_ACTIVITY. A hard particle passing through has KICK_CHANCE of kicking a
// cell: it throws off particles and warms as if KICK_EMIT frames had passed,
// and decays as if KICK_DECAY had.
export const REST = 0.005;
export const PRESSURE_WAKE = 3;
export const PRESSURE_FULL = 20;
export const MAX_ACTIVITY = 4;
export const KICK_CHANCE = 0.3;
export const KICK_EMIT = 50;
export const KICK_DECAY = 300;
```

- [ ] **Step 4: Compiler** (`src/sim/elements.js`): in `normalize`, add `stable: e.cat === 'nuclear',` after `wet`. Compile decay with its own kind for these elements:

```js
  if (e.decay) d.decay = compileOutcome(e.decay, [i], d.stable ? 'decay' : 'time');
```

and add to `KIND_LABEL`: `decay: (a) => \`${a} + Decay\`,`

- [ ] **Step 5: Activity and decay** (`src/sim/world.js`): import the constants; in `radiate` scale selfHeat, emission and decay:

```js
  radiate(i, x, y, d) {
    // A radioactive element barely stirs until something disturbs it.
    const a = d.stable ? this.activity(x, y, d) : 1;
    if (d.selfHeat !== 0) this.temp[i] = Math.min(MAX_TEMP, this.temp[i] + d.selfHeat * a);
    if (d.emits !== null) {
      for (const m of d.emits) if (this.rand() < m.chance * a) this.emitAt(m.id, x, y);
    }
    // hotEmit and hotSpark unchanged
    if (d.decay !== null && this.rand() < d.decay.chance * a) {
      this.decayCell(i, x, y, d.decay);
      return true;
    }
    // produce unchanged
  }

  // How stirred up a stable radioactive element is by the pressure on it
  // (squeezing or suction).
  activity(x, y, d) {
    const p = this.pressureOn(x, y, d, true);
    const a = REST + (p > PRESSURE_WAKE ? (p - PRESSURE_WAKE) / PRESSURE_FULL : 0);
    return a < MAX_ACTIVITY ? a : MAX_ACTIVITY;
  }

  // An atom decays: it may shed something beside it, then becomes what it decays into.
  decayCell(i, x, y, o) {
    if (o.spawn >= 0 && this.spawnNear(x, y, o.spawn) >= 0) this.record(o.spawn, o.spawnRule);
    if (o.alt >= 0 && this.rand() < o.altChance) this.convert(i, o.alt, true, o.altRule);
    else this.convert(i, o.to, true, o.rule);
  }
```

- [ ] **Step 6: Kicks** (`src/sim/particles.js`): import `KICK_CHANCE, KICK_EMIT, KICK_DECAY`; build a lookup of hard particles; in `hitCell`, after the `HIT` block:

```js
// Particles that disturb a stable radioactive atom they pass.
const HARD = new Uint8Array(32);
for (const m of ['neutron', 'proton', 'electron', 'positron', 'alpha', 'ion', 'gamma']) HARD[PMODE[m]] = 1;
```

```js
    // Hard radiation stirs up a stable radioactive atom on its way past.
    if (e.stable && e.active && HARD[d.pmode] && this.rand() < KICK_CHANCE) this.kick(j, ix, iy, e);
```

```js
  // A particle disturbs a stable radioactive atom: it may throw off particles
  // of its own, warm up, or decay.
  kick(j, x, y, e) {
    if (e.emits !== null) for (const m of e.emits) if (this.rand() < m.chance * KICK_EMIT) this.emitAt(m.id, x, y);
    if (e.selfHeat) this.temp[j] = Math.min(MAX_TEMP, this.temp[j] + e.selfHeat * KICK_EMIT);
    const o = e.decay;
    if (o !== null && this.rand() < Math.min(0.9, o.chance * KICK_DECAY)) this.decayCell(j, x, y, o);
  },
```

- [ ] **Step 7: Hints and descriptions.** In `elements-expansion.js` and `elements-periodic.js`, replace every hint `Wait for <Name> to decay` (a capitalised element name, not "a Neutron"/"a Pion") with `Squeeze or bombard <Name> until it decays`. Reword: Corium `desc: 'Molten reactor fuel. Burns through almost anything, and runs hot while neutrons keep hitting it.'`; Californium `desc: 'Sprays neutrons at the slightest disturbance. A speck of it kick-starts reactors and sniffs out gold and oil underground.'`; Uranium's `Pile enough together and it runs hot.` → `A neutron in a big enough pile starts a chain reaction.`

- [ ] **Step 8: Update the tests that relied on spontaneous activity.**
  - `test/recipes.test.js`: add a `'decay'` lab: `case 'decay': fill(home(a), a); hooks.push(() => w.pressurize(midX, midY, 30, 2)); break;`
  - `test/radiation.test.js` `reactor()`: seed neutrons into the pile for the first 60 frames: `run(w, 900, (f) => { if (f < 60 && f % 3 === 0) for (let k = 0; k < 4; k++) w.spawnProjectile(ID.NEUTRON, 190 + w.rand() * 24, 220 + w.rand() * 20); });`
  - plutonium test: a big ball left alone stays whole; the same ball hit by a few neutrons explodes; a pinch hit by the same neutrons doesn't.
  - radium chain test: pump pressure into the box every frame.
  - `test/mechanics.test.js` oganesson test: put the sample in a wall box and pump pressure.

- [ ] **Step 9: Run the full suite and tune** `KICK_*`/`REST` until green; runaway particle counts mean `KICK_EMIT` is too high.

### Task 3: Recipe tree layout (`src/game/tree.js`)

**Files:**
- Create: `src/game/tree.js`
- Create: `test/tree.test.js`

**Interfaces:**
- Produces: `NODE_W`, `NODE_H`, `JOIN`, `COL_W`, `ROW_H`; `processName(rule) -> string`; `buildTree({ known(id) -> bool, revealed?(id) -> bool }) -> { nodes: [{ id, known, col, row, x, y }], links: [{ output, inputs, rule, label }], columns }`.

- [ ] **Step 1: Write the failing tests** (`test/tree.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFS, ID, RULES, COLLECTIBLE, STARTERS } from '../src/sim/elements.js';
import { buildTree, processName, NODE_H, ROW_H } from '../src/game/tree.js';

const starters = new Set(STARTERS.map((k) => ID[k]));
const fresh = () => buildTree({ known: (id) => starters.has(id) });
const everything = () => buildTree({ known: () => true });
const linkTo = (t, id) => t.links.filter((l) => l.output === id);

test('a new game shows the starting four and a ? for each thing they can make', () => {
  const t = fresh();
  assert.deepEqual(t.nodes.filter((n) => n.known).map((n) => n.id).sort(), [...starters].sort());
  const unknown = t.nodes.filter((n) => !n.known);
  assert.ok(unknown.length > 0, 'something to try');
  for (const n of unknown) {
    const [l] = linkTo(t, n.id);
    assert.ok(l.inputs.every((i) => starters.has(i)), `${DEFS[n.id].name} is made only from starters`);
    assert.equal(l.label, '?');
  }
  assert.ok(unknown.some((n) => n.id === ID.MUD), 'Dirt + Water is one of them');
});

test('every element but the roots has exactly one connection in, from earlier columns', () => {
  for (const t of [fresh(), everything()]) {
    const col = new Map(t.nodes.map((n) => [n.id, n.col]));
    for (const n of t.nodes) {
      const ins = linkTo(t, n.id);
      if (n.col === 0) { assert.equal(ins.length, 0, DEFS[n.id].name); continue; }
      assert.equal(ins.length, 1, DEFS[n.id].name);
      for (const i of ins[0].inputs) assert.ok(col.get(i) < n.col, `${DEFS[i].name} before ${DEFS[n.id].name}`);
    }
  }
});

test('no two elements overlap', () => {
  const t = everything();
  const byCol = new Map();
  for (const n of t.nodes) (byCol.get(n.col) ?? byCol.set(n.col, []).get(n.col)).push(n.y);
  for (const ys of byCol.values()) {
    ys.sort((a, b) => a - b);
    for (let k = 1; k < ys.length; k++) assert.ok(ys[k] - ys[k - 1] >= Math.min(ROW_H, NODE_H + 8));
  }
});

test('free play shows every element, none hidden', () => {
  const t = everything();
  assert.equal(t.nodes.length, COLLECTIBLE.length);
  assert.ok(t.nodes.every((n) => n.known));
  assert.ok(t.links.every((l) => l.label !== '?'));
  assert.equal(t.nodes.find((n) => n.id === ID.STEAM).col, 1, 'Steam is one step from Water');
});

test('revealing a recipe shows its process under the ?', () => {
  const target = fresh().nodes.find((n) => !n.known).id;
  const t = buildTree({ known: (id) => starters.has(id), revealed: (id) => id === target });
  const [l] = linkTo(t, target);
  assert.equal(l.label, processName(RULES[l.rule]));
  assert.notEqual(l.label, '?');
});

test('each kind of recipe has a process name', () => {
  const name = (kind, keys) => processName({ kind, inputs: keys.map((k) => ID[k]), output: 0 });
  assert.equal(name('heat', ['SAND']), 'Heat');
  assert.equal(name('cool', ['WATER']), 'Cool');
  assert.equal(name('pressure', ['WOOD']), 'Pressure');
  assert.equal(name('burn', ['WOOD']), 'Burn');
  assert.equal(name('time', ['PLANT']), 'Time');
  assert.equal(name('decay', ['RADIUM']), 'Decay');
  assert.equal(name('contact', ['DIRT', 'WATER']), 'Mix');
  assert.equal(name('contact', ['URANIUM', 'NEUTRON']), 'Bombard');
  assert.equal(name('contact', ['ELECTRON', 'POSITRON']), 'Collide');
});
```

- [ ] **Step 2: Run and watch them fail** (module not found).

- [ ] **Step 3: Implement `src/game/tree.js`**

```js
// The recipe tree: which elements it shows, the recipe that links each one
// to its ingredients, and where everything sits. Plain data with no DOM, so
// it can be tested in Node; src/render/tree-view.js draws it.
//
// Columns are generations: the starting elements are column 0 and each
// element sits one column right of its latest ingredient. Each element is
// shown with its shortest recipe (the one reaching furthest back towards the
// starters), so it has exactly one connection in. An undiscovered element
// appears once every ingredient of one of its recipes has been found, as a
// '?' with '?' for the process.

import { DEFS, RULES, COLLECTIBLE, CATEGORIES } from '../sim/elements.js';

export const NODE_W = 136; // node size, in tree units (pixels at zoom 1)
export const NODE_H = 40;
export const JOIN = 64; // how far left of a product its ingredient lines meet
export const COL_W = NODE_W + JOIN + 40;
export const ROW_H = 58;
const SWEEPS = 5; // alternating passes to untangle the lines, ending left to right

const MAKES = DEFS.map(() => []); // rule indices by the element they make
RULES.forEach((r, k) => MAKES[r.output].push(k));

const CAT_ORDER = Object.fromEntries(CATEGORIES.map((c, k) => [c.key, k]));
const tableOrder = (a, b) => CAT_ORDER[DEFS[a.id].cat] - CAT_ORDER[DEFS[b.id].cat] || DEFS[a.id].number - DEFS[b.id].number;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

const PROCESS = { heat: 'Heat', cool: 'Cool', pressure: 'Pressure', burn: 'Burn', time: 'Time', decay: 'Decay' };

// The word written under a connection.
export function processName(rule) {
  if (rule.kind !== 'contact') return PROCESS[rule.kind];
  const particles = rule.inputs.filter((i) => DEFS[i].projectile).length;
  return particles === 2 ? 'Collide' : particles === 1 ? 'Bombard' : 'Mix';
}

// The recipe for `id` whose ingredients all have a column, choosing the one
// whose latest ingredient comes earliest. Returns { rule, col } or null.
function shortest(id, col) {
  let best = null;
  for (const k of MAKES[id]) {
    let c = 0;
    for (const i of RULES[k].inputs) {
      const ci = col.get(i);
      if (ci === undefined) { c = -1; break; }
      if (ci > c) c = ci;
    }
    if (c >= 0 && (best === null || c + 1 < best.col)) best = { rule: k, col: c + 1 };
  }
  return best;
}

// known(id): discovered (everything, in free play).
// revealed(id): the player asked to see this undiscovered element's recipe.
export function buildTree({ known, revealed = () => false }) {
  const found = COLLECTIBLE.filter((d) => known(d.id)).map((d) => d.id);
  const col = new Map();
  const via = new Map();
  for (const id of found) if (DEFS[id].start) col.set(id, 0);
  // Each pass can only move an element to an earlier column, so this settles.
  for (let changed = true; changed;) {
    changed = false;
    for (const id of found) {
      if (DEFS[id].start) continue;
      const b = shortest(id, col);
      if (b !== null && !(col.get(id) <= b.col)) {
        col.set(id, b.col);
        via.set(id, b.rule);
        changed = true;
      }
    }
  }
  // Found without a known recipe (painted in free play, say): a root.
  for (const id of found) if (!col.has(id)) col.set(id, 0);
  // The next step: undiscovered elements with every ingredient found.
  const next = [];
  for (const d of COLLECTIBLE) {
    if (col.has(d.id)) continue;
    const b = shortest(d.id, col);
    if (b !== null) next.push([d.id, b]);
  }
  for (const [id, b] of next) { col.set(id, b.col); via.set(id, b.rule); }

  const nodes = [];
  const columns = [];
  for (const [id, c] of col) {
    const node = { id, known: known(id), col: c, row: 0, x: c * COL_W, y: 0 };
    nodes.push(node);
    (columns[c] ??= []).push(node);
  }
  for (let c = 0; c < columns.length; c++) columns[c] ??= [];
  const at = new Map(nodes.map((n) => [n.id, n]));
  const links = [];
  const inputsOf = new Map();
  const outputsOf = new Map();
  for (const [id, k] of via) {
    const rule = RULES[k];
    links.push({ output: id, inputs: rule.inputs, rule: k, label: at.get(id).known || revealed(id) ? processName(rule) : '?' });
    inputsOf.set(id, rule.inputs);
    for (const i of rule.inputs) (outputsOf.get(i) ?? outputsOf.set(i, []).get(i)).push(id);
  }

  // Rows: table order to start with, then sweeps that sort each column by
  // where its ingredients sit (going right) or its products sit (going left).
  const place = (list) => list.forEach((n, r) => { n.row = r; n.y = (r - (list.length - 1) / 2) * ROW_H; });
  for (const list of columns) { list.sort(tableOrder); place(list); }
  for (let s = 0; s < SWEEPS; s++) {
    const right = s % 2 === 0;
    for (let k = 1; k < columns.length; k++) {
      const list = columns[right ? k : columns.length - 1 - k];
      const key = new Map();
      for (const n of list) {
        const ids = (right ? inputsOf : outputsOf).get(n.id);
        key.set(n, ids?.length ? mean(ids.map((i) => at.get(i).y)) : n.y);
      }
      list.sort((a, b) => key.get(a) - key.get(b));
      place(list);
    }
  }
  return { nodes, links, columns: columns.length };
}
```

- [ ] **Step 4: Run `test/tree.test.js`**; expected PASS.

### Task 4: Tree viewport (drawing, input, page wiring)

**Files:**
- Create: `src/render/tree-view.js`
- Modify: `index.html` (tree section; tabs and recipe panel removed)
- Modify: `style.css` (tree styles; sticky panel; drop the fit-to-window block; drop recipe book and tab styles)
- Modify: `src/game/ui.js` (recipe book → tree card and count)
- Modify: `src/main.js` (create, refresh, draw the tree; route picks)

**Interfaces:**
- Consumes: `buildTree`, `NODE_W`, `NODE_H`, `JOIN` from Task 3.
- Produces: `new TreeView(canvas)` with `setTree(tree, flashIds)`, `resize()`, `draw(now)`, `select(id|null)`, `zoomBy(dir)`, `fit()`, `home()`, `onPick(node|null)`; `UI.showCard(id)`, `UI.hideCard()`, `UI.onReveal(id)`, `UI.renderTreeCount()`.

- [ ] **Step 1: `src/render/tree-view.js`** (full file: colours read from the CSS custom properties; view transform `{ zoom, x, y }` where `(x, y)` is the tree point at the top-left; `draw` returns at once unless something changed; links are Bezier curves from each input's right edge to a join point `JOIN` left of the product, then a straight arrow into it, with the label under that last stretch; unknown links dashed; hover/picked links in brass; nodes are rounded boxes with a category stripe, symbol and name, or a dashed `?`; text is skipped below zoom 0.35; new discoveries flash with an expanding brass ring; drag pans with a 5 px click slop; Ctrl/Cmd-wheel and two-finger pinch zoom at the pointer, 0.1× to 2×; panning is clamped so part of the tree stays in view). See the file for the code.

- [ ] **Step 2: `index.html`**: replace the `<div class="tabs">…</div>`, the `role="tabpanel"` attributes on `#panel-elements`, and the whole `#panel-recipes` block; add after `.hud`:

```html
      <section class="tree" aria-labelledby="tree-title">
        <canvas id="tree" aria-label="Recipe tree. Drag to move it, Ctrl-scroll or pinch to zoom, click an element for its recipes."></canvas>
        <div class="tree-head">
          <h2 class="tree-title" id="tree-title">Recipe tree</h2>
          <span class="badge" id="tree-count" hidden></span>
        </div>
        <p class="tree-help">Drag to move · Ctrl-scroll to zoom · click an element</p>
        <div class="tree-card" id="tree-card" hidden aria-live="polite"></div>
        <div class="zoom" role="group" aria-label="Recipe tree zoom">
          <button type="button" id="tree-zoom-out" title="Zoom out"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 7h10v2H3z"/></svg><span class="sr-only">Zoom out</span></button>
          <button type="button" id="tree-fit" title="Fit the whole tree">Fit</button>
          <button type="button" id="tree-zoom-in" title="Zoom in"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3h2v4h4v2H9v4H7V9H3V7h4z"/></svg><span class="sr-only">Zoom in</span></button>
        </div>
      </section>
```

- [ ] **Step 3: `style.css`**: `.tree` (same width rules as `.screen`, `aspect-ratio: 5 / 3`, chamber background, border, radius, `position: relative; overflow: hidden`), `.tree canvas` (`touch-action: none; cursor: grab`, `.dragging` grabbing, `.over-node` pointer), `.tree-head`, `.tree-help`, `.tree-card` (+ `.reveal`, `.recipe-text`, list styles) overlays; move `.zoom` sizing to also apply inside `.tree`; delete `.tabs`, `.book*`, `.hint-card*`, `.recipe-row*`, `.locked-note`; delete the `@media (min-width: 981px)` block so the panel stays sticky while the page scrolls; add `.tree` to the small-screen `max-width: none` rule.

- [ ] **Step 4: `src/game/ui.js`**: delete `renderRecipes` and the tab code in `bindTabs`; add `renderTreeCount()` (the `available()` count as "N to try"), `showCard(id)` (known: symbol, name, number, every recipe whose inputs are known, description; starters say so; unknown: `?`, hint, then the known recipes if revealed or a "Show the recipe" button), `hideCard()`, and a click handler on `#tree-card` for `[data-reveal]` (calls `progress.reveal`, then `this.onReveal?.(id)`) and `[data-close]`. `refresh()` calls `renderTreeCount()` and re-renders an open card.

- [ ] **Step 5: `src/main.js`**: create `TreeView`, `refreshTree(flash)` builds from `progress` (`known: freePlay || has`, `revealed: progress.revealed`), call it at start, after discoveries (flashing the new ids), after Free play, reset and reveal; `onPick` selects the node, selects the element for painting if usable, and shows or hides the card; zoom buttons; `ResizeObserver` → `resize()`; `treeView.draw(now)` in the frame loop.

- [ ] **Step 6: Run the whole suite** (expected: all pass) **and check in the browser**: start the server, open the page, check the tree renders under the game, drag pans, Ctrl-scroll zooms, clicking a `?` shows the hint and reveal works, clicking a known node selects it, Free play shows all 558, no console errors.

### Task 5: Docs

**Files:**
- Modify: `README.md`, `HANDOFF.md` (repo copy, if present, otherwise the one the user gave), `scripts/recipe-table.js` output

- [ ] **Step 1:** README: How to play (recipe tree bullet), methods table (add Decay; Fire row notes air), physics (flames use up air; radioactivity is stable until disturbed), nuclear section (neutrons start reactions; bigger piles), project layout (tree files), adding an element (hint → recipe tree), tests paragraph.
- [ ] **Step 2:** Regenerate the recipe table: `...Code.exe scripts/recipe-table.js` and paste it over the table at the end of README.
- [ ] **Step 3:** HANDOFF: new files in the layout table and the note that they must be added to the artifact's published file list.
- [ ] **Step 4:** Final full test run; expected all pass.
