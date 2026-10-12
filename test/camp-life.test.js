// Camp life: humans sharing what they can spare by the fire (humans.js's
// share), and planting saplings when the trees near the camp run out
// (planting.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { METALS } from '../src/sim/humans.js';
import { PLANT_GAP, PLANT_R, WOOD_LOW, PLANT_N } from '../src/sim/planting.js';
import { aiPlan, campLabel } from '../src/render/ai-overlay.js';
import { run, fillRect } from './helpers.js';
import { field, settle, CHORES } from './camps.js';

const empty = (w, b, t) => { while (w.takeOut(b, t)); };

test('a human short of gunpowder is handed what camp-mates by the fire can spare (they keep enough for their guns)', () => {
  const w = field(300, 1);
  const { camp, people: [a, b] } = settle(w, 150, 2);
  empty(w, a.brain, ID.GUNPOWDER);
  w.craftWork(a, a.brain, camp);
  assert.equal(w.has(a.brain, ID.GUNPOWDER), 8);
  assert.equal(w.has(b.brain, ID.GUNPOWDER), 4);
});

test('metal for a gun comes from a camp-mate with its own gun and armour (not one without armour, nor the engineer)', () => {
  const w = field(300, 2);
  const { camp, people: [a, b, c, d] } = settle(w, 150, 4);
  a.brain.weapon = 0;
  a.brain.armour = 0;
  for (const o of [b, c, d]) for (let k = 0; k < 6; k++) w.stow(o.brain, ID.METAL);
  c.brain.armour = 0;
  camp.engineer = d.id;
  w.craftWork(a, a.brain, camp);
  assert.equal(a.brain.weapon, 1, 'it made its gun');
  assert.equal(w.holding(b.brain, METALS), 0, 'from the armed one (for its armour too)');
  assert.equal(w.holding(c.brain, METALS), 6, 'not the one still wanting armour');
  assert.equal(w.holding(d.brain, METALS), 6, 'nor the engineer');
});

test('wood comes from camp-mates with nothing to do; raiders and the tunneller never give', () => {
  const w = field(300, 3);
  const { camp, people: [a, b, c, d, f] } = settle(w, 150, 5);
  b.brain.job = 'resting by the fire';
  c.brain.job = 'mining';
  d.brain.job = 'wandering';
  d.brain.raid = camp; // (a raider)
  f.brain.job = 'wandering';
  camp.sap = { id: f.id };
  empty(w, a.brain, ID.WOOD);
  const had = w.has(b.brain, ID.WOOD), others = [c, d, f].map((o) => w.has(o.brain, ID.WOOD));
  assert.ok(had > 0);
  assert.equal(w.share(a, a.brain, camp, 'wood', 20), had);
  assert.equal(w.has(a.brain, ID.WOOD), had);
  assert.equal(w.has(b.brain, ID.WOOD), 0, 'the one resting');
  assert.deepEqual([c, d, f].map((o) => w.has(o.brain, ID.WOOD)), others, 'none from the others');
  camp.sap = null;
  // And only by the fire.
  c.brain.job = 'resting by the fire';
  assert.equal(w.share(a, a.brain, { ...camp, x: camp.x + 100 }, 'wood', 20), 0, 'away from the fire, nobody hands over anything');
});

test('a camp whose trees have run out plants saplings round it, spaced out past its lawn, and they grow', () => {
  const w = field(320, 4);
  const { camp } = settle(w, 160, 2);
  const lawn = w.lawn(camp), y = w.h - 31, planted = [];
  const spawn = w.spawn.bind(w);
  w.spawn = (c, t) => { // (saplings put on the ground; a growing tree's are higher up)
    if (t === ID.SAPLING && ((c / w.w) | 0) === y) planted.push((c % w.w) - camp.x);
    return spawn(c, t);
  };
  let planter = 0, label = '', campText = '';
  for (let f = 0; f < 4000 && camp.planted < PLANT_N; f++) {
    w.step();
    if (camp.planter !== 0 && planter === 0) {
      planter = camp.planter;
      run(w, 20);
      const o = w.creatureById[planter];
      label = aiPlan(w, o).label;
      campText = campLabel(w, camp);
    }
  }
  assert.ok(planter !== 0, 'someone set to planting');
  assert.match(label, /^planting saplings/);
  assert.match(campText, /planting/);
  assert.equal(camp.planted, PLANT_N);
  const roots = planted.sort((p, q) => p - q);
  assert.equal(roots.length, PLANT_N, `three planted (${roots})`);
  for (const u of roots) assert.ok(u > lawn.u1 || u < lawn.u0, `past the lawn (${u})`);
  for (let k = 1; k < roots.length; k++) assert.ok(roots[k] - roots[k - 1] >= PLANT_GAP, 'spaced out');
  let most = 0; // (the camp may fell them for its fire as soon as they're up)
  run(w, 1500, () => { most = Math.max(most, w.treesNear(camp).wood); });
  assert.ok(most > 20, `grown into trees (${most} wood)`);
  assert.equal(camp.planter, 0, 'the planter is free again');
});

test('a camp with trees enough near it plants none', () => {
  const w = field(320, 5);
  const { camp } = settle(w, 160, 2);
  fillRect(w, 200, w.h - 42, 209, w.h - 31, ID.WOOD); // a big log: wood nobody put there
  assert.ok(w.treesNear(camp).wood >= WOOD_LOW);
  run(w, CHORES * 12);
  assert.equal(camp.planter, 0);
  assert.equal(camp.planted, 0);
});

test('saplings are never planted on the lawn, over a tunnel, or near a tree', () => {
  const w = field(320, 6);
  const { camp } = settle(w, 160, 1);
  const lawn = w.lawn(camp);
  // A tunnel just under the first spot out on the right; a tree a little
  // farther out on the left.
  const u1 = lawn.u1 + 8, g = w.groundAt(camp, u1);
  for (let v = g + 2; v <= g + 7; v++) for (let du = -1; du <= 1; du++) w.markInside(...((c) => [c % w.w, (c / w.w) | 0])(w.campCell(camp, u1 + du, v)));
  const t = w.campCell(camp, lawn.u0 - 10, w.groundAt(camp, lawn.u0 - 10) - 1);
  for (let k = 0; k < 8; k++) w.spawn(t - k * w.w, ID.WOOD);
  const spots = w.plantSpots(camp, 6);
  assert.ok(spots.length >= 3);
  for (const p of spots) {
    assert.ok(!w.inLawn(p.x, p.y), 'not on a lawn');
    assert.ok(Math.abs(p.u - u1) > 1, 'not over the tunnel');
    assert.ok(Math.abs(p.u - (lawn.u0 - 10)) >= PLANT_GAP, 'not by the tree');
  }
});
