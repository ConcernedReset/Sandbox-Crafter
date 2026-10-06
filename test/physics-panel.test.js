import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  angleText, parseStrength, dialAngle, loadSettings, saveSettings, DEFAULTS, nextEdges,
} from '../src/game/physics-panel.js';

test('angles read as directions at multiples of 45 degrees', () => {
  assert.equal(angleText(0), 'Down');
  assert.equal(angleText(90), 'Left');
  assert.equal(angleText(225), 'Up-right');
  assert.equal(angleText(30), '30°');
});

test('the strength box accepts numbers from 0 to 10', () => {
  assert.equal(parseStrength('2.5'), 2.5);
  assert.equal(parseStrength(' 3x '), 3);
  assert.equal(parseStrength('1,5'), 1.5);
  assert.equal(parseStrength('40'), 10);
  assert.equal(parseStrength('-2'), 0);
  assert.equal(parseStrength('abc'), null);
  assert.equal(parseStrength(''), null);
});

test('the dial turns to where the pointer is', () => {
  assert.equal(dialAngle(0, 10), 0); // below the centre: down
  assert.equal(dialAngle(-10, 0), 90); // left
  assert.equal(dialAngle(0, -10), 180); // up
  assert.equal(dialAngle(10, 0), 270); // right
  assert.equal(dialAngle(-10, 12, true), 45, 'Shift snaps to 45');
});

test('settings survive a save and load, and bad or missing storage gives the defaults', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const edges = { top: 'solid', bottom: 'void', left: 'loop', right: 'loop' };
  saveSettings({ angle: 30, strength: 2, newtonian: true, convection: false, edges }, storage);
  assert.deepEqual(loadSettings(storage), { angle: 30, strength: 2, newtonian: true, convection: false, edges });
  store.set('sandbox-crafter:physics', '{bad json');
  assert.deepEqual(loadSettings(storage), DEFAULTS);
  assert.deepEqual(loadSettings(undefined), DEFAULTS);
});

test('clicking an edge cycles it solid, void, loop, and loops come in pairs', () => {
  const S = 'solid', V = 'void', L = 'loop';
  let e = { ...DEFAULTS.edges };
  e = nextEdges(e, 'left');
  assert.deepEqual(e, { top: S, bottom: S, left: V, right: S });
  e = nextEdges(e, 'left');
  assert.deepEqual(e, { top: S, bottom: S, left: L, right: L });
  e = nextEdges(e, 'right');
  assert.deepEqual(e, { top: S, bottom: S, left: S, right: S }, 'leaving a loop puts both sides back to solid');
  e = nextEdges({ top: V, bottom: V, left: S, right: S }, 'top');
  assert.deepEqual(e, { top: L, bottom: L, left: S, right: S }, 'a loop takes over the other side');
});

test('edges saved by an older version (true or false) still load', () => {
  const store = new Map([['sandbox-crafter:physics', JSON.stringify({ edges: { top: true, bottom: false } })]]);
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.deepEqual(loadSettings(storage).edges, { top: 'void', bottom: 'solid', left: 'solid', right: 'solid' });
});
