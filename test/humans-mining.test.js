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

// A human on the ground with a coal seam buried under it, 22 cells down,
// and a log on the surface for lining tunnels with. (Tunnelling itself is
// tested in tunnels.test.js.)
function seam(seed, under = ID.DIRT) {
  const w = makeWorld(160, 90, seed);
  fillRect(w, 0, 85, 159, 89, ID.STONE);
  fillRect(w, 0, 40, 159, 84, under);
  put(w, 100, 62, 108, 65, ID.COAL);
  fillRect(w, 20, 30, 29, 39, ID.WOOD);
  w.spawn(30 * 160 + 60, ID.HUMAN);
  run(w, 80);
  const e = w.creatures[0];
  e.brain.camp = w.joinOrMakeCamp(e);
  return { w, e };
}

// Run up to `steps`, sending e back to mining whenever it stops (as its
// crafting would), until it holds `goal` coal: the steps taken.
function mineCoal(w, e, goal, steps, also = () => {}, stop = () => false) {
  let f = 0;
  for (; f < steps && w.has(e.brain, ID.COAL) < goal && !stop(); f++) {
    const b = e.brain;
    if (b.tun === null && b.job !== 'gathering wood') w.startMining(e, b, b.camp, 'coal', goal);
    also();
    w.step();
  }
  return f;
}

test('without a pickaxe, a seam under stone is given up on; with one, it is mined', () => {
  const { w, e } = seam(1, ID.STONE);
  mineCoal(w, e, 5, 4000, () => {}, () => e.brain.skip.get('coal') > w.tick);
  assert.ok(e.brain.skip.get('coal') > w.tick, `skipped for a while (${e.brain.job})`);
  assert.equal(w.has(e.brain, ID.COAL), 0);
  e.brain.tool = 1;
  e.brain.skip.clear();
  e.brain.banned.clear();
  const f = mineCoal(w, e, 5, 12000);
  assert.ok(w.has(e.brain, ID.COAL) >= 5, `mined ${w.has(e.brain, ID.COAL)} in ${f} steps (${e.brain.job})`);
});

test('useful things dug through go into its pockets', () => {
  const { w, e } = seam(2);
  put(w, 60, 40, 108, 61, ID.WOOD); // a buried timber layer over the seam
  let pocketed = false, last = 0;
  const f = mineCoal(w, e, 5, 12000, () => {
    const wood = w.has(e.brain, ID.WOOD);
    if (e.brain.job === 'mining' && wood > last) pocketed = true;
    last = wood;
  });
  assert.ok(w.has(e.brain, ID.COAL) >= 5, `mined ${w.has(e.brain, ID.COAL)} in ${f} steps (${e.brain.job})`);
  assert.ok(pocketed, 'timber dug through while mining went into its pack');
});

test('the Wilderness has coal, salt and metal buried in it', () => {
  const w = makeWorld(400, 240, 1);
  loadScene(w, 'wilderness');
  const n = (t) => w.type.reduce((s, u) => s + (u === t), 0);
  assert.ok(n(ID.SALT) > 0 && n(ID.METAL) > 0 && n(ID.COPPER) > 0);
  assert.ok(n(ID.COAL) > 250, 'more than the cliff seam');
});
