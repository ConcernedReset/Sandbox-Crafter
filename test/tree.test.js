// The recipe tree's layout: which elements it shows, how they connect, and
// where they sit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFS, ID, RULES, COLLECTIBLE, STARTERS } from '../src/sim/elements.js';
import { buildTree, focusTree, processName, NODE_H, ROW_H } from '../src/game/tree.js';

const starters = new Set(STARTERS.map((k) => ID[k]));
const fresh = () => buildTree({ known: (id) => starters.has(id) });
const everything = () => buildTree({ known: () => true });
const linksTo = (t, id) => t.links.filter((l) => l.output === id);

test('a new game shows the starting four and a ? for each thing they can make', () => {
  const t = fresh();
  assert.deepEqual(t.nodes.filter((n) => n.known).map((n) => n.id).sort(), [...starters].sort());
  const unknown = t.nodes.filter((n) => !n.known);
  assert.ok(unknown.length > 0, 'something to try');
  for (const n of unknown) {
    const [l] = linksTo(t, n.id);
    assert.ok(l.inputs.every((i) => starters.has(i)), `${DEFS[n.id].name} is made only from starters`);
    assert.equal(l.label, '?');
  }
  assert.ok(unknown.some((n) => n.id === ID.MUD), 'Dirt + Water is one of them');
});

test('every element but the roots has exactly one connection in, from earlier columns', () => {
  for (const t of [fresh(), everything()]) {
    const col = new Map(t.nodes.map((n) => [n.id, n.col]));
    for (const n of t.nodes) {
      const ins = linksTo(t, n.id);
      if (n.col === 0) { assert.equal(ins.length, 0, DEFS[n.id].name); continue; }
      assert.equal(ins.length, 1, DEFS[n.id].name);
      for (const i of ins[0].inputs) assert.ok(col.get(i) < n.col, `${DEFS[i].name} before ${DEFS[n.id].name}`);
    }
  }
});

test('no two elements overlap', () => {
  const t = everything();
  const byCol = new Map();
  for (const n of t.nodes) {
    if (!byCol.has(n.col)) byCol.set(n.col, []);
    byCol.get(n.col).push(n.y);
  }
  for (const ys of byCol.values()) {
    ys.sort((a, b) => a - b);
    for (let k = 1; k < ys.length; k++) assert.ok(ys[k] - ys[k - 1] >= Math.min(ROW_H, NODE_H + 8));
  }
});

test('free play shows every element, none hidden', () => {
  const t = everything();
  assert.equal(t.nodes.length, COLLECTIBLE.length);
  assert.ok(t.nodes.every((n) => n.known));
  assert.ok(t.links.every((l) => l.label !== '?'));
  assert.equal(t.nodes.find((n) => n.id === ID.STEAM).col, 1, 'Steam is one step from Water');
});

test('revealing a recipe shows its process under the ?', () => {
  const target = fresh().nodes.find((n) => !n.known).id;
  const t = buildTree({ known: (id) => starters.has(id), revealed: (id) => id === target });
  const [l] = linksTo(t, target);
  assert.equal(l.label, processName(RULES[l.rule]));
  assert.notEqual(l.label, '?');
});

// Every link's inputs are shown, sit in earlier columns, and each node has
// at most one link in.
function wellFormed(t) {
  const col = new Map(t.nodes.map((n) => [n.id, n.col]));
  const into = new Set();
  for (const l of t.links) {
    assert.ok(!into.has(l.output), `one link into ${DEFS[l.output].name}`);
    into.add(l.output);
    assert.ok(col.has(l.output), `${DEFS[l.output].name} is shown`);
    for (const i of l.inputs) {
      assert.ok(col.has(i), `${DEFS[i].name} is shown`);
      assert.ok(col.get(i) < col.get(l.output), `${DEFS[i].name} before ${DEFS[l.output].name}`);
    }
  }
}

test('focusing on an element shows how it is made and everything it makes', () => {
  const full = everything();
  const f = focusTree(full, ID.MUD);
  wellFormed(f);
  const role = new Map(f.nodes.map((n) => [n.id, n.role]));
  assert.equal(role.get(ID.MUD), 'focus');
  assert.equal(role.get(ID.DIRT), 'source');
  assert.equal(role.get(ID.WATER), 'source');
  // Every recipe that uses Mud shows up, with its other ingredients.
  for (const r of RULES) {
    if (!r.inputs.includes(ID.MUD) || r.output === ID.MUD || role.get(r.output) === 'source') continue;
    assert.ok(role.has(r.output), `${DEFS[r.output].name} is shown`);
  }
  const brick = f.links.find((l) => l.output === ID.BRICK);
  assert.ok(brick.inputs.includes(ID.MUD));
  // ...and what those make in turn.
  const plant = f.links.find((l) => l.output === ID.WOOD);
  assert.ok(plant, 'Wood, made from Plant, which Mud makes');
  // Nothing unrelated.
  assert.ok(f.nodes.length < full.nodes.length);
  assert.ok(!role.has(ID.GUNPOWDER) || role.get(ID.GUNPOWDER) !== 'source');
});

test('focusing includes undiscovered products and what they combine with', () => {
  const t = fresh();
  const f = focusTree(t, ID.DIRT);
  wellFormed(f);
  const mud = f.nodes.find((n) => n.id === ID.MUD);
  assert.ok(mud && !mud.known && mud.role === 'product');
  const l = f.links.find((k) => k.output === ID.MUD);
  assert.equal(l.label, '?');
  const water = f.nodes.find((n) => n.id === ID.WATER);
  assert.equal(water.role, 'partner', 'Water is shown as what Dirt combines with');
  assert.ok(!f.nodes.some((n) => n.id === ID.SAND), 'Sand has nothing to do with Dirt yet');
});

test('focusing on any element gives a well-formed tree', () => {
  const full = everything();
  for (const d of COLLECTIBLE) {
    const f = focusTree(full, d.id);
    wellFormed(f);
    assert.equal(f.nodes.filter((n) => n.role === 'focus').length, 1);
  }
});

test('focusing on something not in the tree gives nothing', () => {
  assert.equal(focusTree(fresh(), ID.DIAMOND), null);
});

test('each kind of recipe has a process name', () => {
  const name = (kind, keys) => processName({ kind, inputs: keys.map((k) => ID[k]), output: 0 });
  assert.equal(name('heat', ['SAND']), 'Heat');
  assert.equal(name('cool', ['WATER']), 'Cool');
  assert.equal(name('pressure', ['WOOD']), 'Pressure');
  assert.equal(name('burn', ['WOOD']), 'Burn');
  assert.equal(name('time', ['PLANT']), 'Time');
  assert.equal(name('decay', ['RADIUM']), 'Decay');
  assert.equal(name('contact', ['DIRT', 'WATER']), 'Mix');
  assert.equal(name('contact', ['URANIUM', 'NEUTRON']), 'Bombard');
  assert.equal(name('contact', ['ELECTRON', 'POSITRON']), 'Collide');
});
