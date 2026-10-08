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
