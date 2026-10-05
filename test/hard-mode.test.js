// Hard mode: the heat, cool, wind, pressure and vacuum tools are off, and the
// recipe tree shows what to make next rather than what you've made.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFS, ID, RULES, COLLECTIBLE, STARTERS } from '../src/sim/elements.js';
import { buildTree, focusTree, processName, clue } from '../src/game/tree.js';
import { Input, TOOLS, HARD_BLOCKED } from '../src/game/input.js';
import { Progress } from '../src/game/progress.js';
import { makeWorld, fillRect } from './helpers.js';

const starters = new Set(STARTERS.map((k) => ID[k]));
const fresh = (hard) => buildTree({ known: (id) => starters.has(id), hard });
const face = (t, id) => t.nodes.find((n) => n.id === id)?.face;

test('normally found elements show their names and the next ones a ?', () => {
  const t = fresh(false);
  for (const n of t.nodes) assert.equal(n.face, n.known ? 'name' : '?', DEFS[n.id].name);
});

test('in hard mode found elements are blank and the next ones show their names', () => {
  const t = fresh(true);
  assert.ok(t.nodes.some((n) => !n.known), 'something to make');
  for (const n of t.nodes) assert.equal(n.face, n.known ? 'blank' : 'name', DEFS[n.id].name);
  // Each thing to make says how it's made, in one word, but not from what.
  for (const l of t.links) assert.equal(l.label, processName(RULES[l.rule]));
});

test('in hard mode the tree keeps every box once everything is found, all blank', () => {
  const t = buildTree({ known: () => true, hard: true });
  assert.equal(t.nodes.length, COLLECTIBLE.length);
  assert.ok(t.nodes.every((n) => n.face === 'blank'));
  assert.equal(t.links.length, buildTree({ known: () => true }).links.length);
});

test('focusing on something to make in hard mode shows one ingredient, always the same one', () => {
  const t = fresh(true);
  const f = focusTree(t, ID.MUD);
  const into = f.links.find((l) => l.output === ID.MUD);
  const shown = clue(into);
  assert.ok(into.inputs.includes(shown));
  assert.equal(face(f, ID.MUD), 'name');
  assert.equal(face(f, shown), 'name', `${DEFS[shown].name} is shown`);
  for (const n of f.nodes) {
    if (n.id !== ID.MUD && n.id !== shown) assert.equal(n.face, 'blank', `${DEFS[n.id].name} stays blank`);
  }
  assert.deepEqual(focusTree(fresh(true), ID.MUD).nodes.map((n) => [n.id, n.face]),
    f.nodes.map((n) => [n.id, n.face]), 'the same ingredient every time');
});

test('something made from one ingredient shows only its process in hard mode', () => {
  const t = fresh(true);
  const single = t.links.find((l) => l.inputs.length === 1 && !starters.has(l.output));
  assert.ok(single, 'there is one to try');
  assert.equal(clue(single), null);
  const f = focusTree(t, single.output);
  for (const n of f.nodes) {
    if (n.id !== single.output) assert.equal(n.face, 'blank', `${DEFS[n.id].name} stays blank`);
  }
  assert.equal(f.links.find((l) => l.output === single.output).label, processName(RULES[single.rule]));
});

test('focusing on a found element in hard mode reveals nothing found', () => {
  const f = focusTree(fresh(true), ID.DIRT);
  for (const n of f.nodes) assert.equal(n.face, n.known ? 'blank' : 'name', DEFS[n.id].name);
});

test('hard mode blocks the heat, cool, wind, pressure and vacuum tools', () => {
  assert.deepEqual([...HARD_BLOCKED].sort(), ['cool', 'heat', 'pressure', 'vacuum', 'wind']);
  for (const t of HARD_BLOCKED) assert.ok(TOOLS.includes(t));
  const canvas = { addEventListener() {} };
  const heat = (hard) => {
    const w = makeWorld(20, 20);
    fillRect(w, 8, 8, 12, 12, ID.STONE);
    const state = { selection: { kind: 'tool', id: 'heat' }, brush: 2, hard };
    const input = new Input(canvas, () => w, state, null);
    const t0 = w.temp[10 * 20 + 10];
    input.act(w, (fn) => w.forRect(8, 8, 12, 12, fn), 0, 0, false);
    return w.temp[10 * 20 + 10] - t0;
  };
  assert.ok(heat(false) > 0, 'heats normally');
  assert.equal(heat(true), 0, 'does nothing in hard mode');
});

test('Mix still works in hard mode', () => {
  assert.ok(TOOLS.includes('mix') && !HARD_BLOCKED.has('mix'));
  const w = makeWorld(20, 20);
  fillRect(w, 0, 0, 19, 9, ID.SAND);
  const state = { selection: { kind: 'tool', id: 'mix' }, brush: 2, hard: true };
  const input = new Input({ addEventListener() {} }, () => w, state, null);
  input.act(w, (fn) => w.forRect(0, 0, 19, 19, fn), 0, 0, false);
  let low = 0;
  w.forRect(0, 10, 19, 19, (i) => { if (w.type[i] === ID.SAND) low++; });
  assert.ok(low > 40, `${low} sand moved into the empty half`);
});

test('hard mode is saved, and resetting discoveries keeps it', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  try {
    const p = new Progress();
    assert.equal(p.hard, false);
    p.hard = true;
    p.save();
    const q = new Progress();
    assert.equal(q.hard, true);
    q.reset();
    assert.equal(new Progress().hard, true);
  } finally {
    delete globalThis.localStorage;
  }
});

test('the Spark tool works in hard mode', () => {
  assert.ok(TOOLS.includes('spark') && !HARD_BLOCKED.has('spark'));
  const w = makeWorld(20, 20);
  const state = { selection: { kind: 'tool', id: 'spark' }, brush: 2, hard: true };
  const input = new Input({ addEventListener() {} }, () => w, state, null);
  input.act(w, w.brushArea(10, 10, 2), 0, 0, false);
  assert.ok(w.type.includes(ID.SPARK));
});

test('hard mode hands out every machine, found in the tree but not on the meter', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  try {
    const p = new Progress();
    const machines = COLLECTIBLE.filter((d) => d.cat === 'machine');
    assert.ok(machines.length >= 18, `${machines.length} machines`);
    assert.ok(machines.every((d) => !p.usable(d.id) && !p.known(d.id)), 'not before hard mode');
    p.hard = true;
    assert.ok(machines.every((d) => p.usable(d.id) && p.known(d.id) && !p.has(d.id)));
    assert.equal(p.count, STARTERS.length, 'none counted as discovered');
    const t = buildTree({ known: (id) => p.known(id), hard: true });
    assert.equal(face(t, ID.SWITCH), 'blank', 'a found box');
    assert.ok(!p.usable(ID.LED), 'devices are not machines');
  } finally {
    delete globalThis.localStorage;
  }
});
