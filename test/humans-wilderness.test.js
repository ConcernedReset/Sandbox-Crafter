// The whole chain in the Wilderness: fire, hut, pickaxe, tunnels lined
// with scaffolding to coal, salt and metal, gunpowder, a gun and armour
// (humans.js, tunnels.js). Slow, so one seed; over 12 seeds, 8 got there
// within 40,000 steps (HANDOFF).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { loadScene } from '../src/game/scenes.js';
import { makeWorld } from './helpers.js';

test('Wilderness humans go from a campfire to armour', () => {
  const w = makeWorld(400, 240, 2);
  loadScene(w, 'wilderness');
  const armoured = () => w.creatures.some((e) => e.brain?.armour > 0);
  let f = 0;
  for (; f < 14000 && !armoured(); f++) w.step();
  const people = w.creatures.filter((e) => e.brain);
  assert.ok(armoured(), `armour in ${f} steps: ${people.map((e) => `${e.brain.job} t${e.brain.tool}w${e.brain.weapon}`).join(', ')}`);
  assert.equal(people.length, 3, 'nobody died');
  assert.ok(w.type.some((t) => t === ID.SCAFFOLDING), 'tunnels lined with scaffolding');
});
