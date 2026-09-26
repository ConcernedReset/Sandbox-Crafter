// Painting tools (round and square brushes, single-cell brushes, boxes) and
// how hard flying particles hit what they land on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, countOf, run } from './helpers.js';

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
  const photon = hit(ID.PHOTON), proton = hit(ID.PROTON);
  assert.ok(photon.heat > 16 * 100, `16 photons put ${photon.heat.toFixed(0)} °C of heat into the stone`);
  assert.ok(proton.heat > 16 * 300 && proton.peak > 2, `protons: ${JSON.stringify(proton)}`);
});
