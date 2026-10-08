// Shaped creatures: bodies several cells big that grow, get hurt pixel by
// pixel, heal and die (creatures.js, shapes.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFS, ID } from '../src/sim/elements.js';
import { compileShape } from '../src/sim/shapes.js';
import { makeWorld, fillRect, run, countOf, wallBox } from './helpers.js';
import { GROW_GIVE_UP, HEAL_AFTER, NEWBORN_GRACE } from '../src/sim/creatures.js';
import { cellNotes } from '../src/game/cell-notes.js';

test('a shape compiles to pixel offsets from the middle of its bottom row', () => {
  const s = compileShape({
    frames: [['a.a', '.b.'], ['...', 'aba']],
    palette: { a: ['#ff0000', '#00ff00'], b: ['#0000ff'] },
  }, 'TEST');
  assert.equal(s.n, 3);
  assert.deepEqual([...s.frames[0].dx], [-1, 1, 0]);
  assert.deepEqual([...s.frames[0].dy], [-1, -1, 0]);
  assert.deepEqual([...s.frames[1].dx], [-1, 0, 1]);
  assert.deepEqual([...s.frames[1].letter], [0, 1, 0]);
  assert.deepEqual(s.base, [0, 2]);
  assert.deepEqual(s.options, [2, 1]);
  assert.equal(s.colors.length, 32);
  assert.deepEqual(s.colors[2], [0, 0, 255]);
  assert.deepEqual(s.colors[3], [255, 0, 0], 'the 32 slots repeat the colours');
  assert.throws(() => compileShape({ frames: [['aa'], ['a.']], palette: { a: ['#000000'] } }, 'BAD'),
    /different numbers of pixels/);
});

test('creatures live three times as long as they used to', () => {
  assert.deepEqual([DEFS[ID.ANT].lifeMin, DEFS[ID.ANT].lifeMax], [6000, 9000]);
  assert.deepEqual([DEFS[ID.FISH].lifeMin, DEFS[ID.FISH].lifeMax], [6000, 9000]);
  assert.deepEqual([DEFS[ID.TARDIGRADE].lifeMin, DEFS[ID.TARDIGRADE].lifeMax], [9000, 11700]);
});

// A floor of stone along the bottom two rows.
function floored(w = 40, h = 30) {
  const world = makeWorld(w, h);
  fillRect(world, 0, h - 2, w - 1, h - 1, ID.STONE);
  return world;
}

// The one creature of kind t in the world.
const only = (w, t) => {
  const all = w.creatures.filter((e) => e.kind === t);
  assert.equal(all.length, 1, `one ${DEFS[t].name}`);
  return all[0];
};

test('a seed grows into a whole body, ring by ring outward', () => {
  const w = floored();
  w.spawn(10 * 40 + 20, ID.HUMAN);
  const counts = [];
  for (let k = 0; k < 8; k++) { w.step(); counts.push(countOf(w, ID.HUMAN)); }
  assert.equal(counts[0], 1, 'the seed hatches first');
  assert.equal(counts.at(-1), DEFS[ID.HUMAN].shape.n, 'then the whole body is there');
  for (let k = 1; k < counts.length; k++) assert.ok(counts[k] >= counts[k - 1], `never shrinks: ${counts}`);
});

test('a seed with no room for a body waits, then is gone', () => {
  const w = makeWorld(20, 20);
  fillRect(w, 0, 0, 19, 19, ID.STONE);
  const i = 10 * 20 + 10;
  w.clearCell(i);
  w.spawn(i, ID.SNAIL);
  run(w, GROW_GIVE_UP - 5);
  assert.equal(w.type[i], ID.SNAIL, 'still waiting');
  run(w, 10);
  assert.equal(w.type[i], 0, 'gave up');
  assert.equal(w.creatures.length, 0);
});

test('a body falls as one, and sand piles up on top of it', () => {
  const w = floored();
  w.spawn(5 * 40 + 20, ID.SNAIL);
  run(w, 60);
  const e = only(w, ID.SNAIL);
  assert.equal(e.y, 27, 'standing on the floor');
  assert.equal(countOf(w, ID.SNAIL), 5);
  fillRect(w, 17, 20, 23, 22, ID.SAND);
  run(w, 80);
  assert.equal(e.y, 27, 'not pushed into the floor');
  assert.equal(countOf(w, ID.SNAIL), 5, 'not crushed');
  assert.equal(w.type[25 * 40 + 20], ID.SAND, 'sand resting on its back');
});

test('lost pixels are damage; half the body lost is death, which leaves its remains', () => {
  const w = floored();
  w.spawn(27 * 40 + 20, ID.SNAIL);
  run(w, 10);
  const e = only(w, ID.SNAIL);
  w.clearCell(e.cells[0]);
  w.step();
  assert.equal(e.lost, 1, 'one pixel damaged');
  assert.equal(w.creatureById[e.id], e, 'still alive');
  w.clearCell(e.cells[1]);
  w.clearCell(e.cells[2]);
  w.step();
  assert.equal(w.creatureById[e.id], null, 'dead');
  assert.equal(countOf(w, ID.SNAIL), 0);
  assert.equal(countOf(w, ID.SEASHELL), 2, 'the two pixels left are its shell');
});

test('heat hurts only the pixels that are too hot, and a hurt creature heals', () => {
  const w = floored();
  w.spawn(27 * 40 + 20, ID.SNAIL);
  run(w, 10 + NEWBORN_GRACE);
  const e = only(w, ID.SNAIL);
  w.temp[e.cells[4]] = 200;
  w.step();
  assert.equal(e.lost, 1, 'only the hot pixel');
  run(w, HEAL_AFTER + 2);
  assert.equal(e.lost, 0, 'healed');
  assert.equal(countOf(w, ID.SNAIL), 5);
});

test('a creature that dies of heat leaves ash', () => {
  const w = floored();
  w.spawn(27 * 40 + 20, ID.SNAIL);
  run(w, 10 + NEWBORN_GRACE);
  const e = only(w, ID.SNAIL);
  for (const p of [0, 1, 2]) w.temp[e.cells[p]] = 300;
  w.step();
  assert.equal(w.creatureById[e.id], null);
  assert.equal(countOf(w, ID.ASH), 2);
});

test('a bird turned into a phoenix becomes one whole', () => {
  const w = floored();
  w.spawn(27 * 40 + 20, ID.BIRD);
  run(w, 10);
  const e = only(w, ID.BIRD);
  w.convert(e.cells[0], ID.PHOENIX, false, -1); // what Bird + Fire does to a cell
  run(w, 12);
  assert.equal(countOf(w, ID.BIRD), 0);
  assert.equal(only(w, ID.PHOENIX).lost, 0);
  assert.equal(countOf(w, ID.PHOENIX), DEFS[ID.PHOENIX].shape.n);
});

test('clearing the world clears its creatures', () => {
  const w = floored();
  w.spawn(27 * 40 + 20, ID.SNAIL);
  run(w, 10);
  w.clearAll();
  assert.equal(w.creatures.length, 0);
});

test('fish swim about in water and stay in it', () => {
  const w = makeWorld(60, 40);
  const box = wallBox(w, 0, 0, 59, 39);
  fillRect(w, box.x0, 10, box.x1, box.y1, ID.WATER);
  for (let k = 0; k < 4; k++) w.spawn(25 * 60 + 8 + k * 12, ID.FISH);
  run(w, 20);
  const start = w.creatures.map((e) => e.x);
  run(w, 300);
  assert.equal(w.creatures.length, 4);
  assert.ok(w.creatures.some((e, k) => e.x !== start[k]), 'they moved');
  for (const e of w.creatures) {
    assert.equal(e.lost, 0);
    for (const c of e.cells) assert.ok(((c / 60) | 0) >= 10, 'never above the water');
  }
});

test('a bird flaps about in the air', () => {
  const w = floored(60, 40);
  w.spawn(15 * 60 + 30, ID.BIRD);
  const frames = new Set();
  let airborne = 0;
  run(w, 300, () => {
    const e = w.creatures[0];
    if (!e) return;
    frames.add(e.frame);
    if (e.y < 36) airborne++;
  });
  assert.deepEqual([...frames].sort(), [0, 1], 'wings up and down');
  assert.ok(airborne > 150, 'mostly off the ground');
});

test('a snail walks along the ground and climbs a step', () => {
  const w = floored(60, 30);
  fillRect(w, 40, 27, 59, 27, ID.STONE); // a step up
  w.spawn(27 * 60 + 30, ID.SNAIL);
  run(w, 10);
  const e = only(w, ID.SNAIL);
  w.moveBody(e, e.x, e.y, 0, 1, e.gx, e.gy); // facing the step
  let up = false;
  run(w, 3000, () => { if (e.y === 26) up = true; });
  assert.ok(up, 'it got up the step');
});

test('a fish out of water loses pixels until it dies', () => {
  const w = floored(40, 20);
  w.spawn(17 * 40 + 20, ID.FISH);
  run(w, 400);
  assert.equal(countOf(w, ID.FISH), 0);
  assert.ok(countOf(w, ID.BONE) + countOf(w, ID.MEAT) > 0);
});

test('painting a shaped creature puts down seeds a body apart', () => {
  const w = makeWorld(60, 40);
  w.paint(30, 20, 10, ID.SNAIL);
  const seeds = [];
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.SNAIL) seeds.push([i % 60, (i / 60) | 0]);
  assert.ok(seeds.length >= 4, `${seeds.length} seeds`);
  for (const [ax, ay] of seeds) {
    for (const [bx, by] of seeds) {
      if (ax === bx && ay === by) continue;
      assert.ok(Math.abs(ax - bx) > 3 || Math.abs(ay - by) > 2, 'spaced apart');
    }
  }
  w.step();
  assert.equal(w.creatures.length, seeds.length, 'every one hatched');
});

test('a conveyor carries a creature along whole', () => {
  const ride = (powered) => {
    const w = makeWorld(60, 20, 7);
    fillRect(w, 10, 15, 49, 15, ID.CONVEYOR);
    if (powered) w.spawn(15 * 60 + 9, ID.BATTERY);
    w.spawn(14 * 60 + 25, ID.SNAIL);
    run(w, 10);
    const e = w.creatures[0];
    const x0 = e.x;
    run(w, 60);
    assert.equal(e.lost, 0, 'in one piece');
    return e.x - x0;
  };
  assert.ok(ride(true) > 10, 'carried along');
  assert.ok(Math.abs(ride(false)) < 6, 'left be when the belt is off');
});

test('a creature falling onto a portal comes out of the other end', () => {
  const w = makeWorld(60, 60);
  w.addPortal(20, 50, 40, 50);
  w.addPortal(20, 5, 40, 5);
  w.spawn(40 * 60 + 30, ID.SNAIL);
  let top = false;
  run(w, 200, () => { const e = w.creatures[0]; if (e && e.y < 20) top = true; });
  assert.ok(top, 'it came out under the ceiling');
  assert.equal(w.creatures[0].lost, 0);
});

test('a blast hurts and throws a creature', () => {
  const w = floored();
  w.spawn(27 * 40 + 20, ID.SNAIL);
  run(w, 10);
  const e = only(w, ID.SNAIL);
  w.blast(e.x + 1, e.y - 1, 12);
  w.step();
  assert.ok(w.creatureById[e.id] !== e || e.lost > 0, 'hurt (or killed)');
});

test('a creature in a quarter-speed zone ages a quarter as fast', () => {
  const w = floored();
  w.spawn(27 * 40 + 20, ID.SNAIL);
  run(w, 10);
  const e = only(w, ID.SNAIL);
  w.paintSpeed((fn) => w.forRect(0, 0, 39, 29, fn), 1);
  const a0 = e.age;
  run(w, 80);
  assert.ok(Math.abs(e.age - a0 - 20) <= 1, `aged ${e.age - a0}`);
});

test('the inspect line shows a creature\'s health, and a human\'s job', () => {
  const w = floored();
  w.spawn(27 * 40 + 10, ID.SNAIL);
  w.spawn(20 * 40 + 30, ID.HUMAN);
  run(w, 30);
  const snail = only(w, ID.SNAIL), person = only(w, ID.HUMAN);
  w.clearCell(snail.cells[0]);
  w.step();
  assert.ok(cellNotes(w, snail.cells.find((c) => c >= 0)).includes('health 4 of 5'));
  const notes = cellNotes(w, person.cells.find((c) => c >= 0));
  assert.ok(notes.includes('health 10 of 10'));
  assert.ok(notes.includes(person.brain.job), notes.join(' · '));
});
