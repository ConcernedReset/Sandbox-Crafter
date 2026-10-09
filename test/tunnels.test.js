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
