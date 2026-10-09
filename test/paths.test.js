// Humans plan their way overland (paths.js) and follow the plan (walkTo).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { MOVE, bodyOf } from '../src/sim/paths.js';
import { makeWorld, fillRect, run, countOf } from './helpers.js';

// A human grown at x, `above` cells over the floor, kept from doing
// anything of its own accord: its job 'walking' does nothing but what
// walk() below does.
function human(w, x, above = 7) {
  if (!w.walkingOnly) {
    const act = w.act.bind(w);
    w.act = (e, b) => (b.job === 'walking' ? undefined : act(e, b));
    w.walkingOnly = true;
  }
  w.spawn((w.h - 5 - above) * w.w + x, ID.HUMAN);
  run(w, 40);
  const e = w.creatures.find((c) => c.kind === ID.HUMAN && c.brain);
  e.brain.think = 1e9;
  e.brain.job = 'walking';
  return e;
}

function floor(w, gy = 1) {
  if (gy === 1) fillRect(w, 0, w.h - 5, w.w - 1, w.h - 1, ID.STONE);
}

const moves = (r) => new Set(r.pts.slice(1).map((p) => p.m));

// Walk e to (tx, ty) (as fetching does, within `near`), up to `steps`
// steps: the steps it took, or -1 if it gave up.
function walk(w, e, tx, ty, near, steps) {
  const b = e.brain;
  b.job = 'walking';
  for (let f = 0; f < steps; f++) {
    b.think = 1e9;
    if (b.job !== 'walking') return -1; // it gave up
    if (w.walkTo(e, b, tx, ty, near, 4)) return f;
    w.step();
  }
  return steps;
}

test('across flat ground: a straight walk', () => {
  const w = makeWorld(120, 40, 1);
  floor(w);
  const e = human(w, 20);
  const r = w.findPath(e, 90, e.y, 1, 30);
  assert.ok(r, 'a way');
  assert.deepEqual([...moves(r)], [MOVE.walk]);
  assert.equal(r.pts.length, 90 - 1 - e.x + 1, 'a cell a step, straight there');
});

test('up a cliff: it climbs; through a thin trunk: it cuts', () => {
  const w = makeWorld(120, 60, 1);
  floor(w);
  fillRect(w, 50, 30, 70, 54, ID.STONE); // a cliff 25 high
  const e = human(w, 20);
  const up = w.findPath(e, 60, 29, 1, 30);
  assert.ok(up && moves(up).has(MOVE.climb), 'climbs the cliff');
  assert.ok(!moves(up).has(MOVE.dig), "doesn't dig rock it can't");
  const w2 = makeWorld(120, 60, 1);
  floor(w2);
  fillRect(w2, 50, 30, 51, 54, ID.WOOD); // a trunk 2 wide, 25 high
  const e2 = human(w2, 20);
  const past = w2.findPath(e2, 90, e2.y, 1, 30);
  assert.ok(past && moves(past).has(MOVE.dig) && !moves(past).has(MOVE.climb), 'cuts through, not over');
});

test('no way into a closed stone box: null, and the human gives up at once', () => {
  const w = makeWorld(120, 60, 1);
  floor(w);
  fillRect(w, 70, 30, 90, 54, ID.STONE);
  for (let y = 40; y <= 50; y++) for (let x = 76; x <= 84; x++) w.clearCell(y * 120 + x);
  const e = human(w, 20), x0 = e.x;
  assert.equal(w.findPath(e, 80, 50, 1, 30), null, 'stone it can\'t dig all round');
  assert.ok(w.findPath(e, 80, 50, 1, 150), 'with a pickaxe it can dig in');
  const f = walk(w, e, 80, 50, 1, 400);
  assert.equal(f, -1, 'gave up');
  assert.equal(e.x, x0, 'without setting off');
});

test("it never plans to dig what humans built: it goes round by the hut's doorway", () => {
  const w = makeWorld(120, 60, 1);
  floor(w);
  // A brick wall 20 high with a doorway at the bottom, and one without.
  for (let y = 35; y <= 54; y++) for (const x of [60, 61]) if (y < 48) w.putDown(y * 120 + x, ID.BRICK);
  for (let y = 35; y <= 54; y++) for (const x of [90, 91]) w.putDown(y * 120 + x, ID.BRICK);
  const e = human(w, 20);
  const r = w.findPath(e, 80, e.y, 1, 150);
  assert.ok(r && !moves(r).has(MOVE.dig), 'through the doorway');
  const over = w.findPath(e, 105, e.y, 1, 150);
  assert.ok(over && !moves(over).has(MOVE.dig) && moves(over).has(MOVE.climb), 'over the other, not through');
});

test('a human follows its plan over a cliff without digging, and gets there', () => {
  const w = makeWorld(160, 70, 2);
  floor(w);
  fillRect(w, 60, 35, 80, 64, ID.STONE); // a cliff 30 high
  fillRect(w, 81, 50, 159, 64, ID.STONE); // a plateau beyond, lower
  const e = human(w, 30);
  const rock = countOf(w, ID.STONE);
  const f = walk(w, e, 120, 49, 1, 3000);
  assert.ok(f > 0 && f < 3000, `arrived (${f} steps, at ${e.x},${e.y})`);
  assert.equal(countOf(w, ID.STONE), rock, 'dug nothing');
  assert.ok(e.brain.path === null || e.brain.path.replans === 0, 'no need to plan again');
});

test('over rolling hills it keeps to its plan (its feet land where planned)', () => {
  const w = makeWorld(200, 60, 3);
  floor(w);
  for (let x = 0; x < 200; x++) {
    const top = 50 - Math.round(4 * Math.sin(x / 7) + 3 * Math.sin(x / 3.1));
    fillRect(w, x, top, x, 54, ID.DIRT);
  }
  run(w, 60);
  const e = human(w, 15, 25);
  let replans = 0, last = null;
  const b = e.brain;
  let f = 0;
  for (; f < 3000 && !w.walkTo(e, b, 180, 40, 1, 4); f++) {
    b.think = 1e9;
    if (b.path && b.path !== last && b.path.replans > 0) replans = Math.max(replans, b.path.replans);
    last = b.path;
    w.step();
  }
  assert.ok(f < 3000, `crossed the hills (at ${e.x},${e.y})`);
  assert.ok(replans <= 1, `planned again ${replans} times`);
});

test("tunnel insides hold it up as boards, as the game does (but not right on the network's spots)", () => {
  const w = makeWorld(120, 60, 1);
  floor(w);
  fillRect(w, 0, 40, 119, 54, ID.DIRT);
  const e = human(w, 20, 20);
  // An entrance shaft at x 60, and a big open working underground.
  for (let y = 30; y <= 50; y++) for (let x = 59; x <= 61; x++) { w.clearCell(y * 120 + x); w.tunnels.mask[y * 120 + x] |= 1; }
  for (let y = 42; y <= 50; y++) for (let x = 40; x <= 80; x++) { w.clearCell(y * 120 + x); w.tunnels.mask[y * 120 + x] |= 1; }
  w.addNode(60, 39, true);
  const body = bodyOf(e.kind);
  assert.equal(w.footing(body, 60, 39, 0, 1), 2, 'boards over the mouth (an entrance)');
  assert.equal(w.footing(body, 50, 45, 0, 1), 2, 'and in the air of the workings');
  w.addEdge(w.addNode(45, 45), w.addNode(55, 45)); // a run along the workings
  assert.equal(w.footing(body, 50, 45, 0, 1), 0, 'but not right on a spot of the network');
  const r = w.findPath(e, 100, e.y, 1, 30);
  assert.ok(r && r.pts.every((p) => p.y <= 39), 'straight over the mouth, not down into it');
});

test('with gravity pulling sideways it plans in its own frame', () => {
  const w = makeWorld(80, 160, 1);
  w.setGravity({ angle: 90 }); // down is to the left: the floor is the left wall
  fillRect(w, 0, 0, 4, 159, ID.STONE);
  fillRect(w, 5, 100, 14, 103, ID.STONE); // a ledge to climb round
  w.spawn(80 * 80 + 15, ID.HUMAN);
  run(w, 80);
  const e = w.creatures.find((c) => c.brain);
  assert.equal(e.gx, -1, 'standing on the left wall');
  const r = w.findPath(e, 5, 130, 1, 30);
  assert.ok(r && moves(r).has(MOVE.climb), 'a way along the wall, up and over the ledge');
});

test('planning is quick: a long way, or none, in a few milliseconds', () => {
  const w = makeWorld(400, 120, 4);
  fillRect(w, 0, 115, 399, 119, ID.STONE);
  for (let x = 30; x < 380; x += 40) fillRect(w, x, 95 - (x % 3) * 6, x + 8, 114, ID.STONE);
  w.spawn(100 * 400 + 10, ID.HUMAN);
  run(w, 60);
  const e = w.creatures.find((c) => c.brain);
  let t = performance.now();
  for (let k = 0; k < 10; k++) w.findPath(e, 390, 114, 1, 30);
  const each = (performance.now() - t) / 10;
  assert.ok(each < 40, `${each.toFixed(1)} ms a plan`);
  fillRect(w, 0, 0, 399, 0, ID.STONE);
  t = performance.now();
  const r = w.findPath(e, 390, 2, 1, 30); // up in the roof: no way
  assert.ok(r === null || r === undefined);
  assert.ok(performance.now() - t < 80, 'giving up is quick too');
});
