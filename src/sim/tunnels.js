// Tunnels: humans' mine workings (humans.js). A tunnel is a straight run of
// standing spots (where a human's feet go) in one of 8 directions, at 45°
// steps; its inside is the 3x6 box a body covers at each spot. Loose cells
// that could fall in (a powder with the inside below it, or diagonally
// below) are swapped for wood first, then the spot is dug out from the top
// down. Every run is kept in one network for the whole world
// (world.tunnels): nodes at entrances, junctions, bends and ends, and
// straight edges between them, which humans path along, climbing shafts
// and stairs. Mixed into World.prototype.

import { DEFS, ID, State } from './elements.js';
import { SHAPED } from './creatures.js';
import { USEFUL, HUT_W } from './humans.js';

const { POWDER } = State;
const { WOOD } = ID;
const INSIDE = 1, LINED = 2; // world.tunnels.mask bits
const BOX_UP = 6; // a spot's box: 3 wide, 6 tall
const NEW_COST = 4; // digging a new spot of tunnel counts as walking this many
const SHAFT_COST = 1.5; // and climbing a spot of shaft as this many

export function initTunnels(world) {
  world.tunnels = {
    nodes: new Map(), // id -> { id, x, y, entrance, edges: Set of edge ids }
    edges: new Map(), // id -> { id, a, b, dx, dy, len }: node b is len steps of (dx, dy) from a
    next: 1,
    gx: 0, gy: 1, // the way down it was dug with
    mask: new Uint8Array(world.w * world.h), // INSIDE, LINED
  };
  world.tunnelBox = new Int32Array(BOX_UP * 3);
}

export const Tunnels = {
  // The cells of the box a body covers standing at (x, y), with down (gx,
  // gy), into `out`, from the bottom row up. False if it leaves the world.
  boxCells(x, y, gx, gy, out) {
    let n = 0;
    for (let up = 0; up < BOX_UP; up++) {
      for (let k = -1; k <= 1; k++) {
        const cx = x + k * gy - up * gx, cy = y - k * gx - up * gy;
        if (!this.inBounds(cx, cy)) return false;
        out[n++] = cy * this.w + cx;
      }
    }
    return true;
  },

  isInside(x, y) {
    return this.inBounds(x, y) && (this.tunnels.mask[y * this.w + x] & INSIDE) !== 0;
  },

  // The spot at (x, y) is (to be) part of a tunnel.
  markInside(x, y) {
    const { gx, gy, mask } = this.tunnels, box = this.tunnelBox;
    if (!this.boxCells(x, y, gx, gy, box)) return;
    for (const c of box) mask[c] |= INSIDE;
  },

  // The loose cells round the box at (x, y) that could fall into a tunnel:
  // powders with the inside directly below them, or diagonally below.
  looseRound(x, y) {
    const { gx, gy, mask } = this.tunnels;
    const out = [];
    for (let up = 1; up <= BOX_UP; up++) {
      for (let k = -2; k <= 2; k++) {
        if (up < BOX_UP && k >= -1 && k <= 1) continue; // the box itself
        const cx = x + k * gy - up * gx, cy = y - k * gx - up * gy;
        if (!this.inBounds(cx, cy)) continue;
        const c = cy * this.w + cx, t = this.type[c];
        if (t === 0 || SHAPED[t] || DEFS[t].state !== POWDER || (mask[c] & INSIDE) !== 0) continue;
        const dx = cx + gx, dy = cy + gy;
        if (this.isInside(dx, dy) || this.isInside(dx + gy, dy - gx) || this.isInside(dx - gy, dy + gx)) out.push(c);
      }
    }
    return out;
  },

  // Swap a loose cell for lining wood from its pack: false if it has none.
  lineCell(b, c) {
    if (!this.takeOut(b, WOOD)) return false;
    this.clearCell(c);
    this.spawn(c, WOOD);
    this.humanMade.set(c, WOOD);
    this.tunnels.mask[c] |= LINED;
    return true;
  },

  // One piece of work on the spot (x, y): line one loose cell round it, or
  // else dig out one cell of its box (the top row first; lining wood in the
  // way goes back in its pack, useful things too). 'work' while there's
  // more, 'clear' once the box is open, 'wood' when lining is needed and it
  // has none, 'blocked' for something it can't dig, 'wait' for a creature.
  workSpot(e, b, x, y) {
    const { gx, gy, mask } = this.tunnels, box = this.tunnelBox;
    if (!this.boxCells(x, y, gx, gy, box)) return 'blocked';
    this.markInside(x, y);
    const loose = this.looseRound(x, y);
    if (loose.length > 0) return this.lineCell(b, loose[0]) ? 'work' : 'wood';
    for (let n = box.length - 1; n >= 0; n--) {
      const c = box[n], t = this.type[c];
      if (t === 0 || this.roomForBody(e, c)) continue;
      if (SHAPED[t]) return 'wait';
      if (t === WOOD && (mask[c] & LINED) !== 0) this.stow(b, WOOD); // its own lining
      else if (!this.diggable(c, this.digLimit(b))) return 'blocked';
      else if (USEFUL[t]) this.stow(b, t);
      mask[c] &= ~LINED;
      this.clearCell(c);
      return 'work';
    }
    return 'clear';
  },

  addNode(x, y, entrance = false) {
    const net = this.tunnels;
    const n = { id: net.next++, x, y, entrance, edges: new Set() };
    net.nodes.set(n.id, n);
    return n;
  },

  // A straight run from node na to node nb (8 directions only).
  addEdge(na, nb) {
    const net = this.tunnels;
    const ex = nb.x - na.x, ey = nb.y - na.y, len = Math.max(Math.abs(ex), Math.abs(ey));
    const ed = { id: net.next++, a: na.id, b: nb.id, dx: Math.sign(ex), dy: Math.sign(ey), len };
    net.edges.set(ed.id, ed);
    na.edges.add(ed.id);
    nb.edges.add(ed.id);
    return ed;
  },

  removeEdge(ed) {
    const net = this.tunnels;
    net.edges.delete(ed.id);
    net.nodes.get(ed.a)?.edges.delete(ed.id);
    net.nodes.get(ed.b)?.edges.delete(ed.id);
  },

  // Split a run k spots from its start: the new node there.
  splitEdge(ed, k) {
    const net = this.tunnels, na = net.nodes.get(ed.a), nb = net.nodes.get(ed.b);
    const m = this.addNode(na.x + k * ed.dx, na.y + k * ed.dy);
    this.removeEdge(ed);
    this.addEdge(na, m);
    this.addEdge(m, nb);
    return m;
  },

  nodeAt(x, y) {
    for (const n of this.tunnels.nodes.values()) if (n.x === x && n.y === y) return n;
    return null;
  },

  nodeKind(n) {
    if (n.entrance) return 'entrance';
    return n.edges.size >= 3 ? 'junction' : n.edges.size === 2 ? 'bend' : 'end';
  },

  // Is (x, y) a spot on run ed (its ends included)? Its step count from the
  // start, or -1.
  edgeHas(ed, x, y) {
    const a = this.tunnels.nodes.get(ed.a);
    const k = ed.dx !== 0 ? (x - a.x) * ed.dx : (y - a.y) * ed.dy;
    return k >= 0 && k <= ed.len && a.x + k * ed.dx === x && a.y + k * ed.dy === y ? k : -1;
  },

  // Where (x, y) is on the network: { node } at a node, { edge, k } partway
  // along a run, or null.
  onNet(x, y) {
    const n = this.nodeAt(x, y);
    if (n !== null) return { node: n, edge: null, k: 0 };
    for (const ed of this.tunnels.edges.values()) {
      const k = this.edgeHas(ed, x, y);
      if (k > 0 && k < ed.len) return { node: null, edge: ed, k };
    }
    return null;
  },

  // What a spot along run ed costs to travel: shafts are slower.
  spotCost(ed) {
    const { gx, gy } = this.tunnels;
    return ed.dx * gy - ed.dy * gx === 0 ? SHAFT_COST : 1;
  },

  // Shortest travel costs over the network from `sources` (node id ->
  // starting cost): { dist, prev }.
  netDistances(sources) {
    const net = this.tunnels, dist = new Map(sources), prev = new Map(), done = new Set();
    for (;;) {
      let u = -1, du = Infinity;
      for (const [id, d] of dist) {
        if (!done.has(id) && d < du) {
          u = id;
          du = d;
        }
      }
      if (u < 0) return { dist, prev };
      done.add(u);
      for (const eid of net.nodes.get(u).edges) {
        const ed = net.edges.get(eid), v = ed.a === u ? ed.b : ed.a, d = du + ed.len * this.spotCost(ed);
        if (d < (dist.get(v) ?? Infinity)) {
          dist.set(v, d);
          prev.set(v, u);
        }
      }
    }
  },

  // Where travel from e starts: its spot on the network, or (outside) every
  // entrance, at the distance it would walk to it.
  netSources(e) {
    const net = this.tunnels, at = this.onNet(e.x, e.y), src = new Map();
    if (at === null) {
      for (const n of net.nodes.values()) if (n.entrance) src.set(n.id, Math.abs(n.x - e.x) + Math.abs(n.y - e.y));
    } else if (at.node !== null) src.set(at.node.id, 0);
    else {
      const c = this.spotCost(at.edge);
      src.set(at.edge.a, at.k * c);
      src.set(at.edge.b, (at.edge.len - at.k) * c);
    }
    return { at, src };
  },

  // The cost of reaching spot k along run ed, given network distances.
  costAlong(ed, k, dist) {
    const c = this.spotCost(ed);
    return Math.min((dist.get(ed.a) ?? Infinity) + k * c, (dist.get(ed.b) ?? Infinity) + (ed.len - k) * c);
  },

  // The way from e to the network spot (x, y): { wps (waypoints, node by
  // node), outside (it walks overland to the first one, an entrance) }, or
  // null if there's none.
  netRoute(e, x, y) {
    const net = this.tunnels, to = this.onNet(x, y);
    if (to === null) return null;
    const { at, src } = this.netSources(e);
    if (at !== null && at.edge !== null && to.edge === at.edge) return { wps: [{ x, y }], outside: false };
    const { dist, prev } = this.netDistances(src);
    let end;
    if (to.node !== null) end = to.node.id;
    else {
      const ed = to.edge, c = this.spotCost(ed);
      end = (dist.get(ed.a) ?? Infinity) + to.k * c <= (dist.get(ed.b) ?? Infinity) + (ed.len - to.k) * c ? ed.a : ed.b;
    }
    if (!dist.has(end)) return null;
    const chain = [];
    for (let n = end; n !== undefined; n = prev.get(n)) chain.push(n);
    chain.reverse();
    const wps = chain.map((id) => ({ x: net.nodes.get(id).x, y: net.nodes.get(id).y }));
    if (to.node === null) wps.push({ x, y });
    if (wps.length > 0 && wps[0].x === e.x && wps[0].y === e.y) wps.shift();
    return { wps, outside: at === null };
  },

  // Drop the run that holds both (x0, y0) and (x1, y1), and every node that
  // leaves without a way to an entrance.
  dropStretch(x0, y0, x1, y1) {
    for (const ed of this.tunnels.edges.values()) {
      if (this.edgeHas(ed, x0, y0) >= 0 && this.edgeHas(ed, x1, y1) >= 0) {
        this.removeEdge(ed);
        break;
      }
    }
    this.prune();
  },

  // Forget the nodes (and runs) with no way to an entrance.
  prune() {
    const net = this.tunnels, seen = new Set(), todo = [];
    for (const n of net.nodes.values()) {
      if (n.entrance && n.edges.size > 0) {
        seen.add(n.id);
        todo.push(n.id);
      }
    }
    while (todo.length > 0) {
      for (const eid of net.nodes.get(todo.pop()).edges) {
        const ed = net.edges.get(eid), v = seen.has(ed.a) ? ed.b : ed.a;
        if (!seen.has(v)) {
          seen.add(v);
          todo.push(v);
        }
      }
    }
    for (const n of [...net.nodes.values()]) {
      if (seen.has(n.id)) continue;
      for (const eid of [...n.edges]) this.removeEdge(net.edges.get(eid));
      net.nodes.delete(n.id);
    }
  },

  // Steps between two spots, 45° at a time, in the frame of down (gx, gy).
  octo(x0, y0, x1, y1, gx, gy) {
    const du = (x1 - x0) * gy - (y1 - y0) * gx, dv = (x1 - x0) * gx + (y1 - y0) * gy;
    return Math.max(Math.abs(du), Math.abs(dv));
  },

  // The two legs from (x0, y0) to (x1, y1): diagonal, then straight, as
  // [{ dx, dy, n }] in world steps (legs of no length left out).
  legsTo(x0, y0, x1, y1, gx, gy) {
    const du = (x1 - x0) * gy - (y1 - y0) * gx, dv = (x1 - x0) * gx + (y1 - y0) * gy;
    const su = Math.sign(du), sv = Math.sign(dv), n1 = Math.min(Math.abs(du), Math.abs(dv));
    const n2 = Math.max(Math.abs(du), Math.abs(dv)) - n1, across = Math.abs(du) > Math.abs(dv);
    const step = (u, v) => ({ dx: u * gy + v * gx, dy: -u * gx + v * gy });
    const legs = [];
    if (n1 > 0) legs.push({ ...step(su, sv), n: n1 });
    if (n2 > 0) legs.push({ ...step(across ? su : 0, across ? 0 : sv), n: n2 });
    return legs;
  },

  // A standing spot on the surface for a new entrance: 10 to 40 cells
  // beside the camp, clear of its hut, the side towards the target first.
  // { x, y, cost } or null.
  entranceSpot(e, camp, tx, ty) {
    const hut = camp.hut, tu = (tx - camp.x) * camp.gy - (ty - camp.y) * camp.gx;
    let best = null;
    for (const s of tu >= 0 ? [1, -1] : [-1, 1]) {
      for (let k = 10; k <= 40; k++) {
        const u = s * k;
        if (hut !== null && u >= hut.u0 - 1 && u <= hut.u0 + HUT_W) continue;
        const g = this.groundAt(camp, u);
        if (g === null) continue;
        const c = this.campCell(camp, u, g - 1);
        if (c < 0 || this.type[c] !== 0) continue;
        const x = c % this.w, y = (c / this.w) | 0;
        if (this.nodeAt(x, y) !== null) continue;
        const cost = Math.abs(x - e.x) + Math.abs(y - e.y) + NEW_COST * this.octo(x, y, tx, ty, camp.gx, camp.gy);
        if (best === null || cost < best.cost) best = { x, y, cost };
      }
    }
    return best;
  },

  // The cheapest way to tunnel to (tx, ty): from a spot on the network
  // (travel there, then dig), or from a new entrance. { cost, x, y,
  // entrance } or null.
  planTunnel(e, camp, tx, ty) {
    const net = this.tunnels;
    if (net.nodes.size > 0 && (net.gx !== e.gx || net.gy !== e.gy)) return null; // dug under another gravity
    let best = null;
    if (net.edges.size > 0) {
      const { dist } = this.netDistances(this.netSources(e).src);
      for (const ed of net.edges.values()) {
        const a = net.nodes.get(ed.a);
        for (let k = 0; k <= ed.len; k++) {
          const x = a.x + k * ed.dx, y = a.y + k * ed.dy;
          const cost = this.costAlong(ed, k, dist) + NEW_COST * this.octo(x, y, tx, ty, e.gx, e.gy);
          if (best === null || cost < best.cost) best = { cost, x, y, entrance: false };
        }
      }
    }
    const ent = this.entranceSpot(e, camp, tx, ty);
    if (ent !== null && (best === null || ent.cost < best.cost)) best = { cost: ent.cost, x: ent.x, y: ent.y, entrance: true };
    return best;
  },
};
