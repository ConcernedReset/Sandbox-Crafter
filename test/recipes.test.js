// Every recipe in the recipe book must actually work in the simulation.
// For each rule we build a small lab setup, run it, and check that the
// output element shows up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFS, ID, NUM, RULES, REACT, State, STARTERS, COLLECTIBLE, ruleLabel,
} from '../src/sim/elements.js';
import { makeWorld, fillRect, wallBox } from './helpers.js';

const MAX_FRAMES = 4000;

const isGas = (t) => DEFS[t].state === State.GAS || DEFS[t].state === State.ENERGY;
const isParticle = (t) => DEFS[t].projectile;

// Lay out the inputs inside a sealed box and return a per-frame hook that
// applies whatever the recipe needs (heat, cold, pressure, fresh fire...).
function setUp(rule) {
  const w = makeWorld(60, 50, 1000 + rule.output);
  const box = wallBox(w, 5, 5, 54, 44);
  const [a, b] = rule.inputs;
  const midY = (box.y0 + box.y1) >> 1;
  const midX = (box.x0 + box.x1) >> 1;
  const top = { x0: box.x0, y0: box.y0, x1: box.x1, y1: midY - 1 };
  const bottom = { x0: box.x0, y0: midY, x1: box.x1, y1: box.y1 };
  const fill = (r, t) => fillRect(w, r.x0, r.y0, r.x1, r.y1, t);
  const everyCell = (fn) => {
    for (let y = box.y0; y <= box.y1; y++) {
      for (let x = box.x0; x <= box.x1; x++) fn(y * w.w + x);
    }
  };
  // Particles are sprayed in from the middle of a region each frame.
  const spray = (r, t) => w.paint((r.x0 + r.x1) >> 1, (r.y0 + r.y1) >> 1, 8, t, 1);
  // Gases go in the top half, everything else in the bottom half.
  const home = (t) => (isGas(t) ? top : bottom);
  const away = (t) => (isGas(t) ? bottom : top);
  const hooks = [];

  switch (rule.kind) {
    case 'heat':
    case 'cool': {
      const amount = rule.kind === 'heat' ? 30 : -30;
      fill(home(a), a);
      hooks.push(() => everyCell((i) => {
        if (w.type[i] && w.type[i] !== ID.WALL) w.temp[i] = Math.max(-273, w.temp[i] + amount);
      }));
      break;
    }
    case 'pressure':
      fill(home(a), a);
      hooks.push(() => w.pressurize(midX, midY, 30, 2));
      break;
    case 'burn':
      // Fuel in one half, fresh flames lit in the empty half next to it.
      fill(home(a), a);
      hooks.push((f) => {
        if (f % 15 === 0) w.paint(midX, isGas(a) ? midY + 2 : midY - 1, 3, ID.FIRE);
      });
      break;
    case 'time':
      if (a === ID.PLANT) {
        // Plant growing thick: a seed of plant at the bottom of a pool.
        fillRect(w, midX - 1, box.y1 - 1, midX + 1, box.y1, a);
        fillRect(w, box.x0, box.y0 + 10, box.x1, box.y1, ID.WATER);
      } else if (isParticle(a)) {
        // Particles left hanging in place until they decay.
        for (let k = 0; k < 40; k++) w.spawnProjectile(a, midX + (k % 8), midY + (k >> 3), 0, 0);
      } else {
        fill(home(a), a);
      }
      break;
    case 'contact': {
      const special = CONTACT_SETUPS[`${DEFS[a].key}+${DEFS[b].key}`];
      if (special) {
        const hook = special(w, box);
        if (hook) hooks.push(hook);
        break;
      }
      if (isParticle(a) && isParticle(b)) {
        hooks.push(() => { spray(box, a); spray(box, b); });
        break;
      }
      if (isParticle(a) || isParticle(b)) {
        const target = isParticle(a) ? b : a, shot = isParticle(a) ? a : b;
        fill(home(target), target);
        hooks.push(() => spray(away(target), shot));
        break;
      }
      if (a === ID.SPARK || b === ID.SPARK) {
        const other = a === ID.SPARK ? b : a;
        const r = home(other);
        fill(r, other);
        const bandY = isGas(other) ? r.y1 + 2 : r.y0 - 2;
        hooks.push((f) => { if (f % 3 === 0) w.paint(midX, bandY, 6, ID.SPARK, 0.5); });
        break;
      }
      // Heavier / non-gas input on the bottom, the other on top.
      let lower = a, upper = b;
      if (isGas(a) && !isGas(b)) { lower = b; upper = a; }
      else if (!isGas(a) && !isGas(b) && DEFS[b].density > DEFS[a].density) { lower = b; upper = a; }
      fill(bottom, lower);
      fill(top, upper);
      // Reactions that need heat: keep the first ingredient hot.
      const r = REACT[a * NUM + b];
      if (r && r.minTemp > -Infinity) {
        const hot = Math.min(r.minTemp + 100, 3100);
        hooks.push(() => everyCell((i) => { if (w.type[i] === a) w.temp[i] = hot; }));
      }
      break;
    }
    default:
      throw new Error(`No setup for rule kind ${rule.kind}`);
  }
  return { w, each: (f) => { for (const h of hooks) h(f); } };
}

// Recipes involving short-lived things (plasma, lightning) or solids that
// must sit side by side need a hand-built setup.
const CONTACT_SETUPS = {
  'SAND+LIGHTNING': (w, box) => {
    fillRect(w, box.x0, box.y1 - 5, box.x1, box.y1, ID.SAND);
    w.spawn(box.y0 * w.w + 25, ID.LIGHTNING);
  },
  'METAL+LIGHTNING': (w, box) => {
    fillRect(w, box.x0, box.y1 - 5, box.x1, box.y1, ID.METAL);
    w.spawn(box.y0 * w.w + 25, ID.LIGHTNING);
  },
  'DIAMOND+PLASMA': (w, box) => {
    fillRect(w, box.x0, box.y1 - 8, box.x1, box.y1, ID.DIAMOND);
    return (f) => { if (f % 10 === 0) w.paint(25, box.y1 - 10, 4, ID.PLASMA); };
  },
  'METAL+PLASMA': (w, box) => {
    fillRect(w, box.x0, box.y1 - 8, box.x1, box.y1, ID.METAL);
    return (f) => { if (f % 10 === 0) w.paint(25, box.y1 - 10, 4, ID.PLASMA); };
  },
  'PLASMA+GLASS': (w, box) => {
    fillRect(w, box.x0, box.y1 - 8, box.x1, box.y1, ID.GLASS);
    return (f) => { if (f % 10 === 0) w.paint(25, box.y1 - 10, 4, ID.PLASMA); };
  },
  'HELIUM+PLASMA': (w, box) => {
    fillRect(w, box.x0, box.y0, box.x1, box.y0 + 10, ID.HELIUM);
    return (f) => { if (f % 10 === 0) w.paint(25, box.y0 + 14, 4, ID.PLASMA); };
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
  'POLONIUM+BERYLLIUM': (w, box) => {
    fillRect(w, box.x0, box.y1 - 6, box.x1, box.y1, ID.BERYLLIUM);
    fillRect(w, box.x0, box.y1 - 10, box.x1, box.y1 - 7, ID.POLONIUM);
  },
  'STAR+HYDROGEN': (w, box) => {
    fillRect(w, 25, box.y1 - 4, 30, box.y1, ID.STAR);
    return (f) => { if (f % 10 === 0) w.paint(27, box.y1 - 8, 4, ID.HYDROGEN); };
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

test('every discoverable element has a hint, a description and a unique symbol', () => {
  const symbols = new Set();
  for (const d of COLLECTIBLE) {
    assert.ok(d.desc, `${d.name} has a description`);
    if (!d.start) assert.ok(d.hint, `${d.name} has a hint`);
    assert.ok(!symbols.has(d.sym), `${d.name}'s symbol ${d.sym} is unique`);
    symbols.add(d.sym);
  }
});
