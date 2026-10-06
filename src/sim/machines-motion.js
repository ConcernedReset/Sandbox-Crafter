// Machines that move things, mixed into World.prototype: conveyors and
// pistons. Both take their direction from where the power came in
// (powerFrom and powerDir, see machines.js).

import { DEFS, ID, State } from './elements.js';
import { GASLIKE } from './lookups.js';
import { dirIndex } from './machines.js';

const { POWDER, LIQUID } = State;
const { PISTON_ARM } = ID;
const PISTON_REACH = 8; // the longest an arm gets
const PISTON_PUSH = 16; // the longest row an arm can shove
const DX4 = [1, -1, 0, 0];
const DY4 = [0, 0, 1, -1];

// What a conveyor carries: loose things (powders, liquids, creatures, and
// debris torn off by pressure), never solid structures.
const CARRIED = Uint8Array.from(DEFS, (d) => (d.id !== 0 && !d.indestructible && !d.projectile
  && (d.state === POWDER || d.state === LIQUID || d.behavior === 'critter') ? 1 : 0));

// Can a moving thing go into a cell holding u? Empty space, or gas it pushes aside.
const roomFor = (u) => u === 0 || (GASLIKE[u] === 1 && DEFS[u].displaceable);

export const MotionMachines = {
  // Every other frame, move the thing resting on top of a powered belt cell
  // one cell along the belt, away from where the power came in. The belt
  // runs across gravity. Each thing moves once a frame however many belt
  // cells it passes: the scan reaches the belt before what rests on it, and
  // a moved cell is marked as done for the frame.
  runConveyor(i, x, y) {
    if ((this.tick & 1) !== 0) return;
    const { w, type } = this;
    const { downX, downY } = this.gravity;
    const tx = x - downX, ty = y - downY;
    if (!this.inBounds(tx, ty)) return;
    const j = ty * w + tx, u = type[j];
    if (u === 0 || this.clock[j] === this.pass || !(CARRIED[u] || this.loose[j])) return;
    const across = downY !== 0; // the belt runs along x when gravity is up or down
    const f = this.powerFrom[i];
    let s = across ? Math.sign(x - (f % w)) : Math.sign(y - ((f / w) | 0));
    if (f < 0 || s === 0) s = 1;
    const nx = across ? tx + s : tx, ny = across ? ty : ty + s;
    if (!this.inBounds(nx, ny)) return;
    const m = ny * w + nx;
    if (roomFor(type[m])) this.swap(j, m);
  },

  // A powered piston grows its arm one cell a frame, up to PISTON_REACH, in
  // the direction the power was going as it came in (against gravity if it
  // has none, as from the Spark tool). Unpowered, the arm shrinks one cell a
  // frame. ctype remembers the arm's direction (1 + an index into DX4/DY4).
  runPiston(i, x, y, powered) {
    const was = this.ctype[i] - 1;
    if (powered) {
      let k = this.powerDir[i];
      if (k < 0) k = dirIndex(-this.gravity.downX, -this.gravity.downY);
      // An arm already out keeps going the way it went.
      if (was >= 0 && was !== k && this.armLength(x, y, was) > 0) k = was;
      this.ctype[i] = k + 1;
      const L = this.armLength(x, y, k);
      if (L >= PISTON_REACH) return;
      const ax = x + DX4[k] * (L + 1), ay = y + DY4[k] * (L + 1);
      if (!this.inBounds(ax, ay)) return;
      const a = ay * this.w + ax;
      if (!roomFor(this.type[a]) && !this.shove(ax, ay, DX4[k], DY4[k])) return; // stalled
      if (this.type[a] !== 0) this.clearCell(a); // gas pushed back into the gap
      this.spawn(a, PISTON_ARM);
    } else if (was >= 0) {
      const L = this.armLength(x, y, was);
      if (L === 0) { this.ctype[i] = 0; return; }
      this.clearCell((y + DY4[was] * L) * this.w + x + DX4[was] * L);
    }
  },

  // How many arm cells run out from (x, y) in direction k.
  armLength(x, y, k) {
    let L = 0;
    while (L < PISTON_REACH) {
      const ax = x + DX4[k] * (L + 1), ay = y + DY4[k] * (L + 1);
      if (!this.inBounds(ax, ay) || this.type[ay * this.w + ax] !== PISTON_ARM) break;
      L++;
    }
    return L;
  },

  // Move the row of things starting at (x, y) one cell along (dx, dy), into
  // the first free cell within PISTON_PUSH. Returns false (and moves
  // nothing) if there's no room, or the row meets something that can't be
  // pushed: anything indestructible, or another arm.
  shove(x, y, dx, dy) {
    const { w, type } = this;
    let n = 0;
    for (; n < PISTON_PUSH; n++) {
      const cx = x + dx * n, cy = y + dy * n;
      if (!this.inBounds(cx, cy)) return false;
      const u = type[cy * w + cx];
      if (roomFor(u)) break;
      if (DEFS[u].indestructible || u === PISTON_ARM) return false;
    }
    if (n === PISTON_PUSH) return false;
    for (let t = n; t > 0; t--) {
      this.swap((y + dy * (t - 1)) * w + x + dx * (t - 1), (y + dy * t) * w + x + dx * t);
    }
    return true;
  },
};
