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
