// Sleeping areas. The world is divided into CHUNK × CHUNK chunks; a chunk
// where nothing has changed for SLEEP_AFTER steps, and where nothing can
// change on its own (see restless), falls asleep: its particles aren't
// updated and its heat isn't worked out (world.js). After every step each
// chunk is compared with how it was after the step before: any change, from
// whatever cause (a tool, a blast, heat or a particle from next door), wakes
// it and the chunks round it. So does air that isn't still over it.
// Mixed into World.prototype; initSleep sets up the storage.

import { DEFS, NUM, REACT, State, AMBIENT } from './elements.js';
import { AIR_STILL, HEAT_STILL } from './air.js';

export const CHUNK = 16;
export const SLEEP_AFTER = 8;
const SHIFT = 4; // log2(CHUNK)
const { GAS, ENERGY, LIQUID } = State;

// Elements that can change on their own, wherever they are.
const RESTLESS = Uint8Array.from(DEFS, (d) => (d.id !== 0 && (
  d.state === GAS || (d.state === ENERGY && !d.fixed) || d.behavior !== null || d.active
  || d.holdTemp || d.machine !== null) ? 1 : 0));

export function initSleep(world) {
  const cw = Math.ceil(world.w / CHUNK), ch = Math.ceil(world.h / CHUNK);
  world.cw = cw;
  world.ch = ch;
  world.chunkAwake = new Uint8Array(cw * ch).fill(1);
  world.chunkQuiet = new Uint8Array(cw * ch); // steps in a row with no change
  world.chunkWake = new Uint8Array(cw * ch); // woken this step
  world.chunkChanged = new Uint8Array(cw * ch); // changed this step
  world.snapType = world.type.slice();
  world.snapTemp = world.temp.slice();
  world.sleeping = true; // tests can turn sleeping off to compare
}

export const Sleep = {
  // Is (x, y) in a sleeping chunk?
  asleepAt(x, y) {
    return this.chunkAwake[(y >> SHIFT) * this.cw + (x >> SHIFT)] === 0;
  },

  wakeAll() {
    this.chunkAwake.fill(1);
    this.chunkQuiet.fill(0);
  },

  // After a step: wake what changed (and the chunks round it), and put to
  // sleep what has been quiet long enough with nothing restless in it.
  stepSleep() {
    const { cw, ch, w, h, type, temp, snapType, snapTemp, chunkAwake, chunkQuiet, chunkWake } = this;
    if (!this.sleeping || this.gravity.newtonian) {
      if (!chunkAwake.every((v) => v === 1)) this.wakeAll();
      return;
    }
    // Which chunks changed? A chunk stops being checked at its first
    // difference; then the whole snapshot is copied in one go.
    const changed = this.chunkChanged;
    changed.fill(0);
    for (let y = 0; y < h; y++) {
      const rowC = (y >> SHIFT) * cw, row = y * w;
      for (let cx = 0; cx < cw; cx++) {
        const c = rowC + cx;
        if (changed[c] !== 0) continue;
        for (let i = row + (cx << SHIFT), e = row + Math.min(w, (cx + 1) << SHIFT); i < e; i++) {
          if (type[i] !== snapType[i] || temp[i] !== snapTemp[i]) { changed[c] = 1; break; }
        }
      }
    }
    snapType.set(type);
    snapTemp.set(temp);
    // Wake those, and the chunks round them.
    chunkWake.fill(0);
    for (let cy = 0; cy < ch; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        if (changed[cy * cw + cx] === 0) continue;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy;
          if (ny < 0 || ny >= ch) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            if (nx >= 0 && nx < cw) chunkWake[ny * cw + nx] = 1;
          }
        }
      }
    }
    const air = this.air;
    for (let c = 0; c < cw * ch; c++) {
      if (chunkWake[c] || (!chunkAwake[c] && !air.still && this.airStirs(c))) {
        chunkAwake[c] = 1;
        chunkQuiet[c] = 0;
      } else if (chunkAwake[c]) {
        if (chunkQuiet[c] < SLEEP_AFTER) chunkQuiet[c]++;
        // Not while the air over it is stirring: pressure tears, wind blows.
        else if (!this.restless(c) && (air.still || !this.airStirs(c))) chunkAwake[c] = 0;
      }
    }
  },

  // Is the air over chunk c, or just beside it, stirring (pressure, wind,
  // or warm or cold air)? Beside it too: a solid feels the pressure in the
  // blocks next to its own (World.pressureOn), so a thick shell whose own
  // blocks are sealed still tears from the air against it.
  airStirs(c) {
    const air = this.air;
    const { p, vx, vy, t } = air;
    const cx = c % this.cw, cy = (c / this.cw) | 0;
    const bx0 = (cx << SHIFT) >> 2, by0 = (cy << SHIFT) >> 2; // air blocks are 4 × 4 cells
    const bx1 = Math.min(air.cols, bx0 + CHUNK / 4 + 1), by1 = Math.min(air.rows, by0 + CHUNK / 4 + 1);
    for (let by = Math.max(-1, by0 - 1); by < by1; by++) {
      for (let bx = Math.max(-1, bx0 - 1); bx < bx1; bx++) {
        const a = (by + 1) * air.W + bx + 1;
        if (Math.abs(p[a]) > AIR_STILL || Math.abs(vx[a]) > AIR_STILL || Math.abs(vy[a]) > AIR_STILL) return true;
        if (air.heat && Math.abs(t[a] - AMBIENT) > HEAT_STILL) return true;
      }
    }
    return false;
  },

  // Can anything in chunk c change on its own? Temperatures within
  // HEAT_STILL of room temperature are set to exactly room temperature
  // (and the snapshot with them, so that isn't a change).
  restless(c) {
    const { w, h, type, temp, life, loose, vx, vy, snapTemp } = this;
    const cx = c % this.cw, cy = (c / this.cw) | 0;
    const x0 = cx << SHIFT, y0 = cy << SHIFT;
    const x1 = Math.min(w, x0 + CHUNK), y1 = Math.min(h, y0 + CHUNK);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * w + x;
        const t = type[i];
        if (t === 0) continue;
        if (RESTLESS[t] || life[i] > 0 || loose[i]) return true;
        const d = DEFS[t];
        // A settled liquid keeps a small sideways velocity (the way it was
        // last flowing); that isn't movement.
        if (d.state !== LIQUID && (Math.abs(vx[i]) >= 0.01 || Math.abs(vy[i]) >= 0.01)) return true;
        const T = temp[i];
        if (T !== AMBIENT) {
          if (Math.abs(T - AMBIENT) > HEAT_STILL) return true;
          temp[i] = AMBIENT;
          snapTemp[i] = AMBIENT;
        }
        if (d.high !== null && AMBIENT >= d.high.temp) return true;
        if (d.low !== null && !d.low.restore && AMBIENT <= d.low.temp) return true;
        if (d.burn !== null && AMBIENT >= d.ignite) return true;
        if (this.portalCells !== 0 && this.portalAt[i] !== 0) return true;
        if (this.zoneCount !== 0 && this.speed[i] !== 0) return true;
        if (d.reactive) {
          for (let k = 0; k < 4; k++) {
            const j = this.cellAt(x + (k === 0 ? 1 : k === 1 ? -1 : 0), y + (k === 2 ? 1 : k === 3 ? -1 : 0));
            if (j < 0 || type[j] === 0) continue;
            const r = REACT[t * NUM + type[j]];
            if (r !== null && (AMBIENT >= r.minTemp || temp[j] >= r.minTemp)) return true;
          }
        }
      }
    }
    return false;
  },
};
