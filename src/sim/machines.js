// Machines and the controls that drive them, mixed into World.prototype.
//
// Controls (switch, button, clock, pressure plate, photocell, thermostat)
// decide each frame whether they are on. A control that is on sends current
// into idle wires touching it, like a battery, and powers machines touching
// it directly. Current running along a wire powers the machines beside it.
// A connected block of one control acts as one: step on any part of a wide
// pressure plate and all of it switches on.
//
// A powered machine keeps working for POWER_HOLD frames, long enough to
// bridge the gaps between the pulses a wire carries, so it runs steadily
// while its wire is live and stops soon after. Power fills the whole
// connected block of the same machine, so a big lamp or door acts as one.
//
// Doors open by vanishing. The open doorway is remembered (doorTimer) and the
// door comes back once the power has been off for DOOR_HOLD frames, pushing
// loose things out of the way. `life` is a machine's power timer; for a
// control it is lit while the control is on. `ctype` holds a control's state
// (a switch's position, a button's countdown) or what a dispenser pours.

import { DEFS, ID, State } from './elements.js';
import { CELL } from './air.js';
import { CONDUCTOR, POWERED, DISPENSABLE } from './lookups.js';

const { SOLID, POWDER, GAS, ENERGY } = State;
const { DOOR, PHOTON } = ID;

export const POWER_HOLD = 20;
export const DOOR_HOLD = 20;
const BUTTON_TIME = 90;
const CLOCK_PERIOD = 60;
const PRESS_HOLD = 4; // frames without a spark before a switch can flip again
const PHOTOCELL_TIME = 8;
const THERMOSTAT_TEMP = 60;
const HEATER_MAX = 1200;
const COOLER_MIN = -150;
const FAN_PUSH = 0.25;
const DX4 = [1, -1, 0, 0];
const DY4 = [0, 0, 1, -1];

const PUSH_REACH = 6; // how far a shutting door can shove things aside

export function initMachines(world) {
  const n = world.w * world.h;
  world.doorTimer = new Uint8Array(n); // frames until an open doorway shuts
  world.doorList = []; // cells with a doorTimer
  world.flood = new Int32Array(n);
  world.floodMark = new Uint32Array(n);
  world.floodStamp = 0;
}

export const Machines = {
  updateMachine(i, x, y, d) {
    const kind = d.machine;
    let on;
    switch (kind) {
      // ---- controls: work out whether it is on --------------------------------
      case 'switch': {
        const c = this.ctype[i];
        if (c > 1) this.ctype[i] = c - 2; // count down the press hold
        on = (c & 1) === 1;
        break;
      }
      case 'button':
        on = this.ctype[i] > 0;
        if (on) this.ctype[i]--;
        break;
      case 'clock':
        on = this.tick % CLOCK_PERIOD < 2;
        break;
      case 'plate': {
        // Anything resting on top (against the gravity arrow), except gas,
        // flames and more plate.
        const { downX, downY } = this.gravity;
        const ax = x - downX, ay = y - downY;
        const u = this.inBounds(ax, ay) ? this.type[ay * this.w + ax] : 0;
        const s = DEFS[u].state;
        on = u !== 0 && u !== this.type[i] && s !== GAS && s !== ENERGY;
        break;
      }
      case 'photocell':
        on = this.ctype[i] > 0;
        if (on) this.ctype[i]--;
        break;
      case 'thermostat':
        on = this.temp[i] >= THERMOSTAT_TEMP;
        break;

      // ---- machines: run while powered ---------------------------------------
      default: {
        const powered = this.life[i] > 0;
        if (powered) this.life[i]--;
        this.runMachine(kind, i, x, y, powered);
        return false;
      }
    }
    // Switch on the whole connected block (once a frame is enough).
    if (on && this.life[i] < 3) this.eachConnected(i, (c) => { this.life[c] = 3; });
    if (this.life[i] > 0) {
      this.life[i]--;
      this.signal(x, y);
    }
    return false;
  },

  // Call fn on every cell of the connected block of one element containing j.
  eachConnected(j, fn) {
    const { w, h, type, flood, floodMark } = this;
    const u = type[j];
    const stamp = ++this.floodStamp;
    let n = 0;
    floodMark[j] = stamp;
    flood[n++] = j;
    while (n > 0) {
      const c = flood[--n];
      fn(c);
      const cx = c % w, cy = (c / w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = cx + DX4[k], ny = cy + DY4[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const m = ny * w + nx;
        if (type[m] === u && floodMark[m] !== stamp) {
          floodMark[m] = stamp;
          flood[n++] = m;
        }
      }
    }
  },

  runMachine(kind, i, x, y, powered) {
    switch (kind) {
      case 'laser':
        if (powered) this.fireBeam(x, y, this.type[i], 0.5);
        break;
      case 'heater':
        if (powered && this.temp[i] < HEATER_MAX) this.temp[i] = Math.min(HEATER_MAX, this.temp[i] + 25);
        break;
      case 'cooler':
        if (powered && this.temp[i] > COOLER_MIN) this.temp[i] = Math.max(COOLER_MIN, this.temp[i] - 25);
        break;
      case 'fan':
        if (powered) this.blowOut(x, y);
        break;
      case 'dispenser': {
        const c = this.ctype[i];
        if (c === 0) { // learn what it pours from the first thing to touch it
          const j = this.randomNeighbor(x, y);
          if (j >= 0 && DISPENSABLE[this.type[j]]) this.ctype[i] = this.type[j];
        } else if (powered) {
          for (let k = 0; k < 4; k++) {
            const nx = x + DX4[k], ny = y + DY4[k];
            if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
            const j = ny * this.w + nx;
            if (this.type[j] === 0 && this.rand() < 0.3) this.spawn(j, c);
          }
        }
        break;
      }
      case 'drain':
        if (powered) this.drainAround(x, y);
        break;
      default:
        break; // doors and lamps have nothing to do each frame
    }
  },

  // A control that is on: start current in idle wires and power machines.
  signal(x, y) {
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const j = ny * this.w + nx;
      const u = this.type[j];
      if (CONDUCTOR[u]) {
        if (this.life[j] === 0) this.sparkAt(j);
      } else if (POWERED[u] || (u === 0 && this.doorTimer[j] !== 0)) {
        this.powerCell(j);
      }
    }
  },

  // Power reaches cell j: a machine, or an open doorway.
  powerCell(j) {
    const u = this.type[j];
    if (u === DOOR || (u === 0 && this.doorTimer[j] !== 0)) { this.openDoor(j); return; }
    if (!POWERED[u] || this.life[j] >= POWER_HOLD - 1) return; // already running
    // Power the whole connected block of this machine.
    this.eachConnected(j, (c) => { this.life[c] = POWER_HOLD; });
  },

  // A spark lands on a switch or button: flip the switch, press the button.
  // The whole connected switch flips together, and a switch held under the
  // brush only flips once.
  press(j) {
    let state = BUTTON_TIME;
    if (DEFS[this.type[j]].machine === 'switch') {
      const c = this.ctype[j];
      const pos = c > 1 ? c & 1 : (c & 1) ^ 1;
      state = pos | (PRESS_HOLD << 1);
    }
    this.eachConnected(j, (c) => { this.ctype[c] = state; });
  },

  // Light landed on a photocell.
  lightUp(j) {
    this.ctype[j] = PHOTOCELL_TIME;
  },

  // Open every connected cell of a door, and keep its doorway open.
  openDoor(j) {
    const { w, h, type, doorTimer, flood } = this;
    if (doorTimer[j] >= DOOR_HOLD - 1) return; // just refreshed
    let n = 0;
    const visit = (c) => {
      if (type[c] === DOOR) this.clearCell(c);
      if (doorTimer[c] === 0) this.doorList.push(c);
      doorTimer[c] = DOOR_HOLD;
      flood[n++] = c;
    };
    visit(j);
    while (n > 0) {
      const c = flood[--n];
      const cx = c % w, cy = (c / w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = cx + DX4[k], ny = cy + DY4[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const m = ny * w + nx;
        if (doorTimer[m] !== DOOR_HOLD && (type[m] === DOOR || doorTimer[m] !== 0)) visit(m);
      }
    }
  },

  // Count down open doorways and shut the ones whose power has gone.
  stepDoors() {
    const list = this.doorList;
    if (list.length === 0) return;
    const timer = this.doorTimer;
    let n = 0;
    for (let k = 0; k < list.length; k++) {
      const c = list[k];
      const t = timer[c];
      if (t === 0) continue; // erased
      if (t > 1) { timer[c] = t - 1; list[n++] = c; continue; }
      if (this.shutDoor(c)) timer[c] = 0;
      else list[n++] = c; // something is in the way: try again next frame
    }
    list.length = n;
  },

  // Put a door cell back. Loose things in the doorway are shoved into the
  // nearest free space outside it (gas and flames are simply squeezed out); a
  // solid built in the doorway stays, and that part of the door is gone.
  // Returns false to wait and retry.
  shutDoor(c) {
    const u = this.type[c];
    if (u !== 0) {
      const e = DEFS[u];
      if (e.state === SOLID && !this.loose[c] && e.behavior !== 'critter') return true;
      const m = this.freeSpaceNear(c);
      if (m >= 0) this.swap(c, m);
      else if (e.displaceable && (e.state === GAS || e.state === ENERGY)) this.clearCell(c);
      else return false;
    }
    this.spawn(c, DOOR);
    return true;
  },

  // The nearest empty cell to c that isn't part of an open doorway, or -1.
  freeSpaceNear(c) {
    const { w, h, type, doorTimer } = this;
    const x = c % w, y = (c / w) | 0;
    for (let r = 1; r <= PUSH_REACH; r++) {
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        const edge = dy === -r || dy === r;
        for (let dx = -r; dx <= r; dx += edge ? 1 : 2 * r) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const m = ny * w + nx;
          if (type[m] === 0 && doorTimer[m] === 0) return m;
        }
      }
    }
    return -1;
  },

  // Fire light out of every open face (used by lasers and laser emitters).
  fireBeam(x, y, tint, chance) {
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const u = this.type[ny * this.w + nx];
      if ((u === 0 || DEFS[u].state === GAS) && this.rand() < chance) {
        this.spawnProjectile(PHOTON, nx + 0.5, ny + 0.5, DX4[k] * 3, DY4[k] * 3, tint);
      }
    }
  },

  // Push the air away from every open face. The push goes into the next air
  // block along, so the two sides of a thin fan don't cancel out.
  blowOut(x, y) {
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const u = this.type[ny * this.w + nx];
      if (u !== 0 && !DEFS[u].displaceable) continue;
      const a = this.air.at(x + DX4[k] * CELL, y + DY4[k] * CELL);
      if (!this.air.blocked[a]) this.air.addVelocity(a, DX4[k] * FAN_PUSH, DY4[k] * FAN_PUSH);
    }
  },

  // Swallow the powders, liquids and gases touching a drain.
  drainAround(x, y) {
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const j = ny * this.w + nx;
      const u = this.type[j];
      if (u === 0) continue;
      const e = DEFS[u];
      if ((e.displaceable || e.state === POWDER || this.loose[j]) && !e.indestructible
        && this.rand() < 0.5) this.clearCell(j);
    }
  },
};
