import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Air } from '../src/sim/air.js';
import { Gravity } from '../src/sim/gravity.js';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, wallBox, countOf, meanY, run } from './helpers.js';

function meanX(world, t) {
  let sum = 0, n = 0;
  for (let i = 0; i < world.type.length; i++) if (world.type[i] === t) { sum += i % world.w; n++; }
  return n ? sum / n : NaN;
}

const B = 12; // an air block inside a 10 x 6 grid

test('straight down at strength 1 is the old gravity, exactly', () => {
  const g = new Gravity(new Air(10, 6));
  assert.equal(g.gx[B], 0);
  assert.ok(Object.is(g.ux[B], 0), 'no negative zero');
  assert.equal(g.gy[B], 1);
  assert.equal(g.mag[B], 1);
  assert.equal(g.dirA[B], 0);
  assert.equal(g.mix[B], 0);
  assert.deepEqual([g.downX, g.downY, g.scanRows, g.scanCols], [0, 1, 1, 0]);
  assert.deepEqual([g.gasDir, g.gasMix, g.lift, g.gasUx, g.gasUy], [0, 0, 1, 0, 1]);
});

test('the arrow turns gravity: left, up, and angles in between', () => {
  const g = new Gravity(new Air(10, 6));
  g.set({ angle: 90 });
  assert.deepEqual([g.gx[B], g.gy[B], g.dirA[B], g.mix[B]], [-1, 0, 2, 0]);
  assert.deepEqual([g.downX, g.downY, g.scanRows, g.scanCols], [-1, 0, 0, -1]);
  g.set({ angle: 180 });
  assert.deepEqual([g.gx[B], g.gy[B], g.dirA[B], g.scanRows], [0, -1, 4, -1]);
  g.set({ angle: 30 });
  assert.equal(g.dirA[B], 0);
  assert.equal(g.dirB[B], 1);
  assert.ok(Math.abs(g.mix[B] - 30 / 45) < 1e-6);
  assert.deepEqual([g.downX, g.downY], [0, 1]);
  g.set({ angle: 300 });
  assert.deepEqual([g.dirA[B], g.dirB[B], g.downX, g.downY], [6, 7, 1, 0]);
});

test('strength scales the pull and stays between 0 and 10; angles wrap', () => {
  const g = new Gravity(new Air(10, 6));
  g.set({ strength: 2.5 });
  assert.equal(g.mag[B], 2.5);
  g.set({ strength: 50 });
  assert.equal(g.strength, 10);
  g.set({ strength: 0 });
  assert.deepEqual([g.mag[B], g.dirA[B], g.scanRows, g.gasUy, g.lift], [0, -1, 0, 0, 0]);
  assert.deepEqual([g.downX, g.downY], [0, 1], 'the arrow still points somewhere');
  g.set({ angle: -90 });
  assert.equal(g.angle, 270);
  g.set({ angle: 725 });
  assert.equal(g.angle, 5);
});

// ---- movement ---------------------------------------------------------------

test('sideways gravity piles sand against the side wall', () => {
  const w = makeWorld(60, 40);
  wallBox(w, 0, 0, 59, 39);
  fillRect(w, 25, 10, 35, 20, ID.SAND);
  w.setGravity({ angle: 90 }); // pulls left
  run(w, 300);
  assert.equal(countOf(w, ID.SAND), 121);
  assert.ok(meanX(w, ID.SAND) < 8, `sand at x ${meanX(w, ID.SAND).toFixed(1)}`);
});

test('upside-down gravity sends water to the ceiling and steam to the floor', () => {
  const w = makeWorld(40, 40);
  wallBox(w, 0, 0, 39, 39);
  fillRect(w, 5, 25, 34, 34, ID.WATER);
  w.setGravity({ angle: 180 });
  run(w, 300);
  assert.ok(meanY(w, ID.WATER) < 12, `water at y ${meanY(w, ID.WATER).toFixed(1)}`);
  const s = makeWorld(40, 40);
  wallBox(s, 0, 0, 39, 39);
  fillRect(s, 10, 5, 29, 12, ID.STEAM);
  s.setGravity({ angle: 180 });
  run(s, 150);
  assert.ok(meanY(s, ID.STEAM) > 25, `steam at y ${meanY(s, ID.STEAM).toFixed(1)}`);
});

test('a slanted arrow slants the fall', () => {
  const w = makeWorld(120, 120);
  fillRect(w, 80, 5, 84, 9, ID.SAND);
  w.setGravity({ angle: 30 }); // down and a little to the left
  const x0 = meanX(w, ID.SAND), y0 = meanY(w, ID.SAND);
  run(w, 25);
  const dx = meanX(w, ID.SAND) - x0, dy = meanY(w, ID.SAND) - y0;
  assert.ok(dy > 10, `fell ${dy.toFixed(1)}`);
  const slope = -dx / dy; // tan 30° is 0.58
  assert.ok(slope > 0.35 && slope < 0.85, `slope ${slope.toFixed(2)}`);
});

test('with no gravity sand hangs in the air, and double gravity falls faster', () => {
  const w = makeWorld(60, 60);
  fillRect(w, 25, 10, 34, 19, ID.SAND);
  w.setGravity({ strength: 0 });
  const y0 = meanY(w, ID.SAND);
  run(w, 120);
  assert.ok(Math.abs(meanY(w, ID.SAND) - y0) < 0.5, 'still hanging');
  const one = makeWorld(60, 200), two = makeWorld(60, 200);
  for (const v of [one, two]) fillRect(v, 25, 0, 34, 4, ID.SAND);
  two.setGravity({ strength: 2 });
  run(one, 20);
  run(two, 20);
  assert.ok(meanY(two, ID.SAND) > meanY(one, ID.SAND) + 3,
    `${meanY(two, ID.SAND).toFixed(1)} vs ${meanY(one, ID.SAND).toFixed(1)}`);
});

test('gases rise against the arrow', () => {
  const w = makeWorld(80, 40);
  wallBox(w, 0, 0, 79, 39);
  fillRect(w, 35, 15, 44, 24, ID.STEAM);
  w.setGravity({ angle: 90 }); // pulls left, so steam drifts right
  const x0 = meanX(w, ID.STEAM);
  run(w, 150);
  assert.ok(meanX(w, ID.STEAM) > x0 + 10, `steam moved ${(meanX(w, ID.STEAM) - x0).toFixed(1)}`);
});

// ---- behaviours ---------------------------------------------------------------

test('a firework climbs against a sideways arrow', () => {
  const w = makeWorld(80, 40);
  const i = 20 * 80 + 60;
  w.spawn(i, ID.FIREWORK);
  w.ctype[i] = 1;
  w.life[i] = 30;
  w.setGravity({ angle: 270 }); // pulls right, so it climbs left
  run(w, 5);
  let x = -1;
  for (let k = 0; k < w.type.length; k++) if (w.type[k] === ID.FIREWORK) x = k % 80;
  assert.ok(x >= 0 && x < 55, `firework at x ${x}`);
});

test('a seed under a ceiling of dirt grows its trunk downwards when gravity points up', () => {
  const w = makeWorld(40, 40);
  fillRect(w, 5, 0, 34, 3, ID.DIRT);
  w.spawn(20 * 40 + 20, ID.SEED);
  w.setGravity({ angle: 180 });
  run(w, 600);
  let deepest = -1;
  for (let k = 0; k < w.type.length; k++) if (w.type[k] === ID.WOOD) deepest = Math.max(deepest, (k / 40) | 0);
  assert.ok(deepest > 6, `trunk reaches y ${deepest}`);
});

test('clouds rain along the arrow', () => {
  const w = makeWorld(60, 60);
  fillRect(w, 25, 25, 34, 29, ID.CLOUD);
  w.setGravity({ angle: 90, strength: 0 }); // no pull, but rain still leaves on the left
  run(w, 400);
  let left = 0, right = 0;
  for (let k = 0; k < w.type.length; k++) {
    if (w.type[k] !== ID.WATER) continue;
    if (k % 60 < 25) left++; else if (k % 60 > 34) right++;
  }
  assert.ok(left > right, `${left} drops left, ${right} right`);
});

test('the general movement code gives the same results as the straight-down fast path', () => {
  // The same seeded scene twice, one forced through the general code.
  const make = () => {
    const w = makeWorld(80, 60, 5);
    wallBox(w, 0, 0, 79, 59);
    fillRect(w, 5, 5, 30, 20, ID.SAND);
    fillRect(w, 40, 10, 70, 25, ID.WATER);
    fillRect(w, 35, 40, 45, 50, ID.STEAM);
    fillRect(w, 10, 45, 20, 50, ID.OIL);
    return w;
  };
  const fast = make(), general = make();
  general.setGravity({ strength: 1 });
  general.gravity.straight = false;
  for (let f = 0; f < 200; f++) { fast.step(); general.step(); }
  const fold = (a) => Array.from(a, (v) => v + 0);
  assert.deepEqual(general.type, fast.type);
  assert.deepEqual(fold(general.vx), fold(fast.vx));
  assert.deepEqual(fold(general.vy), fold(fast.vy));
});
