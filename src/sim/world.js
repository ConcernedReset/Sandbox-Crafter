// The particle simulation. The world is a grid where every cell holds at
// most one particle; per-cell data lives in parallel typed arrays so the
// update loop stays fast. Each frame:
//   1. every particle runs its behaviour, radioactivity, phase changes,
//      reactions and movement (bottom row first, alternating direction)
//   2. flying particles (photons, neutrons...) move on their own layer
//   3. heat conducts between touching particles and leaks into open air
//   4. the air pressure grid steps forward
//
// Element behaviours live in behaviors.js and the flying-particle layer in
// particles.js; both are mixed into World below.
//
// Solids have a strength. When the air pressure around an exposed solid
// particle beats it (and heat weakens it), the particle is torn loose and
// becomes debris that the air can throw around.
//
// When a rule creates an element for the first time, it is pushed onto
// `discoveries` for the game layer to pick up.

import { Air, CELL } from './air.js';
import { DEFS, ID, NUM, State, AMBIENT, REACT } from './elements.js';
import { MAX_TEMP, MIN_TEMP, GRAVITY } from './constants.js';
import { COND, AIR_COOL, CONDUCTOR, AIRTIGHT } from './lookups.js';
import { Behaviors } from './behaviors.js';
import { Particles, initParticles } from './particles.js';

const { SOLID, POWDER, LIQUID, GAS, ENERGY } = State;
const { WALL, FIRE, ASH, SPARK, PHOTON } = ID;

// An air block is sealed once this many of its 16 cells are airtight solid:
// any unbroken line of strong solid across it.
const SEAL_COUNT = 4;

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
    this.seed = (seed >>> 0) || 1;
    this.seen = new Uint8Array(NUM);
    this.discoveries = [];
    this.count = 0;
    this.blockedMoving = false;
    this.brushShape = 'circle';
    initParticles(this);
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

  ignite(i, x, y) {
    const t = this.type[i];
    const d = DEFS[t];
    const b = d.burn;
    if (!b) return;
    if (b.launch) { // fireworks take off instead of burning
      if (this.ctype[i] !== 1) {
        this.ctype[i] = 1;
        this.life[i] = 25 + ((this.rand() * 25) | 0);
      }
      return;
    }
    if (d.explode) this.blast(x, y, d.explode);
    if (b.ash > 0 && this.rand() < b.ash) { this.convert(i, ASH, false, b.ashRule); return; }
    if (b.to !== FIRE && this.rand() < b.toChance) {
      this.convert(i, b.to, false, b.toRule);
      if (b.temp) this.temp[i] = b.temp;
      return;
    }
    this.convert(i, FIRE, false, -1);
    this.ctype[i] = t; // remember the fuel so the fire knows whether to leave smoke
    this.temp[i] = b.fireTemp;
    this.life[i] = b.fireLifeMin + ((this.rand() * (b.fireLifeMax - b.fireLifeMin + 1)) | 0);
  }

  // An explosion: a pressure spike in the air grid plus a direct shove
  // outward for loose particles nearby.
  blast(x, y, strength) {
    this.air.addPressure(this.air.at(x, y), strength);
    const r = Math.min(8, 2 + Math.round(Math.sqrt(strength)));
    const { w, h, type } = this;
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
        // Push outward; things below the blast bounce off the ground and
        // get thrown up, which digs a crater.
        const dist = Math.sqrt(d2);
        const f = (strength * 0.7) / dist;
        this.vx[j] += (dx / dist) * f;
        this.vy[j] += (dy < 0 ? dy / dist : -0.5 * dy / dist) * f - f * 0.4;
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

  // ---- main loop ----------------------------------------------------------

  step() {
    const { w, h, type, clock, air, loose } = this;
    const tick = ++this.tick;
    // Particles read last frame's complete blocked map while this frame's is built.
    const next = air.next;
    next.fill(0);
    air.solid.fill(0);
    for (let y = h - 1; y >= 0; y--) {
      const leftToRight = ((tick + y) & 1) === 0;
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
    this.computeField();
    this.stepProjectiles();
    this.conductHeat();
    air.step();
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

    const T = this.temp[i];
    const hi = d.high;
    if (hi !== null && T >= hi.temp && this.rand() < hi.chance) {
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
      const limit = was ? DEFS[was].high.temp - 40 : lo.temp;
      if (T <= limit && this.rand() < lo.chance) {
        if (was) this.convert(i, was, true, -1);
        else this.convert(i, lo.to, true, lo.rule);
        return;
      }
    }
    const pr = d.pressure;
    if (pr !== null && this.pressureOn(x, y, d) >= pr.above && this.rand() < pr.chance) {
      if (pr.ignite) this.ignite(i, x, y);
      else this.convert(i, pr.to, true, pr.rule);
      return;
    }
    if (d.burn !== null && T >= d.ignite && this.rand() < d.igniteChance) {
      this.ignite(i, x, y);
      return;
    }

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
  // if i decayed.
  radiate(i, x, y, d) {
    if (d.selfHeat !== 0) this.temp[i] = Math.min(MAX_TEMP, this.temp[i] + d.selfHeat);
    if (d.emits !== null) {
      for (const m of d.emits) if (this.rand() < m.chance) this.emitAt(m.id, x, y);
    }
    if (d.hotEmit !== null && this.temp[i] >= d.hotEmit.temp && this.rand() < d.hotEmit.chance) {
      this.emitAt(PHOTON, x, y);
    }
    // Pyroelectric crystals (tourmaline) build up a charge as they heat.
    if (d.hotSpark !== null && this.temp[i] >= d.hotSpark.temp && this.rand() < d.hotSpark.chance) {
      this.sparkNeighbors(x, y);
    }
    if (d.decay !== null && this.rand() < d.decay.chance) {
      const o = d.decay;
      if (o.spawn >= 0 && this.spawnNear(x, y, o.spawn) >= 0) this.record(o.spawn, o.spawnRule);
      if (o.alt >= 0 && this.rand() < o.altChance) this.convert(i, o.alt, true, o.altRule);
      else this.convert(i, o.to, true, o.rule);
      return true;
    }
    if (d.produce !== null && this.rand() < d.produce.chance) {
      const p = d.produce;
      const j = y + 1 < this.h && this.type[i + this.w] === 0 ? i + this.w : -1;
      if (j >= 0) this.spawn(j, p.id);
      if (j >= 0 || this.spawnNear(x, y, p.id) >= 0) this.record(p.id, p.rule);
    }
    return false;
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

  // Can a particle of def `d` move into cell j? dy is the vertical direction
  // of the move (+1 down, -1 up, 0 sideways).
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

  // Move along (vx, vy) one cell at a time, stopping at the first obstacle.
  // Returns the particle's new index. Sets this.blockedMoving if it hit something.
  travel(i, x, y, vx, vy, d) {
    const ax = vx < 0 ? -vx : vx, ay = vy < 0 ? -vy : vy;
    const n = Math.ceil(ax > ay ? ax : ay);
    const rx = this.rand(), ry = this.rand();
    let cur = i, cx = x, cy = y;
    this.blockedMoving = false;
    for (let s = 1; s <= n; s++) {
      const nx = x + Math.floor((vx * s) / n + rx);
      const ny = y + Math.floor((vy * s) / n + ry);
      if (nx === cx && ny === cy) continue;
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) { this.blockedMoving = true; break; }
      const j = ny * this.w + nx;
      if (!this.canEnter(d, j, ny - cy)) { this.blockedMoving = true; break; }
      this.swap(cur, j);
      cur = j; cx = nx; cy = ny;
    }
    return cur;
  }

  // Wind pushes the particle along, drag slows it down, gravity pulls it.
  pushByAir(i, x, y, d, gravity) {
    const a = this.air.at(x, y);
    const k = d.airDrag;
    const drag = 1 - d.drag;
    let vx = this.vx[i] * drag + this.air.cvx(a) * k;
    let vy = this.vy[i] * drag + this.air.cvy(a) * k + gravity;
    const m = d.maxSpeed;
    if (vx > m) vx = m; else if (vx < -m) vx = -m;
    if (vy > m) vy = m; else if (vy < -m) vy = -m;
    this.vx[i] = vx;
    this.vy[i] = vy;
  }

  movePowder(i, x, y, d) {
    this.pushByAir(i, x, y, d, GRAVITY);
    if (d.fallRate < 1 && this.rand() > d.fallRate) return;
    const vx = this.vx[i], vy = this.vy[i];
    const ty = vy < 1 && vy > -0.5 ? 1 : vy;
    const j = this.travel(i, x, y, vx, ty, d);
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

  moveLiquid(i, x, y, d) {
    this.pushByAir(i, x, y, d, GRAVITY);
    const vx = this.vx[i], vy = this.vy[i];
    const ty = vy < 1 && vy > -0.5 ? 1 : vy;
    const j = this.travel(i, x, y, vx, ty, d);
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

    // Flow sideways, remembering the direction so the liquid keeps going.
    // A liquid only rushes sideways when something is pressing down on it or
    // there is a drop to fall into; otherwise a thin film would skitter back
    // and forth forever. Liquid stacked on liquid creeps one cell at a time
    // so puddles still flatten out; a film on bare ground barely moves.
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
        if (nx < 0 || nx >= w) break;
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

  moveGas(i, x, y, d) {
    this.pushByAir(i, x, y, d, 0);
    const vx = this.vx[i], vy = this.vy[i];
    if (d.drift < 1 && this.rand() > d.drift && vx * vx + vy * vy < 0.25) return;
    let dx = ((this.rand() * 3) | 0) - 1 + Math.floor(vx + this.rand());
    let dy = (this.rand() < d.rise ? -1 : this.rand() < d.sink ? 1 : 0) + Math.floor(vy + this.rand());
    if (dx > 3) dx = 3; else if (dx < -3) dx = -3;
    if (dy > 3) dy = 3; else if (dy < -3) dy = -3;
    if (dx === 0 && dy === 0) return;
    const j = this.travel(i, x, y, dx, dy, d);
    if (j !== i) return;
    const nx = x + (this.rand() < 0.5 ? -1 : 1);
    if (nx >= 0 && nx < this.w && this.canEnter(d, i - x + nx, 0)) this.swap(i, i - x + nx);
  }

  // ---- heat -----------------------------------------------------------------

  conductHeat() {
    const { w, h, type, temp } = this;
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
        if (open) T += (AMBIENT - T) * AIR_COOL[t] * open;
        temp[i] = T;
      }
    }
    this.count = count;
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
      if (t === SPARK && CONDUCTOR[u] && this.life[i] === 0) { this.sparkAt(i); return; }
      if (u === 0 && (density >= 1 || this.rand() < density)) this.spawn(i, t);
    });
  }

  eraseArea(area) {
    // Mark the cells, then remove flying particles in one pass over them.
    const mask = this.eraseMask ??= new Uint8Array(this.w * this.h);
    const cells = [];
    area((i) => {
      if (this.type[i]) this.clearCell(i);
      mask[i] = 1;
      cells.push(i);
    });
    for (let k = this.pn - 1; k >= 0; k--) {
      if (mask[(this.py[k] | 0) * this.w + (this.px[k] | 0)]) this.killProjectile(k);
    }
    for (const i of cells) mask[i] = 0;
  }

  heatArea(area, amount) {
    area((i) => {
      if (!this.type[i] || this.type[i] === WALL) return;
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

Object.assign(World.prototype, Behaviors, Particles);
