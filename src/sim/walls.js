// The wall layer: where walls stand, and what each lets through (the Wall
// tool's checklist). World.wall holds, per cell, 0 for no wall, or
// WALL_HERE plus a PASS bit for each kind of thing that may pass. A wall
// cell's type is WALL when nothing is passing through it; something passing
// through sits in the cell, with the wall layer still set underneath, the
// way a spark sits on a wire.

import { DEFS, State } from './elements.js';

export const WALL_HERE = 256;
export const PASS = Object.freeze({
  solid: 1, powder: 2, liquid: 4, gas: 8, energy: 16, particles: 32, heat: 64, air: 128,
});

// For the inspect line, in checklist order.
export const PASS_ORDER = [
  ['solids', PASS.solid], ['powders', PASS.powder], ['liquids', PASS.liquid], ['gases', PASS.gas],
  ['energy', PASS.energy], ['particles', PASS.particles], ['heat', PASS.heat], ['air', PASS.air],
];

// The bit that lets each element through a wall: by its state (only solid
// things that move ever try: loose debris and creatures), and flying
// particles by PARTICLES.
export const PASS_BIT = Uint8Array.from(DEFS, (d) => {
  if (d.projectile) return PASS.particles;
  switch (d.state) {
    case State.SOLID: return PASS.solid;
    case State.POWDER: return PASS.powder;
    case State.LIQUID: return PASS.liquid;
    case State.GAS: return PASS.gas;
    case State.ENERGY: return PASS.energy;
    default: return 0;
  }
});

// Does the wall layer value `v` stop `bit`? (No wall stops nothing.)
export const stops = (v, bit) => v !== 0 && (v & bit) === 0;
