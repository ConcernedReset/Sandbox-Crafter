// Tunnels: humans' mine workings (humans.js). A tunnel is a straight run of
// standing spots (where a human's feet go) in one of 8 directions, at 45°
// steps; its inside is the 3x6 box a body covers at each spot. Loose cells
// that could fall in (a powder with the inside below it, or diagonally
// below) are swapped for wood first, then the spot is dug out from the top
// down. Every run is kept in one network for the whole world
// (world.tunnels): nodes at entrances, junctions, bends and ends, and
// straight edges between them, which humans path along, climbing shafts
// and stairs. Mixed into World.prototype.

import { DEFS, ID, State, SPECIAL } from './elements.js';
import { SHAPED } from './creatures.js';
import {
  USEFUL, DANGER, HUT_W, WALK_EVERY, SCAFFOLD_STACK, GIVE_UP, DIG_EVERY, BAN_FOR, HELD_PICKAXE, RESOURCES, WOOD_ONLY, FUEL_R, SEAM_R,
} from './humans.js';

const { POWDER, LIQUID } = State;
const { WOOD, SCAFFOLDING } = ID;
const SCAFFOLD_CUT = 4; // scaffolding cut from each piece of wood
const INSIDE = 1, LINED = 2; // world.tunnels.mask bits
const BOX_UP = 6; // a spot's box: 3 wide, 6 tall
const NEW_COST = 4; // digging a new spot of tunnel counts as walking this many
const SHAFT_COST = 1.5; // and climbing a spot of shaft as this many
const CLIMB_EVERY = 6; // steps per spot climbed up or down a shaft
export const TUNNEL_LINING = 24; // lining it wants in hand before it tunnels: scaffolding, and 4 for each wood
const ENTRY_DEPTH = 7; // a new entrance starts as a shaft this deep: a small mouth, soon underground
const WAIT_SPOT = 60; // steps it waits for someone in the way of a spot it's going to
const BAIL = 40; // liquid cells it bails out of a spot before it counts it flooded

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

  // Cut 4 scaffolding from a piece of wood in its pack, if it has room for
  // them: true if it did.
  cutScaffolding(b) {
    if (this.has(b, SCAFFOLDING) > SCAFFOLD_STACK - SCAFFOLD_CUT || !this.takeOut(b, WOOD)) return false;
    b.items.set(SCAFFOLDING, this.has(b, SCAFFOLDING) + SCAFFOLD_CUT);
    return true;
  },

  // Lining it has in hand: scaffolding, and what its wood would make.
  liningInHand(b) {
    return this.has(b, SCAFFOLDING) + SCAFFOLD_CUT * this.has(b, WOOD);
  },

  // Swap a loose cell for scaffolding from its pack (cut from wood if it
  // has none; keeping what was there, if it's useful): false if it has
  // neither.
  lineCell(b, c) {
    if (this.has(b, SCAFFOLDING) === 0) this.cutScaffolding(b);
    if (!this.takeOut(b, SCAFFOLDING)) return false;
    if (USEFUL[this.type[c]]) this.stow(b, this.type[c]);
    this.clearCell(c);
    this.spawn(c, SCAFFOLDING);
    this.humanMade.set(c, SCAFFOLDING);
    this.tunnels.mask[c] |= LINED;
    this.record(SCAFFOLDING, SPECIAL['human-scaffolding']);
    return true;
  },

  // One piece of work on the spot (x, y): line one loose cell round it, or
  // else dig out one cell of its box (the top row first; lining wood in the
  // way goes back in its pack, useful things too), bailing out any liquid.
  // 'work' while there's more, 'clear' once the box is open, 'wood' when
  // lining is needed and it has none, 'blocked' for something it can't dig
  // (or a flooded or dangerous liquid), 'wait' for a creature.
  workSpot(e, b, x, y) {
    const { gx, gy, mask } = this.tunnels, box = this.tunnelBox;
    if (!this.boxCells(x, y, gx, gy, box)) return 'blocked';
    this.markInside(x, y);
    const loose = this.looseRound(x, y);
    if (loose.length > 0) return this.lineCell(b, loose[0]) ? 'work' : 'wood';
    for (let n = box.length - 1; n >= 0; n--) {
      const c = box[n], t = this.type[c];
      if (t !== 0 && DEFS[t].state === LIQUID) {
        if (DANGER[t] || ++b.bailed > BAIL) return 'blocked';
        this.clearCell(c);
        return 'work';
      }
      if (t === 0 || this.roomForBody(e, c)) continue;
      if (SHAPED[t]) return 'wait';
      if ((t === SCAFFOLDING || t === WOOD) && (mask[c] & LINED) !== 0) this.stow(b, t); // its own lining
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

  // A standing spot on the surface for a new entrance: 14 to 40 cells
  // beside the camp (past where humans sit by the fire, who would block its
  // mouth), 4 or more clear of its hut (and its doorways), not in a tunnel,
  // the side towards the target first. { x, y, cost } or null.
  entranceSpot(e, camp, tx, ty) {
    const hut = camp.hut, tu = (tx - camp.x) * camp.gy - (ty - camp.y) * camp.gx;
    let best = null;
    for (const s of tu >= 0 ? [1, -1] : [-1, 1]) {
      for (let k = 14; k <= 40; k++) {
        const u = s * k;
        if (hut !== null && u >= hut.u0 - 4 && u < hut.u0 + HUT_W + 4) continue;
        const g = this.groundAt(camp, u);
        if (g === null) continue;
        const c = this.campCell(camp, u, g - 1);
        if (c < 0 || this.type[c] !== 0) continue;
        const x = c % this.w, y = (c / this.w) | 0;
        if (this.isInside(x, y) || this.nodeAt(x, y) !== null) continue;
        const bx = x + ENTRY_DEPTH * camp.gx, by = y + ENTRY_DEPTH * camp.gy;
        const cost = Math.abs(x - e.x) + Math.abs(y - e.y) + NEW_COST * (ENTRY_DEPTH + this.octo(bx, by, tx, ty, camp.gx, camp.gy));
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

  // Set off to mine `key` (a RESOURCES key) until it holds `goal`: plan a
  // tunnel to the nearest deposit. Lining first (TUNNEL_LINING in hand: it
  // gathers wood for it; it goes with less only if there's no more to be
  // had).
  // False if there's no way (it skips that one a while).
  startMining(e, b, camp, key, goal) {
    if ((b.skip.get(key) ?? 0) > this.tick) return false;
    // One human in the tunnels at a time: two in a tunnel can't pass. The
    // others wait their turn (doing other things).
    for (const o of this.creatures) if (o !== e && o.brain !== null && this.inTunnels(o)) return false;
    const set = RESOURCES[key];
    const t = this.findDeposit(e, camp, set, this.digLimit(b));
    const plan = t < 0 ? null : this.planTunnel(e, camp, t % this.w, (t / this.w) | 0);
    if (plan === null) {
      b.skip.set(key, this.tick + BAN_FOR);
      return false;
    }
    if (this.liningInHand(b) < TUNNEL_LINING) {
      if (this.gather(e, b, camp, WOOD_ONLY, FUEL_R, 'gathering wood')) return true;
      if (this.liningInHand(b) === 0) {
        b.skip.set(key, this.tick + BAN_FOR);
        return false;
      }
    }
    this.claim(b, camp, t);
    b.fetchSet = set;
    b.mineKey = key;
    b.wantN = goal;
    b.job = 'mining';
    b.tun = { tx: t % this.w, ty: (t / this.w) | 0, x: plan.x, y: plan.y, entrance: plan.entrance, route: null, legs: null, node: null };
    if (b.tool !== 0) b.held = HELD_PICKAXE;
    return true;
  },

  // Stop mining (done, or it can't go on).
  endTunnel(b) {
    this.release(b);
    b.tun = null;
    b.job = 'wandering';
    b.think = 0;
  },

  // Travel to the plan's start, then dig to the target, then on along the
  // seam.
  mine(e, b) {
    const t = b.tun;
    if (t === null) this.endTunnel(b);
    else if (t.legs === null) this.tunnelGo(e, b, t);
    else this.tunnelDig(e, b, t);
  },

  // Exactly onto the spot (x, y) (walking only gets it close).
  snapTo(e, x, y) {
    return (e.x === x && e.y === y) || this.moveBody(e, x, y, 0, e.facing, e.gx, e.gy);
  },

  // Is there liquid in the box at spot (x, y)?
  wetSpot(x, y) {
    const { gx, gy } = this.tunnels, box = this.tunnelBox;
    if (!this.boxCells(x, y, gx, gy, box)) return false;
    for (const c of box) if (this.type[c] !== 0 && DEFS[this.type[c]].state === LIQUID) return true;
    return false;
  },

  // Is human o using the tunnels: mining, or anywhere in the network but
  // an entrance?
  inTunnels(o) {
    if (o.brain.tun !== null) return true;
    if (this.tunnels.edges.size === 0 || !this.isInside(o.x, o.y)) return false;
    const at = this.nearSpot(o.x, o.y);
    return at !== null && !(at.node !== null && at.node.entrance);
  },

  // The nearest spot of the network to (x, y), within 2 cells: { x, y,
  // node, edge, k }, or null.
  nearSpot(x0, y0) {
    for (let r = 0; r <= 2; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const at = this.onNet(x0 + dx, y0 + dy);
          if (at !== null) return { ...at, x: x0 + dx, y: y0 + dy };
        }
      }
    }
    return null;
  },

  // e is inside a tunnel but not on one of its spots (it dropped down a
  // shaft, say): onto the nearest spot, if it can. Not at an entrance: by
  // one, it's out on the surface already.
  backOnNet(e) {
    const at = this.nearSpot(e.x, e.y);
    return at !== null && !(at.node !== null && at.node.entrance) && this.snapTo(e, at.x, at.y);
  },

  // Overland to the spot (x, y), and exactly onto it, clearing it (lined)
  // if something has filled it. True once there; it gives up if it can't
  // dig the spot clear.
  reachSpot(e, b, x, y) {
    if (e.x === x && e.y === y) return true;
    // Walk there; once it's as near as walking gets it, dig the spot clear
    // (if need be) and step onto it.
    const near = Math.abs(x - e.x) <= 1 && Math.abs(y - e.y) <= 2;
    if (!near && !this.walkTo(e, b, x, y, 1, WALK_EVERY)) return false;
    if (this.snapTo(e, x, y)) {
      b.stuck = 0;
      return true;
    }
    if (++b.pace < DIG_EVERY) return false;
    b.pace = 0;
    const r = this.workSpot(e, b, x, y);
    if (r === 'wait') {
      // Someone's in the way (coming out, say): it steps away and tries later.
      if ((b.stuck += DIG_EVERY) > WAIT_SPOT) this.endTunnel(b);
    } else if (r === 'blocked' || r === 'wood' || (r === 'clear' && (b.stuck += DIG_EVERY) > GIVE_UP)) {
      this.giveUp(e, b);
    }
    return false;
  },

  // On to the plan's start: a new entrance overland, or through the network.
  tunnelGo(e, b, t) {
    if (t.entrance) {
      if (!this.reachSpot(e, b, t.x, t.y)) return;
      const net = this.tunnels;
      if (net.nodes.size === 0) {
        net.gx = e.gx;
        net.gy = e.gy;
      }
      t.node = this.nodeAt(e.x, e.y) ?? this.addNode(e.x, e.y, true);
      const bx = e.x + ENTRY_DEPTH * e.gx, by = e.y + ENTRY_DEPTH * e.gy;
      t.legs = [{ dx: e.gx, dy: e.gy, n: ENTRY_DEPTH }, ...this.legsTo(bx, by, t.tx, t.ty, e.gx, e.gy)];
      return;
    }
    if (t.route === null) t.route = this.netRoute(e, t.x, t.y);
    const r = t.route;
    if (r === null) {
      this.endTunnel(b);
      return;
    }
    if (r.outside) {
      if (!this.reachSpot(e, b, r.wps[0].x, r.wps[0].y)) return;
      r.outside = false;
    }
    while (r.wps.length > 0 && r.wps[0].x === e.x && r.wps[0].y === e.y) r.wps.shift();
    if (r.wps.length > 0) {
      this.tunnelTravel(e, b, r.wps[0].x, r.wps[0].y);
      return;
    }
    // At the plan's start: a node there (splitting a run if need be), then dig.
    b.hold = true;
    const at = this.onNet(e.x, e.y);
    if (at === null) {
      this.endTunnel(b);
      return;
    }
    t.node = at.node ?? this.splitEdge(at.edge, at.k);
    t.legs = this.legsTo(e.x, e.y, t.tx, t.ty, e.gx, e.gy);
  },

  // A step along the network, ending the plan if it can't go on.
  tunnelTravel(e, b, wx, wy) {
    const r = this.stepAlong(e, b, wx, wy);
    if (r === 'blocked') {
      this.dropStretch(e.x, e.y, e.x + Math.sign(wx - e.x), e.y + Math.sign(wy - e.y));
      this.endTunnel(b);
    } else if (r === 'wood') {
      this.endTunnel(b);
    } else if (r === 'wait' && ++b.stuck > GIVE_UP) this.giveUp(e, b);
  },

  // One step along the network towards waypoint (wx, wy): a spot every
  // WALK_EVERY steps (CLIMB_EVERY up or down a shaft), holding on so it
  // doesn't fall. Missing lining beside it is put back (if it has wood);
  // something in the way is dug out and lined. 'moved', 'busy', or what
  // workSpot found ('wood', 'blocked', 'wait').
  stepAlong(e, b, wx, wy) {
    b.hold = true;
    const dx = Math.sign(wx - e.x), dy = Math.sign(wy - e.y);
    const a = dx * e.gy - dy * e.gx;
    if (++b.pace < (a === 0 ? CLIMB_EVERY : WALK_EVERY)) return 'busy';
    b.pace = 0;
    const face = a > 0 ? 1 : a < 0 ? -1 : e.facing;
    if (!this.wetSpot(e.x + dx, e.y + dy) && this.moveBody(e, e.x + dx, e.y + dy, e.frame === 0 ? 1 : 0, face, e.gx, e.gy)) {
      b.stuck = 0;
      b.bailed = 0;
      if (this.liningInHand(b) > 0) {
        const loose = this.looseRound(e.x, e.y);
        if (loose.length > 0) this.lineCell(b, loose[0]);
      }
      return 'moved';
    }
    const r = this.workSpot(e, b, e.x + dx, e.y + dy);
    if (r === 'work') return 'busy';
    // Another human in the way: they trade places.
    if (r === 'wait' || r === 'clear') {
      const o = this.humanIn(e, e.x + dx, e.y + dy);
      if (o !== null && this.swapPlaces(e, o)) return 'moved';
    }
    return r === 'clear' ? 'wait' : r;
  },

  // Another human with a cell in the box at spot (x, y), or null.
  humanIn(e, x, y) {
    const { gx, gy } = this.tunnels, box = this.tunnelBox;
    if (!this.boxCells(x, y, gx, gy, box)) return null;
    for (const c of box) {
      const o = this.creatureAt(c);
      if (o !== null && o !== e && o.brain !== null) return o;
    }
    return null;
  },

  // Dig the plan's legs a spot at a time from where it stands, growing the
  // network as it goes; at the target, on along the seam while it wants
  // more.
  tunnelDig(e, b, t) {
    b.hold = true;
    // It digs from the node it stands on; moved off it (pushed, or another
    // human dug that end on), it plans again.
    if (!this.tunnels.nodes.has(t.node.id) || e.x !== t.node.x || e.y !== t.node.y) {
      this.endTunnel(b);
      return;
    }
    if (t.legs.length === 0 || !b.fetchSet[this.type[t.ty * this.w + t.tx]]) {
      const n = this.wantsMore(b) ? this.findDeposit(e, b.camp, b.fetchSet, this.digLimit(b), SEAM_R) : -1;
      if (n < 0) {
        this.endTunnel(b);
        return;
      }
      this.release(b);
      this.claim(b, b.camp, n);
      t.tx = n % this.w;
      t.ty = (n / this.w) | 0;
      t.legs = this.legsTo(e.x, e.y, t.tx, t.ty, e.gx, e.gy);
      if (t.legs.length === 0) {
        this.endTunnel(b);
        return;
      }
    }
    if (++b.pace < DIG_EVERY) return;
    b.pace = 0;
    const leg = t.legs[0], x = e.x + leg.dx, y = e.y + leg.dy;
    const r = this.workSpot(e, b, x, y);
    if (r === 'work') {
      b.stuck = 0;
      return;
    }
    if (r === 'wood') {
      this.endTunnel(b);
      return;
    }
    if (r === 'blocked') {
      b.skip.set(b.mineKey, this.tick + BAN_FOR);
      this.endTunnel(b);
      return;
    }
    const a = leg.dx * e.gy - leg.dy * e.gx, face = a > 0 ? 1 : a < 0 ? -1 : e.facing;
    if (r === 'wait' || !this.moveBody(e, x, y, e.frame === 0 ? 1 : 0, face, e.gx, e.gy)) {
      if (++b.stuck > GIVE_UP) this.giveUp(e, b);
      return;
    }
    b.stuck = 0;
    b.bailed = 0;
    this.growTunnel(t, x, y, leg.dx, leg.dy);
    if (--leg.n === 0) t.legs.shift();
  },

  // The tunnel reached (x, y), a step (dx, dy) on from node t.node: that
  // node moves on if it's the dead end of a run going this way, else a new
  // run starts from it.
  growTunnel(t, x, y, dx, dy) {
    const net = this.tunnels, n = t.node;
    if (!n.entrance && n.edges.size === 1) {
      const ed = net.edges.get([...n.edges][0]);
      if (ed.b === n.id && ed.dx === dx && ed.dy === dy) {
        n.x = x;
        n.y = y;
        ed.len++;
        return;
      }
    }
    const m = this.addNode(x, y);
    this.addEdge(n, m);
    t.node = m;
  },

  // Is there tunnel right under e's feet, and e on the surface (not in the
  // network, or at an entrance)? Walking overland, it crosses a tunnel's
  // mouth rather than dropping in.
  overTunnel(e) {
    if (this.tunnels.edges.size === 0) return false;
    const at = this.onNet(e.x, e.y);
    if (at !== null && !(at.node !== null && at.node.entrance)) return false;
    for (let k = -1; k <= 1; k++) {
      const x = e.x + k * e.gy + e.gx, y = e.y - k * e.gx + e.gy;
      if (this.isInside(x, y) && this.type[y * this.w + x] === 0) return true;
    }
    return false;
  },

  // In the network but going somewhere else: out through the nearest
  // entrance first. True while it's doing that.
  leaveTunnel(e, b) {
    const net = this.tunnels;
    if (net.edges.size === 0 || net.gx !== e.gx || net.gy !== e.gy) return false;
    let at = this.onNet(e.x, e.y);
    if (at === null && this.isInside(e.x, e.y) && this.backOnNet(e)) at = this.onNet(e.x, e.y);
    if (at === null || (at.node !== null && at.node.entrance)) return false;
    const { dist, prev } = this.netDistances(this.netSources(e).src);
    let best = -1, bd = Infinity;
    for (const n of net.nodes.values()) {
      if (n.entrance && (dist.get(n.id) ?? Infinity) < bd) {
        best = n.id;
        bd = dist.get(n.id);
      }
    }
    if (best < 0) return false;
    let next = best; // the first node on the way there
    while (prev.has(next) && !(at.node !== null && prev.get(next) === at.node.id)) next = prev.get(next);
    const n = net.nodes.get(next);
    const r = this.stepAlong(e, b, n.x, n.y);
    if (r === 'blocked') {
      this.dropStretch(e.x, e.y, e.x + Math.sign(n.x - e.x), e.y + Math.sign(n.y - e.y));
      return false;
    }
    if (r === 'wait' && ++b.stuck > GIVE_UP) return false; // stuck: it finds its own way
    if (r === 'moved') b.stuck = 0;
    return r !== 'wood';
  },
};
