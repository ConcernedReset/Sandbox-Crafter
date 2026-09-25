import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { World } from '../src/sim/world.js';
import { makeWorld, fillRect, wallBox, countOf, run } from './helpers.js';

const types = (w, t) => countOf(w, t);

test('light passes through glass and heats the stone behind it', () => {
  const w = makeWorld(80, 20);
  fillRect(w, 30, 5, 34, 14, ID.GLASS);
  fillRect(w, 60, 5, 64, 14, ID.STONE);
  for (let y = 7; y < 13; y++) w.spawnProjectile(ID.PHOTON, 5.5, y + 0.5, 3, 0);
  run(w, 30);
  assert.equal(w.pn, 0, 'all photons were absorbed');
  let hottest = 0;
  for (let y = 5; y < 15; y++) hottest = Math.max(hottest, w.temp[y * 80 + 60]);
  assert.ok(hottest > 30, `stone face warmed to ${hottest}`);
  assert.ok(w.temp[10 * 80 + 32] < 25, 'glass stayed cool');
});

test('a mirror sends light back the way it came', () => {
  const w = makeWorld(80, 20);
  fillRect(w, 60, 0, 62, 19, ID.MIRROR);
  w.spawnProjectile(ID.PHOTON, 10.5, 10.5, 3, 0);
  run(w, 25);
  assert.equal(w.pn, 1);
  assert.ok(w.pvx[0] < 0, 'photon is heading back left');
});

test('lead stops neutrons that stone lets through', () => {
  const shoot = (shield) => {
    const w = makeWorld(100, 30);
    fillRect(w, 40, 0, 49, 29, shield);
    for (let k = 0; k < 200; k++) w.spawnProjectile(ID.NEUTRON, 5.5, 5 + (k % 20) + 0.5, 2, 0);
    let through = 0;
    run(w, 60, () => {
      for (let k = 0; k < w.pn; k++) if (w.ptype[k] === ID.NEUTRON && w.px[k] > 50) through++;
    });
    return through;
  };
  assert.ok(shoot(ID.STONE) > shoot(ID.LEAD) * 5, 'far more neutrons get through stone than lead');
});

// A 20x20 uranium pile with rods of something between the columns.
function reactor(rod) {
  const w = new World(400, 240, 7);
  for (let y = 220; y < 240; y++) {
    for (let x = 190; x < 214; x++) {
      w.spawn(y * 400 + x, rod && (x - 190) % 3 === 2 ? rod : ID.URANIUM);
    }
  }
  const before = types(w, ID.URANIUM);
  run(w, 900);
  return 1 - types(w, ID.URANIUM) / before; // fraction burned
}

test('graphite moderates a uranium pile into a chain reaction; boron shuts it down', () => {
  const bare = reactor(0);
  const graphite = reactor(ID.GRAPHITE);
  const boron = reactor(ID.BORON);
  assert.ok(graphite > 0.3, `moderated pile burned ${graphite}`);
  assert.ok(graphite > bare * 3, `moderated ${graphite} vs bare ${bare}`);
  assert.ok(boron < 0.05, `boron-controlled pile burned ${boron}`);
});

test('a large ball of plutonium explodes; a pinch of it does not', () => {
  const pile = (size) => {
    const w = new World(400, 240, 99);
    const x0 = 200 - (size >> 1);
    for (let y = 240 - size; y < 240; y++) {
      for (let x = x0; x < x0 + size; x++) w.spawn(y * 400 + x, ID.PLUTONIUM);
    }
    run(w, 300);
    return { left: types(w, ID.PLUTONIUM) / (size * size), fallout: types(w, ID.FALLOUT) };
  };
  const big = pile(16), small = pile(4);
  assert.ok(big.left < 0.6 && big.fallout > 20, `16x16 pile: ${JSON.stringify(big)}`);
  assert.equal(small.left, 1, 'a 4x4 pinch stays put');
});

test('deuterium doubles the neutrons that pass through it', () => {
  const w = makeWorld(120, 40);
  const box = wallBox(w, 30, 0, 100, 39);
  fillRect(w, box.x0, box.y0, box.x1, box.y1, ID.DEUTERIUM);
  for (let k = 0; k < 50; k++) w.spawnProjectile(ID.NEUTRON, 31.5, 5 + (k % 30) + 0.5, 2, 0);
  let most = 0;
  run(w, 30, () => { most = Math.max(most, w.pn); });
  assert.ok(most > 60, `neutron count grew to ${most}`);
});

test('a magnet curves an electron beam', () => {
  const path = (withMagnet) => {
    const w = makeWorld(120, 60);
    if (withMagnet) fillRect(w, 50, 36, 70, 45, ID.MAGNET);
    w.spawnProjectile(ID.ELECTRON, 5.5, 30.5, 2, 0);
    run(w, 40);
    return w.pn ? w.py[0] : NaN;
  };
  const straight = path(false), bent = path(true);
  assert.ok(Math.abs(straight - 30.5) < 0.01, 'no magnet: straight line');
  assert.ok(Math.abs(bent - 30.5) > 3, `with a magnet the beam ends at y=${bent}`);
});

test('radium decays down the chain into radon, polonium and finally lead', () => {
  const w = makeWorld(40, 40);
  const box = wallBox(w, 0, 0, 39, 39);
  fillRect(w, box.x0, 30, box.x1, box.y1, ID.RADIUM);
  run(w, 12000);
  assert.ok(w.seen[ID.RADON] && w.seen[ID.HELIUM] && w.seen[ID.POLONIUM] && w.seen[ID.LEAD]);
});

test('antimatter annihilates what it touches but stays sealed in by wall', () => {
  const w = makeWorld(60, 40);
  const box = wallBox(w, 20, 10, 40, 30);
  fillRect(w, box.x0, box.y0, box.x1, box.y1, ID.ANTIMATTER);
  run(w, 200);
  assert.equal(types(w, ID.ANTIMATTER), (box.x1 - box.x0 + 1) * (box.y1 - box.y0 + 1), 'none lost');
  fillRect(w, 0, 0, 59, 3, ID.STONE); // a ceiling for escaping antimatter to hit
  w.clearCell(10 * 60 + 30); // open the lid
  const before = types(w, ID.ANTIMATTER);
  run(w, 400);
  assert.ok(types(w, ID.ANTIMATTER) < before, 'some escaped and annihilated');
});

test('molten copper cools back into copper, not iron', () => {
  const w = makeWorld(30, 20);
  fillRect(w, 10, 15, 19, 19, ID.COPPER);
  run(w, 200, () => w.heat(15, 17, 6, 40));
  assert.ok(types(w, ID.MOLTEN_METAL) > 0, 'copper melted');
  run(w, 3000);
  assert.equal(types(w, ID.MOLTEN_METAL), 0);
  assert.ok(types(w, ID.COPPER) > 40);
  assert.equal(types(w, ID.METAL), 0);
});

test('a seed on dirt grows into a tree', () => {
  const w = makeWorld(40, 60);
  fillRect(w, 0, 55, 39, 59, ID.DIRT);
  w.spawn(10 * 40 + 20, ID.SEED);
  run(w, 3000);
  assert.ok(types(w, ID.WOOD) >= 8, 'trunk');
  assert.ok(types(w, ID.PLANT) >= 10, 'leaves');
});

test('superfluid climbs up the inside of a container', () => {
  const w = makeWorld(40, 60);
  const box = wallBox(w, 10, 20, 30, 59);
  fillRect(w, box.x0, 55, box.x1, box.y1, ID.SUPERFLUID);
  let highest = 60;
  run(w, 300, () => {
    for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.SUPERFLUID) highest = Math.min(highest, (i / 40) | 0);
  });
  assert.ok(highest < 40, `reached row ${highest}`);
});
