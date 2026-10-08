// Humans carry an inventory: up to 10 of each element, a tool, a weapon and
// armour (humans.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { STACK, inventoryNote, newBrain } from '../src/sim/humans.js';
import { makeWorld, fillRect, run, countOf } from './helpers.js';

test('a human holds up to 10 of each element', () => {
  const w = makeWorld(10, 10);
  const b = newBrain();
  for (let k = 0; k < 12; k++) w.stow(b, ID.WOOD);
  assert.equal(w.has(b, ID.WOOD), STACK);
  assert.equal(w.stow(b, ID.WOOD), false);
  assert.equal(w.stow(b, ID.STONE), true);
  assert.equal(w.takeAny(b, new Uint8Array(1000).fill(1)), ID.WOOD, 'the one it has most of');
  assert.equal(w.has(b, ID.WOOD), 9);
});

test('coal and salt in the inventory make gunpowder', () => {
  const w = makeWorld(10, 10);
  const b = newBrain();
  for (let k = 0; k < 5; k++) w.stow(b, ID.COAL);
  for (let k = 0; k < 3; k++) w.stow(b, ID.SALT);
  assert.equal(w.has(b, ID.GUNPOWDER), 6);
  assert.equal(w.has(b, ID.COAL), 2);
  assert.equal(w.has(b, ID.SALT), 0);
  for (let k = 0; k < 4; k++) w.stow(b, ID.SALT);
  assert.equal(w.has(b, ID.GUNPOWDER), 10, 'up to a full stack');
  assert.equal(w.has(b, ID.SALT), 2, 'the rest kept');
});

test('a gatherer brings several pieces of wood in one trip', () => {
  const w = makeWorld(160, 60, 2);
  fillRect(w, 0, 55, 159, 59, ID.STONE);
  fillRect(w, 30, 50, 39, 54, ID.WOOD);
  w.spawn(45 * 160 + 80, ID.HUMAN);
  let most = 0;
  for (let f = 0; f < 4000 && !w.camps[0]?.lit; f++) {
    w.step();
    const e = w.creatures[0];
    if (e?.brain) most = Math.max(most, e.brain.items.get(ID.WOOD) ?? 0);
  }
  assert.ok(w.camps[0]?.lit, 'lit');
  assert.ok(most >= 6, `carried ${most} at once`);
});

test('a dead human drops what it carried', () => {
  const w = makeWorld(60, 40, 1);
  fillRect(w, 0, 35, 59, 39, ID.STONE);
  w.spawn(25 * 60 + 30, ID.HUMAN);
  run(w, 60);
  const e = w.creatures[0];
  for (let k = 0; k < 7; k++) w.stow(e.brain, ID.WOOD);
  const before = countOf(w, ID.WOOD);
  w.creatureDies(e);
  assert.equal(countOf(w, ID.WOOD), before + 7);
});

test('the inspect line lists the inventory', () => {
  const w = makeWorld(10, 10);
  const b = newBrain();
  w.stow(b, ID.WOOD);
  w.stow(b, ID.WOOD);
  b.tool = 1;
  assert.equal(inventoryNote(b), 'wood 2; pickaxe');
});
