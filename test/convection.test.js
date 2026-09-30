import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { AMBIENT } from '../src/sim/constants.js';
import { SNUFF_AT } from '../src/sim/behaviors.js';
import { makeWorld, fillRect, wallBox, countOf, run } from './helpers.js';

// A block of metal at 1400 degrees hanging in the middle of an open world.
function hotBlock(angle = 0) {
  const w = makeWorld(100, 80);
  fillRect(w, 44, 36, 55, 43, ID.METAL);
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.METAL) w.temp[i] = 1400;
  w.setGravity({ angle });
  w.setConvection(true);
  return w;
}

const airT = (w, x, y) => w.air.t[w.air.at(x, y)];
const avgTemp = (w) => {
  let s = 0, n = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.METAL) { s += w.temp[i]; n++; }
  return s / n;
};

test('with convection off the air has no temperature of its own', () => {
  const w = makeWorld(60, 40);
  fillRect(w, 25, 15, 34, 24, ID.METAL);
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.METAL) w.temp[i] = 1400;
  run(w, 100);
  assert.ok(w.air.t.every((t) => t === AMBIENT));
});

test('a hot block heats the air above it, and the warm air rises', () => {
  const w = hotBlock();
  run(w, 300);
  const above = airT(w, 50, 28), below = airT(w, 50, 52);
  assert.ok(above > below + 5, `above ${above.toFixed(1)}, below ${below.toFixed(1)}`);
  const up = w.air.cvy(w.air.at(50, 30));
  assert.ok(up < -0.05, `air above is moving up (${up.toFixed(3)})`);
});

test('turning the arrow turns the plume', () => {
  const w = hotBlock(180);
  run(w, 300);
  const above = airT(w, 50, 28), below = airT(w, 50, 52);
  assert.ok(below > above + 5, `with gravity up the warm air goes down: above ${above.toFixed(1)}, below ${below.toFixed(1)}`);
});

test('cool air flows in towards the base of the plume', () => {
  const w = hotBlock();
  run(w, 300);
  const left = w.air.cvx(w.air.at(38, 44)), right = w.air.cvx(w.air.at(62, 44));
  assert.ok(left > 0 && right < 0, `left ${left.toFixed(3)}, right ${right.toFixed(3)}`);
});

test('heating pushes the air out, and the block slowly cools', () => {
  const w = hotBlock();
  run(w, 5);
  assert.ok(w.pressureAt(50, 33) > 0, `pressure beside the block ${w.pressureAt(50, 33).toFixed(3)}`);
  const t0 = avgTemp(w);
  run(w, 600);
  assert.ok(avgTemp(w) < t0 - 20, `cooled from ${t0.toFixed(0)} to ${avgTemp(w).toFixed(0)}`);
});

test('a fire in a sealed box still goes out with convection on', () => {
  const w = makeWorld(60, 50);
  w.setConvection(true);
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
