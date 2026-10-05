// The machine overhaul: power with a direction, heaters with no limit, pipes
// and pumps, safety valves, conveyors, pistons, inverters, delay lines,
// sensors, igniters and neutron sources.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { World } from '../src/sim/world.js';
import { makeWorld, fillRect, wallBox, countOf, run } from './helpers.js';

// How many cells of element t are lit (powered, or on).
const lit = (w, t) => {
  let n = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === t && w.life[i] > 0) n++;
  return n;
};

// Paint the Spark tool onto (x, y) for one frame: flips a switch.
const flip = (w, x, y) => run(w, 1, () => w.paint(x, y, 0, ID.SPARK));

// Average x of every cell of element t.
const meanX = (w, t) => {
  let s = 0, n = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === t) { s += i % w.w; n++; }
  return n ? s / n : NaN;
};

// The average pressure over the inside of a box (from wallBox).
const meanPressure = (w, box) => {
  let s = 0, n = 0;
  for (let y = box.y0 + 1; y < box.y1; y += 4) {
    for (let x = box.x0 + 1; x < box.x1; x += 4) { s += w.pressureAt(x, y); n++; }
  }
  return s / n;
};

// Set the pressure of every air block inside a box.
const setPressure = (w, box, v) => {
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) w.air.p[w.air.at(x, y)] = v;
  }
};

test('power remembers where it came from and which way it was going', () => {
  const w = makeWorld(20, 10);
  w.spawn(5 * 20 + 3, ID.BATTERY);
  fillRect(w, 4, 5, 8, 5, ID.LAMP);
  run(w, 3);
  for (let x = 4; x <= 8; x++) {
    assert.equal(w.powerFrom[5 * 20 + x], 5 * 20 + 3, `lamp at x ${x}`);
    assert.equal(w.powerDir[5 * 20 + x], 0, 'travelling right');
  }
});

test('a heater heats faster the longer it is on, with no limit', () => {
  const w = makeWorld(20, 10, 9);
  const at = 5 * 20 + 6;
  w.spawn(at, ID.HEATER);
  let early = 0;
  run(w, 1200, (f) => {
    w.powerCell(at, at);
    if (f === 300) early = w.temp[at];
  });
  const T = w.temp[at];
  assert.ok(T > 20000, `${T.toFixed(0)} °C after 20 s`);
  assert.ok(T - early > early, `it keeps speeding up (${early.toFixed(0)} at 5 s)`);
});

test('a cooler chills all the way to absolute zero', () => {
  const w = makeWorld(20, 10, 9);
  const at = 5 * 20 + 6;
  w.spawn(at, ID.COOLER);
  run(w, 300, () => w.powerCell(at, at));
  assert.ok(w.temp[at] < -270, `${w.temp[at].toFixed(1)} °C`);
});

test('a fan still blows a puff of smoke well clear of it in the thick air', () => {
  const w = makeWorld(80, 20, 13);
  fillRect(w, 10, 0, 10, 19, ID.WALL);
  fillRect(w, 11, 6, 11, 13, ID.FAN);
  w.spawn(5 * w.w + 11, ID.BATTERY);
  fillRect(w, 13, 7, 16, 12, ID.SMOKE);
  run(w, 120);
  assert.ok(countOf(w, ID.SMOKE) > 0, 'some smoke is left');
  assert.ok(meanX(w, ID.SMOKE) > 30, `smoke at x ${meanX(w, ID.SMOKE).toFixed(1)}`);
});

// Two sealed boxes side by side, with a pipe through both walls joining them
// (or not).
function twoBoxes(pipe) {
  const w = new World(100, 40, 5);
  const left = wallBox(w, 2, 2, 47, 37), right = wallBox(w, 52, 2, 97, 37);
  if (pipe) {
    for (let x = 40; x <= 59; x++) { w.clearCell(20 * 100 + x); w.spawn(20 * 100 + x, ID.PIPE); }
  }
  setPressure(w, left, 40);
  run(w, 600);
  return { left: meanPressure(w, left), right: meanPressure(w, right) };
}

test('a pipe through a wall evens out the pressure on either side', () => {
  const shut = twoBoxes(false), piped = twoBoxes(true);
  assert.ok(shut.right < 1, `no pipe: ${shut.right.toFixed(1)} on the right`);
  assert.ok(piped.right > 10, `piped: ${piped.right.toFixed(1)} on the right`);
  assert.ok(piped.left < 30, `and ${piped.left.toFixed(1)} left on the left`);
});

test('a pump fills a sealed box through a pipe, and does nothing unpowered', () => {
  const w = new World(100, 40, 5);
  const box = wallBox(w, 52, 2, 97, 37);
  for (let x = 31; x <= 59; x++) { w.clearCell(20 * 100 + x); w.spawn(20 * 100 + x, ID.PIPE); }
  w.spawn(20 * 100 + 30, ID.PUMP);
  run(w, 200);
  assert.ok(Math.abs(meanPressure(w, box)) < 1, 'unpowered: nothing');
  w.spawn(19 * 100 + 30, ID.BATTERY);
  run(w, 300);
  assert.ok(meanPressure(w, box) > 10, `powered: ${meanPressure(w, box).toFixed(1)} in the box`);
});

test('a safety valve holds below +30, opens above it, and shuts again once the pressure drops', () => {
  const w = new World(60, 40, 5);
  const box = wallBox(w, 10, 10, 49, 29);
  for (let y = 18; y <= 21; y++) { w.clearCell(y * 60 + 49); w.spawn(y * 60 + 49, ID.VALVE); }
  setPressure(w, box, 20);
  run(w, 30);
  assert.equal(countOf(w, ID.VALVE), 4, 'shut at +20');
  assert.ok(meanPressure(w, box) > 15, 'and holding');
  setPressure(w, box, 60);
  run(w, 10);
  assert.ok(countOf(w, ID.VALVE) < 4, 'open at +60');
  run(w, 600);
  assert.equal(countOf(w, ID.VALVE), 4, 'shut again');
  assert.ok(meanPressure(w, box) < 15, `vented to ${meanPressure(w, box).toFixed(1)}`);
});

test('a conveyor carries sand away from the end it is powered from, either way', () => {
  const ride = (batteryX) => {
    const w = makeWorld(60, 20, 7);
    fillRect(w, 10, 15, 49, 15, ID.CONVEYOR);
    if (batteryX >= 0) w.spawn(15 * 60 + batteryX, ID.BATTERY);
    fillRect(w, 28, 12, 31, 14, ID.SAND);
    const x0 = meanX(w, ID.SAND);
    run(w, 60);
    return meanX(w, ID.SAND) - x0;
  };
  assert.ok(Math.abs(ride(-1)) < 1, 'unpowered, the sand sits still');
  assert.ok(ride(9) > 8, `powered from the left it goes right (${ride(9).toFixed(1)})`);
  assert.ok(ride(50) < -8, `powered from the right it goes left (${ride(50).toFixed(1)})`);
});

// A switch, a wire, a piston at x 10 on a floor, and whatever `build` adds.
function pistonRig(build) {
  const w = makeWorld(60, 20, 7);
  fillRect(w, 0, 19, 59, 19, ID.WALL);
  w.spawn(18 * 60 + 2, ID.SWITCH);
  fillRect(w, 3, 18, 9, 18, ID.METAL);
  w.spawn(18 * 60 + 10, ID.PISTON);
  build(w);
  return w;
}
const leftmost = (w, t) => {
  let m = Infinity;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === t) m = Math.min(m, i % w.w);
  return m;
};

test('a piston pushes away from its power and pulls its arm back when switched off', () => {
  const w = pistonRig((w) => fillRect(w, 11, 18, 14, 18, ID.STONE));
  flip(w, 2, 18);
  run(w, 40);
  assert.equal(countOf(w, ID.PISTON_ARM), 8, 'the arm is out');
  assert.ok(leftmost(w, ID.STONE) >= 19, `stone pushed to x ${leftmost(w, ID.STONE)}`);
  flip(w, 2, 18);
  run(w, 80);
  assert.equal(countOf(w, ID.PISTON_ARM), 0, 'the arm is back');
  assert.ok(leftmost(w, ID.STONE) >= 19, 'and the stone stays where it was pushed');
});

test('a piston can\'t push a wall', () => {
  const w = pistonRig((w) => w.spawn(18 * 60 + 13, ID.WALL));
  flip(w, 2, 18);
  run(w, 40);
  assert.equal(countOf(w, ID.PISTON_ARM), 2, 'the arm stops at the wall');
});

test('an inverter lights a lamp while its switch is off, and its own output doesn\'t switch it off', () => {
  const w = makeWorld(60, 20, 11);
  w.spawn(10 * 60 + 2, ID.SWITCH);
  fillRect(w, 3, 10, 19, 10, ID.METAL);
  w.spawn(10 * 60 + 20, ID.INVERTER);
  fillRect(w, 21, 10, 29, 10, ID.COPPER);
  fillRect(w, 30, 8, 34, 12, ID.LAMP);
  run(w, 60);
  assert.equal(lit(w, ID.LAMP), 25, 'lit while the switch is off');
  flip(w, 2, 10);
  run(w, 80);
  assert.equal(lit(w, ID.LAMP), 0, 'dark while the switch is on');
  flip(w, 2, 10);
  run(w, 100);
  assert.equal(lit(w, ID.LAMP), 25, 'lit again');
});

test('a delay line of 10 cells lights a lamp about 40 frames after the switch', () => {
  const w = makeWorld(60, 20, 11);
  w.spawn(10 * 60 + 2, ID.SWITCH);
  fillRect(w, 3, 10, 5, 10, ID.METAL);
  fillRect(w, 6, 10, 15, 10, ID.DELAY);
  w.spawn(10 * 60 + 16, ID.LAMP);
  run(w, 30);
  assert.equal(lit(w, ID.LAMP), 0);
  flip(w, 2, 10);
  let on = -1;
  run(w, 100, (f) => { if (on < 0 && lit(w, ID.LAMP) > 0) on = f; });
  assert.ok(on >= 35 && on <= 60, `lit after ${on} frames`);
});

// A sensor at (10, 10) with a lamp touching it.
function sensorRig(t) {
  const w = makeWorld(40, 20, 3);
  w.spawn(10 * 40 + 10, t);
  w.spawn(10 * 40 + 11, ID.LAMP);
  return w;
}

test('a barometer switches on while the pressure beside it is high', () => {
  const w = sensorRig(ID.BAROMETER);
  run(w, 20);
  assert.equal(lit(w, ID.LAMP), 0, 'off in still air');
  const a = w.air.at(10, 10);
  run(w, 10, () => { for (const b of [a, a - 1, a + 1]) w.air.p[b] = 12; });
  assert.equal(lit(w, ID.LAMP), 1, 'on at +12');
});

test('a smoke detector switches on while smoke touches it', () => {
  const w = sensorRig(ID.SMOKE_DETECTOR);
  run(w, 20);
  assert.equal(lit(w, ID.LAMP), 0, 'off in clean air');
  run(w, 5, () => { if (w.type[9 * 40 + 10] === 0) w.spawn(9 * 40 + 10, ID.SMOKE); });
  assert.equal(lit(w, ID.LAMP), 1, 'on with smoke');
});

test('a wind turbine switches on while the wind blows', () => {
  const w = sensorRig(ID.WIND_TURBINE);
  run(w, 20);
  assert.equal(lit(w, ID.LAMP), 0, 'off in still air');
  run(w, 10, () => w.blow(10, 10, 6, 1.5, 0));
  assert.equal(lit(w, ID.LAMP), 1, 'on in the wind');
});

test('an igniter sets wood alight only while powered', () => {
  const burnt = (powered) => {
    const w = makeWorld(40, 20, 3);
    fillRect(w, 12, 5, 20, 15, ID.WOOD);
    w.spawn(10 * 40 + 11, ID.IGNITER);
    if (powered) w.spawn(10 * 40 + 10, ID.BATTERY);
    const wood = countOf(w, ID.WOOD);
    run(w, 200);
    return wood - countOf(w, ID.WOOD);
  };
  assert.equal(burnt(false), 0, 'nothing unpowered');
  assert.ok(burnt(true) > 5, `${burnt(true)} wood burnt`);
});

test('a neutron source starts a uranium pile, only while powered', () => {
  const split = (powered) => {
    const w = new World(120, 60, 7);
    fillRect(w, 40, 20, 79, 59, ID.URANIUM);
    // One cell short of the pile, so its right face is open towards it.
    w.spawn(40 * 120 + 38, ID.NEUTRON_SOURCE);
    if (powered) w.spawn(40 * 120 + 37, ID.BATTERY);
    const u = countOf(w, ID.URANIUM);
    run(w, 300);
    return u - countOf(w, ID.URANIUM);
  };
  assert.ok(split(false) < 3, 'barely anything unpowered');
  assert.ok(split(true) > 10, `${split(true)} uranium split`);
});
