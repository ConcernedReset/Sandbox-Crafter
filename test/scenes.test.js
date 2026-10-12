// The World menu's ready-made worlds (scenes.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFS, ID, COLLECTIBLE } from '../src/sim/elements.js';
import { SCENES, loadScene } from '../src/game/scenes.js';
import { makeWorld, run, countOf } from './helpers.js';
import { CAMP_AWAY_R, MINE_R } from '../src/sim/humans.js';

const scene = (key, steps = 0) => {
  const w = makeWorld(400, 240, 9);
  loadScene(w, key);
  run(w, steps);
  return w;
};
const lit = (w, t) => {
  let n = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === t && w.life[i] > 0) n++;
  return n;
};

for (const { key, name } of SCENES) {
  test(`the ${name} world loads and runs`, () => {
    const w = scene(key, 200);
    let filled = 0;
    for (let i = 0; i < w.type.length; i++) if (w.type[i] !== 0) filled++;
    assert.ok(filled > 2000, `${filled} cells`);
  });
}

test('loading a world clears the last one, portals and time zones too', () => {
  const w = makeWorld(400, 240, 9);
  loadScene(w, 'lab');
  assert.ok(w.portalCells > 0 && w.zoneCount > 0);
  loadScene(w, 'start');
  assert.equal(w.portalCells, 0);
  assert.equal(w.zoneCount, 0);
});

test('showcase worlds discover nothing until the world is cleared', () => {
  const w = makeWorld(400, 240, 9);
  loadScene(w, 'creatures');
  run(w, 300);
  assert.equal(w.discoveries.length, 0, 'nothing in a showcase');
  w.clearAll();
  w.paint(200, 100, 5, ID.LAVA);
  w.paint(200, 110, 5, ID.WATER);
  run(w, 100);
  assert.ok(w.discoveries.length > 0, 'cleared, it counts again');
  loadScene(w, 'lab');
  const n = w.discoveries.length;
  run(w, 100);
  assert.equal(w.discoveries.length, n);
  loadScene(w, 'wilderness');
  assert.equal(w.recording, true, 'the wilderness is play');
});

test('the starting area has no Wall, and its pond never touches the dirt', () => {
  const w = scene('start');
  assert.equal(countOf(w, ID.WALL), 0);
  const { w: W, type } = w;
  for (let i = 0; i < type.length; i++) {
    if (type[i] !== ID.WATER) continue;
    for (const j of [i - 1, i + 1, i - W, i + W]) assert.notEqual(type[j], ID.DIRT, 'water beside dirt');
  }
  for (const t of ['SAND', 'WATER', 'DIRT']) assert.ok(countOf(w, ID[t]) > 100, t);
});

test('the wilderness has humans, with wood and stone within their reach', () => {
  const w = scene('wilderness', 20);
  const people = w.creatures.filter((e) => e.kind === ID.HUMAN);
  assert.equal(people.length, 3);
  const near = (t, e, r) => {
    for (let i = 0; i < w.type.length; i++) {
      if (w.type[i] === t && Math.abs((i % w.w) - e.x) <= r && Math.abs(((i / w.w) | 0) - e.y) <= r) return true;
    }
    return false;
  };
  for (const e of people) {
    assert.ok(near(ID.WOOD, e, 60), 'wood nearby');
    assert.ok(near(ID.STONE, e, 80), 'stone nearby');
  }
  assert.ok(countOf(w, ID.SAPLING) >= 8, 'saplings to grow a forest');
  assert.ok(w.creatures.some((e) => e.kind === ID.FISH), 'fish in the pond');
  run(w, 300);
  for (let i = 0; i < w.type.length; i++) {
    if (w.type[i] === ID.WATER) assert.ok(i % w.w >= 165 && i % w.w <= 235, 'the pond keeps its water');
  }
});

test('two tribes: three humans at each end, far apart, with wood, stone, coal, salt and metal in reach of each', () => {
  const w = scene('tribes', 20);
  const people = w.creatures.filter((e) => e.kind === ID.HUMAN);
  assert.equal(people.length, 6);
  const left = people.filter((e) => e.x < w.w / 2), right = people.filter((e) => e.x >= w.w / 2);
  assert.equal(left.length, 3);
  assert.equal(right.length, 3);
  assert.ok(Math.min(...right.map((e) => e.x)) - Math.max(...left.map((e) => e.x)) > CAMP_AWAY_R, 'too far apart to share a camp');
  const within = (t, side, r) => {
    let n = 0;
    const x0 = side.reduce((s, e) => s + e.x, 0) / side.length;
    for (let i = 0; i < w.type.length; i++) if (w.type[i] === t && Math.abs((i % w.w) - x0) <= r) n++;
    return n;
  };
  for (const side of [left, right]) {
    for (const [t, least] of [['STONE', 60], ['COAL', 150], ['SALT', 80], ['METAL', 150]]) {
      assert.ok(within(ID[t], side, MINE_R) >= least, `${t} near each tribe`);
    }
    assert.ok(within(ID.SAPLING, side, 100) + within(ID.WOOD, side, 100) > 5, 'trees to come');
  }
});

test('deep tribes: three humans at each end, the ground a third of the way down, a little dirt over deep stone, wavy ore veins and caves', () => {
  const w = scene('deep', 20);
  const people = w.creatures.filter((e) => e.kind === ID.HUMAN);
  assert.equal(people.filter((e) => e.x < w.w / 2).length, 3);
  assert.equal(people.filter((e) => e.x >= w.w / 2).length, 3);
  // The ground: its top in each column, dirt for a few rows, then stone.
  const top = (x) => {
    for (let y = 0; y < w.h; y++) if (w.type[y * w.w + x] === ID.GRASS) return y;
    return -1;
  };
  for (const x of [30, 120, 200, 280, 370]) {
    const g = top(x);
    assert.ok(g > w.h / 3 + 20 && g < w.h * 0.65, `the surface a third of the way down or more (${g} at ${x})`);
    assert.ok(g > 100, 'sky enough over it for a missile to clear the trees');
    assert.equal(w.type[(g + 10) * w.w + x], ID.DIRT, `dirt under it at ${x}`);
    assert.ok(w.h - g > 85, 'deep ground');
  }
  // Ore, the deeper the richer, each side within its reach.
  const depths = { COAL: [], SALT: [], METAL: [], COPPER: [] };
  let stone = 0, open = 0;
  for (let i = 0; i < w.type.length; i++) {
    const x = i % w.w, y = (i / w.w) | 0, g = top(x);
    if (g < 0) continue;
    const k = Object.keys(depths).find((t) => ID[t] === w.type[i]);
    if (k) depths[k].push(y - g);
    if (y > g + 25 && w.type[i] === ID.STONE) stone++;
    if (y > g + 40 && w.type[i] === 0) open++;
  }
  const mid = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  for (const [t, least] of [['COAL', 600], ['SALT', 400], ['METAL', 1000], ['COPPER', 1000]]) assert.ok(depths[t].length >= least, `plenty of ${t} (${depths[t].length})`);
  assert.ok(mid(depths.COAL) < mid(depths.SALT) && mid(depths.SALT) < mid(depths.METAL) && mid(depths.METAL) < mid(depths.COPPER), 'the deeper the richer');
  assert.ok(mid(depths.COPPER) - MINE_R < 0, 'still in mining reach');
  assert.ok(stone > 18000, `stone down below (${stone})`);
  assert.ok(open > 800, `open caves deep down (${open} cells)`);
  // Wavy, not ruled: the top of the first coal vein on the left goes up and down along it.
  const tops = new Set();
  for (let x = 20; x <= 50; x++) {
    const g = top(x);
    for (let y = g; y < w.h; y++) if (w.type[y * w.w + x] === ID.COAL) { tops.add(y - g); break; }
  }
  assert.ok(tops.size >= 4, `a wavy vein (its top at ${[...tops]} under the ground)`);
});

test('the creature world has every kind of creature', () => {
  const w = scene('creatures', 30);
  const kinds = new Set(w.creatures.map((e) => e.kind));
  for (const k of ['FISH', 'ELECTRIC_EEL', 'SQUID', 'JELLYFISH', 'BIRD', 'FROG', 'SNAIL', 'SPIDER', 'PHOENIX', 'HUMAN']) {
    assert.ok(kinds.has(ID[k]), `a ${k}`);
  }
  for (const k of ['PLANKTON', 'ANT', 'BEE', 'BUTTERFLY', 'FIREFLY', 'WORM', 'LOCUST']) assert.ok(countOf(w, ID[k]) > 0, `a ${k}`);
});

test('the element gallery has every element in it', () => {
  const w = scene('gallery');
  const there = new Set(w.type);
  for (let k = 0; k < w.pn; k++) there.add(w.ptype[k]);
  const missing = COLLECTIBLE.filter((d) => !there.has(d.id)).map((d) => d.name);
  assert.deepEqual(missing, []);
});

test('the machine world has every machine, and its lamps light', () => {
  const w = scene('machines');
  const there = new Set(w.type);
  const missing = DEFS.filter((d) => d.machine && d.key !== 'PISTON_ARM' && !there.has(d.id)).map((d) => d.name);
  assert.deepEqual(missing, []);
  run(w, 200);
  for (const k of ['LAMP', 'RED_LAMP', 'GREEN_LAMP', 'BLUE_LAMP']) assert.ok(lit(w, ID[k]) > 0, `${k} lit`);
});

test('the weapons range waits for its eight switches', () => {
  const w = scene('weapons', 100);
  assert.equal(countOf(w, ID.SWITCH), 8);
  for (const k of ['DYNAMITE', 'GUNPOWDER', 'NITRO', 'ANFO', 'THERMITE', 'NAPALM', 'GREEK_FIRE', 'FIREWORK', 'FLARE', 'SPARKLER']) {
    assert.ok(countOf(w, ID[k]) > 0, `${k} still there`);
  }
});
