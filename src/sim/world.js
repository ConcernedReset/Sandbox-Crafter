// The particle simulation. The world is a grid where every cell holds at
// most one particle; per-cell data lives in parallel typed arrays so the
// update loop stays fast. Each frame:
//   1. every particle runs its behaviour, phase changes, reactions and
//      movement (bottom row first, alternating direction to avoid bias)
//   2. heat conducts between touching particles and leaks into open air
//   3. the air pressure grid steps forward
//
// When a rule creates an element for the first time, it is pushed onto
// `discoveries` for the game layer to pick up.

import { Air, CELL } from './air.js';
import { DEFS, ID, NUM, State, AMBIENT, REACT, SPECIAL } from './elements.js';

const { SOLID, POWDER, LIQUID, GAS, ENERGY } = State;
const {
  WALL, FIRE, SMOKE, ASH, WATER, SNOW, PLANT, WOOD, SPARK, LIGHTNING, CLONE, VOID,
} = ID;

const GRAVITY = 0.12;
const SPARK_COOLDOWN = 6;
export const MAX_TEMP = 9999;
export const MIN_TEMP = -273;

// Per-element lookups used in the hot loops.
const COND = new Float32Array(NUM);
const AIR_COOL = new Float32Array(NUM);
const CONDUCTOR = new Uint8Array(NUM);
const CLONEABLE = new Uint8Array(NUM);
for (const d of DEFS) {
  COND[d.id] = d.conduct;
  AIR_COOL[d.id] = d.id === 0 ? 0 : d.airCool;
  CONDUCTOR[d.id] = d.conductor ? 1 : 0;
  CLONEABLE[d.id] = d.id !== 0 && ![WALL, CLONE, VOID, SPARK, LIGHTNING].includes(d.id) ? 1 : 0;
}

export class World {
  constructor(width, height, seed = 12345) {
    this.w = width;
    this.h = height;
    const n = width * height;
    this.type = new Uint8Array(n);
    this.temp = new Float32Array(n).fill(AMBIENT);
    this.life = new Int16Array(n);
    this.ctype = new Uint8Array(n); // spark: conductor underneath; fire: fuel; clone: copied element
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.shade = new Uint8Array(n); // random per particle, picks a colour variant
    this.clock = new Uint32Array(n); // tick on which the cell was last updated
    this.tick = 1;
    this.air = new Air(Math.ceil(width / CELL), Math.ceil(height / CELL));
    this.seed = (seed >>> 0) || 1;
    this.seen = new Uint8Array(NUM);
    this.discoveries = [];
    this.count = 0;
    this.blockedMoving = false;
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
  }

  clearAll() {
    this.type.fill(0);
    this.temp.fill(AMBIENT);
    this.life.fill(0);
    this.ctype.fill(0);
    this.vx.fill(0);
    this.vy.fill(0);
    this.air.clear();
  }

  initLife(i, t) {
    const d = DEFS[t];
    this.life[i] = d.lifeMax ? d.lifeMin + ((this.rand() * (d.lifeMax - d.lifeMin + 1)) | 0) : 0;
  }

  // Place a fresh particle (used by painting and by clones).
  spawn(i, t) {
    const d = DEFS[t];
    this.type[i] = t;
    this.temp[i] = d.temp;
    this.ctype[i] = 0;
    this.vx[i] = 0;
    this.vy[i] = 0;
    this.shade[i] = (this.rand() * 256) | 0;
    this.initLife(i, t);
    this.clock[i] = this.tick;
  }

  // Turn an existing particle into something else as the result of a rule.
  convert(i, to, keepTemp, rule) {
    if (to === 0) { this.clearCell(i); return; }
    this.type[i] = to;
    this.ctype[i] = 0;
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
    const { type, temp, life, ctype, vx, vy, shade } = this;
    let a;
    a = type[i]; type[i] = type[j]; type[j] = a;
    a = temp[i]; temp[i] = temp[j]; temp[j] = a;
    a = life[i]; life[i] = life[j]; life[j] = a;
    a = ctype[i]; ctype[i] = ctype[j]; ctype[j] = a;
    a = vx[i]; vx[i] = vx[j]; vx[j] = a;
    a = vy[i]; vy[i] = vy[j]; vy[j] = a;
    a = shade[i]; shade[i] = shade[j]; shade[j] = a;
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
        if (e.explode > 0 && this.temp[j] < e.ignite) this.temp[j] = e.ignite + 1;
        const s = e.state;
        if (s !== POWDER && s !== LIQUID && s !== GAS) continue;
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
    const { w, h, type, clock, air } = this;
    const tick = ++this.tick;
    air.blocked.fill(0);
    for (let y = h - 1; y >= 0; y--) {
      const leftToRight = ((tick + y) & 1) === 0;
      const row = y * w;
      for (let k = 0; k < w; k++) {
        const x = leftToRight ? k : w - 1 - k;
        const i = row + x;
        const t = type[i];
        if (t === 0) continue;
        if (t === WALL) { air.blocked[air.at(x, y)] = 1; continue; }
        if (clock[i] === tick) continue;
        clock[i] = tick;
        this.update(i, x, y, t);
      }
    }
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

    if (d.behavior !== null && this.behave(d.behavior, i, x, y, t, d)) return;

    const T = this.temp[i];
    const hi = d.high;
    if (hi !== null && T >= hi.temp && this.rand() < hi.chance) {
      if (hi.alt >= 0 && this.rand() < hi.altChance) this.convert(i, hi.alt, true, hi.altRule);
      else this.convert(i, hi.to, true, hi.rule);
      return;
    }
    const lo = d.low;
    if (lo !== null && T <= lo.temp && this.rand() < lo.chance) {
      this.convert(i, lo.to, true, lo.rule);
      return;
    }
    const pr = d.pressure;
    if (pr !== null && this.air.p[this.air.at(x, y)] >= pr.above && this.rand() < pr.chance) {
      if (pr.ignite) this.ignite(i, x, y);
      else this.convert(i, pr.to, true, pr.rule);
      return;
    }
    if (d.flammable > 0 && T >= d.ignite && this.rand() < d.igniteChance) {
      this.ignite(i, x, y);
      return;
    }

    if (d.reactive) {
      const j = this.randomNeighbor(x, y);
      if (j >= 0) {
        const u = this.type[j];
        if (u !== 0) {
          const r = REACT[t * NUM + u];
          if (r !== null && this.rand() < r.chance) {
            if (r.otherTo >= 0) this.convert(j, r.otherTo, r.keepOther, r.otherRule);
            if (r.selfTo >= 0) { this.convert(i, r.selfTo, r.keepSelf, r.selfRule); return; }
          }
        }
      }
    }

    switch (d.state) {
      case POWDER: this.movePowder(i, x, y, d); break;
      case LIQUID: this.moveLiquid(i, x, y, d); break;
      case GAS: this.moveGas(i, x, y, d); break;
      case ENERGY: if (!d.fixed) this.moveGas(i, x, y, d); break;
      default: break;
    }
  }

  // ---- custom behaviours --------------------------------------------------
  // Each returns true if it fully handled the particle this frame.

  behave(name, i, x, y, t, d) {
    switch (name) {
      case 'fire': return this.burnOut(i, x, y, true);
      case 'plasma': return this.burnOut(i, x, y, false);
      case 'decay':
        if (--this.life[i] <= 0) { this.clearCell(i); return true; }
        return false;
      case 'spark': return this.updateSpark(i, x, y);
      case 'battery': return this.updateBattery(x, y);
      case 'plant': return this.updatePlant(i, x, y);
      case 'cloud': return this.updateCloud(i, x, y);
      case 'lightning': return this.updateLightning(i, x, y);
      case 'acid': return this.updateAcid(i, x, y);
      case 'clone': return this.updateClone(i, x, y);
      case 'void': return this.updateVoid(i, x, y);
      default: return false;
    }
  }

  // Fire and plasma: count down, ignite neighbours, maybe leave smoke.
  // Fire burning a solid or a non-explosive powder stays on its fuel as an
  // ember and throws loose flames upward, so logs burn in place.
  burnOut(i, x, y, smoky) {
    const fuel = this.ctype[i];
    if (--this.life[i] <= 0) {
      const b = fuel ? DEFS[fuel].burn : null;
      if (smoky && b && b.smoke > 0 && this.rand() < b.smoke) this.convert(i, SMOKE, false, b.smokeRule);
      else this.clearCell(i);
      return true;
    }
    this.igniteAround(x, y);
    if (fuel && smoky) {
      const f = DEFS[fuel];
      if (f.state === SOLID || (f.state === POWDER && f.explode === 0)) {
        if (y > 0 && this.rand() < 0.25 && this.type[i - this.w] === 0) {
          const j = i - this.w;
          this.spawn(j, FIRE);
          this.life[j] = 10 + ((this.rand() * 20) | 0);
          this.temp[j] = this.temp[i];
        }
        if (f.state === POWDER) this.movePowder(i, x, y, f);
        return true;
      }
    }
    return false;
  }

  igniteAround(x, y) {
    const { w, h } = this;
    for (let k = 0; k < 4; k++) {
      const nx = k === 0 ? x + 1 : k === 1 ? x - 1 : x;
      const ny = k === 2 ? y + 1 : k === 3 ? y - 1 : y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      const f = DEFS[this.type[j]].flammable;
      if (f > 0 && this.rand() < f) this.ignite(j, nx, ny);
    }
  }

  updateSpark(i, x, y) {
    const { w, h, type } = this;
    if (this.life[i] >= 3) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if ((dx === 0 && dy === 0) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          const u = type[j];
          if (CONDUCTOR[u] && this.life[j] === 0) this.sparkAt(j);
          else if (DEFS[u].explode > 0) this.ignite(j, nx, ny);
        }
      }
    }
    if (this.ctype[i]) this.temp[i] = Math.min(MAX_TEMP, this.temp[i] + 1);
    if (--this.life[i] <= 0) {
      const under = this.ctype[i];
      if (under) {
        type[i] = under;
        this.ctype[i] = 0;
        this.life[i] = SPARK_COOLDOWN;
      } else {
        this.clearCell(i);
      }
      return true;
    }
    return false; // falls through to reactions (electrolysis, lightning)
  }

  updateBattery(x, y) {
    const { w, h, type } = this;
    for (let k = 0; k < 4; k++) {
      const nx = k === 0 ? x + 1 : k === 1 ? x - 1 : x;
      const ny = k === 2 ? y + 1 : k === 3 ? y - 1 : y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (CONDUCTOR[type[j]] && this.life[j] === 0) {
        this.sparkAt(j);
        this.record(SPARK, SPECIAL['battery-spark']);
      }
    }
    return true;
  }

  updatePlant(i, x, y) {
    // Grow into touching water.
    if (this.rand() < 0.02) {
      const j = this.randomNeighbor(x, y);
      if (j >= 0 && this.type[j] === WATER) {
        this.convert(j, PLANT, false, -1);
        this.shade[j] = (this.rand() * 256) | 0;
      }
    }
    // Plant fully surrounded by plant or wood slowly turns woody.
    if (this.rand() < 0.003 && x > 0 && y > 0 && x < this.w - 1 && y < this.h - 1) {
      const { type, w } = this;
      const a = type[i - 1], b = type[i + 1], c = type[i - w], e = type[i + w];
      if ((a === PLANT || a === WOOD) && (b === PLANT || b === WOOD)
        && (c === PLANT || c === WOOD) && (e === PLANT || e === WOOD)) {
        this.convert(i, WOOD, true, SPECIAL['plant-wood']);
        return true;
      }
    }
    return false;
  }

  updateCloud(i, x, y) {
    if (y < this.h - 1 && this.rand() < 0.002) {
      const j = i + this.w;
      if (this.type[j] === 0) {
        const cold = this.temp[i] < 0;
        this.spawn(j, cold ? SNOW : WATER);
        if (cold) this.record(SNOW, SPECIAL['cloud-snow']);
        if (this.rand() < 0.3) { this.clearCell(i); return true; }
      }
    }
    return false;
  }

  updateLightning(i, x, y) {
    const { w, h, type } = this;
    if (this.ctype[i] === 1) { // fading trail
      if (--this.life[i] <= 0) this.clearCell(i);
      return true;
    }
    let cur = i, cx = x, cy = y;
    for (let s = 0; s < 4; s++) {
      const nx = cx + ((this.rand() * 3) | 0) - 1;
      const ny = cy + 1;
      if (nx < 0 || nx >= w || ny >= h) { this.strike(cur, cx, cy); return true; }
      const j = ny * w + nx;
      const u = type[j];
      if (u === 0 || (DEFS[u].displaceable && DEFS[u].state === GAS)) {
        type[j] = LIGHTNING;
        this.ctype[j] = 0;
        this.life[j] = this.life[cur] - 1;
        this.temp[j] = this.temp[cur];
        this.clock[j] = this.tick;
        this.ctype[cur] = 1;
        this.life[cur] = 3 + ((this.rand() * 4) | 0);
        cur = j; cx = nx; cy = ny;
        if (this.life[cur] <= 0) { this.ctype[cur] = 1; this.life[cur] = 3; return true; }
      } else {
        this.strike(cur, cx, cy);
        return true;
      }
    }
    return true;
  }

  strike(i, x, y) {
    const { w, h, type } = this;
    this.ctype[i] = 1;
    this.life[i] = 5;
    this.air.addPressure(this.air.at(x, y), 6);
    for (let dy = -1; dy <= 3; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        const u = type[j];
        if (u === 0 || u === LIGHTNING || u === WALL) continue;
        this.temp[j] = Math.min(MAX_TEMP, this.temp[j] + 1200);
        if (CONDUCTOR[u] && this.life[j] === 0) { this.sparkAt(j); continue; }
        if (DEFS[u].flammable > 0) { this.ignite(j, nx, ny); continue; }
        const r = REACT[LIGHTNING * NUM + u];
        if (r !== null && r.otherTo >= 0) this.convert(j, r.otherTo, r.keepOther, r.otherRule);
      }
    }
  }

  updateAcid(i, x, y) {
    const j = this.randomNeighbor(x, y);
    if (j < 0) return false;
    const u = this.type[j];
    if (u === 0) return false;
    const e = DEFS[u];
    if (e.acidProof || e.indestructible || REACT[this.type[i] * NUM + u] !== null) return false;
    if ((e.state === SOLID || e.state === POWDER || u === ID.MUD) && this.rand() < 0.08) {
      this.clearCell(j);
      if (this.rand() < 0.35) { this.clearCell(i); return true; }
    }
    return false;
  }

  updateClone(i, x, y) {
    const c = this.ctype[i];
    const j = this.randomNeighbor(x, y);
    if (j < 0) return true;
    const u = this.type[j];
    if (c === 0) {
      if (CLONEABLE[u]) this.ctype[i] = u;
    } else if (u === 0 && this.rand() < 0.3) {
      this.spawn(j, c);
    }
    return true;
  }

  updateVoid(i, x, y) {
    const { w, h, type } = this;
    for (let k = 0; k < 4; k++) {
      const nx = k === 0 ? x + 1 : k === 1 ? x - 1 : x;
      const ny = k === 2 ? y + 1 : k === 3 ? y - 1 : y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      const u = type[j];
      if (u !== 0 && u !== VOID && !DEFS[u].indestructible && this.rand() < 0.5) this.clearCell(j);
    }
    this.air.addPressure(this.air.at(x, y), -0.3);
    return true;
  }

  // ---- movement -----------------------------------------------------------

  // Can a particle of def `d` move into cell j? dy is the vertical direction
  // of the move (+1 down, -1 up, 0 sideways).
  canEnter(d, j, dy) {
    const u = this.type[j];
    if (u === 0) return true;
    const e = DEFS[u];
    if (!e.displaceable) return false;
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
    this.vy[i] = 0;
    if (d.viscosity > 0 && this.rand() < d.viscosity) return;
    for (let k = 0, dir = flow; k < 2; k++, dir = -dir) {
      let target = -1;
      for (let s = 1; s <= d.spread; s++) {
        const nx = x + dir * s;
        if (nx < 0 || nx >= w) break;
        const jj = i + dir * s;
        if (!this.canEnter(d, jj, 0)) break;
        target = jj;
        if (y + 1 < h && this.type[jj + w] === 0) break; // found a drop, fall next frame
      }
      if (target >= 0) {
        this.swap(i, target);
        this.vx[target] = dir * 0.5;
        return;
      }
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

  // Visit every cell within radius r of (cx, cy).
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

  paint(cx, cy, r, t, density = 1) {
    this.forCircle(cx, cy, r, (i) => {
      const u = this.type[i];
      if (t === SPARK && CONDUCTOR[u] && this.life[i] === 0) { this.sparkAt(i); return; }
      if (u === 0 && (density >= 1 || this.rand() < density)) this.spawn(i, t);
    });
  }

  erase(cx, cy, r) {
    this.forCircle(cx, cy, r, (i) => { if (this.type[i]) this.clearCell(i); });
  }

  heat(cx, cy, r, amount) {
    this.forCircle(cx, cy, r, (i) => {
      if (!this.type[i] || this.type[i] === WALL) return;
      const T = this.temp[i] + amount;
      this.temp[i] = T > MAX_TEMP ? MAX_TEMP : T < MIN_TEMP ? MIN_TEMP : T;
    });
  }

  pressurize(cx, cy, r, amount) {
    const seen = new Set();
    this.forCircle(cx, cy, r, (i, x, y) => {
      const a = this.air.at(x, y);
      if (seen.has(a)) return;
      seen.add(a);
      this.air.addPressure(a, amount);
    });
  }

  blow(cx, cy, r, dx, dy) {
    const seen = new Set();
    this.forCircle(cx, cy, r, (i, x, y) => {
      const a = this.air.at(x, y);
      if (seen.has(a) || this.air.blocked[a]) return;
      seen.add(a);
      this.air.addVelocity(a, dx, dy);
    });
  }

  pressureAt(x, y) {
    return this.air.p[this.air.at(x, y)];
  }
}

