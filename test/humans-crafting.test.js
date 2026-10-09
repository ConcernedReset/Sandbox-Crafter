// Humans craft for themselves once their camp is settled: a pickaxe, then
// gunpowder, then a gun, then armour (humans.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { newBrain, CRAFT_FIRE_TIME, ARMOUR_HITS } from '../src/sim/humans.js';
import { makeWorld, fillRect } from './helpers.js';

// Fill a rectangle with t, whatever was there.
function put(w, x0, y0, x1, y1, t) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      w.clearCell(y * w.w + x);
      w.spawn(y * w.w + x, t);
    }
  }
}

test('the recipes take what they need, and only when it is there', () => {
  const w = makeWorld(10, 10);
  const b = newBrain();
  assert.equal(w.craft(b, 'pickaxe'), false);
  for (let k = 0; k < 4; k++) w.stow(b, ID.WOOD);
  assert.equal(w.craft(b, 'pickaxe'), true);
  assert.equal(b.tool, 1);
  assert.equal(w.has(b, ID.WOOD), 1);
  for (let k = 0; k < 5; k++) w.stow(b, ID.METAL);
  assert.equal(w.craft(b, 'gun'), true);
  assert.equal(b.weapon, 1);
  assert.equal(w.has(b, ID.WOOD), 0);
  for (let k = 0; k < 4; k++) w.stow(b, ID.METAL);
  for (let k = 0; k < 4; k++) w.stow(b, ID.COPPER);
  assert.equal(w.craft(b, 'armour'), true, 'any metals will do');
  assert.equal(b.armour, ARMOUR_HITS);
  assert.equal(w.holding(b, new Uint8Array(1000).fill(1)), 0);
});

test('no crafting until the hut is built and the fire has burned a while', () => {
  const w = makeWorld(60, 40, 1);
  const camp = w.makeCamp(30, 30);
  assert.equal(w.canCraft(camp), false);
  camp.hut = { done: true };
  camp.burned = CRAFT_FIRE_TIME - 1;
  assert.equal(w.canCraft(camp), false);
  camp.burned = CRAFT_FIRE_TIME;
  assert.equal(w.canCraft(camp), true);
});

// A world with everything: wood, stone for the hut, and coal, salt and metal
// buried under dirt.
function settled(seed) {
  const w = makeWorld(240, 90, seed);
  fillRect(w, 0, 80, 239, 89, ID.STONE);
  fillRect(w, 0, 50, 239, 79, ID.DIRT);
  fillRect(w, 30, 45, 41, 49, ID.WOOD);
  fillRect(w, 8, 40, 19, 49, ID.WOOD); // more, for lining tunnels
  fillRect(w, 210, 40, 225, 49, ID.WOOD);
  fillRect(w, 190, 41, 199, 49, ID.STONE);
  put(w, 60, 64, 75, 66, ID.COAL);
  put(w, 150, 62, 165, 64, ID.SALT);
  put(w, 170, 66, 185, 69, ID.METAL);
  for (const x of [110, 122]) w.spawn(40 * 240 + x, ID.HUMAN);
  return w;
}

for (const seed of [1, 2]) {
  test(`humans settle, then craft a pickaxe, gunpowder, a gun and armour (seed ${seed})`, () => {
    const w = settled(seed);
    let f = 0, done = false;
    const people = new Map();
    for (; f < 30000 && !done; f++) {
      w.step();
      for (const e of w.creatures) if (e.brain) people.set(e.id, e);
      done = [...people.values()].some((e) => e.brain.armour > 0);
    }
    const jobs = [...people.values()].map((e) => `${e.brain.job} [${[...e.brain.items].join(' ')}] t${e.brain.tool} w${e.brain.weapon}`);
    assert.ok(done, `armour made in ${f} steps: ${jobs.join(' | ')}`);
    assert.ok([...people.values()].every((e) => w.creatureById[e.id] === e), 'nobody died');
    const armed = [...people.values()].find((e) => e.brain.armour > 0);
    assert.equal(armed.brain.tool, 1);
    assert.equal(armed.brain.weapon, 1);
    assert.ok(w.has(armed.brain, ID.GUNPOWDER) > 0, 'with gunpowder');
  });
}
