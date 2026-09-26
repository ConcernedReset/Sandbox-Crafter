// Per-element flags packed into typed arrays for the simulation's hot loops.

import { DEFS, ID, NUM, State } from './elements.js';

const { GAS, ENERGY } = State;

export const COND = new Float32Array(NUM);
export const AIR_COOL = new Float32Array(NUM);
export const CONDUCTOR = new Uint8Array(NUM);
export const CLONEABLE = new Uint8Array(NUM);
// Light, electrons and protons fly straight through these.
export const GASLIKE = new Uint8Array(NUM);
// Strong, non-explosive solids that air can't pass through. An air block with
// an unbroken line of them across it is sealed, so a shell of stone or metal
// holds pressure until it tears.
export const AIRTIGHT = new Uint8Array(NUM);

for (const d of DEFS) {
  COND[d.id] = d.conduct;
  AIR_COOL[d.id] = d.id === 0 ? 0 : d.airCool;
  CONDUCTOR[d.id] = d.conductor ? 1 : 0;
  CLONEABLE[d.id] = d.id !== 0 && !d.projectile
    && ![ID.WALL, ID.CLONE, ID.VOID, ID.SPARK, ID.LIGHTNING].includes(d.id) ? 1 : 0;
  GASLIKE[d.id] = d.state === GAS || (d.state === ENERGY && !d.fixed) ? 1 : 0;
  AIRTIGHT[d.id] = d.strength >= 25 && d.explode === 0 ? 1 : 0;
}

const setOf = (keys) => {
  const a = new Uint8Array(NUM);
  for (const k of keys) a[ID[k]] = 1;
  return a;
};

// Living things: what viruses infect and lye dissolves.
export const ORGANIC = setOf([
  'PLANT', 'WOOD', 'FLOWER', 'FRUIT', 'SEED', 'GRASS', 'MOSS', 'FUNGUS', 'ALGAE',
]);

// Metals the Philosopher's Stone turns into gold.
export const TRANSMUTABLE = setOf([
  'METAL', 'LEAD', 'COPPER', 'MERCURY', 'SILVER', 'STEEL', 'RUST', 'ALUMINUM',
]);

// What a White Hole pours out.
export const SPEW = ['SAND', 'WATER', 'STONE', 'DIRT', 'STEAM', 'FIRE', 'PLASMA', 'METAL'].map((k) => ID[k]);
