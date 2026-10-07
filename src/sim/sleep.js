// Sleeping areas. The world is divided into CHUNK × CHUNK chunks, each in one
// of three states:
//
// - awake: simulated as usual;
// - half asleep: its particles are frozen (not updated), but heat still
//   flows through it and the air over it still moves. A chunk goes half
//   asleep when nothing in it has moved for SLEEP_AFTER steps and nothing in
//   it would answer the heat or air it has (see responsive): empty space,
//   or a settled floor warming slowly, in a breeze too light to stir it;
// - fully asleep: its heat isn't worked out either (world.js). A half-
//   asleep chunk whose temperatures haven't changed for SLEEP_AFTER steps,
//   with still air round it and nothing that can change on its own (see
//   restless), falls fully asleep.
//
// After every step each chunk is compared with how it was after the step
// before. Anything moving or changing element in it (from whatever cause: a
// tool, a blast, a grain from next door) wakes it and the chunks round it.
// Heat arriving, or air stirring, brings a fully asleep chunk down to half
// asleep, and a half-asleep chunk wakes as soon as anything in it would
// answer them (checked every CHECK_EVERY steps).
// Mixed into World.prototype; initSleep sets up the storage.

import { DEFS, NUM, REACT, State, AMBIENT } from './elements.js';
import { AIR_STILL, HEAT_STILL } from './air.js';

export const CHUNK = 16;
export const SLEEP_AFTER = 8;
const CHECK_EVERY = 4;
const SHIFT = 4; // log2(CHUNK)
// Pressure this far from normal moves boiling and melting points (air.js).
const PHASE_PRESSURE = 0.25;
// A resting powder or liquid wakes when the wind on it, times how hard wind
// pushes it (its airDrag), passes WIND_WAKE: wind of about 0.4 for sand,
// 0.13 for snow. Landing halves a grain's speed every step, so a lighter
// breeze barely stirs it, and SLEEP_AFTER quiet steps have shown it isn't
// moving. Likewise a particle only counts as moving from MOVING cells a step.
const WIND_WAKE = 0.02;
const MOVING = 0.5;
const { GAS, ENERGY, LIQUID, SOLID } = State;

// Elements that can change on their own, wherever they are.
const RESTLESS = Uint8Array.from(DEFS, (d) => (d.id !== 0 && (
  d.state === GAS || (d.state === ENERGY && !d.fixed) || d.behavior !== null || d.active
  || d.holdTemp || d.machine !== null) ? 1 : 0));

export function initSleep(world) {
  const cw = Math.ceil(world.w / CHUNK), ch = Math.ceil(world.h / CHUNK);
  const n = cw * ch;
  world.cw = cw;
  world.ch = ch;
  world.chunkAwake = new Uint8Array(n).fill(1); // particles updated
  world.chunkFull = new Uint8Array(n); // fully asleep: no heat either
  world.chunkStill = new Uint8Array(n); // steps in a row with nothing moving
  world.chunkCool = new Uint8Array(n); // steps in a row with no temperature change
  world.chunkWake = new Uint8Array(n); // woken this step
  world.chunkMoved = new Uint8Array(n); // an element changed this step
  world.chunkWarmed = new Uint8Array(n); // a temperature changed this step
  world.snapType = world.type.slice();
  world.snapTemp = world.temp.slice();
  world.sleeping = true; // tests can turn sleeping off to compare
}

export const Sleep = {
  // Is (x, y) in a chunk whose particles are frozen (half or fully asleep)?
  asleepAt(x, y) {
    return this.chunkAwake[(y >> SHIFT) * this.cw + (x >> SHIFT)] === 0;
  },

  // Is (x, y) in a fully asleep chunk?
  fullyAsleepAt(x, y) {
    return this.chunkFull[(y >> SHIFT) * this.cw + (x >> SHIFT)] === 1;
  },

  wakeAll() {
    this.chunkAwake.fill(1);
    this.chunkFull.fill(0);
    this.chunkStill.fill(0);
    this.chunkCool.fill(0);
  },

  // After a step: wake what moved (and the chunks round it); bring fully
  // asleep chunks that heat or air reached down to half asleep; wake half-
  // asleep chunks where something would answer them; and let quiet chunks
  // sleep, half or fully.
  stepSleep() {
    const { cw, ch, w, h, type, temp, snapType, snapTemp } = this;
    const { chunkAwake, chunkFull, chunkStill, chunkCool, chunkWake, chunkMoved: moved, chunkWarmed: warmed } = this;
    if (!this.sleeping || this.gravity.newtonian) {
      if (!chunkAwake.every((v) => v === 1)) this.wakeAll();
      return;
    }
    // What changed? Each chunk is checked until both are known; then the
    // whole snapshot is copied in one go.
    moved.fill(0);
    warmed.fill(0);
    for (let y = 0; y < h; y++) {
      const rowC = (y >> SHIFT) * cw, row = y * w;
      for (let cx = 0; cx < cw; cx++) {
        const c = rowC + cx;
        if (moved[c] !== 0 && warmed[c] !== 0) continue;
        for (let i = row + (cx << SHIFT), e = row + Math.min(w, (cx + 1) << SHIFT); i < e; i++) {
          if (type[i] !== snapType[i]) moved[c] = 1;
          if (temp[i] !== snapTemp[i]) warmed[c] = 1;
          if (moved[c] !== 0 && warmed[c] !== 0) break;
        }
      }
    }
    snapType.set(type);
    snapTemp.set(temp);
    // Something moved: wake the chunk, and the chunks round it.
    chunkWake.fill(0);
    for (let cy = 0; cy < ch; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        if (moved[cy * cw + cx] === 0) continue;
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
    const tick = this.tick;
    for (let c = 0; c < cw * ch; c++) {
      if (chunkWake[c]) {
        chunkAwake[c] = 1;
        chunkFull[c] = 0;
        chunkStill[c] = 0;
        chunkCool[c] = 0;
        continue;
      }
      chunkCool[c] = warmed[c] ? 0 : Math.min(255, chunkCool[c] + 1);
      if (chunkAwake[c]) {
        // Awake: half asleep once nothing has moved for a while and nothing
        // would answer the heat and air here.
        if (chunkStill[c] < SLEEP_AFTER) chunkStill[c]++;
        else if ((c + tick) % CHECK_EVERY === 0 && !this.responsive(c)) chunkAwake[c] = 0;
      } else if (chunkFull[c]) {
        // Fully asleep: heat arriving or air stirring brings it to half
        // asleep, or awake if anything in it answers straight away.
        if (warmed[c] || (!air.still && this.airStirs(c))) {
          chunkFull[c] = 0;
          if (this.responsive(c)) {
            chunkAwake[c] = 1;
            chunkStill[c] = 0;
          }
        }
      } else if ((c + tick) % CHECK_EVERY === 0) {
        // Half asleep: wake if anything would now answer the heat or air;
        // fully asleep once the heat has settled and the air is still.
        if (this.responsive(c)) {
          chunkAwake[c] = 1;
          chunkStill[c] = 0;
        } else if (chunkCool[c] >= SLEEP_AFTER && (air.still || !this.airStirs(c)) && !this.restless(c)) {
          chunkFull[c] = 1;
        }
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

  // Is there anything in chunk c that can change on its own, or that would
  // answer the heat and the air it has: something past its melting, boiling
  // or ignition point, a pair that can react at their temperatures, a
  // powder or liquid in a wind, a solid feeling pressure that could tear it,
  // anything whose melting or boiling point the pressure has moved?
  responsive(c) {
    const { w, h, type, temp, life, loose, vx, vy } = this;
    const air = this.air;
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
        if (Math.abs(vx[i]) >= MOVING || Math.abs(vy[i]) >= MOVING) return true;
        if (this.portalCells !== 0 && this.portalAt[i] !== 0) return true;
        if (this.zoneCount !== 0 && this.speed[i] !== 0) return true;
        const T = temp[i];
        if (d.high !== null && T >= d.high.temp) return true;
        if (d.low !== null && !d.low.restore && T <= d.low.temp) return true;
        if (d.burn !== null && T >= d.ignite) return true;
        if (d.reactive && this.canReact(i, x, y, t, T)) return true;
        if (!air.still) {
          const a = air.at(x, y);
          if ((d.high !== null || d.low !== null) && Math.abs(air.p[a]) > PHASE_PRESSURE) return true;
          if (d.strength > 0 && this.pressureOn(x, y, d, true) >= d.strength * 0.1) return true;
          if (d.pressure !== null && this.pressureOn(x, y, d) >= d.pressure.above) return true;
          if (d.state !== SOLID && Math.max(Math.abs(air.cvx(a)), Math.abs(air.cvy(a))) * d.airDrag > WIND_WAKE) return true;
        }
      }
    }
    return false;
  },

  // Can the particle at i (element t, temperature T) react with a neighbour?
  canReact(i, x, y, t, T) {
    const { type, temp } = this;
    for (let k = 0; k < 4; k++) {
      const j = this.cellAt(x + (k === 0 ? 1 : k === 1 ? -1 : 0), y + (k === 2 ? 1 : k === 3 ? -1 : 0));
      if (j < 0 || type[j] === 0) continue;
      const r = REACT[t * NUM + type[j]];
      if (r !== null && (T >= r.minTemp || temp[j] >= r.minTemp)) return true;
    }
    return false;
  },

  // Can anything in chunk c change on its own, at room temperature?
  // Temperatures within HEAT_STILL of room temperature are set to exactly
  // room temperature (and the snapshot with them, so that isn't a change).
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
        if (d.reactive && this.canReact(i, x, y, t, AMBIENT)) return true;
      }
    }
    return false;
  },
};
