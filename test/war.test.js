// War (war.js, aircraft.js): what settled camps build (an anti-air gun, a
// helicopter on its pad, a missile launcher), how each of them works, raids
// on other camps, and births.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFS, ID } from '../src/sim/elements.js';
import { BODY } from '../src/sim/creatures.js';
import { CAMP_AWAY_R } from '../src/sim/humans.js';
import {
  AA_CAP, AA_R, HELI_METAL, MISSILE_POWDER, MISSILE_METAL, RAID_MIN, RAID_MAX, BIRTH_EVERY, POP_CAP, SHELL_SPEED,
} from '../src/sim/war.js';
import { HELI_GUN_R } from '../src/sim/aircraft.js';
import { paintWar } from '../src/render/renderer.js';
import { craftPlan, campLabel } from '../src/render/ai-overlay.js';
import { fillRect, run, countOf } from './helpers.js';
import { field, settle, built, CHORES, alive } from './camps.js';

const health = (people) => people.reduce((s, e) => s + e.lost * 100 + (10 - e.brain.armour), 0);

test('a missile is a 1x5 body with a 2-pixel fin either side of its tail', () => {
  const sh = DEFS[ID.MISSILE].shape, f = sh.frames[0];
  const at = new Set([...f.dx].map((dx, p) => `${dx},${f.dy[p]}`));
  for (let dy = 0; dy >= -4; dy--) assert.ok(at.has(`0,${dy}`), `body cell ${dy}`);
  for (const dx of [-1, 1]) for (const dy of [0, -1]) assert.ok(at.has(`${dx},${dy}`), `fin ${dx},${dy}`);
  assert.equal(sh.n, 9);
  assert.ok(DEFS[ID.HELICOPTER].shape.n <= 64, 'a helicopter fits the footprint scratch');
});

for (const first of ['aa', 'heli']) {
  test(`the engineer builds the ${first === 'aa' ? 'anti-air gun' : 'helicopter'} first, then the other, then the launcher and a missile`, () => {
    const w = field(220, 3);
    const { camp, people: [e] } = settle(w, 60, 1, { STONE: 40, METAL: 40, GUNPOWDER: 40 });
    fillRect(w, 150, 50, 158, 59, ID.WOOD);
    camp.firstWar = first;
    const done = {};
    for (let f = 0; f < 4000 && done.missile === undefined; f++) {
      w.step();
      if (camp.aa?.done && done.aa === undefined) done.aa = f;
      if (alive(w, camp.heli) && done.heli === undefined) done.heli = f;
      if (camp.launcher?.done && done.launcher === undefined) done.launcher = f;
      if (alive(w, camp.launcher?.missile ?? null) && done.missile === undefined) done.missile = f;
    }
    assert.ok(done.missile !== undefined, `all built: ${JSON.stringify(done)} (${e.brain.job})`);
    if (first === 'aa') assert.ok(done.aa < done.heli, `the gun first: ${JSON.stringify(done)}`);
    else assert.ok(done.heli < done.aa, `the helicopter first: ${JSON.stringify(done)}`);
    assert.ok(Math.max(done.aa, done.heli) < done.launcher, 'the launcher last');
    assert.ok(camp.pad.roof, 'its pad on the hut roof');
    assert.equal(camp.aa.ammo, AA_CAP, 'the gun loaded');
    for (const s of [camp.pad, camp.aa, camp.launcher]) {
      for (const c of s.cells) assert.ok(w.madeByHuman(c), `${s.name} is human-made, so nobody digs it up`);
    }
    run(w, 200);
    assert.equal(camp.engineer, 0, 'nothing left to do: nobody is the engineer');
    assert.equal(e.brain.armour, 10, 'unhurt');
  });
}

test('only one human at a time builds the war machines; the others carry on', () => {
  const w = field(220, 4);
  const { camp, people } = settle(w, 60, 3, { STONE: 20, METAL: 30, GUNPOWDER: 20 });
  fillRect(w, 150, 50, 158, 59, ID.WOOD);
  let most = 0;
  for (let f = 0; f < 1500; f++) {
    w.step();
    const n = people.filter((e) => /^(building the (helipad|anti-air gun|launcher|helicopter)|loading)/.test(e.brain.job)).length;
    most = Math.max(most, n);
  }
  assert.equal(most, 1);
  assert.ok(camp.aa !== null || camp.pad !== null, 'it got on with it');
});

test('trees over the hut are cleared for the helipad on its roof', () => {
  const w = field(220, 5);
  const { camp } = settle(w, 60, 1, { STONE: 20, METAL: 20 });
  const hut = camp.hut, roof = hut.floor - 9;
  for (let u = hut.u0 - 2; u <= hut.u0 + 10; u++) for (let v = roof - 3; v >= roof - 6; v--) w.spawn(w.campCell(camp, u, v), ID.LEAVES);
  w.spawn(w.campCell(camp, hut.u0 + 4, roof - 7), ID.WOOD);
  camp.firstWar = 'heli';
  for (let f = 0; f < 2500 && !alive(w, camp.heli); f++) w.step();
  assert.ok(camp.pad?.roof, 'on the roof');
  assert.ok(alive(w, camp.heli), 'and a helicopter on it');
});

test('the anti-air gun shoots down a phoenix flying over the camp, and spares its own', () => {
  const w = field(220, 6);
  const { camp, people } = settle(w, 60, 2);
  const aa = built(w, camp, 'aa');
  for (const e of people) e.brain.weapon = 0; // (so only the gun shoots)
  w.spawn(15 * w.w + aa.px - 10, ID.PHOENIX);
  run(w, 20);
  const bird = w.creatures.find((c) => c.kind === ID.PHOENIX);
  assert.ok(bird, 'a phoenix');
  const hurt0 = health(people);
  let f = 0;
  for (; f < 3000 && alive(w, bird); f++) w.step();
  assert.ok(!alive(w, bird), `shot down (${aa.shots} shells, ${aa.ammo} left)`);
  assert.ok(aa.shots > 0 && aa.ammo === AA_CAP - aa.shots, 'a shell a gunpowder');
  assert.equal(health(people), hurt0, 'its own people unhurt');
});

test('it shoots through the leaves of a tree, not through rock', () => {
  const w = field(220, 13);
  const { camp, people: [e] } = settle(w, 60, 1);
  const aa = built(w, camp, 'aa');
  e.brain.weapon = 0;
  w.spawn(20 * w.w + aa.px + 30, ID.PHOENIX);
  run(w, 6);
  const bird = w.creatures.find((c) => c.kind === ID.PHOENIX);
  // A canopy of leaves across the line between them.
  const mx = (aa.px + bird.x) >> 1, my = (aa.py + bird.y) >> 1;
  fillRect(w, mx - 4, my - 4, mx + 4, my + 4, ID.LEAVES);
  assert.equal(w.aaTarget(camp, aa)?.o, bird, 'through the leaves');
  for (let y = my - 4; y <= my + 4; y++) for (let x = mx - 4; x <= mx + 4; x++) { w.clearCell(y * w.w + x); w.spawn(y * w.w + x, ID.STONE); }
  assert.equal(w.aaTarget(camp, aa), null, 'not through stone');
});

test('it never fires at what flies low over the camp, near its people, or out of range', () => {
  const w = field(300, 7);
  const { camp, people: [e] } = settle(w, 60, 1);
  const aa = built(w, camp, 'aa');
  const bird = (x, y) => {
    for (const o of w.creatures) if (o.kind === ID.BIRD) w.removeCreature(o);
    w.spawn(y * w.w + x, ID.BIRD);
    run(w, 4);
    return w.creatures.find((o) => o.kind === ID.BIRD);
  };
  const see = (o) => w.aaTarget(camp, aa)?.o === o;
  assert.ok(see(bird(aa.px + 15, aa.py - 25)), 'high and clear: a target');
  assert.ok(!see(bird(aa.px + 15, aa.py - 2)), 'as low as the gun: not');
  assert.ok(!see(bird(e.x + 2, e.y - 9)), 'just over its own people: not');
  assert.ok(!see(bird(Math.min(w.w - 3, aa.px + AA_R + 20), aa.py - 30)), 'out of range: not');
});

test('shells take time to fly, and burst at about the distance they were set for', () => {
  const w = field(220, 8);
  const { camp } = settle(w, 60, 1);
  const aa = built(w, camp, 'aa');
  w.flak.push({ x: aa.px + 0.5, y: aa.py - 2.5, vx: 0, vy: -SHELL_SPEED, fuse: 12, lx: aa.px, ly: aa.py });
  const y0 = aa.py - 2.5;
  w.step();
  assert.equal(w.flak.length, 1, 'still flying');
  assert.ok(Math.abs(w.flak[0].y - (y0 - SHELL_SPEED)) < 0.01, 'a step on');
  let f = 1;
  for (; f < 40 && w.flak.length > 0; f++) w.step();
  assert.equal(f, 12, 'it bursts when its fuse runs out');
  assert.ok(countOf(w, ID.SMOKE) > 0, 'a puff of smoke where it burst');
});

test('a raid: the helicopter waits for the missile, flies to the enemy, shoots at its people, and comes home', () => {
  const w = field(300, 1);
  const A = settle(w, 60, 2), B = settle(w, 220, 3);
  for (const e of A.people) e.brain.weapon = 0; // just the helicopter this time
  const heli = (built(w, A.camp, 'pad'), A.camp.heli);
  assert.ok(alive(w, heli) && heli.grow < 0, 'a helicopter on its pad');
  A.camp.raidAt = w.tick;
  const hurt0 = health(B.people);
  let nearest = Infinity, f = 0, out = false;
  for (; f < 6000; f++) {
    w.step();
    if (!alive(w, heli)) break;
    nearest = Math.min(nearest, Math.max(Math.abs(heli.x - B.camp.x), Math.abs(heli.y - B.camp.y)));
    if (heli.craft.state !== 'parked') out = true;
    if (out && heli.craft.state === 'parked') break;
  }
  assert.ok(out, 'it flew out');
  assert.ok(nearest <= 30, `over the enemy camp (${nearest})`);
  assert.ok(health(B.people) > hurt0, 'and shot at its people');
  if (alive(w, heli)) assert.equal(heli.craft.state, 'parked', `home again (${heli.craft.state} after ${f})`);
});

test("a missile flies at the enemy's hut and blows a crater in it", () => {
  const w = field(300, 2, 170); // (high enough for it to fly over and come straight down)
  const A = settle(w, 60, 1), B = settle(w, 220, 1);
  const ln = built(w, A.camp, 'launcher');
  const m = ln.missile;
  assert.ok(alive(w, m) && m.grow < 0, 'a missile in the tube');
  A.people[0].brain.weapon = 0;
  B.people[0].brain.weapon = 0; // (or it shoots the missile down: next test)
  A.camp.raidAt = w.tick;
  const hut = B.camp.hut;
  let f = 0;
  for (; f < 400 && alive(w, m); f++) w.step();
  assert.ok(!alive(w, m), 'it went off');
  assert.equal(ln.missile, null, 'the tube is empty for the next');
  let left = Infinity;
  for (let k = 0; k < 60; k++) { // (its humans set about mending it straight away)
    w.step();
    left = Math.min(left, hut.cells.filter((c) => w.builtAt(c)).length);
  }
  assert.ok(left < hut.cells.length - 3, `the hut smashed (${left} of ${hut.cells.length} left)`);
});

test('an anti-air gun goes for an incoming missile first, and bursts right by it set it off', () => {
  const w = field(300, 2, 170);
  const A = settle(w, 60, 1), B = settle(w, 220, 2);
  const m = built(w, A.camp, 'launcher').missile;
  const aa = built(w, B.camp, 'aa');
  A.people[0].brain.weapon = 0;
  for (const e of B.people) e.brain.weapon = 0; // (just the gun)
  w.spawn(30 * w.w + aa.px - 20, ID.PHOENIX); // something else to shoot at
  A.camp.raidAt = w.tick;
  let f = 0;
  for (; f < 400 && alive(w, m) && !(m.craft.state === 'flying' && m.craft.leg >= 2); f++) w.step();
  assert.ok(alive(w, m) && m.craft.leg >= 2, 'coming down on the camp');
  assert.equal(w.aaTarget(B.camp, aa)?.o, m, 'the missile first');
  for (let k = 0; k < 2 && alive(w, m); k++) w.flakBurst(m.x - 2 * m.gx, m.y - 2 * m.gy); // (right on it: it takes a few hits)
  w.step();
  assert.ok(!alive(w, m), 'set off');
});

test('a missile hit in its tube goes off there', () => {
  const w = field(220, 3);
  const { camp } = settle(w, 60, 1);
  const ln = built(w, camp, 'launcher');
  const m = ln.missile;
  w.blast(ln.mx, ln.my - 2, 8);
  run(w, 5);
  assert.ok(!alive(w, m));
  assert.equal(ln.missile, null);
});

test('raids send a quarter of the camp (rounded up): armed humans, never the engineer', () => {
  const w = field(300, 4);
  const A = settle(w, 60, 5), B = settle(w, 230, 1);
  A.camp.engineer = A.people[4].id;
  A.people[0].brain.weapon = 0; // unarmed: stays
  assert.ok(w.startRaid(A.camp));
  const party = A.people.filter((e) => e.brain.raid === B.camp);
  assert.equal(party.length, Math.ceil(5 / 4));
  assert.ok(!party.includes(A.people[4]) && !party.includes(A.people[0]));
  assert.deepEqual(A.camp.raid.party.sort(), party.map((e) => e.id).sort());
});

test("raiders march to the enemy's camp and fight, then come home, still of their own camp", () => {
  const w = field(300, 5);
  const A = settle(w, 60, 4), B = settle(w, 220, 2);
  A.camp.raidAt = w.tick;
  run(w, CHORES);
  const r = A.people.find((e) => e.brain.raid !== null);
  assert.ok(r, 'a raider');
  let nearest = Infinity, f = 0;
  for (; f < 5500 && A.camp.raid !== null; f++) {
    w.step();
    if (alive(w, r)) nearest = Math.min(nearest, Math.abs(r.x - B.camp.x));
  }
  assert.ok(nearest <= 60, `it got there (${nearest})`);
  assert.ok(health(B.people.filter((o) => alive(w, o))) > 0 || B.people.some((o) => !alive(w, o)) || !alive(w, r), 'and fought');
  assert.equal(A.camp.raid, null, 'the raid ended');
  if (alive(w, r)) {
    for (f = 0; f < 3000 && Math.abs(r.x - A.camp.x) > 20; f++) w.step();
    assert.ok(Math.abs(r.x - A.camp.x) <= 20, `home again (${r.brain.job} at ${r.x})`);
    assert.equal(r.brain.camp, A.camp, 'it never strayed');
  }
});

test('the raid clock starts with the first war machine: 5 to 10 minutes; with nobody to raid it waits', () => {
  const w = field(220, 6);
  const { camp } = settle(w, 60, 1);
  run(w, CHORES);
  assert.equal(camp.raidAt, 0, 'no war machine, no clock');
  built(w, camp, 'aa');
  const t = w.tick;
  run(w, CHORES);
  assert.ok(camp.raidAt >= t + RAID_MIN && camp.raidAt <= t + CHORES + RAID_MAX, `${camp.raidAt - t}`);
  camp.raidAt = w.tick;
  run(w, CHORES);
  assert.equal(camp.raid, null, 'no other camp: no raid');
  assert.ok(camp.raidAt > w.tick, 'it tries again later');
});

test('a camp with its hut up and its fire burning gains a human now and then, up to a cap', () => {
  const w = field(220, 7);
  const { camp } = settle(w, 60, 2);
  run(w, CHORES);
  assert.ok(camp.birthAt > w.tick && camp.birthAt <= w.tick + BIRTH_EVERY, 'counting');
  camp.birthAt = w.tick;
  run(w, CHORES + 60);
  assert.equal(camp.members.size, 3, 'born, and one of the camp');
  assert.ok(camp.birthAt > w.tick, 'and the next later');
  for (let k = camp.members.size; k < POP_CAP; k++) camp.members.add(10000 + k);
  camp.birthAt = w.tick;
  const n = w.creatures.length;
  run(w, CHORES + 60);
  assert.equal(w.creatures.length, n, 'no more past the cap');
});

test('a camp that does without a hut has its births by the fire', () => {
  const w = field(220, 16);
  const { camp } = settle(w, 60, 2);
  for (const c of camp.hut.cells) w.clearCell(c);
  camp.hut = null;
  camp.noHut = true;
  run(w, CHORES);
  camp.birthAt = w.tick;
  run(w, CHORES + 60);
  assert.equal(camp.members.size, 3);
});

test('a newborn joins the camp whose hut it was born in, not just the first one near', () => {
  const w = field(300, 17);
  const A = settle(w, 140, 1), B = settle(w, 80, 1);
  // A comes first in the list, and B's hut is within reach of A's fire.
  assert.equal(w.camps[0], A.camp);
  const hut = B.camp.hut, c = w.campCell(B.camp, hut.u0 + 4, hut.floor);
  assert.ok(Math.abs((c % w.w) - A.camp.x) <= 60, 'near A too');
  B.camp.birthAt = w.tick;
  run(w, CHORES + 60);
  assert.equal(B.camp.members.size, 2, 'born to B');
  assert.equal(A.camp.members.size, 1);
});

test('an engineer that loses its armour hands the war machines on', () => {
  const w = field(220, 18);
  const { camp, people: [a, b] } = settle(w, 60, 2, { STONE: 10 }); // (no metal anywhere: it can't make new armour)
  camp.engineer = a.id;
  a.brain.armour = 0;
  run(w, 200);
  assert.notEqual(camp.engineer, a.id);
});

test('a waiting missile with sand on its fins, or leaves over its tube, still gets out', () => {
  const w = field(300, 19, 170);
  const A = settle(w, 60, 1), B = settle(w, 220, 1);
  A.people[0].brain.weapon = 0;
  B.people[0].brain.weapon = 0;
  const ln = built(w, A.camp, 'launcher');
  const m = ln.missile;
  for (const k of [1, 3]) for (let v = 2; v <= 4; v++) w.spawn(w.campCell(A.camp, ln.u0 + k, ln.base - v), ID.SAND);
  fillRect(w, ln.u0 - 2, ln.my - 22, ln.u0 + 6, ln.my - 16, ID.LEAVES);
  A.camp.raidAt = w.tick;
  let left = 0;
  for (let f = 0; f < 600 && alive(w, m); f++) {
    w.step();
    if (m.craft.state === 'flying') left = Math.max(left, Math.abs(m.y - ln.my));
  }
  assert.ok(left > 30, `out of its tube and away (${left})`);
});

test('debris on the pad or in the tube is swept aside to build a helicopter or missile', () => {
  const w = field(220, 20);
  const { camp } = settle(w, 60, 1);
  const pad = w.warPlan(camp, 'pad');
  pad.cells.forEach((c) => w.putDown(c, ID.STONE));
  for (let u = -2; u <= 2; u++) w.spawn(w.campCell(camp, pad.u0 + 6 + u, pad.base - 1), ID.SAND);
  const k = { kind: 'heli', camp, state: 'parked', mend: true, homeX: pad.hx, homeY: pad.hy, homeFacing: pad.facing, goal: null, foe: null, reload: 0, quiet: 0, pace: 0, blocked: 0, downFor: 0 };
  assert.ok(w.buildCraft(ID.HELICOPTER, pad.hx, pad.hy, pad.facing, camp.gx, camp.gy, k), 'built over the sand');
});

test('the anti-air gun shoots at a helicopter attacking its people, but not near its own missile', () => {
  const w = field(300, 21);
  const A = settle(w, 60, 1), B = settle(w, 220, 1);
  built(w, A.camp, 'pad');
  const heli = A.camp.heli, e = B.people[0];
  // Where it attacks from: 10 over its target and 8 to the side. The gun
  // judges its own people's nearness where it aims (the middle of the
  // helicopter), not at its skids.
  const [x, y] = w.heliOffset(heli, e.x, e.y, -8, 10);
  assert.ok(w.nearOwn(B.camp, x, y), '(its skids are just near enough)');
  assert.ok(!w.nearOwn(B.camp, x - 2 * heli.gx, y - 2 * heli.gy), 'where it aims is clear: it fires');
  // Its own missile, waiting in its tube near where the burst would be.
  const ln = built(w, B.camp, 'launcher');
  assert.ok(w.nearOwn(B.camp, ln.mx, ln.my - 4), 'its missile counts as its own');
});

test('a damaged hut is mended', () => {
  const w = field(220, 8);
  const { camp, people } = settle(w, 60, 1, { STONE: 5 });
  people[0].brain.weapon = 0; // (no war machines to spend its stone on)
  w.clearCell(camp.hut.cells[0]);
  run(w, CHORES);
  assert.equal(camp.hut.done, false, 'noticed');
  for (let f = 0; f < 1500 && !camp.hut.done; f++) w.step();
  assert.ok(w.builtAt(camp.hut.cells[0]), `mended (${people[0].brain.job})`);
});

test('a hut whose ground is blown away is planned again; those sheltering in it carry on', () => {
  const w = field(220, 14);
  const { camp, people: [e] } = settle(w, 60, 1);
  e.brain.job = 'sheltering';
  e.brain.think = 50;
  const hut = camp.hut;
  for (let u = hut.u0; u < hut.u0 + 9; u++) for (let v = 1; v <= 4; v++) w.clearCell(w.campCell(camp, u, hut.floor + v));
  w.clearCell(hut.cells[0]);
  run(w, CHORES + 20); // (no throw)
  assert.notEqual(camp.hut, hut, 'a new hut planned (or none yet)');
  assert.notEqual(e.brain.job, 'sheltering');
});

test('a helicopter moves to its camp\'s new pad, and one set down away from its pad tries for home again', () => {
  const w = field(220, 15);
  const { camp } = settle(w, 60, 1);
  const pad = built(w, camp, 'pad');
  const heli = camp.heli, k = heli.craft;
  // Set down somewhere: after a while it tries for home, and gets there.
  for (let n = 0; n < 10; n++) w.heliMove(heli, 1, 1);
  k.state = 'down';
  let f = 0;
  for (; f < 3000 && k.state !== 'parked'; f++) w.step();
  assert.equal(k.state, 'parked', `home again (${heli.x},${heli.y})`);
  assert.deepEqual([heli.x, heli.y], [pad.hx, pad.hy]);
  // A new pad: the engineer's next look sends it there.
  camp.pad = { ...pad, hx: pad.hx + 1 };
  w.warStep(camp.heli, camp.heli.craft, camp, 'heli'); // (only reads the camp's pad and helicopter here)
  assert.equal(k.homeX, pad.hx + 1);
  assert.equal(k.state, 'home');
});

test('a parked helicopter is solid to humans planning their way', () => {
  const w = field(220, 9);
  const { camp, people: [e] } = settle(w, 60, 1);
  const pad = built(w, camp, 'pad');
  const heli = camp.heli;
  const c = heli.cells[heli.n >> 1];
  assert.ok(w.solidAt(c % w.w, (c / w.w) | 0));
  assert.ok(pad.roof);
  assert.ok(e);
});

test("its plating turns most bullets; a helicopter shot down comes down as scrap", () => {
  const w = field(220, 10);
  const { camp } = settle(w, 60, 1);
  built(w, camp, 'pad');
  const heli = camp.heli;
  for (let k = 0; k < 40; k++) {
    const p = [...heli.pix].findIndex((s) => s === BODY);
    w.pelletHits(heli, heli.cells[p]);
  }
  assert.ok(heli.lost > 0 && heli.lost < 15, `most turned (${heli.lost} of 40 got through)`);
  const metal = countOf(w, ID.METAL);
  for (let p = 0; p < heli.n; p++) if (heli.pix[p] === BODY) w.clearCell(heli.cells[p]);
  w.step();
  assert.ok(!alive(w, heli), 'down');
  assert.equal(camp.heli, null);
  assert.ok(countOf(w, ID.METAL) >= metal, 'scrap');
});

test("a leaf caught in its tail, or dust on it, doesn't pin a helicopter down", () => {
  const w = field(220, 12);
  const { camp } = settle(w, 60, 1);
  built(w, camp, 'pad');
  const heli = camp.heli, k = heli.craft;
  // Up and away from the pad, then buried: leaves (and a branch) in every
  // gap of its shape and all round it, and sand on its back.
  for (let n = 0; n < 12; n++) w.heliMove(heli, 0, 1);
  for (let v = -1; v <= 8; v++) {
    for (let u = -8; u <= 8; u++) {
      const [x, y] = w.heliOffset(heli, heli.x, heli.y, u, v);
      if (w.type[y * w.w + x] === 0) w.spawn(y * w.w + x, v === 8 ? ID.SAND : u === 0 ? ID.WOOD : ID.LEAVES);
    }
  }
  assert.ok(!w.moveBody(heli, heli.x + 1, heli.y, 0, heli.facing, heli.gx, heli.gy), 'boxed in');
  k.state = 'home';
  let f = 0;
  for (; f < 600 && k.state !== 'parked'; f++) w.step();
  assert.equal(k.state, 'parked', `back on its pad (${heli.x},${heli.y} for ${k.homeX},${k.homeY})`);
});

test('a helicopter has to come close to shoot', () => {
  assert.ok(HELI_GUN_R <= 25);
  assert.ok(HELI_METAL > 0 && MISSILE_POWDER > 0 && MISSILE_METAL > 0);
});

test('war machines are drawn: a rotor, a barrel, shells; and labelled in the AI view', () => {
  const w = field(220, 11);
  const { camp } = settle(w, 60, 1);
  built(w, camp, 'pad');
  const aa = built(w, camp, 'aa');
  w.flak.push({ x: 30.5, y: 20.5, vx: 2, vy: 0, fuse: 9, lx: 28.5, ly: 20.5 });
  const pixels = new Uint32Array(w.w * w.h);
  paintWar(w, pixels);
  const heli = camp.heli;
  const top = heli.y - DEFS[ID.HELICOPTER].shape.h;
  assert.ok(pixels[top * w.w + heli.x] !== 0, 'the rotor');
  assert.ok(pixels[aa.py * w.w + aa.px] !== 0, 'the barrel');
  assert.ok(pixels[20 * w.w + 30] !== 0, 'a shell');
  assert.match(craftPlan(w, heli).label, /^helicopter on its pad/);
  assert.match(campLabel(w, camp), /heli ✓ · AA 20/);
});
