// Every recipe in the recipe book must actually work in the simulation.
// For each rule we build a small lab setup, run it, and check that the
// output element shows up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFS, ID, RULES, State, STARTERS, COLLECTIBLE, ruleLabel } from '../src/sim/elements.js';
import { makeWorld, fillRect, wallBox } from './helpers.js';

const MAX_FRAMES = 4000;

function isGas(t) {
  return DEFS[t].state === State.GAS || DEFS[t].state === State.ENERGY;
}

// Lay out the inputs inside a sealed box and return a per-frame hook that
// applies whatever the recipe needs (heat, cold, pressure, fresh fire...).
function setUp(rule) {
  const w = makeWorld(60, 50, 1000 + rule.output);
  const box = wallBox(w, 5, 5, 54, 44);
  const [a, b] = rule.inputs;
  const midY = (box.y0 + box.y1) >> 1;
  const midX = (box.x0 + box.x1) >> 1;
  const everyCell = (fn) => {
    for (let y = box.y0; y <= box.y1; y++) {
      for (let x = box.x0; x <= box.x1; x++) fn(y * w.w + x);
    }
  };
  let each = () => {};

  switch (rule.kind) {
    case 'heat':
    case 'cool': {
      const amount = rule.kind === 'heat' ? 30 : -30;
      // Gases fill the top half so rain or condensation has somewhere to fall.
      if (isGas(a)) fillRect(w, box.x0, box.y0, box.x1, midY, a);
      else fillRect(w, box.x0, midY, box.x1, box.y1, a);
      each = () => everyCell((i) => {
        if (w.type[i] && w.type[i] !== ID.WALL) w.temp[i] = Math.max(-273, w.temp[i] + amount);
      });
      break;
    }
    case 'pressure':
      fillRect(w, box.x0, midY, box.x1, box.y1, a);
      each = () => w.pressurize(midX, midY, 30, 2);
      break;
    case 'burn':
      // Fuel in one half, fresh flames lit in the empty half next to it.
      if (isGas(a)) {
        fillRect(w, box.x0, box.y0, box.x1, midY, a);
        each = (f) => { if (f % 15 === 0) w.paint(midX, midY + 2, 3, ID.FIRE); };
      } else {
        fillRect(w, box.x0, midY, box.x1, box.y1, a);
        each = (f) => { if (f % 15 === 0) w.paint(midX, midY - 1, 3, ID.FIRE); };
      }
      break;
    case 'time':
      // Plant growing thick: a seed of plant at the bottom of a pool.
      fillRect(w, midX - 1, box.y1 - 1, midX + 1, box.y1, a);
      fillRect(w, box.x0, box.y0 + 10, box.x1, box.y1, ID.WATER);
      break;
    case 'contact': {
      const special = CONTACT_SETUPS[`${DEFS[a].key}+${DEFS[b].key}`];
      if (special) {
        each = special(w, box) || each;
        break;
      }
      // Heavier / non-gas input on the bottom, the other on top.
      let bottom = a, top = b;
      if (isGas(a) && !isGas(b)) { bottom = b; top = a; }
      else if (!isGas(a) && !isGas(b) && DEFS[b].density > DEFS[a].density) { bottom = b; top = a; }
      fillRect(w, box.x0, midY, box.x1, box.y1, bottom);
      fillRect(w, box.x0, box.y0, box.x1, midY - 1, top);
      break;
    }
    default:
      throw new Error(`No setup for rule kind ${rule.kind}`);
  }
  return { w, each };
}

// Recipes involving short-lived things (sparks, plasma, lightning) or
// solids that must sit side by side need a hand-built setup.
const CONTACT_SETUPS = {
  'WATER+SPARK': (w, box) => {
    fillRect(w, box.x0, box.y1 - 10, box.x1, box.y1, ID.WATER);
    return (f) => { if (f % 5 === 0) w.paint(25, box.y1 - 12, 3, ID.SPARK); };
  },
  'CLOUD+SPARK': (w, box) => {
    fillRect(w, box.x0, box.y0, box.x1, box.y0 + 12, ID.CLOUD);
    return (f) => { if (f % 5 === 0) w.paint(25, box.y0 + 15, 3, ID.SPARK); };
  },
  'SAND+LIGHTNING': (w, box) => {
    fillRect(w, box.x0, box.y1 - 5, box.x1, box.y1, ID.SAND);
    w.spawn(box.y0 * w.w + 25, ID.LIGHTNING);
  },
  'DIAMOND+PLASMA': (w, box) => {
    fillRect(w, box.x0, box.y1 - 8, box.x1, box.y1, ID.DIAMOND);
    return (f) => { if (f % 10 === 0) w.paint(25, box.y1 - 10, 4, ID.PLASMA); };
  },
  'BATTERY+METAL': (w, box) => {
    w.spawn(box.y1 * w.w + 20, ID.BATTERY);
    fillRect(w, 21, box.y1, 40, box.y1, ID.METAL);
  },
  'LAVA+COAL': (w, box) => {
    fillRect(w, box.x0, box.y1 - 6, box.x1, box.y1, ID.COAL);
    fillRect(w, box.x0, box.y1 - 12, box.x1, box.y1 - 7, ID.LAVA);
  },
  'FIRE+WATER': (w, box) => {
    fillRect(w, box.x0, box.y1 - 6, box.x1, box.y1, ID.WATER);
    return (f) => { if (f % 5 === 0) w.paint(25, box.y1 - 7, 3, ID.FIRE); };
  },
};

for (let r = 0; r < RULES.length; r++) {
  const rule = RULES[r];
  const name = `${ruleLabel(rule)} -> ${DEFS[rule.output].name}`;
  test(name, () => {
    const { w, each } = setUp(rule);
    let frames = 0;
    while (!w.seen[rule.output] && frames < MAX_FRAMES) {
      each(frames);
      w.step();
      frames++;
    }
    assert.ok(w.seen[rule.output], `${name} never happened in ${MAX_FRAMES} frames`);
    const made = w.discoveries.find((d) => d.id === rule.output);
    assert.ok(made, 'the discovery was reported');
  });
}

test('every element can be discovered from the starting four', () => {
  const known = new Set(STARTERS.map((k) => ID[k]));
  let grew = true;
  while (grew) {
    grew = false;
    for (const rule of RULES) {
      if (!known.has(rule.output) && rule.inputs.every((i) => known.has(i))) {
        known.add(rule.output);
        grew = true;
      }
    }
  }
  const missing = COLLECTIBLE.filter((d) => !known.has(d.id)).map((d) => d.name);
  assert.deepEqual(missing, []);
});

test('every discoverable element has a hint and a description', () => {
  for (const d of COLLECTIBLE) {
    assert.ok(d.desc, `${d.name} has a description`);
    if (!d.start) assert.ok(d.hint, `${d.name} has a hint`);
  }
});
