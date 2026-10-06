// Painting tools (round and square brushes, single-cell brushes, boxes) and
// how hard flying particles hit what they land on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { makeWorld, fillRect, wallBox, countOf, run } from './helpers.js';
import { Input, TOOLS, HARD_BLOCKED } from '../src/game/input.js';
import { loadToolOptions, saveToolOptions, TOOL_OPTION_DEFAULTS } from '../src/game/tool-options.js';
import { cellNotes } from '../src/game/cell-notes.js';
import { PASS } from '../src/sim/walls.js';

test('a radius-0 brush paints one cell; square and round brushes cover their shapes', () => {
  const w = makeWorld(60, 40);
  w.paint(10, 10, 0, ID.STONE);
  assert.equal(countOf(w, ID.STONE), 1);

  w.brushShape = 'square';
  w.paint(30, 20, 3, ID.WOOD);
  assert.equal(countOf(w, ID.WOOD), 49, 'a 7 × 7 square');

  w.brushShape = 'circle';
  w.paint(50, 20, 3, ID.BRICK);
  const round = countOf(w, ID.BRICK);
  assert.ok(round > 25 && round < 49, `${round} cells in a round brush`);
});

test('a box fills every cell between its corners, whichever way it was dragged', () => {
  const w = makeWorld(60, 40);
  w.paintArea((fn) => w.forRect(40, 30, 10, 5, fn), ID.STONE, 1);
  assert.equal(countOf(w, ID.STONE), 31 * 26);
  w.eraseArea((fn) => w.forRect(10, 5, 20, 30, fn));
  assert.equal(countOf(w, ID.STONE), 20 * 26);
});

test('particles hit hard: they heat what stops them and kick up air pressure', () => {
  const hit = (p) => {
    const w = makeWorld(80, 20);
    fillRect(w, 40, 0, 44, 19, ID.STONE);
    for (let k = 0; k < 16; k++) w.spawnProjectile(p, 5.5, 2 + k + 0.5, 3, 0);
    let peak = 0;
    run(w, 25, () => { for (const v of w.air.p) peak = Math.max(peak, v); });
    // Heat spreads through the stone, so add up how much it gained in all.
    let heat = 0;
    for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.STONE) heat += w.temp[i] - 22;
    return { heat, peak };
  };
  // Protons fly through matter (they only carry heat); alpha particles stop dead.
  const photon = hit(ID.PHOTON), alpha = hit(ID.ALPHA);
  assert.ok(photon.heat > 16 * 100, `16 photons put ${photon.heat.toFixed(0)} °C of heat into the stone`);
  assert.ok(alpha.heat > 16 * 300 && alpha.peak > 2, `alpha particles: ${JSON.stringify(alpha)}`);
});

test('Replace paints over whatever is in the way; without it, only empty cells are painted', () => {
  const paint = (replace) => {
    const w = makeWorld(40, 40);
    fillRect(w, 15, 15, 24, 24, ID.WALL);
    fillRect(w, 10, 10, 29, 29, ID.SAND);
    w.replace = replace;
    w.paintArea((fn) => w.forRect(5, 5, 34, 34, fn), ID.STONE);
    return w;
  };
  const off = paint(false), on = paint(true);
  assert.equal(countOf(off, ID.SAND), 300, 'sand left alone');
  assert.equal(countOf(off, ID.WALL), 100, 'wall left alone');
  assert.equal(countOf(on, ID.SAND) + countOf(on, ID.WALL), 0, 'sand and wall replaced');
  assert.equal(countOf(on, ID.STONE), 30 * 30);
  // Painting an element over itself leaves it be (it keeps its temperature).
  const w = makeWorld(20, 20);
  fillRect(w, 5, 5, 9, 9, ID.STONE);
  w.temp[7 * 20 + 7] = 500;
  w.replace = true;
  w.paintArea((fn) => w.forRect(0, 0, 19, 19, fn), ID.STONE);
  assert.equal(w.temp[7 * 20 + 7], 500);
});

test('Mix shuffles everything under the brush but the walls, keeping every cell', () => {
  const w = makeWorld(40, 40);
  wallBox(w, 5, 5, 26, 26);
  fillRect(w, 6, 6, 25, 15, ID.SAND); // sand over water
  fillRect(w, 6, 16, 25, 25, ID.WATER);
  const walls = [];
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.WALL) walls.push(i);
  const sand = countOf(w, ID.SAND), water = countOf(w, ID.WATER);
  w.mixArea((fn) => w.forRect(5, 5, 26, 26, fn)); // the box, walls and all
  assert.equal(countOf(w, ID.SAND), sand);
  assert.equal(countOf(w, ID.WATER), water);
  assert.ok(walls.every((i) => w.type[i] === ID.WALL), 'the walls stay put');
  // One go already blends them: plenty of each in the other's half.
  let waterUp = 0, sandDown = 0;
  w.forRect(6, 6, 25, 15, (i) => { if (w.type[i] === ID.WATER) waterUp++; });
  w.forRect(6, 16, 25, 25, (i) => { if (w.type[i] === ID.SAND) sandDown++; });
  assert.ok(waterUp > water * 0.2, `${waterUp} water in the top half`);
  assert.ok(sandDown > sand * 0.2, `${sandDown} sand in the bottom half`);
});

test('Mix carries temperature with the cell it moves', () => {
  const w = makeWorld(20, 20);
  fillRect(w, 0, 0, 19, 9, ID.STONE);
  w.forRect(0, 0, 19, 9, (i) => { w.temp[i] = 500; });
  w.mixArea((fn) => w.forRect(0, 0, 19, 19, fn));
  for (let i = 0; i < w.type.length; i++) {
    if (w.type[i] === ID.STONE) assert.equal(w.temp[i], 500);
  }
});

test('the Spark tool works inside things, not just on their surface', () => {
  const inside = (t, frames = 20) => {
    const w = makeWorld(40, 40);
    const box = wallBox(w, 5, 5, 30, 30);
    fillRect(w, box.x0, box.y0, box.x1, box.y1, t);
    for (let f = 0; f < frames; f++) {
      w.sparkArea(w.brushArea(18, 18, 3));
      if (frames > 1) w.step();
    }
    return w;
  };
  // A box full of nitrogen, sparked in the middle, makes nitrogen dioxide...
  assert.ok(countOf(inside(ID.NITROGEN), ID.NITROGEN_DIOXIDE) > 10, 'nitrogen dioxide');
  // ...water splits...
  const water = inside(ID.WATER);
  assert.ok(countOf(water, ID.HYDROGEN) + countOf(water, ID.OXYGEN) > 10, 'hydrogen and oxygen');
  // ...metal carries a pulse from deep inside...
  assert.ok(countOf(inside(ID.METAL, 1), ID.SPARK) > 10, 'sparks in the metal');
  // ...and stone, which nothing electric happens to, is left alone.
  const stone = inside(ID.STONE);
  assert.equal(countOf(stone, ID.STONE), 24 * 24);
  assert.equal(countOf(stone, ID.SPARK), 0);
});

test('the Spark tool still puts sparks into empty space', () => {
  const w = makeWorld(40, 40);
  w.sparkArea(w.brushArea(20, 20, 2));
  assert.ok(countOf(w, ID.SPARK) > 5);
});

const stubCanvas = { addEventListener() {}, setPointerCapture() {} };
const inputFor = (w, sel, extra = {}) => new Input(stubCanvas, () => w,
  { selection: sel, brush: 0, brushShape: 'circle', replace: false, toolOptions: { ...TOOL_OPTION_DEFAULTS, ...extra } }, null);

test('the Portal and Time tools are in the grid, and hard mode keeps them', () => {
  assert.ok(TOOLS.includes('portal') && TOOLS.includes('time'));
  assert.ok(!HARD_BLOCKED.has('portal') && !HARD_BLOCKED.has('time'));
});

test('the Time tool paints the chosen speed; right-dragging sets it back', () => {
  const w = makeWorld(20, 20);
  const input = inputFor(w, { kind: 'tool', id: 'time' }, { timeSpeed: 4 });
  const area = (fn) => w.forRect(2, 2, 5, 5, fn);
  input.act(w, area, 0, 0, false);
  assert.equal(w.speed[3 * 20 + 3], 4);
  input.act(w, area, 0, 0, true);
  assert.equal(w.zoneCount, 0, 'right-drag resets, rather than erasing');
});

test('the Wall tool paints walls with the ticked boxes', () => {
  const w = makeWorld(20, 20);
  const input = inputFor(w, { kind: 'tool', id: 'wall' }, { wallMask: PASS.gas | PASS.heat });
  input.act(w, (fn) => fn(5 * 20 + 5, 5, 5), 0, 0, false);
  assert.equal(w.wall[5 * 20 + 5] & 255, PASS.gas | PASS.heat);
  assert.equal(w.wallMask, 0, 'the world is left painting plain walls');
});

test('tool options survive a save and load; bad storage gives the defaults', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  saveToolOptions({ wallMask: PASS.liquid, timeSpeed: 3 }, storage);
  assert.deepEqual(loadToolOptions(storage), { wallMask: PASS.liquid, timeSpeed: 3 });
  store.set('sandbox-crafter:tool-options', '{bad');
  assert.deepEqual(loadToolOptions(storage), TOOL_OPTION_DEFAULTS);
  assert.deepEqual(loadToolOptions(undefined), TOOL_OPTION_DEFAULTS);
});

test('the inspect line notes walls that let things through, time zones and portals', () => {
  const w = makeWorld(20, 20);
  w.wallMask = PASS.liquid | PASS.gas;
  w.spawn(5, ID.WALL);
  w.wallMask = 0;
  assert.deepEqual(cellNotes(w, 5), ['lets liquids, gases through']);
  w.paintSpeed((fn) => fn(6, 6, 0), 1);
  assert.deepEqual(cellNotes(w, 6), ['¼× speed']);
  w.addPortal(0, 10, 10, 10);
  assert.deepEqual(cellNotes(w, 10 * 20 + 3), ['Portal 1, blue end (draw the other end)']);
  w.addPortal(0, 15, 10, 15);
  assert.deepEqual(cellNotes(w, 15 * 20 + 3), ['Portal 1, orange end']);
});
