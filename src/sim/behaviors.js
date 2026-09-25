// Custom per-element behaviours, mixed into World.prototype. Each update
// routine returns true if it fully handled the particle this frame, or false
// to let the generic phase changes, reactions and movement run as well.

import { DEFS, ID, NUM, State, REACT, SPECIAL } from './elements.js';
import { MAX_TEMP } from './constants.js';
import { CONDUCTOR, CLONEABLE, ORGANIC, TRANSMUTABLE, SPEW } from './lookups.js';

const { SOLID, POWDER, GAS } = State;
const {
  WALL, FIRE, SMOKE, WATER, SNOW, PLANT, WOOD, SPARK, LIGHTNING, VOID, DIRT, MUD, GRASS, SEED,
  GLITTER, NEON, PHOTON, NEUTRON, ANTIMATTER, BLACK_HOLE, STRANGE_MATTER, DARK_MATTER, GOLD,
  VIRUS, LYE,
} = ID;

const SPARK_COOLDOWN = 6;
const DX4 = [1, -1, 0, 0];
const DY4 = [0, 0, 1, -1];

export const Behaviors = {
  behave(name, i, x, y, t, d) {
    switch (name) {
      case 'fire': return this.burnOut(i, x, y, true);
      case 'plasma': return this.burnOut(i, x, y, false);
      case 'decay': return this.lifeRunsOut(i, d);
      case 'spark': return this.updateSpark(i, x, y);
      case 'battery': return this.updateBattery(x, y);
      case 'plant': return this.updatePlant(i, x, y);
      case 'cloud': return this.updateCloud(i, x, y);
      case 'lightning': return this.updateLightning(i, x, y);
      case 'acid': return this.updateAcid(i, x, y);
      case 'clone': return this.updateClone(i, x, y);
      case 'void': return this.updateVoid(x, y);
      case 'grow': return this.updateGrow(x, y, t, d);
      case 'virus': return this.updateVirus(i, x, y);
      case 'lye': return this.updateLye(i, x, y);
      case 'seed': return this.updateSeed(i, x, y);
      case 'firework': return this.updateFirework(i, x, y);
      case 'glitter': return this.updateGlitter(i, x, y, d);
      case 'neon':
      case 'geiger':
      case 'recover': // life counts down: glow, flash, or time until it can amplify again
        if (this.life[i] > 0) this.life[i]--;
        return name === 'geiger';
      case 'laser': return this.updateLaser(x, y);
      case 'magnet':
        this.magnetCount[this.air.at(x, y)]++;
        this.magnetTotal++;
        return true;
      case 'ferrofluid': return this.updateFerrofluid(i, x, y);
      case 'superfluid': return this.updateSuperfluid(i, x, y, d);
      case 'antimatter': return this.updateAntimatter(i, x, y);
      case 'neutronium': return this.updateNeutronium(i, x, y);
      case 'blackhole': return this.updateBlackHole(x, y);
      case 'whitehole': return this.updateWhiteHole(x, y);
      case 'strange': return this.updateStrange(x, y);
      case 'darkmatter': return this.updateDarkMatter(i, x, y);
      case 'philosopher': return this.updatePhilosopher(x, y);
      default: return false;
    }
  },

  // Place element t in a random empty cell next to (x, y). Returns its index or -1.
  spawnNear(x, y, t) {
    const start = (this.rand() * 8) | 0;
    for (let k = 0; k < 8; k++) {
      const a = (start + k) & 7;
      const dx = a < 3 ? -1 : a < 5 ? 0 : 1;
      const dy = a === 0 || a === 3 || a === 5 ? -1 : a === 1 || a === 6 ? 0 : 1;
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const j = ny * this.w + nx;
      if (this.type[j] === 0) {
        this.spawn(j, t);
        return j;
      }
    }
    return -1;
  },

  // Send a spark into every idle conductor touching (x, y).
  sparkNeighbors(x, y) {
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const j = ny * this.w + nx;
      if (CONDUCTOR[this.type[j]] && this.life[j] === 0) this.sparkAt(j);
    }
  },

  // Something with a lifetime (smoke, cryo, fruit, wet concrete) runs out.
  lifeRunsOut(i, d) {
    if (--this.life[i] > 0) return false;
    const le = d.lifeEnd;
    if (le === null) this.clearCell(i);
    else if (le.alt >= 0 && this.rand() < le.altChance) this.convert(i, le.alt, false, le.altRule);
    else this.convert(i, le.to, false, le.rule);
    return true;
  },

  // Fire and plasma: count down, ignite neighbours, maybe leave smoke.
  // Fire burning a solid, a sticky liquid or a non-explosive powder stays on
  // its fuel as an ember and throws loose flames upward, so logs burn in place.
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
      if (f.burn && f.burn.flare && this.rand() < 0.3) this.emitAt(PHOTON, x, y);
      if (f.state === SOLID || f.sticky || (f.state === POWDER && f.explode === 0)) {
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
  },

  igniteAround(x, y) {
    const { w, h } = this;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      const f = DEFS[this.type[j]].flammable;
      if (f > 0 && this.rand() < f) this.ignite(j, nx, ny);
    }
  },

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
          else if (u === NEON) {
            this.life[j] = 20;
            if (this.rand() < 0.05) this.emitAt(PHOTON, nx, ny);
          }
        }
      }
    }
    const under = this.ctype[i];
    if (under) this.temp[i] = Math.min(MAX_TEMP, this.temp[i] + DEFS[under].sparkHeat);
    if (--this.life[i] <= 0) {
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
  },

  updateBattery(x, y) {
    const { w, h, type } = this;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (CONDUCTOR[type[j]] && this.life[j] === 0) {
        this.sparkAt(j);
        this.record(SPARK, SPECIAL['battery-spark']);
      }
    }
    return true;
  },

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
  },

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
  },

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
  },

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
        const r = REACT[LIGHTNING * NUM + u];
        if (r !== null && r.other.to >= 0 && this.rand() < r.chance) {
          this.convert(j, r.other.to, r.keepOther, r.other.rule);
          continue;
        }
        if (CONDUCTOR[u] && this.life[j] === 0) { this.sparkAt(j); continue; }
        if (DEFS[u].flammable > 0) this.ignite(j, nx, ny);
      }
    }
  },

  updateAcid(i, x, y) {
    const j = this.randomNeighbor(x, y);
    if (j < 0) return false;
    const u = this.type[j];
    if (u === 0) return false;
    const e = DEFS[u];
    if (e.acidProof || e.indestructible || REACT[this.type[i] * NUM + u] !== null) return false;
    if ((e.state === SOLID || e.state === POWDER || u === MUD) && this.rand() < 0.08) {
      this.clearCell(j);
      if (this.rand() < 0.35) { this.clearCell(i); return true; }
    }
    return false;
  },

  // Lye works like acid, but only on living things.
  updateLye(i, x, y) {
    const j = this.randomNeighbor(x, y);
    if (j < 0) return false;
    const u = this.type[j];
    if (ORGANIC[u] && REACT[LYE * NUM + u] === null && this.rand() < 0.05) {
      this.clearCell(j);
      if (this.rand() < 0.3) { this.clearCell(i); return true; }
    }
    return false;
  },

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
  },

  updateVoid(x, y) {
    const { w, h, type } = this;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      const u = type[j];
      if (u !== 0 && !DEFS[u].indestructible && REACT[VOID * NUM + u] === null
        && this.rand() < 0.5) this.clearCell(j);
    }
    this.air.addPressure(this.air.at(x, y), -0.3);
    return false; // let reactions run (neutronium collapsing into a black hole)
  },

  // Grass, moss, fungus and algae creep into neighbouring cells.
  updateGrow(x, y, t, d) {
    const g = d.grow;
    if (this.rand() < g.chance) {
      const j = this.randomNeighbor(x, y);
      if (j >= 0 && g.into[this.type[j]] && (!g.surface || (j >= this.w && this.type[j - this.w] === 0))) {
        this.convert(j, t, false, -1);
        this.shade[j] = (this.rand() * 256) | 0;
      }
    }
    return false;
  },

  updateVirus(i, x, y) {
    if (--this.life[i] <= 0) { this.clearCell(i); return true; }
    const j = this.randomNeighbor(x, y);
    if (j >= 0 && ORGANIC[this.type[j]] && this.rand() < 0.05) this.convert(j, VIRUS, false, -1);
    return false;
  },

  // A seed falls like a powder. On soil it becomes a growing tip that climbs,
  // leaving a wooden trunk, then bursts into a canopy of leaves.
  updateSeed(i, x, y) {
    const { w, type } = this;
    if (this.ctype[i] === 0) {
      if (y + 1 < this.h) {
        const b = type[i + w];
        if (b === DIRT || b === MUD || b === GRASS) {
          this.ctype[i] = 1;
          this.life[i] = 12 + ((this.rand() * 16) | 0);
        }
      }
      return false;
    }
    if (this.rand() > 0.12) return true;
    if (this.life[i] > 0 && y > 0 && type[i - w] === 0) {
      const j = i - w;
      this.spawn(j, SEED);
      this.ctype[j] = 1;
      this.life[j] = this.life[i] - 1;
      this.convert(i, WOOD, false, -1);
    } else {
      const r = 3 + ((this.rand() * 3) | 0);
      for (let dy = -r; dy <= 1; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= this.h) continue;
          if ((dx * dx) / (r * r) + (dy * dy) / (r * r * 0.6) > 1) continue;
          const j = ny * w + nx;
          if (type[j] === 0 && this.rand() < 0.8) this.spawn(j, PLANT);
        }
      }
      this.convert(i, PLANT, false, -1);
    }
    return true;
  },

  // A lit firework (ctype 1) climbs with a trail of sparks, then bursts.
  updateFirework(i, x, y) {
    if (this.ctype[i] !== 1) return false;
    const { w, type } = this;
    if (--this.life[i] <= 0) { this.burst(i, x, y); return true; }
    if (y + 1 < this.h && type[i + w] === 0 && this.rand() < 0.6) {
      this.spawn(i + w, FIRE);
      this.life[i + w] = 6 + ((this.rand() * 8) | 0);
    }
    let cur = i, cy = y;
    for (let s = 0; s < 2; s++) {
      if (cy <= 0) { this.burst(cur, x, cy); return true; }
      const u = type[cur - w];
      if (u !== 0 && !DEFS[u].displaceable) { this.burst(cur, x, cy); return true; }
      this.swap(cur, cur - w);
      cur -= w;
      cy--;
    }
    return true;
  },

  burst(i, x, y) {
    this.clearCell(i);
    this.blast(x, y, 2);
    const hue = (this.rand() * 8) | 0;
    const n = 26 + ((this.rand() * 14) | 0);
    for (let k = 0; k < n; k++) {
      const a = this.rand() * Math.PI * 2;
      const dist = 1 + this.rand() * 2;
      const nx = x + Math.round(Math.cos(a) * dist), ny = y + Math.round(Math.sin(a) * dist);
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const j = ny * this.w + nx;
      if (this.type[j] !== 0) continue;
      this.spawn(j, GLITTER);
      this.shade[j] = hue;
      const speed = 1.5 + this.rand() * 1.5;
      this.vx[j] = Math.cos(a) * speed;
      this.vy[j] = Math.sin(a) * speed;
    }
    this.record(GLITTER, SPECIAL['firework-glitter']);
  },

  updateGlitter(i, x, y, d) {
    if (--this.life[i] <= 0) { this.clearCell(i); return true; }
    const vx = this.vx[i] * 0.96, vy = this.vy[i] * 0.96 + 0.04;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.travel(i, x, y, vx, vy, d);
    return true;
  },

  // A particle passed through a Geiger tube: flash and spark touching metal.
  detect(j, x, y) {
    this.life[j] = 10;
    this.sparkNeighbors(x, y);
  },

  updateLaser(x, y) {
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const u = this.type[ny * this.w + nx];
      if ((u === 0 || DEFS[u].state === GAS) && this.rand() < 0.2) {
        this.spawnProjectile(PHOTON, nx + 0.5, ny + 0.5, DX4[k] * 3, DY4[k] * 3);
      }
    }
    return true;
  },

  // Ferrofluid is pulled up the magnetic field towards magnets.
  updateFerrofluid(i, x, y) {
    if (this.fieldActive) {
      const a = this.air.at(x, y);
      const f = this.field, W = this.air.W;
      this.vx[i] += (f[a + 1] - f[a - 1]) * 0.05;
      this.vy[i] += (f[a + W] - f[a - W]) * 0.05;
    }
    return false;
  },

  // Superfluid clings to any wall it touches and creeps up it as a film.
  updateSuperfluid(i, x, y, d) {
    if (this.lifeRunsOut(i, d)) return true;
    const { w, type } = this;
    const l = x > 0 ? type[i - 1] : WALL;
    const r = x < w - 1 ? type[i + 1] : WALL;
    if (DEFS[l].state !== SOLID && DEFS[r].state !== SOLID) return false;
    if (y > 0 && type[i - w] === 0 && this.rand() < 0.35) this.swap(i, i - w);
    return true;
  },

  // Antimatter annihilates with the first ordinary matter it touches.
  updateAntimatter(i, x, y) {
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const j = ny * this.w + nx;
      const u = this.type[j];
      if (u === 0 || u === ANTIMATTER || u === WALL || REACT[ANTIMATTER * NUM + u] !== null) continue;
      if (!DEFS[u].indestructible) this.clearCell(j);
      this.clearCell(i);
      for (let p = 0; p < 3; p++) this.emitAt(PHOTON, x, y);
      this.blast(x, y, 6);
      return true;
    }
    return false;
  },

  // Neutronium is only stable under pressure; in open air it slowly bursts.
  updateNeutronium(i, x, y) {
    if (this.air.p[this.air.at(x, y)] < 10 && this.rand() < 0.0004) {
      this.clearCell(i);
      for (let p = 0; p < 4; p++) this.emitAt(NEUTRON, x, y);
      return true;
    }
    return false;
  },

  updateBlackHole(x, y) {
    const { w, h, type } = this;
    this.air.addPressure(this.air.at(x, y), -6);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        const u = type[j];
        if (u === 0 || u === BLACK_HOLE || u === ANTIMATTER || DEFS[u].indestructible) continue;
        if (this.rand() < 0.6) this.clearCell(j);
      }
    }
    return false; // antimatter reacts with it through the reaction table
  },

  updateWhiteHole(x, y) {
    this.air.addPressure(this.air.at(x, y), 4);
    if (this.rand() < 0.3) {
      const j = this.randomNeighbor(x, y);
      if (j >= 0 && this.type[j] === 0) this.spawn(j, SPEW[(this.rand() * SPEW.length) | 0]);
    }
    if (this.rand() < 0.1) this.emitAt(PHOTON, x, y);
    return true;
  },

  updateStrange(x, y) {
    const j = this.randomNeighbor(x, y);
    if (j >= 0) {
      const u = this.type[j];
      if (u !== 0 && u !== STRANGE_MATTER && u !== WALL && u !== ANTIMATTER
        && !DEFS[u].indestructible && this.rand() < 0.01) {
        this.convert(j, STRANGE_MATTER, true, -1);
      }
    }
    return false;
  },

  // Dark matter drifts through anything that isn't a wall.
  updateDarkMatter(i, x, y) {
    if (this.rand() < 0.5) return true;
    const nx = x + ((this.rand() * 3) | 0) - 1;
    const ny = y + ((this.rand() * 3) | 0) - 1;
    if ((nx === x && ny === y) || nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) return true;
    const j = ny * this.w + nx;
    const u = this.type[j];
    if (u === WALL || u === DARK_MATTER || DEFS[u].indestructible) return true;
    this.swap(i, j);
    return true;
  },

  updatePhilosopher(x, y) {
    const j = this.randomNeighbor(x, y);
    if (j >= 0 && TRANSMUTABLE[this.type[j]] && this.rand() < 0.02) this.convert(j, GOLD, true, -1);
    return true;
  },
};
