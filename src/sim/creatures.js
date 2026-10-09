// Shaped creatures: the bigger animals and humans have bodies several cells
// big (shapes.js). Each is an entity in world.creatures, and its body is
// written into the grid as cells of its element, with ctype holding the
// entity's id and shade the pixel's palette slot. Fire, acid, the eraser
// and heat reach those cells like any other; on its next step the entity
// looks at them, and a pixel that is no longer its own is damaged. A
// creature dies when half its pixels are damaged, or of old age, and heals
// a pixel at a time while nothing hurts it.
//
// A lone cell of a shaped creature (ctype 0) is a seed: painted, made by a
// recipe, hatched or bred. It grows into a whole body, ring by ring outward
// from where it is, wherever the body fits round it.
//
// Mixed into World.prototype; initCreatures sets up the storage.

import { DEFS, ID, State, AMBIENT } from './elements.js';
import { DX8, DY8 } from './gravity.js';
import { SPEEDS, SLOW_EVERY } from './time.js';
import { PASS_BIT } from './walls.js';

const { LIQUID } = State;
const { WALL, ASH } = ID;

export const SHAPED = Uint8Array.from(DEFS, (d) => (d.shape ? 1 : 0));
// What fliers and walkers move through: empty space, gases and loose flames.
export const AIRY = Uint8Array.from(DEFS, (d) => (d.id === 0 || (d.displaceable && d.state !== LIQUID) ? 1 : 0));
export const GROW_EVERY = 2; // steps per ring of a growing body
export const GROW_GIVE_UP = 120; // steps a seed, or a blocked ring, waits for room
export const HEAL_AFTER = 150; // steps without harm for each pixel healed
export const SUFFOCATE_EVERY = 30; // steps per pixel lost out of breath (or water)
export const HOT_HURT = 60; // °C: a pixel hotter than this, or colder than
export const COLD_HURT = -15; // this, is damaged (unless the creature is tough)
export const NEWBORN_GRACE = 60; // steps after birth before heat can hurt it
const MAX_FALL = 4; // cells a step

// What each pixel of a body is.
export const BODY = 0, HURT = 1, UNBORN = 2;

export function initCreatures(world) {
  world.creatures = []; // every entity, in no particular order
  world.creatureById = [null]; // id (the ctype of its cells) -> entity
  world.freeCreatureIds = [];
  world.camps = []; // humans' camps (humans.js)
  world.humanMade = new Map(); // cell -> what a human put there (humans.js)
  world.shots = []; // pellet tracers, drawn for a few frames (humans.js)
  world.footA = new Int32Array(64); // scratch for working out footprints
  world.footB = new Int32Array(64);
}

export const Creatures = {
  newCreature(t, x, y, facing, gx, gy) {
    const d = DEFS[t], sh = d.shape;
    const id = this.freeCreatureIds.length > 0 ? this.freeCreatureIds.pop() : this.creatureById.length;
    if (id > 65535) return null;
    const look = new Uint8Array(sh.letters.length);
    for (let l = 0; l < look.length; l++) look[l] = (this.rand() * sh.options[l]) | 0;
    const e = {
      id, kind: t, x, y, facing, frame: 0, gx, gy,
      n: sh.n,
      pix: new Uint8Array(sh.n).fill(UNBORN), // BODY, HURT or UNBORN, per pixel
      cells: new Int32Array(sh.n).fill(-1), // where each pixel is (-1: nowhere)
      ring: new Uint8Array(sh.n), // when each pixel grows, in rings from the seed
      look, // the colour picked for each palette letter
      seed: 0, // the pixel it grew from
      grow: 0, // steps since it hatched while it's growing, then -1
      wait: 0, // growing steps a ring has been blocked
      lost: 0, // damaged pixels
      burnt: 0, // of those, damaged by heat
      hurtAt: 0, // the tick it was last hurt
      age: 0,
      lifespan: d.lifeMin + ((this.rand() * (d.lifeMax - d.lifeMin + 1)) | 0),
      fallV: 0, // falling speed, cells a step
      vx: 0, vy: 0, // thrown by a blast
      pushX: 0, pushY: 0, // carried by a conveyor this step
      dry: 0, // steps a swimmer has been out of water
      wades: d.critter.wades,
      brain: null, // a human's (humans.js)
      shot: false, // hit by gunfire (an animal killed so leaves Meat)
      slot: this.creatures.length, // its place in world.creatures
    };
    if (id === this.creatureById.length) this.creatureById.push(e);
    else this.creatureById[id] = e;
    this.creatures.push(e);
    return e;
  },

  // Drop e from the lists (its cells are left as they are).
  forgetCreature(e) {
    if (e.brain !== null) { // humans.js
      this.dropInventory(e);
      this.leaveCamp(e);
    }
    const list = this.creatures, last = list.pop();
    if (last !== e) {
      list[e.slot] = last;
      last.slot = e.slot;
    }
    this.creatureById[e.id] = null;
    this.freeCreatureIds.push(e.id);
  },

  // Take e out of the world, clearing the cells still its own (but `keep`).
  removeCreature(e, keep = -1) {
    for (let p = 0; p < e.n; p++) {
      const c = e.cells[p];
      if (c >= 0 && c !== keep && this.ownCell(e, c)) this.clearCell(c);
    }
    this.forgetCreature(e);
  },

  ownCell(e, c) {
    return this.type[c] === e.kind && this.ctype[c] === e.id;
  },

  // The way down at (x, y), as one of the four straight directions: a body
  // stands upright along it. null where nothing pulls.
  downFor(x, y) {
    const g = this.gravity;
    if (!g.newtonian) return { gx: g.downX, gy: g.downY };
    const k = g.dirA[this.air.at(x, y)];
    if (k < 0) return null;
    return { gx: DX8[k & 6], gy: DY8[k & 6] }; // a diagonal rounds to its neighbour
  },

  // The cells of a kind's frame `fr` with its anchor at (x, y), facing
  // `facing` (1 or -1), standing along down (gx, gy), into `out`. False if
  // any falls outside the world.
  placeCells(kind, x, y, fr, facing, gx, gy, out) {
    const f = DEFS[kind].shape.frames[fr];
    const rx = gy * facing, ry = -gx * facing;
    const { w, h } = this;
    for (let p = 0; p < f.dx.length; p++) {
      const cx = x + f.dx[p] * rx + f.dy[p] * gx, cy = y + f.dx[p] * ry + f.dy[p] * gy;
      if (cx < 0 || cy < 0 || cx >= w || cy >= h) return false;
      out[p] = cy * w + cx;
    }
    return true;
  },

  inFootprint(c, out, n) {
    for (let p = 0; p < n; p++) if (out[p] === c) return true;
    return false;
  },

  // Can e's body take cell c? Its own cells, empty space, a wall that lets
  // solids through, or anything it can push aside: gases and flames, and
  // liquids for creatures that go into them.
  roomForBody(e, c) {
    const u = this.type[c];
    if (u === 0) return true;
    if (u === e.kind && this.ctype[c] === e.id) return true;
    if (u === WALL) return (this.wall[c] & PASS_BIT[e.kind]) !== 0;
    const d = DEFS[u];
    if (!d.displaceable) return false;
    return d.state !== LIQUID || e.wades;
  },

  // Push the loose thing in cell c into the nearest free space (but not a
  // cell of `out`), or clear it. Walls stay.
  makeRoom(c, out, n) {
    const u = this.type[c];
    if (u === 0 || u === WALL) return;
    const m = this.freeSpaceNear(c);
    if (m >= 0 && !this.inFootprint(m, out, n)) this.swap(c, m);
    else this.clearCell(c);
  },

  writePixel(e, p, c, T, fr) {
    const sh = DEFS[e.kind].shape;
    const l = sh.frames[fr].letter[p];
    this.type[c] = e.kind;
    this.ctype[c] = e.id;
    this.temp[c] = T;
    this.life[c] = 0;
    this.vx[c] = 0;
    this.vy[c] = 0;
    this.loose[c] = 0;
    this.shade[c] = sh.base[l] + e.look[l];
    this.clock[c] = this.pass;
    e.cells[p] = c;
  },

  // The average temperature of e's body.
  bodyTemp(e) {
    let sum = 0, k = 0;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      sum += this.temp[e.cells[p]];
      k++;
    }
    return k > 0 ? sum / k : AMBIENT;
  },

  // A shaped creature's cell in the particle pass. Part of a body: nothing
  // to do but react like any cell (the entity does the rest). A seed tries
  // to hatch; one that finds no room for GROW_GIVE_UP steps is gone.
  updateBody(i, x, y, t) {
    if (this.ctype[i] !== 0) return false;
    if (this.hatch(i, x, y, t)) return true;
    if (++this.life[i] > GROW_GIVE_UP) {
      this.clearCell(i);
      return true;
    }
    return false;
  },

  // A seed at i (x, y): find a place for the whole body covering i, with
  // room for every pixel, trying first the pixels nearest the middle of the
  // shape on the seed, and start growing there. False while there's no room.
  hatch(i, x, y, t) {
    const sh = DEFS[t].shape, f = sh.frames[0];
    const { gx, gy } = this.downFor(x, y) ?? { gx: 0, gy: 1 };
    const facing = this.rand() < 0.5 ? 1 : -1;
    const rx = gy * facing, ry = -gx * facing;
    const probe = { kind: t, id: -1, wades: DEFS[t].critter.wades };
    const out = this.footA;
    for (let k = 0; k < sh.n; k++) {
      const p = sh.order[k];
      const ax = x - (f.dx[p] * rx + f.dy[p] * gx), ay = y - (f.dx[p] * ry + f.dy[p] * gy);
      if (!this.placeCells(t, ax, ay, 0, facing, gx, gy, out)) continue;
      let room = true;
      for (let q = 0; q < sh.n && room; q++) room = out[q] === i || this.roomForBody(probe, out[q]);
      if (!room) continue;
      const e = this.newCreature(t, ax, ay, facing, gx, gy);
      if (e === null) return false;
      for (let q = 0; q < sh.n; q++) e.ring[q] = Math.max(Math.abs(f.dx[q] - f.dx[p]), Math.abs(f.dy[q] - f.dy[p]));
      e.seed = p;
      this.writePixel(e, p, i, this.temp[i], 0);
      e.pix[p] = BODY;
      return true;
    }
    return false;
  },

  // Being born: another ring of pixels every GROW_EVERY steps, each where
  // there's room (anything loose in the way is pushed aside). A ring
  // blocked for GROW_GIVE_UP growing steps: the body shrinks back to its
  // seed, which looks for room again (or gives up, see updateBody).
  growStep(e) {
    e.grow++;
    if (e.grow % GROW_EVERY !== 0) return;
    const ring = e.grow / GROW_EVERY;
    const out = this.footA;
    if (!this.placeCells(e.kind, e.x, e.y, e.frame, e.facing, e.gx, e.gy, out)) return;
    const T = this.bodyTemp(e);
    let unborn = 0, blocked = false;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== UNBORN) continue;
      if (e.ring[p] > ring) { unborn++; continue; }
      const c = out[p];
      if (!this.roomForBody(e, c)) { unborn++; blocked = true; continue; }
      this.makeRoom(c, out, e.n);
      this.writePixel(e, p, c, T, e.frame);
      e.pix[p] = BODY;
    }
    if (unborn === 0) { e.grow = -1; return; }
    if (blocked && ++e.wait > GROW_GIVE_UP) {
      const s = e.cells[e.seed];
      if (e.pix[e.seed] !== BODY) { this.removeCreature(e); return; }
      this.removeCreature(e, s);
      this.ctype[s] = 0; // a seed again
      this.life[s] = 0;
    }
  },

  // Move e's body: anchor (x, y), frame fr, facing, down (gx, gy). Liquids,
  // gases and flames in the way go into the cells it leaves (or the nearest
  // free space). False, changing nothing, if anything else is in the way or
  // it would leave the world.
  moveBody(e, x, y, fr, facing, gx, gy) {
    const out = this.footA, old = this.footB, n = e.n;
    if (!this.placeCells(e.kind, x, y, fr, facing, gx, gy, out)) return false;
    for (let p = 0; p < n; p++) if (e.pix[p] === BODY && !this.roomForBody(e, out[p])) return false;
    let sum = 0, k = 0;
    for (let p = 0; p < n; p++) {
      const c = e.cells[p];
      old[p] = c;
      if (c < 0) continue;
      sum += this.temp[c];
      k++;
      this.clearCell(c);
      e.cells[p] = -1;
    }
    const T = k > 0 ? sum / k : AMBIENT;
    let f = 0;
    for (let p = 0; p < n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = out[p], u = this.type[c];
      if (u === 0 || u === WALL) continue;
      while (f < n && (old[f] < 0 || this.type[old[f]] !== 0 || this.inFootprint(old[f], out, n))) f++;
      if (f < n) this.swap(c, old[f++]);
      else this.makeRoom(c, out, n);
    }
    for (let p = 0; p < n; p++) if (e.pix[p] === BODY) this.writePixel(e, p, out[p], T, fr);
    e.x = x;
    e.y = y;
    e.frame = fr;
    e.facing = facing;
    e.gx = gx;
    e.gy = gy;
    return true;
  },

  hurt(e, p, heat) {
    e.pix[p] = HURT;
    e.cells[p] = -1;
    e.lost++;
    if (heat) e.burnt++;
    e.hurtAt = this.tick;
  },

  // A random pixel of e's body, or -1 if there's none left.
  randomPixel(e) {
    const s = (this.rand() * e.n) | 0;
    for (let k = 0; k < e.n; k++) {
      const p = (s + k) % e.n;
      if (e.pix[p] === BODY) return p;
    }
    return -1;
  },

  // Its cell, or -1.
  randomCell(e) {
    const p = this.randomPixel(e);
    return p < 0 ? -1 : e.cells[p];
  },

  hurtRandom(e) {
    const p = this.randomPixel(e);
    if (p < 0) return;
    this.clearCell(e.cells[p]);
    this.hurt(e, p, false);
  },

  // Look at e's cells: any no longer its own is a damaged pixel, as is one
  // too hot or cold. A cell turned into another shaped creature (Bird +
  // Fire) turns the whole creature into one: the body goes, and that cell
  // is the new one's seed (which may have hatched already, if it was turned
  // between steps). False if the creature is gone.
  checkBody(e) {
    const { type, ctype, temp } = this;
    const feels = !DEFS[e.kind].critter.tough && e.age >= NEWBORN_GRACE;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = e.cells[p], u = type[c];
      if (u === e.kind && ctype[c] === e.id) {
        if (feels && (temp[c] > HOT_HURT || temp[c] < COLD_HURT)) {
          this.clearCell(c);
          this.hurt(e, p, true);
        }
        continue;
      }
      if (SHAPED[u] && u !== e.kind && (ctype[c] === 0 || this.seedOf(ctype[c]) === c)) {
        this.removeCreature(e, c);
        return false;
      }
      this.hurt(e, p, false);
    }
    if (e.lost * 2 >= e.n) {
      this.creatureDies(e);
      return false;
    }
    return true;
  },

  // The cell creature `id` is growing from, while it's being born; else -1.
  seedOf(id) {
    const o = this.creatureById[id];
    return o && o.grow >= 0 ? o.cells[o.seed] : -1;
  },

  // What's left of the body becomes its remains: ash if it died mostly of
  // heat, otherwise what its kind leaves (lifeEnd), pixel by pixel.
  creatureDies(e) {
    const le = DEFS[e.kind].lifeEnd;
    const burnt = e.burnt * 2 > e.lost;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = e.cells[p];
      if (burnt) this.convert(c, ASH, false, -1);
      else if (e.shot && e.brain === null) this.convert(c, ID.MEAT, false, -1);
      else if (le === null) this.clearCell(c);
      else if (le.alt >= 0 && this.rand() < le.altChance) this.convert(c, le.alt, false, le.altRule);
      else this.convert(c, le.to, false, le.rule);
    }
    this.forgetCreature(e);
  },

  // A damaged pixel grows back, where its place is empty.
  healPixel(e) {
    const out = this.footA;
    if (!this.placeCells(e.kind, e.x, e.y, e.frame, e.facing, e.gx, e.gy, out)) return;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== HURT || this.type[out[p]] !== 0) continue;
      const T = this.bodyTemp(e);
      this.writePixel(e, p, out[p], T, e.frame);
      e.pix[p] = BODY;
      e.lost--;
      if (e.burnt > e.lost) e.burnt = e.lost;
      e.hurtAt = this.tick;
      return;
    }
  },

  // Is anything holding e up: a cell under one of its pixels that isn't
  // its own, empty, a gas or flame, or (for creatures that go into
  // liquids) a liquid? The edge of the world holds it up too.
  supported(e) {
    const { w, h, type } = this;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = e.cells[p];
      const nx = (c % w) + e.gx, ny = ((c / w) | 0) + e.gy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return true;
      const j = ny * w + nx, u = type[j];
      if (u === 0 || (u === e.kind && this.ctype[j] === e.id)) continue;
      if (u === WALL) {
        if ((this.wall[j] & PASS_BIT[e.kind]) !== 0) continue;
        return true;
      }
      const d = DEFS[u];
      if (d.displaceable && (d.state !== LIQUID || e.wades)) continue;
      return true;
    }
    return false;
  },

  // With nothing under it, it falls along its down, faster each step like
  // a grain. True while it's in the air.
  fall(e) {
    if (this.downAt(this.air.at(e.x, e.y)) < 0 || this.supported(e)) {
      e.fallV = 0;
      return false;
    }
    e.fallV = Math.min(MAX_FALL, e.fallV + 0.25);
    const n = Math.max(1, e.fallV | 0);
    for (let s = 0; s < n; s++) {
      if (!this.moveBody(e, e.x + e.gx, e.y + e.gy, e.frame, e.facing, e.gx, e.gy)) {
        e.fallV = 0;
        break;
      }
      // On a portal: it goes through on its next step (portalCreature).
      if (this.portalCells !== 0 && this.portalAt[e.y * this.w + e.x] !== 0) break;
    }
    return true;
  },

  // Thrown by a blast: a cell a step along (vx, vy) while it's moving fast
  // enough, slowing down. True while it's flying.
  fling(e) {
    const sx = Math.abs(e.vx) >= 0.5 ? Math.sign(e.vx) : 0, sy = Math.abs(e.vy) >= 0.5 ? Math.sign(e.vy) : 0;
    if (sx === 0 && sy === 0) {
      e.vx = 0;
      e.vy = 0;
      return false;
    }
    if (sx !== 0 && !this.moveBody(e, e.x + sx, e.y, e.frame, e.facing, e.gx, e.gy)) e.vx = 0;
    if (sy !== 0 && !this.moveBody(e, e.x, e.y + sy, e.frame, e.facing, e.gx, e.gy)) e.vy = 0;
    e.vx *= 0.85;
    e.vy *= 0.85;
    return true;
  },

  // Turn upright when the way down changes.
  orient(e) {
    const dn = this.downFor(e.x, e.y);
    if (dn === null || (dn.gx === e.gx && dn.gy === e.gy)) return;
    this.moveBody(e, e.x, e.y, e.frame, e.facing, dn.gx, dn.gy);
  },

  // Painting a shaped creature puts down seeds a body apart: each into
  // empty space (or, for a swimmer, water) with no other creature's seed or
  // body that close.
  paintCreatures(area, t) {
    const { w: sw, h: sh } = DEFS[t].shape;
    const c = DEFS[t].critter;
    const into = (u) => u === 0 || (c.moves === 'swim' && c.home[u] === 1);
    area((i, x, y) => {
      if (!into(this.type[i])) return;
      for (let dy = -sh; dy <= sh; dy++) {
        for (let dx = -sw; dx <= sw; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < this.w && ny < this.h && SHAPED[this.type[ny * this.w + nx]]) return;
        }
      }
      if (this.type[i] !== 0) this.clearCell(i);
      this.spawn(i, t);
    });
  },

  // A conveyor under creature `id` moves it a cell (on its next step).
  nudgeCreature(id, dx, dy) {
    const e = this.creatureById[id];
    if (e) {
      e.pushX = dx;
      e.pushY = dy;
    }
  },

  // Standing or falling on a portal: the whole body goes through, if
  // there's room for it past the other end.
  portalCreature(e) {
    const a = e.y * this.w + e.x;
    const v = this.portalAt[a];
    if (v === 0) return false;
    const pr = this.portals[(v >> 17) - 1];
    if (pr.b === null) return false;
    const end = ((v >> 16) & 1) === 0 ? pr.a : pr.b;
    // The way it's going: down while falling, else the way it faces.
    const mx = e.fallV > 0 ? e.gx : e.gy * e.facing, my = e.fallV > 0 ? e.gy : -e.gx * e.facing;
    const out = this.portalExit(a, mx * end.nx + my * end.ny < 0 ? -1 : 1);
    if (out === null || out.j < 0) return false;
    return this.moveBody(e, out.j % this.w, (out.j / this.w) | 0, e.frame, e.facing, e.gx, e.gy);
  },

  // A blast within r of (x, y): each pixel it reaches may be destroyed (the
  // likelier the stronger and closer), and the creature is thrown away
  // from it and upward. Walls shield.
  blastCreatures(x, y, strength, r) {
    const r2 = r * r;
    for (const e of this.creatures) {
      if (Math.abs(e.x - x) > r + 8 || Math.abs(e.y - y) > r + 8) continue;
      let hit = false;
      for (let p = 0; p < e.n; p++) {
        if (e.pix[p] !== BODY) continue;
        const c = e.cells[p], cx = c % this.w, cy = (c / this.w) | 0;
        const d2 = (cx - x) ** 2 + (cy - y) ** 2;
        if (d2 > r2 || this.wallBetween(x, y, cx, cy)) continue;
        hit = true;
        if (this.rand() < Math.min(0.9, strength / (8 * Math.max(1, Math.sqrt(d2))))) {
          if (e.brain !== null && e.brain.armour > 0 && this.rand() < 0.5) {
            e.brain.armour--; // its armour took it
            continue;
          }
          this.clearCell(c);
          this.hurt(e, p, false);
        }
      }
      if (!hit) continue;
      const dx = e.x - x, dy = e.y - y, dist = Math.max(1, Math.hypot(dx, dy));
      const f = (strength * 0.7) / dist;
      e.vx += (dx / dist) * f * 0.5 - e.gx * f * 0.3;
      e.vy += (dy / dist) * f * 0.5 - e.gy * f * 0.3;
    }
  },

  // The creature cell i belongs to, or null.
  creatureAt(i) {
    const t = this.type[i];
    if (!SHAPED[t] || this.ctype[i] === 0) return null;
    const e = this.creatureById[this.ctype[i]];
    return e && e.kind === t ? e : null;
  },

  // After the particle pass: every creature takes its step (more of them
  // in a fast time zone, fewer in a slow one, going by where it stands).
  stepCreatures() {
    this.stepCamps(); // humans.js
    const list = this.creatures;
    for (let k = list.length - 1; k >= 0; k--) {
      const e = list[k];
      let reps = 1;
      if (this.zoneCount !== 0) {
        const s = this.speed[e.y * this.w + e.x];
        if (s !== 0) reps = SPEEDS[s] >= 1 ? SPEEDS[s] : (this.tick % SLOW_EVERY[s] === 0 ? 1 : 0);
      }
      for (let r = 0; r < reps && this.creatureById[e.id] === e; r++) this.stepCreature(e);
    }
  },

  stepCreature(e) {
    if (!this.checkBody(e)) return;
    if (e.grow >= 0) {
      this.growStep(e);
      return;
    }
    if (++e.age >= e.lifespan) {
      this.creatureDies(e);
      return;
    }
    if (e.lost > 0 && this.tick - e.hurtAt >= HEAL_AFTER) this.healPixel(e);
    this.orient(e);
    if (this.portalCells !== 0 && this.portalCreature(e)) return;
    if (e.pushX !== 0 || e.pushY !== 0) {
      this.moveBody(e, e.x + e.pushX, e.y + e.pushY, e.frame, e.facing, e.gx, e.gy);
      e.pushX = 0;
      e.pushY = 0;
    }
    if (this.fling(e)) return;
    if (DEFS[e.kind].critter.moves === 'human') this.stepHuman(e);
    else this.stepAnimal(e);
  },

  // An animal's step: sparks and fire from a pixel (eels, the phoenix),
  // eating something touching it, then moving the way its kind moves.
  stepAnimal(e) {
    const d = DEFS[e.kind], c = d.critter;
    const i = this.randomCell(e);
    if (i < 0) return;
    const x = i % this.w, y = (i / this.w) | 0;
    if (c.spark && this.rand() < c.spark) for (let n = 0; n < 3; n++) this.emitAt(ID.ELECTRON, x, y);
    if (c.ignite && this.rand() < 0.2) this.igniteAround(x, y);
    if (this.rand() < 0.1) {
      const j = this.randomNeighbor(x, y);
      const meal = j >= 0 && !this.ownCell(e, j) ? c.food[this.type[j]] : null;
      if (meal) {
        this.eat(i, j, x, y, e.kind, d, meal);
        e.age = Math.max(0, e.age - 300); // well fed
        return;
      }
    }
    if (d.shape.pulse) {
      const fr = (this.tick >> 4) & 1;
      if (fr !== e.frame) this.moveBody(e, e.x, e.y, fr, e.facing, e.gx, e.gy);
    }
    if (c.moves === 'swim') this.swimAbout(e, c);
    else if (c.moves === 'fly') this.flyAbout(e, c);
    else this.walkAbout(e, c);
  },

  // Does any pixel of e touch a cell holding something in `set`?
  touches(e, set) {
    const { w, h, type } = this;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] !== BODY) continue;
      const c = e.cells[p], x = c % w, y = (c / w) | 0;
      if ((x + 1 < w && set[type[c + 1]]) || (x > 0 && set[type[c - 1]])
        || (y + 1 < h && set[type[c + w]]) || (y > 0 && set[type[c - w]])) return true;
    }
    return false;
  },

  // Would every pixel of e, placed so, be in its own cells or cells holding
  // something in `set`?
  fitsIn(e, x, y, fr, facing, set) {
    const out = this.footB;
    if (!this.placeCells(e.kind, x, y, fr, facing, e.gx, e.gy, out)) return false;
    for (let p = 0; p < e.n; p++) {
      if (e.pix[p] === BODY && !set[this.type[out[p]]] && !this.ownCell(e, out[p])) return false;
    }
    return true;
  },

  // One cell across the down arrow (`dir`, 1 or -1, becomes its facing)
  // and `up` cells against it, into cells holding something in `set`,
  // flipping to its other frame. A trail (silk, ink) may be left where it
  // stood. Returns whether it moved.
  tryMove(e, dir, up, set) {
    const sh = DEFS[e.kind].shape;
    const x = e.x + e.gy * dir - up * e.gx, y = e.y - e.gx * dir - up * e.gy;
    const fr = sh.frames.length === 2 && !sh.pulse ? e.frame ^ 1 : e.frame;
    if (!this.fitsIn(e, x, y, fr, dir, set)) return false;
    const was = e.y * this.w + e.x;
    if (!this.moveBody(e, x, y, fr, dir, e.gx, e.gy)) return false;
    const c = DEFS[e.kind].critter, tr = c.trail;
    if (tr !== null && this.rand() < tr.chance && (this.type[was] === 0 || c.home[this.type[was]])) {
      this.spawn(was, tr.id);
      this.record(tr.id, tr.rule);
    }
    return true;
  },

  // Swimmers move only through water. Out of it they fall, and lose a
  // pixel every SUFFOCATE_EVERY steps until they're back in; half out of
  // it (at the surface), they sink until they're under.
  swimAbout(e, c) {
    if (!this.touches(e, c.home)) {
      if (++e.dry % SUFFOCATE_EVERY === 0) this.hurtRandom(e);
      this.fall(e);
      return;
    }
    e.dry = 0;
    if (this.touches(e, AIRY) && this.moveBody(e, e.x + e.gx, e.y + e.gy, e.frame, e.facing, e.gx, e.gy)) return;
    if (this.rand() >= c.speed) return;
    const dir = this.rand() < 0.1 ? -e.facing : e.facing;
    const r = this.rand();
    const up = c.burst ? (r < 0.5 ? 1 : r < 0.6 ? -1 : 0) : (r < 0.15 ? 1 : r < 0.3 ? -1 : 0);
    if (!this.tryMove(e, dir, up, c.home)) this.tryMove(e, -dir, 0, c.home);
  },

  // Fliers flap about through the air.
  flyAbout(e, c) {
    if (this.rand() >= c.speed) return;
    const dir = this.rand() < 0.15 ? -e.facing : e.facing;
    const r = this.rand();
    const up = r < 0.25 ? 1 : r < 0.5 ? -1 : 0;
    if (!this.tryMove(e, dir, up, AIRY)) this.tryMove(e, -dir, 0, AIRY);
  },

  // Walkers fall with nothing under them; otherwise they walk along the
  // ground, up steps of up to c.climb cells, and turn round at walls.
  walkAbout(e, c) {
    if (this.fall(e)) return;
    if (this.rand() >= c.speed) return;
    for (let up = 0; up <= c.climb; up++) if (this.tryMove(e, e.facing, up, AIRY)) return;
    this.moveBody(e, e.x, e.y, e.frame, -e.facing, e.gx, e.gy);
  },
};
