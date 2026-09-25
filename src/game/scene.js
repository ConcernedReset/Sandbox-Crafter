// The starting scene: rolling dirt, a sand dune and a walled pond. It uses
// only the starting elements, and keeps the water away from the dirt so the
// first discovery is left for the player.

import { ID } from '../sim/elements.js';

export function loadDemoScene(world) {
  world.clearAll();
  const { w, h } = world;
  const put = (x, y, t) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (world.type[i] === 0) world.spawn(i, t);
  };

  // Rolling dirt ground.
  const ground = (x) => Math.round(h - 34 + Math.sin(x / 37) * 5 + Math.sin(x / 13 + 1.7) * 2);
  for (let x = 0; x < w; x++) {
    for (let y = ground(x); y < h; y++) put(x, y, ID.DIRT);
  }

  // A sand dune on the left.
  for (let x = 20; x < 150; x++) {
    const top = ground(x) - Math.round(Math.max(0, 26 - Math.abs(x - 80) * 0.42));
    for (let y = top; y < ground(x); y++) put(x, y, ID.SAND);
  }

  // A walled pond on the right, sitting on a wall floor so the water never
  // touches the dirt.
  const x0 = 250, x1 = 360;
  const floorY = Math.min(...Array.from({ length: x1 - x0 + 1 }, (_, k) => ground(x0 + k))) - 3;
  const wallTop = floorY - 30;
  for (let x = x0; x <= x1; x++) {
    for (let y = floorY; y < floorY + 3; y++) put(x, y, ID.WALL);
    for (let y = floorY + 3; y < ground(x); y++) put(x, y, ID.WALL);
  }
  for (let y = wallTop; y < floorY; y++) {
    for (let k = 0; k < 3; k++) { put(x0 + k, y, ID.WALL); put(x1 - k, y, ID.WALL); }
  }
  for (let y = wallTop + 8; y < floorY; y++) {
    for (let x = x0 + 3; x <= x1 - 3; x++) put(x, y, ID.WATER);
  }
}
