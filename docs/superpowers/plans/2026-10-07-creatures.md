# Shaped Creatures and Humans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the bigger creatures multi-pixel animated bodies that grow, get hurt pixel by pixel and heal, and add a Human that gathers fuel, lights a campfire, builds a hut, shelters and flees danger.

**Architecture:** A shape compiler (`src/sim/shapes.js`) turns small ASCII frames into pixel offsets. A `Creatures` World mixin (`src/sim/creatures.js`) keeps each shaped creature as an entity whose body is stamped into the grid as real cells (`ctype` = entity id, `shade` = palette slot); after the particle pass, `stepCreatures` checks each body (lost cells are damage), grows, heals, falls and moves it. A `Humans` mixin (`src/sim/humans.js`) adds the human brain: a decision every 8 steps, camps shared in `world.camps`, a fuel pile, a hut blueprint.

**Tech Stack:** Plain ES modules, `node:test`, Node via VS Code's Electron.

**Spec:** `docs/superpowers/specs/2026-10-07-creatures-design.md`

## Global Constraints

- Run tests with `ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" --test test/<file>.test.js < /dev/null` (always redirect stdin). Written below as `NODE --test ...`.
- No new dependencies; match the surrounding comment density and naming.
- Shaped: Fish 4×2, Electric Eel 6×2, Squid 3×4, Jellyfish 3×3, Bird 3×2, Frog 3×2, Snail 3×2, Spider 3×2, Phoenix 5×3, Human 3×6 (10 pixels). Every frame of a shape has the same pixel count. The other creatures stay single cells with `updateCritter` unchanged.
- Every creature's `life` range is tripled. Humans: 72,000 steps.
- Birth: one ring every GROW_EVERY = 2 steps; a seed or blocked ring waits GROW_GIVE_UP = 120.
- Damage: a pixel is damaged when its cell is no longer the creature's, or its temperature is above HOT_HURT = 60 °C or below COLD_HURT = −15 °C (not for `tough`). Death when damaged pixels × 2 ≥ pixels, or old age. Heal one pixel per HEAL_AFTER = 150 steps without damage. Suffocation: one pixel per SUFFOCATE_EVERY = 30 steps. Burned to death (most damage from heat) leaves Ash; otherwise `lifeEnd`.
- Additions made while planning (tell the user): a creature can't be hurt by heat for NEWBORN_GRACE = 60 steps after birth, and humans hold their body at 37 °C (20 % of the way each step), so one born from lightning-struck clay, or sitting near a fire, isn't cooked at once. The Electric Eel is 6×2, not 6×1, so it can wiggle.
- Humans: decide every THINK_EVERY = 8 steps; walk 1 cell per 4 steps, run 1 per 2; climb 2; give up a target after GIVE_UP = 300 steps without progress, banned 1,800 steps; flee danger within 16 cells until none within 24; danger = Lava, Acid, Napalm, Greek Fire, Grey Goo, Virus, Antimatter, Black Hole, any non-gas cell above 80 °C (own campfire excepted), air pressure above 4; breath 600 steps; join a camp within 60; fuel Wood/Coal/Peat/Sawdust within 60 of camp; pile lit at 6, topped up below 4; rub sticks 180 steps; hut: 9 wide, walls 8 tall, door gap 6 tall facing the fire, at least 4 cells from the pile, ground within 1 of flat, Stone/Brick/Granite/Concrete within 80 (Wood only if none); shelter when hut is done and air below 10 °C or rain/snow/hail falls within 20 cells.
- Content rule (HANDOFF): recipes lean on real chemistry, but keep explosives, weapons and drugs purely in-game. No real-world synthesis or fire-starting instructions in code, hints or docs.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; stage with `git add -A -- . ':!.claude'`. Don't push.

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `src/sim/shapes.js` (new) | `compileShape`: frames → pixel offsets, palette slots, growth order |
| `src/sim/creatures.js` (new) | `Creatures` mixin, `initCreatures`, `SHAPED`: entities, birth, bodies, damage, death, healing, falling, animals, integrations |
| `src/sim/humans.js` (new) | `Humans` mixin: brain, moving, swimming, fleeing, camps, campfire, hut, shelter |
| `src/sim/elements.js` | Compile `shape`, `body` behaviour, new critter fields |
| `src/sim/elements-world.js` | Lifespans ×3, shapes, Human, Clay + Lightning |
| `src/sim/world.js`, `behaviors.js` | Hooks: `stepCreatures`, `body` behaviour, `paintArea`, `blast`, `clearAll`, `initLife` |
| `src/sim/machines-motion.js`, `machines.js`, `portals.js`, `lookups.js` | Conveyors, pistons, doors, portals, dispensers treat shaped bodies whole |
| `src/render/renderer.js` | Shape palettes; carried item pixel |
| `src/game/cell-notes.js` | Health and job in the inspect line |
| `test/creatures.test.js`, `test/humans.test.js` (new), `test/helpers.js`, `test/recipes.test.js`, `test/mechanics.test.js` | Tests |
| `README.md`, `HANDOFF.md`, `dist/` | Docs and build |

---

### Task 1: Shapes, the body behaviour and longer lives

**Files:**
- Create: `src/sim/shapes.js`
- Modify: `src/sim/elements.js` (normalize, critter compile)
- Modify: `src/sim/elements-world.js` (`critter` helper)
- Modify: `test/helpers.js`, `test/recipes.test.js`
- Test: `test/creatures.test.js` (create)

**Interfaces:**
- Produces: `compileShape(src, key) → { w, h, n, frames: [{ dx: Int8Array, dy: Int8Array, letter: Uint8Array }], letters, base: number[], options: number[], colors: [r,g,b][32], order: number[], pulse: boolean }`; `SHAPE_COLORS = 32`. `DEFS[t].shape` (compiled or `null`); shaped elements get `behavior: 'body'`. `DEFS[t].critter` gains `climb` (default 1), `burst` (bool), `wades` (swim or human). Test helper `ageCreatures(world, t, left)`.

- [ ] **Step 1: Write the failing tests**

Create `test/creatures.test.js`:

```js
// Shaped creatures: bodies several cells big that grow, get hurt pixel by
// pixel, heal and die (creatures.js, shapes.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFS, ID } from '../src/sim/elements.js';
import { compileShape } from '../src/sim/shapes.js';
import { makeWorld, fillRect, run, countOf } from './helpers.js';

test('a shape compiles to pixel offsets from the middle of its bottom row', () => {
  const s = compileShape({
    frames: [['a.a', '.b.'], ['...', 'aba']],
    palette: { a: ['#ff0000', '#00ff00'], b: ['#0000ff'] },
  }, 'TEST');
  assert.equal(s.n, 3);
  assert.deepEqual([...s.frames[0].dx], [-1, 1, 0]);
  assert.deepEqual([...s.frames[0].dy], [-1, -1, 0]);
  assert.deepEqual([...s.frames[1].dx], [-1, 0, 1]);
  assert.deepEqual([...s.frames[1].letter], [0, 1, 0]);
  assert.deepEqual(s.base, [0, 2]);
  assert.deepEqual(s.options, [2, 1]);
  assert.equal(s.colors.length, 32);
  assert.deepEqual(s.colors[2], [0, 0, 255]);
  assert.deepEqual(s.colors[3], [255, 0, 0], 'the 32 slots repeat the colours');
  assert.throws(() => compileShape({ frames: [['aa'], ['a.']], palette: { a: ['#000000'] } }, 'BAD'),
    /different numbers of pixels/);
});

test('creatures live three times as long as they used to', () => {
  assert.deepEqual([DEFS[ID.ANT].lifeMin, DEFS[ID.ANT].lifeMax], [6000, 9000]);
  assert.deepEqual([DEFS[ID.FISH].lifeMin, DEFS[ID.FISH].lifeMax], [6000, 9000]);
  assert.deepEqual([DEFS[ID.TARDIGRADE].lifeMin, DEFS[ID.TARDIGRADE].lifeMax], [9000, 11700]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `NODE --test test/creatures.test.js < /dev/null`
Expected: FAIL (`Cannot find module '../src/sim/shapes.js'`).

- [ ] **Step 3: Write `src/sim/shapes.js`**

```js
// Bodies for the bigger creatures (creatures.js). A shape is a few frames
// of small pictures, each a list of rows, top row first:
//
//   shape: {
//     frames: [['a.a', '.b.'], ['...', 'aba']], // wings up, wings down
//     palette: { a: ['#5a4a3a', '#8a6a4a'], b: ['#e8e0d0'] },
//   }
//
// '.' is no pixel; any other letter is a pixel coloured from that letter's
// palette entry. A letter with several colours gives each creature one of
// them, picked when it's born (so humans wear different shirts). Every
// frame has the same number of pixels, numbered in reading order. The
// anchor, where the creature stands, is the middle of the bottom row: a
// pixel's offset is (column - floor(width / 2), row - (height - 1)).
// `pulse: true` switches frames on a timer instead of as the creature moves.

export const SHAPE_COLORS = 32; // palette slots per shape (a cell's shade & 31)

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

export function compileShape(src, key) {
  const letters = Object.keys(src.palette);
  const base = [], options = [], colors = [];
  for (const l of letters) {
    base.push(colors.length);
    options.push(src.palette[l].length);
    for (const c of src.palette[l]) colors.push(hex(c));
  }
  if (colors.length > SHAPE_COLORS) throw new Error(`${key}: more than ${SHAPE_COLORS} colours`);
  const h = src.frames[0].length, w = src.frames[0][0].length;
  const frames = src.frames.map((rows) => {
    if (rows.length !== h || rows.some((r) => r.length !== w)) throw new Error(`${key}: frames differ in size`);
    const dx = [], dy = [], letter = [];
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const l = letters.indexOf(ch);
      if (l < 0) throw new Error(`${key}: no colour for '${ch}'`);
      dx.push(x - (w >> 1));
      dy.push(y - (h - 1));
      letter.push(l);
    }));
    return { dx: Int8Array.from(dx), dy: Int8Array.from(dy), letter: Uint8Array.from(letter) };
  });
  const n = frames[0].dx.length;
  if (frames.some((f) => f.dx.length !== n)) throw new Error(`${key}: frames have different numbers of pixels`);
  // A seed grows from the pixel nearest the middle of the shape outwards.
  const f = frames[0], my = -(h - 1) / 2;
  const far = (p) => f.dx[p] * f.dx[p] + (f.dy[p] - my) ** 2;
  const order = [...Array(n).keys()].sort((a, b) => far(a) - far(b));
  return {
    w, h, n, frames, letters, base, options, order,
    colors: Array.from({ length: SHAPE_COLORS }, (_, k) => colors[k % colors.length]),
    pulse: !!src.pulse,
  };
}
```

- [ ] **Step 4: Compile shapes in `src/sim/elements.js`**

Add the import after the `elements-more.js` import:

```js
import { compileShape } from './shapes.js';
```

In `normalize`, in the `// gadgets and creatures` group after `stalk: null,`:

```js
    shape: e.shape ? compileShape(e.shape, e.key) : null, // shaped creatures (creatures.js)
```

After `if (e.machine) d.behavior = 'machine';`:

```js
  // A creature several cells big is moved as a whole (creatures.js).
  if (d.shape) d.behavior = 'body';
```

In the `d.critter = { ... }` object, after `tough: !!c.tough,`:

```js
      climb: c.climb ?? 1, // the highest step a walker climbs
      burst: !!c.burst, // swims in bursts, mostly upward (squid)
      wades: c.moves === 'swim' || c.moves === 'human', // goes into liquids
```

- [ ] **Step 5: Triple the lifespans in `src/sim/elements-world.js`**

Replace the `critter` helper:

```js
// A creature. It moves itself, so it's a SOLID that the physics leaves alone.
// Creatures live LIFE_SCALE times the life ranges written below.
const WATERS = ['WATER', 'SALT_WATER'];
const LIFE_SCALE = 3;
const critter = (key, name, sym, colors, c, extra) => ({
  key, name, sym, cat: 'creature', state: SOLID, colors, strength: 0, density: 1, conduct: 0.1,
  behavior: 'critter', critter: c, ...extra,
  life: extra.life.map((v) => v * LIFE_SCALE),
});
```

- [ ] **Step 6: Age creatures in the recipe tests**

Recipe tests wait at most 4,000 frames; creatures now live 6,000 or more. In `test/helpers.js` add:

```js
// Bring every creature of kind t to within `left` steps of old age: single
// cells count their life down, shaped ones count their age up.
export function ageCreatures(world, t, left) {
  for (let i = 0; i < world.type.length; i++) {
    if (world.type[i] === t && world.life[i] > left) world.life[i] = left;
  }
  for (const e of world.creatures ?? []) if (e.kind === t) e.age = Math.max(e.age, e.lifespan - left);
}
```

In `test/recipes.test.js`, import it (`import { makeWorld, fillRect, wallBox, ageCreatures } from './helpers.js';`), and in `setUp`'s `case 'time':`, after the existing `if/else` chain, before `break;`:

```js
      // Creatures live longer than a recipe test runs: age them, for what
      // they leave when they die.
      if (DEFS[a].critter && DEFS[a].lifeEnd && (rule.output === DEFS[a].lifeEnd.to || rule.output === DEFS[a].lifeEnd.alt)) {
        hooks.push(() => ageCreatures(w, a, 60));
      }
```

- [ ] **Step 7: Run the tests**

Run: `NODE --test test/creatures.test.js test/recipes.test.js < /dev/null`
Expected: PASS (no shapes are in the data yet, so nothing else changes).

- [ ] **Step 8: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Shapes compiler, the body behaviour, and creatures live three times as long

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Bodies: birth, damage, death, healing, falling

**Files:**
- Create: `src/sim/creatures.js`
- Modify: `src/sim/world.js` (imports, constructor, `clearAll`, `initLife`, `step`, mixin list)
- Modify: `src/sim/behaviors.js` (`body` case)
- Modify: `src/sim/elements-world.js` (shapes for the nine animals)
- Modify: `src/render/renderer.js` (shape palettes)
- Test: `test/creatures.test.js`

**Interfaces:**
- Consumes: `DEFS[t].shape`, `DEFS[t].critter.wades/tough`, `freeSpaceNear(c)` (machines.js), `swap`, `clearCell`, `convert`, `gravity`, `downAt(a)`.
- Produces (on `World.prototype`, used by later tasks): `creatures` (array), `creatureById` (array, id → entity or null), `camps` (array), `SHAPED` (export), `newCreature`, `forgetCreature(e)`, `removeCreature(e, keep = -1)`, `downFor(x, y) → { gx, gy } | null`, `placeCells(kind, x, y, fr, facing, gx, gy, out) → bool`, `roomForBody(e, c) → bool`, `ownCell(e, c) → bool`, `moveBody(e, x, y, fr, facing, gx, gy) → bool`, `bodyTemp(e)`, `hurt(e, p, heat)`, `hurtRandom(e)`, `randomCell(e) → index | -1`, `creatureDies(e)`, `supported(e) → bool`, `fall(e) → bool` (true while in the air), `stepCreature(e)`, `stepAnimal(e)` (replaced in Task 3). Entity fields: `id, kind, x, y, facing, frame, gx, gy, n, pix (0 BODY, 1 HURT, 2 UNBORN), cells, ring, look, seed, grow, wait, lost, burnt, hurtAt, age, lifespan, fallV, vx, vy, pushX, pushY, dry, wades, brain, slot`.

- [ ] **Step 1: Write the failing tests**

Append to `test/creatures.test.js`:

```js
import { GROW_GIVE_UP, HEAL_AFTER, NEWBORN_GRACE } from '../src/sim/creatures.js';

// A floor of stone along the bottom two rows.
function floored(w = 40, h = 30) {
  const world = makeWorld(w, h);
  fillRect(world, 0, h - 2, w - 1, h - 1, ID.STONE);
  return world;
}

// The one creature of kind t in the world.
const only = (w, t) => {
  const all = w.creatures.filter((e) => e.kind === t);
  assert.equal(all.length, 1, `one ${DEFS[t].name}`);
  return all[0];
};

test('a seed grows into a whole body, ring by ring outward', () => {
  const w = floored();
  w.spawn(10 * 40 + 20, ID.FISH); // Task 5 makes this a human (more rings)
  const counts = [];
  for (let k = 0; k < 8; k++) { w.step(); counts.push(countOf(w, ID.FISH)); }
  assert.equal(counts[0], 1, 'the seed hatches first');
  assert.equal(counts.at(-1), DEFS[ID.FISH].shape.n, 'then the whole body is there');
  for (let k = 1; k < counts.length; k++) assert.ok(counts[k] >= counts[k - 1], `never shrinks: ${counts}`);
});

test('a seed with no room for a body waits, then is gone', () => {
  const w = makeWorld(20, 20);
  fillRect(w, 0, 0, 19, 19, ID.STONE);
  const i = 10 * 20 + 10;
  w.clearCell(i);
  w.spawn(i, ID.SNAIL);
  run(w, GROW_GIVE_UP - 5);
  assert.equal(w.type[i], ID.SNAIL, 'still waiting');
  run(w, 10);
  assert.equal(w.type[i], 0, 'gave up');
  assert.equal(w.creatures.length, 0);
});

test('a body falls as one, and sand piles up on top of it', () => {
  const w = floored();
  w.spawn(5 * 40 + 20, ID.SNAIL);
  run(w, 60);
  const e = only(w, ID.SNAIL);
  assert.equal(e.y, 27, 'standing on the floor');
  assert.equal(countOf(w, ID.SNAIL), 5);
  fillRect(w, 17, 20, 23, 22, ID.SAND);
  run(w, 80);
  assert.equal(e.y, 27, 'not pushed into the floor');
  assert.equal(countOf(w, ID.SNAIL), 5, 'not crushed');
  assert.equal(w.type[25 * 40 + 20], ID.SAND, 'sand resting on its back');
});

test('lost pixels are damage; half the body lost is death, which leaves its remains', () => {
  const w = floored();
  w.spawn(27 * 40 + 20, ID.SNAIL);
  run(w, 10);
  const e = only(w, ID.SNAIL);
  w.clearCell(e.cells[0]);
  w.step();
  assert.equal(e.lost, 1, 'one pixel damaged');
  assert.equal(w.creatureById[e.id], e, 'still alive');
  w.clearCell(e.cells[1]);
  w.clearCell(e.cells[2]);
  w.step();
  assert.equal(w.creatureById[e.id], null, 'dead');
  assert.equal(countOf(w, ID.SNAIL), 0);
  assert.equal(countOf(w, ID.SEASHELL), 2, 'the two pixels left are its shell');
});

test('heat hurts only the pixels that are too hot, and a hurt creature heals', () => {
  const w = floored();
  w.spawn(27 * 40 + 20, ID.SNAIL);
  run(w, 10 + NEWBORN_GRACE);
  const e = only(w, ID.SNAIL);
  w.temp[e.cells[4]] = 200;
  w.step();
  assert.equal(e.lost, 1, 'only the hot pixel');
  run(w, HEAL_AFTER + 2);
  assert.equal(e.lost, 0, 'healed');
  assert.equal(countOf(w, ID.SNAIL), 5);
});

test('a creature that dies of heat leaves ash', () => {
  const w = floored();
  w.spawn(27 * 40 + 20, ID.SNAIL);
  run(w, 10 + NEWBORN_GRACE);
  const e = only(w, ID.SNAIL);
  for (const p of [0, 1, 2]) w.temp[e.cells[p]] = 300;
  w.step();
  assert.equal(w.creatureById[e.id], null);
  assert.equal(countOf(w, ID.ASH), 2);
});

test('a bird turned into a phoenix becomes one whole', () => {
  const w = floored();
  w.spawn(27 * 40 + 20, ID.BIRD);
  run(w, 10);
  const e = only(w, ID.BIRD);
  w.convert(e.cells[0], ID.PHOENIX, false, -1); // what Bird + Fire does to a cell
  run(w, 12);
  assert.equal(countOf(w, ID.BIRD), 0);
  assert.equal(only(w, ID.PHOENIX).lost, 0);
  assert.equal(countOf(w, ID.PHOENIX), DEFS[ID.PHOENIX].shape.n);
});

test('clearing the world clears its creatures', () => {
  const w = floored();
  w.spawn(27 * 40 + 20, ID.SNAIL);
  run(w, 10);
  w.clearAll();
  assert.equal(w.creatures.length, 0);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `NODE --test test/creatures.test.js < /dev/null`
Expected: FAIL (`Cannot find module '../src/sim/creatures.js'`).

- [ ] **Step 3: Write `src/sim/creatures.js`**

```js
// Shaped creatures: the bigger animals and humans have bodies several cells
// big (shapes.js). Each is an entity in world.creatures, and its body is
// written into the grid as cells of its element, with ctype holding the
// entity's id and shade the pixel's palette slot. Fire, acid, the eraser
// and heat reach those cells like any other; on its next step the entity
// looks at them, and a pixel that is no longer its own is damaged. A
// creature dies when half its pixels are damaged, or of old age, and heals
// a pixel at a time while nothing hurts it.
//
// A lone cell of a shaped creature (ctype 0) is a seed: painted, made by a
// recipe, hatched or bred. It grows into a whole body, ring by ring outward
// from where it is, wherever the body fits round it.
//
// Mixed into World.prototype; initCreatures sets up the storage.

import { DEFS, ID, State, AMBIENT } from './elements.js';
import { DX8, DY8 } from './gravity.js';
import { SPEEDS, SLOW_EVERY } from './time.js';
import { PASS_BIT } from './walls.js';

const { LIQUID } = State;
const { WALL, ASH } = ID;

export const SHAPED = Uint8Array.from(DEFS, (d) => (d.shape ? 1 : 0));
export const GROW_EVERY = 2; // steps per ring of a growing body
export const GROW_GIVE_UP = 120; // steps a seed, or a blocked ring, waits for room
export const HEAL_AFTER = 150; // steps without harm for each pixel healed
export const SUFFOCATE_EVERY = 30; // steps per pixel lost out of breath (or water)
export const HOT_HURT = 60; // °C: a pixel hotter than this, or colder than
export const COLD_HURT = -15; // this, is damaged (unless the creature is tough)
export const NEWBORN_GRACE = 60; // steps after birth before heat can hurt it
const MAX_FALL = 4; // cells a step

// What each pixel of a body is.
export const BODY = 0, HURT = 1, UNBORN = 2;

export function initCreatures(world) {
  world.creatures = []; // every entity, in no particular order
  world.creatureById = [null]; // id (the ctype of its cells) -> entity
  world.freeCreatureIds = [];
  world.camps = []; // humans' camps (humans.js)
  world.footA = new Int32Array(64); // scratch for working out footprints
  world.footB = new Int32Array(64);
}

export const Creatures = {
  newCreature(t, x, y, facing, gx, gy) {
    const d = DEFS[t], sh = d.shape;
    const id = this.freeCreatureIds.length > 0 ? this.freeCreatureIds.pop() : this.creatureById.length;
    if (id > 65535) return null;
    const look = new Uint8Array(sh.letters.length);
    for (let l = 0; l < look.length; l++) look[l] = (this.rand() * sh.options[l]) | 0;
    const e = {
      id, kind: t, x, y, facing, frame: 0, gx, gy,
      n: sh.n,
      pix: new Uint8Array(sh.n).fill(UNBORN), // BODY, HURT or UNBORN, per pixel
      cells: new Int32Array(sh.n).fill(-1), // where each pixel is (-1: nowhere)
      ring: new Uint8Array(sh.n), // when each pixel grows, in rings from the seed
      look, // the colour picked for each palette letter
      seed: 0, // the pixel it grew from
      grow: 0, // steps since it hatched while it's growing, then -1
      wait: 0, // growing steps a ring has been blocked
      lost: 0, // damaged pixels
      burnt: 0, // of those, damaged by heat
      hurtAt: 0, // the tick it was last hurt
      age: 0,
      lifespan: d.lifeMin + ((this.rand() * (d.lifeMax - d.lifeMin + 1)) | 0),
      fallV: 0, // falling speed, cells a step
      vx: 0, vy: 0, // thrown by a blast
      pushX: 0, pushY: 0, // carried by a conveyor this step
      dry: 0, // steps a swimmer has been out of water
      wades: d.critter.wades,
      brain: null, // a human's (humans.js)
      slot: this.creatures.length, // its place in world.creatures
    };
    if (id === this.creatureById.length) this.creatureById.push(e);
    else this.creatureById[id] = e;
    this.creatures.push(e);
    return e;
  },

  // Drop e from the lists (its cells are left as they are).
  forgetCreature(e) {
    const list = this.creatures, last = list.pop();
    if (last !== e) {
      list[e.slot] = last;
      last.slot = e.slot;
    }
    this.creatureById[e.id] = null;
    this.freeCreatureIds.push(e.id);
  },

  // Take e out of the world, clearing the cells still its own (but `keep`).
  removeCreature(e, keep = -1) {
    for (let p = 0; p < e.n; p++) {
      const c = e.cells[p];
      if (c >= 0 && c !== keep && this.ownCell(e, c)) this.clearCell(c);
    }
    this.forgetCreature(e);
  },

  ownCell(e, c) {
    return this.type[c] === e.kind && this.ctype[c] === e.id;
  },

  // The way down at (x, y), as one of the four straight directions: a body
  // stands upright along it. null where nothing pulls.
  downFor(x, y) {
    const g = this.gravity;
    if (!g.newtonian) return { gx: g.downX, gy: g.downY };
    const k = g.dirA[this.air.at(x, y)];
    if (k < 0) return null;
    return { gx: DX8[k & 6], gy: DY8[k & 6] }; // a diagonal rounds to its neighbour
  },

  // The cells of a kind's frame `fr` with its anchor at (x, y), facing
  // `facing` (1 or -1), standing along down (gx, gy), into `out`. False if
  // any falls outside the world.
  placeCells(kind, x, y, fr, facing, gx, gy, out) {
    const f = DEFS[kind].shape.frames[fr];
    const rx = gy * facing, ry = -gx * facing;
    const { w, h } = this;
    for (let p = 0; p < f.dx.length; p++) {
      const cx = x + f.dx[p] * rx + f.dy[p] * gx, cy = y + f.dx[p] * ry + f.dy[p] * gy;
      if (cx < 0 || cy < 0 || cx >= w || cy >= h) return false;
      out[p] = cy * w + cx;
    }
    return true;
  },

  inFootprint(c, out, n) {
    for (let p = 0; p < n; p++) if (out[p] === c) return true;
    return false;
  },

  // Can e's body take cell c? Its own cells, empty space, a wall that lets
  // solids through, or anything it can push aside: gases and flames, and
  // liquids for creatures that go into them.
  roomForBody(e, c) {
    const u = this.type[c];
    if (u === 0) return true;
    if (u === e.kind && this.ctype[c] === e.id) return true;
    if (u === WALL) return (this.wall[c] & PASS_BIT[e.kind]) !== 0;
    const d = DEFS[u];
    if (!d.displaceable) return false;
    return d.state !== LIQUID || e.wades;
  },

  // Push the loose thing in cell c into the nearest free space (but not a
  // cell of `out`), or clear it. Walls stay.
  makeRoom(c, out, n) {
    const u = this.type[c];
    if (u === 0 || u === WALL) return;
    const m = this.freeSpaceNear(c);
    if (m >= 0 && !this.inFootprint(m, out, n)) this.swap(c, m);
    else this.clearCell(c);
  },

  writePixel(e, p, c, T, fr) {
    const sh = DEFS[e.kind].shape;
    const l = sh.frames[fr].letter[p];
    this.type[c] = e.kind;
    this.ctype[c] = e.id;
    this.temp[c] = T;
    this.life[c] = 0;
    this.vx[c] = 0;
    this.vy[c] = 0;
    this.loose[c] = 0;
    this.shade[c] = sh.base[l] + e.look[l];
    this.clock[c] = this.pass;
    e.cells[p] = c;
  },

  // The average temperature of e's body.
  bodyTemp(e) {
    let sum = 0, k = 0;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      sum += this.temp[e.cells[p]];
      k++;
    }
    return k > 0 ? sum / k : AMBIENT;
  },

  // A shaped creature's cell in the particle pass. Part of a body: nothing
  // to do but react like any cell (the entity does the rest). A seed tries
  // to hatch; one that finds no room for GROW_GIVE_UP steps is gone.
  updateBody(i, x, y, t) {
    if (this.ctype[i] !== 0) return false;
    if (this.hatch(i, x, y, t)) return true;
    if (++this.life[i] > GROW_GIVE_UP) {
      this.clearCell(i);
      return true;
    }
    return false;
  },

  // A seed at i (x, y): find a place for the whole body covering i, with
  // room for every pixel, trying first the pixels nearest the middle of the
  // shape on the seed, and start growing there. False while there's no room.
  hatch(i, x, y, t) {
    const sh = DEFS[t].shape, f = sh.frames[0];
    const { gx, gy } = this.downFor(x, y) ?? { gx: 0, gy: 1 };
    const facing = this.rand() < 0.5 ? 1 : -1;
    const rx = gy * facing, ry = -gx * facing;
    const probe = { kind: t, id: -1, wades: DEFS[t].critter.wades };
    const out = this.footA;
    for (let k = 0; k < sh.n; k++) {
      const p = sh.order[k];
      const ax = x - (f.dx[p] * rx + f.dy[p] * gx), ay = y - (f.dx[p] * ry + f.dy[p] * gy);
      if (!this.placeCells(t, ax, ay, 0, facing, gx, gy, out)) continue;
      let room = true;
      for (let q = 0; q < sh.n && room; q++) room = out[q] === i || this.roomForBody(probe, out[q]);
      if (!room) continue;
      const e = this.newCreature(t, ax, ay, facing, gx, gy);
      if (e === null) return false;
      for (let q = 0; q < sh.n; q++) e.ring[q] = Math.max(Math.abs(f.dx[q] - f.dx[p]), Math.abs(f.dy[q] - f.dy[p]));
      e.seed = p;
      this.writePixel(e, p, i, this.temp[i], 0);
      e.pix[p] = BODY;
      return true;
    }
    return false;
  },

  // Being born: another ring of pixels every GROW_EVERY steps, each where
  // there's room (anything loose in the way is pushed aside). A ring
  // blocked for GROW_GIVE_UP growing steps: the body shrinks back to its
  // seed, which looks for room again (or gives up, see updateBody).
  growStep(e) {
    e.grow++;
    if (e.grow % GROW_EVERY !== 0) return;
    const ring = e.grow / GROW_EVERY;
    const out = this.footA;
    if (!this.placeCells(e.kind, e.x, e.y, e.frame, e.facing, e.gx, e.gy, out)) return;
    const T = this.bodyTemp(e);
    let unborn = 0, blocked = false;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== UNBORN) continue;
      if (e.ring[p] > ring) { unborn++; continue; }
      const c = out[p];
      if (!this.roomForBody(e, c)) { unborn++; blocked = true; continue; }
      this.makeRoom(c, out, e.n);
      this.writePixel(e, p, c, T, e.frame);
      e.pix[p] = BODY;
    }
    if (unborn === 0) { e.grow = -1; return; }
    if (blocked && ++e.wait > GROW_GIVE_UP) {
      const s = e.cells[e.seed];
      if (e.pix[e.seed] !== BODY) { this.removeCreature(e); return; }
      this.removeCreature(e, s);
      this.ctype[s] = 0; // a seed again
      this.life[s] = 0;
    }
  },

  // Move e's body: anchor (x, y), frame fr, facing, down (gx, gy). Liquids,
  // gases and flames in the way go into the cells it leaves (or the nearest
  // free space). False, changing nothing, if anything else is in the way or
  // it would leave the world.
  moveBody(e, x, y, fr, facing, gx, gy) {
    const out = this.footA, old = this.footB, n = e.n;
    if (!this.placeCells(e.kind, x, y, fr, facing, gx, gy, out)) return false;
    for (let p = 0; p < n; p++) if (e.pix[p] === BODY && !this.roomForBody(e, out[p])) return false;
    let sum = 0, k = 0;
    for (let p = 0; p < n; p++) {
      const c = e.cells[p];
      old[p] = c;
      if (c < 0) continue;
      sum += this.temp[c];
      k++;
      this.clearCell(c);
      e.cells[p] = -1;
    }
    const T = k > 0 ? sum / k : AMBIENT;
    let f = 0;
    for (let p = 0; p < n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = out[p], u = this.type[c];
      if (u === 0 || u === WALL) continue;
      while (f < n && (old[f] < 0 || this.type[old[f]] !== 0 || this.inFootprint(old[f], out, n))) f++;
      if (f < n) this.swap(c, old[f++]);
      else this.makeRoom(c, out, n);
    }
    for (let p = 0; p < n; p++) if (e.pix[p] === BODY) this.writePixel(e, p, out[p], T, fr);
    e.x = x;
    e.y = y;
    e.frame = fr;
    e.facing = facing;
    e.gx = gx;
    e.gy = gy;
    return true;
  },

  hurt(e, p, heat) {
    e.pix[p] = HURT;
    e.cells[p] = -1;
    e.lost++;
    if (heat) e.burnt++;
    e.hurtAt = this.tick;
  },

  // A random pixel of e's body: its cell, or -1 if there's none left.
  randomPixel(e) {
    const s = (this.rand() * e.n) | 0;
    for (let k = 0; k < e.n; k++) {
      const p = (s + k) % e.n;
      if (e.pix[p] === BODY) return p;
    }
    return -1;
  },

  randomCell(e) {
    const p = this.randomPixel(e);
    return p < 0 ? -1 : e.cells[p];
  },

  hurtRandom(e) {
    const p = this.randomPixel(e);
    if (p < 0) return;
    this.clearCell(e.cells[p]);
    this.hurt(e, p, false);
  },

  // Look at e's cells: any no longer its own is a damaged pixel, as is one
  // too hot or cold. A cell turned into another shaped creature (Bird +
  // Fire) turns the whole creature into one: the body goes, and that cell
  // is the new one's seed. False if the creature is gone.
  checkBody(e) {
    const { type, ctype, temp } = this;
    const feels = !DEFS[e.kind].critter.tough && e.age >= NEWBORN_GRACE;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = e.cells[p], u = type[c];
      if (u === e.kind && ctype[c] === e.id) {
        if (feels && (temp[c] > HOT_HURT || temp[c] < COLD_HURT)) {
          this.clearCell(c);
          this.hurt(e, p, true);
        }
        continue;
      }
      if (SHAPED[u] && u !== e.kind && ctype[c] === 0) {
        this.removeCreature(e, c);
        return false;
      }
      this.hurt(e, p, false);
    }
    if (e.lost * 2 >= e.n) {
      this.creatureDies(e);
      return false;
    }
    return true;
  },

  // What's left of the body becomes its remains: ash if it died mostly of
  // heat, otherwise what its kind leaves (lifeEnd), pixel by pixel.
  creatureDies(e) {
    const le = DEFS[e.kind].lifeEnd;
    const burnt = e.burnt * 2 > e.lost;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = e.cells[p];
      if (burnt) this.convert(c, ASH, false, -1);
      else if (le === null) this.clearCell(c);
      else if (le.alt >= 0 && this.rand() < le.altChance) this.convert(c, le.alt, false, le.altRule);
      else this.convert(c, le.to, false, le.rule);
    }
    this.forgetCreature(e);
  },

  // A damaged pixel grows back, where its place is empty.
  healPixel(e) {
    const out = this.footA;
    if (!this.placeCells(e.kind, e.x, e.y, e.frame, e.facing, e.gx, e.gy, out)) return;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== HURT || this.type[out[p]] !== 0) continue;
      const T = this.bodyTemp(e);
      this.writePixel(e, p, out[p], T, e.frame);
      e.pix[p] = BODY;
      e.lost--;
      if (e.burnt > e.lost) e.burnt = e.lost;
      e.hurtAt = this.tick;
      return;
    }
  },

  // Is anything holding e up: a cell under one of its pixels that isn't
  // its own, empty, a gas or flame, or (for creatures that go into
  // liquids) a liquid? The edge of the world holds it up too.
  supported(e) {
    const { w, h, type } = this;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = e.cells[p];
      const nx = (c % w) + e.gx, ny = ((c / w) | 0) + e.gy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return true;
      const j = ny * w + nx, u = type[j];
      if (u === 0 || (u === e.kind && this.ctype[j] === e.id)) continue;
      if (u === WALL) {
        if ((this.wall[j] & PASS_BIT[e.kind]) !== 0) continue;
        return true;
      }
      const d = DEFS[u];
      if (d.displaceable && (d.state !== LIQUID || e.wades)) continue;
      return true;
    }
    return false;
  },

  // With nothing under it, it falls along its down, faster each step like
  // a grain. True while it's in the air.
  fall(e) {
    if (this.downAt(this.air.at(e.x, e.y)) < 0 || this.supported(e)) {
      e.fallV = 0;
      return false;
    }
    e.fallV = Math.min(MAX_FALL, e.fallV + 0.25);
    const n = Math.max(1, e.fallV | 0);
    for (let s = 0; s < n; s++) {
      if (!this.moveBody(e, e.x + e.gx, e.y + e.gy, e.frame, e.facing, e.gx, e.gy)) {
        e.fallV = 0;
        break;
      }
    }
    return true;
  },

  // Thrown by a blast: a cell a step along (vx, vy) while it's moving fast
  // enough, slowing down. True while it's flying.
  fling(e) {
    const sx = Math.abs(e.vx) >= 0.5 ? Math.sign(e.vx) : 0, sy = Math.abs(e.vy) >= 0.5 ? Math.sign(e.vy) : 0;
    if (sx === 0 && sy === 0) {
      e.vx = 0;
      e.vy = 0;
      return false;
    }
    if (sx !== 0 && !this.moveBody(e, e.x + sx, e.y, e.frame, e.facing, e.gx, e.gy)) e.vx = 0;
    if (sy !== 0 && !this.moveBody(e, e.x, e.y + sy, e.frame, e.facing, e.gx, e.gy)) e.vy = 0;
    e.vx *= 0.85;
    e.vy *= 0.85;
    return true;
  },

  // Turn upright when the way down changes.
  orient(e) {
    const dn = this.downFor(e.x, e.y);
    if (dn === null || (dn.gx === e.gx && dn.gy === e.gy)) return;
    this.moveBody(e, e.x, e.y, e.frame, e.facing, dn.gx, dn.gy);
  },

  // After the particle pass: every creature takes its step (more of them
  // in a fast time zone, fewer in a slow one, going by where it stands).
  stepCreatures() {
    const list = this.creatures;
    for (let k = list.length - 1; k >= 0; k--) {
      const e = list[k];
      let reps = 1;
      if (this.zoneCount !== 0) {
        const s = this.speed[e.y * this.w + e.x];
        if (s !== 0) reps = SPEEDS[s] >= 1 ? SPEEDS[s] : (this.tick % SLOW_EVERY[s] === 0 ? 1 : 0);
      }
      for (let r = 0; r < reps && this.creatureById[e.id] === e; r++) this.stepCreature(e);
    }
  },

  stepCreature(e) {
    if (!this.checkBody(e)) return;
    if (e.grow >= 0) {
      this.growStep(e);
      return;
    }
    if (++e.age >= e.lifespan) {
      this.creatureDies(e);
      return;
    }
    if (e.lost > 0 && this.tick - e.hurtAt >= HEAL_AFTER) this.healPixel(e);
    this.orient(e);
    if (this.fling(e)) return;
    this.stepAnimal(e);
  },

  // Replaced in Task 3: for now every animal just falls.
  stepAnimal(e) {
    this.fall(e);
  },
};
```

(The last method is replaced in Task 3.)

- [ ] **Step 4: Hook it into `src/sim/world.js` and `src/sim/behaviors.js`**

`world.js` imports, after the `sleep.js` import:

```js
import { Creatures, initCreatures } from './creatures.js';
```

Constructor, after `initSleep(this);`: `initCreatures(this);`

`clearAll`, at the end: `initCreatures(this);`

`initLife`: a shaped creature's age is kept by its entity, so its cells keep no life:

```js
  initLife(i, t) {
    const d = DEFS[t];
    this.life[i] = d.lifeMax && d.shape === null ? d.lifeMin + ((this.rand() * (d.lifeMax - d.lifeMin + 1)) | 0) : 0;
  }
```

`step()`, right after `if (this.zoneBox !== null) this.fastPasses(fromBottom);`:

```js
    if (this.creatures.length !== 0) this.stepCreatures(); // shaped creatures (creatures.js)
```

Mixin list: add `Creatures` at the end of the `Object.assign(World.prototype, ...)` arguments.

`behaviors.js`, in `behave`, after the `'critter'` case:

```js
      case 'body': return this.updateBody(i, x, y, t);
```

- [ ] **Step 5: Give the nine animals shapes in `src/sim/elements-world.js`**

Add a `shape:` entry to each one's `extra` object (the second object passed to `critter`), and the two new critter fields:

```js
  // FISH extra:
    shape: { frames: [['bbbe', '.bb.'], ['.bbe', 'bbb.']], palette: { b: ['#e88a3a', '#6a9ae8', '#e8c83a', '#8ae86a'], e: ['#1a1a1a'] } },
  // ELECTRIC_EEL extra:
    shape: { frames: [['bb..be', '..bb..'], ['..bb.e', 'bb..b.']], palette: { b: ['#3a4a3a', '#445444'], e: ['#c8c840'] } },
  // SQUID extra (and burst: true in its critter object):
    shape: { frames: [['.m.', 'mmm', 'mem', 't.t'], ['.m.', 'mmm', 'mem', '.tt']], palette: { m: ['#e8a8a0', '#dc9c94'], e: ['#2a2a2a'], t: ['#f4b4ac'] } },
  // JELLYFISH extra:
    shape: { frames: [['.b.', 'bbb', 't.t'], ['bbb', 'b.b', '.t.']], palette: { b: ['#d8a0f0', '#c890e8', '#e8b8fc'], t: ['#f0d0fc'] }, pulse: true },
  // BIRD extra:
    shape: { frames: [['w.w', '.b.'], ['...', 'wbw']], palette: { w: ['#5a4a3a', '#8a6a4a', '#3a3a3a'], b: ['#e8e0d0', '#8a6a4a'] } },
  // FROG extra (and climb: 2 in its critter object):
    shape: { frames: [['.ge', 'ggg'], ['gge', 'g.g']], palette: { g: ['#5aa83a', '#4e9c30', '#66b444'], e: ['#e8e040'] } },
  // SNAIL extra:
    shape: { frames: [['ss.', 'bbb']], palette: { s: ['#c8a070', '#b88a5a'], b: ['#e8c898'] } },
  // SPIDER extra:
    shape: { frames: [['lbl', 'l.l'], ['lbl', '.ll']], palette: { b: ['#2a2a2a', '#3a3434'], l: ['#1e1e1e'] } },
  // PHOENIX extra:
    shape: { frames: [['w...w', '.wbw.', '..t..'], ['.....', 'wwbww', '..t..']], palette: { w: ['#ff6a1a', '#ffb02a'], b: ['#ffe05a'], t: ['#ff3a1a'] } },
```

Facing right is the way each is drawn (head on the right); the body is mirrored when it faces left.

- [ ] **Step 6: Draw shaped cells from their own palette in `src/render/renderer.js`**

Imports: `import { SHAPED } from '../sim/creatures.js';` and `import { SHAPE_COLORS } from '../sim/shapes.js';`

In `buildPalettes`, after `this.palRGB = new Uint8Array(NUM * SHADES * 3);`:

```js
    this.shapeRGB = new Uint8Array(NUM * SHAPE_COLORS * 3); // shaped creatures' pixels (shapes.js)
```

and inside the `for (const d of DEFS)` loop, after the `for (let s = 0; s < SHADES; s++)` loop:

```js
      if (d.shape) d.shape.colors.forEach((rgb, s) => this.shapeRGB.set(rgb, (d.id * SHAPE_COLORS + s) * 3));
```

In the draw loop, add `shapeRGB` to the destructuring at the top of the function (`const { world, pixels, palRGB, shapeRGB, mode, ... } = this;`) and replace:

```js
          const s = shade[i] & 7;
          const p = (t * SHADES + s) * 3;
          r = palRGB[p]; g = palRGB[p + 1]; b = palRGB[p + 2];
```

with:

```js
          if (SHAPED[t] === 1) { // a creature's pixel: its own palette (shapes.js)
            const p = (t * SHAPE_COLORS + (shade[i] & 31)) * 3;
            r = shapeRGB[p]; g = shapeRGB[p + 1]; b = shapeRGB[p + 2];
          } else {
            const p = (t * SHADES + (shade[i] & 7)) * 3;
            r = palRGB[p]; g = palRGB[p + 1]; b = palRGB[p + 2];
          }
```

(If a later line in that branch reads the old `s` variable, rename its use to `(shade[i] & 7)`.)

- [ ] **Step 7: Run the tests**

Run: `NODE --test test/creatures.test.js < /dev/null` — Expected: PASS.

Then everything but the recipe and mechanics tests (their creature cases need Task 3):
`NODE --test $(ls test/*.test.js | grep -v -e recipes -e mechanics) < /dev/null` — Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Shaped creatures: bodies that grow, get hurt pixel by pixel, heal and die

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Animals swim, fly, walk, eat and breed

**Files:**
- Modify: `src/sim/creatures.js` (replace `stepAnimal`, add movement)
- Modify: `test/mechanics.test.js` (the fish test), `test/recipes.test.js` (creature labs)
- Test: `test/creatures.test.js`

**Interfaces:**
- Consumes: Task 2's entity API; `eat(i, j, x, y, t, d, meal)`, `emitAt`, `igniteAround`, `randomNeighbor`, `spawn`, `record`.
- Produces: `touches(e, set) → bool`, `fitsIn(e, x, y, fr, facing, set) → bool`, `tryMove(e, dir, up, set) → bool`, `AIRY` (export: 1 for empty space, gases, loose flames).

- [ ] **Step 1: Write the failing tests**

Append to `test/creatures.test.js`:

```js
import { wallBox } from './helpers.js';

test('fish swim about in water and stay in it', () => {
  const w = makeWorld(60, 40);
  const box = wallBox(w, 0, 0, 59, 39);
  fillRect(w, box.x0, 10, box.x1, box.y1, ID.WATER);
  for (let k = 0; k < 4; k++) w.spawn(25 * 60 + 8 + k * 12, ID.FISH);
  run(w, 20);
  const start = w.creatures.map((e) => e.x);
  run(w, 300);
  assert.equal(w.creatures.length, 4);
  assert.ok(w.creatures.some((e, k) => e.x !== start[k]), 'they moved');
  for (const e of w.creatures) {
    assert.equal(e.lost, 0);
    for (const c of e.cells) assert.ok(((c / 60) | 0) >= 10, 'never above the water');
  }
});

test('a bird flaps about in the air', () => {
  const w = floored(60, 40);
  w.spawn(15 * 60 + 30, ID.BIRD);
  const frames = new Set();
  let airborne = 0;
  run(w, 300, () => {
    const e = w.creatures[0];
    if (!e) return;
    frames.add(e.frame);
    if (e.y < 36) airborne++;
  });
  assert.deepEqual([...frames].sort(), [0, 1], 'wings up and down');
  assert.ok(airborne > 150, 'mostly off the ground');
});

test('a snail walks along the ground and climbs a step', () => {
  const w = floored(60, 30);
  fillRect(w, 40, 27, 59, 27, ID.STONE); // a step up
  w.spawn(27 * 60 + 30, ID.SNAIL);
  run(w, 10);
  const e = only(w, ID.SNAIL);
  w.moveBody(e, e.x, e.y, 0, 1, e.gx, e.gy); // facing the step
  let up = false;
  run(w, 3000, () => { if (e.y === 26) up = true; });
  assert.ok(up, 'it got up the step');
});

test('a fish out of water loses pixels until it dies', () => {
  const w = floored(40, 20);
  w.spawn(17 * 40 + 20, ID.FISH);
  run(w, 400);
  assert.equal(countOf(w, ID.FISH), 0);
  assert.ok(countOf(w, ID.BONE) + countOf(w, ID.MEAT) > 0);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `NODE --test test/creatures.test.js < /dev/null`
Expected: the fish-swim, bird and snail tests FAIL (animals only fall so far).

- [ ] **Step 3: Replace `stepAnimal` in `src/sim/creatures.js` and add movement**

Below the `SHAPED` export add:

```js
// What fliers and walkers move through: empty space, gases and loose flames.
export const AIRY = Uint8Array.from(DEFS, (d) => (d.id === 0 || (d.displaceable && d.state !== LIQUID) ? 1 : 0));
```

Replace the placeholder `stepAnimal` with:

```js
  // An animal's step: sparks and fire from a pixel (eels, the phoenix),
  // eating something touching it, then moving the way its kind moves.
  stepAnimal(e) {
    const d = DEFS[e.kind], c = d.critter;
    const i = this.randomCell(e);
    if (i < 0) return;
    const x = i % this.w, y = (i / this.w) | 0;
    if (c.spark && this.rand() < c.spark) for (let n = 0; n < 3; n++) this.emitAt(ID.ELECTRON, x, y);
    if (c.ignite && this.rand() < 0.2) this.igniteAround(x, y);
    if (this.rand() < 0.1) {
      const j = this.randomNeighbor(x, y);
      const meal = j >= 0 && !this.ownCell(e, j) ? c.food[this.type[j]] : null;
      if (meal) {
        this.eat(i, j, x, y, e.kind, d, meal);
        e.age = Math.max(0, e.age - 300); // well fed
        return;
      }
    }
    if (d.shape.pulse) {
      const fr = (this.tick >> 4) & 1;
      if (fr !== e.frame) this.moveBody(e, e.x, e.y, fr, e.facing, e.gx, e.gy);
    }
    if (c.moves === 'swim') this.swimAbout(e, c);
    else if (c.moves === 'fly') this.flyAbout(e, c);
    else this.walkAbout(e, c);
  },

  // Does any pixel of e touch a cell holding something in `set`?
  touches(e, set) {
    const { w, h, type } = this;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = e.cells[p], x = c % w, y = (c / w) | 0;
      if ((x + 1 < w && set[type[c + 1]]) || (x > 0 && set[type[c - 1]])
        || (y + 1 < h && set[type[c + w]]) || (y > 0 && set[type[c - w]])) return true;
    }
    return false;
  },

  // Would every pixel of e, placed so, be in its own cells or cells holding
  // something in `set`?
  fitsIn(e, x, y, fr, facing, set) {
    const out = this.footB;
    if (!this.placeCells(e.kind, x, y, fr, facing, e.gx, e.gy, out)) return false;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] === BODY && !set[this.type[out[p]]] && !this.ownCell(e, out[p])) return false;
    }
    return true;
  },

  // One cell across the down arrow (`dir`, 1 or -1, becomes its facing)
  // and `up` cells against it, into cells holding something in `set`,
  // flipping to its other frame. A trail (silk, ink) may be left where it
  // stood. Returns whether it moved.
  tryMove(e, dir, up, set) {
    const sh = DEFS[e.kind].shape;
    const x = e.x + e.gy * dir - up * e.gx, y = e.y - e.gx * dir - up * e.gy;
    const fr = sh.frames.length === 2 && !sh.pulse ? e.frame ^ 1 : e.frame;
    if (!this.fitsIn(e, x, y, fr, dir, set)) return false;
    const was = e.y * this.w + e.x;
    if (!this.moveBody(e, x, y, fr, dir, e.gx, e.gy)) return false;
    const c = DEFS[e.kind].critter, tr = c.trail;
    if (tr !== null && this.rand() < tr.chance && (this.type[was] === 0 || c.home[this.type[was]])) {
      this.spawn(was, tr.id);
      this.record(tr.id, tr.rule);
    }
    return true;
  },

  // Swimmers move only through water. Out of it they fall, and lose a
  // pixel every SUFFOCATE_EVERY steps until they're back in.
  swimAbout(e, c) {
    if (!this.touches(e, c.home)) {
      if (++e.dry % SUFFOCATE_EVERY === 0) this.hurtRandom(e);
      this.fall(e);
      return;
    }
    e.dry = 0;
    if (this.rand() >= c.speed) return;
    const dir = this.rand() < 0.1 ? -e.facing : e.facing;
    const r = this.rand();
    const up = c.burst ? (r < 0.5 ? 1 : r < 0.6 ? -1 : 0) : (r < 0.15 ? 1 : r < 0.3 ? -1 : 0);
    if (!this.tryMove(e, dir, up, c.home)) this.tryMove(e, -dir, 0, c.home);
  },

  // Fliers flap about through the air.
  flyAbout(e, c) {
    if (this.rand() >= c.speed) return;
    const dir = this.rand() < 0.15 ? -e.facing : e.facing;
    const r = this.rand();
    const up = r < 0.25 ? 1 : r < 0.5 ? -1 : 0;
    if (!this.tryMove(e, dir, up, AIRY)) this.tryMove(e, -dir, 0, AIRY);
  },

  // Walkers fall with nothing under them; otherwise they walk along the
  // ground, up steps of up to c.climb cells, and turn round at walls.
  walkAbout(e, c) {
    if (this.fall(e)) return;
    if (this.rand() >= c.speed) return;
    for (let up = 0; up <= c.climb; up++) if (this.tryMove(e, e.facing, up, AIRY)) return;
    this.moveBody(e, e.x, e.y, e.frame, -e.facing, e.gx, e.gy);
  },
```

- [ ] **Step 4: Update the fish test in `test/mechanics.test.js`**

Replace the `'fish live in water and die on land'` test:

```js
test('fish live in water and die on land', () => {
  const pond = makeWorld(60, 40);
  const box = wallBox(pond, 0, 0, 59, 39);
  fillRect(pond, box.x0, 10, box.x1, box.y1, ID.WATER);
  for (let k = 0; k < 6; k++) pond.convert((20 + k * 2) * 60 + 6 + k * 8, ID.FISH, false, -1);
  run(pond, 400);
  const fish = pond.creatures.filter((e) => e.kind === ID.FISH);
  assert.equal(fish.length, 6, 'every fish still swimming');
  for (const e of fish) assert.equal(e.lost, 0, 'and unhurt');

  const beach = makeWorld(60, 40);
  wallBox(beach, 0, 0, 59, 39);
  for (let k = 0; k < 6; k++) beach.spawn(36 * 60 + 5 + k * 8, ID.FISH);
  run(beach, 600);
  assert.equal(countOf(beach, ID.FISH), 0);
  assert.ok(countOf(beach, ID.BONE) + countOf(beach, ID.MEAT) >= 6, 'each left bones or meat');
});
```

- [ ] **Step 5: Give creature recipes a habitat in `test/recipes.test.js`**

Import `SHAPED`: `import { SHAPED } from '../src/sim/creatures.js';`. Add, above `setUp`:

```js
// Recipes with a shaped creature (one several cells big, creatures.js): a
// few of them spaced out where they live, with the other ingredient as a
// band along the floor (in the water, for swimmers) or, for a gas or a
// flame, puffs of it among them.
function creatureLab(rule, kind) {
  const w = makeWorld(60, 50, 1000 + rule.output);
  const box = wallBox(w, 5, 5, 54, 44);
  const c = DEFS[kind].critter;
  const other = rule.inputs.find((t) => t !== kind) ?? kind;
  const hooks = [];
  if (c.moves === 'swim') fillRect(w, box.x0, box.y0 + 10, box.x1, box.y1, ID.WATER);
  if (other !== kind && !c.home[other]) {
    if (isGas(other)) {
      hooks.push((f) => { if (f % 10 === 0) w.paint(30, box.y0 + 14, 4, other); });
    } else {
      for (let y = box.y1 - 2; y <= box.y1; y++) {
        for (let x = box.x0; x <= box.x1; x++) {
          const i = y * w.w + x;
          w.clearCell(i);
          w.spawn(i, other);
        }
      }
    }
  }
  for (let k = 0; k < 6; k++) w.spawn((box.y0 + 14) * w.w + box.x0 + 4 + k * 7, kind);
  const le = DEFS[kind].lifeEnd; // what it leaves when it dies: age it
  if (rule.kind === 'time' && le && (rule.output === le.to || rule.output === le.alt)) hooks.push(() => ageCreatures(w, kind, 60));
  return { w, each: (f) => { for (const h of hooks) h(f); } };
}
```

At the top of `setUp(rule)`, before anything else:

```js
  const shaped = rule.inputs.find((t) => SHAPED[t]);
  if (shaped !== undefined) return creatureLab(rule, shaped);
```

- [ ] **Step 6: Run the tests**

Run: `NODE --test test/creatures.test.js test/mechanics.test.js test/recipes.test.js < /dev/null`
Expected: PASS. If a creature recipe fails, print which (`--test-name-pattern`), and check the lab: the creature must be able to reach the other ingredient (e.g. lower the band, or paint the ingredient beside the seeds). Don't raise MAX_FRAMES.

Then the whole suite: `NODE --test test/*.test.js < /dev/null` — Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Shaped animals swim, fly, walk, eat and breed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Brushes, conveyors, portals, blasts, pistons, doors and dispensers

**Files:**
- Modify: `src/sim/creatures.js` (`paintCreatures`, `nudgeCreature`, `portalCreature`, `blastCreatures`; `stepCreature`, `fall`)
- Modify: `src/sim/world.js` (`paintArea`, `blast`)
- Modify: `src/sim/machines-motion.js` (`runConveyor`, `shove`), `src/sim/machines.js` (`shutDoor`), `src/sim/portals.js` (`crossPortal`), `src/sim/lookups.js` (`DISPENSABLE`)
- Test: `test/creatures.test.js`

**Interfaces:**
- Produces: `paintCreatures(area, t)`, `nudgeCreature(id, dx, dy)`, `portalCreature(e) → bool`, `blastCreatures(x, y, strength, r)`.

- [ ] **Step 1: Write the failing tests**

Append to `test/creatures.test.js`:

```js
test('painting a shaped creature puts down seeds a body apart', () => {
  const w = makeWorld(60, 40);
  w.paint(30, 20, 10, ID.SNAIL);
  const seeds = [];
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.SNAIL) seeds.push([i % 60, (i / 60) | 0]);
  assert.ok(seeds.length >= 4, `${seeds.length} seeds`);
  for (const [ax, ay] of seeds) {
    for (const [bx, by] of seeds) {
      if (ax === bx && ay === by) continue;
      assert.ok(Math.abs(ax - bx) > 3 || Math.abs(ay - by) > 2, 'spaced apart');
    }
  }
  w.step();
  assert.equal(w.creatures.length, seeds.length, 'every one hatched');
});

test('a conveyor carries a creature along whole', () => {
  const ride = (powered) => {
    const w = makeWorld(60, 20, 7);
    fillRect(w, 10, 15, 49, 15, ID.CONVEYOR);
    if (powered) w.spawn(15 * 60 + 9, ID.BATTERY);
    w.spawn(14 * 60 + 25, ID.SNAIL);
    run(w, 10);
    const e = w.creatures[0];
    const x0 = e.x;
    run(w, 60);
    assert.equal(e.lost, 0, 'in one piece');
    return e.x - x0;
  };
  assert.ok(ride(true) > 10, 'carried along');
  assert.ok(Math.abs(ride(false)) < 6, 'left be when the belt is off');
});

test('a creature falling onto a portal comes out of the other end', () => {
  const w = makeWorld(60, 60);
  w.addPortal(20, 50, 40, 50);
  w.addPortal(20, 5, 40, 5);
  w.spawn(40 * 60 + 30, ID.SNAIL);
  let top = false;
  run(w, 200, () => { const e = w.creatures[0]; if (e && e.y < 20) top = true; });
  assert.ok(top, 'it came out under the ceiling');
  assert.equal(w.creatures[0].lost, 0);
});

test('a blast hurts and throws a creature', () => {
  const w = floored();
  w.spawn(27 * 40 + 20, ID.SNAIL);
  run(w, 10);
  const e = only(w, ID.SNAIL);
  w.blast(e.x + 1, e.y - 1, 12);
  w.step();
  assert.ok(w.creatureById[e.id] !== e || e.lost > 0, 'hurt (or killed)');
});

test('a creature in a quarter-speed zone ages a quarter as fast', () => {
  const w = floored();
  w.spawn(27 * 40 + 20, ID.SNAIL);
  run(w, 10);
  const e = only(w, ID.SNAIL);
  w.paintSpeed((fn) => w.forRect(0, 0, 39, 29, fn), 1);
  const a0 = e.age;
  run(w, 80);
  assert.ok(Math.abs(e.age - a0 - 20) <= 1, `aged ${e.age - a0}`);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `NODE --test test/creatures.test.js < /dev/null`
Expected: FAIL (painting fills every cell; conveyor/portal move single cells and break the body).

- [ ] **Step 3: Add the integrations to `src/sim/creatures.js`**

Add these methods to `Creatures`:

```js
  // Painting a shaped creature puts down seeds a body apart: each into
  // empty space with no other creature's seed or body that close.
  paintCreatures(area, t) {
    const { w: sw, h: sh } = DEFS[t].shape;
    area((i, x, y) => {
      if (this.type[i] !== 0) return;
      for (let dy = -sh; dy <= sh; dy++) {
        for (let dx = -sw; dx <= sw; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < this.w && ny < this.h && SHAPED[this.type[ny * this.w + nx]]) return;
        }
      }
      this.spawn(i, t);
    });
  },

  // A conveyor under creature `id` moves it a cell (on its next step).
  nudgeCreature(id, dx, dy) {
    const e = this.creatureById[id];
    if (e) {
      e.pushX = dx;
      e.pushY = dy;
    }
  },

  // Standing or falling on a portal: the whole body goes through, if
  // there's room for it past the other end.
  portalCreature(e) {
    const a = e.y * this.w + e.x;
    const v = this.portalAt[a];
    if (v === 0) return false;
    const pr = this.portals[(v >> 17) - 1];
    if (pr.b === null) return false;
    const end = ((v >> 16) & 1) === 0 ? pr.a : pr.b;
    // The way it's going: down while falling, else the way it faces.
    const mx = e.fallV > 0 ? e.gx : e.gy * e.facing, my = e.fallV > 0 ? e.gy : -e.gx * e.facing;
    const out = this.portalExit(a, mx * end.nx + my * end.ny < 0 ? -1 : 1);
    if (out === null || out.j < 0) return false;
    return this.moveBody(e, out.j % this.w, (out.j / this.w) | 0, e.frame, e.facing, e.gx, e.gy);
  },

  // A blast within r of (x, y): each pixel it reaches may be destroyed (the
  // likelier the stronger and closer), and the creature is thrown away
  // from it and upward. Walls shield.
  blastCreatures(x, y, strength, r) {
    const r2 = r * r;
    for (const e of this.creatures) {
      if (Math.abs(e.x - x) > r + 8 || Math.abs(e.y - y) > r + 8) continue;
      let hit = false;
      for (let p = 0; p < e.n; p++) {
        if (e.pix[p] !== BODY) continue;
        const c = e.cells[p], cx = c % this.w, cy = (c / this.w) | 0;
        const d2 = (cx - x) ** 2 + (cy - y) ** 2;
        if (d2 > r2 || this.wallBetween(x, y, cx, cy)) continue;
        hit = true;
        if (this.rand() < Math.min(0.9, strength / (8 * Math.max(1, Math.sqrt(d2))))) {
          this.clearCell(c);
          this.hurt(e, p, false);
        }
      }
      if (!hit) continue;
      const dx = e.x - x, dy = e.y - y, dist = Math.max(1, Math.hypot(dx, dy));
      const f = (strength * 0.7) / dist;
      e.vx += (dx / dist) * f * 0.5 - e.gx * f * 0.3;
      e.vy += (dy / dist) * f * 0.5 - e.gy * f * 0.3;
    }
  },
```

In `stepCreature`, replace `if (this.fling(e)) return;` with:

```js
    if (this.portalCells !== 0 && this.portalCreature(e)) return;
    if (e.pushX !== 0 || e.pushY !== 0) {
      this.moveBody(e, e.x + e.pushX, e.y + e.pushY, e.frame, e.facing, e.gx, e.gy);
      e.pushX = 0;
      e.pushY = 0;
    }
    if (this.fling(e)) return;
```

In `fall`, inside the `for` loop after a successful move, stop on a portal so it goes through next step:

```js
      if (this.portalCells !== 0 && this.portalAt[e.y * this.w + e.x] !== 0) break;
```

- [ ] **Step 4: Hook the tools and machines**

`src/sim/world.js`: import `SHAPED` too (`import { Creatures, initCreatures, SHAPED } from './creatures.js';`). In `paintArea`, after the `if (t === SPARK) { ... }` line:

```js
    if (SHAPED[t]) { this.paintCreatures(area, t); return; } // seeds spaced a body apart
```

At the end of `blast` (after the loop):

```js
    if (this.creatures.length !== 0) this.blastCreatures(x, y, strength, r);
```

`src/sim/machines-motion.js`: import `import { SHAPED } from './creatures.js';`. Replace `runConveyor`'s body from `const j = ty * w + tx, u = type[j];` to the end with:

```js
    const j = ty * w + tx, u = type[j];
    if (u === 0) return;
    const across = downY !== 0; // the belt runs along x when gravity is up or down
    const f = this.powerFrom[i];
    let s = across ? Math.sign(x - (f % w)) : Math.sign(y - ((f / w) | 0));
    if (f < 0 || s === 0) s = 1;
    const nx = across ? tx + s : tx, ny = across ? ty : ty + s;
    // A shaped creature rides as a whole (creatures.js).
    if (SHAPED[u] && this.ctype[j] !== 0) { this.nudgeCreature(this.ctype[j], nx - tx, ny - ty); return; }
    if (this.clock[j] === this.pass || !(CARRIED[u] || this.loose[j])) return;
    if (!this.inBounds(nx, ny)) return;
    const m = ny * w + nx;
    if (roomFor(type[m])) this.swap(j, m);
```

In `shove`, the stop condition becomes:

```js
      if (DEFS[u].indestructible || u === PISTON_ARM || SHAPED[u]) return false; // a creature stalls it
```

`src/sim/machines.js`, `shutDoor`: import `SHAPED` from `./creatures.js`, and as the first line inside `if (u !== 0) {`:

```js
      if (SHAPED[u]) return false; // wait for a creature in the doorway to move
```

`src/sim/portals.js`, `crossPortal`'s `moves`:

```js
      || (d.state === SOLID && (this.loose[i] || (d.cat === 'creature' && d.shape === null)));
```

(shaped creatures go through whole, in `portalCreature`).

`src/sim/lookups.js`, `DISPENSABLE`:

```js
    && (d.state !== SOLID || d.behavior === 'critter' || d.behavior === 'body') ? 1 : 0;
```

- [ ] **Step 5: Run the tests**

Run: `NODE --test test/creatures.test.js test/machines.test.js test/machines-overhaul.test.js test/portals.test.js test/tools.test.js < /dev/null`
Expected: PASS. Then `NODE --test test/*.test.js < /dev/null` — PASS.

- [ ] **Step 6: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Shaped creatures: spaced painting, conveyors, portals, blasts, pistons and doors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The Human: body, recipe, walking, swimming and running from danger

**Files:**
- Create: `src/sim/humans.js`
- Modify: `src/sim/elements-world.js` (HUMAN, Clay + Lightning)
- Modify: `src/sim/creatures.js` (`stepCreature` dispatch, `forgetCreature`)
- Modify: `src/sim/world.js` (mixin list)
- Modify: `test/recipes.test.js` (`CLAY+LIGHTNING` setup), `test/creatures.test.js` (first test uses a human)
- Test: `test/humans.test.js` (create)

**Interfaces:**
- Consumes: Task 2–4 entity API.
- Produces: `newBrain()`; on `World.prototype`: `stepHuman(e)`, `keepWarm(e)`, `headUnder(e) → bool`, `inLiquid(e, under) → bool`, `swimHuman(e, b, under)`, `findShore(e) → -1 | 0 | 1`, `stepAcross(e, dir, climb, leap) → bool`, `walkTo(e, b, tx, ty, near, every) → bool` (true when there), `pose(e, fr)`, `findDanger(e, r) → cell | -1`, `inCampFire(camp, x, y) → bool`, `think(e, b)`, `chooseWork(e, b)` (replaced in Task 6), `act(e, b)` (replaced in Tasks 6–7), `wander(e, b)`, `giveUp(e, b)`, `release(b)`, `claim(b, camp, t)`, `leaveCamp(e)`. Brain fields: `job, think, pace, camp, target, best, stuck, banned, carry, carryJob, rub, breath, fleeDir, shore, goalX, goalY`. Jobs (shown in the inspect line): `'wandering', 'fleeing', 'swimming'` here; later `'gathering wood', 'carrying wood', 'lighting the fire', 'resting by the fire', 'fetching stone', 'building the hut', 'sheltering'`. Exports `THINK_EVERY, WALK_EVERY, RUN_EVERY, BREATH, DANGER_R, FRAME_KNEEL, FRAME_SIT`.

- [ ] **Step 1: Write the failing tests**

Create `test/humans.test.js`:

```js
// Humans: they grow like any shaped creature, then walk, swim, run from
// danger, make a campfire and build a hut (humans.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFS, ID } from '../src/sim/elements.js';
import { BREATH } from '../src/sim/humans.js';
import { makeWorld, fillRect, run, countOf } from './helpers.js';

// A human grown from a seed at (x, y).
function human(w, x, y) {
  w.spawn(y * w.w + x, ID.HUMAN);
  run(w, 12);
  const all = w.creatures.filter((c) => c.kind === ID.HUMAN);
  assert.ok(all.length > 0, 'a human hatched');
  return all.at(-1);
}

const alive = (w, e) => w.creatureById[e.id] === e;

test('a human has a 10-pixel body that grows in rings', () => {
  const w = makeWorld(40, 30);
  fillRect(w, 0, 28, 39, 29, ID.STONE);
  w.spawn(10 * 40 + 20, ID.HUMAN);
  const seen = new Set();
  for (let k = 0; k < 10; k++) { w.step(); seen.add(countOf(w, ID.HUMAN)); }
  assert.ok(seen.has(1) && seen.has(10), [...seen].join(','));
  assert.ok(seen.size >= 3, 'more than one ring');
  assert.equal(DEFS[ID.HUMAN].lifeMin, 72000);
});

test('a human runs from lava', () => {
  const w = makeWorld(120, 40);
  fillRect(w, 0, 35, 119, 39, ID.STONE);
  for (let y = 35; y <= 37; y++) {
    for (let x = 70; x <= 76; x++) { w.clearCell(y * 120 + x); w.spawn(y * 120 + x, ID.LAVA); }
  }
  const e = human(w, 60, 30);
  run(w, 300);
  assert.ok(alive(w, e), 'unhurt');
  assert.equal(e.lost, 0);
  assert.ok(e.x < 56, `ran away (x ${e.x})`);
});

test('a human in water swims up and out onto the shore', () => {
  const w = makeWorld(100, 40);
  fillRect(w, 0, 25, 99, 39, ID.STONE);
  for (let y = 25; y <= 34; y++) {
    for (let x = 20; x <= 60; x++) { w.clearCell(y * 100 + x); w.spawn(y * 100 + x, ID.WATER); }
  }
  const e = human(w, 40, 31);
  let landed = false;
  run(w, 900, () => { if (alive(w, e) && (e.x < 20 || e.x > 60) && e.y <= 24) landed = true; });
  assert.ok(landed, 'got out');
  assert.ok(alive(w, e));
});

test('a human held under water drowns slowly', () => {
  const w = makeWorld(40, 30);
  fillRect(w, 0, 0, 39, 29, ID.STONE);
  for (let y = 2; y <= 27; y++) {
    for (let x = 2; x <= 37; x++) { w.clearCell(y * 40 + x); w.spawn(y * 40 + x, ID.WATER); }
  }
  const e = human(w, 20, 15);
  run(w, BREATH + 90);
  assert.ok(alive(w, e), 'holds its breath a while');
  assert.ok(e.lost >= 1, 'then starts to drown');
  run(w, 400);
  assert.ok(!alive(w, e), 'drowned');
  assert.ok(countOf(w, ID.BONE) + countOf(w, ID.MEAT) > 0);
});
```

In `test/creatures.test.js`, change the first test to grow a human: `w.spawn(10 * 40 + 20, ID.HUMAN);` and both `ID.FISH` in it to `ID.HUMAN` (a human has more rings than a fish).

- [ ] **Step 2: Run to verify they fail**

Run: `NODE --test test/humans.test.js < /dev/null`
Expected: FAIL (`Cannot find module '../src/sim/humans.js'`).

- [ ] **Step 3: Add the Human to `src/sim/elements-world.js`**

After the PHOENIX entry:

```js
  critter('HUMAN', 'Human', 'Hmn', ['#f0c8a0', '#c83a3a', '#3a3a5a'], {
    moves: 'human',
  }, {
    life: [24000, 24000], lifeEnd: { to: 'BONE', alt: 'MEAT', altChance: 0.5 },
    shape: {
      frames: [
        ['.k.', 'ksk', '.s.', '.p.', 'p.p', 'p.p'], // walking
        ['.k.', 'ksk', '.s.', '.p.', '.pp', 'pp.'], // walking, legs crossing
        ['...', '.k.', 'ksk', '.s.', 'ppp', 'pp.'], // kneeling
        ['...', '.k.', 'ksk', '.s.', '.pp', 'ppp'], // sitting
      ],
      palette: {
        k: ['#f0c8a0', '#d8a878', '#a8784a', '#6a4428'],
        s: ['#c83a3a', '#3a6ac8', '#3aa85a', '#e8c83a', '#8a4ac8', '#e8e8e8'],
        p: ['#3a3a5a', '#4a3a2a'],
      },
    },
    desc: 'Makes a camp, gathers wood into a pile and lights a campfire by rubbing sticks, builds a little stone hut beside it to shelter from cold and rain, and runs from fire, lava and acid.',
    hint: 'Lightning striking Clay, as in the old stories of people shaped from clay.',
  }),
```

In `WORLD_REACTIONS`, in the `// Creatures.` group:

```js
  { a: 'CLAY', b: 'LIGHTNING', chance: 0.1, aTo: 'HUMAN', bTo: null },
```

Check the symbol is free: `grep -n "'Hmn'" src/sim/*.js` must show only this line.

- [ ] **Step 4: Write `src/sim/humans.js`**

```js
// Humans: shaped creatures (creatures.js) with minds of their own. A human
// makes a camp, gathers fuel into a pile beside it and lights it by
// rubbing sticks, builds a small hut nearby, shelters there from cold and
// rain, and runs from danger. It decides what to do every THINK_EVERY
// steps (think) and works at it in between (act). Humans near one camp
// share it and split the work. Mixed into World.prototype.

import { DEFS, ID, NUM, State } from './elements.js';
import { SHAPED, SUFFOCATE_EVERY, BODY } from './creatures.js';

const { SOLID, POWDER, LIQUID, GAS } = State;
const setOf = (keys) => {
  const s = new Uint8Array(NUM);
  for (const k of keys) s[ID[k]] = 1;
  return s;
};

export const THINK_EVERY = 8;
export const WALK_EVERY = 4; // steps per cell walked
export const RUN_EVERY = 2; // and run
const CLIMB = 2; // the highest step it climbs
const SWIM_CLIMB = 6; // or swims up, getting out of water
const GIVE_UP = 300; // steps without getting closer before it gives up on a target
const BAN_FOR = 1800; // and leaves that target alone
export const DANGER_R = 16; // it runs from danger this close
const SAFE_R = 24; // until there's none this close
const HOT = 80; // °C: anything this hot (but a gas) is danger
const BLAST_FEAR = 4; // and air pressure this high, from a blast
export const BREATH = 600; // steps it can hold its breath
const BODY_T = 37; // it keeps its body at this temperature,
const KEEP_WARM = 0.2; // this much of the way back each step
const SHORE_R = 40; // how far it looks for a shore
export const FRAME_KNEEL = 2, FRAME_SIT = 3;
const NEAR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DANGER = setOf(['LAVA', 'ACID', 'NAPALM', 'GREEK_FIRE', 'GREY_GOO', 'VIRUS', 'ANTIMATTER', 'BLACK_HOLE']);

export function newBrain() {
  return {
    job: 'wandering', // what it's doing (shown in the inspect line)
    think: 0, // steps to its next decision
    pace: 0, // steps since its last step taken
    camp: null,
    target: -1, // the cell it's going for
    best: Infinity, // its closest yet to the target
    stuck: 0, // steps without getting closer
    banned: new Map(), // cell -> tick until which it's left alone
    carry: 0, // the element in its hands
    carryJob: 'wandering', // what it's doing with it
    rub: 0, // steps spent rubbing sticks
    breath: 0, // steps with its head under
    fleeDir: 1,
    shore: 0, // the way to the nearest shore, while swimming
    goalX: -1, goalY: -1, // where it's wandering to
  };
}

export const Humans = {
  stepHuman(e) {
    if (e.brain === null) e.brain = newBrain();
    const b = e.brain;
    this.keepWarm(e);
    const under = this.headUnder(e);
    if (!under) b.breath = 0;
    else if (++b.breath > BREATH && (b.breath - BREATH) % SUFFOCATE_EVERY === 0) this.hurtRandom(e);
    if (this.inLiquid(e, under)) {
      b.job = 'swimming';
      this.swimHuman(e, b, under);
      return;
    }
    if (b.job === 'swimming') b.job = 'wandering';
    if (this.fall(e)) return;
    if (--b.think <= 0) {
      b.think = THINK_EVERY;
      this.think(e, b);
    }
    this.act(e, b);
  },

  // Warm-blooded: its body drifts back to BODY_T.
  keepWarm(e) {
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = e.cells[p];
      this.temp[c] += (BODY_T - this.temp[c]) * KEEP_WARM;
    }
  },

  // Is its head under: no air beside its topmost pixel left, and liquid
  // there? (Pressed against a lid under water, it still can't breathe.)
  headUnder(e) {
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = e.cells[p], x = c % this.w, y = (c / this.w) | 0;
      let wet = false;
      for (const [dx, dy] of NEAR4) {
        if (!this.inBounds(x + dx, y + dy)) continue;
        const j = (y + dy) * this.w + x + dx, t = this.type[j];
        if (this.ownCell(e, j)) continue;
        if (t === 0 || DEFS[t].state === GAS) return false; // air: it breathes
        if (DEFS[t].state === LIQUID) wet = true;
      }
      return wet;
    }
    return false;
  },

  // In a liquid: its head under, or liquid under its feet.
  inLiquid(e, under) {
    if (under) return true;
    const x = e.x + e.gx, y = e.y + e.gy;
    return this.inBounds(x, y) && DEFS[this.type[y * this.w + x]].state === LIQUID;
  },

  // Swim up for air, then towards the nearest shore, climbing out there.
  swimHuman(e, b, under) {
    if (++b.pace < 3) return;
    b.pace = 0;
    if (under && this.moveBody(e, e.x - e.gx, e.y - e.gy, 0, e.facing, e.gx, e.gy)) return;
    if (b.shore === 0 || this.tick % 60 === 0) b.shore = this.findShore(e);
    this.stepAcross(e, b.shore || e.facing, SWIM_CLIMB, false);
  },

  // The way (1 or -1) to the nearest column within SHORE_R with ground at
  // most SWIM_CLIMB cells above its feet and no liquid on it; 0 if none.
  findShore(e) {
    for (let d = 1; d <= SHORE_R; d++) {
      for (const dir of [1, -1]) {
        for (let up = 0; up <= SWIM_CLIMB; up++) {
          const x = e.x + d * dir * e.gy - up * e.gx, y = e.y - d * dir * e.gx - up * e.gy;
          const ax = x - e.gx, ay = y - e.gy;
          if (!this.inBounds(x, y) || !this.inBounds(ax, ay)) continue;
          const s = DEFS[this.type[y * this.w + x]].state;
          const above = DEFS[this.type[ay * this.w + ax]].state;
          if ((s === SOLID || s === POWDER) && above !== LIQUID && !SHAPED[this.type[y * this.w + x]]) return dir;
        }
      }
    }
    return 0;
  },

  // One step across the down arrow, `dir` (1 or -1) becoming the way it
  // faces: on the level, or up a step of up to `climb` cells. Running
  // (`leap`), it carries on over a gap of up to 2 cells. Returns whether it
  // moved.
  stepAcross(e, dir, climb, leap) {
    const rx = e.gy * dir, ry = -e.gx * dir;
    const fr = e.frame === 0 ? 1 : 0;
    for (let up = 0; up <= climb; up++) {
      if (!this.moveBody(e, e.x + rx - up * e.gx, e.y + ry - up * e.gy, fr, dir, e.gx, e.gy)) continue;
      if (leap && up === 0) {
        for (let more = 0; more < 2 && !this.supported(e); more++) {
          if (!this.moveBody(e, e.x + rx, e.y + ry, fr, dir, e.gx, e.gy)) break;
        }
      }
      return true;
    }
    return false;
  },

  // Walk (a step every `every` steps) towards (tx, ty) across the down
  // arrow. True once it's within `near` cells across and the target is
  // level with its body (from 9 cells above its feet to 2 below). No
  // closer for GIVE_UP steps: it gives up (giveUp).
  walkTo(e, b, tx, ty, near, every) {
    const a = (tx - e.x) * e.gy - (ty - e.y) * e.gx; // across: + is the way "right" points
    const v = (tx - e.x) * e.gx + (ty - e.y) * e.gy; // along: + is down
    if (Math.abs(a) <= near && v >= -9 && v <= 2) {
      b.stuck = 0;
      b.best = Infinity;
      return true;
    }
    const dist = Math.abs(a) + Math.abs(v);
    if (dist < b.best) {
      b.best = dist;
      b.stuck = 0;
    } else if (++b.stuck > GIVE_UP) {
      this.giveUp(e, b);
      return false;
    }
    if (++b.pace < every) return false;
    b.pace = 0;
    this.stepAcross(e, a > 0 ? 1 : a < 0 ? -1 : e.facing, CLIMB, every === RUN_EVERY);
    return false;
  },

  pose(e, fr) {
    if (e.frame !== fr) this.moveBody(e, e.x, e.y, fr, e.facing, e.gx, e.gy);
  },

  // The nearest danger within r of e (a cell index), or -1: something in
  // DANGER, anything but a gas hotter than HOT (its own campfire aside), or
  // a blast's pressure (then the cell beside it on the side the pressure
  // is higher).
  findDanger(e, r) {
    const { w, h, type, temp } = this;
    const camp = e.brain.camp;
    let best = -1, bd = Infinity;
    for (let y = Math.max(0, e.y - r); y <= Math.min(h - 1, e.y + r); y++) {
      for (let x = Math.max(0, e.x - r); x <= Math.min(w - 1, e.x + r); x++) {
        const i = y * w + x, t = type[i];
        if (t === 0 || t === e.kind) continue;
        if (!DANGER[t] && (temp[i] <= HOT || DEFS[t].state === GAS)) continue;
        if (camp !== null && this.inCampFire(camp, x, y)) continue;
        const d = (x - e.x) ** 2 + (y - e.y) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    }
    if (best < 0 && this.air.p[this.air.at(e.x, e.y)] > BLAST_FEAR) {
      const l = this.pressureAt(Math.max(0, e.x - 8), e.y), rt = this.pressureAt(Math.min(w - 1, e.x + 8), e.y);
      best = e.y * w + (l > rt ? Math.max(0, e.x - 1) : Math.min(w - 1, e.x + 1));
    }
    return best;
  },

  // Is (x, y) its camp's fire, or the hot air and ground round it?
  inCampFire(camp, x, y) {
    const u = (x - camp.x) * camp.gy - (y - camp.y) * camp.gx;
    const v = (x - camp.x) * camp.gx + (y - camp.y) * camp.gy;
    return u >= -4 && u <= 4 && v >= -20 && v <= 3;
  },

  think(e, b) {
    const danger = this.findDanger(e, b.job === 'fleeing' ? SAFE_R : DANGER_R);
    if (danger >= 0) {
      const a = ((danger % this.w) - e.x) * e.gy - (((danger / this.w) | 0) - e.y) * e.gx;
      b.fleeDir = a > 0 ? -1 : a < 0 ? 1 : -e.facing;
      b.job = 'fleeing';
      return;
    }
    if (b.job === 'fleeing') b.job = 'wandering';
    this.chooseWork(e, b);
  },

  // What to do when nothing's wrong (Task 6 gives it a camp to work at).
  chooseWork(e, b) {
    b.job = 'wandering';
  },

  act(e, b) {
    switch (b.job) {
      case 'fleeing':
        if (++b.pace >= RUN_EVERY) {
          b.pace = 0;
          this.stepAcross(e, b.fleeDir, CLIMB, true);
        }
        break;
      default:
        this.wander(e, b);
    }
  },

  // Amble about near its camp (or where it is), stopping now and then.
  wander(e, b) {
    if (b.goalX < 0) {
      const cx = b.camp !== null ? b.camp.x : e.x, cy = b.camp !== null ? b.camp.y : e.y;
      const d = ((this.rand() * 21) | 0) - 10;
      b.goalX = Math.min(this.w - 1, Math.max(0, cx + d * e.gy));
      b.goalY = Math.min(this.h - 1, Math.max(0, cy - d * e.gx));
    }
    if (this.walkTo(e, b, b.goalX, b.goalY, 1, WALK_EVERY)) {
      this.pose(e, 0);
      if (this.rand() < 0.01) b.goalX = -1;
    }
  },

  // No closer for GIVE_UP steps: leave that target alone for a while.
  giveUp(e, b) {
    if (b.target >= 0) {
      b.banned.set(b.target, this.tick + BAN_FOR);
      this.release(b);
    }
    b.goalX = -1;
    b.stuck = 0;
    b.best = Infinity;
    if (b.carry === 0) b.job = 'wandering';
    b.think = 0;
  },

  claim(b, camp, t) {
    b.target = t;
    camp.claims.add(t);
    b.best = Infinity;
    b.stuck = 0;
  },

  release(b) {
    if (b.target >= 0 && b.camp !== null) b.camp.claims.delete(b.target);
    b.target = -1;
  },

  // A human that dies leaves its camp; a camp with nobody left is forgotten.
  leaveCamp(e) {
    const b = e.brain, camp = b.camp;
    if (camp === null) return;
    this.release(b);
    camp.members.delete(e.id);
    if (camp.lighter === e.id) camp.lighter = 0;
    if (camp.members.size === 0) this.camps.splice(this.camps.indexOf(camp), 1);
    b.camp = null;
  },
};
```

- [ ] **Step 5: Hook humans in**

`src/sim/creatures.js`: in `stepCreature` replace `this.stepAnimal(e);` with:

```js
    if (DEFS[e.kind].critter.moves === 'human') this.stepHuman(e);
    else this.stepAnimal(e);
```

In `forgetCreature`, as its first line:

```js
    if (e.brain !== null) this.leaveCamp(e); // humans.js
```

`src/sim/world.js`: `import { Humans } from './humans.js';` and add `Humans` to the mixin list.

`test/recipes.test.js`, in `CONTACT_SETUPS`:

```js
  'CLAY+LIGHTNING': (w, box) => {
    fillRect(w, box.x0, box.y1 - 5, box.x1, box.y1, ID.CLAY);
    w.spawn(box.y0 * w.w + 25, ID.LIGHTNING);
  },
```

- [ ] **Step 6: Run the tests**

Run: `NODE --test test/humans.test.js test/creatures.test.js < /dev/null` — Expected: PASS.

Then `NODE --test test/*.test.js < /dev/null` — Expected: PASS (the recipe tests now include Clay + Lightning → Human and Human + Time → Bone/Meat; the tree and hard-mode tests include the new element).

- [ ] **Step 7: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Humans: a 3 x 6 body from Clay + Lightning that walks, swims, holds its breath and runs from danger

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Camps and campfires

**Files:**
- Modify: `src/sim/humans.js` (camps, pile, fuel, `chooseWork`, `act`)
- Test: `test/humans.test.js`

**Interfaces:**
- Produces: `makeCamp(x, y, gx?, gy?) → camp` (camp: `{ x, y, gx, gy, lit, hut, hutRetry, members: Set, claims: Set, lighter }`), `joinOrMakeCamp(e)`, `campSpot(x, y, gx, gy) → bool`, `campCell(camp, u, v) → index | -1`, `inPile(camp, x, y)`, `pileCount(camp, set)`, `pileSpace(camp) → index | -1`, `findWanted(e, camp, set, radius) → index | -1`, `openAt(x, y)`, `nearGround(x, y, gx, gy)`, `isBanned(b, i)`, `fetch(e, b)`, `carryToPile(e, b)`, `lightFire(e, b)`, `lightPile(camp) → bool`, `restByFire(e, b)`, `besideCamp(e, camp, u) → index`, `hutWork(e, b, camp) → bool` (returns false until Task 7). Constants `CAMP_JOIN = 60, FUEL_R = 60, PILE_LIGHT = 6, PILE_LOW = 4, RUB_FOR = 180, LIGHT_U = 4, REST_U = 5, REACH = 3`; sets `FUEL`, `FIRE_SET`.

- [ ] **Step 1: Write the failing tests**

Append to `test/humans.test.js`:

```js
test('a human gathers wood into a pile beside its camp and lights it', () => {
  const w = makeWorld(140, 50);
  fillRect(w, 0, 45, 139, 49, ID.STONE);
  fillRect(w, 30, 42, 37, 44, ID.WOOD);
  const e = human(w, 70, 38);
  let frames = 0;
  while (!w.camps[0]?.lit && frames < 8000) { w.step(); frames++; }
  assert.ok(w.camps[0]?.lit, `the fire was lit (${frames} frames, job ${e.brain?.job})`);
  assert.ok(alive(w, e) && e.lost === 0, 'and the human is fine');
  assert.ok(w.camps[0].members.has(e.id));
  assert.ok(countOf(w, ID.WOOD) < 24, 'wood was taken from the log');
});

test('humans near each other share one camp', () => {
  const w = makeWorld(120, 40);
  fillRect(w, 0, 35, 119, 39, ID.STONE);
  w.spawn(30 * 120 + 50, ID.HUMAN);
  w.spawn(30 * 120 + 62, ID.HUMAN);
  run(w, 100);
  const people = w.creatures.filter((c) => c.kind === ID.HUMAN);
  assert.equal(people.length, 2);
  assert.equal(w.camps.length, 1);
  assert.ok(people.every((p) => p.brain.camp === w.camps[0]));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `NODE --test test/humans.test.js < /dev/null`
Expected: FAIL (no camps are made).

- [ ] **Step 3: Add camps and the campfire to `src/sim/humans.js`**

Constants, after `DANGER`:

```js
const CAMP_JOIN = 60; // it joins a camp this close
const FUEL_R = 60; // and fetches fuel this far from it
const PILE_LIGHT = 6; // fuel in the pile before it's lit
const PILE_LOW = 4; // a burning pile with less is topped up
const RUB_FOR = 180; // steps rubbing sticks before the pile catches
const LIGHT_U = 4; // where it kneels to light the pile (across from its middle)
const REST_U = 5; // and sits by it
const REACH = 3; // how far across it reaches to pick something up
const FUEL = setOf(['WOOD', 'COAL', 'PEAT', 'SAWDUST']);
const FIRE_SET = setOf(['FIRE']);
```

Methods (add to `Humans`):

```js
  makeCamp(x, y, gx = this.gravity.downX, gy = this.gravity.downY) {
    const camp = {
      x, y, gx, gy, // the pile's middle (on the ground), and the way down there
      lit: false, // its fire has been lit (it may have burned out since)
      hut: null, hutRetry: 0, // the hut's blueprint (Task 7)
      members: new Set(), // the humans' ids
      claims: new Set(), // cells someone is on their way to fetch
      lighter: 0, // who is lighting the fire
    };
    this.camps.push(camp);
    return camp;
  },

  // The camp within CAMP_JOIN, or a new one on flat dry ground a few cells
  // beside e. null if there's nowhere for one.
  joinOrMakeCamp(e) {
    let camp = this.camps.find((c) => Math.max(Math.abs(c.x - e.x), Math.abs(c.y - e.y)) <= CAMP_JOIN) ?? null;
    if (camp === null) {
      for (const u of [3, -3, 4, -4, 5, -5, 6, -6]) {
        const x = e.x + u * e.gy, y = e.y - u * e.gx;
        if (this.campSpot(x, y, e.gx, e.gy)) {
          camp = this.makeCamp(x, y, e.gx, e.gy);
          break;
        }
      }
    }
    if (camp !== null) camp.members.add(e.id);
    return camp;
  },

  // Flat dry ground for a pile at (x, y): it and the cells either side
  // empty with solid ground (or powder) under them, and no liquid beside.
  campSpot(x, y, gx, gy) {
    for (let u = -1; u <= 1; u++) {
      const cx = x + u * gy, cy = y - u * gx;
      if (!this.inBounds(cx, cy) || !this.inBounds(cx + gx, cy + gy)) return false;
      if (this.type[cy * this.w + cx] !== 0) return false;
      const g = this.type[(cy + gy) * this.w + cx + gx], s = DEFS[g].state;
      if (g === 0 || SHAPED[g] || (s !== SOLID && s !== POWDER)) return false;
      for (const [dx, dy] of [[gy, -gx], [-gy, gx], [-gx, -gy]]) {
        if (this.inBounds(cx + dx, cy + dy) && DEFS[this.type[(cy + dy) * this.w + cx + dx]].state === LIQUID) return false;
      }
    }
    return true;
  },

  // The cell u across and v down from the camp's spot, in its frame; -1
  // outside the world.
  campCell(camp, u, v) {
    const x = camp.x + u * camp.gy + v * camp.gx, y = camp.y - u * camp.gx + v * camp.gy;
    return this.inBounds(x, y) ? y * this.w + x : -1;
  },

  // The pile and the flames over it.
  inPile(camp, x, y) {
    const u = (x - camp.x) * camp.gy - (y - camp.y) * camp.gx;
    const v = (x - camp.x) * camp.gx + (y - camp.y) * camp.gy;
    return u >= -2 && u <= 2 && v >= -4 && v <= 0;
  },

  pileCount(camp, set) {
    let n = 0;
    for (let v = -4; v <= 0; v++) {
      for (let u = -2; u <= 2; u++) {
        const c = this.campCell(camp, u, v);
        if (c >= 0 && set[this.type[c]]) n++;
      }
    }
    return n;
  },

  // Where the next piece of fuel goes: the lowest empty cell of the pile.
  pileSpace(camp) {
    for (let v = 0; v >= -2; v--) {
      for (const u of [0, -1, 1]) {
        const c = this.campCell(camp, u, v);
        if (c >= 0 && this.type[c] === 0) return c;
      }
    }
    return -1;
  },

  // The nearest cell to e within `radius` of the camp holding something in
  // `set`, open to the air, within reach of ground a human stands on, and
  // not in the pile or the hut, nor claimed or given up on. -1 if none.
  findWanted(e, camp, set, radius) {
    const { w, h, type } = this;
    const b = e.brain, hut = camp.hut;
    let best = -1, bd = Infinity;
    for (let y = Math.max(0, camp.y - radius); y <= Math.min(h - 1, camp.y + radius); y++) {
      for (let x = Math.max(0, camp.x - radius); x <= Math.min(w - 1, camp.x + radius); x++) {
        const i = y * w + x;
        if (!set[type[i]]) continue;
        const d = Math.abs(x - e.x) + Math.abs(y - e.y);
        if (d >= bd || camp.claims.has(i) || this.isBanned(b, i) || this.inPile(camp, x, y)) continue;
        if (hut !== null && hut.set.has(i)) continue;
        if (!this.openAt(x, y) || !this.nearGround(x, y, e.gx, e.gy)) continue;
        best = i;
        bd = d;
      }
    }
    return best;
  },

  openAt(x, y) {
    const { w, h, type } = this;
    const i = y * w + x;
    return (x + 1 < w && type[i + 1] === 0) || (x > 0 && type[i - 1] === 0)
      || (y + 1 < h && type[i + w] === 0) || (y > 0 && type[i - w] === 0);
  },

  // Is there a place within 3 cells of (x, y) a human could stand: empty,
  // with solid ground or powder under it?
  nearGround(x, y, gx, gy) {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!this.inBounds(nx, ny) || !this.inBounds(nx + gx, ny + gy)) continue;
        if (this.type[ny * this.w + nx] !== 0) continue;
        const g = this.type[(ny + gy) * this.w + nx + gx], s = DEFS[g].state;
        if (g !== 0 && (s === SOLID || s === POWDER)) return true;
      }
    }
    return false;
  },

  isBanned(b, i) {
    const t = b.banned.get(i);
    return t !== undefined && t > this.tick;
  },

  // The cell `u` across from the camp's spot on the side e is on.
  besideCamp(e, camp, u) {
    const side = (e.x - camp.x) * camp.gy - (e.y - camp.y) * camp.gx >= 0 ? 1 : -1;
    return this.campCell(camp, side * u, 0);
  },
```

Replace `chooseWork` and `act`:

```js
  // Its camp's needs, in order: light a pile that's ready, keep the pile
  // fed, build the hut, then rest by the fire (or wander, before it's lit).
  // A job under way carries on.
  chooseWork(e, b) {
    if (b.camp === null) b.camp = this.joinOrMakeCamp(e);
    const camp = b.camp;
    if (camp === null) {
      b.job = 'wandering';
      return;
    }
    if (b.carry !== 0) {
      b.job = b.carryJob;
      return;
    }
    if ((b.job === 'gathering wood' && b.target >= 0 && FUEL[this.type[b.target]])
      || (b.job === 'fetching stone' && b.target >= 0 && SHAPED[this.type[b.target]] === 0 && this.type[b.target] !== 0)
      || (b.job === 'lighting the fire' && camp.lighter === e.id)) return;
    this.release(b);
    const fuel = this.pileCount(camp, FUEL), burning = this.pileCount(camp, FIRE_SET) > 0;
    if (burning) camp.lit = true;
    if (camp.lighter !== 0 && this.creatureById[camp.lighter]?.brain?.job !== 'lighting the fire') camp.lighter = 0;
    if (!burning && fuel >= PILE_LIGHT && camp.lighter === 0) {
      camp.lighter = e.id;
      b.rub = 0;
      b.job = 'lighting the fire';
      return;
    }
    if (fuel < (burning ? PILE_LOW : PILE_LIGHT)) {
      const t = this.findWanted(e, camp, FUEL, FUEL_R);
      if (t >= 0) {
        this.claim(b, camp, t);
        b.job = 'gathering wood';
        return;
      }
    }
    if (this.hutWork(e, b, camp)) return;
    b.job = camp.lit ? 'resting by the fire' : 'wandering';
  },

  // The hut (Task 7).
  hutWork(e, b, camp) {
    return false;
  },

  act(e, b) {
    switch (b.job) {
      case 'fleeing':
        if (++b.pace >= RUN_EVERY) {
          b.pace = 0;
          this.stepAcross(e, b.fleeDir, CLIMB, true);
        }
        break;
      case 'gathering wood':
      case 'fetching stone': this.fetch(e, b); break;
      case 'carrying wood': this.carryToPile(e, b); break;
      case 'lighting the fire': this.lightFire(e, b); break;
      case 'resting by the fire': this.restByFire(e, b); break;
      default: this.wander(e, b);
    }
  },

  // Walk to the target and pick it up.
  fetch(e, b) {
    const t = b.target;
    if (t < 0 || this.type[t] === 0 || SHAPED[this.type[t]]) {
      this.release(b);
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    if (!this.walkTo(e, b, t % this.w, (t / this.w) | 0, REACH, WALK_EVERY)) return;
    b.carry = this.type[t];
    b.carryJob = b.job === 'gathering wood' ? 'carrying wood' : 'building the hut';
    b.job = b.carryJob;
    this.clearCell(t);
    this.release(b);
  },

  // Take the fuel to the camp and put it on the pile (or wait by a full one).
  carryToPile(e, b) {
    const camp = b.camp;
    if (camp === null) {
      b.think = 0;
      return;
    }
    if (!this.walkTo(e, b, camp.x, camp.y, REACH, WALK_EVERY)) return;
    const c = this.pileSpace(camp);
    if (c < 0) {
      this.pose(e, FRAME_SIT);
      return;
    }
    this.spawn(c, b.carry);
    b.carry = 0;
    b.job = 'wandering';
    b.think = 0;
  },

  // Kneel beside the pile and rub sticks; after RUB_FOR steps it catches.
  lightFire(e, b) {
    const camp = b.camp, s = this.besideCamp(e, camp, LIGHT_U);
    if (s < 0 || !this.walkTo(e, b, s % this.w, (s / this.w) | 0, 0, WALK_EVERY)) return;
    this.pose(e, FRAME_KNEEL);
    if (++b.rub < RUB_FOR) return;
    b.rub = 0;
    if (this.lightPile(camp)) camp.lit = true;
    camp.lighter = 0;
    b.job = 'wandering';
    b.think = 0;
  },

  lightPile(camp) {
    for (let v = 0; v >= -2; v--) {
      for (let u = -1; u <= 1; u++) {
        const c = this.campCell(camp, u, v);
        if (c >= 0 && FUEL[this.type[c]] && this.ignite(c, c % this.w, (c / this.w) | 0)) return true;
      }
    }
    return false;
  },

  // Sit a couple of cells from the fire.
  restByFire(e, b) {
    const s = this.besideCamp(e, b.camp, REST_U);
    if (s >= 0 && this.walkTo(e, b, s % this.w, (s / this.w) | 0, 1, WALK_EVERY)) this.pose(e, FRAME_SIT);
  },
```

- [ ] **Step 4: Run the tests**

Run: `NODE --test test/humans.test.js < /dev/null` — Expected: PASS.

If the fire test fails, print `e.brain.job`, `e.x`, and `w.pileCount(w.camps[0], ...)` every 200 frames to see where it stalls (a target it can't reach should be given up after 300 steps; a pile spot it can't stand beside means `campSpot` chose badly). Fix the cause; don't lengthen the test.

Then `NODE --test test/*.test.js < /dev/null` — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Humans make a camp, gather wood into a pile and light it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The hut, and sheltering in it

**Files:**
- Modify: `src/sim/humans.js` (`hutWork`, blueprint, building, shelter; `chooseWork`, `act`)
- Test: `test/humans.test.js`

**Interfaces:**
- Produces: `planHut(camp) → hut | null` (hut: `{ cells: index[], us: number[], set: Set, u0, floor, side, done }`), `hutAt(camp, u0, side)`, `groundAt(camp, u) → v | null`, `nextHutCell(hut) → k | -1`, `builtAt(c) → bool`, `build(e, b)`, `dropCarry(e, b)`, `shouldShelter(e, camp) → bool`, `precipitation(e) → bool`, `shelter(e, b)`. Constants `HUT_W = 9, HUT_WALL = 8, DOOR = 6, HUT_GAP = 4, STONE_R = 80, COLD_AIR = 10, RAIN_R = 20` (export `HUT_W`, `HUT_WALL`, `DOOR`).

- [ ] **Step 1: Write the failing tests**

Append to `test/humans.test.js`:

```js
import { HUT_W, DOOR } from '../src/sim/humans.js';

test('humans build a hut beside their fire, with its door towards the fire', () => {
  const w = makeWorld(100, 36);
  fillRect(w, 0, 31, 99, 35, ID.DIRT);
  fillRect(w, 10, 28, 17, 30, ID.WOOD);
  fillRect(w, 78, 23, 85, 30, ID.STONE);
  w.spawn(25 * 100 + 45, ID.HUMAN);
  w.spawn(25 * 100 + 55, ID.HUMAN);
  let frames = 0;
  while (!w.camps[0]?.hut?.done && frames < 20000) { w.step(); frames++; }
  const camp = w.camps[0];
  assert.ok(camp?.hut?.done, `the hut was finished (${frames} frames)`);
  for (const c of camp.hut.cells) assert.ok(w.builtAt(c), 'every blueprint cell is built');
  const doorU = camp.hut.side > 0 ? camp.hut.u0 : camp.hut.u0 + HUT_W - 1;
  for (let v = camp.hut.floor; v > camp.hut.floor - DOOR; v--) {
    assert.ok(!w.builtAt(w.campCell(camp, doorU, v)), 'the doorway is open');
  }
});

test('a human shelters in its hut while snow falls', () => {
  const w = makeWorld(100, 40);
  fillRect(w, 0, 35, 99, 39, ID.STONE);
  const camp = w.makeCamp(46, 34);
  camp.lit = true;
  camp.hut = w.planHut(camp);
  for (const c of camp.hut.cells) w.spawn(c, ID.BRICK);
  camp.hut.done = true;
  const e = human(w, 40, 30);
  assert.equal(e.brain?.camp ?? w.camps[0], camp);
  let sheltered = false;
  run(w, 800, (f) => {
    if (f % 10 === 0) for (let x = 20; x < 80; x += 3) if (w.type[2 * 100 + x] === 0) w.spawn(2 * 100 + x, ID.SNOW);
    if (e.brain?.job === 'sheltering') sheltered = true;
  });
  assert.ok(sheltered, 'it went to shelter');
  const u = (e.x - camp.x) * camp.gy - (e.y - camp.y) * camp.gx;
  assert.ok(u > camp.hut.u0 && u < camp.hut.u0 + HUT_W - 1, `inside (u ${u}, hut from ${camp.hut.u0})`);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `NODE --test test/humans.test.js < /dev/null`
Expected: FAIL (`w.planHut is not a function`).

- [ ] **Step 3: Add the hut to `src/sim/humans.js`**

Constants:

```js
export const HUT_W = 9; // the hut's width
export const HUT_WALL = 8; // its walls' height
export const DOOR = 6; // the doorway's height
const HUT_GAP = 4; // the least space between the hut and the pile
const STONE_R = 80; // how far from the camp it fetches building material
const COLD_AIR = 10; // °C: air this cold sends it to shelter
const RAIN_R = 20; // as does rain, snow or hail falling this close
const MATERIAL = setOf(['STONE', 'BRICK', 'GRANITE', 'CONCRETE']);
const WOOD_ONLY = setOf(['WOOD']);
```

Replace `hutWork` and add:

```js
  // Once the camp's fire has been lit, a hut beside it: fetch material for
  // it. True if that gave e a job.
  hutWork(e, b, camp) {
    if (!camp.lit) return false;
    if (camp.hut === null) {
      if (this.tick < camp.hutRetry) return false;
      camp.hut = this.planHut(camp);
      if (camp.hut === null) {
        camp.hutRetry = this.tick + 600;
        return false;
      }
    }
    const hut = camp.hut;
    if (hut.done) return false;
    if (this.nextHutCell(hut) < 0) {
      hut.done = true;
      return false;
    }
    let t = this.findWanted(e, camp, MATERIAL, STONE_R);
    if (t < 0) t = this.findWanted(e, camp, WOOD_ONLY, STONE_R);
    if (t < 0) return false;
    this.claim(b, camp, t);
    b.job = 'fetching stone';
    return true;
  },

  // A site for the hut: HUT_W columns side by side, at least HUT_GAP cells
  // past the pile, on ground within a cell of flat, with room for it.
  planHut(camp) {
    for (let off = 3 + HUT_GAP; off <= 24; off++) {
      for (const side of [1, -1]) {
        const plan = this.hutAt(camp, side > 0 ? off : -off - (HUT_W - 1), side);
        if (plan !== null) return plan;
      }
    }
    return null;
  },

  // The blueprint for a hut over columns u0 .. u0 + HUT_W - 1 (side: which
  // side of the pile it's on), or null. In build order: the far wall bottom
  // up, the two cells over the doorway (the wall facing the fire), then the
  // roof from the far wall across.
  hutAt(camp, u0, side) {
    let top = Infinity, bottom = -Infinity;
    for (let u = u0; u < u0 + HUT_W; u++) {
      const g = this.groundAt(camp, u);
      if (g === null) return null;
      top = Math.min(top, g);
      bottom = Math.max(bottom, g);
    }
    if (bottom - top > 1) return null;
    const floor = top - 1; // the row it stands in
    for (let v = floor; v >= floor - HUT_WALL; v--) {
      for (let u = u0; u < u0 + HUT_W; u++) {
        const c = this.campCell(camp, u, v);
        if (c < 0 || this.builtAt(c)) return null;
      }
    }
    const farU = side > 0 ? u0 + HUT_W - 1 : u0, doorU = side > 0 ? u0 : u0 + HUT_W - 1;
    const order = [];
    for (let v = floor; v > floor - HUT_WALL; v--) order.push([farU, v]);
    for (let v = floor - DOOR; v > floor - HUT_WALL; v--) order.push([doorU, v]);
    for (let k = 0; k < HUT_W; k++) order.push([farU - side * k, floor - HUT_WALL]);
    const cells = order.map(([u, v]) => this.campCell(camp, u, v));
    return { cells, us: order.map(([u]) => u), set: new Set(cells), u0, floor, side, done: false };
  },

  // The ground in column u near the camp: the topmost solid (or powder)
  // cell with open space above it, from 8 cells above the camp's spot to 8
  // below. Its v, or null.
  groundAt(camp, u) {
    for (let v = -8; v <= 8; v++) {
      const c = this.campCell(camp, u, v), a = this.campCell(camp, u, v - 1);
      if (c < 0 || a < 0) continue;
      if (this.builtAt(c) && !this.builtAt(a)) return v;
    }
    return null;
  },

  // Is cell c solid (or powder), and not a creature?
  builtAt(c) {
    const t = this.type[c];
    if (t === 0 || SHAPED[t]) return false;
    const s = DEFS[t].state;
    return s === SOLID || s === POWDER;
  },

  nextHutCell(hut) {
    for (let k = 0; k < hut.cells.length; k++) if (!this.builtAt(hut.cells[k])) return k;
    return -1;
  },

  // Carry the material to the hut and put it in the lowest unfinished
  // cell, standing inside where it can reach.
  build(e, b) {
    const camp = b.camp, hut = camp === null ? null : camp.hut;
    if (hut === null) {
      this.dropCarry(e, b);
      return;
    }
    const k = this.nextHutCell(hut);
    if (k < 0) {
      hut.done = true;
      this.dropCarry(e, b);
      return;
    }
    const u = Math.min(hut.u0 + HUT_W - 3, Math.max(hut.u0 + 2, hut.us[k]));
    const s = this.campCell(camp, u, hut.floor);
    if (s < 0 || !this.walkTo(e, b, s % this.w, (s / this.w) | 0, 0, WALK_EVERY)) return;
    this.pose(e, 0);
    const c = hut.cells[k], t = this.type[c];
    if (t !== 0 && (SHAPED[t] || DEFS[t].state === LIQUID)) return; // wait for it to move
    if (t !== 0) this.clearCell(c);
    this.spawn(c, b.carry);
    b.carry = 0;
    b.job = 'wandering';
    b.think = 0;
  },

  // Put down what it's carrying beside its feet.
  dropCarry(e, b) {
    if (this.spawnNear(e.x, e.y, b.carry) >= 0) b.carry = 0;
    b.job = 'wandering';
    b.think = 0;
  },

  // A finished hut to go to, and cold air or rain, snow or hail falling nearby.
  shouldShelter(e, camp) {
    if (camp.hut === null || !camp.hut.done) return false;
    if (this.air.heat && this.air.t[this.air.at(e.x, e.y)] < COLD_AIR) return true;
    return this.precipitation(e);
  },

  // Water, snow or hail falling (nothing under it) within RAIN_R above it.
  precipitation(e) {
    const { w, type } = this;
    for (let v = -RAIN_R; v < 0; v++) {
      for (let u = -RAIN_R; u <= RAIN_R; u++) {
        const x = e.x + u * e.gy + v * e.gx, y = e.y - u * e.gx + v * e.gy;
        if (!this.inBounds(x, y) || !this.inBounds(x + e.gx, y + e.gy)) continue;
        const t = type[y * w + x];
        if ((t === ID.WATER || t === ID.SNOW || t === ID.HAIL) && type[(y + e.gy) * w + x + e.gx] === 0) return true;
      }
    }
    return false;
  },

  // Go into the hut and sit in the middle.
  shelter(e, b) {
    const camp = b.camp, hut = camp.hut;
    const s = this.campCell(camp, hut.u0 + (HUT_W >> 1), hut.floor);
    if (s >= 0 && this.walkTo(e, b, s % this.w, (s / this.w) | 0, 1, WALK_EVERY)) this.pose(e, FRAME_SIT);
  },
```

In `chooseWork`, right after `if (camp === null) { ... }`:

```js
    if (this.shouldShelter(e, camp)) {
      b.job = 'sheltering';
      return;
    }
```

In `act`, add the cases:

```js
      case 'building the hut': this.build(e, b); break;
      case 'sheltering': this.shelter(e, b); break;
```

- [ ] **Step 4: Run the tests**

Run: `NODE --test test/humans.test.js < /dev/null` — Expected: PASS. If the hut test is slow (over ~10 s) or stalls, print `job`, `carry` and `nextHutCell` every 500 frames to find the step that stalls, and fix it.

Then `NODE --test test/*.test.js < /dev/null` — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Humans build a hut beside their fire and shelter in it from cold, rain and snow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The carried pixel, the inspect line, docs and build

**Files:**
- Modify: `src/render/renderer.js` (`paintOverlays`)
- Modify: `src/sim/creatures.js` (`creatureAt`)
- Modify: `src/game/cell-notes.js`
- Modify: `README.md`, `HANDOFF.md`; rebuild `dist/`
- Test: `test/creatures.test.js`

**Interfaces:**
- Produces: `creatureAt(i) → entity | null`.

- [ ] **Step 1: Write the failing test**

Append to `test/creatures.test.js`:

```js
import { cellNotes } from '../src/game/cell-notes.js';

test('the inspect line shows a creature\'s health, and a human\'s job', () => {
  const w = floored();
  w.spawn(27 * 40 + 10, ID.SNAIL);
  w.spawn(20 * 40 + 30, ID.HUMAN);
  run(w, 30);
  const snail = only(w, ID.SNAIL), person = only(w, ID.HUMAN);
  w.clearCell(snail.cells[0]);
  w.step();
  assert.ok(cellNotes(w, snail.cells.find((c) => c >= 0)).includes('health 4 of 5'));
  const notes = cellNotes(w, person.cells.find((c) => c >= 0));
  assert.ok(notes.includes('health 10 of 10'));
  assert.ok(notes.includes(person.brain.job), notes.join(' · '));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `NODE --test test/creatures.test.js < /dev/null` — FAIL (no health note).

- [ ] **Step 3: Implement**

`src/sim/creatures.js`, add to `Creatures`:

```js
  // The creature cell i belongs to, or null.
  creatureAt(i) {
    const t = this.type[i];
    if (!SHAPED[t] || this.ctype[i] === 0) return null;
    const e = this.creatureById[this.ctype[i]];
    return e && e.kind === t ? e : null;
  },
```

`src/game/cell-notes.js`, before `return notes;` (and update the header comment to mention creatures):

```js
  const e = world.creatureAt(i);
  if (e) {
    notes.push(`health ${e.n - e.lost} of ${e.n}`);
    if (e.brain) notes.push(e.brain.job);
  }
```

`src/render/renderer.js`, at the end of `paintOverlays`:

```js
    // What a human carries: one pixel above its hands, on the side it faces.
    for (const e of world.creatures) {
      const b = e.brain;
      if (b === null || b.carry === 0) continue;
      const up = e.frame >= 2 ? 4 : 5;
      const x = e.x + e.facing * e.gy - up * e.gx, y = e.y - e.facing * e.gx - up * e.gy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const q = b.carry * SHADES * 3;
      pixels[y * w + x] = pack(this.palRGB[q], this.palRGB[q + 1], this.palRGB[q + 2]);
    }
```

- [ ] **Step 4: Docs**

`README.md`: in the elements/creatures part, describe (in the README's own voice):
- the bigger creatures have bodies of several pixels and simple animation (list them with sizes); tiny ones are still single pixels;
- painting places them a body apart; a creature grows outward from where it starts; damage is per pixel (fire, acid, the eraser, heat over 60 °C or cold under −15 °C, drowning, being out of water for fish) with the body showing the gaps; half its pixels gone kills it, leaving its remains (ash if it burned); it heals a pixel every 2.5 seconds while nothing hurts it; creatures live three times as long as before;
- conveyors carry them whole, portals take them through whole, blasts hurt and throw them, pistons stall against them, doors wait for them;
- humans: Clay + Lightning; what they do (camp, wood pile, rubbing sticks, campfire, resting, hut of stone with a door facing the fire, sheltering from cold, rain and snow, running from lava, fire, acid and blasts, swimming to shore, drowning after about 10 seconds under); several humans share a camp; the inspect line shows health and what a human is doing.
- Update the test summary paragraph (new creature and human tests) and the test count.

`HANDOFF.md`: a **Shaped creatures** entry under the simulation notes:
- `shapes.js` compiles `shape` (frames, palette letters, `pulse`); `creatures.js` keeps entities in `world.creatures` / `creatureById`; body cells are real cells with `ctype` = id and `shade` = palette slot; `stepCreatures` runs after the particle pass (and fast passes), before heat and air.
- **The entity contract**: anything new that moves or rewrites cells on its own must skip shaped body cells (`SHAPED[t]`) or move the whole entity (see `nudgeCreature`, `portalCreature`, `blastCreatures`, `shove`, `shutDoor`); anything that changes a body cell is seen as damage on the creature's next step, and a cell converted into another shaped creature turns the whole creature into it.
- Seeds (`ctype` 0) hatch in `updateBody`; `initLife` gives shaped cells no life (the entity keeps `age`/`lifespan`).
- `humans.js`: the brain, job names, camps (`world.camps`), the camp frame (`campCell`), the pile, the hut blueprint; the danger list; `NEWBORN_GRACE` and `keepWarm` (and why).
- Creatures treat every world edge as solid (loops and voids aren't crossed).
- Update the test count line.

- [ ] **Step 5: Build, run everything**

Run: `ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" scripts/build.js < /dev/null`
Expected: `Built dist\sandbox-crafter.html from 38 modules (...)`.

Run: `NODE --test test/*.test.js < /dev/null` — Expected: all PASS.

- [ ] **Step 6: Check it in the browser**

Start the preview (`preview_start`), paint fish into water, birds into the sky, a few humans on the ground with a log of Wood and a block of Stone nearby. Check: bodies are drawn in their colours, wings flap, humans carry wood (the pixel above their hands), light the pile, build the hut; the inspect line shows health and job. Remove any debugging code before committing.

- [ ] **Step 7: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Creatures: carried items, health and jobs in the inspect line, docs and build

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-review notes

- Spec §1 (entities, shapes, body cells, creature step, moving, birth, other systems, death): Tasks 1, 2, 4. §2 (animals): Tasks 2–3. §3 (humans: body, recipe, moving, brain, several humans, hover): Tasks 5–8. §4 (renderer, sleep, performance, worker, content): Tasks 2, 8; sleeping needs no change (a body cell's `body` behaviour makes its chunk restless, and moving bodies wake chunks). §5 tests: spread across tasks. §6 docs: Task 8.
- Deviations from the spec, to tell the user: NEWBORN_GRACE and humans' body temperature; the Electric Eel is 6×2; a blocked ring's wait counts growing steps (so up to about 240 steps).
