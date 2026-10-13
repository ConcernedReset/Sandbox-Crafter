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

test('taking any piece of a tree (the tip of a branch) brings the whole of it down: none is left hanging', () => {
  const w = makeWorld(60, 60, 1);
  fillRect(w, 0, 55, 59, 59, ID.DIRT);
  fillRect(w, 30, 30, 30, 54, ID.WOOD); // a trunk
  fillRect(w, 31, 40, 36, 40, ID.WOOD); // a branch
  fillRect(w, 26, 26, 34, 29, ID.LEAVES); // and its crown
  w.clearCell(40 * 60 + 36); // its tip
  assert.ok(w.fell(36, 40) > 20, 'the tree came down');
  for (let f = 0; f < 300; f++) w.step();
  let high = 0;
  for (let y = 0; y < 45; y++) for (let x = 0; x < 60; x++) if (w.type[y * 60 + x] === ID.WOOD) high++;
  assert.equal(high, 0, 'no wood left up high');
  assert.equal(countOf(w, ID.LEAVES), 0, 'its leaves scattered');
});

test("a growing tree whose trunk is burned through stops growing: its tip falls, and no tree grows on in the air", () => {
  const w = makeWorld(60, 80, 1);
  fillRect(w, 0, 75, 59, 79, ID.STONE); // (no soil but under it: its tip can't take root again where it falls)
  w.clearCell(75 * 60 + 30);
  w.spawn(75 * 60 + 30, ID.DIRT);
  w.spawn(74 * 60 + 30, ID.SAPLING);
  let tip = -1;
  for (let f = 0; f < 3000; f++) { // until its trunk is 6 tall, still growing
    w.step();
    tip = w.type.findIndex((t) => t === ID.SAPLING);
    if (tip >= 0 && ((tip / 60) | 0) <= 68) break;
  }
  assert.ok(tip >= 0 && ((tip / 60) | 0) <= 68, 'growing');
  for (let y = 71; y <= 73; y++) w.clearCell(y * 60 + 30); // its trunk burned through (not by a human: nothing comes down)
  const wood = countOf(w, ID.WOOD);
  for (let f = 0; f < 1500; f++) w.step();
  let high = 0;
  for (let y = 0; y < 66; y++) for (let x = 0; x < 60; x++) if (w.type[y * 60 + x] === ID.WOOD || w.type[y * 60 + x] === ID.LEAVES) high++;
  assert.equal(high, 0, 'nothing grew on up there');
  assert.ok(countOf(w, ID.WOOD) <= wood + 1, 'it stopped growing');
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
