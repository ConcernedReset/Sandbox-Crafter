# Human Crafting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give humans an inventory, a safe Campfire, mining with a pickaxe, gunpowder, a shotgun and armour, crafted in order once their camp is settled.

**Architecture:** Everything stays in the `Humans` mixin (`src/sim/humans.js`) on the human's brain: an item map plus tool, weapon and armour slots. A new element, Campfire (`behaviors.js` `updateCampfire`), replaces Fire in the pile. Mining reuses `walkTo`/`digToward`, now with a down staircase and a dig strength set by the tool. Shots are traced lines (`pellet`) that destroy the creature pixel they hit; tracers live in `world.shots` and are drawn by the renderer.

**Tech Stack:** Plain ES modules, `node:test`, Node via VS Code's Electron.

**Spec:** `docs/superpowers/specs/2026-10-08-human-crafting-design.md`

## Global Constraints

- **Running tests:** `ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" --test test/<file>.test.js < /dev/null` (always redirect stdin). Written below as `NODE --test ...`. Build: `NODE scripts/build.js`.
- **Code:** no new dependencies. Match the surrounding comment density and naming.
- **Inventory:** up to 10 of each element (`STACK`); one tool, one weapon, one armour.
- **Gunpowder:** 1 Coal + 1 Salt → 2 Gunpowder, inside the inventory, while gunpowder ≤ 8.
- **Campfire:**
  - holds 45 °C; burns 1,500–2,500 steps (Coal twice as long), then becomes Ash;
  - catches touching fuel with chance 0.004 per step; Water or Salt Water puts it out;
  - puffs Smoke with chance 0.003 per step; strength 0 (never dug or torn).
- **Crafting starts:** hut finished and `camp.burned` ≥ 3,000 steps of burning.
- **Crafting order:** pickaxe (3 Wood), coal and salt to 10 gunpowder, metal, gun (5 metal + 1 Wood), armour (8 metal, absorbs 10 hits). Ammunition is refilled to 10 when under 4.
- **Digging strength:** 30 by hand, 150 with the pickaxe. Metal = any solid in the `metal` or `alloy` categories.
- **Mining:** deposits within 120 cells of camp; mining carries on through the seam within 8 cells.
- **Shots:**
  - 4 pellets, spread 0.035 rad, range 48; one shot every 40 steps, costing 1 gunpowder.
  - Fight range 40. Threats: Spider, Phoenix.
  - Hunting: at most once per 2,000 steps per human, for up to 400 steps; it needs ≥ 4 gunpowder.
- **Armour:** a hit on armour is absorbed with chance 0.5 (pellets and blasts).
- **Content rule (HANDOFF):** explosives and weapons stay purely in-game. No real-world synthesis or construction details in code, hints or docs.
- **Git:** commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage with `git add -A -- . ':!.claude'`. Don't push.

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `src/sim/elements-world.js` | Campfire element |
| `src/sim/elements.js` | `human-campfire` special rule |
| `src/sim/behaviors.js` | `updateCampfire`, `kindle` |
| `src/sim/creatures.js` | `world.shots`, `stepCamps` hook, inventory drop on death, meat from gunfire, armour against blasts |
| `src/sim/humans.js` | Inventory, fire feeding, hut from stock, mining, crafting, shooting, hunting, rivals |
| `src/game/scenes.js` | Buried coal, salt and metal in the Wilderness |
| `src/game/cell-notes.js` | Inventory in the inspect line |
| `src/render/renderer.js` | Campfire flicker, held tool or gun, grey armour, tracers |
| `test/campfire.test.js`, `test/humans-inventory.test.js`, `test/humans-mining.test.js`, `test/humans-crafting.test.js`, `test/humans-guns.test.js` (new) | Tests |
| `README.md`, `HANDOFF.md`, `dist/` | Docs and build |

---

### Task 1: The Campfire

**Files:**
- Modify: `src/sim/elements-world.js` (after the `HUMAN` critter)
- Modify: `src/sim/elements.js` (`SPECIAL_RULES`)
- Modify: `src/sim/behaviors.js` (`behave`, new `updateCampfire`, `kindle`)
- Modify: `src/sim/humans.js` (`FIRE_SET`, `lightPile`, camp `burned`, `stepCamps`)
- Modify: `src/sim/creatures.js` (`initCreatures`: `shots`; `stepCreatures` calls `stepCamps`)
- Modify: `src/render/renderer.js` (Campfire drawn as fire)
- Test: `test/campfire.test.js` (create)

**Interfaces:**
- Produces:
  - `ID.CAMPFIRE`; `world.kindle(j)`.
  - `camp.burned`: steps the pile has burned.
  - `world.stepCamps()`: once per step; counts `burned` and ages `world.shots`.

- [ ] **Step 1: Write the failing tests** — create `test/campfire.test.js`:

```js
// The Campfire: the gentle fire humans light (behaviors.js, humans.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, run, countOf } from './helpers.js';

test('a campfire stays just warm and burns down to ash', () => {
  const w = makeWorld(20, 20);
  fillRect(w, 0, 15, 19, 19, ID.STONE);
  w.spawn(14 * 20 + 10, ID.CAMPFIRE);
  let hottest = 0, frames = 0;
  while (w.type[14 * 20 + 10] === ID.CAMPFIRE && frames < 4000) {
    w.step();
    hottest = Math.max(hottest, w.temp[14 * 20 + 10], w.temp[13 * 20 + 10]);
    frames++;
  }
  assert.equal(w.type[14 * 20 + 10], ID.ASH, `ash after ${frames} frames`);
  assert.ok(frames >= 1400, `it burned a good while (${frames})`);
  assert.ok(hottest <= 50, `never hot (${hottest})`);
});

test('a campfire never spreads to grass or lights anything', () => {
  const w = makeWorld(30, 20);
  fillRect(w, 0, 15, 29, 19, ID.DIRT);
  fillRect(w, 0, 14, 29, 14, ID.GRASS);
  w.clearCell(14 * 30 + 15);
  w.spawn(14 * 30 + 15, ID.CAMPFIRE);
  w.spawn(13 * 30 + 16, ID.GUNPOWDER);
  run(w, 1000);
  assert.equal(countOf(w, ID.FIRE), 0);
  assert.equal(countOf(w, ID.GRASS), 29);
  assert.equal(countOf(w, ID.GUNPOWDER), 1);
});

test('a campfire catches wood touching it, and coal burns twice as long', () => {
  const w = makeWorld(20, 20);
  fillRect(w, 0, 15, 19, 19, ID.STONE);
  w.spawn(14 * 20 + 10, ID.CAMPFIRE);
  w.spawn(14 * 20 + 11, ID.WOOD);
  run(w, 1500);
  assert.notEqual(w.type[14 * 20 + 11], ID.WOOD, 'the wood caught');
  w.spawn(14 * 20 + 3, ID.COAL);
  w.kindle(14 * 20 + 3);
  assert.equal(w.type[14 * 20 + 3], ID.CAMPFIRE);
  assert.ok(w.life[14 * 20 + 3] >= 3000, `coal burns long (${w.life[14 * 20 + 3]})`);
});

test('water puts a campfire out', () => {
  const w = makeWorld(20, 20);
  fillRect(w, 0, 15, 19, 19, ID.STONE);
  w.spawn(14 * 20 + 10, ID.CAMPFIRE);
  w.spawn(13 * 20 + 10, ID.WATER);
  run(w, 5);
  assert.equal(w.type[14 * 20 + 10], ID.ASH);
});

test('humans light their pile as a campfire, never real fire, and never run from it', () => {
  const w = makeWorld(160, 60, 3);
  fillRect(w, 0, 55, 159, 59, ID.STONE);
  fillRect(w, 30, 50, 39, 54, ID.WOOD);
  w.spawn(45 * 160 + 80, ID.HUMAN);
  let fled = false, sawFire = false, litAt = -1;
  for (let f = 0; f < 8000; f++) {
    w.step();
    const camp = w.camps[0];
    if (litAt < 0 && camp?.lit) litAt = f;
    if (litAt >= 0) {
      if (w.creatures.some((e) => e.brain?.job === 'fleeing')) fled = true;
      if (countOf(w, ID.FIRE) > 0) sawFire = true;
    }
  }
  assert.ok(litAt >= 0, 'lit');
  assert.ok(!sawFire, 'no real fire');
  assert.ok(!fled, 'nobody ran from it');
  assert.ok(w.camps[0].burned > 0, 'the camp counts its burning');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `NODE --test test/campfire.test.js`
Expected: FAIL. `ID.CAMPFIRE` is undefined, and `spawn` throws on it.

- [ ] **Step 3: Add the element and its recipe.** In `src/sim/elements-world.js`, after the `HUMAN` critter's closing `}),`:

```js
  {
    key: 'CAMPFIRE', name: 'Campfire', sym: 'Cmp', cat: 'energy', state: SOLID, strength: 0,
    colors: ['#ff8a2a', '#ffb03a', '#ff6a1a', '#ffd05a'], density: 1, temp: 45, holdTemp: true, conduct: 0.05,
    life: [1500, 2500], behavior: 'campfire', lifeEnd: { to: 'ASH' },
    desc: 'The gentle fire humans keep: it flickers and smokes a little, never spreads, and stays just warm enough to sit by. Water puts it out.',
    hint: 'Humans light it, from a pile of Wood.',
  },
```

(Check that `SOLID` is in scope in that file; the other solids there use it.)

In `src/sim/elements.js`, add to `SPECIAL_RULES`:

```js
  { id: 'human-campfire', kind: 'contact', inputs: ['HUMAN', 'WOOD'], output: 'CAMPFIRE' },
```

- [ ] **Step 4: The behaviour.** In `src/sim/behaviors.js`:
  - Add `CAMPFIRE, ASH, COAL, SALT_WATER` to the destructured `ID` names.
  - Add the constants after `SNUFF_RATE`:

```js
// The campfire humans light: it catches fuel touching it this often per
// step, and puffs smoke this often.
const CATCH = 0.004;
const SMOKE_PUFF = 0.003;
const KINDLING = new Uint8Array(NUM);
for (const k of ['WOOD', 'COAL', 'PEAT', 'SAWDUST']) KINDLING[ID[k]] = 1;
```

  - Add the `behave` case: `case 'campfire': return this.updateCampfire(i, x, y);`
  - Add the methods after `burnOut`:

```js
  // A campfire burns gently in place at its own warm temperature: it slowly
  // catches fuel touching it, puffs a little smoke, goes out in water, and
  // burns down to ash. It never lights anything else.
  updateCampfire(i, x, y) {
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const j = ny * this.w + nx, u = this.type[j];
      if (u === WATER || u === SALT_WATER) {
        this.convert(i, ASH, false, -1);
        return true;
      }
      if (KINDLING[u] && this.rand() < CATCH) this.kindle(j);
    }
    if (this.rand() < SMOKE_PUFF) {
      const ax = x - this.gravity.downX, ay = y - this.gravity.downY;
      if (ax >= 0 && ay >= 0 && ax < this.w && ay < this.h && this.type[ay * this.w + ax] === 0) {
        this.spawn(ay * this.w + ax, SMOKE);
        this.temp[ay * this.w + ax] = DEFS[CAMPFIRE].temp;
      }
    }
    return this.lifeRunsOut(i, DEFS[CAMPFIRE]);
  },

  // Fuel set alight as a campfire (by a human, or by the campfire beside
  // it): coal burns twice as long as wood.
  kindle(j) {
    const was = this.type[j];
    this.convert(j, CAMPFIRE, false, SPECIAL['human-campfire']);
    if (was === COAL) this.life[j] = Math.min(32000, this.life[j] * 2);
  },
```

- [ ] **Step 5: Humans light Campfire and count burning.** In `src/sim/humans.js`:
  - `const FIRE_SET = setOf(['FIRE', 'CAMPFIRE']);`
  - In `makeCamp`, add `burned: 0, // steps its fire has burned, in all`.
  - Replace `lightPile`'s body:

```js
  lightPile(camp) {
    for (let v = 0; v >= -2; v--) {
      for (let u = -1; u <= 1; u++) {
        const c = this.campCell(camp, u, v);
        if (c >= 0 && FUEL[this.type[c]]) {
          this.kindle(c);
          return true;
        }
      }
    }
    return false;
  },
```

  - Add after `leaveCamp`:

```js
  // Once a step: each camp counts the time its fire burns, and shot tracers
  // fade.
  stepCamps() {
    for (const camp of this.camps) if (this.pileCount(camp, FIRE_SET) > 0) camp.burned++;
    const s = this.shots;
    for (let k = s.length - 1; k >= 0; k--) if (--s[k].ttl <= 0) s.splice(k, 1);
  },
```

  In `src/sim/creatures.js`:
  - In `initCreatures`, add `world.shots = []; // pellet tracers, drawn for a few frames (humans.js)`.
  - At the top of `stepCreatures`, add `this.stepCamps();`.

- [ ] **Step 6: Draw it as fire.** In `src/render/renderer.js`, after `this.mode[ID.FIRE] = MODE.FIRE;`, add `this.mode[ID.CAMPFIRE] = MODE.FIRE;`.

- [ ] **Step 7: Run the tests**

Run: `NODE --test test/campfire.test.js test/recipes.test.js test/tree.test.js test/scenes.test.js test/humans.test.js`
Expected: PASS. If the `human-campfire` recipe lab fails to light within 4,000 frames, add a branch for it in `setUp`/`creatureLab` in `test/recipes.test.js`: fewer humans (2), and run until `w.seen[ID.CAMPFIRE]`. Don't change the rule.

- [ ] **Step 8: Run the human situations**

Run: `NODE --test test/humans-situations.test.js`
Expected: PASS. The campfire is gentler, so nothing should get worse.

- [ ] **Step 9: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Campfire: the gentle fire humans light, never hot enough to fear

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The inventory

**Files:**
- Modify: `src/sim/humans.js` (brain, `chooseWork`, `fetch`, `carryToPile`, `hutWork`, `build`; new item helpers; remove `dropCarry`/`inDoorway`)
- Modify: `src/sim/creatures.js` (`forgetCreature` drops the inventory)
- Modify: `src/render/renderer.js` (`b.held` instead of `b.carry`)
- Modify: `src/game/cell-notes.js` (inventory note)
- Test: `test/humans-inventory.test.js` (create)

**Interfaces:**
- Produces:
  - Brain fields:
    - `items` (`Map<element, count>`);
    - `tool`, `weapon` (0 or 1), `armour` (hits left, 0 = none);
    - `held` (an element id, or `HELD_PICKAXE` -1, `HELD_GUN` -2, or 0);
    - `fetchSet`, `fetchR`, `fetchSide`.
  - World methods:
    - `has(b, t)`, `holding(b, set)`, `stow(b, t)` (true if stored), `takeOut(b, t)`, `takeAny(b, set)` (returns the element or 0);
    - `mixPowder(b)`, `putDown(c, t)` (exists), `gather(e, b, camp, set, radius, job, side)`, `dropInventory(e)`.
  - Exports: `STACK`, `HELD_PICKAXE`, `HELD_GUN`, `inventoryNote(b)`.
  - Removes: `brain.carry`, `brain.carryJob`, `dropCarry`, `inDoorway`.

- [ ] **Step 1: Write the failing tests** — create `test/humans-inventory.test.js`:

```js
// Humans carry an inventory: up to 10 of each element, a tool, a weapon and
// armour (humans.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { STACK, inventoryNote, newBrain } from '../src/sim/humans.js';
import { makeWorld, fillRect, run, countOf } from './helpers.js';

test('a human holds up to 10 of each element', () => {
  const w = makeWorld(10, 10);
  const b = newBrain();
  for (let k = 0; k < 12; k++) w.stow(b, ID.WOOD);
  assert.equal(w.has(b, ID.WOOD), STACK);
  assert.equal(w.stow(b, ID.WOOD), false);
  assert.equal(w.stow(b, ID.STONE), true);
  assert.equal(w.takeAny(b, new Uint8Array(1000).fill(1)), ID.WOOD, 'the one it has most of');
  assert.equal(w.has(b, ID.WOOD), 9);
});

test('coal and salt in the inventory make gunpowder', () => {
  const w = makeWorld(10, 10);
  const b = newBrain();
  for (let k = 0; k < 5; k++) w.stow(b, ID.COAL);
  for (let k = 0; k < 3; k++) w.stow(b, ID.SALT);
  assert.equal(w.has(b, ID.GUNPOWDER), 6);
  assert.equal(w.has(b, ID.COAL), 2);
  assert.equal(w.has(b, ID.SALT), 0);
  for (let k = 0; k < 4; k++) w.stow(b, ID.SALT);
  assert.equal(w.has(b, ID.GUNPOWDER), 10, 'up to a full stack');
  assert.equal(w.has(b, ID.SALT), 2, 'the rest kept');
});

test('a gatherer brings several pieces of wood in one trip', () => {
  const w = makeWorld(160, 60, 2);
  fillRect(w, 0, 55, 159, 59, ID.STONE);
  fillRect(w, 30, 50, 39, 54, ID.WOOD);
  w.spawn(45 * 160 + 80, ID.HUMAN);
  let most = 0;
  for (let f = 0; f < 4000 && !w.camps[0]?.lit; f++) {
    w.step();
    const e = w.creatures[0];
    if (e?.brain) most = Math.max(most, e.brain.items.get(ID.WOOD) ?? 0);
  }
  assert.ok(w.camps[0]?.lit, 'lit');
  assert.ok(most >= 6, `carried ${most} at once`);
});

test('a dead human drops what it carried', () => {
  const w = makeWorld(60, 40, 1);
  fillRect(w, 0, 35, 59, 39, ID.STONE);
  w.spawn(25 * 60 + 30, ID.HUMAN);
  run(w, 60);
  const e = w.creatures[0];
  for (let k = 0; k < 7; k++) w.stow(e.brain, ID.WOOD);
  const before = countOf(w, ID.WOOD);
  w.creatureDies(e);
  assert.equal(countOf(w, ID.WOOD), before + 7);
});

test('the inspect line lists the inventory', () => {
  const w = makeWorld(10, 10);
  const b = newBrain();
  w.stow(b, ID.WOOD);
  w.stow(b, ID.WOOD);
  b.tool = 1;
  assert.equal(inventoryNote(b), 'wood 2; pickaxe');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `NODE --test test/humans-inventory.test.js`
Expected: FAIL. `w.stow` is not a function, and `STACK` is undefined.

- [ ] **Step 3: Brain and helpers** in `src/sim/humans.js`.
  - Add constants:

```js
export const STACK = 10; // the most of any one element it carries
export const HELD_PICKAXE = -1, HELD_GUN = -2; // what it shows in its hand, besides a pixel
const FEED = setOf(['WOOD', 'PEAT', 'SAWDUST']); // fuel it feeds the fire before coal
```

  - Change the import line to `import { DEFS, ID, NUM, State } from './elements.js';` (unchanged), and add `const { COAL, SALT, GUNPOWDER, WOOD } = ID;`.
  - In `newBrain`, replace the `carry` and `carryJob` lines with:

```js
    items: new Map(), // element -> how many it carries (up to STACK)
    tool: 0, weapon: 0, // a pickaxe, a gun (1 if it has one)
    armour: 0, // hits its armour can still take (0: none)
    held: 0, // what it shows in its hand: an element, HELD_PICKAXE or HELD_GUN
    fetchSet: null, fetchR: 0, fetchSide: false, // what it's fetching, and where from
```

  - Add the inventory methods to `Humans`, after `putDown`:

```js
  has(b, t) {
    return b.items.get(t) ?? 0;
  },

  // How many it carries of everything in `set`.
  holding(b, set) {
    let n = 0;
    for (const [t, k] of b.items) if (set[t]) n += k;
    return n;
  },

  // Put one t in its inventory, if it has room: true if it did.
  stow(b, t) {
    const k = this.has(b, t);
    if (k >= STACK) return false;
    b.items.set(t, k + 1);
    b.held = t;
    this.mixPowder(b);
    return true;
  },

  takeOut(b, t) {
    const k = this.has(b, t);
    if (k === 0) return false;
    if (k === 1) b.items.delete(t);
    else b.items.set(t, k - 1);
    return true;
  },

  // Take out one of whatever in `set` it has most of: that element, or 0.
  takeAny(b, set) {
    let best = 0, most = 0;
    for (const [t, k] of b.items) if (set[t] && k > most) { best = t; most = k; }
    if (best !== 0) this.takeOut(b, best);
    return best;
  },

  // Coal and Salt carried together make Gunpowder (the game's own Coal +
  // Salt reaction), two at a time, up to a full stack.
  mixPowder(b) {
    while (this.has(b, COAL) > 0 && this.has(b, SALT) > 0 && this.has(b, GUNPOWDER) <= STACK - 2) {
      this.takeOut(b, COAL);
      this.takeOut(b, SALT);
      b.items.set(GUNPOWDER, this.has(b, GUNPOWDER) + 2);
    }
  },

  // Set off to fetch the nearest thing in `set` (within `radius` of the camp,
  // open to one side if `side`): true if there was one.
  gather(e, b, camp, set, radius, job, side = false) {
    const t = this.findWanted(e, camp, set, radius, side);
    if (t < 0) return false;
    this.claim(b, camp, t);
    b.fetchSet = set;
    b.fetchR = radius;
    b.fetchSide = side;
    b.job = job;
    return true;
  },

  // A human that dies drops the pixels it carried round where it lay; its
  // tool, weapon and armour are lost.
  dropInventory(e) {
    const b = e.brain;
    for (const [t, k] of b.items) {
      for (let n = 0; n < k; n++) {
        const c = this.freeSpaceNear(e.y * this.w + e.x);
        if (c >= 0) this.spawn(c, t);
      }
    }
    b.items.clear();
  },
```

  - Export the note function after `newBrain`:

```js
// What a human carries, for the inspect line: "wood 7, coal 3; pickaxe, gun".
export function inventoryNote(b) {
  const items = [...b.items].map(([t, k]) => `${DEFS[t].name.toLowerCase()} ${k}`).join(', ');
  const gear = [b.tool && 'pickaxe', b.weapon && 'gun', b.armour > 0 && 'armour'].filter(Boolean).join(', ');
  return [items, gear].filter(Boolean).join('; ');
}
```

- [ ] **Step 4: Fetching fills its hands.** Replace `fetch`:

```js
  // Walk to the target and pick it up; then the nearest more of the same,
  // until its hands are full or there's no more.
  fetch(e, b) {
    const t = b.target;
    if (t < 0 || !b.fetchSet[this.type[t]]) {
      this.release(b);
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    if (!this.walkTo(e, b, t % this.w, (t / this.w) | 0, REACH, WALK_EVERY)) return;
    const u = this.type[t];
    this.release(b);
    if (this.stow(b, u)) {
      this.clearCell(t);
      if (this.holding(b, b.fetchSet) < STACK && this.gather(e, b, b.camp, b.fetchSet, b.fetchR, b.job, b.fetchSide)) return;
    }
    b.job = 'wandering';
    b.think = 0;
  },
```

- [ ] **Step 5: The fire and the hut from its stock.** Replace `carryToPile`:

```js
  // Take fuel to the camp and put it on the pile, a piece a step: up to what
  // lighting needs, or until a burning fire has enough (coal last; the rest
  // it keeps).
  carryToPile(e, b) {
    const camp = b.camp;
    if (camp === null) {
      b.think = 0;
      return;
    }
    if (!this.walkTo(e, b, camp.x, camp.y, REACH + 1, WALK_EVERY)) return; // not into the flames
    const want = this.pileCount(camp, FIRE_SET) > 0 ? PILE_LOW : PILE_LIGHT;
    const c = this.pileSpace(camp);
    if (c >= 0 && this.pileCount(camp, FUEL) < want) {
      const t = this.takeAny(b, FEED) || this.takeAny(b, FUEL);
      if (t !== 0) {
        this.putDown(c, t);
        return;
      }
    }
    b.job = 'wandering';
    b.think = 0;
  },
```

  In `build`:
  - Replace both `this.dropCarry(e, b);` calls with `b.job = 'wandering'; b.think = 0;` (it keeps what it carries).
  - Replace the placing lines `this.putDown(c, b.carry); b.carry = 0; b.job = 'wandering'; b.think = 0;` with:

```js
    const m = this.takeAny(b, MATERIAL) || (hut.wood && this.takeOut(b, WOOD) ? WOOD : 0);
    if (m === 0) {
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    this.putDown(c, m); // and on to the next cell, while it has more
```

  Delete `dropCarry` and `inDoorway`.

  In `hutWork`, replace everything from `// From blocks and boulders` to the end of the method with:

```js
    if (this.holding(b, MATERIAL) > 0 || (hut.wood && this.has(b, WOOD) > 0 && b.job === 'building the hut')) {
      b.job = 'building the hut';
      return true;
    }
    // From blocks and boulders, not the ground it stands on.
    if (this.gather(e, b, camp, MATERIAL, STONE_R, 'fetching stone', true)) return true;
    if (this.gather(e, b, camp, WOOD_ONLY, STONE_R, 'fetching stone', true)) {
      hut.wood = true;
      return true;
    }
    return false;
```

  In `hutAt`'s returned object, add `wood: false`. A wooden hut is built from wood fetched for it.

  In `fetch`, after the hands are full or nothing more is near, a stone fetcher must go on to build. Before the final `b.job = 'wandering';`, add:

```js
    if (b.fetchSet === MATERIAL || b.fetchSet === WOOD_ONLY && b.job === 'fetching stone') {
      b.job = 'building the hut';
      return;
    }
```

- [ ] **Step 6: `chooseWork` with stock.** Replace from `if (b.carry !== 0) {` through `this.release(b);`, and the fuel block, so the method reads:

```js
  chooseWork(e, b) {
    if (b.camp === null) b.camp = this.joinOrMakeCamp(e);
    const camp = b.camp;
    if (camp === null) {
      b.job = 'wandering';
      return;
    }
    if (this.shouldShelter(e, camp)) {
      b.job = 'sheltering';
      return;
    }
    if (this.carryingOn(e, b, camp)) return;
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
    // Everyone helps build the first pile. After that the hut comes first,
    // and then one human is enough to keep the fire going, from its stock.
    if (camp.lit && this.hutWork(e, b, camp)) return;
    if (fuel < (burning ? PILE_LOW : PILE_LIGHT) && !(camp.lit && this.tending(e, camp))) {
      if (this.holding(b, FUEL) > 0) {
        b.job = 'carrying wood';
        return;
      }
      if (this.gather(e, b, camp, FUEL, FUEL_R, 'gathering wood')) return;
    }
    b.job = camp.lit ? 'resting by the fire' : 'wandering';
  },

  // A job under way carries on: something still there to fetch, a load
  // still to deliver, the fire it's lighting.
  carryingOn(e, b, camp) {
    switch (b.job) {
      case 'gathering wood':
      case 'fetching stone': return b.target >= 0 && b.fetchSet[this.type[b.target]] === 1;
      case 'carrying wood': return this.holding(b, FUEL) > 0;
      case 'building the hut': return camp.hut !== null && !camp.hut.done
        && (this.holding(b, MATERIAL) > 0 || (camp.hut.wood && this.has(b, WOOD) > 0));
      case 'lighting the fire': return camp.lighter === e.id;
      default: return false;
    }
  },
```

  Delete the old in-progress `if (...) return;` block. Also check `tending`'s jobs list (`'gathering wood'`, `'carrying wood'`); it stays as is.

- [ ] **Step 7: Death drop, renderer, inspect line.**
  - `src/sim/creatures.js` `forgetCreature`: `if (e.brain !== null) { this.dropInventory(e); this.leaveCamp(e); } // humans.js`.
  - `src/render/renderer.js`: in the carried-item loop, `if (b === null || b.held <= 0) continue;` and `const q = b.held * SHADES * 3;`. Tools and the gun are drawn in Task 6.
  - `src/game/cell-notes.js`: import `inventoryNote` from `../sim/humans.js`. After pushing the job, add `const inv = inventoryNote(e.brain); if (inv) notes.push(inv);`.
  - `grep -rn "carry" src test` must find no `b.carry`/`brain.carry` left.

- [ ] **Step 8: Run the tests**

Run: `NODE --test test/humans-inventory.test.js test/humans.test.js test/humans-situations.test.js test/creatures.test.js test/render.test.js`
Expected: PASS. If a situation regresses, see whether fuel is being held back from the pile (`carryToPile`'s `want`) before changing anything else.

- [ ] **Step 9: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Humans carry an inventory: 10 of each element, a tool, a weapon, armour

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Mining, the pickaxe's reach, and deposits

**Files:**
- Modify: `src/sim/humans.js` (dig strengths, `digToward` down and pocketing, `walkTo`, `findDeposit`, `startMining`, `mine`, `wantsMore`, `giveUp`, `act`, `carryingOn`)
- Modify: `src/game/scenes.js` (Wilderness deposits)
- Test: `test/humans-mining.test.js` (create)

**Interfaces:**
- Consumes: `stow`, `holding`, `has`, `gather` (Task 2).
- Produces:
  - Exports: `RESOURCES = { coal, salt, metal }` (element sets), `HAND_DIG = 30`, `TOOL_DIG = 150`.
  - World methods:
    - `diggable(c, limit = HAND_DIG)`, `digLimit(b)`;
    - `digToward(e, b, dir, vdir)` (`vdir` -1 up, 0 level, 1 down);
    - `findDeposit(e, camp, set, limit, near = Infinity)`;
    - `startMining(e, b, camp, key, goal)` (true if it set off).
  - Brain fields: `mineKey`, `wantN`, `skip` (`Map<key, tick>`).

- [ ] **Step 1: Write the failing tests** — create `test/humans-mining.test.js`:

```js
// Humans mine: a pickaxe lets them dig harder things, and they dig down to
// buried coal, salt and metal (humans.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { HAND_DIG, TOOL_DIG } from '../src/sim/humans.js';
import { loadScene } from '../src/game/scenes.js';
import { makeWorld, fillRect, run } from './helpers.js';

test('a pickaxe digs stone and metal, but not steel', () => {
  const w = makeWorld(10, 10);
  w.spawn(5, ID.STONE);
  w.spawn(6, ID.METAL);
  w.spawn(7, ID.STEEL);
  w.spawn(8, ID.SAND);
  assert.equal(w.diggable(5, HAND_DIG), false);
  assert.equal(w.diggable(5, TOOL_DIG), true);
  assert.equal(w.diggable(6, TOOL_DIG), true);
  assert.equal(w.diggable(7, TOOL_DIG), false);
  assert.equal(w.diggable(8, HAND_DIG), true);
});

// A human on dirt with a coal seam buried under it, sent to mine.
function seam(seed, under = ID.DIRT) {
  const w = makeWorld(160, 90, seed);
  fillRect(w, 0, 85, 159, 89, ID.STONE);
  fillRect(w, 0, 40, 159, 84, under);
  fillRect(w, 100, 62, 108, 65, ID.COAL); // 22 cells down
  w.spawn(30 * 160 + 60, ID.HUMAN);
  run(w, 80);
  const e = w.creatures[0];
  e.brain.camp = w.joinOrMakeCamp(e);
  return { w, e };
}

for (const seed of [1, 2, 3]) {
  test(`a human digs a staircase down to a buried coal seam (seed ${seed})`, () => {
    const { w, e } = seam(seed);
    assert.ok(w.startMining(e, e.brain, e.brain.camp, 'coal', 5), 'it found the seam');
    let f = 0;
    for (; f < 6000 && w.has(e.brain, ID.COAL) < 5; f++) w.step();
    assert.equal(w.creatureById[e.id], e, 'alive');
    assert.ok(w.has(e.brain, ID.COAL) >= 5, `mined ${w.has(e.brain, ID.COAL)} in ${f} steps (${e.brain.job})`);
  });
}

test('without a pickaxe, a seam under stone is out of reach and given up on', () => {
  const { w, e } = seam(1, ID.STONE);
  assert.equal(w.startMining(e, e.brain, e.brain.camp, 'coal', 5), false);
  assert.ok(e.brain.skip.get('coal') > w.tick, 'skipped for a while');
  e.brain.tool = 1;
  e.brain.skip.clear();
  assert.equal(w.startMining(e, e.brain, e.brain.camp, 'coal', 5), true, 'with one it goes');
});

test('useful things dug through on the way go into its pockets', () => {
  const { w, e } = seam(2);
  fillRect(w, 60, 40, 108, 61, ID.WOOD); // a buried timber layer over the seam
  w.startMining(e, e.brain, e.brain.camp, 'coal', 5);
  for (let f = 0; f < 6000 && w.has(e.brain, ID.COAL) < 5; f++) w.step();
  assert.ok(w.has(e.brain, ID.WOOD) > 0, 'it kept some wood');
});

test('the Wilderness has coal, salt and metal buried in it', () => {
  const w = makeWorld(400, 240, 1);
  loadScene(w, 'wilderness');
  const n = (t) => w.type.reduce((s, u) => s + (u === t), 0);
  assert.ok(n(ID.SALT) > 0 && n(ID.METAL) > 0 && n(ID.COPPER) > 0);
  assert.ok(n(ID.COAL) > 200, 'more than the cliff seam');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `NODE --test test/humans-mining.test.js`
Expected: FAIL. `HAND_DIG` is undefined, and so is `startMining`.

- [ ] **Step 3: Dig strengths.** In `src/sim/humans.js`, replace the `WEAK` / `DIGGABLE` constants with:

```js
export const HAND_DIG = 30; // the strongest solid it digs by hand (sandstone); powders always
export const TOOL_DIG = 150; // and with a pickaxe (stone, granite, most metals)
// How hard each thing is to dig: 1 for powders, a solid's strength, 0 for
// what it never digs (creatures, dangers, anything that can't be broken).
const DIG = Uint16Array.from(DEFS, (d) => (d.shape || DANGER[d.id] || d.indestructible ? 0
  : d.state === POWDER ? 1 : d.state === SOLID ? d.strength : 0));
const METALS = Uint8Array.from(DEFS, (d) => (d.state === SOLID && (d.cat === 'metal' || d.cat === 'alloy') ? 1 : 0));
export const RESOURCES = { coal: setOf(['COAL']), salt: setOf(['SALT']), metal: METALS };
// What it keeps when it digs through it: fuel, salt, metal, building stone.
const USEFUL = Uint8Array.from(DEFS, (d) => (FUEL[d.id] || METALS[d.id] || MATERIAL[d.id] || d.key === 'SALT' ? 1 : 0));
const MINE_R = 120; // how far from the camp it looks for coal, salt and metal
const SEAM_R = 8; // and how near the last one it looks for more of the same
```

  Move these below the `FUEL`/`MATERIAL` definitions, since they use them.

  Replace `diggable`:

```js
  // Can a human dig out cell c, digging things up to strength `limit`: not
  // too hard, not hot, and not something a human put there?
  diggable(c, limit = HAND_DIG) {
    const s = DIG[this.type[c]];
    return s > 0 && s <= limit && this.temp[c] < HOT && !this.madeByHuman(c);
  },

  digLimit(b) {
    return b.tool !== 0 ? TOOL_DIG : HAND_DIG;
  },
```

  Replace `digToward`:

```js
  // Dig out one cell of what stops e stepping across the way `dir`: level,
  // up a step or down one (first, as `vdir` says: -1 up, 1 down), whichever
  // has only things it can dig in it. Useful things go into its pockets.
  // Returns whether it dug.
  digToward(e, b, dir, vdir) {
    const out = this.footB, rx = e.gy * dir, ry = -e.gx * dir;
    const fr = e.frame === 0 ? 1 : 0, limit = this.digLimit(b);
    for (const up of vdir < 0 ? [1, 0] : vdir > 0 ? [-1, 0] : [0, 1]) {
      if (!this.placeCells(e.kind, e.x + rx - up * e.gx, e.y + ry - up * e.gy, fr, dir, e.gx, e.gy, out)) continue;
      let first = -1, ok = true;
      for (let p = 0; p < e.n && ok; p++) {
        if (e.pix[p] !== BODY || this.roomForBody(e, out[p])) continue;
        if (!this.diggable(out[p], limit)) ok = false;
        else if (first < 0) first = out[p];
      }
      if (ok && first >= 0) {
        if (USEFUL[this.type[first]]) this.stow(b, this.type[first]);
        this.clearCell(first);
        if (b.tool !== 0) b.held = HELD_PICKAXE;
        return true;
      }
    }
    return false;
  },
```

  In `walkTo`, change the dig call to `this.digToward(e, b, b.heading, v < -1 ? -1 : v > 4 ? 1 : 0)`.

- [ ] **Step 4: Mining.** Add to `newBrain`:

```js
    mineKey: '', wantN: 0, // what it's mining (a RESOURCES key) and how many it wants
    skip: new Map(), // resource key -> tick until which it doesn't look for it
```

  Add the methods (near `fetch`):

```js
  // The nearest cell of `set` within MINE_R of the camp (and within `near`
  // of e) that it can dig, buried or not: not something a human put there,
  // claimed, or given up on. -1 if none.
  findDeposit(e, camp, set, limit, near = Infinity) {
    const { w, h, type } = this;
    const b = e.brain;
    let best = -1, bd = Infinity;
    for (let y = Math.max(0, camp.y - MINE_R); y <= Math.min(h - 1, camp.y + MINE_R); y++) {
      for (let x = Math.max(0, camp.x - MINE_R); x <= Math.min(w - 1, camp.x + MINE_R); x++) {
        const i = y * w + x;
        if (!set[type[i]]) continue;
        const d = Math.abs(x - e.x) + Math.abs(y - e.y);
        if (d >= bd || d > near || camp.claims.has(i) || this.isBanned(b, i) || !this.diggable(i, limit)) continue;
        best = i;
        bd = d;
      }
    }
    return best;
  },

  // Set off to mine `key` (a RESOURCES key) until it holds `goal` of it.
  // False if there's none it can reach (it skips that one for a while).
  startMining(e, b, camp, key, goal) {
    if ((b.skip.get(key) ?? 0) > this.tick) return false;
    const set = RESOURCES[key];
    const t = this.findDeposit(e, camp, set, this.digLimit(b));
    if (t < 0) {
      b.skip.set(key, this.tick + BAN_FOR);
      return false;
    }
    this.claim(b, camp, t);
    b.fetchSet = set;
    b.mineKey = key;
    b.wantN = goal;
    b.job = 'mining';
    if (b.tool !== 0) b.held = HELD_PICKAXE;
    return true;
  },

  // Does it want more of what it's mining? Salt goes into gunpowder as it's
  // mined, so it wants salt while it still has coal to go with it.
  wantsMore(b) {
    if (b.mineKey === 'salt') return this.has(b, COAL) > 0 && this.has(b, GUNPOWDER) < STACK;
    return this.holding(b, b.fetchSet) < b.wantN;
  },

  // Dig its way to the target and mine it, then the rest of the seam.
  mine(e, b) {
    const t = b.target;
    if (t < 0 || !b.fetchSet[this.type[t]]) {
      this.release(b);
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    if (!this.walkTo(e, b, t % this.w, (t / this.w) | 0, REACH, WALK_EVERY)) return;
    this.release(b);
    if (this.diggable(t, this.digLimit(b)) && this.stow(b, this.type[t])) {
      this.clearCell(t);
      if (b.tool !== 0) b.held = HELD_PICKAXE;
      if (this.wantsMore(b)) {
        const n = this.findDeposit(e, b.camp, b.fetchSet, this.digLimit(b), SEAM_R);
        if (n >= 0) {
          this.claim(b, b.camp, n);
          return;
        }
      }
    }
    b.job = 'wandering';
    b.think = 0;
  },
```

  - In `act`, add `case 'mining': this.mine(e, b); break;`.
  - In `carryingOn`, add `case 'mining': return b.target >= 0 && b.fetchSet[this.type[b.target]] === 1;`.
  - In `giveUp`, before `b.goalX = -1;`, add `if (b.job === 'mining') b.skip.set(b.mineKey, this.tick + BAN_FOR);`.

- [ ] **Step 5: Deposits in the Wilderness.** In `src/game/scenes.js` `wilderness`, after the clay bank line:

```js
  // Buried under the dirt: coal, a salt bed and veins of metal, for humans
  // with a pickaxe.
  for (const [x0, x1, d0, d1, t] of [
    [60, 90, 16, 19, ID.COAL], [196, 222, 26, 29, ID.COAL], [118, 140, 18, 21, ID.SALT],
    [36, 48, 28, 31, ID.METAL], [242, 252, 22, 25, ID.COPPER],
  ]) {
    for (let x = x0; x <= x1; x++) for (let y = ground(x) + d0; y <= ground(x) + d1; y++) set(x, y, t);
  }
```

  Check first that `ground(x) + 31 < h - 20`, so the deposits sit in dirt above the stone floor. If not, reduce the depths.

- [ ] **Step 6: Run the tests**

Run: `NODE --test test/humans-mining.test.js test/humans-situations.test.js test/scenes.test.js`
Expected: PASS. If the staircase test stalls, print `e.x, e.y, e.brain.job, e.brain.stuck` every 300 steps. Look at whether `walkTo`'s arrival box (`v` from -9 to 4) is ever met over a buried target before changing anything else.

- [ ] **Step 7: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Humans mine: a pickaxe's reach, staircases down, buried deposits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Crafting

**Files:**
- Modify: `src/sim/humans.js` (`craftWork`, `craft`, `canCraft`, `wantsPowder`, `chooseWork`)
- Test: `test/humans-crafting.test.js` (create)

**Interfaces:**
- Consumes: `startMining`, `gather`, `has`, `holding`, `takeOut`, `takeAny` (Tasks 2–3); `camp.burned` (Task 1).
- Produces:
  - Exports: `CRAFT_FIRE_TIME = 3000`, `ARMOUR_HITS = 10`.
  - World methods: `craft(b, what)` (`'pickaxe' | 'gun' | 'armour'`, true if made), `canCraft(camp)`, `craftWork(e, b, camp)`.
  - Brain field: `refill` (true while it wants gunpowder).

- [ ] **Step 1: Write the failing tests** — create `test/humans-crafting.test.js`:

```js
// Humans craft for themselves once their camp is settled: a pickaxe, then
// gunpowder, then a gun, then armour (humans.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { newBrain, CRAFT_FIRE_TIME, ARMOUR_HITS } from '../src/sim/humans.js';
import { makeWorld, fillRect } from './helpers.js';

test('the recipes take what they need, and only when it is there', () => {
  const w = makeWorld(10, 10);
  const b = newBrain();
  assert.equal(w.craft(b, 'pickaxe'), false);
  for (let k = 0; k < 4; k++) w.stow(b, ID.WOOD);
  assert.equal(w.craft(b, 'pickaxe'), true);
  assert.equal(b.tool, 1);
  assert.equal(w.has(b, ID.WOOD), 1);
  for (let k = 0; k < 5; k++) w.stow(b, ID.METAL);
  assert.equal(w.craft(b, 'gun'), true);
  assert.equal(b.weapon, 1);
  assert.equal(w.has(b, ID.WOOD), 0);
  for (let k = 0; k < 4; k++) w.stow(b, ID.METAL);
  for (let k = 0; k < 4; k++) w.stow(b, ID.COPPER);
  assert.equal(w.craft(b, 'armour'), true, 'any metals will do');
  assert.equal(b.armour, ARMOUR_HITS);
  assert.equal(w.holding(b, new Uint8Array(1000).fill(1)), 0);
});

test('no crafting until the hut is built and the fire has burned a while', () => {
  const w = makeWorld(60, 40, 1);
  const camp = w.makeCamp(30, 30);
  assert.equal(w.canCraft(camp), false);
  camp.hut = { done: true };
  camp.burned = CRAFT_FIRE_TIME - 1;
  assert.equal(w.canCraft(camp), false);
  camp.burned = CRAFT_FIRE_TIME;
  assert.equal(w.canCraft(camp), true);
});

// A world with everything: wood, stone for the hut, and coal, salt and metal
// buried under dirt.
function settled(seed) {
  const w = makeWorld(240, 90, seed);
  fillRect(w, 0, 80, 239, 89, ID.STONE);
  fillRect(w, 0, 50, 239, 79, ID.DIRT);
  fillRect(w, 30, 45, 41, 49, ID.WOOD);
  fillRect(w, 190, 41, 199, 49, ID.STONE);
  fillRect(w, 60, 64, 75, 66, ID.COAL);
  fillRect(w, 150, 62, 165, 64, ID.SALT);
  fillRect(w, 170, 66, 185, 69, ID.METAL);
  for (const x of [110, 122]) w.spawn(40 * 240 + x, ID.HUMAN);
  return w;
}

for (const seed of [1, 2]) {
  test(`humans settle, then craft a pickaxe, gunpowder, a gun and armour (seed ${seed})`, () => {
    const w = settled(seed);
    let f = 0, done = false;
    const people = new Map();
    for (; f < 40000 && !done; f++) {
      w.step();
      for (const e of w.creatures) if (e.brain) people.set(e.id, e);
      done = [...people.values()].some((e) => e.brain.armour > 0);
    }
    const jobs = [...people.values()].map((e) => `${e.brain.job} [${[...e.brain.items].join(' ')}] t${e.brain.tool} w${e.brain.weapon}`);
    assert.ok(done, `armour made in ${f} steps: ${jobs.join(' | ')}`);
    assert.ok([...people.values()].every((e) => w.creatureById[e.id] === e), 'nobody died');
    const armed = [...people.values()].find((e) => e.brain.armour > 0);
    assert.equal(armed.brain.tool, 1);
    assert.equal(armed.brain.weapon, 1);
    assert.ok(w.has(armed.brain, ID.GUNPOWDER) > 0, 'with gunpowder');
  });
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `NODE --test test/humans-crafting.test.js`
Expected: FAIL. `w.craft` is not a function.

- [ ] **Step 3: Recipes and the order.** In `src/sim/humans.js`:
  - Add the constants:

```js
export const CRAFT_FIRE_TIME = 3000; // steps its camp's fire has burned before it crafts
const PICK_WOOD = 3; // a pickaxe: 3 Wood
const GUN_METAL = 5, GUN_WOOD = 1; // a gun: 5 metal and a Wood stock
const ARMOUR_METAL = 8; // armour: 8 metal
export const ARMOUR_HITS = 10; // hits armour absorbs before it breaks
const AMMO_LOW = 4; // gunpowder below this, it goes for more
```

  - In `newBrain`, add `refill: true, // it wants gunpowder (a full stack the first time)`.
  - Add the methods:

```js
  // Make a pickaxe, a gun or armour from what it carries: true if it could.
  craft(b, what) {
    if (what === 'pickaxe') {
      if (b.tool !== 0 || this.has(b, WOOD) < PICK_WOOD) return false;
      for (let k = 0; k < PICK_WOOD; k++) this.takeOut(b, WOOD);
      b.tool = 1;
      b.held = HELD_PICKAXE;
      return true;
    }
    if (what === 'gun') {
      if (b.weapon !== 0 || this.holding(b, METALS) < GUN_METAL || this.has(b, WOOD) < GUN_WOOD) return false;
      for (let k = 0; k < GUN_METAL; k++) this.takeAny(b, METALS);
      for (let k = 0; k < GUN_WOOD; k++) this.takeOut(b, WOOD);
      b.weapon = 1;
      b.held = HELD_GUN;
      return true;
    }
    if (what === 'armour') {
      if (b.armour > 0 || this.holding(b, METALS) < ARMOUR_METAL) return false;
      for (let k = 0; k < ARMOUR_METAL; k++) this.takeAny(b, METALS);
      b.armour = ARMOUR_HITS;
      return true;
    }
    return false;
  },

  // Crafting starts once the camp is settled: its hut built and its fire
  // burned for a while.
  canCraft(camp) {
    return camp.hut !== null && camp.hut.done === true && camp.burned >= CRAFT_FIRE_TIME;
  },

  // Gunpowder wanted: a full stack the first time, and again once it's low.
  wantsPowder(b) {
    const gp = this.has(b, GUNPOWDER);
    if (gp >= STACK) b.refill = false;
    else if (gp < AMMO_LOW) b.refill = true;
    return b.refill;
  },

  // Its next crafting step, in order: a pickaxe, coal and salt for
  // gunpowder, metal for a gun, then armour. Crafting is instant once it
  // has what's needed; otherwise it sets off to get it. True if that gave it
  // a job. A resource out of reach is skipped for a while (startMining).
  craftWork(e, b, camp) {
    if (!this.canCraft(camp)) return false;
    if (b.tool === 0 && !this.craft(b, 'pickaxe')) {
      return this.gather(e, b, camp, WOOD_ONLY, FUEL_R, 'gathering wood');
    }
    if (this.wantsPowder(b)) {
      const pairs = Math.ceil((STACK - this.has(b, GUNPOWDER)) / 2);
      if (this.has(b, COAL) < pairs && this.startMining(e, b, camp, 'coal', pairs)) return true;
      if (this.has(b, COAL) > 0 && this.startMining(e, b, camp, 'salt', 0)) return true;
    }
    if (b.weapon === 0 && !this.craft(b, 'gun')) {
      if (this.holding(b, METALS) < GUN_METAL) return this.startMining(e, b, camp, 'metal', GUN_METAL);
      return this.gather(e, b, camp, WOOD_ONLY, FUEL_R, 'gathering wood');
    }
    if (b.weapon !== 0 && b.armour === 0 && !this.craft(b, 'armour')) {
      return this.startMining(e, b, camp, 'metal', ARMOUR_METAL);
    }
    return false;
  },
```

  - In `chooseWork`, just before `b.job = camp.lit ? 'resting by the fire' : 'wandering';`, add `if (this.craftWork(e, b, camp)) return;`.

- [ ] **Step 4: Run the tests**

Run: `NODE --test test/humans-crafting.test.js test/humans-mining.test.js test/humans-situations.test.js`
Expected: PASS. If the long chain doesn't finish, print each human's `job`, items and `skip` map every 2,000 steps, and see which step it stalls at. Common causes:
- The fuel tender takes the crafter's wood. Check `carryToPile` uses `FEED` first, and that `craftWork`'s wood gathering isn't undone by `carryingOn`.
- A resource gets skipped forever. Check `skip` expiry against `BAN_FOR`.

- [ ] **Step 5: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Humans craft: pickaxe, gunpowder, gun and armour, once settled

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Shooting, hunting, rivals and armour

**Files:**
- Modify: `src/sim/humans.js` (`think`, `act`, `findDanger`, `chooseWork`, `carryingOn`; new `armed`, `rival`, `findFoe`, `findPrey`, `muzzle`, `lineFirst`, `shootAt`, `shoot`, `pellet`, `pelletHits`)
- Modify: `src/sim/creatures.js` (`newCreature`: `shot: false`; `creatureDies`: Meat when shot; `blastCreatures`: armour)
- Test: `test/humans-guns.test.js` (create)

**Interfaces:**
- Consumes: `has`, `takeOut`, `HELD_GUN`, `ARMOUR_HITS` (Tasks 2 and 4); `world.shots` (Task 1).
- Produces:
  - World methods: `armed(b)`, `rival(b, ob)`, `shoot(e, b, mx, my, ax, ay)` (fires 4 pellets and pushes 4 tracers), `pellet(e, x0, y0, dx, dy)`.
  - Brain fields: `reload`, `foe` (creature id), `huntAt`, `huntUntil`.
  - Entity field: `shot` (true once hit by a pellet).
  - Exports: `PELLETS = 4`, `FIRE_EVERY = 40`.

- [ ] **Step 1: Write the failing tests** — create `test/humans-guns.test.js`:

```js
// Humans with guns: a shot is 4 pellets for 1 gunpowder; they shoot
// threats, hunt, fight rival camps, and armour takes some of the hits
// (humans.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { PELLETS, FIRE_EVERY, ARMOUR_HITS } from '../src/sim/humans.js';
import { makeWorld, fillRect, run, countOf } from './helpers.js';

// Humans grown at the given x on a flat stone floor, each with its own camp.
function people(w, xs) {
  for (const x of xs) w.spawn(30 * w.w + x, ID.HUMAN);
  run(w, 80);
  return w.creatures.filter((e) => e.kind === ID.HUMAN).sort((a, b) => a.x - b.x);
}
function arm(w, e, powder = 10) {
  e.brain.weapon = 1;
  for (let k = 0; k < powder; k++) w.stow(e.brain, ID.GUNPOWDER);
}

test('a shot is 4 pellets for 1 gunpowder, and none without gunpowder', () => {
  const w = makeWorld(120, 40, 1);
  fillRect(w, 0, 35, 119, 39, ID.STONE);
  const [e] = people(w, [30]);
  arm(w, e, 3);
  w.shoot(e, e.brain, e.x + 2, e.y - 4, e.x + 40, e.y - 4);
  assert.equal(w.shots.length, PELLETS);
  assert.equal(w.has(e.brain, ID.GUNPOWDER), 2);
  e.brain.items.clear();
  assert.equal(w.armed(e.brain), false, 'no gunpowder, no shooting');
});

test('a pellet takes out the pixel it hits, and stops at a wall', () => {
  const w = makeWorld(120, 40, 1);
  fillRect(w, 0, 35, 119, 39, ID.STONE);
  const [a, b] = people(w, [30, 60]);
  w.pellet(a, a.x + 2, b.y - 3, 1, 0);
  assert.equal(b.lost, 1);
  fillRect(w, 45, 20, 46, 34, ID.STONE);
  w.pellet(a, a.x + 2, b.y - 3, 1, 0);
  assert.equal(b.lost, 1, 'the wall stopped it');
});

test('armour takes about half the hits, and breaks after 10', () => {
  const w = makeWorld(120, 40, 4);
  fillRect(w, 0, 35, 119, 39, ID.STONE);
  const [a, b] = people(w, [30, 60]);
  b.brain.armour = ARMOUR_HITS;
  let absorbed = 0, shots = 0;
  while (b.brain.armour > 0 && shots < 60) {
    const before = b.brain.armour;
    w.pellet(a, a.x + 2, b.y - 3, 1, 0);
    shots++;
    if (b.brain.armour < before) absorbed++;
    run(w, 200); // heals
  }
  assert.equal(absorbed, ARMOUR_HITS);
  assert.ok(shots > 12 && shots < 40, `about half absorbed (${shots} shots)`);
});

test('an armed human shoots a phoenix near its camp', () => {
  const w = makeWorld(160, 60, 2);
  fillRect(w, 0, 55, 159, 59, ID.STONE);
  w.spawn(30 * 160 + 40, ID.HUMAN);
  run(w, 80);
  const e = w.creatures.find((c) => c.kind === ID.HUMAN);
  arm(w, e);
  w.spawn(35 * 160 + 70, ID.PHOENIX);
  let f = 0;
  for (; f < 3000 && w.creatures.some((c) => c.kind === ID.PHOENIX); f++) w.step();
  assert.ok(!w.creatures.some((c) => c.kind === ID.PHOENIX), `the phoenix is down (${f} steps)`);
  assert.ok(w.has(e.brain, ID.GUNPOWDER) < 10, 'it used gunpowder');
});

test('a hunter resting by its fire shoots an animal, which leaves meat', () => {
  const w = makeWorld(160, 60, 3);
  fillRect(w, 0, 55, 159, 59, ID.STONE);
  w.spawn(45 * 160 + 40, ID.HUMAN);
  run(w, 80);
  const e = w.creatures.find((c) => c.kind === ID.HUMAN);
  arm(w, e);
  const camp = w.joinOrMakeCamp(e);
  e.brain.camp = camp;
  camp.lit = true;
  w.spawn(50 * 160 + 70, ID.FROG);
  const meat = countOf(w, ID.MEAT);
  for (let f = 0; f < 3000 && w.creatures.some((c) => c.kind === ID.FROG); f++) w.step();
  assert.ok(!w.creatures.some((c) => c.kind === ID.FROG), 'the frog was shot');
  assert.ok(countOf(w, ID.MEAT) > meat, 'meat left');
});

test('an unarmed human flees an armed rival, who shoots at it', () => {
  const w = makeWorld(200, 60, 5);
  fillRect(w, 0, 55, 199, 59, ID.STONE);
  const [a, b] = people(w, [40, 70]);
  a.brain.camp = w.makeCamp(a.x - 4, a.y);
  b.brain.camp = w.makeCamp(b.x + 70, b.y); // a different camp
  arm(w, a);
  let fled = false;
  for (let f = 0; f < 1500; f++) {
    w.step();
    if (b.brain.job === 'fleeing') fled = true;
  }
  assert.ok(fled, 'it ran');
  assert.ok(w.has(a.brain, ID.GUNPOWDER) < 10 || w.creatureById[b.id] !== b, 'shots were fired');
});

test('humans of one camp never shoot each other, nor through each other', () => {
  const w = makeWorld(160, 60, 6);
  fillRect(w, 0, 55, 159, 59, ID.STONE);
  const [a, b] = people(w, [40, 52]);
  const camp = w.makeCamp(46, a.y);
  a.brain.camp = camp;
  b.brain.camp = camp;
  arm(w, a);
  w.spawn(35 * 160 + 90, ID.PHOENIX); // beyond b, in line
  run(w, FIRE_EVERY * 4);
  assert.equal(b.lost, 0, 'b is unhurt');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `NODE --test test/humans-guns.test.js`
Expected: FAIL. `PELLETS` is undefined.

- [ ] **Step 3: Pellets and armour.** In `src/sim/humans.js`:
  - Add the constants:

```js
export const PELLETS = 4; // a shot: 4 pellets in a tight spread
const SPREAD = 0.035; // radians between pellets
const SHOT_R = 48; // how far a pellet flies
export const FIRE_EVERY = 40; // steps between shots
const FIGHT_R = 40; // it shoots at threats and rivals this close
const THREAT = setOf(['SPIDER', 'PHOENIX']);
const HUNT_EVERY = 2000; // steps between hunts
const HUNT_FOR = 400; // and the longest a hunt goes on
const TRACER = 4; // frames a pellet's path is drawn
```

  - In `newBrain`, add `reload: 0, foe: 0, huntAt: 0, huntUntil: 0, // shooting`.
  - Add the methods:

```js
  // A gun and gunpowder for it.
  armed(b) {
    return b.weapon !== 0 && this.has(b, GUNPOWDER) > 0;
  },

  // Is the human with brain ob of a rival camp?
  rival(b, ob) {
    return ob !== null && ob.camp !== null && b.camp !== null && ob.camp !== b.camp;
  },

  // Where its gun's muzzle is: in front of its chest.
  muzzle(e) {
    return [e.x + 2 * e.facing * e.gy - 4 * e.gx, e.y - 2 * e.facing * e.gx - 4 * e.gy];
  },

  // The first creature (not e) on the straight line from (x0, y0) to
  // (x1, y1), before anything solid: the creature, or null.
  lineFirst(e, x0, y0, x1, y1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 1; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
      if (!this.inBounds(x, y)) return null;
      const c = y * this.w + x, t = this.type[c];
      if (t === 0 || this.ownCell(e, c)) continue;
      const o = this.creatureAt(c);
      if (o !== null) return o;
      const s = DEFS[t].state;
      if (s === SOLID || s === POWDER) return null;
    }
    return null;
  },

  // Fire one shot from (mx, my) at (ax, ay): PELLETS pellets in a tight
  // spread, for one gunpowder, and a puff of smoke.
  shoot(e, b, mx, my, ax, ay) {
    if (!this.takeOut(b, GUNPOWDER)) return;
    const base = Math.atan2(ay - my, ax - mx);
    for (let k = 0; k < PELLETS; k++) {
      const a = base + (k - (PELLETS - 1) / 2) * SPREAD + (this.rand() - 0.5) * SPREAD;
      this.pellet(e, mx, my, Math.cos(a), Math.sin(a));
    }
    const s = this.spawnNear(mx, my, ID.SMOKE);
    if (s >= 0) this.temp[s] = 45;
  },

  // A pellet from (x0, y0) along (dx, dy): it flies through air, gases and
  // liquids, and stops at the first solid, powder or creature (which loses
  // the pixel it hit). Its path is kept for drawing.
  pellet(e, x0, y0, dx, dy) {
    let x = x0 + 0.5, y = y0 + 0.5, cx = x0, cy = y0;
    for (let k = 0; k < SHOT_R; k++) {
      cx = Math.floor(x);
      cy = Math.floor(y);
      if (!this.inBounds(cx, cy)) break;
      const c = cy * this.w + cx, t = this.type[c];
      if (t !== 0 && !this.ownCell(e, c)) {
        const o = this.creatureAt(c);
        if (o !== null) {
          this.pelletHits(o, c);
          break;
        }
        const s = DEFS[t].state;
        if (s === SOLID || s === POWDER) break;
      }
      x += dx;
      y += dy;
    }
    this.shots.push({ x0, y0, x1: cx, y1: cy, ttl: TRACER });
  },

  // A pellet hits creature o at cell c: armour takes it half the time;
  // otherwise that pixel is lost.
  pelletHits(o, c) {
    if (o.brain !== null && o.brain.armour > 0 && this.rand() < 0.5) {
      o.brain.armour--;
      return;
    }
    for (let p = 0; p < o.n; p++) {
      if (o.cells[p] !== c || o.pix[p] !== BODY) continue;
      this.clearCell(c);
      this.hurt(o, p, false);
      o.shot = true;
      return;
    }
  },
```

  In `src/sim/creatures.js`:
  - In `newCreature`'s entity, add `shot: false, // hit by gunfire (an animal killed so leaves Meat)`.
  - In `creatureDies`, after the `burnt` line, add `else if (e.shot && e.brain === null) this.convert(c, ID.MEAT, false, -1);`. Adjust the `if`/`else if` chain.
  - In `blastCreatures`, inside `if (this.rand() < ...) {`, before `this.clearCell(c);`:

```js
          if (e.brain !== null && e.brain.armour > 0 && this.rand() < 0.5) {
            e.brain.armour--; // its armour took it
            continue;
          }
```

  `ID` is imported in creatures.js already; check that `MEAT` resolves.

- [ ] **Step 4: Choosing to shoot.** In `src/sim/humans.js`:

```js
  // The nearest threat (a Spider or Phoenix) or armed-or-not rival human
  // within FIGHT_R of e or its camp that it can see: a creature, or null.
  findFoe(e, b) {
    let best = null, bd = Infinity;
    for (const o of this.creatures) {
      if (o === e || o.grow >= 0) continue;
      if (!THREAT[o.kind] && !(o.kind === e.kind && this.rival(b, o.brain))) continue;
      const d = Math.max(Math.abs(o.x - e.x), Math.abs(o.y - e.y));
      const dc = b.camp === null ? Infinity : Math.max(Math.abs(o.x - b.camp.x), Math.abs(o.y - b.camp.y));
      if (Math.min(d, dc) > FIGHT_R || d > SHOT_R || d >= bd) continue;
      const [mx, my] = this.muzzle(e);
      if (this.lineFirst(e, mx, my, o.x, o.y - 2) !== o) continue;
      best = o;
      bd = d;
    }
    return best;
  },

  // An animal within FIGHT_R it can see: a creature, or null.
  findPrey(e) {
    let best = null, bd = Infinity;
    for (const o of this.creatures) {
      if (o === e || o.grow >= 0 || o.brain !== null || THREAT[o.kind]) continue;
      const d = Math.max(Math.abs(o.x - e.x), Math.abs(o.y - e.y));
      if (d > FIGHT_R || d >= bd) continue;
      const [mx, my] = this.muzzle(e);
      if (this.lineFirst(e, mx, my, o.x, o.y) !== o) continue;
      best = o;
      bd = d;
    }
    return best;
  },

  // Face the foe and fire every FIRE_EVERY steps, aiming at a random pixel
  // of it, but only while nothing else is in the way.
  shootAt(e, b) {
    const o = b.foe === 0 ? null : this.creatureById[b.foe];
    if (o === null || o.id !== b.foe || !this.armed(b) || (b.job === 'hunting' && this.tick > b.huntUntil)) {
      b.foe = 0;
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    b.held = HELD_GUN;
    const a = (o.x - e.x) * e.gy - (o.y - e.y) * e.gx;
    const face = a > 0 ? 1 : a < 0 ? -1 : e.facing;
    if (face !== e.facing || e.frame !== 0) this.moveBody(e, e.x, e.y, 0, face, e.gx, e.gy);
    if (++b.reload < FIRE_EVERY) return;
    const aim = this.randomCell(o);
    if (aim < 0) return;
    const [mx, my] = this.muzzle(e), ax = aim % this.w, ay = (aim / this.w) | 0;
    if (this.lineFirst(e, mx, my, ax, ay) !== o) return; // holds its fire
    b.reload = 0;
    this.shoot(e, b, mx, my, ax, ay);
  },
```

  - In `think`, after the `fleeing` reset line (`if (b.job === 'fleeing') b.job = 'wandering';`):

```js
    if (this.armed(b)) {
      const foe = this.findFoe(e, b);
      if (foe !== null) {
        if (b.foe !== foe.id) b.reload = FIRE_EVERY >> 1;
        b.foe = foe.id;
        b.job = 'shooting';
        return;
      }
      if (b.job === 'shooting') b.job = 'wandering';
    }
```

  - In `findDanger`, at the end before `return best;`: an unarmed human (or one out of gunpowder) fears armed rivals.

```js
    if (!this.armed(e.brain)) {
      for (const o of this.creatures) {
        if (o.brain === null || o.brain === e.brain || !this.rival(e.brain, o.brain) || !this.armed(o.brain)) continue;
        const d = Math.abs(o.x - e.x) + Math.abs(o.y - e.y);
        if (Math.max(Math.abs(o.x - e.x), Math.abs(o.y - e.y)) <= r && d < bd) {
          best = o.y * w + o.x;
          bd = d;
        }
      }
    }
```

  (Check the local names `best`/`bd`/`w` in `findDanger` match; adapt if not.)
  - In `chooseWork`, after the `craftWork` line (hunting is for when there's nothing else to do), add:

```js
    if (camp.lit && this.armed(b) && this.has(b, GUNPOWDER) >= AMMO_LOW && this.tick >= b.huntAt) {
      const prey = this.findPrey(e);
      if (prey !== null) {
        b.foe = prey.id;
        b.huntAt = this.tick + HUNT_EVERY;
        b.huntUntil = this.tick + HUNT_FOR;
        b.reload = FIRE_EVERY >> 1;
        b.job = 'hunting';
        return;
      }
    }
```

  - In `carryingOn`, add `case 'hunting': return b.foe !== 0 && this.creatureById[b.foe] !== null && this.tick <= b.huntUntil;`.
  - In `act`, add `case 'shooting': case 'hunting': this.shootAt(e, b); break;`.

- [ ] **Step 5: Run the tests**

Run: `NODE --test test/humans-guns.test.js test/humans-crafting.test.js test/humans-situations.test.js test/creatures.test.js`
Expected: PASS. If the phoenix test fails because the phoenix sets the human alight first, that's the phoenix's nature. Move it further away (x 90) rather than weakening the test's claim. If the armour count comes out wrong, check that `pellet` actually reaches `b`: `y - 3` must be a body row.

- [ ] **Step 6: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Humans shoot: 4-pellet shots, threats, hunting, rival camps, armour

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Drawing, docs and build

**Files:**
- Modify: `src/render/renderer.js` (held tool and gun, grey armour, tracers)
- Modify: `README.md`, `HANDOFF.md`, `dist/sandbox-crafter.html` (build)
- Test: `test/render.test.js` (add one test)

**Interfaces:**
- Consumes: `HELD_PICKAXE`, `HELD_GUN`, `brain.held`, `brain.armour`, `world.shots`.

- [ ] **Step 1: Write the failing test** — append to `test/render.test.js`.

First look at how that file builds a `Renderer` and reads pixels; reuse its helper. The test should:
- grow a human on a floor;
- set `brain.weapon = 1`, `brain.held = HELD_GUN`, `brain.armour = 10`;
- push a tracer `{ x0, y0, x1, y1, ttl: 4 }`;
- render;
- assert that the barrel pixels and a shirt pixel are grey, and a pixel on the tracer line is light.

- [ ] **Step 2: Run it to see it fail**

Run: `NODE --test test/render.test.js`
Expected: FAIL.

- [ ] **Step 3: Draw them.** In `src/render/renderer.js`, replace the carried-item loop:

```js
    // Tracers: the paths of pellets fired in the last few frames.
    for (const s of world.shots) {
      const n = Math.max(Math.abs(s.x1 - s.x0), Math.abs(s.y1 - s.y0), 1);
      for (let k = 0; k <= n; k++) {
        const x = Math.round(s.x0 + ((s.x1 - s.x0) * k) / n), y = Math.round(s.y0 + ((s.y1 - s.y0) * k) / n);
        if (x >= 0 && y >= 0 && x < w && y < h) blend(y * w + x, TRACER_RGB, 0.6);
      }
    }
    for (const e of world.creatures) {
      const b = e.brain;
      if (b === null) continue;
      // Armour: its shirt turns metal grey.
      if (b.armour > 0) {
        const sh = DEFS[e.kind].shape, f = sh.frames[e.frame];
        for (let p = 0; p < e.n; p++) {
          if (e.pix[p] === 0 && sh.letters[f.letter[p]] === 's') pixels[e.cells[p]] = ARMOUR_PX;
        }
      }
      if (b.held === 0) continue;
      // What it holds, at its hands on the side it faces: a pixel, a
      // pickaxe (handle and head) or a gun (a short barrel).
      const up = e.frame >= 2 ? 4 : 5; // kneeling and sitting, its hands are lower
      const rx = e.facing * e.gy, ry = -e.facing * e.gx;
      const at = (k, u) => {
        const x = e.x + k * rx - u * e.gx, y = e.y + k * ry - u * e.gy;
        return x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x;
      };
      const put = (c, px) => { if (c >= 0) pixels[c] = px; };
      if (b.held === HELD_PICKAXE) {
        put(at(1, up - 1), HANDLE_PX);
        put(at(1, up), PICK_PX);
        put(at(2, up), PICK_PX);
      } else if (b.held === HELD_GUN) {
        put(at(1, up - 1), GUN_PX);
        put(at(2, up - 1), GUN_PX);
        put(at(3, up - 1), GUN_PX);
      } else {
        const q = b.held * SHADES * 3;
        put(at(1, up), pack(this.palRGB[q], this.palRGB[q + 1], this.palRGB[q + 2]));
      }
    }
```

  - Import `HELD_PICKAXE, HELD_GUN` from `../sim/humans.js`, and `BODY` from `../sim/creatures.js` if `e.pix[p] === 0` should read as `BODY`. Use `BODY`.
  - Add module constants near the other colour constants:

```js
const TRACER_RGB = [255, 236, 170];
const ARMOUR_PX = pack(138, 141, 145);
const PICK_PX = pack(150, 152, 158), HANDLE_PX = pack(122, 84, 46), GUN_PX = pack(58, 60, 66);
```

  (`pack` must be defined above these lines; if it's defined lower, put the constants after it.)
  - Check that the renderer repaints while the world is asleep when `world.shots.length > 0`. If tracers depend on a dirty flag, set it in `shoot`.

- [ ] **Step 4: Run the tests**

Run: `NODE --test test/render.test.js`
Expected: PASS.

- [ ] **Step 5: Docs.**
  - `README.md`, Humans paragraph, add:
    - Their fire is a Campfire, which is never hot enough to fear.
    - They carry 10 of each thing, and feed the fire from their stock.
    - Once settled (hut built, fire burned a while), each crafts in turn: a wooden pickaxe (digs up to strength 150), coal and salt mined into gunpowder, metal for a gun (4 pellets per shot, 1 gunpowder each), then armour (takes half the hits, 10 in all).
    - They shoot Spiders and Phoenixes near camp, hunt animals now and then (which leave Meat), and fight rival camps. The unarmed flee.
    - The Wilderness has buried coal, salt and metal.
  - `HANDOFF.md`: the brain's inventory fields, `stepCamps`, `camp.burned`, `craftWork` order, `RESOURCES`, `DIG` strengths, `world.shots`, the new test files. Also add the content rule reminder: guns and gunpowder are in-game only.
  - `README.md` and `HANDOFF.md`: update the test counts and time.

- [ ] **Step 6: Full suite and build**

Run: `NODE --test test/*.test.js` (in the background; about 90 s).
Expected: all pass.

Run: `NODE scripts/build.js`
Expected: "Built dist\sandbox-crafter.html from 39 modules".

- [ ] **Step 7: Commit**

```bash
git add -A -- . ':!.claude'
git commit -m "Humans' gear drawn, pellet tracers, docs and build

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
