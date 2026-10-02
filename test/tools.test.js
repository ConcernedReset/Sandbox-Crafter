// Painting tools (round and square brushes, single-cell brushes, boxes) and
// how hard flying particles hit what they land on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, wallBox, countOf, run } from './helpers.js';

test('a radius-0 brush paints one cell; square and round brushes cover their shapes', () => {
  const w = makeWorld(60, 40);
  w.paint(10, 10, 0, ID.STONE);
  assert.equal(countOf(w, ID.STONE), 1);

  w.brushShape = 'square';
  w.paint(30, 20, 3, ID.WOOD);
  assert.equal(countOf(w, ID.WOOD), 49, 'a 7 × 7 square');

  w.brushShape = 'circle';
  w.paint(50, 20, 3, ID.BRICK);
  const round = countOf(w, ID.BRICK);
  assert.ok(round > 25 && round < 49, `${round} cells in a round brush`);
});

test('a box fills every cell between its corners, whichever way it was dragged', () => {
  const w = makeWorld(60, 40);
  w.paintArea((fn) => w.forRect(40, 30, 10, 5, fn), ID.STONE, 1);
  assert.equal(countOf(w, ID.STONE), 31 * 26);
  w.eraseArea((fn) => w.forRect(10, 5, 20, 30, fn));
  assert.equal(countOf(w, ID.STONE), 20 * 26);
});

test('particles hit hard: they heat what stops them and kick up air pressure', () => {
  const hit = (p) => {
    const w = makeWorld(80, 20);
    fillRect(w, 40, 0, 44, 19, ID.STONE);
    for (let k = 0; k < 16; k++) w.spawnProjectile(p, 5.5, 2 + k + 0.5, 3, 0);
    let peak = 0;
    run(w, 25, () => { for (const v of w.air.p) peak = Math.max(peak, v); });
    // Heat spreads through the stone, so add up how much it gained in all.
    let heat = 0;
    for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.STONE) heat += w.temp[i] - 22;
    return { heat, peak };
  };
  // Protons fly through matter (they only carry heat); alpha particles stop dead.
  const photon = hit(ID.PHOTON), alpha = hit(ID.ALPHA);
  assert.ok(photon.heat > 16 * 100, `16 photons put ${photon.heat.toFixed(0)} °C of heat into the stone`);
  assert.ok(alpha.heat > 16 * 300 && alpha.peak > 2, `alpha particles: ${JSON.stringify(alpha)}`);
});

test('Replace paints over whatever is in the way; without it, only empty cells are painted', () => {
  const paint = (replace) => {
    const w = makeWorld(40, 40);
    fillRect(w, 15, 15, 24, 24, ID.WALL);
    fillRect(w, 10, 10, 29, 29, ID.SAND);
    w.replace = replace;
    w.paintArea((fn) => w.forRect(5, 5, 34, 34, fn), ID.STONE);
    return w;
  };
  const off = paint(false), on = paint(true);
  assert.equal(countOf(off, ID.SAND), 300, 'sand left alone');
  assert.equal(countOf(off, ID.WALL), 100, 'wall left alone');
  assert.equal(countOf(on, ID.SAND) + countOf(on, ID.WALL), 0, 'sand and wall replaced');
  assert.equal(countOf(on, ID.STONE), 30 * 30);
  // Painting an element over itself leaves it be (it keeps its temperature).
  const w = makeWorld(20, 20);
  fillRect(w, 5, 5, 9, 9, ID.STONE);
  w.temp[7 * 20 + 7] = 500;
  w.replace = true;
  w.paintArea((fn) => w.forRect(0, 0, 19, 19, fn), ID.STONE);
  assert.equal(w.temp[7 * 20 + 7], 500);
});

test('Mix shuffles everything under the brush but the walls, keeping every cell', () => {
  const w = makeWorld(40, 40);
  wallBox(w, 5, 5, 26, 26);
  fillRect(w, 6, 6, 25, 15, ID.SAND); // sand over water
  fillRect(w, 6, 16, 25, 25, ID.WATER);
  const walls = [];
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.WALL) walls.push(i);
  const sand = countOf(w, ID.SAND), water = countOf(w, ID.WATER);
  w.mixArea((fn) => w.forRect(5, 5, 26, 26, fn)); // the box, walls and all
  assert.equal(countOf(w, ID.SAND), sand);
  assert.equal(countOf(w, ID.WATER), water);
  assert.ok(walls.every((i) => w.type[i] === ID.WALL), 'the walls stay put');
  // One go already blends them: plenty of each in the other's half.
  let waterUp = 0, sandDown = 0;
  w.forRect(6, 6, 25, 15, (i) => { if (w.type[i] === ID.WATER) waterUp++; });
  w.forRect(6, 16, 25, 25, (i) => { if (w.type[i] === ID.SAND) sandDown++; });
  assert.ok(waterUp > water * 0.2, `${waterUp} water in the top half`);
  assert.ok(sandDown > sand * 0.2, `${sandDown} sand in the bottom half`);
});

test('Mix carries temperature with the cell it moves', () => {
  const w = makeWorld(20, 20);
  fillRect(w, 0, 0, 19, 9, ID.STONE);
  w.forRect(0, 0, 19, 9, (i) => { w.temp[i] = 500; });
  w.mixArea((fn) => w.forRect(0, 0, 19, 19, fn));
  for (let i = 0; i < w.type.length; i++) {
    if (w.type[i] === ID.STONE) assert.equal(w.temp[i], 500);
  }
});
