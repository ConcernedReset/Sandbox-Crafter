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

test('neutrons bounce off stone, battering it, while lead soaks some of them up', () => {
  const shoot = (shield) => {
    const w = makeWorld(100, 30);
    fillRect(w, 40, 0, 49, 29, shield);
    for (let k = 0; k < 200; k++) w.spawnProjectile(ID.NEUTRON, 5.5, 5 + (k % 20) + 0.5, 2, 0);
    let back = 0, through = 0;
    run(w, 40, () => {
      for (let k = 0; k < w.pn; k++) {
        if (w.ptype[k] !== ID.NEUTRON) continue;
        if (w.pvx[k] < 0) back++;
        if (w.px[k] > 50) through++;
      }
    });
    let heat = 0;
    for (let i = 0; i < w.type.length; i++) if (w.type[i] === shield) heat += w.temp[i] - 22;
    return { back, through, heat };
  };
  const stone = shoot(ID.STONE), lead = shoot(ID.LEAD);
  assert.equal(stone.through, 0, 'nothing gets through stone');
  // Lead soaks up about a third of the neutrons that hit it.
  assert.ok(stone.back > lead.back * 1.3, `stone sends more of them back (${stone.back} vs ${lead.back})`);
  assert.ok(stone.heat > 200 * 100, `the stone took a battering (${stone.heat.toFixed(0)} °C in all)`);
});

test('a neutron beam knocks pieces loose from a wall of stone', () => {
  const w = makeWorld(100, 30);
  fillRect(w, 40, 0, 49, 29, ID.STONE);
  run(w, 60, () => {
    for (let k = 0; k < 10; k++) w.spawnProjectile(ID.NEUTRON, 5.5, 10 + k + 0.5, 2, 0);
  });
  let loose = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.STONE && w.loose[i]) loose++;
  assert.ok(loose > 5, `${loose} pieces knocked loose`);
});

// A 20x20 uranium pile with rods of something between the columns, started
// with a sprinkle of neutrons (uranium left alone just sits there).
function reactor(rod) {
  const w = new World(400, 240, 7);
  for (let y = 220; y < 240; y++) {
    for (let x = 190; x < 214; x++) {
      w.spawn(y * 400 + x, rod && (x - 190) % 3 === 2 ? rod : ID.URANIUM);
    }
  }
  const before = types(w, ID.URANIUM);
  run(w, 900, (f) => {
    if (f < 60 && f % 3 === 0) {
      for (let k = 0; k < 4; k++) w.spawnProjectile(ID.NEUTRON, 190 + w.rand() * 24, 220 + w.rand() * 20);
    }
  });
  return 1 - types(w, ID.URANIUM) / before; // fraction burned
}

test('graphite moderates a uranium pile into a chain reaction; boron shuts it down', () => {
  const bare = reactor(0);
  const graphite = reactor(ID.GRAPHITE);
  const boron = reactor(ID.BORON);
  assert.ok(graphite > 0.3, `moderated pile burned ${graphite}`);
  assert.ok(graphite > bare * 1.8, `moderated ${graphite} vs bare ${bare}`);
  assert.ok(boron < 0.05, `boron-controlled pile burned ${boron}`);
});

test('a large ball of plutonium sits still until a neutron sets it off; a pinch of it only pops', () => {
  const pile = (size, spark) => {
    const w = new World(400, 240, 99);
    const x0 = 200 - (size >> 1);
    for (let y = 240 - size; y < 240; y++) {
      for (let x = x0; x < x0 + size; x++) w.spawn(y * 400 + x, ID.PLUTONIUM);
    }
    let pressure = 0;
    run(w, 300, (f) => {
      // A few neutrons fired into the middle of the pile.
      if (spark && f === 10) for (let k = 0; k < 6; k++) w.spawnProjectile(ID.NEUTRON, 200.5, 240 - size / 2);
      for (const p of w.air.p) if (p > pressure) pressure = p;
    });
    return { left: types(w, ID.PLUTONIUM) / (size * size), fallout: types(w, ID.FALLOUT), pressure: Math.round(pressure) };
  };
  const still = pile(16, false), big = pile(16, true), small = pile(4, true);
  assert.ok(still.left > 0.98 && still.fallout <= 2 && still.pressure < 1, `16x16 pile left alone: ${JSON.stringify(still)}`);
  assert.ok(big.left < 0.6 && big.fallout > 20 && big.pressure > 150, `16x16 pile: ${JSON.stringify(big)}`);
  // A pinch reacts too, but with far too little to blow anything apart.
  assert.ok(small.pressure < 50, `4x4 pinch: ${JSON.stringify(small)}`);
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

test('squeezed radium decays down the chain into radon, polonium and finally lead', () => {
  const w = makeWorld(40, 40);
  const box = wallBox(w, 0, 0, 39, 39);
  fillRect(w, box.x0, 30, box.x1, box.y1, ID.RADIUM);
  run(w, 12000, () => w.pressurize(20, 15, 4, 1));
  assert.ok(w.seen[ID.RADON] && w.seen[ID.HELIUM] && w.seen[ID.POLONIUM] && w.seen[ID.LEAD]);
});

// A bed of polonium in a sealed box; returns how much of it decayed.
function polonium(frames, each) {
  const w = makeWorld(40, 40);
  const box = wallBox(w, 0, 0, 39, 39);
  fillRect(w, box.x0, 26, box.x1, box.y1, ID.POLONIUM);
  const before = types(w, ID.POLONIUM);
  run(w, frames, (f) => each?.(w, f));
  return before - types(w, ID.POLONIUM);
}

test('radioactive elements sit almost perfectly still when left alone', () => {
  const decayed = polonium(1200);
  assert.ok(decayed <= 6, `${decayed} decayed on their own`);
});

test('pressure wakes a radioactive pile up', () => {
  const decayed = polonium(600, (w) => w.pressurize(20, 12, 8, 2));
  assert.ok(decayed > 50, `${decayed} decayed under pressure`);
});

test('a burst of neutrons sets radioactive atoms off', () => {
  const decayed = polonium(300, (w, f) => {
    if (f < 60) for (let k = 0; k < 4; k++) w.spawnProjectile(ID.NEUTRON, 2.5 + k * 9, 20.5, 0.3, 2);
  });
  const rest = polonium(300); // the same, left alone
  assert.ok(decayed > rest + 5, `${decayed} decayed after the neutrons went through, ${rest} left alone`);
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

// Frames a photon fired right at (5, 10) takes to get past x = 150, with
// `t` filling x 50-99 (or nothing).
function crossing(t) {
  const w = makeWorld(200, 20);
  if (t) fillRect(w, 50, 0, 99, 19, t);
  const k = w.spawnProjectile(ID.PHOTON, 5.5, 10.5, 3, 0);
  let f = 0;
  while (w.pn > 0 && w.px[k] < 150 && f < 200) { w.step(); f++; }
  return { frames: f, speed: Math.hypot(w.pvx[k], w.pvy[k]), alive: w.pn > 0 };
}

test('light slows down in water, more in glass and most in diamond, and speeds up again after', () => {
  const air = crossing(0), water = crossing(ID.WATER), glass = crossing(ID.GLASS), diamond = crossing(ID.DIAMOND);
  for (const r of [water, glass, diamond]) assert.ok(r.alive, 'the photon got through');
  assert.ok(water.frames >= air.frames + 4, `water ${water.frames} frames, air ${air.frames}`);
  assert.ok(glass.frames > water.frames, `glass ${glass.frames}, water ${water.frames}`);
  assert.ok(diamond.frames > glass.frames + 5, `diamond ${diamond.frames}, glass ${glass.frames}`);
  for (const r of [water, glass, diamond]) assert.ok(Math.abs(r.speed - 3) < 1e-4, 'full speed again');
});

// ---- The Powder Toy style nuclear physics ---------------------------------

test('one neutron sets off a plutonium ball: enormous pressure and heat tear the stone round it open', () => {
  const w = new World(240, 160, 3);
  const cx = 120, cy = 80;
  w.forCircle(cx, cy, 40, (i, x, y) => { if (Math.hypot(x - cx, y - cy) > 30) w.spawn(i, ID.STONE); });
  w.forCircle(cx, cy, 10, (i) => w.spawn(i, ID.PLUTONIUM));
  const stone = types(w, ID.STONE), pu = types(w, ID.PLUTONIUM);
  w.spawnProjectile(ID.NEUTRON, cx - 13.5, cy + 0.5, 1, 0);
  let maxP = 0, maxT = 0;
  run(w, 400, () => {
    for (let i = 0; i < w.air.p.length; i++) if (w.air.p[i] > maxP) maxP = w.air.p[i];
    for (let i = 0; i < w.temp.length; i++) if (w.type[i] && w.temp[i] > maxT) maxT = w.temp[i];
  });
  assert.ok(maxP > 200, `pressure reached ${maxP.toFixed(0)}`);
  assert.ok(maxT > 5000, `temperature reached ${maxT.toFixed(0)}`);
  assert.ok(types(w, ID.PLUTONIUM) < pu * 0.3, `${types(w, ID.PLUTONIUM)} of ${pu} plutonium left`);
  assert.ok(types(w, ID.STONE) < stone * 0.8, `${types(w, ID.STONE)} of ${stone} stone left`);
});

test('a hot proton flies through stone, heating it, and sets wood alight', () => {
  const w = makeWorld(120, 20);
  fillRect(w, 30, 5, 49, 14, ID.STONE);
  fillRect(w, 60, 5, 79, 14, ID.WOOD);
  const k = w.spawnProjectile(ID.PROTON, 5.5, 10.5, 1.5, 0);
  w.ptemp[k] = 3000;
  let burning = false, hottest = 0;
  run(w, 80, () => {
    if (types(w, ID.FIRE) > 0) burning = true;
    for (let x = 30; x < 50; x++) hottest = Math.max(hottest, w.temp[10 * 120 + x]);
  });
  assert.ok(hottest > 400, `stone in its path reached ${hottest.toFixed(0)}`);
  assert.ok(burning, 'the wood caught fire');
});

test('protons smashed together make neutrons', () => {
  const w = makeWorld(80, 40);
  for (let n = 0; n < 60; n++) {
    w.spawnProjectile(ID.PROTON, 20.5, 10.5 + (n % 20), 1.5, 0);
    w.spawnProjectile(ID.PROTON, 59.5, 10.5 + (n % 20), -1.5, 0);
  }
  run(w, 40);
  assert.ok(w.seen[ID.NEUTRON], 'neutrons');
});
