// Humans in many situations, each tried with several random seeds: they
// must get their fire lit (and their hut built) where they can, and never
// come to harm doing it (humans.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { loadScene } from '../src/game/scenes.js';
import { makeWorld, fillRect } from './helpers.js';

const SEEDS = [1, 2, 3];

// Run a built world for up to `steps`, watching its humans. Returns when
// `until` is true (or the time is up) what happened: whether a camp was lit
// or a hut finished, and whether any human was hurt badly or died.
function watch(w, steps, until = () => false) {
  w.step();
  const seen = new Map(); // id -> the human
  let worst = 0, litAt = -1, hutAt = -1, f = 0;
  for (; f < steps; f++) {
    w.step();
    for (const e of w.creatures) if (e.kind === ID.HUMAN) seen.set(e.id, e);
    for (const e of seen.values()) if (w.creatureById[e.id] === e) worst = Math.max(worst, e.lost);
    if (litAt < 0 && w.camps.some((c) => c.lit)) litAt = f;
    if (hutAt < 0 && w.camps.some((c) => c.hut?.done)) hutAt = f;
    if (until(w)) break;
  }
  const people = [...seen.values()];
  const dead = people.filter((e) => w.creatureById[e.id] !== e).length;
  return { people: people.length, dead, worst, litAt, hutAt, frames: f, jobs: people.map((e) => e.brain?.job).join(', ') };
}

const lit = (w) => w.camps.some((c) => c.lit);
const hut = (w) => w.camps.some((c) => c.hut?.done);

// The same situation with each seed: `check` sees what happened.
function situation(name, build, steps, until, check) {
  for (const seed of SEEDS) {
    test(`${name} (seed ${seed})`, () => {
      const r = watch(build(seed), steps, until);
      assert.equal(r.dead, 0, `nobody dies (${JSON.stringify(r)})`);
      assert.ok(r.worst <= 1, `nobody badly hurt (${JSON.stringify(r)})`);
      check(r);
    });
  }
}

// A flat stone floor with wood and stone on it, `n` humans.
function flat(seed, { n = 1, floor = ID.STONE, wood = [30, 39], stone = [120, 129], width = 160, at = 80 } = {}) {
  const w = makeWorld(width, 60, seed);
  fillRect(w, 0, 55, width - 1, 59, floor);
  if (wood) fillRect(w, wood[0], 50, wood[1], 54, ID.WOOD);
  if (stone) fillRect(w, stone[0], 46, stone[1], 54, ID.STONE);
  for (let k = 0; k < n; k++) w.spawn(45 * width + at + k * 12, ID.HUMAN);
  return w;
}

situation('a lone human lights its fire and builds its hut', (s) => flat(s), 16000, hut,
  (r) => assert.ok(r.hutAt >= 0, `hut built (${JSON.stringify(r)})`));

situation('three humans on grass build a hut without getting in each other\'s way', (s) => {
  const w = flat(s, { n: 3, floor: ID.DIRT });
  fillRect(w, 0, 54, 159, 54, ID.GRASS);
  return w;
}, 12000, hut, (r) => assert.ok(r.hutAt >= 0, `hut built (${JSON.stringify(r)})`));

situation('a human keeps a coal fire going without getting burnt', (s) => {
  const w = flat(s, { wood: null, stone: null });
  fillRect(w, 40, 51, 47, 54, ID.COAL);
  return w;
}, 8000, () => false, (r) => assert.ok(r.litAt >= 0, `lit (${JSON.stringify(r)})`));

situation('a human fetches wood from far across the world', (s) => flat(s, { width: 300, wood: [40, 49], stone: [270, 279], at: 150 }),
  9000, lit, (r) => assert.ok(r.litAt >= 0, `lit (${JSON.stringify(r)})`));

situation('a human climbs terraces to reach the wood', (s) => {
  const w = flat(s, { wood: null, stone: null });
  // A terrace at the left, five cells up, reached by steps of two and one.
  fillRect(w, 0, 50, 25, 54, ID.STONE);
  fillRect(w, 26, 52, 31, 54, ID.STONE);
  fillRect(w, 32, 54, 37, 54, ID.STONE);
  fillRect(w, 2, 45, 9, 49, ID.WOOD);
  return w;
}, 9000, lit, (r) => assert.ok(r.litAt >= 0, `lit (${JSON.stringify(r)})`));

situation('a human swims across a pond for the wood on the far side', (s) => {
  const w = makeWorld(160, 60, s);
  fillRect(w, 0, 45, 159, 59, ID.STONE);
  for (let y = 45; y <= 52; y++) for (let x = 50; x <= 80; x++) { w.clearCell(y * 160 + x); w.spawn(y * 160 + x, ID.WATER); }
  fillRect(w, 20, 40, 27, 44, ID.WOOD);
  w.spawn(35 * 160 + 110, ID.HUMAN);
  return w;
}, 10000, lit, (r) => assert.ok(r.litAt >= 0, `lit (${JSON.stringify(r)})`));

situation('a human dropped into a pit lights its fire without burning itself', (s) => {
  const w = makeWorld(120, 60, s);
  fillRect(w, 0, 50, 119, 59, ID.STONE);
  fillRect(w, 0, 47, 52, 49, ID.STONE);
  fillRect(w, 60, 47, 119, 49, ID.STONE);
  fillRect(w, 20, 42, 27, 46, ID.WOOD);
  w.spawn(40 * 120 + 56, ID.HUMAN);
  return w;
}, 6000, () => false, () => {});

situation('a human on rolling hills keeps safe by its fire', (s) => {
  const w = makeWorld(200, 80, s);
  const g = (x) => Math.round(55 + Math.sin(x / 37) * 8 + Math.sin(x / 13 + 1.7) * 3);
  for (let x = 0; x < 200; x++) fillRect(w, x, g(x), x, 79, ID.DIRT);
  for (const x of [30, 150]) fillRect(w, x, g(x) - 5, x + 6, g(x) - 1, ID.WOOD);
  fillRect(w, 175, g(175) - 8, 182, g(175) - 1, ID.STONE);
  for (const x of [90, 105]) w.spawn((g(x) - 10) * 200 + x, ID.HUMAN);
  return w;
}, 6000, () => false, (r) => assert.ok(r.litAt >= 0, `lit (${JSON.stringify(r)})`));

situation('a human dropped from high up lands and gets on with it', (s) => {
  const w = makeWorld(120, 120, s);
  fillRect(w, 0, 115, 119, 119, ID.STONE);
  fillRect(w, 20, 110, 27, 114, ID.WOOD);
  w.spawn(5 * 120 + 60, ID.HUMAN);
  return w;
}, 6000, lit, (r) => assert.ok(r.litAt >= 0, `lit (${JSON.stringify(r)})`));

situation('a human with gravity pulling sideways still makes its fire', (s) => {
  const w = makeWorld(80, 160, s);
  w.setGravity({ angle: 90 });
  fillRect(w, 0, 0, 4, 159, ID.STONE);
  fillRect(w, 5, 30, 9, 37, ID.WOOD);
  w.spawn(80 * 80 + 15, ID.HUMAN);
  return w;
}, 6000, lit, (r) => assert.ok(r.litAt >= 0, `lit (${JSON.stringify(r)})`));

situation('wood floating out of reach does not keep a human from the log it can reach', (s) => {
  const w = flat(s, { wood: [110, 119], stone: null });
  fillRect(w, 72, 22, 92, 34, ID.WOOD); // a block hanging in the air, nearer
  return w;
}, 9000, lit, (r) => assert.ok(r.litAt >= 0, `lit (${JSON.stringify(r)})`));

situation('a human with nothing to burn wanders about unharmed', (s) => flat(s, { wood: null, stone: null }),
  3000, () => false, (r) => assert.equal(r.litAt, -1));

situation('a human walled into a little room stays put, unharmed', (s) => {
  const w = makeWorld(60, 40, s);
  fillRect(w, 0, 0, 59, 39, ID.STONE);
  for (let y = 20; y <= 34; y++) for (let x = 20; x <= 34; x++) w.clearCell(y * 60 + x);
  w.spawn(25 * 60 + 27, ID.HUMAN);
  return w;
}, 3000, () => false, () => {});

situation('humans in the Wilderness light a fire and nobody gets hurt', (s) => {
  const w = makeWorld(400, 240, s);
  loadScene(w, 'wilderness');
  return w;
}, 6000, lit, (r) => {
  assert.equal(r.people, 3);
  assert.ok(r.litAt >= 0, `lit (${JSON.stringify(r)})`);
});

situation('five humans crowded together share the work without harm', (s) => flat(s, { n: 5, at: 60 }), 12000, hut,
  (r) => {
    assert.equal(r.people, 5);
    assert.ok(r.hutAt >= 0, `hut built (${JSON.stringify(r)})`);
  });

situation('humans dropped into the starting area with a log light a fire', (s) => {
  const w = makeWorld(400, 240, s);
  loadScene(w, 'start');
  let top = 0;
  while (w.type[top * 400 + 175] === 0) top++;
  fillRect(w, 170, top - 6, 179, top - 1, ID.WOOD); // a log on the ground
  for (const x of [190, 205]) w.spawn(150 * 400 + x, ID.HUMAN);
  return w;
}, 8000, lit, (r) => assert.ok(r.litAt >= 0, `lit (${JSON.stringify(r)})`));

test('two humans keep going for a long time: fire, hut, and no harm', () => {
  const r = watch(flat(7, { n: 2 }), 20000);
  assert.equal(r.dead, 0, JSON.stringify(r));
  assert.ok(r.worst <= 1, JSON.stringify(r));
  assert.ok(r.litAt >= 0 && r.hutAt >= 0, JSON.stringify(r));
});
