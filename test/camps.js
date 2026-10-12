// Test helpers for camps at war (war.test.js, grudges.test.js): a flat
// field, a settled camp on it, and a camp's war machines built outright.

import { ID } from '../src/sim/elements.js';
import { AA_CAP } from '../src/sim/war.js';
import { makeWorld, fillRect, run } from './helpers.js';

// A world `width` wide and `h` high with flat dirt over stone, ground 30
// cells up from the bottom.
export function field(width = 300, seed = 1, h = 90) {
  const w = makeWorld(width, h, seed);
  fillRect(w, 0, h - 5, width - 1, h - 1, ID.STONE);
  fillRect(w, 0, h - 30, width - 1, h - 6, ID.DIRT);
  return w;
}

// A settled camp at x: fire burning, hut built, lawn level, and n humans
// with a pickaxe, a gun, armour, gunpowder and wood (and `carry`: element
// -> how many). { camp, people }.
export function settle(w, x, n, carry = {}) {
  const camp = w.makeCamp(x, w.h - 31);
  camp.lit = true;
  camp.burned = 99999;
  camp.hut = w.planHut(camp);
  for (const c of camp.hut.cells) w.putDown(c, ID.BRICK);
  camp.hut.done = true;
  camp.flat = true;
  for (let u = -1; u <= 1; u++) w.spawn(w.campCell(camp, u, 0), ID.CAMPFIRE);
  const people = [];
  for (let k = 0; k < n; k++) {
    w.spawn((w.h - 50) * w.w + x - 12 + 6 * k, ID.HUMAN);
    run(w, 12);
    const e = w.creatures.filter((c) => c.kind === ID.HUMAN).at(-1);
    e.brain.camp = camp;
    camp.members.add(e.id);
    e.brain.tool = 1;
    e.brain.weapon = 1;
    e.brain.armour = 10;
    for (let j = 0; j < 12; j++) w.stow(e.brain, ID.GUNPOWDER);
    for (let j = 0; j < 8; j++) w.stow(e.brain, ID.WOOD);
    for (const [t, m] of Object.entries(carry)) for (let j = 0; j < m; j++) w.stow(e.brain, ID[t]);
    people.push(e);
  }
  return { camp, people };
}

// Build a camp's war machine `what` outright: its cells (and, for the pad,
// its helicopter; for the launcher, a missile).
export function built(w, camp, what) {
  const s = w.warPlan(camp, what);
  s.cells.forEach((c, k) => w.putDown(c, s.mats[k] === 'metal' ? ID.METAL : ID.STONE));
  s.done = true;
  if (what === 'pad') {
    camp.heli = w.buildCraft(ID.HELICOPTER, s.hx, s.hy, s.facing, camp.gx, camp.gy, {
      kind: 'heli', camp, state: 'parked', mend: true, homeX: s.hx, homeY: s.hy, homeFacing: s.facing,
      goal: null, foe: null, reload: 0, quiet: 0, pace: 0, blocked: 0,
    }, { b: camp.id - 1 });
  }
  if (what === 'launcher') {
    s.missile = w.buildCraft(ID.MISSILE, s.mx, s.my, 1, camp.gx, camp.gy, { kind: 'missile', camp, state: 'loaded', mend: false });
  }
  if (what === 'aa') s.ammo = AA_CAP;
  run(w, 30); // (they grow)
  return s;
}

export const CHORES = 61; // steps: every camp's chores (births, the hut, raids, anger) come round once
export const alive = (w, o) => o !== null && w.creatureById[o.id] === o;
