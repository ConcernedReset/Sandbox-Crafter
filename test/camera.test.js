// Zooming and panning the view.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Camera, MAX_ZOOM } from '../src/game/camera.js';

test('at zoom 1 the view is the whole world', () => {
  const cam = new Camera(400, 240);
  assert.deepEqual([cam.x, cam.y, cam.vw, cam.vh], [0, 0, 400, 240]);
  assert.deepEqual(cam.cellAt(0.5, 0.5), { x: 200, y: 120 });
});

test('zooming keeps the point under the pointer in place', () => {
  const cam = new Camera(400, 240);
  const before = cam.cellAt(0.25, 0.75);
  cam.zoomTo(4, 0.25, 0.75);
  assert.equal(cam.vw, 100);
  assert.deepEqual(cam.cellAt(0.25, 0.75), before);
  cam.zoomTo(1.7, 0.25, 0.75);
  assert.deepEqual(cam.cellAt(0.25, 0.75), before);
});

test('the view stays inside the world', () => {
  const cam = new Camera(400, 240);
  cam.zoomTo(4, 0.99, 0.99);
  assert.ok(cam.x + cam.vw <= 400 && cam.y + cam.vh <= 240);
  cam.pan(-1000, -1000);
  assert.deepEqual([cam.x, cam.y], [0, 0]);
  cam.centerOn(400, 240);
  assert.deepEqual([cam.x, cam.y], [300, 180]);
  cam.zoomTo(1);
  assert.deepEqual([cam.x, cam.y], [0, 0]);
});

test('zoom steps go up to the limit and back down to 1', () => {
  const cam = new Camera(400, 240);
  const seen = [];
  for (let k = 0; k < 20; k++) { cam.step(1); seen.push(cam.zoom); }
  assert.equal(cam.zoom, MAX_ZOOM);
  assert.ok(seen.every((z, k) => k === 0 || z >= seen[k - 1]));
  cam.zoomTo(2.5);
  cam.step(-1);
  assert.equal(cam.zoom, 2);
  for (let k = 0; k < 20; k++) cam.step(-1);
  assert.equal(cam.zoom, 1);
});
