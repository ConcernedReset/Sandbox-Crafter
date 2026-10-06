// Wall is a perfect container: it never changes temperature, nothing gets
// through it (air, heat, pressure or flying particles), and what it shuts
// in keeps its pressure and its heat.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFS, ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, wallBox, run } from './helpers.js';
import { glowBlur } from '../src/render/renderer.js';

// A box with one-cell walls that don't line up with the air blocks, so the
// blocks the walls run through hold cells from both sides.
const BOX = [21, 13, 58, 46];

function boxed(convection) {
  const w = makeWorld(80, 60, 7);
  const box = wallBox(w, ...BOX);
  w.setConvection(convection);
  run(w, 2);
  return { w, box };
}

const area = (w, box) => (fn) => {
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) fn(y * w.w + x, x, y);
};

// Average pressure and air temperature in the box's open blocks, and the
// furthest from normal they get outside it.
function air(w, box) {
  const { p, t, blocked } = w.air;
  const inside = new Set();
  area(w, box)((i, x, y) => { const a = w.air.at(x, y); if (!blocked[a]) inside.add(a); });
  let pIn = 0, tIn = 0;
  for (const a of inside) { pIn += p[a]; tIn += t[a]; }
  let pOut = 0, tOut = 0;
  for (let a = 0; a < p.length; a++) {
    if (inside.has(a) || blocked[a]) continue;
    pOut = Math.max(pOut, Math.abs(p[a]));
    tOut = Math.max(tOut, Math.abs(t[a] - 22));
  }
  return { pIn: pIn / inside.size, tIn: tIn / inside.size, pOut, tOut };
}

const average = (w, t) => {
  let s = 0, n = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === t) { s += w.temp[i]; n++; }
  return s / n;
};

test('a sealed wall box keeps its pressure', () => {
  const { w, box } = boxed(false);
  w.pressurizeArea(area(w, box), 50);
  run(w, 3000);
  const a = air(w, box);
  assert.ok(a.pIn > 49.9, `inside ${a.pIn.toFixed(2)}`);
  assert.ok(a.pOut < 0.01, `outside ${a.pOut.toFixed(3)}`);
});

test('hot air shut in a wall box stays hot, and none gets out', () => {
  const { w, box } = boxed(true);
  w.heatArea(area(w, box), 3000);
  run(w, 1);
  const start = air(w, box).tIn;
  run(w, 1500);
  const a = air(w, box);
  assert.ok(start > 2000, `started at ${start.toFixed(0)}`);
  assert.ok(a.tIn > start * 0.99, `${start.toFixed(0)} -> ${a.tIn.toFixed(0)}`);
  assert.ok(a.tOut < 0.01, `outside air ${a.tOut.toFixed(3)} off room temperature`);
  assert.ok(a.pOut < 0.01, `outside pressure ${a.pOut.toFixed(3)}`);
});

test('a hot block in a wall box only loses heat to the air in the box', () => {
  for (const convection of [false, true]) {
    const { w, box } = boxed(convection);
    fillRect(w, 35, 40, 44, 45, ID.STONE);
    for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.STONE) w.temp[i] = 900;
    run(w, 2000);
    const stone = average(w, ID.STONE), a = air(w, box);
    if (!convection) assert.ok(stone > 899, `no air to cool in: stone at ${stone.toFixed(1)}`);
    else assert.ok(stone > 500 && a.tIn > 300, `stone ${stone.toFixed(0)}, air ${a.tIn.toFixed(0)}`);
    assert.ok(a.tOut < 0.01, `outside air ${a.tOut.toFixed(3)} off room temperature`);
    assert.ok(a.pOut < 0.01, `outside pressure ${a.pOut.toFixed(3)}`);
  }
});

test('a plutonium reaction in a wall box stays in the box', () => {
  const { w, box } = boxed(true);
  fillRect(w, 36, 36, 43, 45, ID.PLUTONIUM);
  let pOut = 0, tOut = 0;
  for (let f = 0; f < 400; f++) {
    if (f < 30) w.spawnProjectile(ID.NEUTRON, 39.5, 30.5, 0, 1);
    w.step();
    const a = air(w, box);
    pOut = Math.max(pOut, a.pOut);
    tOut = Math.max(tOut, a.tOut);
    for (let k = 0; k < w.pn; k++) {
      const x = w.px[k], y = w.py[k];
      assert.ok(x > BOX[0] && x < BOX[2] + 1 && y > BOX[1] && y < BOX[3] + 1, `particle out at ${x.toFixed(1)}, ${y.toFixed(1)}`);
    }
  }
  assert.ok(air(w, box).pIn > 5, 'the reaction pressed the box');
  assert.ok(pOut < 0.01, `outside pressure reached ${pOut.toFixed(3)}`);
  assert.ok(tOut < 0.01, `outside air reached ${tOut.toFixed(3)} off room temperature`);
});

test('wall stays at room temperature whatever touches it', () => {
  const { w, box } = boxed(true);
  fillRect(w, box.x0, box.y0 + 20, box.x1, box.y1, ID.LAVA);
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.LAVA) w.temp[i] = 5000;
  w.heatArea((fn) => { for (let x = 15; x < 65; x++) fn(BOX[1] * w.w + x, x, BOX[1]); }, 4000);
  run(w, 200);
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.WALL) assert.equal(w.temp[i], 22);
});

test('every flying particle bounces off a wall', () => {
  for (const d of DEFS) {
    if (!d.projectile || d.lifeMin <= 12) continue;
    const w = makeWorld(80, 60, 7);
    for (let y = 0; y < 60; y++) w.spawn(y * 80 + 40, ID.WALL);
    for (let n = 0; n < 10; n++) w.spawnProjectile(d.id, 36.5, 10.5 + n * 4, d.speed, d.speed * 0.2);
    run(w, Math.ceil(10 / d.speed) + 2); // long enough to reach the wall, not to fly off the far edge
    assert.equal(w.pn, 10, `${d.name}: ${w.pn} of 10 left`);
    let back = 0;
    for (let k = 0; k < w.pn; k++) {
      assert.ok(w.px[k] < 40, `${d.name} got through to ${w.px[k].toFixed(1)}`);
      if (w.pvx[k] < 0) back++;
    }
    assert.ok(back >= 8, `${d.name}: only ${back} of 10 bounced back`);
  }
});

test('nothing slips between the cells of a diagonal wall', () => {
  // A diamond of one-cell diagonal walls, whose cells only touch at corners.
  const w = makeWorld(80, 80, 7);
  const ring = (x, y) => Math.abs(x - 40) + Math.abs(y - 40);
  for (let y = 0; y < 80; y++) for (let x = 0; x < 80; x++) if (ring(x, y) === 24) w.spawn(y * 80 + x, ID.WALL);
  for (let n = 0; n < 20; n++) w.spawnProjectile(ID.PHOTON, 40.5, 40.5, Math.cos(n) * 1.2, Math.sin(n) * 1.2);
  // Pressure in the middle of it.
  w.pressurizeArea((fn) => { for (let y = 32; y < 48; y++) for (let x = 32; x < 48; x++) fn(y * 80 + x, x, y); }, 50);
  let out = 0;
  run(w, 300, (f) => {
    if (f === 100) assert.equal(w.pn, 20, 'photons lost');
    for (let k = 0; k < w.pn; k++) assert.ok(ring(w.px[k] | 0, w.py[k] | 0) < 24, 'a photon got out');
    for (let y = 0; y < 80; y++) {
      for (let x = 0; x < 80; x++) if (ring(x, y) > 32) out = Math.max(out, Math.abs(w.air.p[w.air.at(x, y)]));
    }
  });
  assert.ok(out < 0.01, `pressure reached ${out.toFixed(3)} outside`);
});

test('a blast does not reach through a wall', () => {
  const w = makeWorld(80, 60, 7);
  for (let y = 0; y < 60; y++) w.spawn(y * 80 + 40, ID.WALL);
  fillRect(w, 41, 28, 43, 32, ID.SAND);
  fillRect(w, 41, 20, 41, 20, ID.GUNPOWDER);
  w.blast(38, 30, 40);
  for (let y = 28; y <= 32; y++) {
    for (let x = 41; x <= 43; x++) {
      const i = y * 80 + x;
      assert.equal(w.vx[i], 0);
      assert.equal(w.vy[i], 0);
    }
  }
  assert.ok(w.temp[20 * 80 + 41] < 100, 'gunpowder behind the wall was set off');
});

test('the Glow halo stops at walls', () => {
  const cols = 9, rows = 3;
  const g = new Float32Array(cols * rows * 3);
  const tmp = new Float32Array(g.length);
  const mask = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) mask[y * cols + 4] = 1; // a wall down the middle
  g[(1 * cols + 2) * 3] = 1000; // light on the left
  glowBlur(g, tmp, cols, rows, mask);
  glowBlur(g, tmp, cols, rows, mask);
  for (let y = 0; y < rows; y++) {
    for (let x = 4; x < cols; x++) assert.equal(g[(y * cols + x) * 3], 0, `light at ${x}, ${y}`);
  }
  assert.ok(g[(1 * cols + 3) * 3] > 0, 'light spreads up to the wall');
});
