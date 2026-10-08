// Humans: they grow like any shaped creature, then walk, swim, run from
// danger, make a campfire and build a hut (humans.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFS, ID } from '../src/sim/elements.js';
import { BREATH } from '../src/sim/humans.js';
import { makeWorld, fillRect, run, countOf } from './helpers.js';

// A human grown from a seed at (x, y).
function human(w, x, y) {
  w.spawn(y * w.w + x, ID.HUMAN);
  run(w, 12);
  const all = w.creatures.filter((c) => c.kind === ID.HUMAN);
  assert.ok(all.length > 0, 'a human hatched');
  return all.at(-1);
}

const alive = (w, e) => w.creatureById[e.id] === e;

test('a human has a 10-pixel body that grows in rings', () => {
  const w = makeWorld(40, 30);
  fillRect(w, 0, 28, 39, 29, ID.STONE);
  w.spawn(10 * 40 + 20, ID.HUMAN);
  const seen = new Set();
  for (let k = 0; k < 10; k++) { w.step(); seen.add(countOf(w, ID.HUMAN)); }
  assert.ok(seen.has(1) && seen.has(10), [...seen].join(','));
  assert.ok(seen.size >= 3, 'more than one ring');
  assert.equal(DEFS[ID.HUMAN].lifeMin, 72000);
});

test('a human runs from lava', () => {
  const w = makeWorld(120, 40);
  fillRect(w, 0, 35, 119, 39, ID.STONE);
  for (let y = 35; y <= 37; y++) {
    for (let x = 70; x <= 76; x++) { w.clearCell(y * 120 + x); w.spawn(y * 120 + x, ID.LAVA); }
  }
  const e = human(w, 60, 30);
  run(w, 300);
  assert.ok(alive(w, e), 'unhurt');
  assert.equal(e.lost, 0);
  assert.ok(e.x < 56, `ran away (x ${e.x})`);
});

test('a human in water swims up and out onto the shore', () => {
  const w = makeWorld(100, 40);
  fillRect(w, 0, 25, 99, 39, ID.STONE);
  for (let y = 25; y <= 34; y++) {
    for (let x = 20; x <= 60; x++) { w.clearCell(y * 100 + x); w.spawn(y * 100 + x, ID.WATER); }
  }
  const e = human(w, 40, 31);
  let landed = false;
  run(w, 900, () => { if (alive(w, e) && (e.x < 20 || e.x > 60) && e.y <= 24) landed = true; });
  assert.ok(landed, 'got out');
  assert.ok(alive(w, e));
});

test('a human held under water drowns slowly', () => {
  const w = makeWorld(40, 30);
  fillRect(w, 0, 0, 39, 29, ID.STONE);
  for (let y = 2; y <= 27; y++) {
    for (let x = 2; x <= 37; x++) { w.clearCell(y * 40 + x); w.spawn(y * 40 + x, ID.WATER); }
  }
  const e = human(w, 20, 15);
  run(w, BREATH + 90);
  assert.ok(alive(w, e), 'holds its breath a while');
  assert.ok(e.lost >= 1, 'then starts to drown');
  run(w, 400);
  assert.ok(!alive(w, e), 'drowned');
  assert.ok(countOf(w, ID.BONE) + countOf(w, ID.MEAT) > 0);
});

test('a human gathers wood into a pile beside its camp and lights it', () => {
  const w = makeWorld(140, 50);
  fillRect(w, 0, 45, 139, 49, ID.STONE);
  fillRect(w, 30, 42, 37, 44, ID.WOOD);
  const e = human(w, 70, 38);
  let frames = 0;
  while (!w.camps[0]?.lit && frames < 8000) { w.step(); frames++; }
  assert.ok(w.camps[0]?.lit, `the fire was lit (${frames} frames, job ${e.brain?.job})`);
  assert.ok(alive(w, e) && e.lost === 0, 'and the human is fine');
  assert.ok(w.camps[0].members.has(e.id));
  assert.ok(countOf(w, ID.WOOD) < 24, 'wood was taken from the log');
});

test('humans near each other share one camp', () => {
  const w = makeWorld(120, 40);
  fillRect(w, 0, 35, 119, 39, ID.STONE);
  w.spawn(30 * 120 + 50, ID.HUMAN);
  w.spawn(30 * 120 + 62, ID.HUMAN);
  run(w, 100);
  const people = w.creatures.filter((c) => c.kind === ID.HUMAN);
  assert.equal(people.length, 2);
  assert.equal(w.camps.length, 1);
  assert.ok(people.every((p) => p.brain.camp === w.camps[0]));
});
