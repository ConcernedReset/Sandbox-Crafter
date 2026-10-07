// Sleeping areas: what isn't changing isn't simulated, until something
// reaches it. The world must behave just as it would awake.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, run } from './helpers.js';

test('the air rests when it is still, and wakes when stirred', () => {
  const w = makeWorld(80, 40);
  w.setConvection(true);
  run(w, 5);
  assert.equal(w.air.still, true, 'still air rests');
  w.pressurize(40, 20, 3, 5);
  run(w, 1);
  assert.equal(w.air.still, false, 'a puff wakes it');
  run(w, 2000);
  assert.equal(w.air.still, true, 'and it settles again');
  assert.ok(w.air.p.every((v) => v === 0), 'settled to exactly nothing');
});
