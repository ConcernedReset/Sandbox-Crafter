// Light that takes the colour of what it bounces off, mirrors made of metal
// behind glass, and the machines: switches, buttons, clocks and sensors
// driving doors, lamps, laser emitters and the rest.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID, AMBIENT } from '../src/sim/elements.js';
import { World } from '../src/sim/world.js';
import { makeWorld, fillRect, countOf, run } from './helpers.js';

// Fire a column of photons rightwards at whatever is built from x = 40 on.
function shine(build, frames = 20, n = 16) {
  const w = new World(80, 20, 3);
  build(w);
  for (let k = 0; k < n; k++) w.spawnProjectile(ID.PHOTON, 5.5, 2 + k + 0.5, 3, 0);
  let pressure = 0;
  run(w, frames, () => { for (const v of w.air.p) pressure = Math.max(pressure, Math.abs(v)); });
  const back = [];
  for (let k = 0; k < w.pn; k++) if (w.ptype[k] === ID.PHOTON && w.pvx[k] < 0) back.push(w.ptint[k]);
  return { w, back, pressure };
}

const heatIn = (w, t) => {
  let heat = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === t) heat += w.temp[i] - AMBIENT;
  return heat;
};

test('light takes the colour of the metal it bounces off', () => {
  const { back } = shine((w) => fillRect(w, 40, 0, 44, 19, ID.GOLD));
  assert.ok(back.length > 8, `${back.length} photons came back`);
  assert.ok(back.every((t) => t === ID.GOLD), 'every reflected photon is gold');
});

test('light takes the colour of what it shines through', () => {
  for (const t of [ID.WATER, ID.EMERALD, ID.GLASS]) {
    const w = new World(80, 20, 3);
    fillRect(w, 40, 0, 44, 19, t);
    if (t === ID.WATER) fillRect(w, 0, 0, 79, 19, ID.WATER); // a pool that can't spread out
    for (let k = 0; k < 16; k++) w.spawnProjectile(ID.PHOTON, 5.5, 2 + k + 0.5, 3, 0);
    run(w, 20);
    let tinted = 0;
    for (let k = 0; k < w.pn; k++) if (w.px[k] > 50 && w.ptint[k] === t) tinted++;
    assert.equal(tinted, 16, `${tinted} of 16 photons came out coloured by element ${t}`);
  }
});

test('metal behind glass is a perfect mirror: every photon bounces, with no heat or pressure', () => {
  const bare = shine((w) => fillRect(w, 43, 0, 46, 19, ID.COPPER));
  assert.ok(bare.back.length < 16 && heatIn(bare.w, ID.COPPER) > 0, 'bare copper soaks up some light');

  const { w, back, pressure } = shine((w) => {
    fillRect(w, 40, 0, 42, 19, ID.GLASS);
    fillRect(w, 43, 0, 46, 19, ID.COPPER);
  });
  assert.equal(back.length, 16, 'all 16 photons came back');
  assert.ok(back.every((t) => t === ID.COPPER), 'tinted copper');
  assert.equal(heatIn(w, ID.COPPER), 0);
  assert.equal(heatIn(w, ID.GLASS), 0);
  assert.equal(pressure, 0);
});

test('a Mirror reflects all the light without warming or changing its colour', () => {
  const { w, back, pressure } = shine((w) => fillRect(w, 40, 0, 42, 19, ID.MIRROR));
  assert.equal(back.length, 16);
  assert.ok(back.every((t) => t === 0));
  assert.equal(heatIn(w, ID.MIRROR), 0);
  assert.equal(pressure, 0);
});

test('a diagonal mirror turns a beam of light through a right angle', () => {
  const w = new World(80, 60, 4);
  for (let k = 0; k < 30; k++) w.spawn((45 - k) * w.w + 30 + k, ID.MIRROR); // a line going up to the right
  for (let k = 0; k < 10; k++) w.spawnProjectile(ID.PHOTON, 5.5, 30.5, 3, 0);
  run(w, 20);
  assert.equal(w.pn, 10);
  for (let k = 0; k < w.pn; k++) {
    assert.ok(Math.abs(w.pvx[k]) < 0.01 && w.pvy[k] < -2.9, `photon heading (${w.pvx[k]}, ${w.pvy[k]})`);
  }
});

test('a beam splitter reflects about half the light and lets the rest through', () => {
  const w = new World(80, 20, 5);
  fillRect(w, 40, 0, 40, 19, ID.BEAM_SPLITTER);
  for (let k = 0; k < 200; k++) w.spawnProjectile(ID.PHOTON, 5.5, 2 + (k % 16) + 0.5, 3, 0);
  run(w, 20);
  let back = 0, on = 0;
  for (let k = 0; k < w.pn; k++) if (w.pvx[k] < 0) back++; else if (w.px[k] > 41) on++;
  assert.ok(back > 60 && on > 60 && back + on === 200, `${back} reflected, ${on} passed`);
});

test('light copied by a ruby comes out red', () => {
  const { w } = shine((w) => fillRect(w, 40, 0, 44, 19, ID.RUBY), 13, 16);
  let red = 0;
  for (let k = 0; k < w.pn; k++) if (w.ptint[k] === ID.RUBY) red++;
  assert.ok(red > 8, `${red} red photons`);
});

// A switch at (2, 10) wired along a metal track to whatever sits at x = 30.
function circuit(target, h = 20) {
  const w = makeWorld(60, h, 11);
  w.spawn(10 * w.w + 2, ID.SWITCH);
  fillRect(w, 3, 10, 29, 10, ID.METAL);
  target(w);
  return w;
}

// Paint Spark onto a switch for `frames` frames, then let go.
function flip(w, x, y, frames = 1) {
  run(w, frames, () => w.paint(x, y, 0, ID.SPARK));
}

const lit = (w, t) => {
  let n = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === t && w.life[i] > 0) n++;
  return n;
};

test('a switch turns a whole block of lamps on, and off again', () => {
  const w = circuit((w) => fillRect(w, 30, 6, 40, 14, ID.LAMP));
  const lamps = countOf(w, ID.LAMP);
  run(w, 60);
  assert.equal(lit(w, ID.LAMP), 0, 'off to begin with');
  flip(w, 2, 10);
  run(w, 60);
  assert.equal(lit(w, ID.LAMP), lamps, 'every lamp in the block is lit');
  run(w, 120, (f) => { if (f % 30 === 0) assert.equal(lit(w, ID.LAMP), lamps, 'and stays lit'); });
  // The last pulse still has to run down the wire before the lamps go out.
  flip(w, 2, 10);
  run(w, 80);
  assert.equal(lit(w, ID.LAMP), 0, 'switched off');
});

test('holding the spark brush on a switch flips it only once', () => {
  const w = circuit((w) => fillRect(w, 30, 8, 32, 12, ID.RED_LAMP));
  flip(w, 2, 10, 30);
  run(w, 40);
  assert.ok(lit(w, ID.RED_LAMP) > 0, 'still on after holding the brush down');
});

test('a door opens while powered and shuts when the power stops', () => {
  const w = circuit((w) => {
    fillRect(w, 30, 0, 32, 19, ID.DOOR);
    fillRect(w, 34, 15, 40, 19, ID.WATER);
  }, 20);
  const door = countOf(w, ID.DOOR);
  flip(w, 2, 10);
  run(w, 40);
  assert.equal(countOf(w, ID.DOOR), 0, 'the whole door is open');
  run(w, 150);
  let leftSide = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.WATER && i % w.w < 30) leftSide++;
  assert.ok(leftSide > 0, 'water flowed through the doorway');
  flip(w, 2, 10);
  run(w, 100);
  assert.equal(countOf(w, ID.DOOR), door, 'the door is back');
  assert.ok(countOf(w, ID.WATER) > 30, 'and pushed the water aside rather than deleting it');
});

test('a button opens a door for a moment', () => {
  const w = makeWorld(40, 20, 2);
  w.spawn(10 * w.w + 5, ID.BUTTON);
  fillRect(w, 6, 0, 7, 19, ID.DOOR);
  w.paint(5, 10, 0, ID.SPARK);
  run(w, 5);
  assert.equal(countOf(w, ID.DOOR), 0);
  run(w, 150);
  assert.equal(countOf(w, ID.DOOR), 40, 'shut again after the button let go');
});

test('an erased doorway does not come back', () => {
  const w = makeWorld(40, 20, 2);
  w.spawn(10 * w.w + 5, ID.BUTTON);
  fillRect(w, 6, 0, 7, 19, ID.DOOR);
  w.paint(5, 10, 0, ID.SPARK);
  run(w, 5);
  w.eraseArea((fn) => w.forRect(6, 0, 7, 19, fn));
  run(w, 150);
  assert.equal(countOf(w, ID.DOOR), 0);
});

test('a clock blinks a lamp on and off', () => {
  const w = makeWorld(20, 10, 4);
  w.spawn(5 * w.w + 5, ID.CLOCK);
  w.spawn(5 * w.w + 6, ID.LAMP);
  let on = 0, off = 0;
  run(w, 240, () => { if (lit(w, ID.LAMP)) on++; else off++; });
  assert.ok(on > 40 && off > 80, `on ${on} frames, off ${off}`);
});

test('a laser emitter fires red light only while powered, and a photocell senses it', () => {
  const w = makeWorld(80, 20, 6);
  w.spawn(10 * w.w + 10, ID.SWITCH);
  w.spawn(10 * w.w + 11, ID.LASER_EMITTER);
  // Wall off the top and bottom faces so it only fires to the right.
  w.spawn(9 * w.w + 11, ID.WALL);
  w.spawn(11 * w.w + 11, ID.WALL);
  fillRect(w, 60, 8, 60, 12, ID.PHOTOCELL);
  fillRect(w, 61, 8, 63, 12, ID.GREEN_LAMP);
  run(w, 30);
  assert.equal(w.pn, 0, 'no light while it\'s off');
  flip(w, 10, 10);
  run(w, 40);
  let red = 0;
  for (let k = 0; k < w.pn; k++) if (w.ptint[k] === ID.LASER_EMITTER) red++;
  assert.ok(red > 5 && red === w.pn, `${red} red photons of ${w.pn}`);
  assert.equal(lit(w, ID.GREEN_LAMP), 15, 'the photocell lights the lamp');
  assert.equal(heatIn(w, ID.PHOTOCELL), 0, 'photocells don\'t warm up');
  // Break the beam.
  fillRect(w, 40, 0, 40, 19, ID.STONE);
  run(w, 60);
  assert.equal(lit(w, ID.GREEN_LAMP), 0, 'beam broken, lamp off');
});

test('a pressure plate switches on while something sits on it', () => {
  const w = makeWorld(30, 20, 8);
  fillRect(w, 5, 15, 12, 15, ID.PRESSURE_PLATE);
  fillRect(w, 13, 15, 15, 15, ID.BLUE_LAMP);
  run(w, 20);
  assert.equal(lit(w, ID.BLUE_LAMP), 0);
  fillRect(w, 8, 12, 9, 13, ID.SAND);
  run(w, 20);
  assert.equal(lit(w, ID.BLUE_LAMP), 3);
});

test('a thermostat switches on when it gets hot, a heater heats and a cooler cools', () => {
  const w = makeWorld(40, 10, 9);
  w.spawn(5 * w.w + 5, ID.THERMOSTAT);
  w.spawn(5 * w.w + 6, ID.LAMP);
  run(w, 10);
  assert.equal(lit(w, ID.LAMP), 0);
  w.temp[5 * w.w + 5] = 200;
  run(w, 3);
  assert.equal(lit(w, ID.LAMP), 1);

  w.spawn(5 * w.w + 20, ID.BATTERY);
  w.spawn(5 * w.w + 21, ID.HEATER);
  w.spawn(5 * w.w + 30, ID.BATTERY);
  w.spawn(5 * w.w + 31, ID.COOLER);
  run(w, 100);
  assert.ok(w.temp[5 * w.w + 21] > 800, `heater at ${w.temp[5 * w.w + 21]}`);
  assert.ok(w.temp[5 * w.w + 31] < -100, `cooler at ${w.temp[5 * w.w + 31]}`);
});

test('a dispenser pours out what touched it, only while powered', () => {
  const w = makeWorld(30, 30, 10);
  const at = 10 * w.w + 15;
  w.spawn(at, ID.DISPENSER);
  fillRect(w, 12, 5, 18, 9, ID.WATER); // a splash of water lands on it
  run(w, 3);
  assert.equal(w.ctype[at], ID.WATER, 'it remembers water');
  w.eraseArea((fn) => w.forRect(0, 0, 29, 9, fn));
  w.eraseArea((fn) => w.forRect(0, 11, 29, 29, fn));
  w.eraseArea((fn) => w.forRect(0, 10, 14, 10, fn));
  w.eraseArea((fn) => w.forRect(16, 10, 29, 10, fn));
  run(w, 30);
  assert.equal(countOf(w, ID.WATER), 0, 'nothing while unpowered');
  w.spawn(10 * w.w + 14, ID.BATTERY);
  run(w, 60);
  assert.ok(countOf(w, ID.WATER) > 30, `pours water once powered (${countOf(w, ID.WATER)})`);
});

test('a drain swallows liquid only while powered', () => {
  const w = makeWorld(30, 20, 12);
  fillRect(w, 4, 5, 4, 19, ID.WALL);
  fillRect(w, 26, 5, 26, 19, ID.WALL);
  fillRect(w, 5, 19, 25, 19, ID.DRAIN);
  fillRect(w, 5, 10, 25, 18, ID.WATER);
  run(w, 30);
  const water = countOf(w, ID.WATER);
  assert.ok(water > 150, 'unpowered, the water sits there');
  w.clearCell(18 * w.w + 5);
  w.spawn(18 * w.w + 5, ID.BATTERY);
  run(w, 200);
  assert.equal(countOf(w, ID.WATER), 0);
  assert.equal(countOf(w, ID.DRAIN), 21, 'the drain itself is untouched');
});

test('a fan blows air away from the wall it is mounted on', () => {
  const w = makeWorld(60, 20, 13);
  fillRect(w, 20, 0, 20, 19, ID.WALL);
  fillRect(w, 21, 6, 21, 13, ID.FAN);
  w.spawn(5 * w.w + 21, ID.BATTERY);
  run(w, 60);
  const a = w.air.at(30, 10);
  assert.ok(w.air.cvx(a) > 0.5, `air moving right at ${w.air.cvx(a).toFixed(2)}`);
});
