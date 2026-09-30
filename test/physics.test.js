import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { SNUFF_AT } from '../src/sim/behaviors.js';
import { makeWorld, fillRect, wallBox, countOf, meanY, run } from './helpers.js';

test('sand falls and piles up on the floor', () => {
  const w = makeWorld(60, 60);
  fillRect(w, 25, 0, 34, 9, ID.SAND);
  run(w, 200);
  assert.equal(countOf(w, ID.SAND), 100);
  // Everything has landed in the bottom rows, spread wider than it started.
  let minX = Infinity, maxX = -Infinity, minY = Infinity;
  for (let i = 0; i < w.type.length; i++) {
    if (w.type[i] !== ID.SAND) continue;
    const x = i % w.w, y = (i / w.w) | 0;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y);
  }
  assert.ok(minY > 45, `pile top at ${minY}`);
  assert.ok(maxX - minX > 12, 'pile spreads into a slope');
});

test('water levels out across the floor', () => {
  const w = makeWorld(80, 40);
  fillRect(w, 30, 0, 49, 19, ID.WATER);
  run(w, 600);
  assert.equal(countOf(w, ID.WATER), 400);
  for (let i = 0; i < w.type.length; i++) {
    if (w.type[i] === ID.WATER) assert.ok(((i / w.w) | 0) >= 33, 'no water stacked high');
  }
});

test('oil floats on water and sand sinks through it', () => {
  const w = makeWorld(40, 60);
  const box = wallBox(w, 0, 0, 39, 59);
  fillRect(w, box.x0, 40, box.x1, box.y1, ID.OIL);
  fillRect(w, box.x0, 20, box.x1, 39, ID.WATER);
  fillRect(w, 15, 5, 22, 8, ID.SAND);
  run(w, 900);
  assert.ok(meanY(w, ID.OIL) < meanY(w, ID.WATER), 'oil ends up above water');
  assert.ok(meanY(w, ID.SAND) > meanY(w, ID.WATER), 'sand ends up below water');
});

test('steam rises', () => {
  const w = makeWorld(40, 60);
  fillRect(w, 15, 45, 25, 55, ID.STEAM);
  const before = meanY(w, ID.STEAM);
  run(w, 60);
  assert.ok(meanY(w, ID.STEAM) < before - 10);
});

test('heat conducts through metal but not through wall', () => {
  const w = makeWorld(60, 20);
  fillRect(w, 5, 10, 25, 10, ID.METAL);
  fillRect(w, 30, 10, 50, 10, ID.WALL);
  w.temp[10 * w.w + 5] = 1400;
  w.temp[10 * w.w + 30] = 1400;
  run(w, 200, () => { w.temp[10 * w.w + 5] = 1400; });
  assert.ok(w.temp[10 * w.w + 15] > 100, 'the metal bar warmed up ten cells away');
  assert.ok(Math.abs(w.temp[10 * w.w + 45] - 22) < 1, 'wall stayed cold');
});

test('lava left in the open cools into stone', () => {
  const w = makeWorld(40, 30);
  fillRect(w, 15, 25, 25, 29, ID.LAVA);
  run(w, 2500);
  assert.equal(countOf(w, ID.LAVA), 0);
  assert.ok(countOf(w, ID.STONE) > 30);
});

test('a sealed wall box holds pressure; open air lets it escape', () => {
  const w = makeWorld(80, 40);
  wallBox(w, 8, 8, 24, 24);
  run(w, 1);
  for (let f = 0; f < 60; f++) {
    w.pressurize(16, 16, 3, 2);
    w.pressurize(56, 16, 3, 2);
    w.step();
  }
  run(w, 120);
  assert.ok(w.pressureAt(16, 16) > 5, `box pressure ${w.pressureAt(16, 16)}`);
  assert.ok(Math.abs(w.pressureAt(56, 16)) < 2, `open pressure ${w.pressureAt(56, 16)}`);
});

test('an explosion throws nearby sand around', () => {
  const w = makeWorld(80, 60);
  fillRect(w, 30, 50, 50, 59, ID.SAND);
  fillRect(w, 38, 46, 42, 49, ID.GUNPOWDER);
  run(w, 5);
  const topOfPile = () => {
    for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.SAND) return (i / w.w) | 0;
    return w.h;
  };
  const before = topOfPile();
  fillRect(w, 36, 44, 44, 45, ID.FIRE);
  let highest = before;
  run(w, 60, () => { highest = Math.min(highest, topOfPile()); });
  assert.ok(countOf(w, ID.GUNPOWDER) < 10, 'most of the gunpowder went off');
  assert.ok(highest < before - 2, `sand was thrown up (top row ${before} -> ${highest})`);
});

test('electricity travels along metal from a battery', () => {
  const w = makeWorld(80, 10);
  w.spawn(5 * w.w + 4, ID.BATTERY);
  fillRect(w, 5, 5, 70, 5, ID.METAL);
  let reached = false;
  run(w, 120, () => { if (w.type[5 * w.w + 70] === ID.SPARK) reached = true; });
  assert.ok(reached, 'spark reached the far end of the wire');
});

test('fire burns wood away and leaves ash and smoke', () => {
  const w = makeWorld(40, 40);
  fillRect(w, 10, 30, 30, 39, ID.WOOD);
  let ash = 0;
  run(w, 3000, (f) => {
    if (f % 20 === 0) fillRect(w, 18, 28, 22, 29, ID.FIRE);
    ash = Math.max(ash, countOf(w, ID.ASH));
  });
  assert.ok(countOf(w, ID.WOOD) < 100, 'most of the wood burned');
  assert.ok(ash > 0 && w.seen[ID.SMOKE], 'left ash and smoke');
});

test('a fire in a sealed box uses up the air and goes out, leaving most of the fuel', () => {
  const w = makeWorld(60, 50);
  const box = wallBox(w, 10, 10, 49, 49);
  fillRect(w, box.x0, 40, box.x1, box.y1, ID.WOOD);
  const wood = countOf(w, ID.WOOD);
  fillRect(w, box.x0, 38, box.x1, 39, ID.FIRE);
  let lowest = 0;
  run(w, 1500, () => { lowest = Math.min(lowest, w.pressureAt(30, 30)); });
  assert.ok(lowest < SNUFF_AT, `the air inside was used up (lowest ${lowest.toFixed(1)})`);
  assert.equal(countOf(w, ID.FIRE), 0, 'the fire went out');
  assert.ok(countOf(w, ID.WOOD) > wood * 0.5, `${countOf(w, ID.WOOD)} of ${wood} wood left`);
});

test('nothing catches fire in thin air, and hot fuel lights once air gets back in', () => {
  const w = makeWorld(60, 40);
  const box = wallBox(w, 10, 10, 49, 39);
  fillRect(w, box.x0, 30, box.x1, box.y1, ID.WOOD);
  const wood = countOf(w, ID.WOOD);
  const keepHot = () => { for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.WOOD) w.temp[i] = 600; };
  const thin = () => {
    for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) w.air.p[w.air.at(x, y)] = SNUFF_AT - 5;
  };
  run(w, 200, () => { thin(); keepHot(); });
  assert.equal(countOf(w, ID.FIRE), 0, 'hot wood did not light without air');
  assert.equal(countOf(w, ID.WOOD), wood, 'and none of it burned');
  for (let x = 10; x <= 49; x++) w.clearCell(10 * w.w + x); // take the lid off
  let lit = false;
  run(w, 400, () => { keepHot(); if (countOf(w, ID.FIRE) > 0) lit = true; });
  assert.ok(lit, 'the wood caught once air came back');
});

test('sand smothers flames', () => {
  const fire = (sand) => {
    const w = makeWorld(40, 40);
    fillRect(w, 10, 30, 29, 39, ID.COAL);
    run(w, 20, (f) => { if (f % 5 === 0) fillRect(w, 10, 29, 29, 29, ID.FIRE); });
    if (sand) fillRect(w, 10, 20, 29, 27, ID.SAND);
    let flames = 0;
    run(w, 200, (f) => { if (f > 100) flames += countOf(w, ID.FIRE); });
    return flames;
  };
  // Buried embers would smoulder on; sand touching them puts them out.
  const open = fire(false), covered = fire(true);
  assert.ok(covered < open / 20, `flames under sand ${covered}, uncovered ${open}`);
});

test('a thin film of water settles instead of skittering back and forth', () => {
  const w = makeWorld(200, 60);
  fillRect(w, 90, 0, 109, 7, ID.WATER);
  run(w, 600);
  let moved = 0;
  for (let f = 0; f < 120; f++) {
    const before = w.type.slice();
    w.step();
    for (let i = 0; i < before.length; i++) if (before[i] !== w.type[i]) moved++;
  }
  // Each moving particle changes two cells, so this is under ~5 particles a frame.
  assert.ok(moved / 120 < 10, `${(moved / 120).toFixed(1)} cells changed per frame`);
});
