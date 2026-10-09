# Human Tunnels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Humans mine by digging wood-lined tunnels at 45° steps, kept in one shared network they path along, climbing shafts and stairs.

**Architecture:** A new `Tunnels` mixin (`src/sim/tunnels.js`) holds the geometry, the network and the human behaviour that uses it.
- **Geometry:** `boxCells`, `looseRound`, `workSpot`.
- **Network:** nodes, edges, `netDistances`, `netRoute`, `planTunnel`, `dropStretch`.
- **Behaviour:** `startMining`, `mine`, `stepAlong`, `leaveTunnel`.
- **State:** `world.tunnels` (nodes, edges, the way down, and a cell mask with INSIDE and LINED bits).
- **Wiring in `humans.js`:** `stepHuman` doesn't drop a human that holds on (`brain.hold`), and `walkTo` leaves the network through an entrance before walking anywhere else. The old staircase mining is removed.

**Tech Stack:** Plain ES modules, `node:test`, Node via VS Code's Electron.

**Spec:** `docs/superpowers/specs/2026-10-08-human-tunnels-design.md`

## Global Constraints

- **Running tests:** `ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" --test test/<file>.test.js < /dev/null`, written below as `NODE --test ...`.
- **Box:** a spot's box is 3 wide (across -1..1) and 6 tall (up 0..5) from the feet, in the network's gravity frame. Across is `(gy, -gx)`; up is `(-gx, -gy)`.
- **Lining:** a powder cell outside the inside, with the inside at its down, down + across or down - across neighbour.
- **Dig order:** lining first, then the box's cells from the top row down. Lining wood in a box being dug goes back in the pack.
- **Costs:**
  - Network edges cost their length, shafts 1.5×.
  - New tunnel costs `NEW_COST` = 4 per spot (octilinear distance).
  - A new entrance is 10–40 cells beside the camp, clear of the hut.
  - A tunnel is two legs: diagonal, then straight.
- **Pace:** 1 cell per 4 steps on level runs and stairs, 1 per 6 in a shaft. Digging and lining: one cell per `DIG_EVERY` = 8 steps.
- **Wood:** once a human has run out of tunnel wood, it gathers to `TUNNEL_WOOD` = 8 before tunnelling again.
- **Git:** commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage with `git add -A -- . ':!.claude'`. Don't push.

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `src/sim/tunnels.js` (new) | `initTunnels`, `Tunnels` mixin: geometry, network, tunnelling, travel |
| `src/sim/world.js` | `initTunnels` in constructor and `clearAll`; mix in `Tunnels` |
| `src/sim/humans.js` | Exports used by tunnels; `brain.hold`, `brain.tun`, `brain.tunnelWood`; `stepHuman` holds; `walkTo` leaves tunnels; old `startMining`/`mine` and staircase digging removed |
| `test/tunnels.test.js` (new) | Geometry, network, situations |
| `test/humans-mining.test.js`, `test/humans-crafting.test.js` | Updated for tunnels (wood in the worlds) |
| `README.md`, `HANDOFF.md`, `dist/` | Docs, build |

---

### Task 1: Geometry and lining

**Files:**
- Create: `src/sim/tunnels.js`
- Modify: `src/sim/world.js`, `src/sim/humans.js` (exports only)
- Test: `test/tunnels.test.js` (create)

**Interfaces:**
- Produces:
  - `initTunnels(world)`, which sets `world.tunnels = { nodes: Map, edges: Map, next, gx, gy, mask }`.
  - World methods:
    - `boxCells(x, y, gx, gy, out)`;
    - `markInside(x, y)`;
    - `looseRound(x, y)` (cells needing lining);
    - `lineCell(b, c)`;
    - `workSpot(e, b, x, y)`, which returns `'work' | 'clear' | 'wood' | 'blocked' | 'wait'`.
  - `humans.js` exports `GIVE_UP`, `DIG_EVERY`, `USEFUL`, `MINE_R`, `SEAM_R`, `WOOD_ONLY`, `FUEL_R`.

- [ ] **Step 1: Write the failing tests** — create `test/tunnels.test.js`:

```js
// Tunnels: wood-lined runs humans dig at 45° steps, kept as one network
// (tunnels.js, humans.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { newBrain } from '../src/sim/humans.js';
import { makeWorld, fillRect, run, countOf } from './helpers.js';

const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const digger = { kind: ID.HUMAN, id: -1 }; // works spots without a body

// Dig a run of n spots from (x, y) the way (dx, dy), lining as it goes.
function carve(w, b, x, y, dx, dy, n) {
  for (let k = 1; k <= n; k++) {
    for (let guard = 0; guard < 200; guard++) {
      const r = w.workSpot(digger, b, x + k * dx, y + k * dy);
      if (r === 'clear') break;
      assert.equal(r, 'work', `spot ${k}: ${r}`);
    }
  }
}

for (const [dx, dy] of DIRS) {
  test(`a lined run (${dx}, ${dy}) through dirt stays open`, () => {
    const w = makeWorld(80, 80, 1);
    fillRect(w, 0, 0, 79, 79, ID.DIRT);
    const b = newBrain();
    for (let k = 0; k < 10; k++) w.stow(b, ID.WOOD);
    b.items.set(ID.WOOD, 1000); // plenty
    w.markInside(40, 40);
    for (const c of [...Array(18).keys()]) void c;
    // The first spot, then the run.
    for (let guard = 0; guard < 200 && w.workSpot(digger, b, 40, 40) !== 'clear'; guard++);
    carve(w, b, 40, 40, dx, dy, 8);
    run(w, 200);
    const box = new Int32Array(18);
    for (let k = 0; k <= 8; k++) {
      w.boxCells(40 + k * dx, 40 + k * dy, 0, 1, box);
      for (const c of box) assert.equal(w.type[c], 0, `spot ${k} stays open (found ${w.type[c]})`);
    }
    const lined = countOf(w, ID.WOOD);
    assert.ok(lined > 0 && lined < 120, `${lined} lining`);
  });
}

test('a level run through stone needs no lining', () => {
  const w = makeWorld(80, 60, 1);
  fillRect(w, 0, 0, 79, 59, ID.STONE);
  const b = newBrain();
  b.tool = 1;
  for (let guard = 0; guard < 200 && w.workSpot(digger, b, 30, 30) !== 'clear'; guard++);
  carve(w, b, 30, 30, 1, 0, 10);
  assert.equal(countOf(w, ID.WOOD), 0);
  assert.equal(w.workSpot(digger, newBrain(), 42, 30), 'blocked', 'no pickaxe: stone stops it');
});

test('without wood, a spot that needs lining waits for it', () => {
  const w = makeWorld(40, 40, 1);
  fillRect(w, 0, 0, 39, 39, ID.DIRT);
  assert.equal(w.workSpot(digger, newBrain(), 20, 20), 'wood');
});
```

  (Remove the stray `for (const c of ...) void c;` line when writing it; it has no purpose.)

- [ ] **Step 2: Run to see it fail**

Run: `NODE --test test/tunnels.test.js`
Expected: FAIL (`w.markInside is not a function`).

- [ ] **Step 3: Exports in `humans.js`.**
  - Add `export` to `GIVE_UP`, `DIG_EVERY`, `USEFUL`, `MINE_R`, `SEAM_R`, `WOOD_ONLY`, `FUEL_R`.
  - In `newBrain`, add:

```js
    tun: null, // the tunnel it's travelling or digging (tunnels.js)
    tunnelWood: false, // it has run out of lining wood before: gathers some first
    hold: false, // holding on in a tunnel (no falling) this step
```

- [ ] **Step 4: Create `src/sim/tunnels.js`** with the geometry:

```js
// Tunnels: humans' mine workings (humans.js). A tunnel is a straight run of
// standing spots (where a human's feet go) in one of 8 directions, at 45°
// steps; its inside is the 3x6 box a body covers at each spot. Loose cells
// that could fall in (a powder with the inside below it, or diagonally
// below) are swapped for wood first, then the spot is dug out from the top
// down. Every run is kept in one network for the whole world
// (world.tunnels): nodes at entrances, junctions, bends and ends, and
// straight edges between them, which humans path along, climbing shafts
// and stairs. Mixed into World.prototype.

import { DEFS, ID, State } from './elements.js';
import { SHAPED } from './creatures.js';
import { USEFUL } from './humans.js';

const { POWDER } = State;
const { WOOD } = ID;
const INSIDE = 1, LINED = 2; // world.tunnels.mask bits
const BOX_UP = 6; // a spot's box: 3 wide, 6 tall

export function initTunnels(world) {
  world.tunnels = {
    nodes: new Map(), // id -> { id, x, y, entrance, edges: Set of edge ids }
    edges: new Map(), // id -> { id, a, b, dx, dy, len }: node b is len steps of (dx, dy) from a
    next: 1,
    gx: 0, gy: 1, // the way down it was dug with
    mask: new Uint8Array(world.w * world.h), // INSIDE, LINED
  };
  world.tunnelBox = new Int32Array(BOX_UP * 3);
}

export const Tunnels = {
  // The cells of the box a body covers standing at (x, y), with down (gx,
  // gy), into `out`, from the bottom row up. False if it leaves the world.
  boxCells(x, y, gx, gy, out) {
    let n = 0;
    for (let up = 0; up < BOX_UP; up++) {
      for (let k = -1; k <= 1; k++) {
        const cx = x + k * gy - up * gx, cy = y - k * gx - up * gy;
        if (!this.inBounds(cx, cy)) return false;
        out[n++] = cy * this.w + cx;
      }
    }
    return true;
  },

  isInside(x, y) {
    return this.inBounds(x, y) && (this.tunnels.mask[y * this.w + x] & INSIDE) !== 0;
  },

  // The spot at (x, y) is (to be) part of a tunnel.
  markInside(x, y) {
    const { gx, gy, mask } = this.tunnels, box = this.tunnelBox;
    if (!this.boxCells(x, y, gx, gy, box)) return;
    for (const c of box) mask[c] |= INSIDE;
  },

  // The loose cells round the box at (x, y) that could fall into a tunnel:
  // powders with the inside directly below them, or diagonally below.
  looseRound(x, y) {
    const { gx, gy, mask } = this.tunnels;
    const out = [];
    for (let up = 1; up <= BOX_UP; up++) {
      for (let k = -2; k <= 2; k++) {
        if (up < BOX_UP && k >= -1 && k <= 1) continue; // the box itself
        const cx = x + k * gy - up * gx, cy = y - k * gx - up * gy;
        if (!this.inBounds(cx, cy)) continue;
        const c = cy * this.w + cx, t = this.type[c];
        if (t === 0 || SHAPED[t] || DEFS[t].state !== POWDER || (mask[c] & INSIDE) !== 0) continue;
        const dx = cx + gx, dy = cy + gy;
        if (this.isInside(dx, dy) || this.isInside(dx + gy, dy - gx) || this.isInside(dx - gy, dy + gx)) out.push(c);
      }
    }
    return out;
  },

  // Swap a loose cell for lining wood from its pack: false if it has none.
  lineCell(b, c) {
    if (!this.takeOut(b, WOOD)) return false;
    this.clearCell(c);
    this.spawn(c, WOOD);
    this.humanMade.set(c, WOOD);
    this.tunnels.mask[c] |= LINED;
    return true;
  },

  // One piece of work on the spot (x, y): line one loose cell round it, or
  // else dig out one cell of its box (the top row first; lining wood in the
  // way goes back in its pack, useful things too). 'work' while there's
  // more, 'clear' once the box is open, 'wood' when lining is needed and it
  // has none, 'blocked' for something it can't dig, 'wait' for a creature.
  workSpot(e, b, x, y) {
    const { gx, gy, mask } = this.tunnels, box = this.tunnelBox;
    if (!this.boxCells(x, y, gx, gy, box)) return 'blocked';
    this.markInside(x, y);
    const loose = this.looseRound(x, y);
    if (loose.length > 0) return this.lineCell(b, loose[0]) ? 'work' : 'wood';
    for (let n = box.length - 1; n >= 0; n--) {
      const c = box[n], t = this.type[c];
      if (t === 0 || this.roomForBody(e, c)) continue;
      if (SHAPED[t]) return 'wait';
      if (t === WOOD && (mask[c] & LINED) !== 0) this.stow(b, WOOD); // its own lining
      else if (!this.diggable(c, this.digLimit(b))) return 'blocked';
      else if (USEFUL[t]) this.stow(b, t);
      mask[c] &= ~LINED;
      this.clearCell(c);
      return 'work';
    }
    return 'clear';
  },
};
```

- [ ] **Step 5: Wire into `world.js`.**
  - `import { Tunnels, initTunnels } from './tunnels.js';`
  - After each `initCreatures(this);`, add `initTunnels(this);`.
  - Add `Tunnels` to the `Object.assign(World.prototype, ...)` list after `Humans`.

- [ ] **Step 6: Run the tests**

Run: `NODE --test test/tunnels.test.js`
Expected: PASS.

If a diagonal run lets dirt in, print the box cells and their types after `run`. Check `looseRound` covers the cell that slid: it should be above, or diagonally above, an inside cell.

- [ ] **Step 7: Commit** — `git commit -m "Tunnels: lined runs that keep loose dirt out"`, ending with the Co-Authored-By line.

---

### Task 2: The network

**Files:**
- Modify: `src/sim/tunnels.js`
- Test: `test/tunnels.test.js`

**Interfaces:**
- Produces:
  - Nodes and edges: `addNode(x, y, entrance)`, `addEdge(na, nb)`, `removeEdge(ed)`, `splitEdge(ed, k)` (returns the node), `nodeAt(x, y)`.
  - Positions: `onNet(x, y)` (returns `{ node, edge, k }` or null), `edgeHas(ed, x, y)`.
  - Kinds: `nodeKind(n)` (`'entrance' | 'junction' | 'bend' | 'end'`).
  - Paths and costs:
    - `spotCost(ed)`;
    - `netDistances(sources)` (returns `{ dist, prev }`);
    - `netRoute(e, x, y)` (returns `{ wps, outside }` or null);
    - `dropStretch(x0, y0, x1, y1)`, `prune()`.
  - Planning: `octo(x0, y0, x1, y1, gx, gy)`, `legsTo(x0, y0, x1, y1, gx, gy)`, `planTunnel(e, camp, tx, ty)` (returns `{ cost, x, y, entrance }` or null), `entranceSpot(e, camp, tx, ty)`.

- [ ] **Step 1: Failing tests** — append to `test/tunnels.test.js`:

```js
// A network laid out by hand: entrance (20, 20), stairs down to (30, 30),
// level to (60, 30).
function handNet(w) {
  const e = w.addNode(20, 20, true), bend = w.addNode(30, 30), end = w.addNode(60, 30);
  w.addEdge(e, bend);
  w.addEdge(bend, end);
  return { e, bend, end };
}

test('nodes know their kind, and splitting a run makes a junction', () => {
  const w = makeWorld(100, 60, 1);
  const { e, bend, end } = handNet(w);
  assert.deepEqual([e, bend, end].map((n) => w.nodeKind(n)), ['entrance', 'bend', 'end']);
  const [level] = [...bend.edges].map((id) => w.tunnels.edges.get(id)).filter((ed) => ed.len === 30);
  const mid = w.splitEdge(level, 12);
  assert.deepEqual([mid.x, mid.y], [42, 30]);
  const side = w.addNode(42, 40);
  w.addEdge(mid, side);
  assert.equal(w.nodeKind(mid), 'junction');
  assert.deepEqual(w.onNet(50, 30).k, 8);
  assert.equal(w.onNet(50, 31), null);
});

test('a route through the network goes node to node, from outside via an entrance', () => {
  const w = makeWorld(100, 60, 1);
  handNet(w);
  const route = w.netRoute({ x: 5, y: 20, gx: 0, gy: 1 }, 45, 30);
  assert.equal(route.outside, true);
  assert.deepEqual(route.wps, [{ x: 20, y: 20 }, { x: 30, y: 30 }, { x: 45, y: 30 }]);
  const back = w.netRoute({ x: 45, y: 30, gx: 0, gy: 1 }, 20, 20);
  assert.deepEqual(back.wps, [{ x: 30, y: 30 }, { x: 20, y: 20 }]);
});

test('dropping a stretch drops the nodes it cuts off', () => {
  const w = makeWorld(100, 60, 1);
  const { end } = handNet(w);
  w.dropStretch(40, 30, 41, 30);
  assert.equal(w.tunnels.edges.size, 1);
  assert.equal(w.tunnels.nodes.has(end.id), false);
});

test('a plan branches off the network when that is cheaper, else opens a new entrance', () => {
  const w = makeWorld(160, 60, 1);
  fillRect(w, 0, 21, 159, 59, ID.DIRT);
  handNet(w);
  const camp = w.makeCamp(80, 20);
  const near = w.planTunnel({ x: 80, y: 20, gx: 0, gy: 1 }, camp, 45, 45);
  assert.deepEqual([near.x, near.y, !!near.entrance], [45, 30, false], 'from the level run, straight down');
  const far = w.planTunnel({ x: 80, y: 20, gx: 0, gy: 1 }, camp, 130, 30);
  assert.equal(far.entrance, true, 'a new entrance for something far from every tunnel');
  assert.deepEqual(w.legsTo(0, 0, 5, 2, 0, 1), [{ dx: 1, dy: 1, n: 2 }, { dx: 1, dy: 0, n: 3 }]);
});
```

- [ ] **Step 2: Run to see it fail** — `NODE --test test/tunnels.test.js` → FAIL (`w.addNode is not a function`).

- [ ] **Step 3: Implement.** Add to `Tunnels`, importing `HUT_W` from `./humans.js`, and `const NEW_COST = 4, SHAFT_COST = 1.5;`:

```js
  addNode(x, y, entrance = false) {
    const net = this.tunnels;
    const n = { id: net.next++, x, y, entrance, edges: new Set() };
    net.nodes.set(n.id, n);
    return n;
  },

  // A straight run from node na to node nb (8 directions only).
  addEdge(na, nb) {
    const net = this.tunnels;
    const ex = nb.x - na.x, ey = nb.y - na.y, len = Math.max(Math.abs(ex), Math.abs(ey));
    const ed = { id: net.next++, a: na.id, b: nb.id, dx: Math.sign(ex), dy: Math.sign(ey), len };
    net.edges.set(ed.id, ed);
    na.edges.add(ed.id);
    nb.edges.add(ed.id);
    return ed;
  },

  removeEdge(ed) {
    const net = this.tunnels;
    net.edges.delete(ed.id);
    net.nodes.get(ed.a)?.edges.delete(ed.id);
    net.nodes.get(ed.b)?.edges.delete(ed.id);
  },

  // Split a run k spots from its start: the new node there.
  splitEdge(ed, k) {
    const net = this.tunnels, na = net.nodes.get(ed.a), nb = net.nodes.get(ed.b);
    const m = this.addNode(na.x + k * ed.dx, na.y + k * ed.dy);
    this.removeEdge(ed);
    this.addEdge(na, m);
    this.addEdge(m, nb);
    return m;
  },

  nodeAt(x, y) {
    for (const n of this.tunnels.nodes.values()) if (n.x === x && n.y === y) return n;
    return null;
  },

  nodeKind(n) {
    if (n.entrance) return 'entrance';
    return n.edges.size >= 3 ? 'junction' : n.edges.size === 2 ? 'bend' : 'end';
  },

  // Is (x, y) a spot on run ed (its ends included)? Its step count from the
  // start, or -1.
  edgeHas(ed, x, y) {
    const a = this.tunnels.nodes.get(ed.a);
    const k = ed.dx !== 0 ? (x - a.x) * ed.dx : (y - a.y) * ed.dy;
    return k >= 0 && k <= ed.len && a.x + k * ed.dx === x && a.y + k * ed.dy === y ? k : -1;
  },

  // Where (x, y) is on the network: { node } at a node, { edge, k } partway
  // along a run, or null.
  onNet(x, y) {
    const n = this.nodeAt(x, y);
    if (n !== null) return { node: n, edge: null, k: 0 };
    for (const ed of this.tunnels.edges.values()) {
      const k = this.edgeHas(ed, x, y);
      if (k > 0 && k < ed.len) return { node: null, edge: ed, k };
    }
    return null;
  },

  // What a spot along run ed costs to travel: shafts are slower.
  spotCost(ed) {
    const { gx, gy } = this.tunnels;
    return ed.dx * gy - ed.dy * gx === 0 ? SHAFT_COST : 1;
  },

  // Shortest travel costs over the network from `sources` (node id ->
  // starting cost): { dist, prev }.
  netDistances(sources) {
    const net = this.tunnels, dist = new Map(sources), prev = new Map(), done = new Set();
    for (;;) {
      let u = -1, du = Infinity;
      for (const [id, d] of dist) if (!done.has(id) && d < du) { u = id; du = d; }
      if (u < 0) return { dist, prev };
      done.add(u);
      for (const eid of net.nodes.get(u).edges) {
        const ed = net.edges.get(eid), v = ed.a === u ? ed.b : ed.a, d = du + ed.len * this.spotCost(ed);
        if (d < (dist.get(v) ?? Infinity)) {
          dist.set(v, d);
          prev.set(v, u);
        }
      }
    }
  },

  // Where travel from e starts: its spot on the network, or (outside) every
  // entrance, at the distance it would walk to it.
  netSources(e) {
    const net = this.tunnels, at = this.onNet(e.x, e.y), src = new Map();
    if (at === null) {
      for (const n of net.nodes.values()) if (n.entrance) src.set(n.id, Math.abs(n.x - e.x) + Math.abs(n.y - e.y));
    } else if (at.node !== null) src.set(at.node.id, 0);
    else {
      const c = this.spotCost(at.edge);
      src.set(at.edge.a, at.k * c);
      src.set(at.edge.b, (at.edge.len - at.k) * c);
    }
    return { at, src };
  },

  // The cost of reaching spot k along run ed, given network distances.
  costAlong(ed, k, dist) {
    const c = this.spotCost(ed);
    return Math.min((dist.get(ed.a) ?? Infinity) + k * c, (dist.get(ed.b) ?? Infinity) + (ed.len - k) * c);
  },

  // The way from e to the network spot (x, y): { wps (waypoints, node by
  // node), outside (it walks to the first one, an entrance, overland) }, or
  // null if there's none.
  netRoute(e, x, y) {
    const net = this.tunnels, to = this.onNet(x, y);
    if (to === null) return null;
    const { at, src } = this.netSources(e);
    if (at !== null && at.edge !== null && to.edge === at.edge) return { wps: [{ x, y }], outside: false };
    const { dist, prev } = this.netDistances(src);
    let end;
    if (to.node !== null) end = to.node.id;
    else {
      const ed = to.edge, c = this.spotCost(ed);
      end = (dist.get(ed.a) ?? Infinity) + to.k * c <= (dist.get(ed.b) ?? Infinity) + (ed.len - to.k) * c ? ed.a : ed.b;
    }
    if (!dist.has(end)) return null;
    const chain = [];
    for (let n = end; n !== undefined; n = prev.get(n)) chain.push(n);
    chain.reverse();
    const wps = chain.map((id) => ({ x: net.nodes.get(id).x, y: net.nodes.get(id).y }));
    if (to.node === null) wps.push({ x, y });
    if (wps.length > 0 && wps[0].x === e.x && wps[0].y === e.y) wps.shift();
    return { wps, outside: at === null };
  },

  // Drop the run that holds both (x0, y0) and (x1, y1), and every node that
  // leaves without a way to an entrance.
  dropStretch(x0, y0, x1, y1) {
    for (const ed of this.tunnels.edges.values()) {
      if (this.edgeHas(ed, x0, y0) >= 0 && this.edgeHas(ed, x1, y1) >= 0) {
        this.removeEdge(ed);
        break;
      }
    }
    this.prune();
  },

  prune() {
    const net = this.tunnels, seen = new Set(), todo = [];
    for (const n of net.nodes.values()) if (n.entrance && n.edges.size > 0) { seen.add(n.id); todo.push(n.id); }
    while (todo.length > 0) {
      for (const eid of net.nodes.get(todo.pop()).edges) {
        const ed = net.edges.get(eid), v = seen.has(ed.a) ? ed.b : ed.a;
        if (!seen.has(v)) { seen.add(v); todo.push(v); }
      }
    }
    for (const n of [...net.nodes.values()]) {
      if (seen.has(n.id)) continue;
      for (const eid of [...n.edges]) this.removeEdge(net.edges.get(eid));
      net.nodes.delete(n.id);
    }
  },

  // Steps between two spots, 45° at a time, in the frame of down (gx, gy).
  octo(x0, y0, x1, y1, gx, gy) {
    const du = (x1 - x0) * gy - (y1 - y0) * gx, dv = (x1 - x0) * gx + (y1 - y0) * gy;
    return Math.max(Math.abs(du), Math.abs(dv));
  },

  // The two legs from (x0, y0) to (x1, y1): diagonal, then straight, as
  // [{ dx, dy, n }] in world steps (legs of no length left out).
  legsTo(x0, y0, x1, y1, gx, gy) {
    const du = (x1 - x0) * gy - (y1 - y0) * gx, dv = (x1 - x0) * gx + (y1 - y0) * gy;
    const su = Math.sign(du), sv = Math.sign(dv), n1 = Math.min(Math.abs(du), Math.abs(dv));
    const n2 = Math.max(Math.abs(du), Math.abs(dv)) - n1;
    const step = (u, v) => ({ dx: u * gy + v * gx, dy: -u * gx + v * gy });
    const legs = [];
    if (n1 > 0) legs.push({ ...step(su, sv), n: n1 });
    if (n2 > 0) legs.push({ ...step(Math.abs(du) > Math.abs(dv) ? su : 0, Math.abs(du) > Math.abs(dv) ? 0 : sv), n: n2 });
    return legs;
  },

  // A standing spot on the surface for a new entrance: 10 to 40 cells
  // beside the camp, clear of its hut, the side towards the target first.
  // { x, y, cost } or null.
  entranceSpot(e, camp, tx, ty) {
    const hut = camp.hut, tu = (tx - camp.x) * camp.gy - (ty - camp.y) * camp.gx;
    let best = null;
    for (const s of tu >= 0 ? [1, -1] : [-1, 1]) {
      for (let k = 10; k <= 40; k++) {
        const u = s * k;
        if (hut !== null && u >= hut.u0 - 1 && u <= hut.u0 + HUT_W) continue;
        const g = this.groundAt(camp, u);
        if (g === null) continue;
        const c = this.campCell(camp, u, g - 1);
        if (c < 0 || this.type[c] !== 0) continue;
        const x = c % this.w, y = (c / this.w) | 0;
        if (this.nodeAt(x, y) !== null) continue;
        const cost = Math.abs(x - e.x) + Math.abs(y - e.y) + NEW_COST * this.octo(x, y, tx, ty, camp.gx, camp.gy);
        if (best === null || cost < best.cost) best = { x, y, cost };
      }
    }
    return best;
  },

  // The cheapest way to tunnel to (tx, ty): from a spot on the network
  // (travel there, then dig), or from a new entrance. { cost, x, y,
  // entrance } or null.
  planTunnel(e, camp, tx, ty) {
    const net = this.tunnels;
    if (net.nodes.size > 0 && (net.gx !== e.gx || net.gy !== e.gy)) return null; // dug under another gravity
    let best = null;
    if (net.edges.size > 0) {
      const { dist } = this.netDistances(this.netSources(e).src);
      for (const ed of net.edges.values()) {
        const a = net.nodes.get(ed.a);
        for (let k = 0; k <= ed.len; k++) {
          const x = a.x + k * ed.dx, y = a.y + k * ed.dy;
          const cost = this.costAlong(ed, k, dist) + NEW_COST * this.octo(x, y, tx, ty, e.gx, e.gy);
          if (best === null || cost < best.cost) best = { cost, x, y, entrance: false };
        }
      }
    }
    const ent = this.entranceSpot(e, camp, tx, ty);
    if (ent !== null && (best === null || ent.cost < best.cost)) best = { cost: ent.cost, x: ent.x, y: ent.y, entrance: true };
    return best;
  },
```

- [ ] **Step 4: Run** — `NODE --test test/tunnels.test.js` → PASS. Then commit: "Tunnels: the network: nodes, runs, routes, plans".

---

### Task 3: Humans tunnel, travel and repair

**Files:**
- Modify: `src/sim/tunnels.js` (behaviour)
- Modify: `src/sim/humans.js`:
  - `stepHuman`: hold;
  - `walkTo`: leave tunnels, and remove `deep`;
  - remove `startMining` and `mine`;
  - `carryingOn('mining')`;
  - `giveUp`.
- Modify: `test/humans-mining.test.js`, `test/humans-crafting.test.js` (wood in their worlds)
- Test: `test/tunnels.test.js`

**Interfaces:**
- Consumes: Tasks 1–2; `findDeposit`, `wantsMore`, `RESOURCES`, `stow`, `has`, `gather`, `claim`, `release`, `walkTo`, `moveBody`, `giveUp`.
- Produces: `startMining(e, b, camp, key, goal)` (same signature as before), `mine(e, b)`, `stepAlong(e, b, wx, wy)`, `leaveTunnel(e, b)`, `snapTo(e, x, y)`, `growTunnel(t, x, y, dx, dy)`, and `TUNNEL_WOOD` (exported).

- [ ] **Step 1: Failing situations** — append to `test/tunnels.test.js`:

```js
// Fill a rectangle with t, whatever was there.
function put(w, x0, y0, x1, y1, t) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { w.clearCell(y * w.w + x); w.spawn(y * w.w + x, t); }
}

// Dirt ground at y 40, a coal seam 22 down, a log to line tunnels with.
function mine(seed) {
  const w = makeWorld(160, 90, seed);
  fillRect(w, 0, 85, 159, 89, ID.STONE);
  fillRect(w, 0, 40, 159, 84, ID.DIRT);
  put(w, 100, 62, 108, 65, ID.COAL);
  fillRect(w, 20, 30, 29, 39, ID.WOOD);
  w.spawn(30 * 160 + 60, ID.HUMAN);
  run(w, 80);
  const e = w.creatures[0];
  e.brain.camp = w.joinOrMakeCamp(e);
  for (let k = 0; k < 10; k++) w.stow(e.brain, ID.WOOD);
  return { w, e };
}
const until = (w, steps, done) => { let f = 0; for (; f < steps && !done(); f++) w.step(); return f; };
const kinds = (w) => [...w.tunnels.nodes.values()].map((n) => w.nodeKind(n)).sort().join(',');

for (const seed of [1, 2, 3]) {
  test(`a human tunnels to a buried seam without wrecking the ground (seed ${seed})`, () => {
    const { w, e } = mine(seed);
    const dirt = countOf(w, ID.DIRT);
    assert.ok(w.startMining(e, e.brain, e.brain.camp, 'coal', 5));
    const f = until(w, 12000, () => w.has(e.brain, ID.COAL) >= 5);
    assert.equal(w.creatureById[e.id], e, 'alive');
    assert.ok(w.has(e.brain, ID.COAL) >= 5, `${w.has(e.brain, ID.COAL)} coal in ${f} steps (${e.brain.job})`);
    let inside = 0, lined = 0;
    for (const m of w.tunnels.mask) { if (m & 1) inside++; if (m & 2) lined++; }
    const lost = dirt - countOf(w, ID.DIRT);
    assert.ok(lost <= inside + lined + 40, `${lost} dirt gone, tunnel ${inside} + lining ${lined}`);
    assert.ok(kinds(w).includes('entrance') && kinds(w).includes('end'), kinds(w));
  });
}

test('a second deposit is reached by branching off the first tunnel', () => {
  const { w, e } = mine(4);
  w.startMining(e, e.brain, e.brain.camp, 'coal', 5);
  until(w, 12000, () => w.has(e.brain, ID.COAL) >= 5);
  const edges = w.tunnels.edges.size;
  // Salt beside the tunnel's lower run.
  const end = [...w.tunnels.nodes.values()].find((n) => w.nodeKind(n) === 'end');
  put(w, end.x - 14, end.y + 8, end.x - 10, end.y + 10, ID.SALT);
  e.brain.items.delete(ID.COAL); // so the salt isn't mixed away
  for (let k = 0; k < 10; k++) w.stow(e.brain, ID.WOOD);
  e.brain.skip.clear();
  assert.ok(w.startMining(e, e.brain, e.brain.camp, 'salt', 3));
  e.brain.wantN = 3;
  until(w, 8000, () => w.has(e.brain, ID.SALT) >= 3);
  assert.ok(w.has(e.brain, ID.SALT) >= 3, `salt ${w.has(e.brain, ID.SALT)} (${e.brain.job})`);
  assert.ok(w.tunnels.edges.size > edges, 'a new run');
  assert.ok(/junction|bend/.test(kinds(w)), kinds(w));
  assert.equal([...w.tunnels.nodes.values()].filter((n) => n.entrance).length, 1, 'no second entrance');
});

test('a human climbs a shaft up and out, and back down, without falling', () => {
  const w = makeWorld(80, 80, 1);
  fillRect(w, 0, 30, 79, 79, ID.DIRT);
  const b = newBrain();
  b.items.set(ID.WOOD, 1000);
  // An entrance at (20, 29), a shaft to (20, 55), a run to (35, 55).
  for (let g = 0; g < 200 && w.workSpot(digger, b, 20, 29) !== 'clear'; g++);
  carve(w, b, 20, 29, 0, 1, 26);
  carve(w, b, 20, 55, 1, 0, 15);
  const top = w.addNode(20, 29, true), bottom = w.addNode(20, 55), end = w.addNode(35, 55);
  w.addEdge(top, bottom);
  w.addEdge(bottom, end);
  w.spawn(55 * 80 + 35, ID.HUMAN);
  run(w, 40);
  const e = w.creatures[0];
  let lowest = 0;
  const route = w.netRoute(e, 20, 29);
  for (let f = 0; f < 2000 && !(e.x === 20 && e.y === 29); f++) {
    if (route.wps.length && route.wps[0].x === e.x && route.wps[0].y === e.y) route.wps.shift();
    if (route.wps.length) w.stepAlong(e, e.brain, route.wps[0].x, route.wps[0].y);
    w.step();
    lowest = Math.max(lowest, e.y);
  }
  assert.deepEqual([e.x, e.y], [20, 29], 'out at the top');
  assert.ok(lowest <= 55, 'never fell below the run');
});

test('a human out of lining wood fetches more and carries on', () => {
  const { w, e } = mine(5);
  e.brain.items.set(ID.WOOD, 3);
  assert.ok(w.startMining(e, e.brain, e.brain.camp, 'coal', 5));
  let fetched = false;
  const f = until(w, 16000, () => {
    if (e.brain.job === 'gathering wood') fetched = true;
    return w.has(e.brain, ID.COAL) >= 5;
  });
  assert.ok(fetched, 'it went for wood');
  assert.ok(w.has(e.brain, ID.COAL) >= 5, `${w.has(e.brain, ID.COAL)} coal in ${f} steps (${e.brain.job})`);
});

test('a tunnel filled with sand is dug out; one filled with steel is dropped', () => {
  const { w, e } = mine(6);
  w.startMining(e, e.brain, e.brain.camp, 'coal', 5);
  until(w, 12000, () => w.has(e.brain, ID.COAL) >= 5);
  const ed = [...w.tunnels.edges.values()].sort((p, q) => q.len - p.len)[0];
  const a = w.tunnels.nodes.get(ed.a), k = ed.len >> 1;
  const box = new Int32Array(18);
  w.boxCells(a.x + k * ed.dx, a.y + k * ed.dy, 0, 1, box);
  for (const c of box) if (w.type[c] === 0) w.spawn(c, ID.SAND);
  e.brain.items.delete(ID.COAL);
  for (let i = 0; i < 10; i++) w.stow(e.brain, ID.WOOD);
  w.startMining(e, e.brain, e.brain.camp, 'coal', 3);
  until(w, 8000, () => w.has(e.brain, ID.COAL) >= 3);
  for (const c of box) assert.notEqual(w.type[c], ID.SAND, 'the sand was dug out');
  for (const c of box) if (w.type[c] === 0) w.spawn(c, ID.STEEL);
  const before = w.tunnels.edges.size;
  e.brain.items.delete(ID.COAL);
  w.startMining(e, e.brain, e.brain.camp, 'coal', 3);
  until(w, 4000, () => w.tunnels.edges.size < before);
  assert.ok(w.tunnels.edges.size < before, 'the stretch was dropped');
});
```

- [ ] **Step 2: Run to see them fail** — `NODE --test test/tunnels.test.js` → the situations FAIL. `startMining` still digs staircases, and `stepAlong` is not defined.

- [ ] **Step 3: Behaviour in `tunnels.js`.** Imports from `./humans.js`: `WALK_EVERY, GIVE_UP, DIG_EVERY, HELD_PICKAXE, RESOURCES, WOOD_ONLY, FUEL_R, HUT_W, USEFUL`. Constants: `const CLIMB_EVERY = 6; export const TUNNEL_WOOD = 8;`. Methods:

```js
  // Set off to mine `key` (a RESOURCES key) until it holds `goal`: plan a
  // tunnel to the nearest deposit. Wood to line it with first, if it has
  // run short before. False if there's no way (it skips that one a while).
  startMining(e, b, camp, key, goal) {
    if ((b.skip.get(key) ?? 0) > this.tick) return false;
    const set = RESOURCES[key];
    const t = this.findDeposit(e, camp, set, this.digLimit(b));
    const plan = t < 0 ? null : this.planTunnel(e, camp, t % this.w, (t / this.w) | 0);
    if (plan === null) {
      b.skip.set(key, this.tick + BAN_FOR);
      return false;
    }
    if (b.tunnelWood && this.has(b, WOOD) < TUNNEL_WOOD) {
      if (this.gather(e, b, camp, WOOD_ONLY, FUEL_R, 'gathering wood')) return true;
      if (this.has(b, WOOD) === 0) {
        b.skip.set(key, this.tick + BAN_FOR);
        return false;
      }
    }
    this.claim(b, camp, t);
    b.fetchSet = set;
    b.mineKey = key;
    b.wantN = goal;
    b.job = 'mining';
    b.tun = { tx: t % this.w, ty: (t / this.w) | 0, x: plan.x, y: plan.y, entrance: plan.entrance, route: null, legs: null, node: null };
    if (b.tool !== 0) b.held = HELD_PICKAXE;
    return true;
  },

  // Stop mining (the plan's done or can't go on).
  endTunnel(b) {
    this.release(b);
    b.tun = null;
    b.job = 'wandering';
    b.think = 0;
  },

  // Travel to the plan's start, then dig to the target, then along the seam.
  mine(e, b) {
    const t = b.tun;
    if (t === null) return this.endTunnel(b);
    if (t.legs === null) return this.tunnelGo(e, b, t);
    this.tunnelDig(e, b, t);
  },

  // Exactly onto the spot (x, y) (walking gets it close).
  snapTo(e, x, y) {
    return (e.x === x && e.y === y) || this.moveBody(e, x, y, 0, e.facing, e.gx, e.gy);
  },

  tunnelGo(e, b, t) {
    if (t.entrance) {
      if (!this.walkTo(e, b, t.x, t.y, 0, WALK_EVERY)) return;
      if (!this.snapTo(e, t.x, t.y)) return this.giveUp(e, b);
      const net = this.tunnels;
      if (net.nodes.size === 0) { net.gx = e.gx; net.gy = e.gy; }
      t.node = this.nodeAt(e.x, e.y) ?? this.addNode(e.x, e.y, true);
      t.legs = this.legsTo(e.x, e.y, t.tx, t.ty, e.gx, e.gy);
      return;
    }
    if (t.route === null) t.route = this.netRoute(e, t.x, t.y);
    const r = t.route;
    if (r === null) return this.endTunnel(b);
    if (r.outside) {
      const n = r.wps[0];
      if (!this.walkTo(e, b, n.x, n.y, 0, WALK_EVERY)) return;
      if (!this.snapTo(e, n.x, n.y)) return this.giveUp(e, b);
      r.outside = false;
    }
    while (r.wps.length > 0 && r.wps[0].x === e.x && r.wps[0].y === e.y) r.wps.shift();
    if (r.wps.length > 0) {
      this.travel(e, b, r.wps[0].x, r.wps[0].y);
      return;
    }
    // At the plan's start: a node there (splitting a run if need be), then dig.
    b.hold = true;
    const at = this.onNet(e.x, e.y);
    if (at === null) return this.endTunnel(b);
    t.node = at.node ?? this.splitEdge(at.edge, at.k);
    t.legs = this.legsTo(e.x, e.y, t.tx, t.ty, e.gx, e.gy);
  },

  // A step along the network, ending the plan if it can't go on.
  travel(e, b, wx, wy) {
    const r = this.stepAlong(e, b, wx, wy);
    if (r === 'blocked') {
      this.dropStretch(e.x, e.y, e.x + Math.sign(wx - e.x), e.y + Math.sign(wy - e.y));
      this.endTunnel(b);
    } else if (r === 'wood') {
      b.tunnelWood = true;
      this.endTunnel(b);
    } else if (r === 'wait' && ++b.stuck > GIVE_UP) this.giveUp(e, b);
  },

  // One step along the network towards waypoint (wx, wy): a spot every
  // WALK_EVERY steps (CLIMB_EVERY up or down a shaft), holding on so it
  // doesn't fall. Missing lining beside it is put back (if it has wood);
  // something in the way is dug out and lined. 'moved', 'busy', or what
  // workSpot found ('wood', 'blocked', 'wait').
  stepAlong(e, b, wx, wy) {
    b.hold = true;
    const dx = Math.sign(wx - e.x), dy = Math.sign(wy - e.y);
    const shaft = dx * e.gy - dy * e.gx === 0;
    if (++b.pace < (shaft ? CLIMB_EVERY : WALK_EVERY)) return 'busy';
    b.pace = 0;
    const a = dx * e.gy - dy * e.gx;
    const face = a > 0 ? 1 : a < 0 ? -1 : e.facing;
    if (this.moveBody(e, e.x + dx, e.y + dy, e.frame === 0 ? 1 : 0, face, e.gx, e.gy)) {
      b.stuck = 0;
      if (this.has(b, WOOD) > 0) {
        const loose = this.looseRound(e.x, e.y);
        if (loose.length > 0) this.lineCell(b, loose[0]);
      }
      return 'moved';
    }
    const r = this.workSpot(e, b, e.x + dx, e.y + dy);
    if (r === 'work') return 'busy';
    return r === 'clear' ? 'wait' : r;
  },

  // Dig the plan's legs a spot at a time from where it stands, growing the
  // network as it goes; at the target, on along the seam while it wants
  // more.
  tunnelDig(e, b, t) {
    b.hold = true;
    if (!b.fetchSet[this.type[t.ty * this.w + t.tx]] || t.legs.length === 0) {
      if (!this.wantsMore(b)) return this.endTunnel(b);
      const n = this.findDeposit(e, b.camp, b.fetchSet, this.digLimit(b), SEAM_R);
      if (n < 0) return this.endTunnel(b);
      t.tx = n % this.w;
      t.ty = (n / this.w) | 0;
      t.legs = this.legsTo(e.x, e.y, t.tx, t.ty, e.gx, e.gy);
      if (t.legs.length === 0) return this.endTunnel(b);
    }
    if (++b.pace < DIG_EVERY) return;
    b.pace = 0;
    const leg = t.legs[0], x = e.x + leg.dx, y = e.y + leg.dy;
    const r = this.workSpot(e, b, x, y);
    if (r === 'work') { b.stuck = 0; return; }
    if (r === 'wood') { b.tunnelWood = true; return this.endTunnel(b); }
    if (r === 'blocked') {
      b.skip.set(b.mineKey, this.tick + BAN_FOR);
      return this.endTunnel(b);
    }
    if (r === 'wait' || !this.moveBody(e, x, y, e.frame === 0 ? 1 : 0, leg.dx * e.gy - leg.dy * e.gx >= 0 ? 1 : -1, e.gx, e.gy)) {
      if (++b.stuck > GIVE_UP) this.giveUp(e, b);
      return;
    }
    b.stuck = 0;
    this.growTunnel(t, x, y, leg.dx, leg.dy);
    if (--leg.n === 0) t.legs.shift();
  },

  // The tunnel reached (x, y), a step (dx, dy) on from node t.node: that
  // node moves on if it's a dead end of a run going this way, else a new run
  // starts from it.
  growTunnel(t, x, y, dx, dy) {
    const net = this.tunnels, n = t.node;
    if (!n.entrance && n.edges.size === 1) {
      const ed = net.edges.get([...n.edges][0]);
      if (ed.b === n.id && ed.dx === dx && ed.dy === dy) {
        n.x = x;
        n.y = y;
        ed.len++;
        return;
      }
    }
    const m = this.addNode(x, y);
    this.addEdge(n, m);
    t.node = m;
  },

  // In the network but going somewhere else: out through the nearest
  // entrance first. True while it's doing that.
  leaveTunnel(e, b) {
    const net = this.tunnels;
    if (net.edges.size === 0 || net.gx !== e.gx || net.gy !== e.gy) return false;
    const at = this.onNet(e.x, e.y);
    if (at === null || (at.node !== null && at.node.entrance)) return false;
    const { dist, prev } = this.netDistances(this.netSources(e).src);
    let best = -1, bd = Infinity;
    for (const n of net.nodes.values()) if (n.entrance && (dist.get(n.id) ?? Infinity) < bd) { best = n.id; bd = dist.get(n.id); }
    if (best < 0) return false;
    let next = best; // the first node on the way there
    while (prev.has(next) && !(at.node !== null && prev.get(next) === at.node.id)) next = prev.get(next);
    if (at.node !== null && next === at.node.id) return false;
    const n = net.nodes.get(next);
    const r = this.stepAlong(e, b, n.x, n.y);
    if (r === 'blocked') {
      this.dropStretch(e.x, e.y, e.x + Math.sign(n.x - e.x), e.y + Math.sign(n.y - e.y));
      return false;
    }
    return r !== 'wood';
  },
```

  (Check `BAN_FOR` and `SEAM_R` are exported from humans.js and imported here.)

- [ ] **Step 4: Wire `humans.js`.**
  - In `stepHuman`, replace `if (this.fall(e)) return;` with:

```js
    // Holding on in a tunnel (a shaft, stairs), it doesn't fall.
    const hold = b.hold;
    b.hold = false;
    if (!hold && this.fall(e)) return;
```

  - In `walkTo`, as its first line: `if (this.leaveTunnel(e, b)) return false; // out of a tunnel first`.
  - In `walkTo`, remove the `deep` staircase: `const deep...` and its `(deep && ...) ||` term.
  - Delete `startMining`, `mine` and `wantsMore`'s neighbours that are now in tunnels.js. Keep `findDeposit` and `wantsMore` in humans.js.
  - `carryingOn`: `case 'mining': return b.tun !== null;`.
  - `giveUp`: after the skip line add `b.tun = null;`.

- [ ] **Step 5: Update the older mining tests.** In `test/humans-mining.test.js`:
  - `seam()` adds a log (`fillRect(w, 20, 30, 29, 39, ID.WOOD)`) and 10 wood in the pack.
  - The staircase test is renamed "a human reaches a buried seam (tunnels)", same asserts.
  - In the stone test, the "with a pickaxe" half stays. It needs no wood.
  - In `test/humans-crafting.test.js` `settled()`, add a second log (`fillRect(w, 210, 45, 221, 49, ID.WOOD)`) so tunnels have wood.

- [ ] **Step 6: Run** — `NODE --test test/tunnels.test.js test/humans-mining.test.js test/humans-crafting.test.js test/humans-situations.test.js test/humans.test.js` → PASS.

  If a situation stalls, print every 500 steps:
  - `e.x, e.y`, `e.brain.job`;
  - `e.brain.tun && { legs: e.brain.tun.legs, route: e.brain.tun.route }`;
  - the node kinds.

  Look first for:
  - a legs/route mismatch (the human not exactly on a spot: `snapTo`);
  - holding not being set.

- [ ] **Step 7: Commit** — "Humans tunnel to deposits, travel the network, climb shafts, repair".

---

### Task 4: Docs and build

- [ ] **Step 1:** README Humans paragraph:
  - Replace "digging a staircase down to them" with how tunnels work: lined with wood where dirt would fall in, at 45° steps, shared network, climbing shafts, and wood fetched when out.
  - HANDOFF: a `tunnels.js` paragraph (mask bits, `workSpot` order, network API, `planTunnel` costs, `brain.hold`, `leaveTunnel` in `walkTo`, tests).
  - Test counts.
- [ ] **Step 2:** Run the full suite, `NODE --test test/*.test.js`. All pass.
- [ ] **Step 3:** Build: `NODE scripts/build.js`.
- [ ] **Step 4:** Load the Wilderness in the preview and check there are no console errors.
- [ ] **Step 5:** Commit: "Tunnels: docs and build".
