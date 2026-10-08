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
