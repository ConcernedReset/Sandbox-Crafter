// Void edges: anything that moves out of the world there vanishes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, countOf, run } from './helpers.js';

test('a void floor drains sand away; a solid one keeps it', () => {
  const solid = makeWorld(40, 40), open = makeWorld(40, 40);
  for (const w of [solid, open]) fillRect(w, 15, 20, 24, 29, ID.SAND);
  open.setVoidEdges({ bottom: true });
  run(solid, 200);
  run(open, 200);
  assert.equal(countOf(solid, ID.SAND), 100);
  assert.equal(countOf(open, ID.SAND), 0);
});

test('water flows off a void side wall', () => {
  const w = makeWorld(60, 30);
  fillRect(w, 0, 29, 59, 29, ID.STONE);
  fillRect(w, 38, 20, 57, 28, ID.WATER); // a puddle near the right-hand side
  w.setVoidEdges({ right: true });
  const before = countOf(w, ID.WATER);
  run(w, 600);
  assert.ok(countOf(w, ID.WATER) < before / 4, `${countOf(w, ID.WATER)} of ${before} left`);
});

test('steam rises out of a void roof', () => {
  const w = makeWorld(40, 40);
  fillRect(w, 10, 25, 29, 34, ID.STEAM);
  w.setVoidEdges({ top: true });
  run(w, 400);
  assert.ok(countOf(w, ID.STEAM) < 20, `${countOf(w, ID.STEAM)} steam left`);
});

test('a still floor of stone on a void edge stays put', () => {
  const w = makeWorld(40, 20);
  fillRect(w, 0, 19, 39, 19, ID.STONE);
  fillRect(w, 10, 10, 19, 18, ID.SAND);
  w.setVoidEdges({ bottom: true, left: true, right: true, top: true });
  run(w, 200);
  assert.equal(countOf(w, ID.STONE), 40);
  assert.equal(countOf(w, ID.SAND), 90, 'the sand rests on the stone');
});
