import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '../src/sim/elements.js';
import { AMBIENT } from '../src/sim/constants.js';
import { SNUFF_AT } from '../src/sim/behaviors.js';
import { makeWorld, fillRect, wallBox, countOf, run } from './helpers.js';

// A block of metal at 1400 degrees hanging in the middle of an open world.
function hotBlock(angle = 0) {
  const w = makeWorld(100, 80);
  fillRect(w, 44, 36, 55, 43, ID.METAL);
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.METAL) w.temp[i] = 1400;
  w.setGravity({ angle });
  w.setConvection(true);
  return w;
}

const airT = (w, x, y) => w.air.t[w.air.at(x, y)];
const avgTemp = (w) => {
  let s = 0, n = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.METAL) { s += w.temp[i]; n++; }
  return s / n;
};

test('with convection off the air has no temperature of its own', () => {
  const w = makeWorld(60, 40);
  fillRect(w, 25, 15, 34, 24, ID.METAL);
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.METAL) w.temp[i] = 1400;
  run(w, 100);
  assert.ok(w.air.t.every((t) => t === AMBIENT));
});

test('a hot block heats the air above it, and the warm air rises', () => {
  const w = hotBlock();
  run(w, 300);
  const above = airT(w, 50, 28), below = airT(w, 50, 52);
  assert.ok(above > below + 5, `above ${above.toFixed(1)}, below ${below.toFixed(1)}`);
  const up = w.air.cvy(w.air.at(50, 30));
  assert.ok(up < -0.05, `air above is moving up (${up.toFixed(3)})`);
});

test('turning the arrow turns the plume', () => {
  const w = hotBlock(180);
  run(w, 300);
  const above = airT(w, 50, 28), below = airT(w, 50, 52);
  assert.ok(below > above + 5, `with gravity up the warm air goes down: above ${above.toFixed(1)}, below ${below.toFixed(1)}`);
});

test('cool air flows in towards the base of the plume', () => {
  // Below the hanging block: the air right under it is warmed and slips out
  // round its edges, so the cool air comes in lower down.
  const w = hotBlock();
  run(w, 300);
  const left = w.air.cvx(w.air.at(30, 64)), right = w.air.cvx(w.air.at(70, 64));
  assert.ok(left > 0 && right < 0, `left ${left.toFixed(3)}, right ${right.toFixed(3)}`);
});

test('heating pushes the air out, and the block slowly cools', () => {
  const w = hotBlock();
  run(w, 5);
  assert.ok(w.pressureAt(50, 33) > 0, `pressure beside the block ${w.pressureAt(50, 33).toFixed(3)}`);
  const t0 = avgTemp(w);
  run(w, 600);
  assert.ok(avgTemp(w) < t0 - 20, `cooled from ${t0.toFixed(0)} to ${avgTemp(w).toFixed(0)}`);
});

test('a fire in a sealed box still goes out with convection on', () => {
  const w = makeWorld(60, 50);
  w.setConvection(true);
  const box = wallBox(w, 10, 10, 49, 49);
  fillRect(w, box.x0, 40, box.x1, box.y1, ID.WOOD);
  const wood = countOf(w, ID.WOOD);
  fillRect(w, box.x0, 38, box.x1, 39, ID.FIRE);
  const flames = countOf(w, ID.FIRE);
  let lowest = 0, out = false, late = 0;
  // Once out, the pressure hovers near the snuffing point, so an ember may
  // flicker back now and then (with convection off too); the fire stays out.
  run(w, 1500, (f) => {
    lowest = Math.min(lowest, w.pressureAt(30, 30));
    const n = countOf(w, ID.FIRE);
    if (n === 0) out = true;
    if (f >= 1000) late += n / 500;
  });
  assert.ok(lowest < SNUFF_AT, `the air inside was used up (lowest ${lowest.toFixed(1)})`);
  assert.ok(out, 'the fire went out');
  assert.ok(late < flames * 0.1, `${late.toFixed(1)} flames on average afterwards, from ${flames}`);
  assert.ok(countOf(w, ID.WOOD) > wood * 0.5, `${countOf(w, ID.WOOD)} of ${wood} wood left`);
});

test('rising air comes back down: in a box, the loop carries air up and back to the base', () => {
  const W = 160, H = 100;
  const w = makeWorld(W, H, 7);
  wallBox(w, 0, 0, W - 1, H - 1);
  fillRect(w, 72, 80, 87, 87, ID.METAL);
  const heat = () => { for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.METAL) w.temp[i] = 1400; };
  w.setConvection(true);
  run(w, 100, heat);
  // Markers that ride the air at its speed: count those that rise high and
  // then come back down into the bottom of the box. (The box is a perfect
  // insulator, so in time it fills with heat and the loop dies down.)
  const a = w.air, n = a.W * a.H;
  const marks = [];
  for (let k = 0; k < 200; k++) marks.push({ x: 20 + (k % 20) * 6, y: 10 + Math.floor(k / 20) * 7, high: false, back: false });
  const sx = new Float64Array(n), sy = new Float64Array(n);
  let frames = 0;
  run(w, 700, () => {
    heat();
    for (const m of marks) {
      const b = a.at(Math.min(W - 1, Math.max(0, m.x | 0)), Math.min(H - 1, Math.max(0, m.y | 0)));
      // Kept in the open air: the wall's own blocks have no flow to carry them.
      m.x = Math.min(W - 5, Math.max(4, m.x + a.cvx(b)));
      m.y = Math.min(H - 5, Math.max(4, m.y + a.cvy(b)));
      if (m.y < 30) m.high = true;
      if (m.high && m.y > 70) m.back = true;
    }
    if (frames < 400) {
      frames++;
      for (let i = 0; i < n; i++) { sx[i] += a.cvx(i); sy[i] += a.cvy(i); }
    }
  });
  const back = marks.filter((m) => m.back).length, high = marks.filter((m) => m.high).length;
  assert.ok(back > high / 6, `${back} of ${high} markers that rose came back down`);
  // The loop, on average: up the middle, out along the top, down both side
  // walls, in along the floor.
  const v = (x, y) => { const i = a.at(x, y); return [sx[i] / frames, sy[i] / frames].map((k) => +k.toFixed(3)); };
  assert.ok(v(80, 50)[1] < -0.1, `rising over the block ${v(80, 50)}`);
  assert.ok(v(40, 7)[0] < -0.1 && v(120, 7)[0] > 0.1, `spreading along the top ${v(40, 7)} ${v(120, 7)}`);
  assert.ok(v(7, 50)[1] > 0.1 && v(152, 50)[1] > 0.1, `falling at the sides ${v(7, 50)} ${v(152, 50)}`);
  assert.ok(v(40, 92)[0] > 0.05 && v(120, 92)[0] < -0.05, `flowing in along the floor ${v(40, 92)} ${v(120, 92)}`);
});

test('the Heat tool warms the air, which rises; the Cool tool chills it, which sinks', () => {
  const hot = makeWorld(80, 80), cold = makeWorld(80, 80);
  for (const w of [hot, cold]) w.setConvection(true);
  run(hot, 20, () => hot.heat(40, 40, 6, 30));
  run(cold, 20, () => cold.heat(40, 40, 6, -30));
  const ah = hot.air, ac = cold.air;
  assert.ok(ah.t[ah.at(40, 40)] > AMBIENT + 50, `warm air ${ah.t[ah.at(40, 40)].toFixed(0)}`);
  assert.ok(ac.t[ac.at(40, 40)] < AMBIENT - 50, `cold air ${ac.t[ac.at(40, 40)].toFixed(0)}`);
  run(hot, 20);
  run(cold, 20);
  assert.ok(ah.cvy(ah.at(40, 40)) < -0.05, `warm air rising (${ah.cvy(ah.at(40, 40)).toFixed(3)})`);
  assert.ok(ac.cvy(ac.at(40, 40)) > 0.05, `cold air sinking (${ac.cvy(ac.at(40, 40)).toFixed(3)})`);
  const off = makeWorld(80, 80);
  run(off, 20, () => off.heat(40, 40, 6, 30));
  assert.ok(off.air.t.every((t) => t === AMBIENT), 'with convection off the air has no temperature');
});

// Mean pressure over the inside of a box.
function meanPressure(w, x0, y0, x1, y1) {
  let s = 0, n = 0;
  for (let y = y0; y <= y1; y += 4) for (let x = x0; x <= x1; x += 4) { s += w.pressureAt(x, y); n++; }
  return s / n;
}

test('heating the air in a sealed box raises the pressure, which lasts until the box is opened', () => {
  const w = makeWorld(120, 80);
  w.setConvection(true);
  const box = wallBox(w, 30, 20, 90, 60);
  const inside = () => meanPressure(w, box.x0 + 3, box.y0 + 3, box.x1 - 3, box.y1 - 3);
  run(w, 120, () => w.heat(60, 40, 8, 30));
  const hot = inside();
  assert.ok(hot > 1, `pressure while hot ${hot.toFixed(2)}`);
  // Wall is a perfect insulator: shut in, the air stays hot.
  run(w, 1200);
  const held = inside();
  assert.ok(held > hot * 0.9, `pressure held ${held.toFixed(2)} of ${hot.toFixed(2)}`);
  // Open the right-hand side and the heat and the pressure go.
  for (let y = 21; y < 60; y++) w.clearCell(y * w.w + 90);
  run(w, 1500);
  const cold = inside();
  assert.ok(Math.abs(cold) < 0.2, `pressure once open and cool ${cold.toFixed(2)}`);
});

test('in the open, hot air pushes out and is drawn back in as it cools', () => {
  const w = makeWorld(120, 80);
  w.setConvection(true);
  const a = w.air;
  let peak = 0;
  const watch = () => { peak = Math.max(peak, a.cvx(a.at(76, 40))); };
  run(w, 60, () => { w.heat(60, 40, 8, 30); watch(); });
  run(w, 40, watch);
  assert.ok(peak > 0.05, `air pushed out to the right while hot (${peak.toFixed(3)})`);
  let back = 0;
  run(w, 600, () => { back = Math.min(back, a.cvx(a.at(76, 40))); });
  assert.ok(back < -0.02, `air drawn back in as it cools (${back.toFixed(3)})`);
  run(w, 1200);
  assert.ok(Math.abs(w.pressureAt(60, 40)) < 0.1, `pressure settles to zero (${w.pressureAt(60, 40).toFixed(3)})`);
});

test('a big heat source at the bottom drives two steady rolls, as in The Powder Toy', () => {
  // Open world, a 1500 °C block in the middle of the floor. Air rises over
  // it, spreads out along the top, comes down at the sides and flows back in
  // along the bottom: anticlockwise on the left, clockwise on the right. And
  // it's steady: no chaotic gusts or pressure swings.
  const W = 200, H = 120;
  const w = makeWorld(W, H, 7);
  fillRect(w, 85, 112, 114, 117, ID.STONE);
  const heat = () => { for (let i = 0; i < w.type.length; i++) if (w.type[i] === ID.STONE) w.temp[i] = 1500; };
  w.setConvection(true);
  run(w, 300, heat);
  const a = w.air, n = a.W * a.H;
  const sx = new Float64Array(n), sy = new Float64Array(n), sxx = new Float64Array(n), syy = new Float64Array(n);
  const sp = new Float64Array(n), spp = new Float64Array(n);
  let frames = 0, maxP = 0;
  run(w, 1200, () => {
    heat();
    frames++;
    for (let i = 0; i < n; i++) {
      if (a.blocked[i]) continue;
      const vx = a.cvx(i), vy = a.cvy(i), p = a.p[i];
      sx[i] += vx; sy[i] += vy; sxx[i] += vx * vx; syy[i] += vy * vy; sp[i] += p; spp[i] += p * p;
      maxP = Math.max(maxP, Math.abs(p));
    }
  });
  let mean = 0, wobble = 0, pWobble = 0, cells = 0;
  for (let y = 2; y < a.H - 2; y++) {
    for (let x = 2; x < a.W - 2; x++) {
      const i = y * a.W + x;
      if (a.blocked[i]) continue;
      const mx = sx[i] / frames, my = sy[i] / frames;
      mean += Math.hypot(mx, my);
      wobble += Math.sqrt(Math.max(0, sxx[i] / frames - mx * mx + syy[i] / frames - my * my));
      pWobble += Math.sqrt(Math.max(0, spp[i] / frames - (sp[i] / frames) ** 2));
      cells++;
    }
  }
  assert.ok(mean / wobble > 2.5, `steady flow: mean ${(mean / cells).toFixed(3)}, wobble ${(wobble / cells).toFixed(3)}`);
  assert.ok(pWobble / cells < 0.1 && maxP < 3, `calm pressure: swings ${(pWobble / cells).toFixed(3)}, peak ${maxP.toFixed(2)}`);
  const v = (x, y) => { const i = a.at(x, y); return [sx[i] / frames, sy[i] / frames].map((k) => +k.toFixed(3)); };
  assert.ok(v(100, 60)[1] < -0.1, `rising over the block ${v(100, 60)}`);
  assert.ok(v(50, 15)[0] < -0.02 && v(150, 15)[0] > 0.02, `spreading out along the top ${v(50, 15)} ${v(150, 15)}`);
  assert.ok(v(15, 60)[1] > 0.02 && v(185, 60)[1] > 0.02, `coming down at the sides ${v(15, 60)} ${v(185, 60)}`);
  assert.ok(v(50, 105)[0] > 0.02 && v(150, 105)[0] < -0.02, `flowing back in along the bottom ${v(50, 105)} ${v(150, 105)}`);
});
