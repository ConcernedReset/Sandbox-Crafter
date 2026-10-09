// Once the hut is up, one human levels the ground round it, and nobody
// mines there (grounds.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID, DEFS } from '../src/sim/elements.js';
import { HUT_W, RESOURCES } from '../src/sim/humans.js';
import { LAWN_R } from '../src/sim/grounds.js';
import { makeWorld, fillRect, run } from './helpers.js';

// Fill a rectangle with t (or empty it, t = 0), whatever was there.
function put(w, x0, y0, x1, y1, t) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      w.clearCell(y * w.w + x);
      if (t !== 0) w.spawn(y * w.w + x, t);
    }
  }
}

// A camp on dirt ground (its surface row 35) with a finished brick hut to
// the right of the pile, and n humans with pickaxes and a little wood.
function camped(n = 1) {
  const w = makeWorld(120, 60, 3);
  fillRect(w, 0, 55, 119, 59, ID.STONE);
  fillRect(w, 0, 35, 119, 54, ID.DIRT);
  const camp = w.makeCamp(40, 34);
  camp.lit = true;
  camp.burned = 99999;
  camp.hut = w.planHut(camp);
  for (const c of camp.hut.cells) w.spawn(c, ID.BRICK);
  camp.hut.done = true;
  const people = [];
  for (let k = 0; k < n; k++) {
    w.spawn(28 * w.w + 20 + 6 * k, ID.HUMAN);
    run(w, 12);
    const e = w.creatures.filter((c) => c.kind === ID.HUMAN).at(-1);
    e.brain.camp = camp;
    camp.members.add(e.id);
    e.brain.tool = 1;
    for (let j = 0; j < 5; j++) w.stow(e.brain, ID.WOOD);
    people.push(e);
  }
  run(w, 60);
  return { w, camp, people };
}

// The lawn reshaped: it needs levelling again, and nobody is at it.
function unlevel(camp, people) {
  camp.flat = false;
  camp.flattener = 0;
  for (const e of people) {
    e.brain.job = 'resting by the fire';
    e.brain.target = -1;
  }
}

const built = (w, x, y) => w.builtAt(y * w.w + x);

test('the lawn is the 10 columns either side of the hut, level with its floor', () => {
  const { w, camp } = camped(0);
  const l = w.lawn(camp);
  assert.equal(l.u0, camp.hut.u0 - LAWN_R);
  assert.equal(l.u1, camp.hut.u0 + HUT_W - 1 + LAWN_R);
  assert.equal(l.level, 35 - camp.y);
});

test('a human levels the lawn: digs the mounds, fills the pit with scaffolding', () => {
  const { w, camp, people: [e] } = camped(1);
  const hx = camp.x + camp.hut.u0; // the hut's left wall
  const right = hx + HUT_W, end = hx + HUT_W - 1 + LAWN_R;
  put(w, hx - 3, 31, hx - 1, 34, ID.DIRT); // a mound against the hut's door
  put(w, right, 35, end + 2, 40, ID.STONE); // rock there (a pit in dirt fills itself)
  put(w, right + 2, 35, right + 5, 37, 0); // a pit 3 deep
  put(w, end - 1, 33, end, 34, ID.STONE); // a boulder at the far end
  unlevel(camp, [e]);
  const b = e.brain;
  let f = 0;
  for (; f < 12000 && !camp.flat; f++) {
    b.think = 99; // only this job
    if (b.job !== 'flattening the camp' && b.job !== 'gathering wood') w.flattenWork(e, b, camp);
    w.step();
  }
  assert.ok(camp.flat, `levelled in ${f} steps (${b.job})`);
  for (const x of [hx - 3, hx - 2, hx - 1, ...Array.from({ length: LAWN_R }, (_, k) => right + k)]) {
    assert.ok(built(w, x, 35), `ground at the level in column ${x}`);
    for (let y = 25; y < 35; y++) assert.ok(!built(w, x, y), `nothing above it in column ${x} (row ${y}: ${DEFS[w.type[y * w.w + x]].key})`);
  }
  for (let x = right + 2; x <= right + 5; x++) assert.equal(w.type[37 * w.w + x], ID.SCAFFOLDING, 'the pit filled');
  assert.equal(camp.flattener, 0);
});

test('only one human levels the lawn at a time', () => {
  const { w, camp, people: [a, b] } = camped(2);
  put(w, camp.x + camp.hut.u0 + HUT_W + 2, 31, camp.x + camp.hut.u0 + HUT_W + 6, 34, ID.DIRT);
  unlevel(camp, [a, b]);
  assert.ok(w.flattenWork(a, a.brain, camp));
  assert.equal(camp.flattener, a.id);
  assert.equal(w.flattenWork(b, b.brain, camp), false, 'the other gets on with something else');
  a.brain.job = 'resting by the fire'; // a stopped
  assert.ok(w.flattenWork(b, b.brain, camp), 'then it can take over');
  assert.equal(camp.flattener, b.id);
});

test('nobody mines just under the lawn, nor opens a mine in it', () => {
  const { w, camp, people: [e] } = camped(1);
  const l = w.lawn(camp), x = camp.x + l.u1 - 3;
  put(w, x, 38, x, 38, ID.COAL); // 3 under the lawn: left alone
  put(w, x, 45, x, 45, ID.COAL); // 10 under: fair game
  const c = w.findDeposit(e, camp, RESOURCES.coal, 150);
  assert.equal(c, 45 * w.w + x, 'the deep one');
  const s = w.entranceSpot(e, camp, x, 45);
  assert.ok(s !== null, 'there is somewhere to start');
  const u = s.x - camp.x;
  assert.ok(u < l.u0 - 5 || u > l.u1 + 5, `the entrance (u ${u}) is clear of the lawn (${l.u0} .. ${l.u1})`);
});
