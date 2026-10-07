// How fast heat moves, and how hot things can get (there's no limit).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/sim/world.js';
import { ID, DEFS } from '../src/sim/elements.js';
import { thermal } from '../src/sim/air.js';
import { makeWorld, fillRect, wallBox, countOf, run } from './helpers.js';

test('heat runs along a metal bar quickly', () => {
  const w = makeWorld(80, 20);
  for (let x = 0; x < 80; x++) w.spawn(19 * 80 + x, ID.WALL);
  for (let x = 10; x < 50; x++) w.spawn(18 * 80 + x, ID.METAL);
  run(w, 300, () => { w.temp[18 * 80 + 10] = 1000; });
  const mid = w.temp[18 * 80 + 30];
  assert.ok(mid > 130, `20 cells along, ${mid.toFixed(0)} °C after 5 s`);
});

// Lava at one end of a sealed box (or not), ice at the other, nothing
// between them but air. Returns the frame half the ice had melted by.
function lavaAndIce(lava, convection) {
  const w = new World(100, 50, 3);
  w.setConvection(convection);
  wallBox(w, 10, 10, 90, 45);
  if (lava) fillRect(w, 11, 38, 19, 44, ID.LAVA);
  fillRect(w, 80, 38, 89, 44, ID.ICE);
  const ice = countOf(w, ID.ICE);
  let half = -1;
  run(w, 2400, (f) => { if (half < 0 && countOf(w, ID.ICE) <= ice / 2) half = f; });
  return half;
}

test('with convection on, hot air carries heat across a room', () => {
  const hot = lavaAndIce(true, true);
  const cold = lavaAndIce(false, true);
  assert.ok(hot > 0 && hot < 600, `with lava, half the ice melted at frame ${hot}`);
  assert.ok(cold < 0 || cold > hot * 2, `in room-temperature air alone, at frame ${cold}`);
  assert.equal(lavaAndIce(true, false), -1, 'without convection, the air carries no heat');
});

test('there is no highest temperature', () => {
  const w = makeWorld(20, 20);
  fillRect(w, 5, 5, 10, 10, ID.STONE);
  for (let f = 0; f < 600; f++) w.heat(8, 8, 3, 30);
  assert.ok(w.temp[8 * 20 + 8] > 15000, `${w.temp[8 * 20 + 8].toFixed(0)} °C`);
});

test('the hottest elements are as hot as the real thing', () => {
  assert.equal(DEFS[ID.STAR].temp, 15e6, 'the heart of the Sun');
  assert.equal(DEFS[ID.SUPERNOVA].temp, 1e9);
  assert.equal(DEFS[ID.QUARK_GLUON_PLASMA].temp, 5.5e12);
  assert.equal(DEFS[ID.LIGHTNING].temp, 30000);
  assert.equal(DEFS[ID.PLASMA].temp, 20000);
  // A Star heats what touches it far past the old 9,999 °C limit.
  const w = makeWorld(20, 20);
  w.spawn(10 * 20 + 10, ID.STAR);
  w.spawn(10 * 20 + 11, ID.STONE);
  run(w, 3);
  assert.ok(w.temp[10 * 20 + 11] > 1e5, `${w.temp[10 * 20 + 11].toExponential(1)} °C beside the Star`);
});

test('a plutonium split is a million degrees in a lump, but only adds a little alone', () => {
  const split = (lump) => {
    const w = makeWorld(40, 40);
    if (lump) fillRect(w, 15, 15, 25, 25, ID.PLUTONIUM);
    else { fillRect(w, 15, 15, 25, 25, ID.URANIUM); w.clearCell(20 * 40 + 20); w.spawn(20 * 40 + 20, ID.PLUTONIUM); }
    w.fission(20 * 40 + 20, ID.PLUTONIUM, 20, 20);
    return w.temp[20 * 40 + 20];
  };
  assert.ok(split(true) >= 1e6, 'in a lump');
  const alone = split(false);
  assert.ok(alone > 300 && alone < 1000, `alone in uranium: ${alone.toFixed(0)} °C`);
});

test('the pressure hot air adds levels off, and goes when it cools', () => {
  assert.ok(Math.abs(thermal(1000) - (1000 - 22) * 0.008) < 0.1, 'near room temperature it is EXPAND a degree');
  assert.ok(thermal(1e6) <= 40 && thermal(1e12) <= 40, 'it levels off');
  const w = new World(60, 60, 3);
  w.setConvection(true);
  wallBox(w, 8, 8, 51, 51);
  const air = w.air;
  const blocks = [];
  for (let y = 12; y < 48; y += 4) for (let x = 12; x < 48; x += 4) blocks.push(air.at(x, y));
  for (const a of blocks) air.t[a] = 1e6;
  // Air that hot radiates its heat away in a few frames; watch the peak.
  let hot = 0;
  run(w, 5, () => { hot = Math.max(hot, ...blocks.map((a) => air.p[a])); });
  hot = Math.max(hot, ...blocks.map((a) => air.p[a]));
  assert.ok(hot > 20 && hot < 45, `pressure ${hot.toFixed(1)} with million-degree air`);
  for (const a of blocks) air.t[a] = 22;
  run(w, 60);
  const after = Math.min(...blocks.map((a) => air.p[a]));
  assert.ok(after > -3, `pressure ${after.toFixed(1)} once it has cooled: no vacuum left behind`);
});

test('a Star scorches the air around it without cooking the whole world', () => {
  const w = new World(240, 160, 3);
  w.setConvection(true);
  fillRect(w, 0, 140, 239, 159, ID.SAND);
  fillRect(w, 116, 56, 124, 64, ID.STAR);
  const sand = countOf(w, ID.SAND);
  // The hot air circulates round the world in rolls, so the air far off
  // swings warmer and cooler: compare averages over the second half.
  const a = w.air;
  let near = 0, far = 0, n = 0;
  run(w, 600, (f) => { if (f >= 300) { near += a.t[a.at(120, 70)]; far += a.t[a.at(20, 20)]; n++; } });
  near /= n;
  far /= n;
  assert.ok(near > 900, `air just under the Star ${near.toFixed(0)} °C`);
  assert.ok(far < near / 2, `air far off ${far.toFixed(0)} °C, under the Star ${near.toFixed(0)} °C`);
  assert.ok(w.temp[150 * 240 + 20] < 50, `the ground far off is at ${w.temp[150 * 240 + 20].toFixed(0)} °C`);
  assert.ok(countOf(w, ID.SAND) > sand * 0.95, `${countOf(w, ID.SAND)} of ${sand} sand unmelted`);
});
