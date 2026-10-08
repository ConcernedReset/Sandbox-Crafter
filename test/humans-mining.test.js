// Humans mine: a pickaxe lets them dig harder things, and they dig down to
// buried coal, salt and metal (humans.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { HAND_DIG, TOOL_DIG } from '../src/sim/humans.js';
import { loadScene } from '../src/game/scenes.js';
import { makeWorld, fillRect, run } from './helpers.js';

// Fill a rectangle with t, whatever was there.
function put(w, x0, y0, x1, y1, t) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      w.clearCell(y * w.w + x);
      w.spawn(y * w.w + x, t);
    }
  }
}

test('a pickaxe digs stone and metal, but not steel', () => {
  const w = makeWorld(10, 10);
  w.spawn(5, ID.STONE);
  w.spawn(6, ID.METAL);
  w.spawn(7, ID.STEEL);
  w.spawn(8, ID.SAND);
  assert.equal(w.diggable(5, HAND_DIG), false);
  assert.equal(w.diggable(5, TOOL_DIG), true);
  assert.equal(w.diggable(6, TOOL_DIG), true);
  assert.equal(w.diggable(7, TOOL_DIG), false);
  assert.equal(w.diggable(8, HAND_DIG), true);
});

// A human on the ground with a coal seam buried under it, 22 cells down.
function seam(seed, under = ID.DIRT) {
  const w = makeWorld(160, 90, seed);
  fillRect(w, 0, 85, 159, 89, ID.STONE);
  fillRect(w, 0, 40, 159, 84, under);
  put(w, 100, 62, 108, 65, ID.COAL);
  w.spawn(30 * 160 + 60, ID.HUMAN);
  run(w, 80);
  const e = w.creatures[0];
  e.brain.camp = w.joinOrMakeCamp(e);
  return { w, e };
}

for (const seed of [1, 2, 3]) {
  test(`a human digs a staircase down to a buried coal seam (seed ${seed})`, () => {
    const { w, e } = seam(seed);
    assert.ok(w.startMining(e, e.brain, e.brain.camp, 'coal', 5), 'it found the seam');
    let f = 0;
    for (; f < 6000 && w.has(e.brain, ID.COAL) < 5; f++) w.step();
    assert.equal(w.creatureById[e.id], e, 'alive');
    assert.ok(w.has(e.brain, ID.COAL) >= 5, `mined ${w.has(e.brain, ID.COAL)} in ${f} steps (${e.brain.job})`);
  });
}

test('without a pickaxe, a seam under stone is given up on; with one, it is mined', () => {
  const { w, e } = seam(1, ID.STONE);
  assert.ok(w.startMining(e, e.brain, e.brain.camp, 'coal', 5));
  for (let f = 0; f < 2000 && !(e.brain.skip.get('coal') > w.tick); f++) w.step();
  assert.ok(e.brain.skip.get('coal') > w.tick, `skipped for a while (${e.brain.job})`);
  assert.equal(w.has(e.brain, ID.COAL), 0);
  e.brain.tool = 1;
  e.brain.skip.clear();
  e.brain.banned.clear();
  assert.ok(w.startMining(e, e.brain, e.brain.camp, 'coal', 5));
  let f = 0;
  for (; f < 8000 && w.has(e.brain, ID.COAL) < 5; f++) w.step();
  assert.ok(w.has(e.brain, ID.COAL) >= 5, `mined ${w.has(e.brain, ID.COAL)} in ${f} steps (${e.brain.job})`);
});

test('useful things dug through on the way go into its pockets', () => {
  const { w, e } = seam(2);
  put(w, 60, 40, 108, 61, ID.WOOD); // a buried timber layer over the seam
  w.startMining(e, e.brain, e.brain.camp, 'coal', 5);
  for (let f = 0; f < 6000 && w.has(e.brain, ID.COAL) < 5; f++) w.step();
  assert.ok(w.has(e.brain, ID.WOOD) > 0, 'it kept some wood');
});

test('the Wilderness has coal, salt and metal buried in it', () => {
  const w = makeWorld(400, 240, 1);
  loadScene(w, 'wilderness');
  const n = (t) => w.type.reduce((s, u) => s + (u === t), 0);
  assert.ok(n(ID.SALT) > 0 && n(ID.METAL) > 0 && n(ID.COPPER) > 0);
  assert.ok(n(ID.COAL) > 250, 'more than the cliff seam');
});
