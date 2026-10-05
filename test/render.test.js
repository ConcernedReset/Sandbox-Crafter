// Which elements the Gas effect blurs into soft clouds (renderer.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFS, ID, State } from '../src/sim/elements.js';
import { SOFT } from '../src/render/renderer.js';

test('the Gas effect blurs gases, flames and plasma, and nothing else', () => {
  const gassy = new Set([ID.FIRE, ID.PLASMA, ID.BALL_LIGHTNING]);
  for (const d of DEFS) {
    if (!d.id || d.projectile) continue;
    const want = d.state === State.GAS || gassy.has(d.id);
    assert.equal(SOFT[d.id] === 1, want, `${d.name} (${d.state === State.GAS ? 'gas' : 'not a gas'})`);
  }
  // Things that glow when excited aren't gases just because neon is.
  for (const k of ['LED', 'PHOSPHOR', 'CHLOROPHYLL', 'FLUORITE', 'URANIUM_GLASS']) assert.equal(SOFT[ID[k]], 0, k);
  for (const k of ['NEON', 'AURORA', 'SMOKE', 'STEAM']) assert.equal(SOFT[ID[k]], 1, k);
});
