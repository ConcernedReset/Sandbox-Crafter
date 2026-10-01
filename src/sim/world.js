// The particle simulation. The world is a grid where every cell holds at
// most one particle; per-cell data lives in parallel typed arrays so the
// update loop stays fast. Each frame:
//   1. every particle runs its behaviour, radioactivity, phase changes,
//      reactions and movement (bottom row first, alternating direction)
//   2. flying particles (photons, neutrons...) move on their own layer
//   3. heat conducts between touching particles and leaks into open air
//   4. the air pressure grid steps forward
//
// Element behaviours live in behaviors.js, the flying-particle layer in
// particles.js and machines (doors, lamps, switches) in machines.js; all
// three are mixed into World below.
//
// Solids have a strength. When the air pressure around an exposed solid
// particle beats it (and heat weakens it), the particle is torn loose and
// becomes debris that the air can throw around.
//
// When a rule creates an element for the first time, it is pushed onto
// `discoveries` for the game layer to pick up.

import { Air, CELL, AIR_SHARE, BOIL_LOWEST, PHASE_HIGHEST } from './air.js';
import { DEFS, ID, NUM, State, AMBIENT, REACT } from './elements.js';
import {
  MAX_TEMP, MIN_TEMP, GRAVITY, REST, PRESSURE_WAKE, PRESSURE_FULL, MAX_ACTIVITY,
} from './constants.js';
import {
  COND, AIR_COOL, CONDUCTOR, AIRTIGHT, POWERED, PRESSABLE, MASS, HIGH_PHASE, LOW_PHASE, PHASE_BOIL,
} from './lookups.js';
import { Behaviors, SNUFF_AT } from './behaviors.js';
import { Particles, initParticles } from './particles.js';
import { Machines, initMachines } from './machines.js';
import { Gravity, DX8, DY8 } from './gravity.js';

const { SOLID, POWDER, LIQUID, GAS, ENERGY } = State;
const { WALL, FIRE, ASH, SPARK, PHOTON } = ID;

// An air block is sealed once this many of its 16 cells are airtight solid:
// any unbroken line of strong solid across it.
const SEAL_COUNT = 4;

// Edges of the world that are a void: anything that moves out through one
// vanishes (see setVoidEdges).
export const VOID_TOP = 1, VOID_BOTTOM = 2, VOID_LEFT = 4, VOID_RIGHT = 8;

// With no gravity, gases spread evenly: as likely to step either way.
const ZERO_G_RISE = 0.3;
const ZERO_G_SINK = 0.3 / 0.7;

export { MAX_TEMP, MIN_TEMP };

export class World {
  constructor(width, height, seed = 12345) {
    this.w = width;
    this.h = height;
    const n = width * height;
    this.type = new Uint16Array(n);
    this.temp = new Float32Array(n).fill(AMBIENT);
    this.life = new Int16Array(n);
    // spark: conductor underneath; fire: fuel; clone: copied element;
    // molten metal: which metal; lightning/firework/seed: state flag
    this.ctype = new Uint16Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.shade = new Uint8Array(n); // random per particle, picks a colour variant
    this.loose = new Uint8Array(n); // 1 for a solid particle torn off by pressure
    this.clock = new Uint32Array(n); // tick on which the cell was last updated
    this.tick = 1;
    this.air = new Air(Math.ceil(width / CELL), Math.ceil(height / CELL));
    this.gravity = new Gravity(this.air);
    this.seed = (seed >>> 0) || 1;
    this.seen = new Uint8Array(NUM);
    this.discoveries = [];
    this.count = 0;
    this.blockedMoving = false;
    this.brushShape = 'circle';
    this.replace = false; // painting overwrites what's in the way
    this.voidEdges = 0; // VOID_TOP | VOID_BOTTOM | ... (see setVoidEdges)
    this.vanished = false; // the last travel took the particle off a void edge
    initParticles(this);
    initMachines(this);
  }

  rand() {
    let s = this.seed;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    this.seed = s >>> 0;
    return this.seed / 4294967296;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  // ---- cell operations ----------------------------------------------------

  clearCell(i) {
    this.type[i] = 0;
    this.temp[i] = AMBIENT;
    this.life[i] = 0;
    this.ctype[i] = 0;
    this.vx[i] = 0;
    this.vy[i] = 0;
    this.loose[i] = 0;
  }

  clearAll() {
    this.type.fill(0);
    this.temp.fill(AMBIENT);
    this.life.fill(0);
    this.ctype.fill(0);
    this.vx.fill(0);
    this.vy.fill(0);
    this.loose.fill(0);
    this.air.clear();
    this.pn = 0;
    this.doorTimer.fill(0);
    this.doorList.length = 0;
  }

  initLife(i, t) {
    const d = DEFS[t];
    this.life[i] = d.lifeMax ? d.lifeMin + ((this.rand() * (d.lifeMax - d.lifeMin + 1)) | 0) : 0;
  }

  // Place a fresh particle (used by painting and by clones).
  spawn(i, t) {
    const d = DEFS[t];
    if (d.projectile) { this.emitAt(t, i % this.w, (i / this.w) | 0); return; }
    this.type[i] = t;
    this.temp[i] = d.temp;
    this.ctype[i] = 0;
    this.vx[i] = 0;
    this.vy[i] = 0;
    this.loose[i] = 0;
    this.shade[i] = (this.rand() * 256) | 0;
    this.initLife(i, t);
    this.clock[i] = this.tick;
  }

  // Turn an existing particle into something else as the result of a rule.
  // Turning into a flying particle (a photon, say) frees the cell.
  convert(i, to, keepTemp, rule) {
    if (to === 0) { this.clearCell(i); return; }
    if (DEFS[to].projectile) {
      const x = i % this.w, y = (i / this.w) | 0;
      this.clearCell(i);
      this.emitAt(to, x, y);
      if (rule >= 0) this.record(to, rule);
      return;
    }
    this.type[i] = to;
    this.ctype[i] = 0;
    this.loose[i] = 0;
    if (!keepTemp) this.temp[i] = DEFS[to].temp;
    this.initLife(i, to);
    this.clock[i] = this.tick;
    if (rule >= 0) this.record(to, rule);
  }

  record(t, rule) {
    if (!this.seen[t]) {
      this.seen[t] = 1;
      this.discoveries.push({ id: t, rule });
    }
  }

  swap(i, j) {
    const { type, temp, life, ctype, vx, vy, shade, loose } = this;
    let a;
    a = type[i]; type[i] = type[j]; type[j] = a;
    a = temp[i]; temp[i] = temp[j]; temp[j] = a;
    a = life[i]; life[i] = life[j]; life[j] = a;
    a = ctype[i]; ctype[i] = ctype[j]; ctype[j] = a;
    a = vx[i]; vx[i] = vx[j]; vx[j] = a;
    a = vy[i]; vy[i] = vy[j]; vy[j] = a;
    a = shade[i]; shade[i] = shade[j]; shade[j] = a;
    a = loose[i]; loose[i] = loose[j]; loose[j] = a;
    this.clock[i] = this.tick;
    this.clock[j] = this.tick;
  }

  sparkAt(j) {
    this.ctype[j] = this.type[j];
    this.type[j] = SPARK;
    this.life[j] = 4;
    this.clock[j] = this.tick;
  }

  // Set cell i alight. Returns true if the cell changed. Fire needs air:
  // explosives carry their own, and fuels that burn into something other
  // than flame (thermite) don't need it.
  ignite(i, x, y) {
    const t = this.type[i];
    const d = DEFS[t];
    const b = d.burn;
    if (!b) return false;
    if (b.launch) { // fireworks take off instead of burning
      if (this.ctype[i] !== 1) {
        this.ctype[i] = 1;
        this.life[i] = 25 + ((this.rand() * 25) | 0);
      }
      return true;
    }
    if (!d.explode && b.to === FIRE && this.air.p[this.air.at(x, y)] < SNUFF_AT) return false;
    if (d.explode) this.blast(x, y, d.explode);
    if (b.ash > 0 && this.rand() < b.ash) { this.convert(i, ASH, false, b.ashRule); return true; }
    if (b.to !== FIRE && this.rand() < b.toChance) {
      this.convert(i, b.to, false, b.toRule);
      if (b.temp) this.temp[i] = b.temp;
      return true;
    }
    this.convert(i, FIRE, false, -1);
    this.ctype[i] = t; // remember the fuel so the fire knows whether to leave smoke
    this.temp[i] = b.fireTemp;
    this.life[i] = b.fireLifeMin + ((this.rand() * (b.fireLifeMax - b.fireLifeMin + 1)) | 0);
    return true;
  }

  // An explosion: a pressure spike in the air grid plus a direct shove
  // outward for loose particles nearby.
  blast(x, y, strength) {
    this.air.addPressure(this.air.at(x, y), strength);
    const r = Math.min(8, 2 + Math.round(Math.sqrt(strength)));
    const { w, h, type } = this;
    const { downX, downY } = this.gravity;
    const px = downY, py = -downX; // across the gravity arrow
    for (let dy = -r; dy <= r; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= h) continue;
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= w || (dx === 0 && dy === 0)) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 > r * r) continue;
        const j = ny * w + nx;
        const e = DEFS[type[j]];
        // Other explosives caught in the blast go off too.
        if (e.explode > 0 && this.temp[j] < e.ignite) this.temp[j] = Math.min(MAX_TEMP, e.ignite + 1);
        const s = e.state;
        if (s !== POWDER && s !== LIQUID && s !== GAS && !this.loose[j]) continue;
        // Push outward; things below the blast (along the gravity arrow)
        // bounce off the ground and get thrown up, which digs a crater.
        const dist = Math.sqrt(d2);
        const f = (strength * 0.7) / dist;
        const across = dx * px + dy * py, along = dx * downX + dy * downY;
        const pushAcross = (across / dist) * f;
        const pushAlong = (along < 0 ? along / dist : -0.5 * along / dist) * f - f * 0.4;
        this.vx[j] += pushAcross * px + pushAlong * downX;
        this.vy[j] += pushAcross * py + pushAlong * downY;
      }
    }
  }

  randomNeighbor(x, y) {
    const r = (this.rand() * 4) | 0;
    let nx = x, ny = y;
    if (r === 0) nx++; else if (r === 1) nx--; else if (r === 2) ny++; else ny--;
    if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) return -1;
    return ny * this.w + nx;
  }

  // Settings from the Physics panel: { angle, strength, newtonian }.
  setGravity(opts) {
    this.gravity.set(opts);
  }

  // Which edges of the world are a void: { top, bottom, left, right }.
  // Whatever moves out through one is gone; things that stay put (a stone
  // floor along it) stay. Pressure waves and heat go out through it too,
  // instead of bouncing back off the edge.
  setVoidEdges({ top = false, bottom = false, left = false, right = false } = {}) {
    this.voidEdges = (top ? VOID_TOP : 0) | (bottom ? VOID_BOTTOM : 0)
      | (left ? VOID_LEFT : 0) | (right ? VOID_RIGHT : 0);
    this.air.voidSides = this.voidEdges; // and the air lets waves and heat out there
  }

  // Is (x, y), just outside the world, through a void edge?
  offEdge(x, y) {
    const v = this.voidEdges;
    return (y < 0 && (v & VOID_TOP) !== 0) || (y >= this.h && (v & VOID_BOTTOM) !== 0)
      || (x < 0 && (v & VOID_LEFT) !== 0) || (x >= this.w && (v & VOID_RIGHT) !== 0);
  }

  // ---- main loop ----------------------------------------------------------

  step() {
    const { w, h, type, clock, air, loose } = this;
    const tick = ++this.tick;
    this.stepGravity();
    air.phaseFactors(); // the pressure as it stands now moves boiling and melting points
    // Particles read last frame's complete blocked map while this frame's is built.
    const next = air.next;
    next.fill(0);
    air.solid.fill(0);
    // Rows and columns run from the end gravity pulls towards, so a column
    // of grains falls together.
    const g = this.gravity;
    const fromBottom = g.scanRows === 0 ? (tick & 1) === 0 : g.scanRows > 0;
    for (let n = 0; n < h; n++) {
      const y = fromBottom ? h - 1 - n : n;
      const leftToRight = g.scanCols === 0 ? ((tick + y) & 1) === 0 : g.scanCols < 0;
      const row = y * w;
      for (let k = 0; k < w; k++) {
        const x = leftToRight ? k : w - 1 - k;
        const i = row + x;
        const t = type[i];
        if (t === 0) continue;
        if (t === WALL) { next[air.at(x, y)] = 1; continue; }
        // Metal carrying a spark is still metal as far as the air is concerned.
        if ((AIRTIGHT[t] || (t === SPARK && AIRTIGHT[this.ctype[i]])) && !loose[i]) air.solid[air.at(x, y)]++;
        if (clock[i] === tick) continue;
        clock[i] = tick;
        this.update(i, x, y, t);
      }
    }
    for (let a = 0; a < next.length; a++) if (air.solid[a] >= SEAL_COUNT) next[a] = 1;
    air.next = air.blocked;
    air.blocked = next;
    this.stepDoors();
    this.computeField();
    this.stepProjectiles();
    this.conductHeat();
    air.step(this.gravity);
  }

  // Newtonian gravity: weigh each air block and solve the pull every other
  // frame (and straight away after it's switched on). Nothing runs while
  // it's off.
  stepGravity() {
    const g = this.gravity;
    if (!g.newtonian || (!g.stale && (this.tick & 1) === 1)) return;
    const { mass, cols } = g.solver;
    mass.fill(0);
    const { w, h, type } = this;
    for (let y = 0; y < h; y++) {
      const row = ((y / CELL) | 0) * cols, base = y * w;
      for (let x = 0; x < w; x++) {
        const t = type[base + x];
        if (t !== 0) mass[row + ((x / CELL) | 0)] += MASS[t];
      }
    }
    g.solve();
  }

  update(i, x, y, t) {
    const d = DEFS[t];

    if (d.holdTemp) {
      const T0 = d.temp, T = this.temp[i];
      if (T0 >= AMBIENT) this.temp[i] = T < T0 ? T0 : T0 + (T - T0) * 0.97;
      else this.temp[i] = T > T0 ? T0 : T0 + (T - T0) * 0.97;
    }
    if (d.conductor && this.life[i] > 0) this.life[i]--;

    if (d.active && this.radiate(i, x, y, d)) return;
    if (d.strength > 0 && this.loose[i] === 0) this.tear(i, x, y, d);

    if (d.behavior !== null && this.behave(d.behavior, i, x, y, t, d)) {
      // A torn-off magnet or battery still falls like debris.
      if (this.loose[i] && this.type[i] === t) this.movePowder(i, x, y, d);
      return;
    }

    // Phase changes, at temperatures the air pressure here moves (air.js).
    const T = this.temp[i];
    const hi = d.high;
    let hiT = hi === null ? 0 : hi.temp;
    const hk = HIGH_PHASE[t];
    if (hk !== 0 && T >= hiT + (hiT + 273) * (hk === PHASE_BOIL ? BOIL_LOWEST - 1 : 0)) {
      hiT = this.phaseTemp(hiT, hk, x, y);
    }
    if (hi !== null && T >= hiT && this.rand() < hi.chance) {
      if (hi.alt >= 0 && this.rand() < hi.altChance) {
        this.convert(i, hi.alt, true, hi.altRule);
      } else {
        this.convert(i, hi.to, true, hi.rule);
        if (hi.remember) this.ctype[i] = hi.remember;
      }
      return;
    }
    const lo = d.low;
    if (lo !== null) {
      // Molten metal sets back into whichever metal it was.
      const was = lo.restore ? this.ctype[i] : 0;
      let limit = was ? DEFS[was].high.temp - 40 : lo.temp;
      const lk = LOW_PHASE[t];
      if (lk !== 0 && T <= limit + (limit + 273) * (PHASE_HIGHEST - 1)) limit = this.phaseTemp(limit, lk, x, y);
      if (T <= limit && this.rand() < lo.chance) {
        if (was) this.convert(i, was, true, -1);
        else if (lo.alt >= 0 && this.rand() < lo.altChance) this.convert(i, lo.alt, true, lo.altRule);
        else this.convert(i, lo.to, true, lo.rule);
        return;
      }
    }
    const pr = d.pressure;
    if (pr !== null && this.pressureOn(x, y, d) >= pr.above && this.rand() < pr.chance) {
      if (pr.ignite) this.ignite(i, x, y);
      else if (pr.alt >= 0 && this.rand() < pr.altChance) this.convert(i, pr.alt, true, pr.altRule);
      else this.convert(i, pr.to, true, pr.rule);
      return;
    }
    // Hot fuel with no air to burn in still falls and flows.
    if (d.burn !== null && T >= d.ignite && this.rand() < d.igniteChance && this.ignite(i, x, y)) return;

    if (d.reactive) {
      const j = this.randomNeighbor(x, y);
      if (j >= 0) {
        const u = this.type[j];
        if (u !== 0) {
          const r = REACT[t * NUM + u];
          if (r !== null && this.rand() < r.chance
            && (this.temp[i] >= r.minTemp || this.temp[j] >= r.minTemp)
            && this.react(i, j, x, y, r)) return;
        }
      }
    }

    switch (d.state) {
      case POWDER: this.movePowder(i, x, y, d); break;
      case LIQUID: this.moveLiquid(i, x, y, d); break;
      case GAS: this.moveGas(i, x, y, d); break;
      case ENERGY: if (!d.fixed) this.moveGas(i, x, y, d); break;
      case SOLID: if (this.loose[i]) this.movePowder(i, x, y, d); break;
      default: break;
    }
  }

  // The temperature a phase change of kind `kind` (lookups.js) happens at
  // here, given that it happens at `temp` in normal air (see
  // Air.phaseFactors).
  phaseTemp(temp, kind, x, y) {
    const air = this.air;
    const k = (kind === PHASE_BOIL ? air.boil : air.melt)[air.at(x, y)];
    return temp + (temp + 273) * (k - 1);
  }

  // Pressure tears exposed solid particles loose. Each solid has a strength
  // (the pressure it can take at room temperature); heat weakens it steadily,
  // down to a tenth of that at its melting or ignition point. The further the
  // pressure is past that, the faster the surface is stripped away.
  tear(i, x, y, d) {
    const p = this.pressureOn(x, y, d, true);
    if (p < d.strength * 0.1) return; // cheap early exit: can't tear even when white-hot
    let s = d.strength;
    if (d.softenAt > AMBIENT) {
      const frac = (this.temp[i] - AMBIENT) / (d.softenAt - AMBIENT);
      if (frac > 0) s *= 1 - 0.9 * (frac < 1 ? frac : 1);
    }
    if (p <= s || this.rand() >= Math.min(0.9, (1.5 * (p - s)) / s)) return;
    if (!this.exposed(i, x, y)) return;
    this.loose[i] = 1;
  }

  // The air pressure a particle feels. A solid feels the strongest pressure in
  // its own air block or the ones beside it: a sealed block has no air of its
  // own, and the last thin layer of a breached shell still has the full
  // pressure of the chamber behind it. `magnitude` counts suction too.
  pressureOn(x, y, d, magnitude = false) {
    const { p, W } = this.air;
    const a = this.air.at(x, y);
    const f = magnitude ? Math.abs : Number;
    const own = f(p[a]);
    if (d.state !== SOLID) return own;
    return Math.max(own, f(p[a - 1]), f(p[a + 1]), f(p[a - W]), f(p[a + W]));
  }

  // Is this particle on a surface, touching empty space or a fluid? Debris
  // still sitting against it shields it until the debris is blown clear.
  exposed(i, x, y) {
    const { w, h, type } = this;
    for (let k = 0; k < 4; k++) {
      const nx = k === 0 ? x + 1 : k === 1 ? x - 1 : x;
      const ny = k === 2 ? y + 1 : k === 3 ? y - 1 : y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      const u = type[j];
      if (u === 0 || DEFS[u].displaceable) return true;
    }
    return false;
  }

  // Radioactivity (warmth, particles thrown off, random decay), glowing-hot
  // filaments, hot crystals sparking, and flowers dropping fruit. Returns true
  // if i decayed. Radioactive elements barely stir until something disturbs
  // them: pressure here, or a passing particle (kick, in particles.js).
  radiate(i, x, y, d) {
    // In still air a radioactive element throws nothing off, and only warms
    // and decays at a trickle.
    let a = 1, trickle = 1;
    if (d.stable) {
      a = this.activity(x, y, d);
      trickle = a + REST;
    }
    if (d.selfHeat !== 0) this.temp[i] = Math.min(MAX_TEMP, this.temp[i] + d.selfHeat * trickle);
    if (d.emits !== null && a > 0) {
      for (const m of d.emits) if (this.rand() < m.chance * a) this.emitAt(m.id, x, y);
    }
    if (d.hotEmit !== null && this.temp[i] >= d.hotEmit.temp && this.rand() < d.hotEmit.chance) {
      this.emitAt(PHOTON, x, y);
    }
    // Pyroelectric crystals (tourmaline) build up a charge as they heat.
    if (d.hotSpark !== null && this.temp[i] >= d.hotSpark.temp && this.rand() < d.hotSpark.chance) {
      this.sparkNeighbors(x, y);
    }
    if (d.decay !== null && this.rand() < d.decay.chance * trickle) {
      this.decayCell(i, x, y, d.decay);
      return true;
    }
    if (d.produce !== null && this.rand() < d.produce.chance) {
      const p = d.produce;
      const { downX, downY } = this.gravity; // fruit drops below
      const bx = x + downX, by = y + downY;
      const j = this.inBounds(bx, by) && this.type[by * this.w + bx] === 0 ? by * this.w + bx : -1;
      if (j >= 0) this.spawn(j, p.id);
      if (j >= 0 || this.spawnNear(x, y, p.id) >= 0) this.record(p.id, p.rule);
    }
    return false;
  }

  // How stirred up a stable radioactive element is by the pressure on it
  // (squeezing or suction), as a multiple of its listed rates: 0 in still air.
  activity(x, y, d) {
    const p = this.pressureOn(x, y, d, true);
    if (p <= PRESSURE_WAKE) return 0;
    const a = (p - PRESSURE_WAKE) / PRESSURE_FULL;
    return a < MAX_ACTIVITY ? a : MAX_ACTIVITY;
  }

  // An atom decays: it may shed something beside it (helium, an alpha
  // particle), then becomes what it decays into.
  decayCell(i, x, y, o) {
    if (o.spawn >= 0 && this.spawnNear(x, y, o.spawn) >= 0) this.record(o.spawn, o.spawnRule);
    if (o.alt >= 0 && this.rand() < o.altChance) this.convert(i, o.alt, true, o.altRule);
    else this.convert(i, o.to, true, o.rule);
  }

  // Apply a contact reaction between i (at x, y) and its neighbour j.
  // Returns true if i itself changed.
  react(i, j, x, y, r) {
    if (r.heat) {
      this.temp[i] = Math.min(MAX_TEMP, this.temp[i] + r.heat);
      this.temp[j] = Math.min(MAX_TEMP, this.temp[j] + r.heat);
    }
    const o = r.other;
    if (o.alt >= 0 && this.rand() < o.altChance) this.convert(j, o.alt, r.keepOther, o.altRule);
    else if (o.to >= 0) this.convert(j, o.to, r.keepOther, o.rule);
    if (r.spawn >= 0 && this.spawnNear(x, y, r.spawn) >= 0) this.record(r.spawn, r.spawnRule);
    for (const e of r.emit) {
      this.emitAt(e.id, x, y);
      this.record(e.id, e.rule);
    }
    if (r.explode) this.blast(x, y, r.explode);
    const s = r.self;
    if (s.alt >= 0 && this.rand() < s.altChance) { this.convert(i, s.alt, r.keepSelf, s.altRule); return true; }
    if (s.to >= 0) { this.convert(i, s.to, r.keepSelf, s.rule); return true; }
    return false;
  }

  // ---- movement -----------------------------------------------------------
  //
  // "Down" is wherever gravity pulls (see gravity.js): the pull and its
  // direction come from the air block's entry in the gravity table. With the
  // arrow straight down at strength 1 every formula below reduces exactly to
  // plain falling.

  // Can a particle of def `d` move into cell j? dy is the direction of the
  // move along gravity (+1 with it, -1 against it, 0 across).
  canEnter(d, j, dy) {
    const u = this.type[j];
    if (u === 0) return true;
    const e = DEFS[u];
    if (!e.displaceable) {
      // Neutronium sinks through powders; liquids drain through gravel.
      if (dy > 0 && d.crush && e.state === POWDER && d.density > e.density) return true;
      if (e.permeable && d.state === LIQUID && dy >= 0) return this.rand() < 0.3;
      return false;
    }
    if (dy > 0) {
      if (d.density <= e.density) return false;
      // Powders sink through liquids more slowly than they fall through air.
      return d.state !== POWDER || e.state !== LIQUID || this.rand() < 0.5;
    }
    if (dy < 0) return d.density < e.density;
    if (e.state === LIQUID) return false;
    if (d.state === GAS || d.state === ENERGY) return this.rand() < 0.3;
    return true;
  }

  // Move along (vx, vy) one cell at a time, stopping at the first obstacle,
  // with gravity straight down. Returns the particle's new index. Sets
  // this.blockedMoving if it hit something.
  travel(i, x, y, vx, vy, d) {
    const ax = vx < 0 ? -vx : vx, ay = vy < 0 ? -vy : vy;
    const n = Math.ceil(ax > ay ? ax : ay);
    const rx = this.rand(), ry = this.rand();
    let cur = i, cx = x, cy = y;
    this.blockedMoving = false;
    this.vanished = false;
    for (let s = 1; s <= n; s++) {
      const nx = x + Math.floor((vx * s) / n + rx);
      const ny = y + Math.floor((vy * s) / n + ry);
      if (nx === cx && ny === cy) continue;
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) {
        if (this.voidEdges !== 0 && this.offEdge(nx, ny)) { this.clearCell(cur); this.vanished = true; return cur; }
        this.blockedMoving = true;
        break;
      }
      const j = ny * this.w + nx;
      if (!this.canEnter(d, j, ny - cy)) { this.blockedMoving = true; break; }
      this.swap(cur, j);
      cur = j; cx = nx; cy = ny;
    }
    return cur;
  }

  // The same, where (ux, uy) is which way is down: what the particle can
  // sink or rise through depends on whether a step goes with gravity or
  // against it.
  travelAlong(i, x, y, vx, vy, d, ux, uy) {
    const ax = vx < 0 ? -vx : vx, ay = vy < 0 ? -vy : vy;
    const n = Math.ceil(ax > ay ? ax : ay);
    const rx = this.rand(), ry = this.rand();
    let cur = i, cx = x, cy = y;
    this.blockedMoving = false;
    this.vanished = false;
    for (let s = 1; s <= n; s++) {
      const nx = x + Math.floor((vx * s) / n + rx);
      const ny = y + Math.floor((vy * s) / n + ry);
      if (nx === cx && ny === cy) continue;
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) {
        if (this.voidEdges !== 0 && this.offEdge(nx, ny)) { this.clearCell(cur); this.vanished = true; return cur; }
        this.blockedMoving = true;
        break;
      }
      const j = ny * this.w + nx;
      const along = (nx - cx) * ux + (ny - cy) * uy;
      if (!this.canEnter(d, j, along > 0.3 ? 1 : along < -0.3 ? -1 : 0)) { this.blockedMoving = true; break; }
      this.swap(cur, j);
      cur = j; cx = nx; cy = ny;
    }
    return cur;
  }

  // Wind pushes the particle along, drag slows it down, gravity pulls it:
  // (gx, gy) is the pull in g at air block a.
  pushByAir(i, a, d, gx, gy) {
    const k = d.airDrag;
    const drag = 1 - d.drag;
    let vx = this.vx[i] * drag + this.air.cvx(a) * k + gx * GRAVITY;
    let vy = this.vy[i] * drag + this.air.cvy(a) * k + gy * GRAVITY;
    const m = d.maxSpeed;
    if (vx > m) vx = m; else if (vx < -m) vx = -m;
    if (vy > m) vy = m; else if (vy < -m) vy = -m;
    this.vx[i] = vx;
    this.vy[i] = vy;
  }

  // Which way a particle in air block a falls this frame: a ring direction,
  // or -1 when there's no gravity or it's too weak to pull it a cell.
  downAt(a) {
    const g = this.gravity;
    let k = g.dirA[a];
    if (k < 0) return -1;
    const m = g.mag[a];
    if (m < 1 && this.rand() >= m) return -1;
    const mix = g.mix[a];
    if (mix > 0 && this.rand() < mix) k = g.dirB[a];
    return k;
  }

  // Stop cell i's motion along gravity and keep `keep` of the rest, as a
  // grain does when it lands.
  stopAlong(i, ux, uy, keep) {
    const vx = this.vx[i], vy = this.vy[i];
    const along = vx * ux + vy * uy;
    this.vx[i] = (vx - along * ux) * keep;
    this.vy[i] = (vy - along * uy) * keep;
  }

  movePowder(i, x, y, d) {
    const g = this.gravity;
    if (g.straight) { this.movePowderDown(i, x, y, d); return; }
    const a = this.air.at(x, y);
    this.pushByAir(i, a, d, g.gx[a], g.gy[a]);
    if (d.fallRate < 1 && this.rand() > d.fallRate) return;
    const ux = g.ux[a], uy = g.uy[a];
    const k = this.downAt(a);
    let vx = this.vx[i], vy = this.vy[i];
    // A slow grain still drops a cell a frame.
    if (k >= 0) {
      const along = vx * ux + vy * uy;
      if (along < 1 && along > -0.5) { vx = vx - along * ux + ux; vy = vy - along * uy + uy; }
    }
    const j = this.travelAlong(i, x, y, vx, vy, d, ux, uy);
    if (this.vanished) return;
    if (j !== i) {
      if (this.blockedMoving) this.stopAlong(j, ux, uy, 0.5);
      return;
    }
    if (k < 0) { // not falling this frame, just drifting
      if (this.blockedMoving) this.stopAlong(i, ux, uy, 0.5);
      return;
    }
    // Blocked straight away: slide off diagonally, like a grain on a slope.
    if (this.inBounds(x + DX8[k], y + DY8[k])) {
      let s = this.rand() < 0.5 ? 1 : 7;
      for (let n = 0; n < 2; n++, s = 8 - s) {
        const r = (k + s) & 7;
        const nx = x + DX8[r], ny = y + DY8[r];
        if (!this.inBounds(nx, ny)) continue;
        const jj = ny * this.w + nx;
        if (this.canEnter(d, jj, 1)) {
          this.swap(i, jj);
          this.vx[jj] = 0.5 * ux;
          this.vy[jj] = 0.5 * uy;
          return;
        }
      }
    }
    this.stopAlong(i, ux, uy, 0.5);
  }

  moveLiquid(i, x, y, d) {
    const g = this.gravity;
    if (g.straight) { this.moveLiquidDown(i, x, y, d); return; }
    const a = this.air.at(x, y);
    this.pushByAir(i, a, d, g.gx[a], g.gy[a]);
    const ux = g.ux[a], uy = g.uy[a];
    const k = this.downAt(a);
    const pvx = this.vx[i], pvy = this.vy[i];
    let vx = pvx, vy = pvy;
    if (k >= 0) {
      const along = vx * ux + vy * uy;
      if (along < 1 && along > -0.5) { vx = vx - along * ux + ux; vy = vy - along * uy + uy; }
    }
    const j = this.travelAlong(i, x, y, vx, vy, d, ux, uy);
    if (this.vanished) return;
    if (j !== i) {
      if (this.blockedMoving) this.stopAlong(j, ux, uy, 1);
      return;
    }
    if (k < 0) {
      if (this.blockedMoving) this.stopAlong(i, ux, uy, 1);
      return;
    }
    const { w } = this;
    // "Sideways" is across gravity: +1 is (px, py), a quarter turn
    // anticlockwise from down (so right, when down is down).
    const px = uy, py = -ux;
    const across = pvx * px + pvy * py;
    const flow = across > 0.05 ? 1 : across < -0.05 ? -1 : (this.rand() < 0.5 ? -1 : 1);
    const fx = DX8[k], fy = DY8[k];

    // Diagonal down.
    if (this.inBounds(x + fx, y + fy)) {
      for (let n = 0, dir = flow; n < 2; n++, dir = -dir) {
        const r = (k + (dir > 0 ? 7 : 1)) & 7;
        const nx = x + DX8[r], ny = y + DY8[r];
        if (!this.inBounds(nx, ny)) continue;
        const jj = ny * w + nx;
        if (this.canEnter(d, jj, 1)) {
          this.swap(i, jj);
          this.vx[jj] = dir * 0.5 * px + 0.5 * ux;
          this.vy[jj] = dir * 0.5 * py + 0.5 * uy;
          return;
        }
      }
    }

    // Flow sideways, remembering the direction so the liquid keeps going.
    // A liquid only rushes sideways when something is pressing down on it or
    // there is a drop to fall into; otherwise a thin film would skitter back
    // and forth forever. Liquid stacked on liquid creeps one cell at a time
    // so puddles still flatten out; a film on bare ground barely moves.
    this.stopAlong(i, ux, uy, 1);
    if (d.viscosity > 0 && this.rand() < d.viscosity) return;
    const ax = x - fx, ay = y - fy;
    const above = this.inBounds(ax, ay) ? DEFS[this.type[ay * w + ax]].state : 0;
    const pushed = above === LIQUID || above === POWDER;
    const bx = x + fx, by = y + fy;
    const creep = this.inBounds(bx, by) && DEFS[this.type[by * w + bx]].state === LIQUID ? 0.1 : 0.01;
    for (let n = 0, dir = flow; n < 2; n++, dir = -dir) {
      const r = (k + (dir > 0 ? 6 : 2)) & 7;
      const sx = DX8[r], sy = DY8[r];
      let target = -1;
      let drop = false;
      for (let s = 1; s <= d.spread; s++) {
        const nx = x + sx * s, ny = y + sy * s;
        if (!this.inBounds(nx, ny)) {
          // A void side is a cliff edge: the liquid pours off it.
          if (this.voidEdges !== 0 && this.offEdge(nx, ny)) { if (s === 1) { this.clearCell(i); return; } drop = true; }
          break;
        }
        const jj = ny * w + nx;
        if (!this.canEnter(d, jj, 0)) break;
        target = jj;
        const dx = nx + fx, dy = ny + fy;
        if (this.inBounds(dx, dy) && this.canEnter(d, dy * w + dx, 1)) { drop = true; break; }
      }
      if (target < 0) continue;
      if (!drop && !pushed) {
        if (this.rand() < creep) target = (y + sy) * w + x + sx; else continue;
      }
      this.swap(i, target);
      this.vx[target] = dir * 0.5 * px;
      this.vy[target] = dir * 0.5 * py;
      return;
    }
    this.vx[i] = -flow * 0.1 * px;
    this.vy[i] = -flow * 0.1 * py;
  }

  // Gases (and drifting energy) rise against the gravity arrow and sink
  // along it, with a random jitter across it.
  moveGas(i, x, y, d) {
    const g = this.gravity;
    if (g.straight) { this.moveGasUp(i, x, y, d); return; }
    const a = this.air.at(x, y);
    // Newtonian gravity pulls gases too, but only through their velocity.
    if (g.newtonian) this.pushByAir(i, a, d, g.fx[a], g.fy[a]);
    else this.pushByAir(i, a, d, 0, 0);
    const vx = this.vx[i], vy = this.vy[i];
    if (d.drift < 1 && this.rand() > d.drift && vx * vx + vy * vy < 0.25) return;
    let k = g.gasDir;
    if (g.gasMix > 0 && this.rand() < g.gasMix) k = g.gasDirB;
    const c = (k + 6) & 7; // across, a quarter turn from down
    const cx = DX8[c], cy = DY8[c], fx = DX8[k], fy = DY8[k];
    const lift = g.lift;
    const rise = lift > 0 ? d.rise * lift : ZERO_G_RISE;
    const sink = lift > 0 ? d.sink * lift : ZERO_G_SINK;
    const jitter = ((this.rand() * 3) | 0) - 1;
    const driftX = Math.floor(vx + this.rand());
    const lean = this.rand() < rise ? -1 : this.rand() < sink ? 1 : 0;
    const driftY = Math.floor(vy + this.rand());
    let dx = jitter * cx + lean * fx + driftX;
    let dy = jitter * cy + lean * fy + driftY;
    if (dx > 3) dx = 3; else if (dx < -3) dx = -3;
    if (dy > 3) dy = 3; else if (dy < -3) dy = -3;
    if (dx === 0 && dy === 0) return;
    const j = this.travelAlong(i, x, y, dx, dy, d, g.gasUx, g.gasUy);
    if (this.vanished) return;
    if (j !== i) return;
    const side = this.rand() < 0.5 ? -1 : 1;
    const nx = x + side * cx, ny = y + side * cy;
    if (this.inBounds(nx, ny)) { if (this.canEnter(d, ny * this.w + nx, 0)) this.swap(i, ny * this.w + nx); }
    else if (this.voidEdges !== 0 && this.offEdge(nx, ny)) this.clearCell(i);
  }

  // ---- straight-down fast paths ------------------------------------------
  //
  // With the arrow straight down at normal strength or more, and Newtonian
  // gravity off (the usual case), movement runs the plain falling-sand code
  // below. It gives the same results as the general code above, which is
  // about a fifth slower.

  movePowderDown(i, x, y, d) {
    this.pushByAir(i, this.air.at(x, y), d, 0, this.gravity.ugy);
    if (d.fallRate < 1 && this.rand() > d.fallRate) return;
    const vx = this.vx[i], vy = this.vy[i];
    const ty = vy < 1 && vy > -0.5 ? 1 : vy;
    const j = this.travel(i, x, y, vx, ty, d);
    if (this.vanished) return;
    if (j !== i) {
      if (this.blockedMoving) { this.vx[j] *= 0.5; this.vy[j] = 0; }
      return;
    }
    // Blocked straight away: slide off diagonally, like a grain on a slope.
    if (y + 1 < this.h) {
      let dir = this.rand() < 0.5 ? -1 : 1;
      for (let k = 0; k < 2; k++, dir = -dir) {
        const nx = x + dir;
        if (nx < 0 || nx >= this.w) continue;
        const jj = i + this.w + dir;
        if (this.canEnter(d, jj, 1)) {
          this.swap(i, jj);
          this.vx[jj] = 0;
          this.vy[jj] = 0.5;
          return;
        }
      }
    }
    this.vx[i] *= 0.5;
    this.vy[i] = 0;
  }

  moveLiquidDown(i, x, y, d) {
    this.pushByAir(i, this.air.at(x, y), d, 0, this.gravity.ugy);
    const vx = this.vx[i], vy = this.vy[i];
    const ty = vy < 1 && vy > -0.5 ? 1 : vy;
    const j = this.travel(i, x, y, vx, ty, d);
    if (this.vanished) return;
    if (j !== i) {
      if (this.blockedMoving) this.vy[j] = 0;
      return;
    }
    const { w, h } = this;
    const flow = vx > 0.05 ? 1 : vx < -0.05 ? -1 : (this.rand() < 0.5 ? -1 : 1);

    // Diagonal down.
    if (y + 1 < h) {
      for (let k = 0, dir = flow; k < 2; k++, dir = -dir) {
        const nx = x + dir;
        if (nx < 0 || nx >= w) continue;
        const jj = i + w + dir;
        if (this.canEnter(d, jj, 1)) {
          this.swap(i, jj);
          this.vx[jj] = dir * 0.5;
          this.vy[jj] = 0.5;
          return;
        }
      }
    }

    // Flow sideways (see moveLiquid).
    this.vy[i] = 0;
    if (d.viscosity > 0 && this.rand() < d.viscosity) return;
    const above = y > 0 ? DEFS[this.type[i - w]].state : 0;
    const pushed = above === LIQUID || above === POWDER;
    const creep = y + 1 < h && DEFS[this.type[i + w]].state === LIQUID ? 0.1 : 0.01;
    for (let k = 0, dir = flow; k < 2; k++, dir = -dir) {
      let target = -1;
      let drop = false;
      for (let s = 1; s <= d.spread; s++) {
        const nx = x + dir * s;
        if (nx < 0 || nx >= w) {
          if (this.voidEdges !== 0 && this.offEdge(nx, y)) { if (s === 1) { this.clearCell(i); return; } drop = true; }
          break;
        }
        const jj = i + dir * s;
        if (!this.canEnter(d, jj, 0)) break;
        target = jj;
        if (y + 1 < h && this.canEnter(d, jj + w, 1)) { drop = true; break; }
      }
      if (target < 0) continue;
      if (!drop && !pushed) {
        if (this.rand() < creep) target = i + dir; else continue;
      }
      this.swap(i, target);
      this.vx[target] = dir * 0.5;
      return;
    }
    this.vx[i] = -flow * 0.1;
  }

  moveGasUp(i, x, y, d) {
    this.pushByAir(i, this.air.at(x, y), d, 0, 0);
    const vx = this.vx[i], vy = this.vy[i];
    if (d.drift < 1 && this.rand() > d.drift && vx * vx + vy * vy < 0.25) return;
    let dx = ((this.rand() * 3) | 0) - 1 + Math.floor(vx + this.rand());
    let dy = (this.rand() < d.rise ? -1 : this.rand() < d.sink ? 1 : 0) + Math.floor(vy + this.rand());
    if (dx > 3) dx = 3; else if (dx < -3) dx = -3;
    if (dy > 3) dy = 3; else if (dy < -3) dy = -3;
    if (dx === 0 && dy === 0) return;
    const j = this.travel(i, x, y, dx, dy, d);
    if (this.vanished) return;
    if (j !== i) return;
    const nx = x + (this.rand() < 0.5 ? -1 : 1);
    if (nx >= 0 && nx < this.w) { if (this.canEnter(d, i - x + nx, 0)) this.swap(i, i - x + nx); }
    else if (this.voidEdges !== 0 && this.offEdge(nx, y)) this.clearCell(i);
  }

  // ---- heat -----------------------------------------------------------------

  conductHeat() {
    const { w, h, type, temp } = this;
    const heat = this.air.heat;
    const sides = this.voidEdges;
    let count = 0;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        const t = type[i];
        if (t === 0) continue;
        count++;
        const ka = COND[t];
        let T = temp[i];
        let open = 0;
        if (x < w - 1) {
          const u = type[i + 1];
          if (u === 0) open++;
          else if (ka > 0) {
            const kb = COND[u];
            const k = (ka < kb ? ka : kb) * 0.2;
            if (k > 0) { const f = (T - temp[i + 1]) * k; T -= f; temp[i + 1] += f; }
          }
        }
        if (y < h - 1) {
          const u = type[i + w];
          if (u === 0) open++;
          else if (ka > 0) {
            const kb = COND[u];
            const k = (ka < kb ? ka : kb) * 0.2;
            if (k > 0) { const f = (T - temp[i + w]) * k; T -= f; temp[i + w] += f; }
          }
        }
        if (x > 0 && type[i - 1] === 0) open++;
        if (y > 0 && type[i - w] === 0) open++;
        // Heat escapes through a void edge as through open air.
        if (sides !== 0 && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) {
          const out = (x === 0 && (sides & VOID_LEFT) !== 0 ? 1 : 0) + (x === w - 1 && (sides & VOID_RIGHT) !== 0 ? 1 : 0)
            + (y === 0 && (sides & VOID_TOP) !== 0 ? 1 : 0) + (y === h - 1 && (sides & VOID_BOTTOM) !== 0 ? 1 : 0);
          if (out) T += (AMBIENT - T) * AIR_COOL[t] * out;
        }
        if (open) {
          if (!heat) T += (AMBIENT - T) * AIR_COOL[t] * open;
          else {
            // Convection: heat goes into the air of each empty cell beside it.
            const r = AIR_COOL[t];
            if (x < w - 1 && type[i + 1] === 0) T = this.warmAir(x + 1, y, T, r);
            if (y < h - 1 && type[i + w] === 0) T = this.warmAir(x, y + 1, T, r);
            if (x > 0 && type[i - 1] === 0) T = this.warmAir(x - 1, y, T, r);
            if (y > 0 && type[i - w] === 0) T = this.warmAir(x, y - 1, T, r);
          }
        }
        temp[i] = T;
      }
    }
    this.count = count;
  }

  // Convection: a particle trades heat with the air in the empty cell (x,
  // y) beside it, instead of with the room. The air warms more than the
  // particle cools (it holds little heat) and swells as it warms. Returns
  // the particle's new temperature.
  warmAir(x, y, T, rate) {
    const air = this.air;
    const a = air.at(x, y);
    if (air.blocked[a]) return T + (AMBIENT - T) * rate; // no air of its own
    const was = air.t[a];
    const f = (was - T) * rate;
    const now = T + f;
    let t = was - f * AIR_SHARE;
    if ((f < 0 && t > now) || (f > 0 && t < now)) t = now; // never past the particle
    air.t[a] = t;
    return now;
  }

  // Convection on or off. Off, the air forgets any heat it held.
  setConvection(on) {
    this.air.heat = !!on;
    if (!on) this.air.coolAll();
  }

  // ---- tools (used by the game and by tests) -------------------------------

  // Visit every cell within radius r of (cx, cy). Radius 0 is a single cell.
  forCircle(cx, cy, r, fn) {
    const r2 = r * r + r * 0.8;
    for (let dy = -r; dy <= r; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= this.h) continue;
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        if (x < 0 || x >= this.w || dx * dx + dy * dy > r2) continue;
        fn(y * this.w + x, x, y);
      }
    }
  }

  // Visit every cell in the rectangle between two corners (in any order).
  forRect(x0, y0, x1, y1, fn) {
    const xa = Math.max(0, Math.min(x0, x1)), xb = Math.min(this.w - 1, Math.max(x0, x1));
    const ya = Math.max(0, Math.min(y0, y1)), yb = Math.min(this.h - 1, Math.max(y0, y1));
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) fn(y * this.w + x, x, y);
    }
  }

  // The area under the brush: a circle, or a square when brushShape is 'square'.
  brushArea(cx, cy, r) {
    return this.brushShape === 'square'
      ? (fn) => this.forRect(cx - r, cy - r, cx + r, cy + r, fn)
      : (fn) => this.forCircle(cx, cy, r, fn);
  }

  // The tools below each take an `area` (a function that visits cells), so
  // the same code paints under the brush, along a line, or across a box.
  paintArea(area, t, density = 1) {
    if (DEFS[t].projectile) {
      // Flying particles are sprayed out in random directions.
      area((i, x, y) => {
        if (this.rand() < density * 0.15) this.spawnProjectile(t, x + this.rand(), y + this.rand());
      });
      return;
    }
    area((i) => {
      const u = this.type[i];
      if (t === SPARK) {
        // Spark painted onto a wire, a switch or a machine (or an open door).
        if (CONDUCTOR[u]) { if (this.life[i] === 0) this.sparkAt(i); return; }
        if (PRESSABLE[u]) { this.press(i); return; }
        if (POWERED[u] || (u === 0 && this.doorTimer[i] !== 0)) { this.powerCell(i); return; }
      }
      // With Replace on, whatever is in the way is overwritten (but painting
      // an element over itself leaves it be).
      if (u !== 0 && (!this.replace || u === t)) return;
      if (density >= 1 || this.rand() < density) {
        if (u !== 0) this.clearCell(i);
        this.spawn(i, t);
      }
    });
  }

  eraseArea(area) {
    // Mark the cells, then remove flying particles in one pass over them.
    const mask = this.eraseMask ??= new Uint8Array(this.w * this.h);
    const cells = [];
    area((i) => {
      if (this.type[i]) this.clearCell(i);
      this.doorTimer[i] = 0; // an erased doorway doesn't shut again
      mask[i] = 1;
      cells.push(i);
    });
    for (let k = this.pn - 1; k >= 0; k--) {
      if (mask[(this.py[k] | 0) * this.w + (this.px[k] | 0)]) this.killProjectile(k);
    }
    for (const i of cells) mask[i] = 0;
  }

  // With convection on, the air under the brush warms or cools too (each
  // cell covered moves its air block a sixteenth of the way, so a block the
  // brush covers completely changes by `amount`), and swells or shrinks.
  heatArea(area, amount) {
    const air = this.air;
    const share = amount / (CELL * CELL);
    area((i, x, y) => {
      const t = this.type[i];
      if (t === WALL) return;
      if (air.heat) {
        const a = air.at(x, y);
        if (!air.blocked[a]) {
          const was = air.t[a], now = Math.min(MAX_TEMP, Math.max(MIN_TEMP, was + share));
          air.t[a] = now;
        }
      }
      if (!t) return;
      const T = this.temp[i] + amount;
      this.temp[i] = T > MAX_TEMP ? MAX_TEMP : T < MIN_TEMP ? MIN_TEMP : T;
    });
  }

  pressurizeArea(area, amount) {
    const seen = new Set();
    area((i, x, y) => {
      const a = this.air.at(x, y);
      if (seen.has(a)) return;
      seen.add(a);
      this.air.addPressure(a, amount);
    });
  }

  blowArea(area, dx, dy) {
    const seen = new Set();
    area((i, x, y) => {
      const a = this.air.at(x, y);
      if (seen.has(a) || this.air.blocked[a]) return;
      seen.add(a);
      this.air.addVelocity(a, dx, dy);
    });
  }

  paint(cx, cy, r, t, density = 1) { this.paintArea(this.brushArea(cx, cy, r), t, density); }
  erase(cx, cy, r) { this.eraseArea(this.brushArea(cx, cy, r)); }
  heat(cx, cy, r, amount) { this.heatArea(this.brushArea(cx, cy, r), amount); }
  pressurize(cx, cy, r, amount) { this.pressurizeArea(this.brushArea(cx, cy, r), amount); }
  blow(cx, cy, r, dx, dy) { this.blowArea(this.brushArea(cx, cy, r), dx, dy); }

  pressureAt(x, y) {
    return this.air.p[this.air.at(x, y)];
  }
}

Object.assign(World.prototype, Behaviors, Particles, Machines);
