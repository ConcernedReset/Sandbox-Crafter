// Tunnels: wood-lined runs humans dig at 45° steps, kept as one network
// (tunnels.js, humans.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { newBrain } from '../src/sim/humans.js';
import { makeWorld, fillRect, run, countOf } from './helpers.js';

const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const digger = { kind: ID.HUMAN, id: -1 }; // works spots without a body

// Work the spot (x, y) until it's open.
function open(w, b, x, y) {
  for (let guard = 0; guard < 200; guard++) {
    const r = w.workSpot(digger, b, x, y);
    if (r === 'clear') return;
    assert.equal(r, 'work', `spot (${x}, ${y}): ${r}`);
  }
  assert.fail(`spot (${x}, ${y}) never opened`);
}

// Dig a run of n spots on from (x, y) the way (dx, dy), lining as it goes.
function carve(w, b, x, y, dx, dy, n) {
  for (let k = 1; k <= n; k++) open(w, b, x + k * dx, y + k * dy);
}

const woody = () => {
  const b = newBrain();
  b.items.set(ID.WOOD, 10000); // plenty
  return b;
};

for (const [dx, dy] of DIRS) {
  test(`a lined run (${dx}, ${dy}) through dirt stays open`, () => {
    const w = makeWorld(80, 80, 1);
    fillRect(w, 0, 0, 79, 79, ID.DIRT);
    const b = woody();
    open(w, b, 40, 40);
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
  open(w, b, 30, 30);
  carve(w, b, 30, 30, 1, 0, 10);
  assert.equal(countOf(w, ID.WOOD), 0);
  assert.equal(w.workSpot(digger, newBrain(), 42, 30), 'blocked', 'no pickaxe: stone stops it');
});

test('without wood, a spot that needs lining waits for it', () => {
  const w = makeWorld(40, 40, 1);
  fillRect(w, 0, 0, 39, 39, ID.DIRT);
  assert.equal(w.workSpot(digger, newBrain(), 20, 20), 'wood');
});

// A network laid out by hand: an entrance at (20, 20), stairs down to
// (30, 30), and a level run on to (60, 30).
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
  const level = [...bend.edges].map((id) => w.tunnels.edges.get(id)).find((ed) => ed.len === 30);
  const mid = w.splitEdge(level, 12);
  assert.deepEqual([mid.x, mid.y], [42, 30]);
  w.addEdge(mid, w.addNode(42, 40));
  assert.equal(w.nodeKind(mid), 'junction');
  assert.equal(w.onNet(50, 30).k, 8);
  assert.equal(w.onNet(50, 31), null);
});

test('a route through the network goes node to node, from outside by an entrance', () => {
  const w = makeWorld(100, 60, 1);
  handNet(w);
  const route = w.netRoute({ x: 5, y: 20, gx: 0, gy: 1 }, 45, 30);
  assert.equal(route.outside, true);
  assert.deepEqual(route.wps, [{ x: 20, y: 20 }, { x: 30, y: 30 }, { x: 45, y: 30 }]);
  const back = w.netRoute({ x: 45, y: 30, gx: 0, gy: 1 }, 20, 20);
  assert.equal(back.outside, false);
  assert.deepEqual(back.wps, [{ x: 30, y: 30 }, { x: 20, y: 20 }]);
});

test('dropping a stretch drops the nodes it cuts off', () => {
  const w = makeWorld(100, 60, 1);
  const { end } = handNet(w);
  w.dropStretch(40, 30, 41, 30);
  assert.equal(w.tunnels.edges.size, 1);
  assert.equal(w.tunnels.nodes.has(end.id), false);
});

test('a plan starts from the network when that is cheaper, else from a new entrance', () => {
  const w = makeWorld(160, 60, 1);
  fillRect(w, 0, 21, 159, 59, ID.DIRT);
  handNet(w);
  const camp = w.makeCamp(80, 20);
  const near = w.planTunnel({ x: 20, y: 20, gx: 0, gy: 1 }, camp, 45, 45);
  assert.deepEqual([near.x, near.y, near.entrance], [30, 30, false], 'from the bend, diagonally down');
  const far = w.planTunnel({ x: 100, y: 20, gx: 0, gy: 1 }, camp, 130, 30);
  assert.equal(far.entrance, true, 'a new entrance for something far from every tunnel');
  assert.equal(far.y, 20, 'on the surface');
  assert.deepEqual(w.legsTo(0, 0, 5, 2, 0, 1), [{ dx: 1, dy: 1, n: 2 }, { dx: 1, dy: 0, n: 3 }]);
  assert.deepEqual(w.legsTo(0, 0, 0, -4, 0, 1), [{ dx: 0, dy: -1, n: 4 }]);
});

// Fill a rectangle with t, whatever was there.
function put(w, x0, y0, x1, y1, t) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { w.clearCell(y * w.w + x); w.spawn(y * w.w + x, t); }
}

// Dirt ground at y 40, a coal seam 22 down, a log to line tunnels with, and
// a human with 10 wood.
function mineWorld(seed) {
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

// Run until `done`, sending e back to mining whenever it stops (as its
// crafting would): the steps taken.
function mineUntil(w, e, key, goal, steps, done) {
  let f = 0;
  for (; f < steps && !done(); f++) {
    const b = e.brain;
    if (b.tun === null && b.job !== 'gathering wood' && w.creatureById[e.id] === e) w.startMining(e, b, b.camp, key, goal);
    w.step();
  }
  return f;
}
const kinds = (w) => [...w.tunnels.nodes.values()].map((n) => w.nodeKind(n)).sort().join(',');
const offNet = (w, e) => { const at = w.onNet(e.x, e.y); return at === null || (at.node !== null && at.node.entrance); };

for (const seed of [1, 2, 3]) {
  test(`a human tunnels to a buried seam without wrecking the ground (seed ${seed})`, () => {
    const { w, e } = mineWorld(seed);
    const dirt = countOf(w, ID.DIRT);
    const f = mineUntil(w, e, 'coal', 5, 12000, () => w.has(e.brain, ID.COAL) >= 5);
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
  const { w, e } = mineWorld(4);
  mineUntil(w, e, 'coal', 5, 12000, () => w.has(e.brain, ID.COAL) >= 5);
  assert.ok(w.has(e.brain, ID.COAL) >= 5, 'the first seam');
  const edges = w.tunnels.edges.size;
  // Metal under the middle of the tunnel's longest run.
  const ed = [...w.tunnels.edges.values()].sort((p, q) => q.len - p.len)[0];
  const a = w.tunnels.nodes.get(ed.a), k = ed.len >> 1;
  const mx = a.x + k * ed.dx, my = a.y + k * ed.dy;
  put(w, mx - 2, my + 9, mx + 2, my + 10, ID.METAL);
  e.brain.tool = 1;
  for (let i = 0; i < 10; i++) w.stow(e.brain, ID.WOOD);
  e.brain.skip.clear();
  const f = mineUntil(w, e, 'metal', 3, 8000, () => w.has(e.brain, ID.METAL) >= 3);
  assert.ok(w.has(e.brain, ID.METAL) >= 3, `metal ${w.has(e.brain, ID.METAL)} in ${f} (${e.brain.job})`);
  assert.ok(w.tunnels.edges.size > edges, 'a new run');
  assert.match(kinds(w), /junction|bend/);
  assert.equal([...w.tunnels.nodes.values()].filter((n) => n.entrance).length, 1, 'no second entrance');
});

test('a human climbs up a shaft and out, holding on', () => {
  const w = makeWorld(80, 80, 1);
  fillRect(w, 0, 30, 79, 79, ID.DIRT);
  const b = woody();
  open(w, b, 20, 29);
  carve(w, b, 20, 29, 0, 1, 26);
  carve(w, b, 20, 55, 1, 0, 15);
  const top = w.addNode(20, 29, true), bottom = w.addNode(20, 55), end = w.addNode(35, 55);
  w.addEdge(top, bottom);
  w.addEdge(bottom, end);
  w.makeCamp(45, 29); // up on the surface: it heads for it
  w.spawn(55 * 80 + 35, ID.HUMAN);
  run(w, 40);
  const e = w.creatures[0];
  let lowest = 0, f = 0;
  for (; f < 3000 && e.y > 29; f++) {
    w.step();
    lowest = Math.max(lowest, e.y);
  }
  assert.ok(e.y <= 29, `out on the surface (at ${e.x}, ${e.y} after ${f}, ${e.brain.job})`);
  assert.ok(lowest <= 55, 'never fell below the run');
  assert.equal(w.tunnels.edges.size, 2, 'the tunnel is intact');
});

test('a human out of lining wood fetches more and carries on', () => {
  const { w, e } = mineWorld(5);
  e.brain.items.set(ID.WOOD, 3);
  let fetched = false;
  const f = mineUntil(w, e, 'coal', 5, 16000, () => {
    if (e.brain.job === 'gathering wood') fetched = true;
    return w.has(e.brain, ID.COAL) >= 5;
  });
  assert.ok(fetched, 'it went for wood');
  assert.ok(w.has(e.brain, ID.COAL) >= 5, `${w.has(e.brain, ID.COAL)} coal in ${f} steps (${e.brain.job})`);
});

test('a tunnel filled with sand is dug out; one filled with steel is dropped', () => {
  const { w, e } = mineWorld(6);
  mineUntil(w, e, 'coal', 5, 12000, () => w.has(e.brain, ID.COAL) >= 5);
  // Out it comes (its camp is up top).
  for (let f = 0; f < 4000 && !offNet(w, e); f++) w.step();
  assert.ok(offNet(w, e), 'it came out');
  const ed = [...w.tunnels.edges.values()].sort((p, q) => q.len - p.len)[0];
  const a = w.tunnels.nodes.get(ed.a), k = ed.len >> 1;
  const box = new Int32Array(18);
  w.boxCells(a.x + k * ed.dx, a.y + k * ed.dy, 0, 1, box);
  for (const c of box) if (w.type[c] === 0) w.spawn(c, ID.SAND);
  e.brain.items.delete(ID.COAL);
  for (let i = 0; i < 10; i++) w.stow(e.brain, ID.WOOD);
  mineUntil(w, e, 'coal', 3, 8000, () => w.has(e.brain, ID.COAL) >= 3);
  assert.ok(w.has(e.brain, ID.COAL) >= 3, 'mined again');
  for (const c of box) assert.notEqual(w.type[c], ID.SAND, 'the sand was dug out');
  for (const c of box) if (w.type[c] === 0) w.spawn(c, ID.STEEL);
  const before = w.tunnels.edges.size;
  for (let f = 0; f < 4000 && w.tunnels.edges.size >= before; f++) w.step();
  assert.ok(w.tunnels.edges.size < before, 'the stretch was dropped');
});
