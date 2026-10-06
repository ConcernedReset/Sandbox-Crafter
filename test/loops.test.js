// Looping edges: opposite edges of the world join up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, countOf, run } from './helpers.js';

test('sand falling off the bottom of a top-bottom loop comes in at the top', () => {
  const w = makeWorld(40, 40);
  w.setEdges({ top: 'loop', bottom: 'loop' });
  fillRect(w, 18, 30, 21, 33, ID.SAND);
  let high = 0;
  run(w, 40, () => { for (let i = 0; i < 40 * 10; i++) if (w.type[i] === ID.SAND) high++; });
  assert.equal(countOf(w, ID.SAND), 16, 'no sand lost');
  assert.ok(high > 0, 'sand came in at the top');
});

test('water flows across the join of a left-right loop', () => {
  const w = makeWorld(60, 20);
  w.setEdges({ left: 'loop', right: 'loop' });
  fillRect(w, 0, 19, 59, 19, ID.WALL); // floor
  fillRect(w, 30, 0, 30, 18, ID.WALL); // a dam: the water can only spread right, across the join
  fillRect(w, 48, 10, 59, 18, ID.WATER);
  run(w, 300);
  let across = 0;
  for (let y = 0; y < 20; y++) for (let x = 0; x < 15; x++) if (w.type[y * 60 + x] === ID.WATER) across++;
  assert.ok(across > 10, `${across} water cells came round the join`);
});

test('a void edge still swallows things and setVoidEdges still works', () => {
  const a = makeWorld(30, 20);
  a.setEdges({ bottom: 'void' });
  fillRect(a, 10, 15, 12, 17, ID.SAND);
  run(a, 30);
  assert.equal(countOf(a, ID.SAND), 0);
  const b = makeWorld(30, 20);
  b.setVoidEdges({ bottom: true });
  assert.equal(b.loopX || b.loopY, false);
  fillRect(b, 10, 15, 12, 17, ID.SAND);
  run(b, 30);
  assert.equal(countOf(b, ID.SAND), 0);
});

test('a loop overrides a void on the other side of the pair', () => {
  const w = makeWorld(30, 20);
  w.setEdges({ left: 'loop', right: 'void' });
  assert.equal(w.loopX, true);
  assert.equal(w.voidEdges, 0);
});

test('heat conducts across the join', () => {
  const w = makeWorld(40, 10);
  w.setEdges({ left: 'loop', right: 'loop' });
  fillRect(w, 0, 5, 3, 5, ID.METAL);
  fillRect(w, 36, 5, 39, 5, ID.METAL);
  for (let x = 36; x < 40; x++) w.temp[5 * 40 + x] = 1000;
  run(w, 30);
  assert.ok(w.temp[5 * 40] > 100, `the far end of the join warmed to ${w.temp[5 * 40].toFixed(0)}`);
});

test('a gust of pressure crosses the join', () => {
  const most = (loop) => {
    const w = makeWorld(80, 40);
    if (loop) w.setEdges({ left: 'loop', right: 'loop' });
    w.pressurize(76, 20, 3, 60);
    let m = 0;
    run(w, 20, () => { m = Math.max(m, w.pressureAt(4, 20)); });
    return m;
  };
  const looped = most(true), plain = most(false);
  assert.ok(looped > 2, `across the join it reached ${looped.toFixed(2)}`);
  assert.ok(plain < 0.5, `without the loop ${plain.toFixed(2)}`);
});

test('a world looped on all four sides is sealed: it keeps its pressure', () => {
  const w = makeWorld(60, 40);
  w.setEdges({ top: 'loop', bottom: 'loop', left: 'loop', right: 'loop' });
  w.pressurize(30, 20, 8, 40);
  const a = w.air;
  const total = () => {
    let s = 0;
    for (let y = 1; y < a.H - 1; y++) for (let x = 1; x < a.W - 1; x++) s += a.p[y * a.W + x];
    return s;
  };
  run(w, 1);
  const t0 = total();
  run(w, 1000);
  assert.ok(Math.abs(total() - t0) < t0 * 0.01, `${t0.toFixed(0)} -> ${total().toFixed(0)}`);
});

test('a photon wraps round a looped edge', () => {
  const w = makeWorld(40, 20);
  w.setEdges({ left: 'loop', right: 'loop' });
  w.spawnProjectile(ID.PHOTON, 37.5, 10.5, 3, 0);
  run(w, 3);
  assert.equal(w.pn, 1);
  assert.ok(w.px[0] < 10, `at ${w.px[0].toFixed(1)}`);
});
