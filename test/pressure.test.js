// Pressure tearing solids apart: weak materials go first, heat weakens
// everything, and debris flies and falls.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { World } from '../src/sim/world.js';
import { makeWorld, fillRect, wallBox, run } from './helpers.js';

const intact = (w, t) => {
  let n = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === t && !w.loose[i]) n++;
  return n;
};
const looseOf = (w, t) => {
  let n = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === t && w.loose[i]) n++;
  return n;
};

// Set off a charge by putting a spark on top of every column of it.
function detonate(w, charge, x0, x1) {
  for (let x = x0; x <= x1; x++) {
    for (let y = 1; y < w.h; y++) {
      const i = y * w.w + x;
      if (w.type[i] === charge) {
        if (w.type[i - w.w] === 0) w.spawn(i - w.w, ID.SPARK);
        break;
      }
    }
  }
}

// Hold a sealed box at a fixed pressure while the world runs.
function holdPressure(w, box, p, frames, each) {
  run(w, frames, () => {
    for (let y = box.y0; y <= box.y1; y++) {
      for (let x = box.x0; x <= box.x1; x++) w.air.p[w.air.at(x, y)] = p;
    }
    if (each) each();
  });
}

test('a gunpowder blast shreds wood, chips stone and leaves metal standing', () => {
  const lost = (wallType) => {
    const w = new World(200, 100, 3);
    fillRect(w, 0, 95, 199, 99, ID.WALL);
    fillRect(w, 80, 55, 85, 94, wallType);
    fillRect(w, 114, 55, 119, 94, ID.METAL);
    fillRect(w, 92, 77, 107, 94, ID.GUNPOWDER);
    run(w, 40);
    const before = [intact(w, wallType), intact(w, ID.METAL)];
    detonate(w, ID.GUNPOWDER, 92, 107);
    run(w, 150);
    return [before[0] - intact(w, wallType), before[1] - intact(w, ID.METAL)];
  };
  const [wood, metalA] = lost(ID.WOOD);
  const [stone, metalB] = lost(ID.STONE);
  assert.ok(wood > 200, `wood wall lost ${wood}/240`);
  assert.ok(stone > 20 && stone < wood, `stone wall lost ${stone}/240`);
  assert.equal(metalA + metalB, 0, 'metal wall untouched');
});

test('nothing tears below its strength, and only exposed surfaces tear', () => {
  const w = makeWorld(80, 50);
  const box = wallBox(w, 5, 5, 74, 49);
  fillRect(w, 30, 30, 49, box.y1, ID.METAL);
  holdPressure(w, box, 140, 200); // metal's strength is 150
  assert.equal(looseOf(w, ID.METAL), 0);
  holdPressure(w, box, 200, 1);
  const torn = looseOf(w, ID.METAL);
  assert.ok(torn > 0, 'past its strength the surface starts to go');
  // In one frame only the outer layer can go: 20 on top and 20 up each side.
  assert.ok(torn <= 20 + 2 * 20, `${torn} torn, more than the exposed surface`);
  holdPressure(w, box, 200, 200);
  assert.ok(looseOf(w, ID.METAL) > torn, 'as debris falls away, the layers behind it go too');
});

test('heat weakens metal: a blast that cold metal shrugs off tears hot metal', () => {
  const torn = (metalTemp) => {
    const w = new World(240, 120, 5);
    fillRect(w, 0, 115, 239, 119, ID.WALL);
    fillRect(w, 140, 60, 147, 114, ID.METAL);
    fillRect(w, 125, 103, 137, 114, ID.GUNPOWDER);
    run(w, 40);
    detonate(w, ID.GUNPOWDER, 125, 137);
    run(w, 150, () => {
      for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.METAL) w.temp[i] = metalTemp;
    });
    return looseOf(w, ID.METAL);
  };
  assert.equal(torn(22), 0, 'cold metal holds');
  assert.ok(torn(1000) > 0, 'metal at 1000 °C gives way');
});

test('hot wood tears at a pressure cold wood ignores', () => {
  const torn = (temp) => {
    const w = makeWorld(60, 40);
    const box = wallBox(w, 5, 5, 54, 39);
    fillRect(w, 20, 25, 39, box.y1, ID.WOOD);
    holdPressure(w, box, 8, 100, () => {
      for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.WOOD) w.temp[i] = temp;
    });
    return looseOf(w, ID.WOOD);
  };
  assert.equal(torn(22), 0);
  assert.ok(torn(200) > 50);
});

test('torn-off debris falls and piles up on the floor', () => {
  const w = makeWorld(80, 60);
  const box = wallBox(w, 5, 5, 74, 59);
  fillRect(w, 30, 10, 49, 20, ID.METAL); // a slab hanging in mid-air
  holdPressure(w, box, 230, 40);
  const torn = looseOf(w, ID.METAL);
  assert.ok(torn > 20, `${torn} pieces torn off`);
  run(w, 300); // pressure left to settle
  let lowest = 0, onFloor = 0;
  for (let i = 0; i < w.type.length; i++) {
    if (w.type[i] === ID.METAL && w.loose[i]) {
      const y = (i / w.w) | 0;
      lowest = Math.max(lowest, y);
      if (y > 50) onFloor++;
    }
  }
  assert.ok(lowest === box.y1 && onFloor > torn / 2, `${onFloor} of ${torn} pieces reached the floor`);
});

// A hollow box of `material`, walls `t` thick, standing on a wall floor.
function vessel(w, material, x0, y0, x1, y1, t) {
  fillRect(w, 0, y1 + 1, w.w - 1, w.h - 1, ID.WALL);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const inside = x >= x0 + t && x <= x1 - t && y >= y0 + t && y <= y1 - t;
      if (!inside) w.spawn(y * w.w + x, material);
    }
  }
  return { cx: (x0 + x1) >> 1, cy: (y0 + y1) >> 1 };
}

test('strong solids hold air in, even a one-cell skin; wood leaks', () => {
  const pumped = (material, t, spark) => {
    const w = new World(100, 70, 4);
    const { cx, cy } = vessel(w, material, 30, 20, 70, 60, t);
    if (spark) w.paint(30, 20, 1, ID.SPARK);
    run(w, 300, (f) => {
      w.pressurize(cx, cy, 5, 2);
      if (spark && f % 20 === 0) w.paint(30, 20, 1, ID.SPARK);
    });
    return w.pressureAt(cx, cy);
  };
  const steel = pumped(ID.STEEL, 6);
  assert.ok(steel > 100, `steel box holds ${steel.toFixed(0)}`);
  assert.ok(pumped(ID.STEEL, 6, true) > 100, 'current running through the steel does not open it');
  assert.ok(pumped(ID.WOOD, 6) < 20, 'wood lets the air through');
  assert.ok(pumped(ID.STEEL, 1) > 50, 'an unbroken line of steel seals like Wall');
});

test('a sealed vessel holds until the pressure passes its strength, then bursts', () => {
  const w = new World(100, 70, 4);
  const box = { x0: 30, y0: 20, x1: 70, y1: 60 };
  const { cx, cy } = vessel(w, ID.METAL, box.x0, box.y0, box.x1, box.y1, 6);
  let peak = 0, burst = -1;
  run(w, 1500, (f) => {
    if (burst < 0) w.pressurize(cx, cy, 5, 2);
    const p = w.pressureAt(cx, cy);
    if (p > peak) peak = p;
    if (burst < 0 && peak > 100 && p < peak / 2) burst = f;
  });
  assert.ok(burst > 0, 'the vessel gave way');
  // Metal's strength is 150: it held well past a hundred, and not much past its strength.
  assert.ok(peak > 120 && peak < 200, `peaked at ${peak.toFixed(0)}`);
  assert.ok(Math.abs(w.pressureAt(cx, cy)) < 30, 'the pressure escaped');
  let thrown = 0;
  for (let i = 0; i < w.type.length; i++) {
    if (w.type[i] !== ID.METAL || !w.loose[i]) continue;
    const x = i % w.w, y = (i / w.w) | 0;
    if (x < box.x0 - 3 || x > box.x1 + 3 || y < box.y0 - 3) thrown++;
  }
  assert.ok(thrown > 10, `${thrown} fragments thrown clear of the vessel`);
});

test('a charge sealed in a steel shell bursts it open and flings the fragments', () => {
  const w = new World(200, 110, 8);
  fillRect(w, 0, 105, 199, 109, ID.WALL);
  const t = 3, x0 = 95, x1 = 104, y1 = 104 - t, y0 = y1 - 9;
  fillRect(w, x0 - t, y0 - t, x1 + t, 104, ID.STEEL);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) w.clearCell(y * w.w + x);
  fillRect(w, x0, y0, x1, y1, ID.C4);
  run(w, 5);
  const before = intact(w, ID.STEEL);
  w.paint(x0 - t, y0 - t, 1, ID.SPARK); // the spark runs through the steel into the charge
  let farthest = 0;
  run(w, 200, () => {
    for (let i = 0; i < w.type.length; i++) {
      if (w.type[i] === ID.STEEL && w.loose[i]) {
        const d = Math.hypot(i % w.w - 100, ((i / w.w) | 0) - (y0 + y1) / 2);
        if (d > farthest) farthest = d;
      }
    }
  });
  assert.ok(before - intact(w, ID.STEEL) > 15, `${before - intact(w, ID.STEEL)} shell cells torn`);
  assert.ok(farthest > 40, `fragments flew ${farthest.toFixed(0)} cells`);
});
