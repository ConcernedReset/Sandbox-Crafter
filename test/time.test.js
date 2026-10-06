// The Time brush: areas that run at ¼×, ½×, 2× or 4× speed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, countOf, run } from './helpers.js';

const zone = (w, x0, y0, x1, y1, code) => w.paintSpeed((fn) => w.forRect(x0, y0, x1, y1, fn), code);
const QUARTER = 1, HALF = 2, DOUBLE = 3, QUADRUPLE = 4;

// How far a grain dropped at (x, 5) has fallen.
const fallen = (w, x) => {
  for (let y = 0; y < w.h; y++) if (w.type[y * w.w + x] === ID.SAND) return y - 5;
  return -1;
};

test('sand falls a quarter as fast in a ¼× area and faster in a 4× area', () => {
  const w = makeWorld(60, 200);
  zone(w, 25, 0, 35, 199, QUARTER);
  zone(w, 45, 0, 55, 199, QUADRUPLE);
  for (const x of [10, 30, 50]) w.spawn(5 * 60 + x, ID.SAND);
  run(w, 16);
  const normal = fallen(w, 10), slow = fallen(w, 30), fast = fallen(w, 50);
  assert.ok(slow < normal / 2.5, `slow ${slow} vs normal ${normal}`);
  assert.ok(fast > normal * 2, `fast ${fast} vs normal ${normal}`);
});

test('flames die down sooner in a 4× area and later in a ¼× one', () => {
  const burnout = (code) => {
    const w = makeWorld(40, 40);
    if (code) zone(w, 0, 0, 39, 39, code);
    w.paint(20, 20, 3, ID.FIRE);
    let f = 0;
    while (countOf(w, ID.FIRE) > 0 && f < 2000) { w.step(); f++; }
    return f;
  };
  const normal = burnout(0), fast = burnout(QUADRUPLE), slow = burnout(QUARTER);
  assert.ok(fast < normal / 2.5, `4×: ${fast} frames, normal: ${normal}`);
  assert.ok(slow > normal * 2.5, `¼×: ${slow} frames, normal: ${normal}`);
});

test('a photon slows down crossing a ½× area', () => {
  const at = (code) => {
    const w = makeWorld(120, 20);
    if (code) zone(w, 30, 0, 89, 19, code);
    w.spawnProjectile(ID.PHOTON, 5.5, 10.5, 3, 0);
    run(w, 20);
    return w.px[0];
  };
  assert.ok(at(HALF) < at(0) - 10, `${at(HALF).toFixed(1)} vs ${at(0).toFixed(1)}`);
});

test('heat crosses a 4× bar faster, and never overshoots', () => {
  const far = (code) => {
    const w = makeWorld(60, 10);
    fillRect(w, 5, 5, 54, 5, ID.STONE);
    if (code) zone(w, 0, 0, 59, 9, code);
    let ok = true;
    run(w, 60, () => {
      w.temp[5 * 60 + 5] = 1000;
      for (let x = 5; x < 55; x++) { const T = w.temp[5 * 60 + x]; if (T > 1000.01 || T < 21.99) ok = false; }
    });
    return { T: w.temp[5 * 60 + 12], ok };
  };
  const fast = far(QUADRUPLE), normal = far(0);
  assert.ok(fast.T > normal.T + 100, `${fast.T.toFixed(0)} vs ${normal.T.toFixed(0)}`);
  assert.ok(fast.ok, 'stayed between the two temperatures');
});

test('painting normal speed removes a zone, and Clear removes them all', () => {
  const w = makeWorld(40, 40);
  zone(w, 0, 0, 9, 9, DOUBLE);
  assert.equal(w.zoneCount, 100);
  zone(w, 0, 0, 4, 9, 0);
  assert.equal(w.zoneCount, 50);
  zone(w, 20, 20, 29, 29, QUARTER);
  w.clearAll();
  assert.equal(w.zoneCount, 0);
  assert.ok(w.speed.every((v) => v === 0));
});
