// Extra notes for the inspect line about cell i: a wall that lets things
// through, a time zone, a portal.

import { PASS_ORDER } from '../sim/walls.js';

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
  return notes;
}
