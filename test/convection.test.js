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
  const w = hotBlock();
  run(w, 300);
  const left = w.air.cvx(w.air.at(38, 44)), right = w.air.cvx(w.air.at(62, 44));
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
  run(w, 300, heat);
  // Markers that ride the air: count those that rise high and then come back
  // down into the bottom of the box.
  const a = w.air;
  const marks = [];
  for (let k = 0; k < 200; k++) marks.push({ x: 20 + (k % 20) * 6, y: 10 + Math.floor(k / 20) * 7, high: false, back: false });
  run(w, 900, () => {
    heat();
    for (const m of marks) {
      const b = a.at(Math.min(W - 1, Math.max(0, m.x | 0)), Math.min(H - 1, Math.max(0, m.y | 0)));
      // Kept in the open air: the wall's own blocks have no flow to carry them.
      m.x = Math.min(W - 5, Math.max(4, m.x + a.cvx(b) * 0.5));
      m.y = Math.min(H - 5, Math.max(4, m.y + a.cvy(b) * 0.5));
      if (m.y < 30) m.high = true;
      if (m.high && m.y > 70) m.back = true;
    }
  });
  const back = marks.filter((m) => m.back).length, high = marks.filter((m) => m.high).length;
  assert.ok(back > high / 2, `${back} of ${high} markers that rose came back down`);
  // The loop: up the middle, down both sides, in along the floor.
  const v = (x, y) => [a.cvx(a.at(x, y)), a.cvy(a.at(x, y))].map((n) => +n.toFixed(2));
  assert.ok(v(80, 60)[1] < -1, `rising over the block ${v(80, 60)}`);
  assert.ok(v(30, 50)[1] > 0.1 && v(130, 50)[1] > 0.1, `falling at the sides ${v(30, 50)} ${v(130, 50)}`);
  assert.ok(v(60, 84)[0] > 0.15 && v(100, 84)[0] < -0.15, `flowing in at the base ${v(60, 84)} ${v(100, 84)}`);
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

test('heating the air in a sealed box raises the pressure, and cooling brings it back to zero', () => {
  const w = makeWorld(120, 80);
  w.setConvection(true);
  const box = wallBox(w, 30, 20, 90, 60);
  const inside = () => meanPressure(w, box.x0 + 3, box.y0 + 3, box.x1 - 3, box.y1 - 3);
  run(w, 120, () => w.heat(60, 40, 8, 30));
  const hot = inside();
  assert.ok(hot > 1, `pressure while hot ${hot.toFixed(2)}`);
  run(w, 1200);
  const cold = inside();
  assert.ok(Math.abs(cold) < 0.2, `pressure once cool ${cold.toFixed(2)}`);
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
