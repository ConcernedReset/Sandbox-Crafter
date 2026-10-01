import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  angleText, parseStrength, dialAngle, loadSettings, saveSettings, DEFAULTS,
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
  const edges = { top: false, bottom: true, left: false, right: true };
  saveSettings({ angle: 30, strength: 2, newtonian: true, convection: false, edges }, storage);
  assert.deepEqual(loadSettings(storage), { angle: 30, strength: 2, newtonian: true, convection: false, edges });
  store.set('sandbox-crafter:physics', '{bad json');
  assert.deepEqual(loadSettings(storage), DEFAULTS);
  assert.deepEqual(loadSettings(undefined), DEFAULTS);
});
