// Extra notes for the inspect line about cell i: a wall that lets things
// through, a time zone, a portal, a creature's health (and what a human is
// doing).

import { PASS_ORDER } from '../sim/walls.js';
import { inventoryNote } from '../sim/humans.js';

const SPEED_NAMES = ['', '¼×', '½×', '2×', '4×'];

export function cellNotes(world, i) {
  const notes = [];
  const wl = world.wall[i] & 255;
  if (wl !== 0) notes.push(`lets ${PASS_ORDER.filter(([, b]) => wl & b).map(([n]) => n).join(', ')} through`);
  const s = world.speed[i];
  if (s !== 0) notes.push(`${SPEED_NAMES[s]} speed`);
  const p = world.portalInfo(i);
  if (p) {
    // The first pair is blue and orange; later pairs have other colours.
    const name = p.slot === 0 ? (p.end === 0 ? 'blue' : 'orange') : (p.end === 0 ? 'first' : 'second');
    notes.push(`Portal ${p.slot + 1}, ${name} end${p.paired ? '' : ' (draw the other end)'}`);
  }
  const e = world.creatureAt(i);
  if (e) {
    notes.push(`health ${e.n - e.lost} of ${e.n}`);
    if (e.brain) {
      notes.push(e.brain.job);
      const inv = inventoryNote(e.brain);
      if (inv) notes.push(inv);
    }
  }
  return notes;
}
