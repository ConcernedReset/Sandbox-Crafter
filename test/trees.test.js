// Saplings grow into trees: a wood trunk, branches and a crown of leaves,
// each tree its own height, shape and colour (trees.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, run, countOf } from './helpers.js';

// A sapling dropped onto a dirt floor, grown for `frames` frames.
function grow(seed, frames = 1500) {
  const w = makeWorld(90, 80, seed);
  fillRect(w, 0, 75, 89, 79, ID.DIRT);
  w.spawn(70 * 90 + 45, ID.SAPLING);
  run(w, frames);
  return w;
}

// The highest row with wood or leaves in it, and the rows and columns the
// leaves cover.
function measure(w) {
  let top = Infinity, x0 = Infinity, x1 = -Infinity;
  const shades = new Set();
  for (let i = 0; i < w.type.length; i++) {
    const t = w.type[i];
    if (t !== ID.WOOD && t !== ID.LEAVES) continue;
    const x = i % w.w, y = (i / w.w) | 0;
    top = Math.min(top, y);
    if (t === ID.LEAVES) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      shades.add(w.shade[i] & 7);
    }
  }
  return { height: 75 - top, width: x1 - x0 + 1, shades: [...shades].sort().join('') };
}

test('a sapling on dirt grows into a tree: a wood trunk and a crown of leaves', () => {
  const w = grow(3);
  assert.ok(countOf(w, ID.WOOD) >= 12, `trunk of ${countOf(w, ID.WOOD)}`);
  assert.ok(countOf(w, ID.LEAVES) >= 20, `${countOf(w, ID.LEAVES)} leaves`);
  assert.equal(countOf(w, ID.SAPLING), 0, 'done growing');
  const { height } = measure(w);
  assert.ok(height >= 15 && height <= 60, `height ${height}`);
  assert.ok(w.seen[ID.LEAVES], 'leaves count as a discovery');
});

test('a sapling waits until it lands on soil', () => {
  const w = makeWorld(40, 40);
  fillRect(w, 0, 35, 39, 39, ID.STONE);
  w.spawn(20 * 40 + 20, ID.SAPLING);
  run(w, 600);
  assert.equal(countOf(w, ID.SAPLING), 1, 'still a sapling on bare stone');
  assert.equal(countOf(w, ID.LEAVES), 0);
});

test('every tree is different: heights, shapes and leaf colours vary', () => {
  const trees = [11, 12, 13, 14, 15, 16, 17, 18].map((s) => measure(grow(s)));
  const heights = new Set(trees.map((t) => t.height));
  const widths = new Set(trees.map((t) => t.width));
  const colours = new Set(trees.map((t) => t.shades));
  assert.ok(heights.size >= 4, `heights ${[...heights]}`);
  assert.ok(widths.size >= 3, `widths ${[...widths]}`);
  assert.ok(colours.size >= 2, `colours ${[...colours]}`);
});

test('a tree grows up against the gravity arrow', () => {
  const w = makeWorld(80, 60, 5);
  w.setGravity({ angle: 90 }); // pulls left: "up" is to the right
  fillRect(w, 0, 0, 4, 59, ID.DIRT);
  w.spawn(30 * 80 + 10, ID.SAPLING);
  run(w, 1500);
  let right = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.WOOD) right = Math.max(right, i % 80);
  assert.ok(right >= 18, `trunk reaches x ${right}`);
  assert.ok(countOf(w, ID.LEAVES) >= 20);
});

test('a tree whose trunk is cut at the foot comes down where its wood can be gathered', () => {
  const w = makeWorld(60, 60, 1);
  fillRect(w, 0, 55, 59, 59, ID.DIRT);
  fillRect(w, 30, 30, 30, 54, ID.WOOD); // a trunk
  fillRect(w, 26, 26, 34, 29, ID.LEAVES); // and its crown
  w.clearCell(54 * 60 + 30);
  w.fell(30, 54);
  for (let f = 0; f < 300; f++) w.step();
  let high = 0;
  for (let y = 0; y < 45; y++) for (let x = 0; x < 60; x++) if (w.type[y * 60 + x] === ID.WOOD) high++;
  assert.equal(high, 0, 'no wood left hanging up high');
  assert.ok(w.type.filter((t) => t === ID.WOOD).length >= 20, 'the wood is all still there, on the ground');
});
