// Paths: how a human plans its way overland (humans.js walkTo). A search
// (A*) over the places its body can be, a cell apart: standing (something
// under its feet, or tunnel boards over a mouth, or water to swim in), or
// hanging on a wall it's climbing. The moves:
//   walk  a cell across, up a step of up to CLIMB or ducking down one,
//         dropping to wherever it lands if there's nothing underfoot;
//   dig   a cell across (level, up a step or down one) through what's in
//         the way, if it can dig it all;
//   climb a cell up a wall beside it.
// Each costs about the steps it takes (walking 1 a cell, climbing 3,
// digging 2 a cell dug, swimming 3), so a thin trunk is cut through and a
// cliff climbed. The body is the human's own shape (every way it can face,
// in either walking frame), so a planned move always fits, and following
// the plan (followPath) makes exactly the planned moves, planning again if
// it's knocked off it or a move fails. Mixed into World.prototype.

import { DEFS, State } from './elements.js';
import { SHAPED } from './creatures.js';
import { DANGER, CLEARABLE, USEFUL, HELD_PICKAXE } from './humans.js';

const { SOLID, POWDER, LIQUID } = State;
const CLIMB = 2; // the highest step a human walks up (humans.js)
const MAX_FALL = 80; // the farthest drop it plans
const MAX_DIG = 12; // the most cells it plans to dig for one step
export const PATH_NODES = 8000; // places it looks at before it gives up searching (and walks straight at it)
const MARGIN = 60; // how far outside the box round it and its target it looks
const WEIGHT = 1.3; // a little greedy: quicker, and near enough the best
const WALK = 1, STEP_UP = 0.3, DUCK = 1.2, CLIMB_COST = 3, SWIM = 3, DIG_CELL = 2, FALL_CELL = 0.05;
const BOARDS = 2; // walking a cell over a tunnel's open inside (on "boards"): kept to, not sought out
export const MOVE = { start: 0, walk: 1, dig: 2, climb: 3 };
const MAX_REPLANS = 6; // plans for one target before it walks straight at it instead
const WALL_EVERY = 12, DIG_EVERY = 8; // steps a cell climbed, and a cell dug (humans.js)
const NO_POSE = 255;

// A body of this kind: the cells it can cover, as [across, up] from its
// feet, facing either way in either walking frame (so whatever it's in,
// it fits where these do); and, for each of those four poses, its feet
// (the cells with none of the body under them), for footing.
const bodies = new Map();
export function bodyOf(kind) {
  if (!bodies.has(kind)) {
    const frames = DEFS[kind].shape.frames, all = new Set(), poses = [];
    for (let fr = 0; fr < Math.min(2, frames.length); fr++) {
      const f = frames[fr];
      for (const s of [1, -1]) {
        const set = new Set();
        for (let p = 0; p < f.dx.length; p++) set.add(`${f.dx[p] * s},${-f.dy[p]}`);
        for (const k of set) all.add(k);
        const feet = [...set].map((k) => k.split(',').map(Number)).filter(([k, up]) => !set.has(`${k},${up - 1}`));
        poses.push({ fr, facing: s, feet });
      }
    }
    const cells = [...all].map((k) => k.split(',').map(Number));
    const has = new Uint8Array(64 * 64); // has[(k + 32) * 64 + up + 32]: the body covers [k, up]
    for (const [k, up] of cells) has[(k + 32) * 64 + up + 32] = 1;
    bodies.set(kind, { cells, poses, has, top: [...cells].sort((p, q) => q[1] - p[1]) });
  }
  return bodies.get(kind);
}

// A binary heap of node indices by score.
class Heap {
  constructor() {
    this.ids = [];
    this.keys = [];
  }

  push(id, k) {
    const { ids, keys } = this;
    let i = ids.length;
    ids.push(id);
    keys.push(k);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= k) break;
      ids[i] = ids[p];
      keys[i] = keys[p];
      i = p;
    }
    ids[i] = id;
    keys[i] = k;
  }

  pop() {
    const { ids, keys } = this;
    const top = ids[0], lastId = ids.pop(), lastK = keys.pop();
    if (ids.length > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= ids.length) break;
        if (c + 1 < ids.length && keys[c + 1] < keys[c]) c++;
        if (keys[c] >= lastK) break;
        ids[i] = ids[c];
        keys[i] = keys[c];
        i = c;
      }
      ids[i] = lastId;
      keys[i] = lastK;
    }
    return top;
  }

  get size() {
    return this.ids.length;
  }
}

export const Paths = {
  // How the searches have gone, for probes: ways found, none, unsure.
  countPath(k) {
    (this.pathStats ??= { found: 0, none: 0, unsure: 0 })[k]++;
  },

  // Scratch space for searches, sized to the world.
  pathSpace() {
    const n = this.w * this.h;
    if (!this.paths || this.paths.n !== n) {
      this.paths = {
        n, stamp: 0,
        seen: new Uint32Array(n), // the search that last reached each place
        g: new Float32Array(n), // the cost of the best way there
        prev: new Int32Array(n), // the place before it on that way
        move: new Uint8Array(n), // the move that got there (MOVE)
        pose: new Uint8Array(n), // the pose it stands there in (body.poses), or NO_POSE
        done: new Uint32Array(n), // the search that settled it
        // What a search has worked out about each place already (as of
        // search `roomAt`/`footAt`): room for a body, and footing there.
        roomAt: new Uint32Array(n), room: new Uint8Array(n),
        footAt: new Uint32Array(n), foot: new Uint16Array(n),
      };
    }
    return this.paths;
  },

  // Is cell (x, y) solid (or powder): in a body's way, and ground to stand on?
  solidAt(x, y) {
    return this.inBounds(x, y) && this.builtAt(y * this.w + x);
  },

  // Room for body `body` with its feet at (x, y): nothing solid, and
  // nothing deadly, where it would be.
  bodyRoom(body, x, y, gx, gy) {
    const m = this.pathMemo;
    if (m !== null && m !== undefined && this.inBounds(x, y)) {
      const c = y * this.w + x;
      if (m.roomAt[c] === m.stamp) return m.room[c] === 1;
      m.roomAt[c] = m.stamp;
      const r = this.bodyRoomNow(body, x, y, gx, gy);
      m.room[c] = r ? 1 : 0;
      return r;
    }
    return this.bodyRoomNow(body, x, y, gx, gy);
  },

  bodyRoomNow(body, x, y, gx, gy) {
    for (const [k, up] of body.cells) {
      const cx = x + k * gy - up * gx, cy = y - k * gx - up * gy;
      if (!this.inBounds(cx, cy)) return false;
      const t = this.type[cy * this.w + cx];
      if (t === 0 || SHAPED[t]) continue;
      if (DANGER[t]) return false;
      const s = DEFS[t].state;
      if (s === SOLID || s === POWDER) return false;
    }
    return true;
  },

  // What's under its feet at (x, y), in the best of its poses (the game
  // holds a body up if any of it rests on something): 2 ground, or
  // "boards" over a tunnel's open inside (overTunnel: anywhere but right on
  // one of the network's spots), 1 water to swim in, 0 nothing.
  footing(body, x, y, gx, gy) {
    return this.footInfo(body, x, y, gx, gy) >> 8;
  },

  // The pose (an index into body.poses) with the best footing at (x, y),
  // or NO_POSE with none.
  footPose(body, x, y, gx, gy) {
    return this.footInfo(body, x, y, gx, gy) & 255;
  },

  // The best footing at (x, y) and the pose with it, as footing * 256 +
  // pose (remembered for the rest of a search).
  footInfo(body, x, y, gx, gy) {
    const m = this.pathMemo, c = y * this.w + x;
    if (m !== null && m !== undefined && this.inBounds(x, y) && m.footAt[c] === m.stamp) return m.foot[c];
    let best = 0, pose = NO_POSE;
    for (let i = 0; i < body.poses.length; i++) {
      const f = this.poseFooting(body.poses[i].feet, x, y, gx, gy);
      if (f > best) {
        best = f;
        pose = i;
        if (f === 2) break;
      }
    }
    const info = best * 256 + pose;
    if (m !== null && m !== undefined && this.inBounds(x, y)) {
      m.footAt[c] = m.stamp;
      m.foot[c] = info;
    }
    return info;
  },

  poseFooting(feet, x, y, gx, gy) {
    let wet = false;
    for (const [k, up] of feet) {
      const cx = x + k * gy - (up - 1) * gx, cy = y - k * gx - (up - 1) * gy;
      if (!this.inBounds(cx, cy)) return 2; // the world's edge holds it up
      const t = this.type[cy * this.w + cx];
      if (t === 0) {
        if (this.isInside(cx, cy) && this.onBoards(x, y)) return 2;
        continue;
      }
      if (SHAPED[t]) continue;
      const s = DEFS[t].state;
      if (s === SOLID || s === POWDER) return 2;
      if (s === LIQUID && !DANGER[t]) wet = true;
    }
    return wet ? 1 : 0;
  },

  // Standing at (x, y) over a tunnel's inside, is it held up as if on
  // boards (overTunnel): not right on one of its spots (but an entrance)?
  onBoards(x, y) {
    const at = this.onNet(x, y);
    return at === null || (at.node !== null && at.node.entrance);
  },

  // A wall beside a body at (x, y) to climb (as climbWall sees one): the
  // side it's on (1 or -1), or 0.
  wallBeside(x, y, gx, gy) {
    for (const s of [1, -1]) {
      for (let up = 0; up < 6; up++) {
        if (this.solidAt(x + 2 * s * gy - up * gx, y - 2 * s * gx - up * gy)) return s;
      }
    }
    return 0;
  },

  // The cells to dig for its body to go from (fx, fy) to (x, y): those not
  // where its body was (dug already, or empty). Their count, or -1 if it
  // can't dig them all with strength `limit` (or there are too many); with
  // `out`, the cells themselves, top first.
  digCells(body, fx, fy, x, y, gx, gy, limit, out = null) {
    let n = 0;
    // Where (x, y) is from (fx, fy), across and up, to tell the cells its
    // body covered there.
    const dk = (x - fx) * gy - (y - fy) * gx, du = -((x - fx) * gx + (y - fy) * gy);
    for (const [k, up] of out ? body.top : body.cells) {
      const cx = x + k * gy - up * gx, cy = y - k * gx - up * gy;
      if (!this.inBounds(cx, cy)) return -1;
      const c = cy * this.w + cx, t = this.type[c];
      if (t === 0 || SHAPED[t] || body.has[(k + dk + 32) * 64 + up + du + 32] === 1) continue;
      if (DANGER[t]) return -1;
      if (!this.builtAt(c)) continue;
      if (this.madeByHuman(c) || (!this.diggable(c, limit) && !CLEARABLE[t])) return -1; // not what humans built (tunnel lining too)
      if (++n > MAX_DIG) return -1;
      if (out) out.push(c);
    }
    return n;
  },

  // The way from where e stands to within `near` cells across of (tx, ty)
  // and level with it (as walkTo arrives: from 9 above its feet to 4
  // below), digging up to strength `limit`: { pts: [{ x, y, m }], cost }.
  // null if there's no way; undefined if it gave up looking (or can't
  // tell: something's wedged in where its body could be, here).
  findPath(e, tx, ty, near, limit) {
    const P = this.pathSpace();
    P.stamp++;
    this.pathMemo = P; // (for this search: the world doesn't change during it)
    try {
      return this.search(e, tx, ty, near, limit, P);
    } finally {
      this.pathMemo = null;
    }
  },

  search(e, tx, ty, near, limit, P) {
    const { w } = this, gx = e.gx, gy = e.gy, body = bodyOf(e.kind);
    const sure = this.bodyRoom(body, e.x, e.y, gx, gy); // (if not, finding no way proves nothing)
    const id = P.stamp;
    const { seen, g, prev, move, done, pose } = P;
    const x0 = Math.min(e.x, tx) - MARGIN, x1 = Math.max(e.x, tx) + MARGIN;
    const y0 = Math.min(e.y, ty) - MARGIN, y1 = Math.max(e.y, ty) + MARGIN;
    const inBox = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && this.inBounds(x, y);
    const across = (x, y) => (tx - x) * gy - (ty - y) * gx;
    const along = (x, y) => (tx - x) * gx + (ty - y) * gy;
    const goal = (x, y) => {
      const a = across(x, y), v = along(x, y);
      return Math.abs(a) <= near && v >= -9 && v <= 4;
    };
    const h = (x, y) => {
      const a = Math.max(0, Math.abs(across(x, y)) - near), v = along(x, y);
      return WEIGHT * (a + FALL_CELL * (v < -9 ? -9 - v : v > 4 ? v - 4 : 0));
    };
    const heap = new Heap();
    const start = e.y * w + e.x;
    seen[start] = id;
    g[start] = 0;
    prev[start] = -1;
    move[start] = MOVE.start;
    pose[start] = NO_POSE;
    heap.push(start, h(e.x, e.y));
    const reach = (from, x, y, cost, m, ps) => {
      if (!inBox(x, y)) return;
      const c = y * w + x, ng = g[from] + cost;
      if (done[c] === id) return;
      if (seen[c] === id && g[c] <= ng) return;
      seen[c] = id;
      g[c] = ng;
      prev[c] = from;
      move[c] = m;
      pose[c] = ps;
      heap.push(c, ng + h(x, y));
    };
    // Into (x, y) by a walk: there, or wherever it drops to from there.
    const land = (from, x, y, cost) => {
      for (let k = 0; k <= MAX_FALL; k++) {
        const fx = x + k * gx, fy = y + k * gy;
        if (k > 0 && !this.bodyRoom(body, fx, fy, gx, gy)) return;
        const ps = this.footPose(body, fx, fy, gx, gy);
        if (ps !== NO_POSE) {
          reach(from, fx, fy, cost + k * FALL_CELL, MOVE.walk, ps);
          return;
        }
      }
    };
    let count = 0;
    while (heap.size > 0) {
      const c = heap.pop();
      if (done[c] === id) continue;
      done[c] = id;
      const x = c % w, y = (c / w) | 0;
      if (goal(x, y)) {
        const pts = [];
        for (let p = c; p >= 0; p = prev[p]) pts.push({ x: p % w, y: (p / w) | 0, m: move[p], pose: pose[p] });
        pts.reverse();
        return { pts, cost: g[c] };
      }
      if (++count > PATH_NODES) return undefined;
      const foot = this.footing(body, x, y, gx, gy), standing = foot > 0;
      const pace = foot === 1 ? SWIM : this.isInside(x + gx, y + gy) && !this.solidAt(x + gx, y + gy) ? BOARDS : WALK;
      for (const d of [1, -1]) {
        const step = this.stepTo(body, x, y, d, gx, gy, standing);
        if (step !== null) {
          land(c, step.x, step.y, step.duck ? DUCK : pace + STEP_UP * step.up);
          continue;
        }
        if (!standing) continue;
        // Digging through what's in the way: level, up a step or down one.
        const ax = x + d * gy, ay = y - d * gx;
        for (const up of [0, 1, -1]) {
          const nx = ax - up * gx, ny = ay - up * gy;
          const n = this.digCells(body, x, y, nx, ny, gx, gy, limit);
          if (n < 0) continue;
          const ps = this.footPose(body, nx, ny, gx, gy);
          if (ps !== NO_POSE && this.poseFooting(body.poses[ps].feet, nx, ny, gx, gy) === 2) reach(c, nx, ny, WALK + DIG_CELL * n + STEP_UP * Math.abs(up), MOVE.dig, ps);
        }
      }
      // Up a wall beside it.
      if (foot !== 1 && this.wallBeside(x, y, gx, gy) !== 0 && this.bodyRoom(body, x - gx, y - gy, gx, gy)) {
        const ux = x - gx, uy = y - gy;
        if (this.footing(body, ux, uy, gx, gy) > 0 || this.wallBeside(ux, uy, gx, gy) !== 0) reach(c, ux, uy, CLIMB_COST, MOVE.climb, NO_POSE);
      }
    }
    return sure ? null : undefined;
  },

  // Where a step across the way `d` from (x, y) puts its feet: level, or
  // up a step of up to CLIMB (the first that fits), or, standing and with
  // none of those, ducking a step down. { x, y, up, duck } or null.
  stepTo(body, x, y, d, gx, gy, standing) {
    const ax = x + d * gy, ay = y - d * gx;
    for (let up = 0; up <= CLIMB; up++) {
      const nx = ax - up * gx, ny = ay - up * gy;
      if (this.bodyRoom(body, nx, ny, gx, gy)) return { x: nx, y: ny, up, duck: false };
    }
    if (standing && this.bodyRoom(body, ax + gx, ay + gy, gx, gy)) return { x: ax + gx, y: ay + gy, up: 0, duck: true };
    return null;
  },

  // Follow a planned way to (tx, ty) a move at a time (walkTo, once it
  // isn't there yet): planning one first, and again when it's knocked off
  // it or a move keeps failing (up to MAX_REPLANS times for one target).
  // Returns 'ok' (it's on its way), 'none' (no plan: walk straight at it,
  // as before) or 'unreachable' (there's no way there).
  followPath(e, b, tx, ty, near, every, limit) {
    const key = `${tx},${ty},${near}`;
    let p = b.path;
    if (p === null || p.key !== key) {
      const r = this.planWay(e, b, tx, ty, near, limit, key, 0);
      if (r !== 'ok') return r;
      p = b.path;
    }
    if (p.greedy) return 'none';
    // Where is it on the way? The furthest place a little ahead that it's
    // at; or else, in line with one it walked to, 2 cells either side (a
    // slip down a slope, a step it didn't need; never a cell up a wall it
    // has yet to climb).
    let j = -1, inLine = -1;
    for (let k = Math.max(0, p.i - 1); k < Math.min(p.pts.length, p.i + 8); k++) {
      const q = p.pts[k], du = (q.x - e.x) * e.gy - (q.y - e.y) * e.gx, dv = (q.x - e.x) * e.gx + (q.y - e.y) * e.gy;
      if (du === 0 && dv === 0) j = k;
      else if (du === 0 && Math.abs(dv) <= 2 && q.m !== MOVE.climb && (k + 1 >= p.pts.length || p.pts[k + 1].m !== MOVE.climb)) inLine = k;
    }
    if (j < 0) j = inLine;
    if (j > p.far) { // further along than ever: progress
      p.far = j;
      b.stuck = 0;
      p.fails = 0;
    }
    if (j >= 0) p.i = j;
    else if (!this.supported(e) && !this.overTunnel(e) && !b.climbing) return 'ok'; // dropping off a ledge, as planned
    else return this.planWay(e, b, tx, ty, near, limit, key, p.replans + 1);
    const next = p.pts[p.i + 1];
    if (next === undefined) return this.planWay(e, b, tx, ty, near, limit, key, p.replans + 1);
    const body = bodyOf(e.kind), gx = e.gx, gy = e.gy;
    b.climbing = next.m === MOVE.climb;
    if (b.climbing || this.footing(body, e.x, e.y, gx, gy) === 0) b.hold = true; // on the wall
    if (++b.pace < (b.climbing ? WALL_EVERY : every)) return 'ok';
    b.pace = 0;
    // Into the next place in the pose planned for it (one it stands in), or
    // just the next walking frame.
    const fr = e.frame === 0 ? 1 : 0;
    const into = (x, y, d) => {
      if (x === next.x && y === next.y && next.pose !== NO_POSE) {
        const ps = body.poses[next.pose];
        return this.moveBody(e, x, y, ps.fr, ps.facing, gx, gy);
      }
      return this.moveBody(e, x, y, fr, d, gx, gy);
    };
    let ok = false;
    if (next.m === MOVE.climb) {
      const side = this.wallBeside(e.x, e.y, gx, gy) || e.facing;
      ok = this.bodyRoom(body, e.x - gx, e.y - gy, gx, gy) && this.moveBody(e, e.x - gx, e.y - gy, e.frame, side, gx, gy);
    } else {
      const a = (next.x - e.x) * gy - (next.y - e.y) * gx, d = a > 0 ? 1 : -1;
      b.heading = d;
      const standing = this.footing(body, e.x, e.y, gx, gy) > 0;
      const step = this.stepTo(body, e.x, e.y, d, gx, gy, standing);
      if (step !== null) ok = into(step.x, step.y, d);
      else if (next.m === MOVE.dig) {
        // Dig the next cell in the way of the planned place (top first).
        const cells = [];
        const n = this.digCells(body, e.x, e.y, next.x, next.y, gx, gy, limit, cells);
        if (n === 0) ok = into(next.x, next.y, d);
        else if (n > 0) {
          const cell = cells[0], t = this.type[cell];
          if (USEFUL[t]) this.stow(b, t);
          this.clearCell(cell);
          if (b.tool !== 0) b.held = HELD_PICKAXE;
          b.stuck = 0;
          b.pace = every - DIG_EVERY;
          ok = true;
        }
      }
    }
    if (!ok && ++p.fails >= 3) return this.planWay(e, b, tx, ty, near, limit, key, p.replans + 1);
    return 'ok';
  },

  // Plan the way to (tx, ty) into b.path. 'ok', 'none' (it gave up looking,
  // or has planned too often: it walks straight at it) or 'unreachable'.
  planWay(e, b, tx, ty, near, limit, key, replans) {
    if (replans > MAX_REPLANS) {
      b.path = { key, greedy: true };
      return 'none';
    }
    const found = this.findPath(e, tx, ty, near, limit);
    this.countPath(found === null ? 'none' : found === undefined ? 'unsure' : 'found');
    if (found === null) {
      b.path = null;
      return 'unreachable';
    }
    if (found === undefined) {
      b.path = { key, greedy: true };
      return 'none';
    }
    b.path = { key, pts: found.pts, cost: found.cost, i: 0, far: 0, fails: 0, replans, greedy: false };
    return 'ok';
  },
};
