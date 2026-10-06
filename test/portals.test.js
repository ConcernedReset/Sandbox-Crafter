// Portals: two lines; anything crossing one comes out of the other.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { MAX_PORTALS } from '../src/sim/portals.js';
import { makeWorld, fillRect, wallBox, countOf, run } from './helpers.js';

test('sand falling through a floor portal comes out of a ceiling portal, round and round', () => {
  const w = makeWorld(60, 60);
  w.addPortal(20, 50, 40, 50);
  w.addPortal(20, 5, 40, 5);
  fillRect(w, 28, 40, 32, 44, ID.SAND);
  let topSeen = 0;
  run(w, 120, () => { for (let i = 6 * 60; i < 20 * 60; i++) if (w.type[i] === ID.SAND) topSeen++; });
  assert.ok(topSeen > 0, 'sand came out under the ceiling portal');
  assert.equal(countOf(w, ID.SAND), 25, 'none lost');
  for (let i = 51 * 60; i < 60 * 60; i++) assert.notEqual(w.type[i], ID.SAND, 'none fell past the floor portal');
});

test('a lone end does nothing', () => {
  const w = makeWorld(40, 40);
  w.addPortal(10, 20, 30, 20);
  fillRect(w, 18, 10, 22, 12, ID.SAND);
  run(w, 80);
  let below = 0;
  for (let i = 21 * 40; i < 40 * 40; i++) if (w.type[i] === ID.SAND) below++;
  assert.equal(below, 15, 'all the sand fell past it');
});

test('light is turned by perpendicular ends and keeps its way through parallel ones', () => {
  const exit = (bx0, by0, bx1, by1) => {
    const w = makeWorld(100, 100);
    w.addPortal(20, 10, 20, 30); // a vertical end
    w.addPortal(bx0, by0, bx1, by1);
    w.spawnProjectile(ID.PHOTON, 10.5, 20.5, 2, 0);
    run(w, 8);
    return [w.pvx[0], w.pvy[0]];
  };
  const [vx1, vy1] = exit(60, 10, 60, 30); // parallel
  assert.ok(vx1 > 1.9 && Math.abs(vy1) < 0.1, `parallel: ${vx1}, ${vy1}`);
  const [vx2, vy2] = exit(50, 60, 70, 60); // horizontal: a quarter turn
  assert.ok(Math.abs(vx2) < 0.1 && Math.abs(vy2) > 1.9, `perpendicular: ${vx2}, ${vy2}`);
});

test('smoke drifts out of a box through a portal pair', () => {
  const w = makeWorld(80, 40);
  const box = wallBox(w, 5, 5, 30, 35);
  w.addPortal(box.x0 + 2, 10, box.x1 - 2, 10); // inside, near the top
  w.addPortal(50, 20, 70, 20); // outside
  fillRect(w, box.x0, box.y0 + 8, box.x1, box.y1, ID.SMOKE);
  run(w, 100);
  let out = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.SMOKE && i % 80 > 35) out++;
  assert.ok(out > 5, `${out} smoke came out`);
});

test('pressure on one side of an end reaches the matching side of the other', () => {
  const w = makeWorld(80, 40);
  w.addPortal(10, 20, 30, 20); // normal points down: its −n side is above
  w.addPortal(50, 20, 70, 20);
  run(w, 60, () => w.pressurize(20, 16, 3, 2));
  const below = w.pressureAt(60, 23), above = w.pressureAt(60, 17);
  assert.ok(below > above + 0.25, `below the other end ${below.toFixed(2)}, above it ${above.toFixed(2)}`);
});

test('with the way out blocked, things wait on the line', () => {
  const w = makeWorld(60, 60);
  w.addPortal(20, 50, 40, 50);
  w.addPortal(20, 5, 40, 5);
  fillRect(w, 18, 6, 42, 6, ID.WALL); // right under the ceiling end
  fillRect(w, 28, 44, 32, 46, ID.SAND);
  run(w, 60);
  let onLine = 0;
  for (let x = 20; x <= 40; x++) if (w.type[50 * 60 + x] === ID.SAND) onLine++;
  assert.ok(onLine > 0, 'sand is waiting on the floor end');
  assert.equal(countOf(w, ID.SAND), 15);
});

test('removing a pair: right-click, erase and Clear', () => {
  const w = makeWorld(60, 60);
  w.addPortal(10, 10, 30, 10);
  w.addPortal(10, 40, 30, 40);
  assert.ok(w.removePortalAt(10 * 60 + 15));
  assert.ok(w.portalAt.every((v) => v === 0) && w.portalCells === 0);
  w.addPortal(10, 10, 30, 10);
  w.addPortal(10, 40, 30, 40);
  w.erase(20, 40, 1);
  assert.ok(w.portalAt.every((v) => v === 0), 'erasing one end removes the pair');
  w.addPortal(10, 10, 30, 10);
  w.clearAll();
  assert.ok(w.portalAt.every((v) => v === 0) && w.portals.every((p) => p === null));
});

test("ends can't overlap, and there are at most 32 pairs", () => {
  const w = makeWorld(200, 200);
  w.addPortal(10, 10, 50, 10);
  const r = w.addPortal(30, 0, 30, 20); // crosses the first at (30, 10)
  assert.equal(w.portalInfo(10 * 200 + 30).end, 0, 'the crossing cell still belongs to the first end');
  assert.equal(r.slot, 0);
  for (let k = 1; k < MAX_PORTALS; k++) { w.addPortal(5, 20 + k * 5, 40, 20 + k * 5); w.addPortal(60, 20 + k * 5, 90, 20 + k * 5); }
  assert.equal(w.addPortal(100, 10, 150, 10), 'full');
});
