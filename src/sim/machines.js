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
import { CONDUCTOR, POWERED, DISPENSABLE, GASLIKE } from './lookups.js';
import { MIN_TEMP } from './constants.js';
import { CELL } from './air.js';

const { SOLID, POWDER, GAS, ENERGY } = State;
const { DOOR, PHOTON, VALVE, BATTERY, SPARK, FIRE, NEUTRON } = ID;

export const POWER_HOLD = 20;
export const DOOR_HOLD = 20;
const BUTTON_TIME = 90;
const CLOCK_PERIOD = 60;
const PRESS_HOLD = 4; // frames without a spark before a switch can flip again
const PHOTOCELL_TIME = 8;
const THERMOSTAT_TEMP = 60;
// A heater heats HEATER_RATE a frame, plus HEATER_RAMP more for every frame
// it has been on, so it outruns the heat it loses and has no limit. A cooler
// chills COOLER_RATE a frame, down to absolute zero.
const HEATER_RATE = 20;
const HEATER_RAMP = 0.1;
const COOLER_RATE = 20;
const DX4 = [1, -1, 0, 0];
const DY4 = [0, 0, 1, -1];

const PUSH_REACH = 6; // how far a shutting door can shove things aside
// A safety valve opens when the pressure beside it passes VALVE_OPEN and
// stays open while it's above VALVE_CLOSE.
const VALVE_OPEN = 30;
const VALVE_CLOSE = 10;
// An open valve passes this share of the pressure difference across it a
// frame, per cell (see ventValve).
const VALVE_VENT = 0.1;
// An inverter stays off for INVERTER_HOLD frames after power reaches it,
// enough to bridge the gaps between a wire's pulses. Power from a wire cell
// it sparked itself within ECHO frames is its own echo, and is ignored.
const INVERTER_HOLD = POWER_HOLD;
const ECHO = 3;
// An inverter that has never been fed looks for its input side every
// INVERTER_LOOK frames, following wires at most LOOK_LIMIT cells.
const INVERTER_LOOK = 15;
const LOOK_LIMIT = 4096;
// The controls that make power of their own (see findInverterInput).
const SOURCE_KINDS = new Set(['switch', 'button', 'clock', 'plate', 'photocell', 'thermostat',
  'barometer', 'smoke', 'turbine']);
// A delay cell charges for DELAY_STEP frames, fires, then rests DELAY_REST.
const DELAY_STEP = 4;
const DELAY_REST = 12;
const BAROMETER_ON = 5; // pressure
const TURBINE_ON = 0.5; // wind speed
const IGNITER_FLAME = 0.2; // chance a frame of a flame in each empty cell beside it
const NEUTRON_RATE = 0.15; // chance a frame of a neutron from each open face

// Direction indexes into DX4/DY4: 0 right, 1 left, 2 down, 3 up.
export const OPPOSITE = [1, 0, 3, 2];
export function dirIndex(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 1;
  return dy >= 0 ? 2 : 3;
}

export function initMachines(world) {
  const n = world.w * world.h;
  world.doorTimer = new Uint8Array(n); // frames until an open doorway shuts
  world.doorList = []; // cells with a doorTimer
  world.flood = new Int32Array(n);
  world.floodMark = new Uint32Array(n);
  world.floodStamp = 0;
  // Where the power reaching each machine cell came from (a cell index), and
  // which way it was going as it came in (see dirIndex). -1: no idea.
  world.powerFrom = new Int32Array(n).fill(-1);
  world.powerDir = new Int8Array(n).fill(-1);
  world.doorKind = new Uint16Array(n); // what an open doorway turns back into
  world.echo = new Uint32Array(n); // the frame an inverter last sparked each wire cell
  world.pipeCells = []; // pipe and pump cells, listed during each frame's update
  world.pipeNets = []; // the networks they make (machines-air.js)
  world.pipeCount = 0;
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
      case 'barometer':
        on = this.pressureNear(x, y) > BAROMETER_ON;
        break;
      case 'smoke':
        on = this.gasTouching(x, y);
        break;
      case 'turbine':
        on = this.windNear(x, y) > TURBINE_ON;
        break;

      case 'pipe':
        this.pipeCells.push(i);
        return false;
      case 'valve':
        if (this.pressureNear(x, y) > VALVE_OPEN) this.openDoor(i);
        return false;
      case 'inverter': {
        // On (and lit) unless fed. Until it knows its input side it looks
        // for it every INVERTER_LOOK frames, and answers on every side.
        if (this.powerDir[i] < 0 && (this.tick + i) % INVERTER_LOOK === 0) {
          this.powerDir[i] = this.findInverterInput(i, x, y);
        }
        const fed = this.ctype[i] > 0;
        if (fed) this.ctype[i]--;
        this.life[i] = fed ? 0 : 1;
        if (!fed) this.signal(x, y, this.powerDir[i], true);
        return false;
      }
      case 'delay': {
        if (this.life[i] > 0) this.life[i]--; // resting (and lit) after firing
        const c = this.ctype[i];
        if (c > 1) this.ctype[i] = c - 1;
        else if (c === 1) {
          this.ctype[i] = 0;
          this.life[i] = DELAY_REST;
          this.fireDelay(i, x, y);
        }
        return false;
      }

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
        if (powered) {
          if (this.ctype[i] < 65535) this.ctype[i]++; // frames on
          this.temp[i] += HEATER_RATE + this.ctype[i] * HEATER_RAMP;
        } else {
          this.ctype[i] = 0;
        }
        break;
      case 'cooler':
        if (powered) this.temp[i] = Math.max(MIN_TEMP, this.temp[i] - COOLER_RATE);
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
      case 'pump':
        this.pipeCells.push(i); // its pumping is done with its network's
        break;
      case 'conveyor':
        if (powered) this.runConveyor(i, x, y);
        break;
      case 'piston':
        this.runPiston(i, x, y, powered);
        break;
      case 'igniter':
        if (powered) {
          for (let k = 0; k < 4; k++) {
            const nx = x + DX4[k], ny = y + DY4[k];
            if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
            const j = ny * this.w + nx, e = DEFS[this.type[j]];
            if (e.flammable > 0 || e.explode > 0) this.ignite(j, nx, ny);
            else if (this.type[j] === 0 && this.rand() < IGNITER_FLAME) this.spawn(j, FIRE);
          }
        }
        break;
      case 'neutron':
        if (powered) {
          for (let k = 0; k < 4; k++) {
            const nx = x + DX4[k], ny = y + DY4[k];
            if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
            const u = this.type[ny * this.w + nx];
            if ((u === 0 || GASLIKE[u]) && this.rand() < NEUTRON_RATE) {
              this.spawnProjectile(NEUTRON, nx + 0.5, ny + 0.5, DX4[k] * 2, DY4[k] * 2);
            }
          }
        }
        break;
      default:
        break; // doors and lamps have nothing to do each frame
    }
  },

  // A control that is on: start current in idle wires and power machines,
  // on every side, or only on `side` (an index into DX4/DY4). An inverter
  // marks the wire cells it sparks (`mark`) so it knows its own echo.
  signal(x, y, side = -1, mark = false) {
    const from = y * this.w + x;
    for (let k = 0; k < 4; k++) {
      if (side >= 0 && k !== side) continue;
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const j = ny * this.w + nx;
      const u = this.type[j];
      if (CONDUCTOR[u]) {
        if (this.life[j] === 0) {
          this.sparkAt(j);
          if (mark) this.echo[j] = this.tick;
        }
      } else if (POWERED[u] || (u === 0 && this.doorTimer[j] !== 0)) {
        this.powerCell(j, from);
      }
    }
  },

  // Power reaches cell j (a machine, or an open doorway) from cell `from`
  // beside it (j itself when it has no direction, as from the Spark tool).
  powerCell(j, from = j) {
    const u = this.type[j];
    if (u === DOOR || (u === 0 && this.doorTimer[j] !== 0 && this.doorKind[j] === DOOR)) { this.openDoor(j); return; }
    const kind = DEFS[u].machine;
    if (kind === 'inverter') { this.feedInverter(j, from); return; }
    if (kind === 'delay') {
      if (this.ctype[j] === 0 && this.life[j] === 0) this.ctype[j] = DELAY_STEP;
      return;
    }
    if (!POWERED[u] || this.life[j] >= POWER_HOLD - 1) return; // already running
    const w = this.w;
    const dir = from === j || from < 0 ? -1
      : dirIndex((j % w) - (from % w), ((j / w) | 0) - ((from / w) | 0));
    // Power the whole connected block of this machine.
    this.eachConnected(j, (c) => {
      this.life[c] = POWER_HOLD;
      this.powerFrom[c] = from;
      this.powerDir[c] = dir;
    });
  },

  // Power reaches an inverter from cell `from`. It goes off for a while, and
  // the side the power came in on becomes its input: it answers on the
  // opposite side (powerDir). Power from its own output side, or its own
  // echo, doesn't count.
  feedInverter(j, from) {
    if (from !== j && from >= 0) {
      if (this.echo[from] !== 0 && this.tick - this.echo[from] <= ECHO) return;
      const w = this.w;
      const k = dirIndex((j % w) - (from % w), ((j / w) | 0) - ((from / w) | 0));
      const out = this.powerDir[j];
      if (out >= 0 && k === OPPOSITE[out]) return;
      this.powerDir[j] = k;
    }
    this.ctype[j] = INVERTER_HOLD;
  },

  // Which way does an inverter that has never been fed face? Its input is the
  // side whose wire (or neighbour) leads back to something that makes power:
  // a control, a battery, a delay line, or an inverter whose output feeds
  // that wire. Returns its output direction (the way power from that side
  // travels in), or -1 if no side does. Without this, an inverter answering
  // on every side would send pulses back down its input wire, and they'd
  // meet the switch's pulses head on and cancel them out.
  findInverterInput(i, x, y) {
    const { w, h, type, ctype, flood, floodMark } = this;
    const wire = (m) => CONDUCTOR[type[m]] || (type[m] === SPARK && CONDUCTOR[ctype[m]]);
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (this.makesPower(j, i)) return OPPOSITE[k];
      if (!wire(j)) continue;
      const stamp = ++this.floodStamp;
      let n = 0, seen = 0;
      floodMark[j] = stamp;
      flood[n++] = j;
      while (n > 0 && seen < LOOK_LIMIT) {
        const c = flood[--n];
        seen++;
        const cx = c % w, cy = (c / w) | 0;
        for (let q = 0; q < 4; q++) {
          const mx = cx + DX4[q], my = cy + DY4[q];
          if (mx < 0 || my < 0 || mx >= w || my >= h) continue;
          const m = my * w + mx;
          if (m === i || floodMark[m] === stamp) continue;
          if (wire(m)) { floodMark[m] = stamp; flood[n++] = m; } else if (this.makesPower(m, c)) return OPPOSITE[k];
        }
      }
    }
    return -1;
  },

  // Does cell m send power into its neighbour c?
  makesPower(m, c) {
    const u = this.type[m];
    if (u === BATTERY) return true;
    const kind = DEFS[u].machine;
    if (kind === 'inverter') {
      const out = this.powerDir[m];
      return out >= 0 && m + DX4[out] + DY4[out] * this.w === c;
    }
    return kind === 'delay' || SOURCE_KINDS.has(kind);
  },

  // A delay cell fires: current into idle wires, power into machines, and the
  // next idle delay cells start charging. The one that charged it is resting,
  // so the current only goes forwards.
  fireDelay(i, x, y) {
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      const j = ny * this.w + nx;
      const u = this.type[j];
      if (DEFS[u].machine === 'delay') {
        if (this.ctype[j] === 0 && this.life[j] === 0) this.ctype[j] = DELAY_STEP;
      } else if (CONDUCTOR[u]) {
        if (this.life[j] === 0) this.sparkAt(j);
      } else if (POWERED[u] || (u === 0 && this.doorTimer[j] !== 0)) {
        this.powerCell(j, i);
      }
    }
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

  // Open every connected cell of a door (or valve), and keep its doorway
  // open, remembering what each cell was.
  openDoor(j) {
    const { w, h, type, doorTimer, doorKind, flood } = this;
    if (doorTimer[j] >= DOOR_HOLD - 1) return; // just refreshed
    const kind = type[j] || doorKind[j];
    let n = 0;
    const visit = (c) => {
      if (type[c] === kind) this.clearCell(c);
      if (doorTimer[c] === 0) this.doorList.push(c);
      doorTimer[c] = DOOR_HOLD;
      doorKind[c] = kind;
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
        if (doorTimer[m] !== DOOR_HOLD && (type[m] === kind || (doorTimer[m] !== 0 && doorKind[m] === kind))) visit(m);
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
      if (this.doorKind[c] === VALVE) {
        this.ventValve(c);
        // An open valve stays open while the pressure is still high.
        if (this.pressureNear(c % this.w, (c / this.w) | 0) > VALVE_CLOSE) {
          timer[c] = DOOR_HOLD;
          list[n++] = c;
          continue;
        }
      }
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
    this.spawn(c, this.doorKind[c] || DOOR);
    return true;
  },

  // An open valve lets the air through. Air can't pass a block with any Wall
  // in it, and a valve set into a wall shares its blocks with the wall, so
  // the valve passes it itself: the air on its two sides evens out (the
  // blocks of the cells beside it, or the next blocks out where those are
  // sealed), across and down.
  ventValve(c) {
    const { w, h, air } = this;
    const x = c % w, y = (c / w) | 0;
    const side = (dx, dy) => {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return -1;
      const a = air.at(nx, ny);
      if (!air.blocked[a]) return a;
      const fx = x + dx * CELL, fy = y + dy * CELL;
      if (fx < 0 || fy < 0 || fx >= w || fy >= h) return -1;
      const b = air.at(fx, fy);
      return air.blocked[b] ? -1 : b;
    };
    for (let k = 0; k < 4; k += 2) {
      const a = side(-DX4[k], -DY4[k]), b = side(DX4[k], DY4[k]);
      if (a < 0 || b < 0 || a === b) continue;
      const d = (air.p[a] - air.p[b]) * VALVE_VENT;
      air.p[a] -= d;
      air.p[b] += d;
    }
  },

  // Does any gas touch (x, y)?
  gasTouching(x, y) {
    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k], ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      if (DEFS[this.type[ny * this.w + nx]].state === GAS) return true;
    }
    return false;
  },

  // The fastest wind in the air block of (x, y) and the four beside it.
  windNear(x, y) {
    const air = this.air, W = air.W;
    const a = air.at(x, y);
    let best = 0;
    for (const b of [a, a - 1, a + 1, a - W, a + W]) {
      const s = Math.hypot(air.cvx(b), air.cvy(b));
      if (s > best) best = s;
    }
    return best;
  },

  // The highest air pressure in the air block of (x, y) and the four beside it.
  pressureNear(x, y) {
    const { p, W } = this.air;
    const a = this.air.at(x, y);
    return Math.max(p[a], p[a - 1], p[a + 1], p[a - W], p[a + W]);
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
