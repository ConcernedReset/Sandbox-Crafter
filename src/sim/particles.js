// The particle layer: photons, electrons, protons, neutrons, positrons and
// neutrinos. Like The Powder Toy's photons, they live outside the grid, so
// they can fly through matter: a neutron can pass into a pile of uranium and
// split an atom in the middle of it. Each frame every particle moves along
// its velocity and, for each new cell it enters, either passes through,
// bounces, is absorbed, or triggers a rule from PARTICLE_HITS.
//
// Light takes on the colour of what it bounces off or shines through (glass,
// water, gems; not gases), though a clear material doesn't recolour light a
// mirror or laser has already coloured: `ptint` holds the element
// whose colour a photon now carries (0 for its own). Metal with glass (or any
// clear solid) in front of it is a perfect mirror, and like the Mirror element
// it bounces every photon without warming up.
//
// Mixed into World.prototype; `initParticles` sets up the storage.

import { DEFS, ID, NUM, HIT, PAIR, PMODE, SPECIAL, State } from './elements.js';
import { MIN_TEMP, FISSION_HOT, AMBIENT, KICK_CHANCE, KICK_EMIT, KICK_DECAY } from './constants.js';
import { CONDUCTOR, GASLIKE, LIGHT_SENSOR, MIRROR_BACKING, LIGHT_SPEED } from './lookups.js';
import { LENS } from './gravity.js';

const PASS = 0, DEAD = 1, BOUNCE = 2;
const LUMP = 13; // of the 24 cells around a split (see inLump)
const { SOLID } = State;
const CAPACITY = 12000;
const MAGNET_BEND = 0.006; // radians per unit of field per frame
const { NEUTRON, PHOTON, ELECTRON, PROTON, NEUTRINO } = ID;
// A proton hotter than this sets fuel and explosives alight as it passes.
const PROTON_IGNITES = 500;
const REFLECTS = Uint8Array.from(DEFS, (d) => (d.reflect > 0 ? 1 : 0));
// What neutrons bounce off: anything solid, powdery or liquid, except
// radioactive elements and moderators (graphite, heavy water), which they
// pass through as they always did, so a reactor pile still needs its
// moderator to run and a pinch of plutonium still fizzles.
const NEUTRON_STOPS = Uint8Array.from(DEFS, (d) => (d.id !== 0 && !d.projectile && !GASLIKE[d.id]
  && d.cat !== 'nuclear' && !d.moderator ? 1 : 0));
// Chance a neutron bouncing off a solid knocks that piece loose as debris,
// and how much of its velocity it hands to a loose grain or drop it hits.
const NEUTRON_KNOCK = 0.12;
const NEUTRON_SHOVE = 0.3;
// Photon tints that a clear material recolours: plain light, and light
// already coloured by another clear material.
const FILTERED = Uint8Array.from(DEFS, (d) => (d.id === 0 || (d.transparent && d.light === null) ? 1 : 0));
// Particles that can disturb a stable radioactive atom (light can't).
const HARD = new Uint8Array(Math.max(...Object.values(PMODE)) + 1);
for (const m of ['neutron', 'proton', 'electron', 'positron', 'alpha', 'ion', 'gamma']) HARD[PMODE[m]] = 1;

export function initParticles(world) {
  world.pCap = CAPACITY;
  world.px = new Float32Array(CAPACITY);
  world.py = new Float32Array(CAPACITY);
  world.pvx = new Float32Array(CAPACITY);
  world.pvy = new Float32Array(CAPACITY);
  world.ptype = new Uint16Array(CAPACITY);
  world.plife = new Int16Array(CAPACITY);
  world.ptint = new Uint16Array(CAPACITY);
  world.ptemp = new Float32Array(CAPACITY); // what a proton carries (see hitCell)
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
  // `tint` is the element whose colour light is drawn in (0 for its own).
  spawnProjectile(t, x, y, vx, vy, tint = 0) {
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
    this.ptint[k] = tint;
    this.ptemp[k] = AMBIENT;
    return k;
  },

  // Launch a particle from cell (x, y). It starts at that cell's temperature.
  emitAt(t, x, y) {
    const k = this.spawnProjectile(t, x + 0.5, y + 0.5);
    if (k >= 0 && x >= 0 && y >= 0 && x < this.w && y < this.h) {
      const i = y * this.w + x;
      if (this.type[i] !== 0) this.ptemp[k] = this.temp[i];
    }
    return k;
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
    this.ptint[k] = this.ptint[last];
    this.ptemp[k] = this.ptemp[last];
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

    // Newtonian gravity bends every flying particle's path; its speed holds.
    const g = this.gravity;
    if (g.newtonian) {
      const a = this.air.at(this.px[k] | 0, this.py[k] | 0);
      const fx = g.fx[a], fy = g.fy[a];
      if (fx !== 0 || fy !== 0) {
        const vx = this.pvx[k], vy = this.pvy[k];
        const nx = vx + fx * LENS, ny = vy + fy * LENS;
        const f = Math.hypot(vx, vy) / (Math.hypot(nx, ny) || 1);
        this.pvx[k] = nx * f;
        this.pvy[k] = ny * f;
      }
    }

    let x = this.px[k], y = this.py[k];
    let vx = this.pvx[k], vy = this.pvy[k];
    // Light (and ultraviolet) slows down inside clear liquids and solids,
    // and is back to full speed once out.
    if (d.pmode === PMODE.photon || d.pmode === PMODE.uv) {
      const f = LIGHT_SPEED[type[(y | 0) * w + (x | 0)]];
      vx *= f;
      vy *= f;
    }
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
      if (r.fission) {
        // Slow neutrons split atoms far more readily than fast ones, and
        // pressure makes some (plutonium) split faster still.
        if (this.pvx[k] * this.pvx[k] + this.pvy[k] * this.pvy[k] < 2) chance *= 3;
        const boost = DEFS[u].fission.boost;
        if (boost) {
          const p = this.air.p[this.air.at(ix, iy)];
          if (p > 0) chance *= 1 + p / boost;
        }
      }
      if (this.rand() < chance) return this.applyHit(k, r, j, ix, iy, lx, ly);
    }
    // Hard radiation can be swallowed by a stable radioactive atom it passes,
    // stirring it up. Each kick uses up the particle, so kicks alone never
    // run away; fissile atoms answer neutrons by splitting instead.
    if (e.stable && e.active && e.fission === null && HARD[d.pmode] && this.rand() < KICK_CHANCE) {
      this.kick(j, ix, iy, e);
      return DEAD;
    }
    if (e.detector) { this.detect(j, ix, iy); return PASS; }
    // A photocell turns light into current instead of heat.
    if (LIGHT_SENSOR[u] && (d.pmode === PMODE.photon || d.pmode === PMODE.uv)) { this.lightUp(j); return DEAD; }

    switch (d.pmode) {
      case PMODE.photon:
        if (GASLIKE[u] && !e.opaque) return PASS;
        // Light bouncing off something takes on its colour; a true mirror
        // (and a half-silvered one) reflects it unchanged.
        if (e.reflect > 0 && (this.rand() < e.reflect || this.backed(lx, ly))) {
          this.bounce(k, ix, iy, lx, ly);
          if (!e.colorless) this.ptint[k] = u;
          return BOUNCE;
        }
        // Light shining through glass, water or a gem comes out its colour,
        // unless a mirror, a laser or a ruby coloured it: those colours win.
        if (e.transparent) {
          if (!e.colorless && FILTERED[this.ptint[k]]) this.ptint[k] = u;
          return PASS;
        }
        return this.impact(j, lx, ly, d);
      case PMODE.electron:
        if (CONDUCTOR[u]) {
          if (this.life[j] === 0) this.sparkAt(j);
          return this.impact(j, lx, ly, d);
        }
        if (e.transparent || GASLIKE[u]) return PASS;
        return this.impact(j, lx, ly, d);
      case PMODE.proton: {
        // As in The Powder Toy, a proton flies straight through matter (Wall
        // aside), pulling whatever it passes a quarter of the way to its own
        // temperature, and a hot one sets fuel and explosives alight.
        if (e.indestructible) return this.impact(j, lx, ly, d);
        const T = this.ptemp[k];
        const nt = this.temp[j] + (T - this.temp[j]) * 0.25;
        this.temp[j] = nt < MIN_TEMP ? MIN_TEMP : nt;
        if (T > PROTON_IGNITES && (e.flammable > 0 || e.explode > 0) && this.ignite(j, ix, iy)) {
          this.air.addPressure(this.air.at(ix, iy), 1);
        }
        return PASS;
      }
      case PMODE.neutron: {
        // Neutrons go through gases, radioactive elements and moderators
        // (graphite and heavy water slow them), but bounce off anything else
        // solid, powdery or liquid, battering it (see batter). Lead and boron
        // soak them up.
        if (GASLIKE[u]) return PASS;
        if (e.moderator) {
          const v2 = this.pvx[k] * this.pvx[k] + this.pvy[k] * this.pvy[k];
          if (v2 > 1.05) {
            const f = 1 / Math.sqrt(v2);
            this.pvx[k] *= f;
            this.pvy[k] *= f;
          }
        }
        if (e.nAbsorb > 0 && this.rand() < e.nAbsorb) return this.impact(j, lx, ly, d);
        if (!NEUTRON_STOPS[u]) return PASS; // radioactive elements and moderators
        this.batter(k, j, e, lx, ly, d);
        this.bounce(k, ix, iy, lx, ly, NEUTRON_STOPS);
        return BOUNCE;
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
        // Dense matter soaks up gamma rays; light matter barely slows them. A
        // cell of lead stops about half, as a centimetre of real lead does.
        if (GASLIKE[u]) return PASS;
        const stop = e.indestructible ? 1 : Math.min(0.9, e.density * 0.05);
        if (this.rand() >= stop) return PASS;
        return this.impact(j, lx, ly, d);
      }
      case PMODE.xray:
        // Straight through flesh, wood and water; stopped by bone and metal.
        if (GASLIKE[u] || (!e.xrayOpaque && !e.indestructible && e.density < 3)) return PASS;
        return this.impact(j, lx, ly, d);
      case PMODE.uv:
        // Like light, except ordinary glass blocks it (quartz doesn't).
        if (GASLIKE[u] && !e.opaque) return PASS;
        if (e.reflect > 0 && (this.rand() < e.reflect || this.backed(lx, ly))) {
          this.bounce(k, ix, iy, lx, ly);
          return BOUNCE;
        }
        if (e.transparent && !e.uvBlock) return PASS;
        return this.impact(j, lx, ly, d);
      case PMODE.microwave:
        // Metal reflects them and arcs; anything wet soaks them up and heats.
        if (CONDUCTOR[u]) {
          if (this.life[j] === 0 && this.rand() < 0.3) this.sparkAt(j);
          this.bounce(k, ix, iy, lx, ly, CONDUCTOR);
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

  // Did the light reach the metal through glass (or another clear solid)?
  // Then the metal is a mirror, and reflects all of it.
  backed(lx, ly) {
    return MIRROR_BACKING[this.type[ly * this.w + lx]] === 1;
  },

  // A particle slams into cell j, dumping its energy as heat there and as a
  // kick of air pressure at (x, y), the open cell it hit from (see hitHeat /
  // hitPressure). Returns DEAD.
  impact(j, x, y, d) {
    if (DEFS[this.type[j]].indestructible) return DEAD;
    if (d.hitHeat) this.temp[j] += d.hitHeat;
    if (d.hitPressure) this.air.addPressure(this.air.at(x, y), d.hitPressure);
    return DEAD;
  },

  // A neutron bounces off cell j (element e), coming from (lx, ly): the cell
  // heats up, the air kicks, a solid piece may be knocked loose as debris,
  // and a loose grain or drop is shoved along.
  batter(k, j, e, lx, ly, d) {
    if (e.indestructible) return;
    this.temp[j] += d.hitHeat;
    this.air.addPressure(this.air.at(lx, ly), d.hitPressure);
    if (e.state === SOLID) {
      if (e.strength > 0 && this.loose[j] === 0 && this.rand() < NEUTRON_KNOCK) this.loose[j] = 1;
    } else {
      this.vx[j] += this.pvx[k] * NEUTRON_SHOVE;
      this.vy[j] += this.pvy[k] * NEUTRON_SHOVE;
    }
  },

  applyHit(k, r, j, ix, iy, lx, ly) {
    if (r.fission) { this.fission(j, this.type[j], ix, iy); return DEAD; }
    // A crystal that copies light (ruby) gives it its own colour.
    const tint = DEFS[this.type[j]].light !== null ? this.type[j] : this.ptint[k];
    // Whatever else the hit does, a particle that stops here still lands a blow.
    if (!r.keep) this.impact(j, lx, ly, DEFS[this.ptype[k]]);
    if (r.recover) this.life[j] = r.recover;
    if (r.heat) this.temp[j] += r.heat;
    if (r.action === 'spark') this.sparkNeighbors(ix, iy);
    else if (r.action === 'excite') this.life[j] = 24;
    if (r.spawn >= 0 && this.spawnNear(ix, iy, r.spawn) >= 0) this.record(r.spawn, r.spawnRule);
    if (r.tTo >= 0) this.convert(j, r.tTo, false, r.tRule);
    for (const e of r.emit) {
      if (r.copy) {
        this.ptint[k] = tint;
        this.spawnProjectile(e.id, this.px[k] + this.rand() * 0.5, this.py[k] + this.rand() * 0.5,
          this.pvx[k], this.pvy[k], tint);
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

  // A particle disturbs a stable radioactive atom (element def `e`, in cell
  // j): it may throw off particles of its own, warm up, or decay.
  kick(j, x, y, e) {
    if (e.emits !== null) {
      for (const m of e.emits) if (this.rand() < m.chance * KICK_EMIT) this.emitAt(m.id, x, y);
    }
    if (e.selfHeat) this.temp[j] += e.selfHeat * KICK_EMIT;
    const o = e.decay;
    if (o !== null && this.rand() < Math.min(0.9, o.chance * KICK_DECAY)) this.decayCell(j, x, y, o);
  },

  // Is the atom at (x, y) part of a lump of its element: at least LUMP of
  // the 24 cells around it the same? (See fission.)
  inLump(x, y, u) {
    const { w, h, type } = this;
    let n = 0;
    for (let dy = -2; dy <= 2; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx;
        if (xx >= 0 && xx < w && (dx !== 0 || dy !== 0) && type[yy * w + xx] === u) n++;
      }
    }
    return n >= LUMP;
  },

  // A neutron splits the atom in cell j. A `hot` split (plutonium) leaves
  // its cell at least FISSION_HOT, but only in a lump, as in a bomb's
  // critical mass; a lone atom (bred in a uranium pile) just adds its heat.
  fission(j, u, x, y) {
    const f = DEFS[u].fission;
    if (f.captureTo >= 0 && this.rand() < f.captureChance) {
      this.convert(j, f.captureTo, true, f.captureRule);
      return;
    }
    // Heat first, so what flies out (protons especially) carries it.
    const hot = f.hot && this.inLump(x, y, u);
    this.temp[j] = hot ? Math.max(this.temp[j], FISSION_HOT) : this.temp[j] + f.heat;
    for (let n = 0; n < f.neutrons; n++) this.emitAt(NEUTRON, x, y);
    for (let n = 0; n < f.photons; n++) this.emitAt(PHOTON, x, y);
    for (let n = 0; n < f.protons; n++) this.emitAt(PROTON, x, y);
    if (f.pressure) this.air.addPressure(this.air.at(x, y), f.pressure);
    if (f.blast) this.blast(x, y, f.blast);
    if (hot) this.igniteAround(x, y);
    let roll = this.rand();
    for (const p of f.products) {
      if (roll < p.w) { this.convert(j, p.id, true, p.rule); break; }
      roll -= p.w;
    }
  },

  // Reflect off the surface we just ran into. Its slope is read from the
  // reflecting cells around the hit (like The Powder Toy's surface normals),
  // so a diagonal line of mirror turns a beam through a right angle. Where
  // the shape gives no clear answer (a lone pixel), bounce straight off the
  // side of the cell instead.
  bounce(k, ix, iy, lx, ly, surface = REFLECTS) {
    const { w, h, type } = this;
    let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (let dy = -2; dy <= 2; dy++) {
      const y = iy + dy;
      if (y < 0 || y >= h) continue;
      for (let dx = -2; dx <= 2; dx++) {
        const x = ix + dx;
        if (x < 0 || x >= w || !surface[type[y * w + x]]) continue;
        n++; sx += dx; sy += dy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
      }
    }
    const vx = this.pvx[k], vy = this.pvy[k];
    const mx = sx / n, my = sy / n;
    const cxx = sxx / n - mx * mx, cyy = syy / n - my * my, cxy = sxy / n - mx * my;
    let nx = 0, ny = 0;
    if (Math.hypot(cxx - cyy, 2 * cxy) > 0.2 * (cxx + cyy)) {
      // The surface runs along the long axis of the reflecting cells.
      const th = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
      nx = -Math.sin(th);
      ny = Math.cos(th);
    } else if (mx * mx + my * my > 0.1) {
      // A corner: face away from the middle of the reflecting cells.
      const m = Math.hypot(mx, my);
      nx = -mx / m;
      ny = -my / m;
    }
    let dot = nx * vx + ny * vy;
    if (dot > 0) { nx = -nx; ny = -ny; dot = -dot; }
    if (dot < -0.25 * Math.hypot(vx, vy)) {
      this.pvx[k] = vx - 2 * dot * nx;
      this.pvy[k] = vy - 2 * dot * ny;
      return;
    }
    const hitX = ix !== lx, hitY = iy !== ly;
    if (hitX && hitY) {
      const bx = surface[type[ly * w + ix]], by = surface[type[iy * w + lx]];
      if (bx && !by) this.pvx[k] = -vx;
      else if (by && !bx) this.pvy[k] = -vy;
      else { this.pvx[k] = -vx; this.pvy[k] = -vy; }
    } else if (hitX) {
      this.pvx[k] = -vx;
    } else {
      this.pvy[k] = -vy;
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
    const x = this.px[k], y = this.py[k], vx = this.pvx[k], vy = this.pvy[k], T = this.ptemp[k];
    this.killProjectile(k);
    const p = this.spawnProjectile(PROTON, x, y, vx * 0.75, vy * 0.75);
    if (p >= 0) this.ptemp[p] = T;
    this.spawnProjectile(ELECTRON, x, y);
    this.spawnProjectile(NEUTRINO, x, y);
    this.record(PROTON, SPECIAL['neutron-proton']);
    this.record(ELECTRON, SPECIAL['neutron-electron']);
    this.record(NEUTRINO, SPECIAL['neutron-neutrino']);
  },
};
