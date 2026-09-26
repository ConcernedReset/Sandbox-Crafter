// The mechanics behind the 400-element expansion: new kinds of radiation,
// creatures, growing plants, glowing and heating gadgets, and a few classic
// chemistry demonstrations.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { World } from '../src/sim/world.js';
import { makeWorld, fillRect, wallBox, countOf, run } from './helpers.js';

// Fire a column of particles at a slab of `t` and count how many get past it.
function shootThrough(p, t, thickness, n = 100) {
  const w = new World(80, 20, 1);
  fillRect(w, 40, 0, 39 + thickness, 19, t);
  for (let k = 0; k < n; k++) w.spawnProjectile(p, 5.5, 2 + (k % 16) + 0.5, 3, 0);
  let through = 0;
  run(w, 30, () => {
    for (let k = 0; k < w.pn; k++) if (w.ptype[k] === p && w.px[k] > 41 + thickness) through++;
  });
  return through;
}

test('X-rays pass through water and wood but not bone or lead', () => {
  assert.ok(shootThrough(ID.XRAY, ID.WATER, 5) > 500);
  assert.ok(shootThrough(ID.XRAY, ID.WOOD, 5) > 500);
  assert.equal(shootThrough(ID.XRAY, ID.BONE, 5), 0);
  assert.equal(shootThrough(ID.XRAY, ID.LEAD, 5), 0);
});

test('gamma rays get through water, far less through concrete, and hardly at all through lead', () => {
  const water = shootThrough(ID.GAMMA, ID.WATER, 10, 200);
  const concrete = shootThrough(ID.GAMMA, ID.CONCRETE, 10, 200);
  const lead = shootThrough(ID.GAMMA, ID.LEAD, 10, 200);
  // Gamma rays that are stopped heat what stops them, so a lead shield under
  // heavy fire starts to melt and lets a few through.
  assert.ok(water > concrete * 2 && concrete > lead * 5, `water ${water}, concrete ${concrete}, lead ${lead}`);
});

test('glass blocks ultraviolet but quartz lets it through, and fluorite glows under it', () => {
  assert.equal(shootThrough(ID.UV_LIGHT, ID.GLASS, 5), 0);
  assert.ok(shootThrough(ID.UV_LIGHT, ID.QUARTZ, 5) > 500);
  const w = new World(80, 20, 1);
  fillRect(w, 40, 0, 44, 19, ID.FLUORITE);
  for (let k = 0; k < 50; k++) w.spawnProjectile(ID.UV_LIGHT, 5.5, 2 + (k % 16) + 0.5, 3, 0);
  let glowing = 0;
  run(w, 20, () => {
    let g = 0;
    for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.FLUORITE && w.life[i] > 0) g++;
    glowing = Math.max(glowing, g);
  });
  assert.ok(glowing > 5, `${glowing} fluorite crystals lit up`);
});

test('microwaves heat water but pass straight through plastic', () => {
  const heat = (t) => {
    // A glass tank: microwaves go straight through glass.
    const w = makeWorld(80, 24);
    fillRect(w, 38, 23, 46, 23, ID.WALL);
    fillRect(w, 38, 0, 38, 22, ID.GLASS);
    fillRect(w, 46, 0, 46, 22, ID.GLASS);
    fillRect(w, 39, 0, 45, 22, t);
    run(w, 60, (f) => {
      if (f % 2 === 0) for (let k = 0; k < 20; k++) w.spawnProjectile(ID.MICROWAVE, 5.5, 1.5 + k, 3, 0);
    });
    let T = 0, n = 0;
    for (let i = 0; i < w.type.length; i++) if (w.type[i] === t) { T += w.temp[i]; n++; }
    return T / n;
  };
  const water = heat(ID.WATER), plastic = heat(ID.PLASTIC);
  assert.ok(water > 40, `water warmed to ${water.toFixed(0)} °C`);
  assert.ok(plastic < 25, `plastic stayed at ${plastic.toFixed(0)} °C`);
});

test('an electromagnet only makes a field while current flows', () => {
  const field = (powered) => {
    const w = makeWorld(60, 30);
    fillRect(w, 20, 10, 40, 12, ID.ELECTROMAGNET);
    if (powered) w.spawn(11 * 60 + 19, ID.BATTERY);
    run(w, 60);
    return w.fieldActive;
  };
  assert.equal(field(false), false);
  assert.equal(field(true), true);
});

test('a battery lights a bulb and an LED, and heats nichrome without melting it', () => {
  const lit = (t) => {
    const w = makeWorld(60, 30);
    fillRect(w, 20, 10, 40, 10, t);
    w.spawn(10 * 60 + 19, ID.BATTERY);
    let photons = 0, hottest = 0;
    run(w, 300, () => {
      for (let k = 0; k < w.pn; k++) if (w.ptype[k] === ID.PHOTON) photons++;
      // Away from the battery, which warms up soaking up the light.
      for (let x = 25; x <= 40; x++) if (w.type[10 * 60 + x] !== 0) hottest = Math.max(hottest, w.temp[10 * 60 + x]);
    });
    return { photons, hottest, left: countOf(w, t) + countOf(w, ID.SPARK) };
  };
  const bulb = lit(ID.LIGHT_BULB), led = lit(ID.LED), nichrome = lit(ID.NICHROME);
  assert.ok(bulb.photons > 100 && bulb.hottest > 400, `bulb ${JSON.stringify(bulb)}`);
  assert.ok(led.photons > 10 && led.hottest < 100, `LED ${JSON.stringify(led)}`);
  assert.ok(nichrome.hottest > 300 && nichrome.hottest < 1400 && nichrome.left === 21, `nichrome ${JSON.stringify(nichrome)}`);
});

test('fish live in water and die on land', () => {
  const pond = makeWorld(60, 40);
  const box = wallBox(pond, 0, 0, 59, 39);
  fillRect(pond, box.x0, 10, box.x1, box.y1, ID.WATER);
  for (let k = 0; k < 6; k++) pond.convert((20 + k * 2) * 60 + 10 + k * 7, ID.FISH, false, -1);
  run(pond, 400);
  assert.equal(countOf(pond, ID.FISH), 6, 'every fish still swimming');

  const beach = makeWorld(60, 40);
  wallBox(beach, 0, 0, 59, 39);
  for (let k = 0; k < 6; k++) beach.spawn(37 * 60 + 5 + k * 8, ID.FISH);
  run(beach, 400);
  assert.equal(countOf(beach, ID.FISH), 0);
  assert.equal(countOf(beach, ID.BONE) + countOf(beach, ID.MEAT), 6, 'each left bones or meat');
});

test('bees turn flowers into honey, and ants breed on sugar', () => {
  const garden = makeWorld(60, 40);
  wallBox(garden, 0, 0, 59, 39);
  fillRect(garden, 5, 34, 54, 38, ID.FLOWER);
  for (let k = 0; k < 6; k++) garden.spawn(20 * 60 + 10 + k * 6, ID.BEE);
  run(garden, 2000);
  assert.ok(countOf(garden, ID.HONEY) > 0, 'some honey was made');

  const kitchen = makeWorld(60, 40);
  wallBox(kitchen, 0, 0, 59, 39);
  fillRect(kitchen, 1, 34, 58, 38, ID.STONE);
  fillRect(kitchen, 45, 30, 55, 33, ID.SUGAR);
  for (let k = 0; k < 5; k++) kitchen.spawn(33 * 60 + 5 + k * 3, ID.ANT);
  run(kitchen, 1500);
  assert.ok(countOf(kitchen, ID.ANT) > 5, `${countOf(kitchen, ID.ANT)} ants`);
  assert.ok(countOf(kitchen, ID.SUGAR) < 44, 'they ate the sugar');
});

test('wheat, sugarcane and kelp grow straight up and stop', () => {
  const w = makeWorld(40, 40);
  const box = wallBox(w, 0, 0, 39, 39);
  fillRect(w, box.x0, 35, box.x1, box.y1, ID.DIRT);
  w.spawn(34 * 40 + 10, ID.WHEAT);
  w.spawn(34 * 40 + 20, ID.SUGARCANE);
  run(w, 1500);
  const wheat = countOf(w, ID.WHEAT), cane = countOf(w, ID.SUGARCANE);
  assert.ok(wheat >= 5 && wheat <= 9, `wheat ${wheat} tall`);
  assert.ok(cane >= 7 && cane <= 13, `sugarcane ${cane} tall`);

  const sea = makeWorld(40, 40);
  const b = wallBox(sea, 0, 0, 39, 39);
  fillRect(sea, b.x0, 5, b.x1, b.y1, ID.SALT_WATER);
  sea.convert(38 * 40 + 20, ID.KELP, false, -1);
  run(sea, 1500);
  assert.ok(countOf(sea, ID.KELP) >= 7, `kelp ${countOf(sea, ID.KELP)} tall`);
});

test('a meteor explodes where it lands and leaves a meteorite', () => {
  const w = makeWorld(60, 60);
  wallBox(w, 0, 0, 59, 59);
  fillRect(w, 1, 45, 58, 58, ID.SAND);
  w.spawn(3 * 60 + 30, ID.METEOR);
  let peak = 0;
  run(w, 100, () => { for (const p of w.air.p) peak = Math.max(peak, p); });
  assert.equal(countOf(w, ID.METEOR), 0);
  assert.equal(countOf(w, ID.METEORITE), 1);
  assert.ok(peak > 3, `the impact made a pressure wave of ${peak.toFixed(1)}`);
});

test('a hot-ice crystal freezes the whole solution, and it comes out warm', () => {
  const w = makeWorld(40, 30);
  const box = wallBox(w, 0, 0, 39, 29);
  fillRect(w, box.x0, 10, box.x1, box.y1, ID.SODIUM_ACETATE);
  const liquid = countOf(w, ID.SODIUM_ACETATE);
  run(w, 100);
  assert.equal(countOf(w, ID.HOT_ICE), 0, 'left alone it stays liquid at room temperature');
  w.spawn(9 * 40 + 20, ID.HOT_ICE);
  run(w, 300);
  assert.ok(countOf(w, ID.HOT_ICE) > liquid * 0.9, 'it crystallised');
  let hottest = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.HOT_ICE) hottest = Math.max(hottest, w.temp[i]);
  assert.ok(hottest > 40 && hottest < 58, `crystals at ${hottest.toFixed(0)} °C`);
});

test('tin crumbles in the cold, and gallium melts at hand temperature and ruins aluminium', () => {
  const tin = makeWorld(30, 20);
  fillRect(tin, 5, 5, 25, 15, ID.TIN);
  run(tin, 600, () => { for (let i = 0; i < tin.type.length; i++) if (tin.type[i]) tin.temp[i] = 5; });
  assert.ok(countOf(tin, ID.GREY_TIN) > 10, 'tin pest set in');

  const hand = makeWorld(30, 20);
  fillRect(hand, 5, 5, 25, 15, ID.GALLIUM);
  run(hand, 200, () => { for (let i = 0; i < hand.type.length; i++) if (hand.type[i]) hand.temp[i] = 36; });
  assert.equal(countOf(hand, ID.GALLIUM), 0);

  const can = makeWorld(40, 30);
  const box = wallBox(can, 0, 0, 39, 29);
  fillRect(can, box.x0, 20, box.x1, box.y1, ID.ALUMINUM);
  fillRect(can, 15, 10, 25, 19, ID.LIQUID_GALLIUM);
  run(can, 400);
  assert.ok(countOf(can, ID.BRITTLE_ALUMINUM) > 5, 'the aluminium crumbled');
});

test('oganesson decays down the chain of superheavy elements, throwing off alpha particles', () => {
  const w = makeWorld(40, 30);
  fillRect(w, 15, 20, 24, 29, ID.OGANESSON);
  const seen = new Set();
  let alphas = 0;
  run(w, 3000, () => {
    for (let i = 0; i < w.type.length; i++) if (w.type[i]) seen.add(w.type[i]);
    for (let k = 0; k < w.pn; k++) if (w.ptype[k] === ID.ALPHA) alphas++;
  });
  for (const k of ['LIVERMORIUM', 'FLEROVIUM', 'COPERNICIUM', 'DARMSTADTIUM', 'HASSIUM', 'SEABORGIUM', 'RUTHERFORDIUM', 'NOBELIUM']) {
    assert.ok(seen.has(ID[k]), `${k} appeared along the way`);
  }
  assert.ok(alphas > 50);
});

test('a sheet of paper stops alpha particles', () => {
  assert.equal(shootThrough(ID.ALPHA, ID.PAPER, 1), 0);
});
