// Every recipe in the recipe book must actually work in the simulation.
// For each rule we build a small lab setup, run it, and check that the
// output element shows up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFS, ID, NUM, RULES, REACT, State, STARTERS, COLLECTIBLE, ruleLabel,
} from '../src/sim/elements.js';
import { makeWorld, fillRect, wallBox, ageCreatures } from './helpers.js';
import { SHAPED } from '../src/sim/creatures.js';

const MAX_FRAMES = 4000;

const isGas = (t) => DEFS[t].state === State.GAS || DEFS[t].state === State.ENERGY;
const isParticle = (t) => DEFS[t].projectile;

// Lay out the inputs inside a sealed box and return a per-frame hook that
// applies whatever the recipe needs (heat, cold, pressure, fresh fire...).
// Recipes with a shaped creature (one several cells big, creatures.js): a
// few of them spaced out where they live, just above the other ingredient,
// a band along the floor (in the water, for swimmers) kept topped up (fruit
// rots), or, for a gas or a flame, puffs of it among them.
function creatureLab(rule, kind) {
  const w = makeWorld(60, 50, 1000 + rule.output);
  const box = wallBox(w, 5, 5, 54, 44);
  const c = DEFS[kind].critter;
  const other = rule.inputs.find((t) => t !== kind) ?? kind;
  const hooks = [];
  if (c.moves === 'swim') fillRect(w, box.x0, box.y0 + 10, box.x1, box.y1, ID.WATER);
  if (other !== kind && !c.home[other]) {
    if (isGas(other)) {
      hooks.push((f) => { if (f % 10 === 0) w.paint(30, box.y0 + 14, 4, other); });
    } else {
      const band = (f) => {
        if (f % 300 !== 0) return;
        for (let y = box.y1 - 2; y <= box.y1; y++) {
          for (let x = box.x0; x <= box.x1; x++) {
            const i = y * w.w + x;
            if (SHAPED[w.type[i]]) continue;
            w.clearCell(i);
            w.spawn(i, other);
          }
        }
      };
      band(0);
      hooks.push(band);
    }
  }
  const at = other !== kind && !c.home[other] && !isGas(other) ? box.y1 - 7 : box.y0 + 14;
  for (let k = 0; k < 6; k++) w.spawn(at * w.w + box.x0 + 4 + k * 7, kind);
  const le = DEFS[kind].lifeEnd; // what it leaves when it dies: age it
  if (rule.kind === 'time' && le && (rule.output === le.to || rule.output === le.alt)) hooks.push(() => ageCreatures(w, kind, 60));
  return { w, each: (f) => { for (const h of hooks) h(f); } };
}

// Scaffolding: a human with wood, sent tunnelling to coal under dirt.
function tunnelLab(rule) {
  const w = makeWorld(120, 70, 1000 + rule.output);
  fillRect(w, 0, 66, 119, 69, ID.STONE);
  fillRect(w, 0, 30, 119, 65, ID.DIRT);
  for (let y = 50; y <= 52; y++) for (let x = 70; x <= 76; x++) { w.clearCell(y * w.w + x); w.spawn(y * w.w + x, ID.COAL); }
  w.spawn(20 * w.w + 40, ID.HUMAN);
  return {
    w,
    each: () => {
      const e = w.creatures.find((c) => c.brain);
      if (!e || e.brain.tun !== null) return;
      if (e.brain.camp === null) e.brain.camp = w.joinOrMakeCamp(e);
      while (w.has(e.brain, ID.WOOD) < 10) w.stow(e.brain, ID.WOOD);
      if (e.brain.camp !== null) w.startMining(e, e.brain, e.brain.camp, 'coal', 5);
    },
  };
}

function setUp(rule) {
  if (rule.output === ID.SCAFFOLDING) return tunnelLab(rule);
  const shaped = rule.inputs.find((t) => SHAPED[t]);
  if (shaped !== undefined) return creatureLab(rule, shaped);
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
    case 'burn': {
      // Fuel in one half, fresh flames lit in the empty half next to it (or
      // sparks, for explosives a flame won't set off). Flames need air, so
      // the box is open on the side away from the fuel.
      fill(home(a), a);
      const edge = isGas(a) ? box.y1 + 1 : box.y0 - 1;
      for (let x = box.x0; x <= box.x1; x++) w.clearCell(edge * w.w + x);
      const lighter = DEFS[a].flammable > 0 ? ID.FIRE : ID.SPARK;
      hooks.push((f) => {
        if (f % 15 === 0) w.paint(midX, isGas(a) ? midY + 2 : midY - 1, 3, lighter);
      });
      break;
    }
    case 'time':
      if (a === ID.PLANT) {
        // Plant growing thick: a seed of plant at the bottom of a pool.
        fillRect(w, midX - 1, box.y1 - 1, midX + 1, box.y1, a);
        fillRect(w, box.x0, box.y0 + 10, box.x1, box.y1, ID.WATER);
      } else if (a === ID.SAPLING) {
        // A tree growing: a sapling on a dirt floor.
        fillRect(w, box.x0, box.y1 - 2, box.x1, box.y1, ID.DIRT);
        w.spawn((box.y1 - 3) * w.w + midX, a);
      } else if (isParticle(a)) {
        // Particles left hanging in place until they decay.
        for (let k = 0; k < 40; k++) w.spawnProjectile(a, midX + (k % 8), midY + (k >> 3), 0, 0);
      } else {
        fill(home(a), a);
      }
      // Creatures live longer than a recipe test runs: age them, for what
      // they leave when they die.
      if (DEFS[a].critter && DEFS[a].lifeEnd && (rule.output === DEFS[a].lifeEnd.to || rule.output === DEFS[a].lifeEnd.alt)) {
        hooks.push(() => ageCreatures(w, a, 60));
      }
      break;
    case 'decay':
      // Radioactive elements stay put until disturbed: squeeze them.
      fill(home(a), a);
      hooks.push(() => w.pressurize(midX, midY, 30, 2));
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
  'GREY_GOO+LIGHTNING': (w, box) => {
    fillRect(w, box.x0, box.y1 - 5, box.x1, box.y1, ID.GREY_GOO);
    w.spawn(box.y0 * w.w + 25, ID.LIGHTNING);
  },
  'PLASMA+GLASS': (w, box) => {
    fillRect(w, box.x0, box.y1 - 8, box.x1, box.y1, ID.GLASS);
    return (f) => { if (f % 10 === 0) w.paint(25, box.y1 - 10, 4, ID.PLASMA); };
  },
  'HELIUM+PLASMA': (w, box) => {
    fillRect(w, box.x0, box.y0, box.x1, box.y0 + 10, ID.HELIUM);
    return (f) => { if (f % 10 === 0) w.paint(25, box.y0 + 14, 4, ID.PLASMA); };
  },
  'CLAY+LIGHTNING': (w, box) => {
    fillRect(w, box.x0, box.y1 - 5, box.x1, box.y1, ID.CLAY);
    w.spawn(box.y0 * w.w + 25, ID.LIGHTNING);
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
