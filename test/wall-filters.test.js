// The Wall tool's checklist: each wall cell can let chosen things through.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { WALL_HERE, PASS } from '../src/sim/walls.js';
import { makeWorld, fillRect, wallBox, countOf, run } from './helpers.js';

// A wall line from (x, y0) down to (x, y1) that lets `mask` through.
function grate(w, x, y0, y1, mask) {
  w.wallMask = mask;
  for (let y = y0; y <= y1; y++) w.spawn(y * w.w + x, ID.WALL);
  w.wallMask = 0;
}

test('painting Wall sets the wall layer; erasing or Replace removes it', () => {
  const w = makeWorld(20, 10);
  const a = 5 * 20 + 5, b = 5 * 20 + 8;
  w.paint(5, 5, 0, ID.WALL);
  assert.equal(w.wall[a], WALL_HERE);
  w.wallMask = PASS.liquid;
  w.paint(8, 5, 0, ID.WALL);
  w.wallMask = 0;
  assert.equal(w.wall[b], WALL_HERE | PASS.liquid);
  assert.equal(w.meshCount, 1);
  w.erase(5, 5, 0);
  assert.equal(w.wall[a], 0);
  assert.equal(w.type[a], 0);
  w.replace = true;
  w.paint(8, 5, 0, ID.STONE);
  assert.equal(w.wall[b], 0);
  assert.equal(w.type[b], ID.STONE);
  assert.equal(w.meshCount, 0);
});

test('walls stay where they are while things pass through them', () => {
  const w = makeWorld(10, 3);
  grate(w, 5, 1, 1, PASS.liquid);
  w.spawn(14, ID.WATER);
  w.swap(14, 15); // into the wall
  assert.equal(w.type[15], ID.WATER);
  assert.equal(w.type[14], 0);
  w.swap(15, 16); // and out
  assert.equal(w.type[15], ID.WALL);
  assert.equal(w.type[16], ID.WATER);
  w.swap(16, 15);
  w.clearCell(15); // used up inside the wall
  assert.equal(w.type[15], ID.WALL, 'the wall is still there');
  w.clearCell(15); // clearing the wall itself removes it
  assert.equal(w.type[15], 0);
  assert.equal(w.wall[15], 0);
});

test('Clear removes walls and their layer', () => {
  const w = makeWorld(20, 10);
  grate(w, 5, 0, 9, PASS.gas);
  w.clearAll();
  assert.equal(countOf(w, ID.WALL), 0);
  assert.ok(w.wall.every((v) => v === 0));
  assert.equal(w.meshCount, 0);
});

test('a liquids-only wall lets water through and stops sand', () => {
  const w = makeWorld(40, 20);
  fillRect(w, 0, 19, 39, 19, ID.WALL);
  grate(w, 20, 0, 18, PASS.liquid);
  fillRect(w, 2, 10, 15, 18, ID.WATER);
  fillRect(w, 2, 2, 15, 6, ID.SAND);
  run(w, 400);
  let water = 0, sand = 0;
  for (let y = 0; y < 19; y++) {
    for (let x = 21; x < 40; x++) {
      const t = w.type[y * 40 + x];
      if (t === ID.WATER) water++;
      if (t === ID.SAND) sand++;
    }
  }
  assert.ok(water > 20, `${water} water got through`);
  assert.equal(sand, 0, 'no sand got through');
  for (let y = 0; y < 19; y++) assert.notEqual(w.wall[y * 40 + 20], 0, 'the wall is all still there');
});

test('a gases-only box lets smoke out and keeps water in', () => {
  const w = makeWorld(60, 40);
  w.wallMask = PASS.gas;
  const box = wallBox(w, 20, 10, 40, 30);
  w.wallMask = 0;
  fillRect(w, box.x0, box.y0, box.x1, box.y0 + 4, ID.SMOKE);
  fillRect(w, box.x0, box.y1 - 4, box.x1, box.y1, ID.WATER);
  const water = countOf(w, ID.WATER);
  run(w, 60); // smoke fades after a few seconds, so count it soon
  let out = 0;
  for (let i = 0; i < w.type.length; i++) {
    const x = i % 60, y = (i / 60) | 0;
    if (w.type[i] === ID.SMOKE && (x < 20 || x > 40 || y < 10 || y > 30)) out++;
  }
  assert.ok(out > 5, `${out} smoke got out`);
  run(w, 240);
  assert.equal(countOf(w, ID.WATER), water, 'the water stayed in');
});

test('light goes through a particles wall and bounces off a plain one', () => {
  const through = (mask) => {
    const w = makeWorld(60, 20);
    grate(w, 30, 0, 19, mask);
    for (let n = 0; n < 10; n++) w.spawnProjectile(ID.PHOTON, 20.5, 5.5 + n, 3, 0);
    run(w, 6);
    let right = 0;
    for (let k = 0; k < w.pn; k++) if (w.px[k] > 30) right++;
    return right;
  };
  assert.equal(through(PASS.particles), 10);
  assert.equal(through(0), 0);
});

test('a heat wall conducts and warms; a plain one stays at room temperature', () => {
  const far = (mask) => {
    const w = makeWorld(40, 10);
    fillRect(w, 5, 5, 19, 5, ID.METAL);
    grate(w, 20, 5, 5, mask);
    fillRect(w, 21, 5, 35, 5, ID.METAL);
    run(w, 200, () => { for (let x = 5; x < 10; x++) w.temp[5 * 40 + x] = 1000; });
    return { far: w.temp[5 * 40 + 25], wall: w.temp[5 * 40 + 20] };
  };
  const hot = far(PASS.heat), plain = far(0);
  assert.ok(hot.far > 100, `through a heat wall the far side reached ${hot.far.toFixed(0)}`);
  assert.ok(hot.wall > 100, 'and the wall itself warmed');
  assert.ok(plain.far < 30 && plain.wall === 22, `plain: far ${plain.far.toFixed(0)}, wall ${plain.wall}`);
});

test('an air wall lets the pressure out of a box; a plain one holds it', () => {
  const left = (mask) => {
    const w = makeWorld(60, 40);
    w.wallMask = mask;
    const box = wallBox(w, 21, 13, 38, 30);
    w.wallMask = 0;
    w.pressurizeArea((fn) => w.forRect(box.x0, box.y0, box.x1, box.y1, fn), 40);
    run(w, 300);
    return w.pressureAt(30, 22);
  };
  assert.ok(left(PASS.air) < 2, 'it leaked away');
  assert.ok(left(0) > 35, 'it held');
});
