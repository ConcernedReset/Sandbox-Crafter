// Humans with guns: a shot is 4 pellets for 1 gunpowder; they shoot
// threats, hunt, fight rival camps, and armour takes some of the hits
// (humans.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { PELLETS, ARMOUR_HITS } from '../src/sim/humans.js';
import { BODY } from '../src/sim/creatures.js';
import { makeWorld, fillRect, run, countOf } from './helpers.js';

// Humans grown at the given x on a flat stone floor, left to right.
function people(w, xs) {
  fillRect(w, 0, w.h - 5, w.w - 1, w.h - 1, ID.STONE);
  for (const x of xs) w.spawn(10 * w.w + x, ID.HUMAN);
  run(w, 40);
  return w.creatures.filter((e) => e.kind === ID.HUMAN).sort((a, b) => a.x - b.x);
}
function arm(w, e, powder = 10) {
  e.brain.weapon = 1;
  for (let k = 0; k < powder; k++) w.stow(e.brain, ID.GUNPOWDER);
}

test('a shot is 4 pellets for 1 gunpowder, and none without gunpowder', () => {
  const w = makeWorld(120, 40, 1);
  const [e] = people(w, [30]);
  arm(w, e, 3);
  w.shoot(e, e.brain, e.x + 2, e.y - 4, e.x + 40, e.y - 4);
  assert.equal(w.shots.length, PELLETS);
  assert.equal(w.has(e.brain, ID.GUNPOWDER), 2);
  e.brain.items.clear();
  assert.equal(w.armed(e.brain), false, 'no gunpowder, no shooting');
  w.shoot(e, e.brain, e.x + 2, e.y - 4, e.x + 40, e.y - 4);
  assert.equal(w.shots.length, PELLETS, 'no more pellets');
});

test('a pellet takes out the pixel it hits, and stops at a wall', () => {
  const w = makeWorld(120, 40, 1);
  const [a, b] = people(w, [30, 70]);
  w.pellet(a, a.x + 2, b.y - 4, 1, 0);
  assert.equal(b.lost, 1);
  fillRect(w, (a.x + b.x) >> 1, 5, ((a.x + b.x) >> 1) + 1, w.h - 6, ID.STONE);
  w.pellet(a, a.x + 2, b.y - 4, 1, 0);
  assert.equal(b.lost, 1, 'the wall stopped it');
});

test('armour takes about half the hits, and breaks after 10', () => {
  const w = makeWorld(120, 40, 4);
  const [, b] = people(w, [30, 70]);
  b.brain.armour = ARMOUR_HITS;
  let absorbed = 0, hits = 0;
  while (b.brain.armour > 0 && hits < 100) {
    const before = b.brain.armour;
    const p = [...b.pix].findIndex((s) => s === BODY);
    w.pelletHits(b, b.cells[p]);
    hits++;
    if (b.brain.armour < before) absorbed++;
    else w.healPixel(b);
  }
  assert.equal(absorbed, ARMOUR_HITS);
  assert.equal(b.brain.armour, 0, 'broken');
  assert.ok(hits > 12 && hits < 40, `about half absorbed (${hits} hits)`);
});

test('a blast is partly absorbed by armour', () => {
  const w = makeWorld(120, 40, 2);
  const [, b] = people(w, [30, 70]);
  b.brain.armour = ARMOUR_HITS;
  w.blastCreatures(b.x, b.y - 3, 40, 10);
  assert.ok(b.brain.armour < ARMOUR_HITS, 'the armour took some');
});

test('an armed human shoots a phoenix near its camp', () => {
  const w = makeWorld(160, 60, 2);
  const [e] = people(w, [40]);
  arm(w, e);
  w.spawn(30 * 160 + 75, ID.PHOENIX);
  run(w, 20);
  assert.ok(w.creatures.some((c) => c.kind === ID.PHOENIX), 'hatched');
  let f = 0;
  for (; f < 3000 && w.creatures.some((c) => c.kind === ID.PHOENIX); f++) w.step();
  assert.ok(!w.creatures.some((c) => c.kind === ID.PHOENIX), `the phoenix is down (${f} steps)`);
  assert.ok(w.has(e.brain, ID.GUNPOWDER) < 10, 'it used gunpowder');
});

test('a hunter resting by its fire shoots an animal, which leaves meat', () => {
  const w = makeWorld(160, 60, 3);
  const [e] = people(w, [40]);
  arm(w, e);
  const camp = w.joinOrMakeCamp(e);
  e.brain.camp = camp;
  camp.lit = true;
  w.spawn(50 * 160 + 70, ID.FROG);
  run(w, 20);
  assert.ok(w.creatures.some((c) => c.kind === ID.FROG), 'hatched');
  const meat = countOf(w, ID.MEAT);
  for (let f = 0; f < 3000 && w.creatures.some((c) => c.kind === ID.FROG); f++) w.step();
  assert.ok(!w.creatures.some((c) => c.kind === ID.FROG), 'the frog was shot');
  assert.ok(countOf(w, ID.MEAT) > meat, 'meat left');
});

test('an unarmed human flees an armed rival, who shoots at it', () => {
  const w = makeWorld(240, 60, 5);
  const [a, b] = people(w, [40, 75]);
  a.brain.camp = w.makeCamp(a.x - 4, a.y);
  b.brain.camp = w.makeCamp(b.x + 80, b.y); // a different camp
  arm(w, a);
  let fled = false;
  for (let f = 0; f < 1500; f++) {
    w.step();
    if (w.creatureById[b.id] === b && b.brain.job === 'fleeing') fled = true;
  }
  assert.ok(fled, 'it ran');
  assert.ok(w.has(a.brain, ID.GUNPOWDER) < 10, 'shots were fired');
});

test('humans of one camp never shoot each other, nor through each other', () => {
  const w = makeWorld(160, 60, 6);
  const [a, b] = people(w, [40, 60]);
  const camp = w.makeCamp(50, a.y);
  a.brain.camp = camp;
  b.brain.camp = camp;
  assert.equal(w.rival(a.brain, b.brain), false);
  // A line through b's body finds b first, so a holds its fire.
  assert.equal(w.lineFirst(a, a.x + 2, b.y - 4, b.x + 30, b.y - 4), b);
  arm(w, a);
  run(w, 1000);
  assert.equal(b.lost, 0, 'b is unhurt');
  assert.equal(w.has(a.brain, ID.GUNPOWDER), 10, 'no shots');
});
