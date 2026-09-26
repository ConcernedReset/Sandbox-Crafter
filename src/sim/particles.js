// The particle layer: photons, electrons, protons, neutrons, positrons and
// neutrinos. Like The Powder Toy's photons, they live outside the grid, so
// they can fly through matter: a neutron can pass into a pile of uranium and
// split an atom in the middle of it. Each frame every particle moves along
// its velocity and, for each new cell it enters, either passes through,
// bounces, is absorbed, or triggers a rule from PARTICLE_HITS.
//
// Mixed into World.prototype; `initParticles` sets up the storage.

import { DEFS, ID, NUM, HIT, PAIR, PMODE, SPECIAL } from './elements.js';
import { MAX_TEMP } from './constants.js';
import { CONDUCTOR, GASLIKE } from './lookups.js';

const PASS = 0, DEAD = 1, BOUNCE = 2;
const CAPACITY = 12000;
const MAGNET_BEND = 0.006; // radians per unit of field per frame
const { NEUTRON, PHOTON, ELECTRON, PROTON, NEUTRINO, HYDROGEN } = ID;

export function initParticles(world) {
  world.pCap = CAPACITY;
  world.px = new Float32Array(CAPACITY);
  world.py = new Float32Array(CAPACITY);
  world.pvx = new Float32Array(CAPACITY);
  world.pvy = new Float32Array(CAPACITY);
  world.ptype = new Uint16Array(CAPACITY);
  world.plife = new Int16Array(CAPACITY);
  world.pn = 0;
  world.pmap = new Int32Array(world.w * world.h); // index + 1 of a particle in each cell
  const airCells = world.air.W * world.air.H;
  world.magnetCount = new Uint16Array(airCells);
  world.field = new Float32Array(airCells);
  world.magnetTotal = 0;
  world.fieldActive = false;
}

export const Particles = {
  // Launch a particle. Without a velocity it flies off in a random direction.
  spawnProjectile(t, x, y, vx, vy) {
    if (this.pn >= this.pCap) return -1;
    const d = DEFS[t];
    if (vx === undefined) {
      const a = this.rand() * Math.PI * 2;
      vx = Math.cos(a) * d.speed;
      vy = Math.sin(a) * d.speed;
    }
    const k = this.pn++;
    this.px[k] = x;
    this.py[k] = y;
    this.pvx[k] = vx;
    this.pvy[k] = vy;
    this.ptype[k] = t;
    this.plife[k] = d.lifeMin + ((this.rand() * (d.lifeMax - d.lifeMin + 1)) | 0);
    return k;
  },

  emitAt(t, x, y) {
    return this.spawnProjectile(t, x + 0.5, y + 0.5);
  },

  killProjectile(k) {
    const last = --this.pn;
    if (k === last) return;
    this.px[k] = this.px[last];
    this.py[k] = this.py[last];
    this.pvx[k] = this.pvx[last];
    this.pvy[k] = this.pvy[last];
    this.ptype[k] = this.ptype[last];
    this.plife[k] = this.plife[last];
  },

  // Spread each magnet's pull over the nearby air cells.
  computeField() {
    const { field, magnetCount } = this;
    if (this.magnetTotal === 0) {
      if (this.fieldActive) { field.fill(0); this.fieldActive = false; }
      return;
    }
    const { W, H } = this.air;
    const R = 4;
    field.fill(0);
    for (let a = 0; a < magnetCount.length; a++) {
      const c = magnetCount[a];
      if (c === 0) continue;
      const ax = a % W, ay = (a / W) | 0;
      for (let dy = -R; dy <= R; dy++) {
        const ny = ay + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -R; dx <= R; dx++) {
          const nx = ax + dx;
          if (nx < 0 || nx >= W) continue;
          field[ny * W + nx] += c / (1 + dx * dx + dy * dy);
        }
      }
    }
    magnetCount.fill(0);
    this.magnetTotal = 0;
    this.fieldActive = true;
  },

  stepProjectiles() {
    this.pmap.fill(0);
    // Newly launched particles are appended past the end and wait a frame.
    for (let k = this.pn - 1; k >= 0; k--) {
      if (k < this.pn) this.moveProjectile(k);
    }
  },

  moveProjectile(k) {
    const t = this.ptype[k];
    const d = DEFS[t];
    if (--this.plife[k] <= 0) { this.expireProjectile(k, t); return; }
    const { w, h, type } = this;

    if (d.charge !== 0 && this.fieldActive) {
      const f = this.field[this.air.at(this.px[k] | 0, this.py[k] | 0)];
      if (f > 0.05) {
        const th = d.charge * f * MAGNET_BEND;
        const c = Math.cos(th), s = Math.sin(th);
        const vx = this.pvx[k], vy = this.pvy[k];
        this.pvx[k] = vx * c - vy * s;
        this.pvy[k] = vx * s + vy * c;
      }
    }

    let x = this.px[k], y = this.py[k];
    const vx = this.pvx[k], vy = this.pvy[k];
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(vx), Math.abs(vy))));
    const sx = vx / steps, sy = vy / steps;
    let cx = x | 0, cy = y | 0;
    for (let s = 0; s < steps; s++) {
      const nx = x + sx, ny = y + sy;
      const ix = Math.floor(nx), iy = Math.floor(ny);
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) { this.killProjectile(k); return; }
      if (ix !== cx || iy !== cy) {
        const j = iy * w + ix;
        const u = type[j];
        if (u !== 0) {
          const res = this.hitCell(k, t, d, j, u, ix, iy, cx, cy);
          if (res === DEAD) { this.killProjectile(k); return; }
          if (res === BOUNCE) break;
        }
        cx = ix;
        cy = iy;
      }
      x = nx;
      y = ny;
    }
    this.px[k] = x;
    this.py[k] = y;

    // Two particles in the same cell may react with each other.
    const c = cy * w + cx;
    const o = this.pmap[c] - 1;
    if (o >= 0 && o !== k && o < this.pn && (this.px[o] | 0) === cx && (this.py[o] | 0) === cy
      && this.pairReact(k, o, cx, cy)) return;
    this.pmap[c] = k + 1;
  },

  hitCell(k, t, d, j, u, ix, iy, lx, ly) {
    const e = DEFS[u];
    const r = HIT[t * NUM + u];
    if (r !== null && (r.recover === 0 || this.life[j] === 0)) {
      let chance = r.chance;
      // Slow neutrons split atoms far more readily than fast ones.
      if (r.fission && this.pvx[k] * this.pvx[k] + this.pvy[k] * this.pvy[k] < 2) chance *= 3;
      if (this.rand() < chance) return this.applyHit(k, r, j, ix, iy, lx, ly);
    }
    if (e.detector) { this.detect(j, ix, iy); return PASS; }

    switch (d.pmode) {
      case PMODE.photon:
        if (e.transparent || (GASLIKE[u] && !e.opaque)) return PASS;
        if (e.reflect > 0 && this.rand() < e.reflect) { this.bounce(k, ix, iy, lx, ly); return BOUNCE; }
        return this.impact(j, lx, ly, d);
      case PMODE.electron:
        if (CONDUCTOR[u]) {
          if (this.life[j] === 0) this.sparkAt(j);
          return this.impact(j, lx, ly, d);
        }
        if (e.transparent || GASLIKE[u]) return PASS;
        return this.impact(j, lx, ly, d);
      case PMODE.proton: {
        if (GASLIKE[u]) return PASS;
        // It stops and sometimes picks up an electron as a wisp of hydrogen.
        const li = ly * this.w + lx;
        if (this.type[li] === 0 && this.rand() < 0.25) this.spawn(li, HYDROGEN);
        return this.impact(j, lx, ly, d);
      }
      case PMODE.neutron: {
        if (e.moderator) {
          const v2 = this.pvx[k] * this.pvx[k] + this.pvy[k] * this.pvy[k];
          if (v2 > 1.05) {
            const f = 1 / Math.sqrt(v2);
            this.pvx[k] *= f;
            this.pvy[k] *= f;
          }
        }
        if (e.nAbsorb > 0 && this.rand() < e.nAbsorb) return this.impact(j, lx, ly, d);
        return PASS;
      }
      case PMODE.positron:
        if (GASLIKE[u]) return PASS;
        // Annihilation: two photons fly off in opposite directions.
        this.annihilate(k, ix, iy);
        return this.impact(j, lx, ly, d);
      case PMODE.alpha:
      case PMODE.ion: {
        // Heavy and slow: stopped by the first thing that isn't a gas (even
        // paper), where it picks up electrons and settles as an atom.
        if (GASLIKE[u]) return PASS;
        const li = ly * this.w + lx;
        const ex = d.expire;
        if (ex && this.type[li] === 0 && this.rand() < 0.5) {
          this.spawn(li, ex[0].id);
          this.record(ex[0].id, ex[0].rule);
        }
        return this.impact(j, lx, ly, d);
      }
      case PMODE.gamma: {
        // Dense matter soaks up gamma rays; light matter barely slows them.
        if (GASLIKE[u]) return PASS;
        const stop = e.indestructible ? 1 : Math.min(0.9, e.density * 0.025 + e.nAbsorb * 0.3);
        if (this.rand() >= stop) return PASS;
        return this.impact(j, lx, ly, d);
      }
      case PMODE.xray:
        // Straight through flesh, wood and water; stopped by bone and metal.
        if (GASLIKE[u] || (!e.xrayOpaque && !e.indestructible && e.density < 3)) return PASS;
        return this.impact(j, lx, ly, d);
      case PMODE.uv:
        // Like light, except ordinary glass blocks it (quartz doesn't).
        if ((e.transparent && !e.uvBlock) || (GASLIKE[u] && !e.opaque)) return PASS;
        if (e.reflect > 0 && this.rand() < e.reflect) { this.bounce(k, ix, iy, lx, ly); return BOUNCE; }
        return this.impact(j, lx, ly, d);
      case PMODE.microwave:
        // Metal reflects them and arcs; anything wet soaks them up and heats.
        if (CONDUCTOR[u]) {
          if (this.life[j] === 0 && this.rand() < 0.3) this.sparkAt(j);
          this.bounce(k, ix, iy, lx, ly);
          return BOUNCE;
        }
        if (e.indestructible) return DEAD;
        if (e.wet) {
          this.impact(j, lx, ly, d);
          return this.rand() < 0.3 ? DEAD : PASS;
        }
        return PASS;
      default:
        return PASS; // neutrinos, muons and other ghosts
    }
  },

  // A particle slams into cell j, dumping its energy as heat there and as a
  // kick of air pressure at (x, y), the open cell it hit from (see hitHeat /
  // hitPressure). Returns DEAD.
  impact(j, x, y, d) {
    if (DEFS[this.type[j]].indestructible) return DEAD;
    if (d.hitHeat) this.temp[j] = Math.min(MAX_TEMP, this.temp[j] + d.hitHeat);
    if (d.hitPressure) this.air.addPressure(this.air.at(x, y), d.hitPressure);
    return DEAD;
  },

  applyHit(k, r, j, ix, iy, lx, ly) {
    if (r.fission) { this.fission(j, this.type[j], ix, iy); return DEAD; }
    // Whatever else the hit does, a particle that stops here still lands a blow.
    if (!r.keep) this.impact(j, lx, ly, DEFS[this.ptype[k]]);
    if (r.recover) this.life[j] = r.recover;
    if (r.heat) this.temp[j] = Math.min(MAX_TEMP, this.temp[j] + r.heat);
    if (r.action === 'spark') this.sparkNeighbors(ix, iy);
    else if (r.action === 'excite') this.life[j] = 24;
    if (r.spawn >= 0 && this.spawnNear(ix, iy, r.spawn) >= 0) this.record(r.spawn, r.spawnRule);
    if (r.tTo >= 0) this.convert(j, r.tTo, false, r.tRule);
    for (const e of r.emit) {
      if (r.copy) {
        this.spawnProjectile(e.id, this.px[k] + this.rand() * 0.5, this.py[k] + this.rand() * 0.5,
          this.pvx[k], this.pvy[k]);
      } else {
        this.emitAt(e.id, ix, iy);
      }
      this.record(e.id, e.rule);
    }
    if (r.explode) this.blast(ix, iy, r.explode);
    if (r.pTo >= 0) {
      const li = ly * this.w + lx;
      if (this.type[li] === 0) {
        this.spawn(li, r.pTo);
        this.record(r.pTo, r.pRule);
      }
    }
    return r.keep ? PASS : DEAD;
  },

  // A neutron splits the atom in cell j.
  fission(j, u, x, y) {
    const f = DEFS[u].fission;
    if (f.captureTo >= 0 && this.rand() < f.captureChance) {
      this.convert(j, f.captureTo, true, f.captureRule);
      return;
    }
    for (let n = 0; n < f.neutrons; n++) this.emitAt(NEUTRON, x, y);
    for (let n = 0; n < f.photons; n++) this.emitAt(PHOTON, x, y);
    this.temp[j] = Math.min(MAX_TEMP, this.temp[j] + f.heat);
    if (f.blast) this.blast(x, y, f.blast);
    let roll = this.rand();
    for (const p of f.products) {
      if (roll < p.w) { this.convert(j, p.id, true, p.rule); break; }
      roll -= p.w;
    }
  },

  // Reflect off the side of the cell we just ran into.
  bounce(k, ix, iy, lx, ly) {
    const hitX = ix !== lx, hitY = iy !== ly;
    if (hitX && hitY) {
      const bx = DEFS[this.type[ly * this.w + ix]].reflect > 0;
      const by = DEFS[this.type[iy * this.w + lx]].reflect > 0;
      if (bx && !by) this.pvx[k] = -this.pvx[k];
      else if (by && !bx) this.pvy[k] = -this.pvy[k];
      else { this.pvx[k] = -this.pvx[k]; this.pvy[k] = -this.pvy[k]; }
    } else if (hitX) {
      this.pvx[k] = -this.pvx[k];
    } else {
      this.pvy[k] = -this.pvy[k];
    }
  },

  annihilate(k, x, y) {
    const a = this.rand() * Math.PI * 2;
    const s = DEFS[PHOTON].speed;
    this.spawnProjectile(PHOTON, x + 0.5, y + 0.5, Math.cos(a) * s, Math.sin(a) * s);
    this.spawnProjectile(PHOTON, x + 0.5, y + 0.5, -Math.cos(a) * s, -Math.sin(a) * s);
  },

  pairReact(k, o, x, y) {
    const r = PAIR[this.ptype[k] * NUM + this.ptype[o]];
    if (r === null || this.rand() >= r.chance) return false;
    if (r.gridTo >= 0) {
      const c = y * this.w + x;
      if (this.type[c] === 0) {
        this.spawn(c, r.gridTo);
        this.record(r.gridTo, r.gridRule);
      }
    }
    for (const e of r.emit) {
      this.emitAt(e.id, x, y);
      this.record(e.id, e.rule);
    }
    // Remove the higher index first so the lower one stays valid.
    if (k > o) { this.killProjectile(k); this.killProjectile(o); } else { this.killProjectile(o); this.killProjectile(k); }
    return true;
  },

  // A free neutron decays into a proton, an electron and a neutrino. Other
  // short-lived particles (pions, muons, the Higgs) decay into what their
  // `expire` list says; alphas settle as helium.
  expireProjectile(k, t) {
    if (t !== NEUTRON) {
      const ex = DEFS[t].expire;
      const x = this.px[k], y = this.py[k];
      this.killProjectile(k);
      if (ex === null) return;
      for (const e of ex) {
        if (DEFS[e.id].projectile) {
          this.spawnProjectile(e.id, x, y);
        } else {
          const c = (y | 0) * this.w + (x | 0);
          if (this.type[c] !== 0) continue;
          this.spawn(c, e.id);
        }
        this.record(e.id, e.rule);
      }
      return;
    }
    const x = this.px[k], y = this.py[k], vx = this.pvx[k], vy = this.pvy[k];
    this.killProjectile(k);
    this.spawnProjectile(PROTON, x, y, vx * 0.75, vy * 0.75);
    this.spawnProjectile(ELECTRON, x, y);
    this.spawnProjectile(NEUTRINO, x, y);
    this.record(PROTON, SPECIAL['neutron-proton']);
    this.record(ELECTRON, SPECIAL['neutron-electron']);
    this.record(NEUTRINO, SPECIAL['neutron-neutrino']);
  },
};
