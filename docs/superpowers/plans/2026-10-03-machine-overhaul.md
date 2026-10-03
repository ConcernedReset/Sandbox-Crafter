# Machine Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Heater, Cooler and Fan, give power a direction, and add 12 new machines (Pipe, Pump, Safety Valve, Conveyor, Piston, Inverter, Delay Line, Barometer, Smoke Detector, Wind Turbine, Igniter, Neutron Source).

**Architecture:** Machines stay elements in the Machines category, run from `updateMachine` (machines.js) as a mix-in on `World.prototype`. Power gains a memory of where it came from (`powerFrom`, `powerDir`). Air machines (fan, pipe networks) move to `machines-air.js` and movers (conveyor, piston) go in `machines-motion.js`, both mixed in like `Machines`. Doors and Safety Valves share the door code through a new `doorKind`.

**Tech Stack:** Plain ES modules, no dependencies. Tests use `node:test`. Node isn't installed on this machine; run everything with VS Code's Electron:
`ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" --test test/<file>.test.js < /dev/null` (always redirect stdin from /dev/null, or the command can hang).

**Spec:** `docs/superpowers/specs/2026-10-03-machine-overhaul-design.md`

## Global Constraints

- Heater: +20 °C a frame while powered, plus 0.1 °C more for every frame it has been on; resets when the power stops; no limit.
- Cooler: −20 °C a frame while powered, down to absolute zero (`MIN_TEMP`, −273 °C).
- Pump: up to 4 units of pressure a frame per pump cell; the usual ±256 limit (`air.addPressure` clamps).
- Pipe sharing: each opening moves 20 % of the way to the average a frame; networks rebuilt every 10 frames or when the count of pipe cells changes.
- Safety Valve: opens above +30, stays open while the pressure beside it is above +10.
- Delay Line: 4 frames to charge, 12 frames resting after firing.
- Piston: arm up to 8 cells, pushes a row of up to 16 cells; walls and anything indestructible can't be pushed.
- Conveyor: moves the thing on top one cell every 2 frames; carries powders, liquids, loose debris and creatures.
- Barometer on above +5; Wind Turbine on above wind speed 0.5; Smoke Detector on while any gas touches it.
- Igniter: lights flammable neighbours, Fire into empty neighbours at 20 % a frame. Neutron Source: 15 % a frame per open face.
- New machines are crafted by contact at chance 0.03 (recipes in the spec) and crush back into their parts under pressure.
- Content line (HANDOFF): the recipes lean on real chemistry, but keep explosives, weapons and drugs purely in-game. Don't add real-world synthesis or containment instructions, in code, hints or docs.
- Comments and docs: plain, full sentences, matching the surrounding code's style.
- Commits: don't commit or push until the user says so. The earlier heat, visuals and physics work is still uncommitted in the same files. Each task ends with a full test run instead.

---

## File map

- `src/sim/machines.js`: power (`powerCell`, `signal`, `powerFrom`, `powerDir`, echo), controls including the new Inverter, Delay Line, Barometer, Smoke Detector and Wind Turbine, doors and valves, `runMachine` dispatch, Heater, Cooler, Igniter, Neutron Source.
- `src/sim/machines-air.js` (new): Fan (`blowOut`, moved from machines.js), pipe networks (`stepPipes`, `buildPipeNets`), Pump.
- `src/sim/machines-motion.js` (new): Conveyor (`runConveyor`), Piston (`runPiston`, `shove`).
- `src/sim/elements-machines.js`: the 12 new elements, Piston Arm, and their recipes.
- `src/sim/lookups.js`: the `POWERED` list gains the new powered kinds.
- `src/sim/world.js`: mixes in the new modules; calls `stepPipes`; passes a source to `powerCell`.
- `src/sim/behaviors.js`: passes a source to `powerCell`.
- `src/render/renderer.js`: open doorways drawn as the element they'll turn back into.
- `test/machines-overhaul.test.js` (new): every new behaviour.
- `test/hard-mode.test.js`: the machine count changes.
- `README.md`, `HANDOFF.md`, the spec, the recipe table, `dist/sandbox-crafter.html`.

Shared test helpers used throughout `test/machines-overhaul.test.js` (written in Task 1):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID, AMBIENT } from '../src/sim/elements.js';
import { World } from '../src/sim/world.js';
import { makeWorld, fillRect, wallBox, countOf, run } from './helpers.js';

// How many cells of element t are lit (powered, or on).
const lit = (w, t) => {
  let n = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === t && w.life[i] > 0) n++;
  return n;
};

// Paint the Spark tool onto (x, y) for one frame: flips a switch.
const flip = (w, x, y) => run(w, 1, () => w.paint(x, y, 0, ID.SPARK));

// Average x of every cell of element t.
const meanX = (w, t) => {
  let s = 0, n = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === t) { s += i % w.w; n++; }
  return n ? s / n : NaN;
};

// The average pressure over the inside of a box (from wallBox).
const meanPressure = (w, box) => {
  let s = 0, n = 0;
  for (let y = box.y0 + 1; y < box.y1; y += 4) {
    for (let x = box.x0 + 1; x < box.x1; x += 4) { s += w.pressureAt(x, y); n++; }
  }
  return s / n;
};

// Set the pressure of every air block inside a box.
const setPressure = (w, box, v) => {
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) w.air.p[w.air.at(x, y)] = v;
  }
};
```

---

### Task 1: Power remembers where it came from

**Files:**
- Modify: `src/sim/machines.js` (`initMachines`, `signal`, `powerCell`)
- Modify: `src/sim/behaviors.js:116-127` (`sparkNeighbors`), `:208-222` (`updateSpark`), `:248-264` (`updateBattery`)
- Modify: `src/sim/world.js` (`sparkArea`, `zap`)
- Create: `test/machines-overhaul.test.js`

**Interfaces:**
- Produces: `world.powerFrom` (Int32Array, −1 for none): the cell the power came from. `world.powerDir` (Int8Array, −1 for none): the direction the power was travelling as it entered (an index into `DX4`/`DY4`: 0 right, 1 left, 2 down, 3 up). `powerCell(j, from = j)`. `signal(x, y, side = -1)` (side −1 = every side). Exported helper `dirIndex(dx, dy)` and `OPPOSITE` from machines.js.

- [ ] **Step 1: Write the failing test.** Create `test/machines-overhaul.test.js` with the header and helpers from the File map, then:

```js
test('power remembers where it came from and which way it was going', () => {
  const w = makeWorld(20, 10);
  w.spawn(5 * 20 + 3, ID.BATTERY);
  fillRect(w, 4, 5, 8, 5, ID.LAMP);
  run(w, 3);
  for (let x = 4; x <= 8; x++) {
    assert.equal(w.powerFrom[5 * 20 + x], 5 * 20 + 3, `lamp at x ${x}`);
    assert.equal(w.powerDir[5 * 20 + x], 0, 'travelling right');
  }
});
```

- [ ] **Step 2: Run it and check it fails.** Run `ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" --test test/machines-overhaul.test.js < /dev/null`. Expected: FAIL, `powerFrom` is undefined.

- [ ] **Step 3: Implement.** In `src/sim/machines.js`:

```js
// Direction indexes into DX4/DY4: 0 right, 1 left, 2 down, 3 up.
export const OPPOSITE = [1, 0, 3, 2];
export function dirIndex(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 1;
  return dy >= 0 ? 2 : 3;
}
```

In `initMachines` add:

```js
  // Where the power reaching each machine cell came from (a cell index), and
  // which way it was going as it came in (see dirIndex). -1: no idea.
  world.powerFrom = new Int32Array(n).fill(-1);
  world.powerDir = new Int8Array(n).fill(-1);
```

Replace `signal` and `powerCell`:

```js
  // A control that is on: start current in idle wires and power machines,
  // on every side, or only on \`side\` (an index into DX4/DY4).
  signal(x, y, side = -1) {
    const from = y * this.w + x;
    for (let k = 0; k < 4; k++) {
      if (side >= 0 && k !== side) continue;
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const j = ny * this.w + nx;
      const u = this.type[j];
      if (CONDUCTOR[u]) {
        if (this.life[j] === 0) this.sparkAt(j);
      } else if (POWERED[u] || (u === 0 && this.doorTimer[j] !== 0)) {
        this.powerCell(j, from);
      }
    }
  },

  // Power reaches cell j (a machine, or an open doorway) from cell \`from\`
  // beside it (j itself when it has no direction, as from the Spark tool).
  powerCell(j, from = j) {
    const u = this.type[j];
    if (u === DOOR || (u === 0 && this.doorTimer[j] !== 0)) { this.openDoor(j); return; }
    if (!POWERED[u] || this.life[j] >= POWER_HOLD - 1) return; // already running
    const w = this.w;
    const dir = from === j || from < 0 ? -1
      : dirIndex((j % w) - (from % w), ((j / w) | 0) - ((from / w) | 0));
    // Power the whole connected block of this machine.
    this.eachConnected(j, (c) => {
      this.life[c] = POWER_HOLD;
      this.powerFrom[c] = from;
      this.powerDir[c] = dir;
    });
  },
```

In `src/sim/behaviors.js`, pass the source cell: in `sparkNeighbors(x, y)` change `this.powerCell(j)` to `this.powerCell(j, y * this.w + x)`; in `updateSpark(i, x, y)` change `this.powerCell(j)` to `this.powerCell(j, i)`; in `updateBattery(x, y, d)` change `this.powerCell(j)` to `this.powerCell(j, y * w + x)`.

In `src/sim/world.js` `sparkArea`, change `this.powerCell(i)` to `this.powerCell(i, i)`; in `zap`, change `if (POWERED[u]) { this.powerCell(i); return; }` to `if (POWERED[u]) { this.powerCell(i, i); return; }`.

- [ ] **Step 4: Run the new test and the whole suite.** Run the test file again (expected: PASS), then `ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" --test test/*.test.js < /dev/null` (expected: everything passes).

---

### Task 2: Heater with no limit, Cooler to absolute zero, Fan checked in thick air

**Files:**
- Modify: `src/sim/machines.js` (constants, `runMachine` heater and cooler cases)
- Modify: `src/sim/elements-machines.js` (Heater and Cooler `desc`)
- Test: `test/machines-overhaul.test.js`

**Interfaces:**
- Consumes: `powerCell(j, from)` from Task 1.
- Produces: the heater's `ctype` counts the frames it has been on.

- [ ] **Step 1: Write the failing tests.**

```js
test('a heater heats faster the longer it is on, with no limit', () => {
  const w = makeWorld(20, 10, 9);
  const at = 5 * 20 + 6;
  w.spawn(at, ID.HEATER);
  let early = 0;
  run(w, 1200, (f) => {
    w.powerCell(at, at);
    if (f === 300) early = w.temp[at];
  });
  const T = w.temp[at];
  assert.ok(T > 20000, `${T.toFixed(0)} °C after 20 s`);
  assert.ok(T - early > early, `it keeps speeding up (${early.toFixed(0)} at 5 s)`);
});

test('a cooler chills all the way to absolute zero', () => {
  const w = makeWorld(20, 10, 9);
  const at = 5 * 20 + 6;
  w.spawn(at, ID.COOLER);
  run(w, 300, () => w.powerCell(at, at));
  assert.ok(w.temp[at] < -270, `${w.temp[at].toFixed(1)} °C`);
});

test('a fan still blows a puff of smoke well clear of it in the thick air', () => {
  const w = makeWorld(80, 20, 13);
  fillRect(w, 10, 0, 10, 19, ID.WALL);
  fillRect(w, 11, 6, 11, 13, ID.FAN);
  w.spawn(5 * w.w + 11, ID.BATTERY);
  fillRect(w, 13, 7, 16, 12, ID.SMOKE);
  run(w, 120);
  assert.ok(countOf(w, ID.SMOKE) > 0, 'some smoke is left');
  assert.ok(meanX(w, ID.SMOKE) > 30, `smoke at x ${meanX(w, ID.SMOKE).toFixed(1)}`);
});
```

- [ ] **Step 2: Run them and check the heater and cooler tests fail.** Expected: FAIL (heater stops at 1200 °C, cooler at −150 °C). The fan test may already pass.

- [ ] **Step 3: Implement.** In `src/sim/machines.js`, replace the `HEATER_MAX` and `COOLER_MIN` constants with:

```js
// A heater heats HEATER_RATE a frame, plus HEATER_RAMP more for every frame
// it has been on, so it outruns the heat it loses and has no limit. A cooler
// chills COOLER_RATE a frame, down to absolute zero.
const HEATER_RATE = 20;
const HEATER_RAMP = 0.1;
const COOLER_RATE = 20;
```

Add `import { MIN_TEMP } from './constants.js';`. Replace the heater and cooler cases in `runMachine`:

```js
      case 'heater':
        if (powered) {
          if (this.ctype[i] < 65535) this.ctype[i]++; // frames on
          this.temp[i] += HEATER_RATE + this.ctype[i] * HEATER_RAMP;
        } else {
          this.ctype[i] = 0;
        }
        break;
      case 'cooler':
        if (powered) this.temp[i] = Math.max(MIN_TEMP, this.temp[i] - COOLER_RATE);
        break;
```

In `src/sim/elements-machines.js`, set the Heater's desc to `'Heats up while it\'s powered, faster and faster the longer it stays on, with no limit, warming everything touching it.'` and the Cooler's to `'Chills itself while it\'s powered, all the way down to absolute zero, cooling everything touching it. It works like a Peltier cooler: current pumps heat from one side to the other.'`

If the fan test fails, raise `FAN_PUSH` in machines.js from 0.25 to 0.4 and run it again; if it still fails, to 0.6.

- [ ] **Step 4: Run the file and the whole suite.** Expected: everything passes (the old heater and cooler test in `machines.test.js` asks for over 800 °C and under −100 °C, which still holds).

---

### Task 3: Pipe and Pump

**Files:**
- Create: `src/sim/machines-air.js`
- Modify: `src/sim/machines.js` (move `blowOut` and `FAN_PUSH` out; `pipe` case; `pump` case; `initMachines`)
- Modify: `src/sim/world.js` (import and mix in `AirMachines`; call `this.stepPipes()` after `this.stepDoors()` in `step`)
- Modify: `src/sim/lookups.js` (`POWERED` gains `'pump'`)
- Modify: `src/sim/elements-machines.js` (PIPE, PUMP, recipes)
- Modify: `test/hard-mode.test.js` (machine count)
- Test: `test/machines-overhaul.test.js`

**Interfaces:**
- Consumes: `world.flood`, `world.floodMark`, `world.floodStamp` (machines.js), `air.addPressure(a, amount)`, `air.at(x, y)`, `air.blocked`.
- Produces: `world.pipeCells` (array of cell indexes, filled during the frame's update), `world.pipeNets`, `world.pipeCount`, `stepPipes()`, `buildPipeNets(cells)`, `blowOut(x, y)` (moved).

- [ ] **Step 1: Write the failing tests.**

```js
// Two sealed boxes side by side, with a pipe through both walls joining them
// (or not).
function twoBoxes(pipe) {
  const w = new World(100, 40, 5);
  const left = wallBox(w, 2, 2, 47, 37), right = wallBox(w, 52, 2, 97, 37);
  if (pipe) {
    for (let x = 40; x <= 59; x++) { w.clearCell(20 * 100 + x); w.spawn(20 * 100 + x, ID.PIPE); }
  }
  setPressure(w, left, 40);
  run(w, 600);
  return { left: meanPressure(w, left), right: meanPressure(w, right) };
}

test('a pipe through a wall evens out the pressure on either side', () => {
  const shut = twoBoxes(false), piped = twoBoxes(true);
  assert.ok(shut.right < 1, `no pipe: ${shut.right.toFixed(1)} on the right`);
  assert.ok(piped.right > 10, `piped: ${piped.right.toFixed(1)} on the right`);
  assert.ok(piped.left < 30, `and ${piped.left.toFixed(1)} left on the left`);
});

test('a pump fills a sealed box through a pipe, and does nothing unpowered', () => {
  const w = new World(100, 40, 5);
  const box = wallBox(w, 52, 2, 97, 37);
  for (let x = 31; x <= 59; x++) { w.clearCell(20 * 100 + x); w.spawn(20 * 100 + x, ID.PIPE); }
  w.spawn(20 * 100 + 30, ID.PUMP);
  run(w, 200);
  assert.ok(Math.abs(meanPressure(w, box)) < 1, 'unpowered: nothing');
  w.spawn(19 * 100 + 30, ID.BATTERY);
  run(w, 300);
  assert.ok(meanPressure(w, box) > 10, `powered: ${meanPressure(w, box).toFixed(1)} in the box`);
});
```

- [ ] **Step 2: Run them and check they fail.** Expected: FAIL, `ID.PIPE` is undefined.

- [ ] **Step 3: Add the elements.** In `src/sim/elements-machines.js`, after the Drain:

```js
  machine('PIPE', 'Pipe', 'Pip', 'pipe', ['#8a5a3c', '#7e5034', '#966444'], {
    strength: 150, conduct: 0.6, pressure: { above: 220, to: 'COPPER', alt: 'SOLDER', altChance: 0.3, chance: 0.02 },
    desc: 'An airtight tube. Air goes in at one open end and comes out at the others, even through a wall, so the pressure at its ends evens out.',
    hint: 'Copper plumbing, joined with Solder.',
  }),
  machine('PUMP', 'Pump', 'Pmp', 'pump', ['#4a5a6e', '#425266', '#526276'], {
    light: '#7ad8ff', strength: 150, pressure: { above: 220, to: 'PIPE', alt: 'ELECTROMAGNET', altChance: 0.5, chance: 0.02 },
    desc: 'Put it at the end of a Pipe. While it\'s powered it sucks in the air beside it and blows it out of the pipe\'s other ends, building up pressure there. Switched off, it\'s shut.',
    hint: 'A Pipe driven by an Electromagnet motor.',
  }),
```

and in `MACHINE_REACTIONS`:

```js
  { a: 'COPPER', b: 'SOLDER', chance: 0.03, aTo: 'PIPE', bTo: null },
  { a: 'PIPE', b: 'ELECTROMAGNET', chance: 0.03, aTo: 'PUMP', bTo: null },
```

In `src/sim/lookups.js`, add `'pump'` to the `POWERED` list.

- [ ] **Step 4: Create `src/sim/machines-air.js`.**

```js
// Machines that work the air, mixed into World.prototype: fans, and pipe
// networks of pipes and pumps.
//
// A pipe network is a 4-connected group of Pipe and Pump cells, drawn one
// cell wide. Its openings are at its ends: the empty or gas cell beyond each
// pipe cell that has only one neighbour in the network. (Every cell touching
// a pump is that pump's intake.) Each frame the
// openings share their pressure (each moves PIPE_SHARE of the way to their
// average), so a pipe through a wall evens out the two sides. A powered pump
// moves PUMP_RATE of pressure a frame from the air beside it (its intake)
// out through the network's other openings; an unpowered pump is shut.
//
// An opening is remembered as two blocks: the block of the cell beside the
// pipe, and the next block out. The first can be sealed by the pipe itself
// (a pipe crossing a block seals it), so the second stands in for it then.
//
// Pipe cells list themselves (pipeCells) as the frame's update reaches them;
// the networks are rebuilt from that list every PIPE_REBUILD frames, or as
// soon as the number of pipe cells changes. With no pipes nothing runs.

import { DEFS, ID } from './elements.js';
import { CELL } from './air.js';
import { GASLIKE } from './lookups.js';

const { PIPE, PUMP } = ID;
const FAN_PUSH = 0.25;
const PIPE_SHARE = 0.2;
const PUMP_RATE = 4;
const PIPE_REBUILD = 10;
const DX4 = [1, -1, 0, 0];
const DY4 = [0, 0, 1, -1];

export const AirMachines = {
  // Push the air away from every open face of a fan. The push goes into the
  // next air block along, so the two sides of a thin fan don't cancel out.
  blowOut(x, y) {
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const u = this.type[ny * this.w + nx];
      if (u !== 0 && !DEFS[u].displaceable) continue;
      const a = this.air.at(x + DX4[k] * CELL, y + DY4[k] * CELL);
      if (!this.air.blocked[a]) this.air.addVelocity(a, DX4[k] * FAN_PUSH, DY4[k] * FAN_PUSH);
    }
  },

  // Find every network and its openings (see the top of this file).
  buildPipeNets(cells) {
    const { w, h, type, flood, floodMark } = this;
    const nets = [];
    const stamp = ++this.floodStamp;
    for (const start of cells) {
      if (floodMark[start] === stamp || (type[start] !== PIPE && type[start] !== PUMP)) continue;
      const open = new Map(); // block -> the next block out
      const pumps = [];
      let n = 0;
      floodMark[start] = stamp;
      flood[n++] = start;
      while (n > 0) {
        const c = flood[--n];
        const cx = c % w, cy = (c / w) | 0;
        const pump = type[c] === PUMP;
        const intake = pump ? new Map() : null;
        const gaps = []; // directions with room beside this cell
        let links = 0; // neighbours in the network
        for (let k = 0; k < 4; k++) {
          const nx = cx + DX4[k], ny = cy + DY4[k];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const m = ny * w + nx, u = type[m];
          if (u === PIPE || u === PUMP) {
            links++;
            if (floodMark[m] !== stamp) { floodMark[m] = stamp; flood[n++] = m; }
          } else if (u === 0 || GASLIKE[u]) {
            gaps.push(k);
          }
        }
        // A pump draws from every side; a pipe opens only at an end.
        if (!pump && links > 1) continue;
        for (const k of gaps) {
          const nx = cx + DX4[k], ny = cy + DY4[k];
          const fx = Math.min(w - 1, Math.max(0, cx + DX4[k] * CELL));
          const fy = Math.min(h - 1, Math.max(0, cy + DY4[k] * CELL));
          (intake ?? open).set(this.air.at(nx, ny), this.air.at(fx, fy));
        }
        if (intake && intake.size) pumps.push({ cell: c, intake: [...intake] });
      }
      // A block beside both a pump and a pipe end is the pump's.
      for (const q of pumps) for (const [a] of q.intake) open.delete(a);
      nets.push({ open: [...open], pumps });
    }
    this.pipeNets = nets;
  },

  // Share and pump the air through every pipe network. Called once a frame.
  stepPipes() {
    const cells = this.pipeCells;
    if (cells.length === 0) {
      this.pipeNets.length = 0;
      this.pipeCount = 0;
      return;
    }
    if (cells.length !== this.pipeCount || this.tick % PIPE_REBUILD === 0) this.buildPipeNets(cells);
    this.pipeCount = cells.length;
    cells.length = 0;
    const air = this.air, p = air.p, blocked = air.blocked;
    // The block an opening uses this frame: its own, or the next one out.
    const pick = ([a, b]) => (!blocked[a] ? a : !blocked[b] ? b : -1);
    for (const net of this.pipeNets) {
      const out = [];
      for (const o of net.open) { const a = pick(o); if (a >= 0) out.push(a); }
      if (out.length > 1) {
        let sum = 0;
        for (const a of out) sum += p[a];
        const mean = sum / out.length;
        for (const a of out) p[a] += (mean - p[a]) * PIPE_SHARE;
      }
      for (const pump of net.pumps) {
        if (this.type[pump.cell] !== PUMP || this.life[pump.cell] === 0 || out.length === 0) continue;
        const intake = [];
        for (const o of pump.intake) { const a = pick(o); if (a >= 0) intake.push(a); }
        if (intake.length === 0) continue;
        for (const a of intake) air.addPressure(a, -PUMP_RATE / intake.length);
        for (const a of out) air.addPressure(a, PUMP_RATE / out.length);
      }
    }
  },
};
```

- [ ] **Step 5: Wire it in.** In `src/sim/machines.js`: delete `FAN_PUSH` and the `blowOut` method (now in machines-air.js, unchanged; `runMachine`'s `fan` case still calls `this.blowOut(x, y)`), and drop the `CELL` import if nothing else uses it. If Task 2 raised `FAN_PUSH`, carry the new value over. In `initMachines` add:

```js
  world.pipeCells = []; // pipe and pump cells, listed during each frame's update
  world.pipeNets = []; // the networks they make (machines-air.js)
  world.pipeCount = 0;
```

In `updateMachine`'s `switch (kind)`, before `default:`, add:

```js
      case 'pipe':
        this.pipeCells.push(i);
        return false;
```

and in `runMachine` add:

```js
      case 'pump':
        this.pipeCells.push(i); // its pumping is done with its network's
        break;
```

In `src/sim/world.js`: `import { AirMachines } from './machines-air.js';`, change `Object.assign(World.prototype, Behaviors, Particles, Machines);` to `Object.assign(World.prototype, Behaviors, Particles, Machines, AirMachines);`, and in `step()` add `this.stepPipes();` on the line after `this.stepDoors();`.

In `test/hard-mode.test.js`, change `assert.equal(machines.length, 18);` to `assert.ok(machines.length >= 18, \`\${machines.length} machines\`);`.

- [ ] **Step 6: Run the file and the whole suite.** Expected: everything passes, including the new recipes in `recipes.test.js`.

---

### Task 4: Safety Valve (doors that remember what they were)

**Files:**
- Modify: `src/sim/machines.js` (`initMachines`, `powerCell`, `openDoor`, `stepDoors`, `shutDoor`, new `pressureNear`, `valve` case)
- Modify: `src/sim/elements-machines.js` (VALVE, recipe)
- Modify: `src/render/renderer.js` (open doorway colour)
- Test: `test/machines-overhaul.test.js`

**Interfaces:**
- Consumes: `powerCell(j, from)`.
- Produces: `world.doorKind` (Uint16Array, the element an open doorway turns back into), `pressureNear(x, y)` (the highest pressure in the cell's air block and the four beside it).

- [ ] **Step 1: Write the failing test.**

```js
test('a safety valve holds below +30, opens above it, and shuts again once the pressure drops', () => {
  const w = new World(60, 40, 5);
  const box = wallBox(w, 10, 10, 49, 29);
  for (let y = 18; y <= 21; y++) { w.clearCell(y * 60 + 49); w.spawn(y * 60 + 49, ID.VALVE); }
  setPressure(w, box, 20);
  run(w, 30);
  assert.equal(countOf(w, ID.VALVE), 4, 'shut at +20');
  assert.ok(meanPressure(w, box) > 15, 'and holding');
  setPressure(w, box, 60);
  run(w, 10);
  assert.ok(countOf(w, ID.VALVE) < 4, 'open at +60');
  run(w, 600);
  assert.equal(countOf(w, ID.VALVE), 4, 'shut again');
  assert.ok(meanPressure(w, box) < 15, `vented to ${meanPressure(w, box).toFixed(1)}`);
});
```

- [ ] **Step 2: Run it and check it fails.** Expected: FAIL, `ID.VALVE` is undefined.

- [ ] **Step 3: Add the element.** In `src/sim/elements-machines.js`, after the Pump:

```js
  machine('VALVE', 'Safety Valve', 'SVl', 'valve', ['#8a7a3a', '#7e6e34', '#968644'], {
    strength: 200, conduct: 0.4, pressure: { above: 240, to: 'PIPE', alt: 'BRASS', altChance: 0.5, chance: 0.01 },
    desc: 'An airtight plug that opens by itself when the pressure beside it passes +30, letting the air out, and shuts again once it has dropped below +10. Fit one to anything you pressurise.',
    hint: 'A Brass fitting on a Pipe.',
  }),
```

and the recipe `{ a: 'PIPE', b: 'BRASS', chance: 0.03, aTo: 'VALVE', bTo: null },`.

- [ ] **Step 4: Generalise the doors.** In `src/sim/machines.js`, add constants:

```js
// A safety valve opens when the pressure beside it passes VALVE_OPEN and
// stays open while it's above VALVE_CLOSE.
const VALVE_OPEN = 30;
const VALVE_CLOSE = 10;
```

and `const { DOOR, PHOTON, VALVE } = ID;`. In `initMachines` add `world.doorKind = new Uint16Array(n); // what an open doorway turns back into`. In `powerCell`, change the door line to:

```js
    if (u === DOOR || (u === 0 && this.doorTimer[j] !== 0 && this.doorKind[j] === DOOR)) { this.openDoor(j); return; }
```

Replace `openDoor`:

```js
  // Open every connected cell of a door (or valve), and keep its doorway
  // open, remembering what each cell was.
  openDoor(j) {
    const { w, h, type, doorTimer, doorKind, flood } = this;
    if (doorTimer[j] >= DOOR_HOLD - 1) return; // just refreshed
    const kind = type[j] || doorKind[j];
    let n = 0;
    const visit = (c) => {
      if (type[c] === kind) this.clearCell(c);
      if (doorTimer[c] === 0) this.doorList.push(c);
      doorTimer[c] = DOOR_HOLD;
      doorKind[c] = kind;
      flood[n++] = c;
    };
    visit(j);
    while (n > 0) {
      const c = flood[--n];
      const cx = c % w, cy = (c / w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = cx + DX4[k], ny = cy + DY4[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const m = ny * w + nx;
        if (doorTimer[m] !== DOOR_HOLD && (type[m] === kind || (doorTimer[m] !== 0 && doorKind[m] === kind))) visit(m);
      }
    }
  },
```

In `stepDoors`, inside the loop after `if (t === 0) continue; // erased`, add:

```js
      // An open valve stays open while the pressure is still high.
      if (this.doorKind[c] === VALVE && this.pressureNear(c % this.w, (c / this.w) | 0) > VALVE_CLOSE) {
        timer[c] = DOOR_HOLD;
        list[n++] = c;
        continue;
      }
```

In `shutDoor`, change `this.spawn(c, DOOR);` to `this.spawn(c, this.doorKind[c] || DOOR);`. Add:

```js
  // The highest air pressure in the air block of (x, y) and the four beside it.
  pressureNear(x, y) {
    const { p, W } = this.air;
    const a = this.air.at(x, y);
    return Math.max(p[a], p[a - 1], p[a + 1], p[a - W], p[a + W]);
  },
```

In `updateMachine`'s switch, before `default:`:

```js
      case 'valve':
        if (this.pressureNear(x, y) > VALVE_OPEN) this.openDoor(i);
        return false;
```

- [ ] **Step 5: Draw open doorways as what they'll become.** In `src/render/renderer.js` `paint()`, add `doorKind` to `const { w, h, type, temp, life, ctype, shade, loose, doorTimer } = world;` and change `const q = (ID.DOOR * SHADES + (x + y) % 3) * 3;` to `const q = ((doorKind[i] || ID.DOOR) * SHADES + (x + y) % 3) * 3;`.

- [ ] **Step 6: Run the file and the whole suite.** Expected: everything passes, including the existing door tests in `machines.test.js`.

---

### Task 5: Conveyor

**Files:**
- Create: `src/sim/machines-motion.js`
- Modify: `src/sim/machines.js` (`runMachine` conveyor case)
- Modify: `src/sim/world.js` (mix in `MotionMachines`)
- Modify: `src/sim/lookups.js` (`POWERED` gains `'conveyor'`)
- Modify: `src/sim/elements-machines.js` (CONVEYOR, recipe)
- Test: `test/machines-overhaul.test.js`

**Interfaces:**
- Consumes: `world.powerFrom`, `world.gravity.downX/downY`, `world.clock`, `world.tick`, `swap(i, j)`.
- Produces: `runConveyor(i, x, y)`.

- [ ] **Step 1: Write the failing test.**

```js
test('a conveyor carries sand away from the end it is powered from, either way', () => {
  const ride = (batteryX) => {
    const w = makeWorld(60, 20, 7);
    fillRect(w, 10, 15, 49, 15, ID.CONVEYOR);
    if (batteryX >= 0) w.spawn(15 * 60 + batteryX, ID.BATTERY);
    fillRect(w, 28, 12, 31, 14, ID.SAND);
    const x0 = meanX(w, ID.SAND);
    run(w, 60);
    return meanX(w, ID.SAND) - x0;
  };
  assert.ok(Math.abs(ride(-1)) < 1, 'unpowered, the sand sits still');
  assert.ok(ride(9) > 8, `powered from the left it goes right (${ride(9).toFixed(1)})`);
  assert.ok(ride(50) < -8, `powered from the right it goes left (${ride(50).toFixed(1)})`);
});
```

- [ ] **Step 2: Run it and check it fails.** Expected: FAIL, `ID.CONVEYOR` is undefined.

- [ ] **Step 3: Add the element.** In `src/sim/elements-machines.js`:

```js
  machine('CONVEYOR', 'Conveyor', 'Cnv', 'conveyor', ['#2e2e2e', '#363636', '#262626', '#3a3a3a'], {
    light: '#ffd76a', strength: 100, pressure: { above: 120, to: 'RUBBER', alt: 'FAN', altChance: 0.3, chance: 0.02 },
    desc: 'A belt. While it\'s powered, sand, water, debris and creatures resting on it ride along, away from the end the power comes in at.',
    hint: 'A Rubber belt run by a Fan motor.',
  }),
```

Recipe `{ a: 'RUBBER', b: 'FAN', chance: 0.03, aTo: 'CONVEYOR', bTo: null },`. Add `'conveyor'` to `POWERED` in lookups.js.

- [ ] **Step 4: Create `src/sim/machines-motion.js`.**

```js
// Machines that move things, mixed into World.prototype: conveyors and
// pistons. Both take their direction from where the power came in
// (powerFrom and powerDir, see machines.js).

import { DEFS, State } from './elements.js';
import { GASLIKE } from './lookups.js';

const { POWDER, LIQUID } = State;

// What a conveyor carries: loose things (powders, liquids, creatures, and
// debris torn off by pressure), never solid structures.
const CARRIED = Uint8Array.from(DEFS, (d) => (d.id !== 0 && !d.indestructible && !d.projectile
  && (d.state === POWDER || d.state === LIQUID || d.behavior === 'critter') ? 1 : 0));

// Can a moving thing go into a cell holding u? Empty space, or gas it pushes aside.
const roomFor = (u) => u === 0 || (GASLIKE[u] === 1 && DEFS[u].displaceable);

export const MotionMachines = {
  // Every other frame, move the thing resting on top of a powered belt cell
  // one cell along the belt, away from where the power came in. The belt
  // runs across gravity. Each thing moves once a frame however many belt
  // cells it passes: the scan reaches the belt before what rests on it, and
  // a moved cell is marked as done for the frame.
  runConveyor(i, x, y) {
    if ((this.tick & 1) !== 0) return;
    const { w, type } = this;
    const { downX, downY } = this.gravity;
    const tx = x - downX, ty = y - downY;
    if (!this.inBounds(tx, ty)) return;
    const j = ty * w + tx, u = type[j];
    if (u === 0 || this.clock[j] === this.tick || !(CARRIED[u] || this.loose[j])) return;
    const across = downY !== 0; // the belt runs along x when gravity is up or down
    const f = this.powerFrom[i];
    let s = across ? Math.sign(x - (f % w)) : Math.sign(y - ((f / w) | 0));
    if (f < 0 || s === 0) s = 1;
    const nx = across ? tx + s : tx, ny = across ? ty : ty + s;
    if (!this.inBounds(nx, ny)) return;
    const m = ny * w + nx;
    if (roomFor(type[m])) this.swap(j, m);
  },
};
```

In `src/sim/machines.js` `runMachine`, add:

```js
      case 'conveyor':
        if (powered) this.runConveyor(i, x, y);
        break;
```

In `src/sim/world.js`, import `MotionMachines` from './machines-motion.js' and add it to the `Object.assign` list.

- [ ] **Step 5: Run the file and the whole suite.** Expected: everything passes.

---

### Task 6: Piston

**Files:**
- Modify: `src/sim/machines-motion.js` (`runPiston`, `armLength`, `shove`)
- Modify: `src/sim/machines.js` (`runMachine` piston case)
- Modify: `src/sim/lookups.js` (`POWERED` gains `'piston'`)
- Modify: `src/sim/elements-machines.js` (PISTON, PISTON_ARM, recipe)
- Test: `test/machines-overhaul.test.js`

**Interfaces:**
- Consumes: `world.powerDir`, `dirIndex`, `OPPOSITE` (Task 1), `roomFor` (Task 5).
- Produces: `runPiston(i, x, y, powered)`; the piston's `ctype` holds 1 + the direction its arm went.

- [ ] **Step 1: Write the failing tests.**

```js
// A switch, a wire, a piston at x 10 on a floor, and whatever \`build\` adds.
function pistonRig(build) {
  const w = makeWorld(60, 20, 7);
  fillRect(w, 0, 19, 59, 19, ID.WALL);
  w.spawn(18 * 60 + 2, ID.SWITCH);
  fillRect(w, 3, 18, 9, 18, ID.METAL);
  w.spawn(18 * 60 + 10, ID.PISTON);
  build(w);
  return w;
}
const leftmost = (w, t) => {
  let m = Infinity;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === t) m = Math.min(m, i % w.w);
  return m;
};

test('a piston pushes away from its power and pulls its arm back when switched off', () => {
  const w = pistonRig((w) => fillRect(w, 11, 18, 14, 18, ID.STONE));
  flip(w, 2, 18);
  run(w, 40);
  assert.equal(countOf(w, ID.PISTON_ARM), 8, 'the arm is out');
  assert.ok(leftmost(w, ID.STONE) >= 19, `stone pushed to x ${leftmost(w, ID.STONE)}`);
  flip(w, 2, 18);
  run(w, 80);
  assert.equal(countOf(w, ID.PISTON_ARM), 0, 'the arm is back');
  assert.ok(leftmost(w, ID.STONE) >= 19, 'and the stone stays where it was pushed');
});

test('a piston can\'t push a wall', () => {
  const w = pistonRig((w) => w.spawn(18 * 60 + 13, ID.WALL));
  flip(w, 2, 18);
  run(w, 40);
  assert.equal(countOf(w, ID.PISTON_ARM), 2, 'the arm stops at the wall');
});
```

- [ ] **Step 2: Run them and check they fail.** Expected: FAIL, `ID.PISTON` is undefined.

- [ ] **Step 3: Add the elements.** In `src/sim/elements-machines.js`:

```js
  machine('PISTON', 'Piston', 'Pst', 'piston', ['#5c6470', '#545c68', '#646c78'], {
    light: '#9fd8ff', strength: 200, pressure: { above: 240, to: 'PUMP', alt: 'STEEL', altChance: 0.5, chance: 0.01 },
    desc: 'While it\'s powered it pushes out an arm up to 8 cells long, away from the side the power comes in, shoving whatever is in front of it. It pulls the arm back when the power stops.',
    hint: 'A Pump driving a Steel ram.',
  }),
  {
    // A piston's arm: not a discovery, and not in the palette.
    key: 'PISTON_ARM', name: 'Piston Arm', sym: 'Arm', cat: null, state: SOLID, always: true,
    colors: ['#9aa3b0', '#a4adba', '#909aa6'], density: 7.8, conduct: 0.3, strength: 200, acidProof: true,
    desc: 'The arm of a piston.',
  },
```

Recipe `{ a: 'PUMP', b: 'STEEL', chance: 0.03, aTo: 'PISTON', bTo: null },`. Add `'piston'` to `POWERED` in lookups.js.

- [ ] **Step 4: Implement the piston.** In `src/sim/machines-motion.js`, add `import { ID } from './elements.js';` (merge with the existing import), `import { dirIndex } from './machines.js';`, and:

```js
const { PISTON_ARM } = ID;
const PISTON_REACH = 8; // the longest an arm gets
const PISTON_PUSH = 16; // the longest row an arm can shove
const DX4 = [1, -1, 0, 0];
const DY4 = [0, 0, 1, -1];
```

and these methods in `MotionMachines`:

```js
  // A powered piston grows its arm one cell a frame, up to PISTON_REACH, in
  // the direction the power was going as it came in (against gravity if it
  // has none, as from the Spark tool). Unpowered, the arm shrinks one cell a
  // frame. ctype remembers the arm's direction (1 + an index into DX4/DY4).
  runPiston(i, x, y, powered) {
    const was = this.ctype[i] - 1;
    if (powered) {
      let k = this.powerDir[i];
      if (k < 0) k = dirIndex(-this.gravity.downX, -this.gravity.downY);
      // An arm already out keeps going the way it went.
      if (was >= 0 && was !== k && this.armLength(x, y, was) > 0) k = was;
      this.ctype[i] = k + 1;
      const L = this.armLength(x, y, k);
      if (L >= PISTON_REACH) return;
      const ax = x + DX4[k] * (L + 1), ay = y + DY4[k] * (L + 1);
      if (!this.inBounds(ax, ay)) return;
      const a = ay * this.w + ax;
      if (!roomFor(this.type[a]) && !this.shove(ax, ay, DX4[k], DY4[k])) return; // stalled
      if (this.type[a] !== 0) this.clearCell(a); // gas pushed back into the gap
      this.spawn(a, PISTON_ARM);
    } else if (was >= 0) {
      const L = this.armLength(x, y, was);
      if (L === 0) { this.ctype[i] = 0; return; }
      this.clearCell((y + DY4[was] * L) * this.w + x + DX4[was] * L);
    }
  },

  // How many arm cells run out from (x, y) in direction k.
  armLength(x, y, k) {
    let L = 0;
    while (L < PISTON_REACH) {
      const ax = x + DX4[k] * (L + 1), ay = y + DY4[k] * (L + 1);
      if (!this.inBounds(ax, ay) || this.type[ay * this.w + ax] !== PISTON_ARM) break;
      L++;
    }
    return L;
  },

  // Move the row of things starting at (x, y) one cell along (dx, dy), into
  // the first free cell within PISTON_PUSH. Returns false (and moves
  // nothing) if there's no room, or the row meets something that can't be
  // pushed: anything indestructible, or another arm.
  shove(x, y, dx, dy) {
    const { w, type } = this;
    let n = 0;
    for (; n < PISTON_PUSH; n++) {
      const cx = x + dx * n, cy = y + dy * n;
      if (!this.inBounds(cx, cy)) return false;
      const u = type[cy * w + cx];
      if (roomFor(u)) break;
      if (DEFS[u].indestructible || u === PISTON_ARM) return false;
    }
    if (n === PISTON_PUSH) return false;
    for (let t = n; t > 0; t--) {
      this.swap((y + dy * (t - 1)) * w + x + dx * (t - 1), (y + dy * t) * w + x + dx * t);
    }
    return true;
  },
```

In `src/sim/machines.js` `runMachine`, add:

```js
      case 'piston':
        this.runPiston(i, x, y, powered);
        break;
```

- [ ] **Step 5: Run the file and the whole suite.** Expected: everything passes.

---

### Task 7: Inverter and Delay Line

**Files:**
- Modify: `src/sim/machines.js` (`initMachines`, `powerCell`, new `feedInverter` and `fireDelay`, `inverter` and `delay` cases, `signal` marks echoes)
- Modify: `src/sim/lookups.js` (`POWERED` gains `'inverter'`, `'delay'`)
- Modify: `src/sim/elements-machines.js` (INVERTER, DELAY, recipes)
- Test: `test/machines-overhaul.test.js`

**Interfaces:**
- Consumes: `signal(x, y, side)`, `powerDir`, `dirIndex`, `OPPOSITE`.
- Produces: `world.echo` (Uint32Array): the frame an inverter last sparked each wire cell. Inverter `ctype` counts down the frames it stays fed; `powerDir` is its output side. `findInverterInput(i, x, y)`, `makesPower(m, c)`. Delay `ctype` is the charging countdown and `life` the rest after firing.

- [ ] **Step 1: Write the failing tests.**

```js
test('an inverter lights a lamp while its switch is off, and its own output doesn\'t switch it off', () => {
  const w = makeWorld(60, 20, 11);
  w.spawn(10 * 60 + 2, ID.SWITCH);
  fillRect(w, 3, 10, 19, 10, ID.METAL);
  w.spawn(10 * 60 + 20, ID.INVERTER);
  fillRect(w, 21, 10, 29, 10, ID.COPPER);
  fillRect(w, 30, 8, 34, 12, ID.LAMP);
  run(w, 60);
  assert.equal(lit(w, ID.LAMP), 25, 'lit while the switch is off');
  flip(w, 2, 10);
  run(w, 80);
  assert.equal(lit(w, ID.LAMP), 0, 'dark while the switch is on');
  flip(w, 2, 10);
  run(w, 100);
  assert.equal(lit(w, ID.LAMP), 25, 'lit again');
});

test('a delay line of 10 cells lights a lamp about 40 frames after the switch', () => {
  const w = makeWorld(60, 20, 11);
  w.spawn(10 * 60 + 2, ID.SWITCH);
  fillRect(w, 3, 10, 5, 10, ID.METAL);
  fillRect(w, 6, 10, 15, 10, ID.DELAY);
  w.spawn(10 * 60 + 16, ID.LAMP);
  run(w, 30);
  assert.equal(lit(w, ID.LAMP), 0);
  flip(w, 2, 10);
  let on = -1;
  run(w, 100, (f) => { if (on < 0 && lit(w, ID.LAMP) > 0) on = f; });
  assert.ok(on >= 35 && on <= 60, `lit after ${on} frames`);
});
```

- [ ] **Step 2: Run them and check they fail.** Expected: FAIL, `ID.INVERTER` is undefined.

- [ ] **Step 3: Add the elements.** In `src/sim/elements-machines.js`, in the controls section:

```js
  machine('INVERTER', 'Inverter', 'Inv', 'inverter', ['#3a3a52', '#34344a', '#40405a'], {
    light: '#c08aff', pressure: { above: 60, to: 'SILICON', alt: 'SWITCH', altChance: 0.5, chance: 0.02 },
    desc: 'A NOT gate. It powers what\'s on its far side unless something powers it, so a lamp wired through it is lit while its switch is off. Feed it from one side; it answers on the opposite side.',
    hint: 'Silicon and a Switch make a transistor.',
  }),
  machine('DELAY', 'Delay Line', 'Dly', 'delay', ['#3a4a3a', '#344434', '#405040'], {
    light: '#8aff9a', pressure: { above: 60, to: 'CLOCK', alt: 'COPPER', altChance: 0.5, chance: 0.02 },
    desc: 'A slow wire: current creeps along it one cell every 4 frames, and only forwards. A longer line waits longer.',
    hint: 'A Clock wound with Copper.',
  }),
```

Recipes `{ a: 'SILICON', b: 'SWITCH', chance: 0.03, aTo: 'INVERTER', bTo: null },` and `{ a: 'CLOCK', b: 'COPPER', chance: 0.03, aTo: 'DELAY', bTo: null },`. Add `'inverter', 'delay'` to `POWERED` in lookups.js.

- [ ] **Step 4: Implement.** In `src/sim/machines.js`, extend the element names: `const { DOOR, PHOTON, VALVE, BATTERY, SPARK } = ID;`. Add constants:

```js
// An inverter stays off for INVERTER_HOLD frames after power reaches it,
// enough to bridge the gaps between a wire's pulses. Power from a wire cell
// it sparked itself within ECHO frames is its own echo, and is ignored.
const INVERTER_HOLD = POWER_HOLD;
const ECHO = 3;
// An inverter that has never been fed looks for its input side every
// INVERTER_LOOK frames, following wires at most LOOK_LIMIT cells.
const INVERTER_LOOK = 15;
const LOOK_LIMIT = 4096;
// The controls that make power of their own (see findInverterInput).
const SOURCE_KINDS = new Set(['switch', 'button', 'clock', 'plate', 'photocell', 'thermostat',
  'barometer', 'smoke', 'turbine']);
// A delay cell charges for DELAY_STEP frames, fires, then rests DELAY_REST.
const DELAY_STEP = 4;
const DELAY_REST = 12;
```

In `initMachines`: `world.echo = new Uint32Array(n); // the frame an inverter last sparked each wire cell`.

In `signal`, give it a fourth parameter and mark echoes: change the signature to `signal(x, y, side = -1, mark = false)` and the conductor branch to:

```js
      if (CONDUCTOR[u]) {
        if (this.life[j] === 0) {
          this.sparkAt(j);
          if (mark) this.echo[j] = this.tick;
        }
      }
```

In `powerCell`, right after the door line, add:

```js
    const kind = DEFS[u].machine;
    if (kind === 'inverter') { this.feedInverter(j, from); return; }
    if (kind === 'delay') {
      if (this.ctype[j] === 0 && this.life[j] === 0) this.ctype[j] = DELAY_STEP;
      return;
    }
```

Add the methods:

```js
  // Power reaches an inverter from cell \`from\`. It goes off for a while, and
  // the side the power came in on becomes its input: it answers on the
  // opposite side (powerDir). Power from its own output side, or its own
  // echo, doesn't count.
  feedInverter(j, from) {
    if (from !== j && from >= 0) {
      if (this.echo[from] !== 0 && this.tick - this.echo[from] <= ECHO) return;
      const w = this.w;
      const k = dirIndex((j % w) - (from % w), ((j / w) | 0) - ((from / w) | 0));
      const out = this.powerDir[j];
      if (out >= 0 && k === OPPOSITE[out]) return;
      this.powerDir[j] = k;
    }
    this.ctype[j] = INVERTER_HOLD;
  },

  // Which way does an inverter that has never been fed face? Its input is the
  // side whose wire (or neighbour) leads back to something that makes power:
  // a control, a battery, a delay line, or an inverter whose output feeds
  // that wire. Returns its output direction (the way power from that side
  // travels in), or -1 if no side does. Without this, an inverter answering
  // on every side would send pulses back down its input wire, and they'd
  // meet the switch's pulses head on and cancel them out.
  findInverterInput(i, x, y) {
    const { w, h, type, ctype, flood, floodMark } = this;
    const wire = (m) => CONDUCTOR[type[m]] || (type[m] === SPARK && CONDUCTOR[ctype[m]]);
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (this.makesPower(j, i)) return OPPOSITE[k];
      if (!wire(j)) continue;
      const stamp = ++this.floodStamp;
      let n = 0, seen = 0;
      floodMark[j] = stamp;
      flood[n++] = j;
      while (n > 0 && seen < LOOK_LIMIT) {
        const c = flood[--n];
        seen++;
        const cx = c % w, cy = (c / w) | 0;
        for (let q = 0; q < 4; q++) {
          const mx = cx + DX4[q], my = cy + DY4[q];
          if (mx < 0 || my < 0 || mx >= w || my >= h) continue;
          const m = my * w + mx;
          if (m === i || floodMark[m] === stamp) continue;
          if (wire(m)) { floodMark[m] = stamp; flood[n++] = m; } else if (this.makesPower(m, c)) return OPPOSITE[k];
        }
      }
    }
    return -1;
  },

  // Does cell m send power into its neighbour c?
  makesPower(m, c) {
    const u = this.type[m];
    if (u === BATTERY) return true;
    const kind = DEFS[u].machine;
    if (kind === 'inverter') {
      const out = this.powerDir[m];
      return out >= 0 && m + DX4[out] + DY4[out] * this.w === c;
    }
    return kind === 'delay' || SOURCE_KINDS.has(kind);
  },

  // A delay cell fires: current into idle wires, power into machines, and the
  // next idle delay cells start charging. The one that charged it is resting,
  // so the current only goes forwards.
  fireDelay(i, x, y) {
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const j = ny * this.w + nx;
      const u = this.type[j];
      if (DEFS[u].machine === 'delay') {
        if (this.ctype[j] === 0 && this.life[j] === 0) this.ctype[j] = DELAY_STEP;
      } else if (CONDUCTOR[u]) {
        if (this.life[j] === 0) this.sparkAt(j);
      } else if (POWERED[u] || (u === 0 && this.doorTimer[j] !== 0)) {
        this.powerCell(j, i);
      }
    }
  },
```

In `updateMachine`'s switch, before `default:`:

```js
      case 'inverter': {
        // On (and lit) unless fed. Until it knows its input side it looks
        // for it every INVERTER_LOOK frames, and answers on every side.
        if (this.powerDir[i] < 0 && (this.tick + i) % INVERTER_LOOK === 0) {
          this.powerDir[i] = this.findInverterInput(i, x, y);
        }
        const fed = this.ctype[i] > 0;
        if (fed) this.ctype[i]--;
        this.life[i] = fed ? 0 : 1;
        if (!fed) this.signal(x, y, this.powerDir[i], true);
        return false;
      }
      case 'delay': {
        if (this.life[i] > 0) this.life[i]--; // resting (and lit) after firing
        const c = this.ctype[i];
        if (c > 1) this.ctype[i] = c - 1;
        else if (c === 1) {
          this.ctype[i] = 0;
          this.life[i] = DELAY_REST;
          this.fireDelay(i, x, y);
        }
        return false;
      }
```

- [ ] **Step 5: Run the file and the whole suite.** Expected: everything passes. In the inverter test, the inverter should find its input (the metal wire leads to the switch) within its first 15 frames and from then on answer only to the right. If the lamp flickers, check that `ECHO` covers the two frames a fresh spark powers its neighbours (sparks act at `life` 4 and 3).

---

### Task 8: Barometer, Smoke Detector and Wind Turbine

**Files:**
- Modify: `src/sim/machines.js` (new control cases, `gasTouching`, `windNear`)
- Modify: `src/sim/elements-machines.js` (BAROMETER, SMOKE_DETECTOR, WIND_TURBINE, recipes)
- Test: `test/machines-overhaul.test.js`

**Interfaces:**
- Consumes: `pressureNear(x, y)` (Task 4), the controls' shared on/flood/signal code in `updateMachine`.
- Produces: `gasTouching(x, y)`, `windNear(x, y)`.

- [ ] **Step 1: Write the failing tests.**

```js
// A sensor at (10, 10) with a lamp touching it.
function sensorRig(t) {
  const w = makeWorld(40, 20, 3);
  w.spawn(10 * 40 + 10, t);
  w.spawn(10 * 40 + 11, ID.LAMP);
  return w;
}

test('a barometer switches on while the pressure beside it is high', () => {
  const w = sensorRig(ID.BAROMETER);
  run(w, 20);
  assert.equal(lit(w, ID.LAMP), 0, 'off in still air');
  const a = w.air.at(10, 10);
  run(w, 10, () => { for (const b of [a, a - 1, a + 1]) w.air.p[b] = 12; });
  assert.equal(lit(w, ID.LAMP), 1, 'on at +12');
});

test('a smoke detector switches on while smoke touches it', () => {
  const w = sensorRig(ID.SMOKE_DETECTOR);
  run(w, 20);
  assert.equal(lit(w, ID.LAMP), 0, 'off in clean air');
  run(w, 5, () => { if (w.type[9 * 40 + 10] === 0) w.spawn(9 * 40 + 10, ID.SMOKE); });
  assert.equal(lit(w, ID.LAMP), 1, 'on with smoke');
});

test('a wind turbine switches on while the wind blows', () => {
  const w = sensorRig(ID.WIND_TURBINE);
  run(w, 20);
  assert.equal(lit(w, ID.LAMP), 0, 'off in still air');
  run(w, 10, () => w.blow(10, 10, 6, 1.5, 0));
  assert.equal(lit(w, ID.LAMP), 1, 'on in the wind');
});
```

- [ ] **Step 2: Run them and check they fail.** Expected: FAIL, `ID.BAROMETER` is undefined.

- [ ] **Step 3: Add the elements.** In `src/sim/elements-machines.js`, in the controls section:

```js
  machine('BAROMETER', 'Barometer', 'Bar', 'barometer', ['#4a5560', '#424d58', '#525d68'], {
    light: '#ff9a7a', pressure: { above: 60, to: 'MERCURY', alt: 'GLASS', altChance: 0.5, chance: 0.02 },
    desc: 'Switches on while the air pressure beside it is above +5. Wire it to a fan or a valve to keep a chamber in check.',
    hint: 'Torricelli\'s barometer: a column of Mercury in a Glass tube.',
  }),
  machine('SMOKE_DETECTOR', 'Smoke Detector', 'SmD', 'smoke', ['#d8d8d0', '#ccccc4', '#e0e0d8'], {
    light: '#ff4a4a', pressure: { above: 60, to: 'AMERICIUM', alt: 'PLASTIC', altChance: 0.7, chance: 0.02 },
    desc: 'Switches on while smoke, or any other gas, touches it. A fire alarm.',
    hint: 'Most smoke detectors hold a speck of Americium in a Plastic case.',
  }),
  machine('WIND_TURBINE', 'Wind Turbine', 'WTb', 'turbine', ['#c8ccd0', '#bcc0c4', '#d4d8dc'], {
    light: '#9affc8', pressure: { above: 60, to: 'FAN', alt: 'ALUMINUM', altChance: 0.5, chance: 0.02 },
    desc: 'Makes power while the wind blows past it.',
    hint: 'Aluminum blades on a Fan, run backwards.',
  }),
```

Recipes `{ a: 'MERCURY', b: 'GLASS', chance: 0.03, aTo: null, bTo: 'BAROMETER' },`, `{ a: 'AMERICIUM', b: 'PLASTIC', chance: 0.03, aTo: null, bTo: 'SMOKE_DETECTOR' },`, `{ a: 'FAN', b: 'ALUMINUM', chance: 0.03, aTo: 'WIND_TURBINE', bTo: null },`.

- [ ] **Step 4: Implement.** In `src/sim/machines.js`, add constants:

```js
const BAROMETER_ON = 5; // pressure
const TURBINE_ON = 0.5; // wind speed
```

`const { SOLID, POWDER, GAS, ENERGY } = State;` already includes `GAS`. In `updateMachine`'s switch, alongside the other controls (after `thermostat`):

```js
      case 'barometer':
        on = this.pressureNear(x, y) > BAROMETER_ON;
        break;
      case 'smoke':
        on = this.gasTouching(x, y);
        break;
      case 'turbine':
        on = this.windNear(x, y) > TURBINE_ON;
        break;
```

Add the methods:

```js
  // Does any gas touch (x, y)?
  gasTouching(x, y) {
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      if (DEFS[this.type[ny * this.w + nx]].state === GAS) return true;
    }
    return false;
  },

  // The fastest wind in the air block of (x, y) and the four beside it.
  windNear(x, y) {
    const air = this.air, W = air.W;
    const a = air.at(x, y);
    let best = 0;
    for (const b of [a, a - 1, a + 1, a - W, a + W]) {
      const s = Math.hypot(air.cvx(b), air.cvy(b));
      if (s > best) best = s;
    }
    return best;
  },
```

- [ ] **Step 5: Run the file and the whole suite.** Expected: everything passes.

---

### Task 9: Igniter and Neutron Source

**Files:**
- Modify: `src/sim/machines.js` (`runMachine` igniter and neutron cases)
- Modify: `src/sim/lookups.js` (`POWERED` gains `'igniter'`, `'neutron'`)
- Modify: `src/sim/elements-machines.js` (IGNITER, NEUTRON_SOURCE, recipes)
- Test: `test/machines-overhaul.test.js`

**Interfaces:**
- Consumes: `ignite(i, x, y)` (world.js), `spawnProjectile(t, x, y, vx, vy)` (particles.js), `GASLIKE`.

- [ ] **Step 1: Write the failing tests.**

```js
test('an igniter sets wood alight only while powered', () => {
  const burnt = (powered) => {
    const w = makeWorld(40, 20, 3);
    fillRect(w, 12, 5, 20, 15, ID.WOOD);
    w.spawn(10 * 40 + 11, ID.IGNITER);
    if (powered) w.spawn(10 * 40 + 10, ID.BATTERY);
    const wood = countOf(w, ID.WOOD);
    run(w, 200);
    return wood - countOf(w, ID.WOOD);
  };
  assert.equal(burnt(false), 0, 'nothing unpowered');
  assert.ok(burnt(true) > 5, `${burnt(true)} wood burnt`);
});

test('a neutron source starts a uranium pile, only while powered', () => {
  const split = (powered) => {
    const w = new World(120, 60, 7);
    fillRect(w, 40, 20, 79, 59, ID.URANIUM);
    // One cell short of the pile, so its right face is open towards it.
    w.spawn(40 * 120 + 38, ID.NEUTRON_SOURCE);
    if (powered) w.spawn(40 * 120 + 37, ID.BATTERY);
    const u = countOf(w, ID.URANIUM);
    run(w, 300);
    return u - countOf(w, ID.URANIUM);
  };
  assert.ok(split(false) < 3, 'barely anything unpowered');
  assert.ok(split(true) > 10, `${split(true)} uranium split`);
});
```

- [ ] **Step 2: Run them and check they fail.** Expected: FAIL, `ID.IGNITER` is undefined.

- [ ] **Step 3: Add the elements.** In `src/sim/elements-machines.js`:

```js
  machine('IGNITER', 'Igniter', 'Ign', 'igniter', ['#b8b0a0', '#aca494', '#c4bcac'], {
    light: '#ff9a3a', strength: 120, pressure: { above: 100, to: 'IRIDIUM', alt: 'PORCELAIN', altChance: 0.5, chance: 0.02 },
    desc: 'While it\'s powered it sets anything flammable touching it alight, and throws little flames into the air beside it.',
    hint: 'A spark plug: an Iridium tip in Porcelain.',
  }),
  machine('NEUTRON_SOURCE', 'Neutron Source', 'NSc', 'neutron', ['#5a6a5a', '#526252', '#627262'], {
    light: '#b8ffb0', strength: 150, pressure: { above: 150, to: 'RADIUM', alt: 'BERYLLIUM', altChance: 0.5, chance: 0.01 },
    desc: 'Fires neutrons out of its open faces while it\'s powered. Start a reactor with a switch.',
    hint: 'Radium mixed with Beryllium: the source the neutron was discovered with.',
  }),
```

Recipes `{ a: 'IRIDIUM', b: 'PORCELAIN', chance: 0.03, aTo: 'IGNITER', bTo: null },`, `{ a: 'RADIUM', b: 'BERYLLIUM', chance: 0.03, aTo: 'NEUTRON_SOURCE', bTo: null },`. Add `'igniter', 'neutron'` to `POWERED` in lookups.js.

- [ ] **Step 4: Implement.** In `src/sim/machines.js`, import `GASLIKE` from './lookups.js' (with the existing imports), add `FIRE, NEUTRON` to the `const { ... } = ID;` element names, add constants:

```js
const IGNITER_FLAME = 0.2; // chance a frame of a flame in each empty cell beside it
const NEUTRON_RATE = 0.15; // chance a frame of a neutron from each open face
```

and in `runMachine`:

```js
      case 'igniter':
        if (powered) {
          for (let k = 0; k < 4; k++) {
            const nx = x + DX4[k], ny = y + DY4[k];
            if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
            const j = ny * this.w + nx, e = DEFS[this.type[j]];
            if (e.flammable > 0 || e.explode > 0) this.ignite(j, nx, ny);
            else if (this.type[j] === 0 && this.rand() < IGNITER_FLAME) this.spawn(j, FIRE);
          }
        }
        break;
      case 'neutron':
        if (powered) {
          for (let k = 0; k < 4; k++) {
            const nx = x + DX4[k], ny = y + DY4[k];
            if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
            const u = this.type[ny * this.w + nx];
            if ((u === 0 || GASLIKE[u]) && this.rand() < NEUTRON_RATE) {
              this.spawnProjectile(NEUTRON, nx + 0.5, ny + 0.5, DX4[k] * 2, DY4[k] * 2);
            }
          }
        }
        break;
```

- [ ] **Step 5: Run the file and the whole suite.** Expected: everything passes.

---

### Task 10: Docs, recipe table, build and checks

**Files:**
- Modify: `README.md` (machine tables; power direction; machine count), `HANDOFF.md`, the spec (12 new machines, 30 in all; piston direction wording), the recipe table, `dist/sandbox-crafter.html`.

- [ ] **Step 1: Update the spec.** In `docs/superpowers/specs/2026-10-03-machine-overhaul-design.md`:
  - change "add 13 new machines" to "add 12 new machines";
  - change the Piston bullet under Power direction to: "**Piston**: extends the way the power was going as it came in (`powerDir`), so a row of pistons fed from one side all push the same way. Powered with no direction (the Spark tool), it extends against gravity.";
  - change the Inverter bullet to: "**Inverter**: its input side is where power last came from; it outputs on the opposite side only, and ignores power from its output side and its own echoes (wire cells it sparked in the last 3 frames). Until it has been fed, it traces its wires every 15 frames to find the side that leads back to something that makes power, and takes that as its input; if none does, it outputs on every side.";
  - in Pipe networks, say pipes are drawn one cell wide and open only at their ends (pipe cells with one network neighbour, on the far side), while a pump draws from every side.

- [ ] **Step 2: README.** In the "Machines and circuits" section, add the new controls to the controls table (Inverter, Delay Line, Barometer, Smoke Detector, Wind Turbine, with what they're on for) and the new machines to the machines table (Pipe, Pump, Safety Valve, Conveyor, Piston, Igniter, Neutron Source), change the Heater and Cooler rows to the new behaviour, and add a short paragraph: power remembers which way it came in, so conveyors carry things away from the end they're powered from, pistons push away from their power, inverters answer on the side opposite their input, and delay lines only carry current forwards. Mention that hard mode now hands out 30 machines. Update the tests paragraph and the total test count.

- [ ] **Step 3: HANDOFF.** Add notes: `powerFrom`/`powerDir` (set in `powerCell`, which every caller now passes a source to); `echo` (an inverter's own sparks); pipe networks (`machines-air.js`, `pipeCells` filled during update, rebuilt every 10 frames); `doorKind` (doors and valves share the door code); the delay states (`ctype` charging, `life` resting); Piston Arm is a hidden `always` element; where each machine lives.

- [ ] **Step 4: Regenerate the recipe table and rebuild.** Run `ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" scripts/recipe-table.js < /dev/null > "$SP/table.md"` (`$SP` is the session scratchpad directory; `table.mjs` there does the swap: `ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" "$SP/table.mjs" "$SP/table.md" < /dev/null`) and swap it into README in place of the old table (the table starts at the line `| No. | Element | Made from |` and runs while lines start with `|`). Then `ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" scripts/build.js < /dev/null`.

- [ ] **Step 5: Full suite and speed check.** Run every test (expected: all pass). Time the demo scene for 1000 steps with convection off and on (the `bench.mjs` script in the scratchpad) and compare with before the overhaul (3.03 and 3.54 ms/step): the demo scene has no pipes, so it should be within noise.

- [ ] **Step 6: Check it in the browser.** Start the preview (`sandbox-crafter` in `.claude/launch.json`), turn on free play, and check: the 12 new machines are in the Machines group; a pump on a pipe into a sealed Wall box raises its pressure (Pressure view); a conveyor carries sand; a piston pushes and retracts; lamps behind an inverter light with the switch off. Check the console has no errors.
