import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { Solver, G, SOFT } from '../src/sim/gravity.js';
import { makeWorld, fillRect, run } from './helpers.js';

test('the FFT field matches adding up every pull directly', () => {
  const cols = 9, rows = 5, W = cols + 2;
  const s = new Solver(cols, rows);
  for (let k = 0; k < s.mass.length; k++) s.mass[k] = (k * 7919) % 13 === 0 ? 5 + (k % 3) : (k % 4) * 0.25;
  const fx = new Float32Array(W * (rows + 2)), fy = new Float32Array(W * (rows + 2));
  s.solve(fx, fy);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let ex = 0, ey = 0;
      for (let qy = 0; qy < rows; qy++) {
        for (let qx = 0; qx < cols; qx++) {
          if (qx === x && qy === y) continue;
          const dx = qx - x, dy = qy - y, r2 = dx * dx + dy * dy + SOFT;
          const f = (G * s.mass[qy * cols + qx]) / (r2 * Math.sqrt(r2));
          ex += f * dx;
          ey += f * dy;
        }
      }
      const o = (y + 1) * W + x + 1;
      assert.ok(Math.abs(fx[o] - ex) < 1e-5 && Math.abs(fy[o] - ey) < 1e-5, `block ${x},${y}`);
    }
  }
});

test('with Newtonian gravity off nothing is built; switching it off restores plain gravity', () => {
  const w = makeWorld(60, 40);
  fillRect(w, 20, 20, 30, 30, ID.SAND);
  run(w, 20);
  assert.equal(w.gravity.solver, null);
  assert.equal(w.gravity.fx, null);
  w.setGravity({ newtonian: true });
  run(w, 2);
  assert.ok(w.gravity.solver !== null);
  assert.equal(w.gravity.straight, false);
  w.setGravity({ newtonian: false });
  const a = w.air.at(10, 10);
  assert.deepEqual([w.gravity.gx[a], w.gravity.gy[a], w.gravity.straight], [0, 1, true]);
});

test('a heavy block pulls loose sand in when there is no other gravity', () => {
  const w = makeWorld(120, 80);
  w.setGravity({ strength: 0, newtonian: true });
  fillRect(w, 50, 30, 69, 49, ID.STONE); // 400 cells of stone, 1000 units of mass
  for (let a = 0; a < 24; a++) {
    const x = Math.round(60 + Math.cos((a / 24) * Math.PI * 2) * 32);
    const y = Math.round(40 + Math.sin((a / 24) * Math.PI * 2) * 32);
    if (w.inBounds(x, y) && !w.type[y * 120 + x]) w.spawn(y * 120 + x, ID.SAND);
  }
  const spread = () => {
    let sum = 0, n = 0;
    for (let i = 0; i < w.type.length; i++) {
      if (w.type[i] !== ID.SAND) continue;
      sum += Math.hypot((i % 120) - 59.5, ((i / 120) | 0) - 39.5);
      n++;
    }
    return sum / n;
  };
  const d0 = spread();
  run(w, 150);
  assert.ok(spread() < d0 - 8, `mean distance ${d0.toFixed(1)} to ${spread().toFixed(1)}`);
});

test('mass pulls towards itself, and a White Hole pushes away', () => {
  const w = makeWorld(80, 60);
  w.setGravity({ strength: 0, newtonian: true });
  fillRect(w, 38, 28, 41, 31, ID.STONE);
  w.step();
  const g = w.gravity;
  assert.ok(g.gx[w.air.at(60, 30)] < 0, 'right of the stone, the pull is to the left');
  assert.ok(g.gy[w.air.at(40, 10)] > 0, 'above it, the pull is down');
  const v = makeWorld(80, 60);
  v.setGravity({ strength: 0, newtonian: true });
  v.spawn(30 * 80 + 40, ID.WHITE_HOLE);
  v.step();
  assert.ok(v.gravity.gx[v.air.at(60, 30)] > 0, 'right of the White Hole, the push is to the right');
});

test('light bends as it passes a heavy mass', () => {
  const w = makeWorld(160, 100);
  w.setGravity({ strength: 0, newtonian: true });
  fillRect(w, 70, 60, 89, 79, ID.STONE);
  w.step();
  const k = w.spawnProjectile(ID.PHOTON, 5.5, 45.5, 2, 0);
  for (let f = 0; f < 30; f++) w.step();
  assert.equal(w.pn, 1, 'the photon is still flying');
  assert.ok(w.pvy[k] > 0.05, `photon now heading ${w.pvx[k].toFixed(2)}, ${w.pvy[k].toFixed(2)}`);
  assert.ok(Math.abs(Math.hypot(w.pvx[k], w.pvy[k]) - 2) < 1e-4, 'light keeps its speed');
});
