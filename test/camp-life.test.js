// Camp life: humans sharing what they can spare by the fire (humans.js's
// share), and planting saplings when the trees near the camp run out
// (planting.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { METALS, FUEL_R, WOOD_ONLY } from '../src/sim/humans.js';
import { PLANT_GAP, PLANT_R, WOOD_LOW, PLANT_N } from '../src/sim/planting.js';
import { VEIN_R } from '../src/sim/tunnels.js';
import { aiPlan, campLabel } from '../src/render/ai-overlay.js';
import { run, fillRect } from './helpers.js';
import { field, settle, CHORES } from './camps.js';

const empty = (w, b, t) => { while (w.takeOut(b, t)); };
// Coal in place of what's there.
const ore = (w, x0, y0, x1, y1) => {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      w.clearCell(y * w.w + x);
      w.spawn(y * w.w + x, ID.COAL);
    }
  }
};

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

test("a second miner leaves a vein a camp-mate's tunnel is on its way to, and mines it through that tunnel once it's there", () => {
  const w = field(320, 7);
  const { camp, people: [a, b] } = settle(w, 160, 2);
  const lawn = w.lawn(camp), g = w.h - 30;
  ore(w, camp.x + lawn.u1 + 20, g + 14, camp.x + lawn.u1 + 30, g + 17); // one vein
  assert.ok(w.startMining(a, a.brain, camp, 'coal', 4), 'the first sets off');
  const t = a.brain.tun;
  assert.ok(!w.startMining(b, b.brain, camp, 'coal', 4), 'the second leaves it be');
  assert.equal(b.brain.tun, null);
  // The first gets there.
  for (let f = 0; f < 8000 && Math.max(Math.abs(a.x - t.tx), Math.abs(a.y - t.ty)) > VEIN_R; f++) w.step();
  assert.ok(Math.max(Math.abs(a.x - t.tx), Math.abs(a.y - t.ty)) <= VEIN_R, 'the first got there');
  const entrances = [...w.tunnels.nodes.values()].filter((n) => n.entrance).length;
  b.brain.skip.delete('coal');
  b.brain.job = 'wandering';
  assert.ok(w.startMining(b, b.brain, camp, 'coal', 4), 'now the second sets off');
  assert.equal(b.brain.tun.entrance, false, 'through the tunnel there is, not a new entrance');
  assert.equal([...w.tunnels.nodes.values()].filter((n) => n.entrance).length, entrances);
});

test('the camp sends a miner to the vein that takes the least digging, not just the nearest', () => {
  const w = field(320, 8);
  const { camp, people: [a] } = settle(w, 160, 1);
  const lawn = w.lawn(camp), g = w.h - 30;
  const near = camp.x + lawn.u1 + 6, far = camp.x + lawn.u1 + 40;
  ore(w, near, g + 22, near + 3, g + 24); // nearer it, but deep
  ore(w, far, g + 8, far + 3, g + 10); // farther, but just under the ground
  assert.ok(w.startMining(a, a.brain, camp, 'coal', 4));
  assert.ok(Math.abs(a.brain.tun.tx - far) <= 4, `the shallow one (${a.brain.tun.tx}: near ${near}, far ${far})`);
});

test('a human out for wood fells the whole tree and gathers all the wood that falls, more than a load', () => {
  const w = field(320, 9);
  const { camp, people: [e] } = settle(w, 160, 1);
  const g = w.h - 30, x0 = camp.x + 60;
  for (let y = g - 30; y < g; y++) w.spawn(y * w.w + x0, ID.WOOD); // a trunk 30 tall
  for (let x = x0 + 1; x <= x0 + 5; x++) w.spawn((g - 20) * w.w + x, ID.WOOD); // a branch
  for (let y = g - 36; y < g - 30; y++) for (let x = x0 - 4; x <= x0 + 4; x++) w.spawn(y * w.w + x, ID.LEAVES); // the crown
  const tree = 35;
  while (w.takeOut(e.brain, ID.WOOD));
  e.brain.weapon = 0;
  assert.ok(w.gather(e, e.brain, camp, WOOD_ONLY, FUEL_R, 'gathering wood'));
  let f = 0;
  for (; f < 5000 && (e.brain.job === 'gathering wood' || e.brain.felled !== null); f++) w.step();
  let left = 0, high = 0;
  for (let y = 0; y < g; y++) {
    for (let x = x0 - 20; x <= x0 + 20; x++) {
      if (w.type[y * w.w + x] !== ID.WOOD) continue;
      left++;
      if (y < g - 6) high++;
    }
  }
  assert.equal(high, 0, 'nothing left up in the air');
  assert.ok(w.has(e.brain, ID.WOOD) + w.pileCount(camp, new Uint8Array(4096).fill(0).map((_, t) => (t === ID.WOOD ? 1 : 0))) >= tree - 3, `it has the tree's wood (${w.has(e.brain, ID.WOOD)} in hand, ${left} left about, after ${f} steps)`);
  assert.ok(w.has(e.brain, ID.WOOD) > 10 || left <= 3, 'more than a load');
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
