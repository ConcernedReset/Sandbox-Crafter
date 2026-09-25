import { World } from '../src/sim/world.js';
import { ID } from '../src/sim/elements.js';

export function makeWorld(w = 80, h = 60, seed = 7) {
  return new World(w, h, seed);
}

export function fillRect(world, x0, y0, x1, y1, t) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * world.w + x;
      if (world.type[i] === 0) world.spawn(i, t);
    }
  }
}

// A sealed wall box; returns the interior bounds.
export function wallBox(world, x0, y0, x1, y1) {
  for (let x = x0; x <= x1; x++) {
    world.spawn(y0 * world.w + x, ID.WALL);
    world.spawn(y1 * world.w + x, ID.WALL);
  }
  for (let y = y0; y <= y1; y++) {
    world.spawn(y * world.w + x0, ID.WALL);
    world.spawn(y * world.w + x1, ID.WALL);
  }
  return { x0: x0 + 1, y0: y0 + 1, x1: x1 - 1, y1: y1 - 1 };
}

export function countOf(world, t) {
  let n = 0;
  for (let i = 0; i < world.type.length; i++) if (world.type[i] === t) n++;
  return n;
}

// Centre of mass (average y) of an element, or NaN if absent.
export function meanY(world, t) {
  let sum = 0, n = 0;
  for (let i = 0; i < world.type.length; i++) {
    if (world.type[i] === t) { sum += (i / world.w) | 0; n++; }
  }
  return n ? sum / n : NaN;
}

export function run(world, frames, each) {
  for (let f = 0; f < frames; f++) {
    if (each) each(f);
    world.step();
  }
}
