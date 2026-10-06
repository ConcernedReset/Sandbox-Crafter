// Which elements the Gas effect blurs into soft clouds (renderer.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFS, ID, State } from '../src/sim/elements.js';
import { SOFT, heatRGB, zoneTint, portalRGB } from '../src/render/renderer.js';

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

test('the Heat view keeps changing colour however hot things get', () => {
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // Everyday temperatures as before: navy at absolute zero, white at 6000 °C.
  assert.deepEqual(heatRGB(-273), [20, 26, 92]);
  assert.ok(heatRGB(6000).every((v) => v >= 245), `white at 6000 °C: ${heatRGB(6000)}`);
  // Past that, every step of half a power of ten looks different, without
  // end, and stays bright, so nothing that hot looks cold.
  let last = heatRGB(6000);
  for (let e = 4; e <= 40; e += 0.5) {
    const c = heatRGB(10 ** e);
    assert.ok(dist(c, last) > 30, `1e${e} °C looks like the step before: ${c} vs ${last}`);
    assert.ok(Math.max(...c) > 200, `1e${e} °C is too dark: ${c}`);
    last = c;
  }
  // The famously hot things are told apart.
  const hot = { Plasma: 2e4, Plutonium: 1e6, Star: 15e6, Supernova: 1e9, 'Quark-gluon plasma': 5.5e12 };
  const names = Object.keys(hot);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = heatRGB(hot[names[i]]), b = heatRGB(hot[names[j]]);
      assert.ok(dist(a, b) > 40, `${names[i]} ${a} and ${names[j]} ${b} look alike`);
    }
  }
});

test('time zones are tinted blue when slow and orange when fast, more so further from normal', () => {
  const [q, h, d, f] = [1, 2, 3, 4].map(zoneTint);
  assert.ok(q.rgb[2] > q.rgb[0] && h.rgb[2] > h.rgb[0], 'slow is blue');
  assert.ok(d.rgb[0] > d.rgb[2] && f.rgb[0] > f.rgb[2], 'fast is orange');
  assert.ok(q.strength > h.strength && f.strength > d.strength);
});

test('portal ends have their own colours', () => {
  const seen = new Set();
  for (let s = 0; s < 8; s++) for (const e of [0, 1]) seen.add(portalRGB(s, e).join());
  assert.equal(seen.size, 16);
  const [r, , b] = portalRGB(0, 0);
  assert.ok(b > r, 'the first end of the first pair is blue');
});
