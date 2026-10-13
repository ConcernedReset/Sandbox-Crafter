// Grudges (grudges.js): what angers a camp, how it hits back (a raid, with
// a helicopter or missile ready; else a tunnel bomb), and the tunneller's
// job from start to bang.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import {
  ANGER_MAX, ANGER_HIT, ANGER_KILL, ANGER_MISSILE, ANGER_BLAST, CALM_FOR, SAP_C4, SAP_POWDER, SAP_FIZZLE, SAP_DEPTH,
  SAP_GATHER_FOR, SAP_STALL,
} from '../src/sim/grudges.js';
import { INSIDE } from '../src/sim/tunnels.js';
import { HUT_W } from '../src/sim/humans.js';
import { paintWar } from '../src/render/renderer.js';
import { aiPlan, campLabel } from '../src/render/ai-overlay.js';
import { cellNotes } from '../src/game/cell-notes.js';
import { run, fillRect } from './helpers.js';
import { field, settle, built, CHORES, alive } from './camps.js';

// Two settled camps `gap` apart: A (with `n` humans carrying `carry`) and
// B (with one).
function rivals(gap = 150, n = 1, carry = {}, seed = 1) {
  const w = field(gap + 110, seed);
  const A = settle(w, 55, n, carry);
  const B = settle(w, 55 + gap, 1);
  return { w, A, B };
}
const hutLeft = (w, camp) => camp.hut.cells.filter((c) => w.builtAt(c)).length;
const near = (w, a, b) => Math.max(Math.abs((a % w.w) - (b % w.w)), Math.abs(((a / w.w) | 0) - ((b / w.w) | 0))) <= 1;

test("an enemy's bullet angers the camp of the human it hits, at the shooter's camp", () => {
  const { w, A, B } = rivals();
  const [a] = A.people, [b] = B.people;
  w.pelletHits(b, b.cells[0], a);
  assert.equal(B.camp.anger, ANGER_HIT);
  assert.equal(B.camp.grudge, A.camp);
  assert.equal(b.brain.hitBy, A.camp);
  assert.equal(A.camp.anger, 0, 'not the shooter\'s');
  w.pelletHits(b, b.cells[0], b);
  assert.equal(B.camp.anger, ANGER_HIT, 'nor by its own');
});

test('dying soon after an enemy hit angers its camp more; long after, not', () => {
  const { w, A, B } = rivals(150, 2);
  const [a, a2] = A.people, [b] = B.people;
  w.pelletHits(b, b.cells[0], a);
  w.creatureDies(b);
  assert.equal(B.camp.anger, ANGER_HIT + ANGER_KILL);
  // One of A's, hit by B long ago.
  a2.brain.hitBy = B.camp;
  a2.brain.hitAt = w.tick - 5000;
  w.creatureDies(a2);
  assert.equal(A.camp.anger, 0);
});

test('an enemy missile going off in the camp angers it', () => {
  const { w, A, B } = rivals();
  const hut = B.camp.hut, c = w.campCell(B.camp, hut.u0 + 4, hut.floor - 14);
  const m = w.buildCraft(ID.MISSILE, c % w.w, (c / w.w) | 0, 1, 0, 1, { kind: 'missile', camp: A.camp, state: 'loaded', mend: false });
  assert.ok(m);
  w.detonate(m);
  assert.equal(B.camp.anger, ANGER_MISSILE);
  assert.equal(B.camp.grudge, A.camp);
  assert.equal(A.camp.anger, 0, 'far from it');
});

test('enemies near the camp anger it every second; once they have gone it cools, but not from full', () => {
  const { w, A, B } = rivals(100, 2);
  const [a, home] = A.people;
  home.brain.weapon = 0; // (no fights)
  B.people[0].brain.weapon = 0;
  const x = B.camp.x - 20;
  w.removeCreature(a);
  w.spawn((w.h - 40) * w.w + x, ID.HUMAN);
  run(w, 12);
  const o = w.creatures.find((e) => e.kind === ID.HUMAN && e.brain && e.brain.camp === null);
  o.brain.camp = A.camp;
  A.camp.members.add(o.id);
  run(w, CHORES);
  assert.ok(B.camp.anger >= 1, `angered (${B.camp.anger})`);
  assert.equal(B.camp.grudge, A.camp);
  assert.ok(w.tick - B.camp.enemyAt < CHORES, 'and on its guard');
  w.removeCreature(o);
  const was = B.camp.anger;
  run(w, CHORES);
  assert.ok(B.camp.anger < was, 'cooling');
  B.camp.anger = ANGER_MAX;
  B.camp.enemyAt = w.tick; // (not calm yet, so it doesn't hit back)
  run(w, CHORES * 3);
  assert.equal(B.camp.anger, ANGER_MAX, 'full stays full');
});

test('at full anger, once calm, a camp with a helicopter ready raids the camp it is angry with', () => {
  const { w, A, B } = rivals(150, 3, { GUNPOWDER: 4 });
  built(w, A.camp, 'pad');
  A.camp.anger = ANGER_MAX;
  A.camp.grudge = B.camp;
  A.camp.enemyAt = w.tick;
  run(w, CHORES * 2);
  assert.equal(A.camp.raid, null, 'not with an enemy lately near');
  A.camp.enemyAt = w.tick - CALM_FOR;
  run(w, CHORES);
  assert.equal(A.camp.raid?.enemy, B.camp, 'a raid on B');
  assert.equal(A.camp.anger, 0, 'its anger spent');
  assert.equal(A.camp.strikes, 1);
  assert.equal(A.camp.sap, null, 'no tunneller');
});

test('with no helicopter or missile it sends a tunneller instead: one with a pickaxe, not its engineer', () => {
  const { w, A, B } = rivals(150, 3, { GUNPOWDER: 20, METAL: 30 });
  const [p0, p1, p2] = A.people;
  A.camp.engineer = p0.id;
  p1.brain.tool = 0;
  A.camp.anger = ANGER_MAX;
  A.camp.grudge = B.camp;
  A.camp.enemyAt = -CALM_FOR;
  w.hitBack(A.camp);
  assert.equal(A.camp.sap?.id, p2.id);
  assert.equal(A.camp.sap.enemy, B.camp);
  assert.equal(A.camp.anger, 0);
  assert.equal(A.camp.raid, null);
  // A timed raid leaves it be.
  assert.ok(w.startRaid(A.camp, B.camp));
  assert.ok(!A.camp.raid.party.includes(p2.id), 'not a raider');
});

test('camp-mates by the fire hand a tunneller their spare gunpowder and metal (keeping what they need; not the engineer)', () => {
  const { w, A } = rivals(150, 3); // (12 gunpowder each)
  const [p0, p1, p2] = A.people;
  A.camp.engineer = p1.id;
  w.share(p0, p0.brain, A.camp, 'gunpowder', 20);
  assert.equal(w.has(p0.brain, ID.GUNPOWDER), 20);
  assert.equal(w.has(p1.brain, ID.GUNPOWDER), 12, 'the engineer keeps its own');
  assert.equal(w.has(p2.brain, ID.GUNPOWDER), 4, 'enough for its gun');
  // Metal, from those with their gun and armour.
  for (const p of [p1, p2]) for (let k = 0; k < 5; k++) w.stow(p.brain, ID.METAL);
  p2.brain.armour = 0;
  w.share(p0, p0.brain, A.camp, 'metal', 20);
  assert.equal(w.has(p0.brain, ID.METAL), 0, 'the engineer keeps its own, one without armour too');
  p2.brain.armour = 10;
  w.share(p0, p0.brain, A.camp, 'metal', 3);
  assert.equal(w.has(p0.brain, ID.METAL), 3);
  assert.equal(w.has(p2.brain, ID.METAL), 2);
});

test('going to war (the first raid between two camps) sends a tunneller from each side; later raids send no more', () => {
  const { w, A, B } = rivals(150, 2, { GUNPOWDER: 20, METAL: 30 });
  assert.ok(w.startRaid(A.camp, B.camp), 'A raids B');
  run(w, CHORES);
  assert.equal(A.camp.sap?.enemy, B.camp, 'A sends one against B');
  assert.equal(A.camp.sap.cause, 'war');
  assert.equal(B.camp.sap?.enemy, A.camp, 'and B one against A');
  assert.ok(A.camp.raid.party.every((id) => id !== A.camp.sap.id), '(not a raider)');
  // A failed war job is tried again later, with no anger in it.
  A.camp.anger = 0;
  w.endSap(A.camp, true);
  assert.equal(A.camp.sapFor, B.camp, 'to be sent again');
  assert.equal(A.camp.anger, 0);
  A.camp.sapRetry = w.tick;
  run(w, CHORES);
  assert.equal(A.camp.sap?.enemy, B.camp, 'sent again');
  // The next raid isn't a new war.
  w.endRaid(A.camp);
  w.endSap(A.camp, false);
  assert.ok(w.startRaid(A.camp, B.camp));
  run(w, CHORES);
  assert.equal(A.camp.sap, null, 'no more for that war');
});

test('a tunneller who dies drops the job, and the anger comes back', () => {
  const { w, A, B } = rivals(150, 1);
  assert.ok(w.startSap(A.camp, B.camp));
  A.camp.anger = 0;
  w.creatureDies(A.people[0]);
  assert.equal(A.camp.sap, null);
  assert.equal(A.camp.anger, ANGER_MAX);
  assert.ok(A.camp.sapRetry > w.tick, 'tried again later');
});

test('a tunneller digs under the enemy hut, packs it with C4, wires it to a plunger at home and blows the hut up', () => {
  const { w, A, B } = rivals(150, 1, { GUNPOWDER: 20, METAL: 30, WOOD: 10 });
  const [e] = A.people;
  for (const x of [25, 15]) fillRect(w, x, w.h - 45, x + 2, w.h - 31, ID.WOOD); // (trees, for lining)
  const hut0 = hutLeft(w, B.camp), powder0 = w.has(e.brain, ID.GUNPOWDER);
  A.camp.anger = ANGER_MAX;
  A.camp.grudge = B.camp;
  let firing = null, drawn = 0, labels = new Set(), wireNote = '';
  for (let f = 0; f < 20000 && A.camp.sapsDone + A.camp.sapsFailed === 0; f++) {
    w.step();
    const s = A.camp.sap;
    if (s && f % 50 === 0) labels.add(aiPlan(w, e).label.split(' ')[0]);
    if (s?.stage === 'firing' && firing === null) {
      firing = { wire: s.wire.slice(), charge: s.charge.cells.slice(), plug: s.plug, gunpowder: w.has(e.brain, ID.GUNPOWDER) };
      firing.human = firing.wire.every((c) => w.type[c] === ID.COPPER && w.madeByHuman(c));
      firing.label = campLabel(w, A.camp);
      wireNote = cellNotes(w, s.wire[5]).join('; ');
      const px = new Uint32Array(w.w * w.h);
      paintWar(w, px);
      drawn = s.plug.cells.filter((c) => px[c] !== 0).length;
    }
  }
  assert.equal(A.camp.sapsDone, 1, `done (failed ${A.camp.sapsFailed})`);
  assert.ok(firing, 'it got to the plunger');
  // The charge, under the middle of the hut.
  const hut = B.camp.hut, cx = firing.charge.reduce((s, c) => s + (c % w.w), 0) / firing.charge.length;
  const mid = w.campCell(B.camp, hut.u0 + (HUT_W >> 1), hut.floor);
  assert.equal(firing.charge.length, SAP_C4);
  assert.ok(Math.abs(cx - (mid % w.w)) <= 4, `under the hut (${cx} vs ${mid % w.w})`);
  assert.ok(powder0 - firing.gunpowder >= SAP_C4 * SAP_POWDER, 'gunpowder kneaded into C4 (and some shot)');
  // The wire: copper, from the charge to the plunger, every cell touching the last.
  const { wire, plug } = firing;
  assert.ok(firing.human, 'copper, put there by a human (nobody digs it up)');
  assert.ok(firing.charge.some((c) => near(w, c, wire[0])), 'from the charge');
  for (let k = 1; k < wire.length; k++) assert.ok(near(w, wire[k - 1], wire[k]), `unbroken at ${k}`);
  assert.equal(wire.at(-1), plug.plunger, 'to the plunger');
  assert.ok(wire.every((c) => (w.tunnels.mask[c] & INSIDE) === 0), 'in the walls, not in the way');
  assert.ok(wire.length > 100, `${wire.length} cells`);
  assert.ok(drawn > 0, 'the plunger drawn');
  assert.match(firing.label, /tunnel: firing/);
  assert.match(wireNote, /wire from a tunnel bomb/);
  for (const job of ['tunnelling', 'placing', 'laying', 'detonating']) assert.ok(labels.has(job), `labelled ${job}: ${[...labels]}`);
  // The bang.
  assert.ok(hutLeft(w, B.camp) <= hut0 / 2, `the hut blown up (${hutLeft(w, B.camp)} of ${hut0} left)`);
  assert.ok(B.camp.anger >= ANGER_BLAST, 'B is furious');
  assert.equal(B.camp.grudge, A.camp);
  assert.equal(w.charges.length, 0);
});

test('with another tunnel across the whole way, it digs straight through it and blows the hut up all the same', () => {
  const { w, A, B } = rivals(150, 1, { GUNPOWDER: 20, METAL: 30, WOOD: 10 });
  for (const x of [25, 15]) fillRect(w, x, w.h - 45, x + 2, w.h - 31, ID.WOOD); // (trees, for lining)
  // An old shaft in a block of stone between the camps, from just under
  // the ground to the bottom: no way to the enemy keeps clear of it.
  const top = w.h - 30, X = 160;
  for (let y = top + 1; y < w.h; y++) {
    for (let x = X - 10; x <= X + 10; x++) {
      const c = y * w.w + x;
      w.clearCell(c);
      if (Math.abs(x - X) <= 1 && y >= top + 3 && y < w.h - 2) w.tunnels.mask[c] |= INSIDE;
      else w.spawn(c, ID.STONE);
    }
  }
  const hut0 = hutLeft(w, B.camp);
  assert.ok(w.startSap(A.camp, B.camp));
  const crossed = new Set(), waits = new Set();
  for (let f = 0; f < 25000 && A.camp.sapsDone + A.camp.sapsFailed === 0; f++) {
    w.step();
    const s = A.camp.sap;
    if (s === null) continue;
    if (s.why) waits.add(s.why);
    if (s.endX >= X - 1 && s.endX <= X + 1) crossed.add(s.endY);
  }
  assert.equal(A.camp.sapsDone, 1, `done (failed ${A.camp.sapsFailed}; waited for ${[...waits]})`);
  assert.ok(!waits.has('a way'), 'never short of a way');
  assert.ok(crossed.size > 0, 'its tunnel ran through the shaft');
  assert.ok(hutLeft(w, B.camp) <= hut0 / 2, `the hut blown up (${hutLeft(w, B.camp)} of ${hut0} left)`);
});

test('a charge going off (whatever sets it off) craters up through the hut over it', () => {
  const { w, A, B } = rivals();
  const hut = B.camp.hut, cells = [];
  for (let k = -1; k <= 1; k++) {
    for (let d = 0; d <= 1; d++) {
      const c = w.campCell(B.camp, hut.u0 + 4 + k, hut.floor + SAP_DEPTH - d);
      w.clearCell(c);
      w.putDown(c, ID.C4);
      cells.push(c);
    }
  }
  const x = cells[0] % w.w, y = (cells[0] / w.w) | 0;
  w.charges.push({ cells, x, y, gx: 0, gy: 1, depth: SAP_DEPTH, by: A.camp, wire: new Set(), blownAt: -1 });
  assert.match(cellNotes(w, cells[0]).join(), /tunnel bomb/);
  const hut0 = hutLeft(w, B.camp);
  run(w, CHORES);
  assert.equal(hutLeft(w, B.camp), hut0, 'nothing till it goes off');
  w.clearCell(y * w.w + x - 1);
  w.putDown(y * w.w + x - 1, ID.COPPER);
  w.sparkAt(y * w.w + x - 1);
  run(w, 20);
  assert.equal(w.charges.length, 0);
  assert.ok(hutLeft(w, B.camp) <= hut0 / 2, `the hut blown up (${hutLeft(w, B.camp)} of ${hut0} left)`);
  assert.equal(B.camp.anger, ANGER_BLAST);
});

test('with the wire cut, the spark never gets there: it gives up, and the anger comes back', () => {
  const { w, A, B } = rivals();
  const [e] = A.people;
  assert.ok(w.startSap(A.camp, B.camp));
  A.camp.anger = 0;
  const s = A.camp.sap;
  // A charge under B's hut, and the plunger at home, with nothing between.
  const hut = B.camp.hut, c = w.campCell(B.camp, hut.u0 + 4, hut.floor + SAP_DEPTH);
  w.clearCell(c);
  w.putDown(c, ID.C4);
  s.charge = { cells: [c], x: c % w.w, y: (c / w.w) | 0, gx: 0, gy: 1, depth: SAP_DEPTH, by: A.camp, wire: s.wired, blownAt: -1 };
  w.charges.push(s.charge);
  s.plug = w.plungerSpot(A.camp, s);
  w.putDown(s.plug.plunger, ID.COPPER);
  s.wired.add(s.plug.plunger);
  s.stage = 'firing';
  const hut0 = hutLeft(w, B.camp);
  let pushed = -1;
  for (let f = 0; f < 4000 && A.camp.sap !== null; f++) {
    w.step();
    if (pushed < 0 && s.firedAt >= 0) pushed = f;
  }
  assert.ok(pushed >= 0, `it pushed the plunger (${e.brain.job})`);
  assert.equal(A.camp.sap, null);
  assert.ok(w.tick - s.firedAt >= SAP_FIZZLE, 'after waiting');
  assert.equal(A.camp.sapsFailed, 1);
  assert.equal(A.camp.anger, ANGER_MAX);
  assert.equal(hutLeft(w, B.camp), hut0, 'B untouched');
  assert.equal(w.charges.length, 1, 'the charge still there');
});

test('with no ground for a plunger by its camp (blown to bits), it puts the plunger at the end of its wire', () => {
  const { w, A, B } = rivals();
  const [e] = A.people;
  assert.ok(w.startSap(A.camp, B.camp));
  const s = A.camp.sap, lawn = w.lawn(A.camp);
  // Pits past both edges of the lawn, deeper than the camp's ground is looked for.
  for (const [u0, u1] of [[lawn.u1 + 1, lawn.u1 + 26], [lawn.u0 - 26, lawn.u0 - 1]]) {
    for (let u = u0; u <= u1; u++) {
      for (let v = -3; v <= 12; v++) {
        const c = w.campCell(A.camp, u, v);
        if (c >= 0) w.clearCell(c);
      }
    }
  }
  assert.equal(w.plungerSpot(A.camp, s), null);
  // A charge under B's hut, and the wire's end under its feet.
  const hut = B.camp.hut, ch = w.campCell(B.camp, hut.u0 + 4, hut.floor + SAP_DEPTH);
  w.clearCell(ch);
  w.putDown(ch, ID.C4);
  s.charge = { cells: [ch], x: ch % w.w, y: (ch / w.w) | 0, gx: 0, gy: 1, depth: SAP_DEPTH, by: A.camp, wire: s.wired, blownAt: -1 };
  w.charges.push(s.charge);
  const c = (e.y + 1) * w.w + e.x;
  w.clearCell(c);
  w.putDown(c, ID.COPPER);
  s.wired.add(c);
  s.wire.push(c);
  s.last = c;
  s.stage = 'wiring';
  run(w, 30);
  assert.equal(s.stage, 'firing');
  assert.ok(s.wired.has(s.plug.plunger), 'on its wire');
  assert.ok(Math.abs(s.plug.kx - e.x) <= 4, 'where it is');
});

test("a tunneller that can't get what it needs waits by the fire; in the end it gives up", () => {
  const { w, A, B } = rivals(); // (no coal or salt anywhere: no more gunpowder)
  assert.ok(w.startSap(A.camp, B.camp));
  run(w, CHORES * 2);
  assert.equal(A.camp.sap?.stage, 'gathering', 'still on it');
  assert.equal(A.people[0].brain.job, 'resting by the fire');
  A.camp.sap.start -= SAP_GATHER_FOR;
  run(w, CHORES);
  assert.equal(A.camp.sap, null);
  assert.equal(A.camp.sapsFailed, 1);
});

test("a tunneller that can't dig its way keeps at it; after a while with no headway it gives up, and the camp tries again later", () => {
  const { w, A, B } = rivals(150, 1, { GUNPOWDER: 20, METAL: 30 });
  // Rock nobody can dig, all round A's camp.
  for (let y = w.h - 30; y < w.h; y++) for (let x = 0; x < w.w; x++) {
    const c = y * w.w + x;
    if (w.type[c] === ID.DIRT || w.type[c] === ID.STONE) {
      w.clearCell(c);
      w.spawn(c, ID.WALL);
    }
  }
  assert.ok(w.startSap(A.camp, B.camp));
  A.camp.anger = 0;
  run(w, CHORES * 4);
  const s = A.camp.sap;
  assert.equal(s?.stage, 'digging', 'still on it');
  assert.equal(s.dug, 0, 'not a spot dug');
  assert.equal(w.has(A.people[0].brain, ID.C4), SAP_C4, 'its C4 kneaded');
  s.progressAt -= SAP_STALL;
  run(w, CHORES);
  assert.equal(A.camp.sap, null);
  assert.equal(A.camp.sapsFailed, 1);
  assert.equal(A.camp.anger, ANGER_MAX);
  assert.ok(A.camp.sapRetry > w.tick);
  assert.ok(alive(w, A.people[0]));
});
