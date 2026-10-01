// Per-element flags packed into typed arrays for the simulation's hot loops.

import { DEFS, ID, NUM, State } from './elements.js';

const { SOLID, GAS, ENERGY } = State;

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
// Machines (see machines.js): every machine and control, the ones that run on
// power, the ones you press with a spark, and the ones that sense light.
export const MACHINE = new Uint8Array(NUM);
export const POWERED = new Uint8Array(NUM);
export const PRESSABLE = new Uint8Array(NUM);
export const LIGHT_SENSOR = new Uint8Array(NUM);
// Clear solids: metal with one of these in front of it is a perfect mirror.
export const MIRROR_BACKING = new Uint8Array(NUM);

for (const d of DEFS) {
  COND[d.id] = d.conduct;
  AIR_COOL[d.id] = d.id === 0 ? 0 : d.airCool;
  CONDUCTOR[d.id] = d.conductor ? 1 : 0;
  CLONEABLE[d.id] = d.id !== 0 && !d.projectile
    && ![ID.WALL, ID.CLONE, ID.VOID, ID.SPARK, ID.LIGHTNING].includes(d.id) ? 1 : 0;
  GASLIKE[d.id] = d.state === GAS || (d.state === ENERGY && !d.fixed) ? 1 : 0;
  AIRTIGHT[d.id] = d.strength >= 25 && d.explode === 0 ? 1 : 0;
  const m = d.machine;
  MACHINE[d.id] = m ? 1 : 0;
  POWERED[d.id] = ['door', 'lamp', 'laser', 'heater', 'cooler', 'fan', 'dispenser', 'drain'].includes(m) ? 1 : 0;
  PRESSABLE[d.id] = m === 'switch' || m === 'button' ? 1 : 0;
  LIGHT_SENSOR[d.id] = m === 'photocell' ? 1 : 0;
  MIRROR_BACKING[d.id] = d.transparent && d.state === SOLID ? 1 : 0;
}

// How fast light travels through each element, as a share of its speed in
// air (1 over the refractive index): clear liquids about 3/4, clear solids
// about 2/3, diamond much slower. Everything else leaves it at full speed.
export const LIGHT_SPEED = new Float32Array(NUM).fill(1);
for (const d of DEFS) {
  if (!d.transparent) continue;
  if (d.state === State.LIQUID) LIGHT_SPEED[d.id] = 0.75;
  else if (d.state === SOLID || d.state === State.POWDER) LIGHT_SPEED[d.id] = 0.67;
}
LIGHT_SPEED[ID.DIAMOND] = 0.41;

// Which of an element's phase changes air pressure moves (see air.js):
// boiling and condensing (to or from a gas), melting and freezing (solid
// to liquid and back). Chemical changes and anything to or from energy
// don't move.
export const PHASE_BOIL = 1;
export const PHASE_MELT = 2;
function phaseKind(from, to) {
  const { POWDER, LIQUID } = State;
  const solidish = (s) => s === SOLID || s === POWDER;
  if ((solidish(from) || from === LIQUID) && to === GAS) return PHASE_BOIL;
  if (from === GAS && (solidish(to) || to === LIQUID)) return PHASE_BOIL;
  if ((solidish(from) && to === LIQUID) || (from === LIQUID && solidish(to))) return PHASE_MELT;
  return 0;
}
export const HIGH_PHASE = new Uint8Array(NUM);
export const LOW_PHASE = new Uint8Array(NUM);
for (const d of DEFS) {
  if (d.high) HIGH_PHASE[d.id] = phaseKind(d.state, DEFS[d.high.to].state);
  if (d.low) LOW_PHASE[d.id] = d.low.restore ? PHASE_MELT : phaseKind(d.state, DEFS[d.low.to].state);
}

// Mass for Newtonian gravity: an element's density, except that walls,
// energy and flying particles weigh nothing, a few cosmic objects weigh a
// great deal, and a White Hole pushes instead of pulling.
export const MASS = new Float32Array(NUM);
for (const d of DEFS) {
  MASS[d.id] = d.id === 0 || d.id === ID.WALL || d.state === ENERGY || d.projectile ? 0 : d.density;
}
MASS[ID.BLACK_HOLE] = 2000;
MASS[ID.PULSAR] = 1000;
MASS[ID.STAR] = 200;
MASS[ID.DARK_MATTER] = 50; // invisible, but it weighs something
MASS[ID.WHITE_HOLE] = -500;

// What a dispenser remembers and pours out: anything a clone would copy,
// except solid blocks (creatures aside), wires and other machines.
export const DISPENSABLE = new Uint8Array(NUM);
for (const d of DEFS) {
  DISPENSABLE[d.id] = CLONEABLE[d.id] && !CONDUCTOR[d.id] && !MACHINE[d.id]
    && (d.state !== SOLID || d.behavior === 'critter') ? 1 : 0;
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
