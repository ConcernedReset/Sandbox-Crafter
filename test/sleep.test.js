// Sleeping areas: what isn't changing isn't simulated, until something
// reaches it. The world must behave just as it would awake.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, run } from './helpers.js';
import { loadDemoScene } from '../src/game/scene.js';
import { World } from '../src/sim/world.js';

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

// A walled tray: sand on the left, water filling whole rows on the right.
function tray() {
  const w = makeWorld(64, 64);
  fillRect(w, 0, 63, 63, 63, ID.WALL);
  fillRect(w, 32, 40, 32, 62, ID.WALL);
  fillRect(w, 63, 40, 63, 62, ID.WALL);
  fillRect(w, 0, 48, 31, 62, ID.SAND);
  fillRect(w, 33, 50, 62, 62, ID.WATER);
  return w;
}

test('a settled pile of sand and a still pool fall asleep', () => {
  const w = tray();
  run(w, 100);
  assert.equal(w.asleepAt(10, 56), true, 'the sand');
  assert.equal(w.asleepAt(45, 58), true, 'the water');
});

test('a sleeping area wakes when a tool reaches it', () => {
  const w = tray();
  run(w, 100);
  w.paint(10, 40, 2, ID.SAND);
  run(w, 1);
  assert.equal(w.asleepAt(10, 40), false, 'painting');
  run(w, 100);
  w.heat(45, 58, 2, 300);
  run(w, 1);
  assert.equal(w.asleepAt(45, 58), false, 'heating');
});

test('taking sand from under a sleeping pile brings it down', () => {
  const w = tray();
  run(w, 100);
  const before = (() => { let n = 0; for (let x = 0; x < 32; x++) if (w.type[48 * 64 + x] === ID.SAND) n++; return n; })();
  w.erase(8, 60, 3); // a hole low in the pile, in the chunk below
  run(w, 60);
  let top = 0;
  for (let x = 0; x < 32; x++) if (w.type[48 * 64 + x] === ID.SAND) top++;
  assert.ok(top < before, 'the top of the pile slumped into the hole');
});

test('heat reaches a sleeping area from next door, as fast as when awake', () => {
  const far = (sleeping) => {
    const w = makeWorld(64, 32);
    w.sleeping = sleeping;
    fillRect(w, 0, 10, 63, 12, ID.METAL);
    run(w, 50);
    if (sleeping) assert.equal(w.asleepAt(40, 11), true);
    run(w, 200, () => { for (let x = 0; x < 4; x++) w.temp[11 * 64 + x] = 1000; });
    return w.temp[11 * 64 + 30];
  };
  const asleep = far(true), awake = far(false);
  assert.ok(asleep > 50 && Math.abs(asleep - awake) < awake * 0.02, `${asleep.toFixed(1)} with sleeping, ${awake.toFixed(1)} without`);
});

test('a puff of air wakes the area under it', () => {
  const w = tray();
  run(w, 100);
  w.pressurize(10, 40, 4, 20);
  run(w, 2);
  assert.equal(w.asleepAt(10, 44), false);
});

test('nothing sleeps with Newtonian gravity on', () => {
  const w = tray();
  w.setGravity({ newtonian: true });
  run(w, 100);
  assert.ok(w.chunkAwake.every((v) => v === 1));
});

test('slow changes still happen in a settled scene: water still turns dirt to mud', () => {
  const mud = (sleeping) => {
    const w = makeWorld(64, 40, 3);
    w.sleeping = sleeping;
    fillRect(w, 0, 39, 63, 39, ID.WALL);
    fillRect(w, 0, 30, 63, 38, ID.DIRT);
    fillRect(w, 0, 0, 0, 29, ID.WALL);
    fillRect(w, 63, 0, 63, 29, ID.WALL);
    fillRect(w, 1, 26, 62, 29, ID.WATER);
    run(w, 600);
    let n = 0;
    for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.MUD) n++;
    return n;
  };
  const asleep = mud(true), awake = mud(false);
  assert.ok(asleep > awake * 0.7, `${asleep} mud cells with sleeping, ${awake} without`);
});

test('radioactive elements and plants keep their areas awake', () => {
  const w = makeWorld(64, 40);
  fillRect(w, 0, 39, 63, 39, ID.WALL);
  fillRect(w, 5, 35, 8, 38, ID.URANIUM);
  fillRect(w, 40, 36, 60, 38, ID.DIRT);
  w.spawn(35 * 64 + 50, ID.SEED);
  run(w, 200);
  assert.equal(w.asleepAt(6, 36), false, 'uranium');
  assert.equal(w.asleepAt(50, 36), false, 'a seed in soil');
});

test('the starting scene settles until nearly everything sleeps, and steps much faster', () => {
  const time = (sleeping) => {
    const w = new World(400, 240, 3);
    loadDemoScene(w);
    w.setConvection(true);
    w.sleeping = sleeping;
    for (let f = 0; f < 300; f++) w.step();
    const t0 = performance.now();
    for (let f = 0; f < 200; f++) w.step();
    return { ms: (performance.now() - t0) / 200, w };
  };
  const on = time(true), off = time(false);
  const w = on.w;
  let full = 0, asleep = 0;
  for (let c = 0; c < w.cw * w.ch; c++) {
    const x0 = (c % w.cw) * 16, y0 = ((c / w.cw) | 0) * 16;
    let any = false;
    for (let y = y0; y < Math.min(w.h, y0 + 16) && !any; y++) {
      for (let x = x0; x < Math.min(w.w, x0 + 16); x++) if (w.type[y * w.w + x]) { any = true; break; }
    }
    if (!any) continue;
    full++;
    if (!w.chunkAwake[c]) asleep++;
  }
  assert.ok(asleep >= full * 0.9, `${asleep} of ${full} chunks asleep`);
  assert.equal(w.air.still, true, 'and the air rests');
  assert.ok(on.ms * 3 < off.ms, `${on.ms.toFixed(2)} ms a step asleep, ${off.ms.toFixed(2)} awake`);
});
