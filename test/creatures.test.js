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
