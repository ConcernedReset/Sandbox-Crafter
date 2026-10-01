// Air pressure moves boiling and melting points.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, wallBox, countOf, run } from './helpers.js';

// A sealed box with something in it, its air held at `pressure` and its
// contents held at `temp` every frame.
function box(t, temp, pressure, frames) {
  const w = makeWorld(60, 40);
  const b = wallBox(w, 10, 5, 49, 34);
  fillRect(w, 20, 20, 39, 33, t);
  const hold = () => {
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const a = w.air.at(x, y);
        if (!w.air.blocked[a]) w.air.p[a] = pressure;
        const i = y * w.w + x;
        if (temp !== null && w.type[i] === t) w.temp[i] = temp;
      }
    }
  };
  run(w, frames, hold);
  return w;
}

test('in a vacuum, water boils away at room temperature', () => {
  assert.equal(countOf(box(ID.WATER, null, 0, 200), ID.STEAM), 0, 'not at normal pressure');
  assert.ok(countOf(box(ID.WATER, null, -60, 200), ID.STEAM) > 20, 'but in a vacuum');
});

test('under pressure, water stays liquid well past 100 °C', () => {
  assert.ok(countOf(box(ID.WATER, 110, 0, 100), ID.STEAM) > 20, 'it boils at 110 °C at normal pressure');
  const cooker = box(ID.WATER, 110, 50, 100);
  assert.equal(countOf(cooker, ID.STEAM), 0, 'but not in a pressure cooker');
});

test('high pressure keeps metal from melting', () => {
  assert.ok(countOf(box(ID.METAL, 1600, 0, 150), ID.MOLTEN_METAL) > 20, 'it melts at 1600 °C normally');
  assert.equal(countOf(box(ID.METAL, 1600, 150, 150), ID.MOLTEN_METAL), 0, 'not under heavy pressure');
});

test('a vacuum does not make metal melt any sooner', () => {
  assert.equal(countOf(box(ID.METAL, 1500, -60, 150), ID.MOLTEN_METAL), 0);
});
