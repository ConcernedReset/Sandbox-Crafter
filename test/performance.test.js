// The performance setting: quality levels in the world, and Auto.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, run } from './helpers.js';
import { AutoQuality, AUTO_DOWN, AUTO_UP, loadPerformance, savePerformance } from '../src/game/performance.js';

test('Medium conducts heat at about the same speed for half the work, and never overshoots', () => {
  // The heat that has flowed into a bar from a hot end.
  const flowed = (level, element) => {
    const w = makeWorld(60, 10);
    w.sleeping = false;
    w.setQuality(level);
    fillRect(w, 5, 5, 54, 5, element);
    let ok = true;
    run(w, 100, () => {
      w.temp[5 * 60 + 5] = 1000;
      for (let x = 5; x < 55; x++) { const T = w.temp[5 * 60 + x]; if (T > 1000.01 || T < 21.9) ok = false; }
    });
    assert.ok(ok, `${level} stayed between the two temperatures`);
    let heat = 0;
    for (let x = 6; x < 55; x++) heat += w.temp[5 * 60 + x] - 22;
    return heat;
  };
  for (const element of [ID.METAL, ID.STONE]) {
    const high = flowed('high', element), medium = flowed('medium', element);
    assert.ok(Math.abs(medium - high) < high * 0.1, `high ${high.toFixed(0)}, medium ${medium.toFixed(0)}`);
  }
});

test('Medium steps the air every other step', () => {
  const w = makeWorld(40, 20);
  w.setQuality('medium');
  w.pressurize(20, 10, 3, 30); // keep the air busy
  let steps = 0;
  const real = w.air.step.bind(w.air);
  w.air.step = (g) => { steps++; return real(g); };
  run(w, 10);
  assert.equal(steps, 5);
});

test('Low launches at most 4,000 flying particles', () => {
  const w = makeWorld(100, 100);
  w.setQuality('low');
  for (let k = 0; k < 5000; k++) w.spawnProjectile(ID.PHOTON, 50.5, 50.5, 0, 0);
  assert.equal(w.pn, 4000);
  w.setQuality('high');
  for (let k = 0; k < 1000; k++) w.spawnProjectile(ID.PHOTON, 50.5, 50.5, 0, 0);
  assert.equal(w.pn, 5000);
});

test('Auto drops a level after a second of slow frames and climbs back after three quick seconds', () => {
  const a = new AutoQuality();
  assert.equal(a.level, 'high');
  for (let f = 0; f < AUTO_DOWN - 1; f++) a.feed(25);
  assert.equal(a.level, 'high', 'not yet');
  a.feed(25);
  assert.equal(a.level, 'medium');
  for (let f = 0; f < AUTO_DOWN; f++) a.feed(25);
  assert.equal(a.level, 'low');
  for (let f = 0; f < AUTO_DOWN; f++) a.feed(25);
  assert.equal(a.level, 'low', 'no lower than Low');
  for (let f = 0; f < AUTO_UP; f++) a.feed(4);
  assert.equal(a.level, 'medium');
  for (let f = 0; f < AUTO_UP - 1; f++) a.feed(4);
  a.feed(12); // in between: neither slow nor quick, starts the count again
  for (let f = 0; f < AUTO_UP - 1; f++) a.feed(4);
  assert.equal(a.level, 'medium');
  a.feed(4);
  assert.equal(a.level, 'high');
});

test('the Performance choice is saved; bad storage gives Auto', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  savePerformance('low', storage);
  assert.equal(loadPerformance(storage), 'low');
  store.set('sandbox-crafter:performance', '"fastest"');
  assert.equal(loadPerformance(storage), 'auto');
  assert.equal(loadPerformance(undefined), 'auto');
});
