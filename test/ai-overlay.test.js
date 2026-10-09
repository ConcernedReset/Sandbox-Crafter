// The debug views (ai-overlay.js): spheres of influence and AI data.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { loadScene } from '../src/game/scenes.js';
import { goalOf, aiPlan, campLabel, AITrails, viewOf, drawInfluence, drawAI } from '../src/render/ai-overlay.js';
import { makeWorld, fillRect, run } from './helpers.js';

// A canvas context that only counts what's drawn.
function stubCtx() {
  const calls = { text: [], strokes: 0 };
  const ctx = new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'measureText') return (s) => ({ width: s.length * 6 });
      if (k === 'fillText') return (s) => calls.text.push(s);
      if (k === 'stroke') return () => { calls.strokes++; };
      return () => {};
    },
    set(t, k, val) { t[k] = val; return true; },
  });
  return { ctx, calls };
}

test('every job has a kind of goal and a colour', () => {
  assert.equal(goalOf('mining').kind, 'mine');
  assert.equal(goalOf('gathering wood').kind, 'gather');
  assert.equal(goalOf('shooting').kind, 'fight');
  assert.equal(goalOf('something new').kind, 'wander');
  for (const job of ['fleeing', 'resting by the fire', 'building the hut', 'flattening the camp']) {
    assert.match(goalOf(job).color, /^#[0-9a-f]{6}$/);
  }
});

test("a human's plan points at what it's after", () => {
  const w = makeWorld(120, 60, 1);
  fillRect(w, 0, 50, 119, 59, ID.STONE);
  fillRect(w, 90, 44, 95, 49, ID.WOOD);
  w.spawn(40 * 120 + 30, ID.HUMAN);
  run(w, 20);
  const e = w.creatures.find((c) => c.brain);
  for (let f = 0; f < 400 && e.brain.job !== 'gathering wood'; f++) w.step();
  assert.equal(e.brain.job, 'gathering wood');
  const p = aiPlan(w, e);
  assert.equal(p.kind, 'gather');
  assert.deepEqual(p.target, [e.brain.target % 120, (e.brain.target / 120) | 0]);
  assert.deepEqual(p.path[0], [e.x, e.y]);
  assert.match(p.label, /^gathering wood \d+\/10/);
  e.brain.job = 'fleeing';
  e.brain.fleeDir = -1;
  assert.deepEqual(aiPlan(w, e).arrow, [-1, 0], 'fleeing: an arrow the way it runs');
});

test('a mining human shows the tunnel it will dig, to its target', () => {
  const w = makeWorld(160, 90, 2);
  fillRect(w, 0, 85, 159, 89, ID.STONE);
  fillRect(w, 0, 40, 159, 84, ID.DIRT);
  w.spawn(30 * 160 + 60, ID.HUMAN);
  run(w, 80);
  const e = w.creatures.find((c) => c.brain);
  e.brain.camp = w.joinOrMakeCamp(e);
  e.brain.tun = { tx: 100, ty: 62, x: 80, y: 39, entrance: true, route: null, legs: null, node: null };
  e.brain.job = 'mining';
  e.brain.mineKey = 'coal';
  e.brain.wantN = 5;
  const p = aiPlan(w, e);
  assert.equal(p.kind, 'mine');
  assert.deepEqual(p.path.at(-1), [100, 62], 'the path ends at the deposit');
  assert.deepEqual(p.path[1], [80, 39], 'by way of the new entrance');
  assert.match(p.label, /mining coal 0\/5, to a new entrance/);
});

test('both views draw the Wilderness, with a label per camp and per human', () => {
  const w = makeWorld(400, 240, 3);
  loadScene(w, 'wilderness');
  run(w, 1500);
  const v = viewOf({ width: 1200, height: 720 }, { x: 0, y: 0, vw: 400, vh: 240 });
  const a = stubCtx();
  drawInfluence(a.ctx, w, v);
  assert.equal(a.calls.text.filter((s) => s.startsWith('Camp ')).length, w.camps.length);
  assert.ok(w.camps.length > 0 && a.calls.strokes > 0);
  assert.match(campLabel(w, w.camps[0]), /^Camp \d+ · \d+ humans? · /);
  const trails = new AITrails();
  for (let f = 0; f < 40; f++) { w.step(); trails.record(w); }
  const b = stubCtx();
  drawAI(b.ctx, w, v, trails);
  const humans = w.creatures.filter((c) => c.brain);
  assert.equal(b.calls.text.length, humans.length, 'a label each');
  for (const e of humans) assert.ok(trails.paths.has(e.id));
});
