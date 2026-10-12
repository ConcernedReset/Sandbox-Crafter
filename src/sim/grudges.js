// Grudges: how angry each camp is with the others, and how it hits back
// (war.js has the raids and war machines; humans.js the humans).
//
// Anger: each camp has an anger level from 0 to ANGER_MAX, aimed at the camp
// that last angered it (camp.grudge). It rises when an enemy's bullet hits
// one of its people, when one of them dies soon after such a hit, when an
// enemy missile lands in the camp or a tunnel bomb goes off under it, and,
// every second, for each enemy human and helicopter near the camp. With no
// enemy near, it cools.
//
// Hitting back: at full anger, once no enemy has been near for CALM_FOR
// steps, the camp strikes the camp it's angry with. With a helicopter or a
// missile ready it raids at once (war.js's raid, which counts as its timed
// one). With neither, it sends a tunneller, who
//   1. gets gunpowder for the C4 (kneaded as soon as it has it), metal for
//      the wire, and wood to line the tunnel (camp-mates by the fire hand
//      over what they can spare: humans.js's share);
//   2. tunnels (tunnels.js) from its camp's own tunnels or a new entrance
//      on its enemy side to a spot SAP_DEPTH (or, to keep clear of other
//      tunnels, deeper) under the middle of the enemy hut's floor;
//   3. packs the face at the end of the tunnel with C4;
//   4. walks back out, laying copper wire in the tunnel's wall and floor,
//      then along the ground to a plunger past the edge of its lawn;
//   5. kneels and pushes the plunger: a spark runs down the wire and sets
//      the C4 off. When the charge goes off (whoever sets it off), craters
//      reach from it up through the hut over it.
// What it can't get just now it waits for by the fire; if it never gets
// on (or dies), it gives up, which puts the camp's anger back where it
// was, and the camp tries again later.
//
// Mixed into World.prototype.

import { DEFS, ID, State } from './elements.js';
import { SHAPED } from './creatures.js';
import {
  WALK_EVERY, AMMO_LOW, WOOD_ONLY, FRAME_KNEEL, METALS, DANGER, HUT_W, HELD_PICKAXE,
} from './humans.js';
import { INSIDE, LINED, NEW_COST, TUNNEL_LINING, ENTRY_DEPTH } from './tunnels.js';

const { LIQUID, GAS, ENERGY } = State;
const { GUNPOWDER, C4, COPPER } = ID;

export const ANGER_MAX = 100;
export const ANGER_HIT = 2; // an enemy's bullet hits one of its people (armour or not)
export const ANGER_KILL = 25; // one of them dies soon after an enemy's hit
const KILL_WINDOW = 600; // (this soon)
export const ANGER_MISSILE = 50; // an enemy missile goes off in the camp
export const ANGER_BLAST = 60; // a tunnel bomb goes off under it
export const ANGER_NEAR_R = 40; // (that near its fire)
export const ANGER_R = 80; // enemies this near the camp anger it, every second:
const ANGER_HUMAN = 1, ANGER_HELI = 2; // each human, each helicopter
const ANGER_COOL = 0.25; // and with none near, it cools this much a second
export const CALM_FOR = 1800; // it hits back once no enemy has been near for this long
export const SAP_RETRY = 3600; // a tunnel job it couldn't get on with: tried again this much later
export const SAP_C4 = 8; // cells of C4 in a charge
export const SAP_POWDER = 2; // gunpowder kneaded into each
export const WIRE_PER_METAL = 20; // cells of wire drawn from a piece of metal
export const SAP_DEPTH = 10; // the tunnel's end: this far under the enemy hut's floor
// (Or deeper, when there's no way there that keeps clear of other tunnels:
// in Two tribes both camps' mines fill the ground between them, and the
// enemy's copper mine runs under its hut: at 36 the way was clear; in Deep
// tribes the coal mines fill 25 to 40 down, so deeper still. A target
// out of the world is skipped.)
const DEPTHS = [SAP_DEPTH, 14, 18, 22, 26, 30, 36, 42, 50, 60, 70];
const ROUND_TRIES = 3; // and then the cheapest places to dig from it looks for a way round other tunnels from (planAround)
const ROUND_DEPTHS = [SAP_DEPTH, 26, 50]; // at these depths
const SAP_WOOD_R = 200; // how far from the camp it goes for wood (for lining; late on, the trees near are gone)
const WOOD_TRIES = 3; // goes for wood without a spot dug since, before it digs with what lining it has
const SAP_DIG_EVERY = 4; // steps per cell dug: twice as fast as a miner
const OWN_R = 100; // its camp's tunnels: the network reached from entrances this near it (and nearer it than the enemy)
const PLAN_TRIES = 20; // the cheapest places to dig from it checks for a clear way, at each depth
export const SAP_FOR = 54000; // the longest a tunnel job goes on
export const SAP_GATHER_FOR = 18000; // the longest it takes getting what it needs, before it digs
export const SAP_STALL = 6000; // and the longest it then goes without digging a spot further
const SAP_WAIT = 600; // something it needs not to be had just now: it waits by the fire this long
const PLACE_EVERY = 6; // steps per cell of C4 packed in
const SAP_PRESS = 60; // steps kneeling at the plunger before it pushes it
export const SAP_FIZZLE = 1800; // and waiting for the bang before it gives up
const WIRE_REACH = 10; // how far from its feet it joins the wire up
const AIR_COST = 6; // a cell of wire strung across open air counts as this many through the ground
const BLOW_DELAY = 4; // steps after the charge first goes off: the craters
const BLOW_CHARGE = 7, BLOW_MID = 8, BLOW_TOP = 11; // their sizes: at the charge, on the way up, at the hut's floor
const BLOW_STEP = 8; // (one every this many cells, at most)
const PLUNGER_U = 4; // where it kneels at the plunger: this far past the edge of the lawn (the plunger 3 nearer)
const PLUNGER_FAR = 16; // (or up to this much farther, where there's ground for it)
// Its jobs, in order.
const SAP_JOBS = new Set(['tunnelling', 'placing the charge', 'laying wire', 'detonating']);

export const Grudges = {
  // ---- anger ------------------------------------------------------------------

  // Camp `by` angers camp by n.
  anger(camp, by, n) {
    if (by === null || by === camp) return;
    camp.anger = Math.min(ANGER_MAX, camp.anger + n);
    camp.grudge = by;
  },

  // Every camp but `by` within r of (x, y) is angered by n.
  angerAround(x, y, by, n, r) {
    for (const camp of this.camps) {
      if (camp !== by && Math.max(Math.abs(camp.x - x), Math.abs(camp.y - y)) <= r) this.anger(camp, by, n);
    }
  },

  // A bullet fired by camp `by` hits human o of another camp.
  struck(o, by) {
    const b = o.brain, camp = b.camp;
    this.anger(camp, by, ANGER_HIT);
    camp.enemyAt = this.tick;
    b.hitBy = by;
    b.hitAt = this.tick;
  },

  // A missile of camp `by` goes off at (x, y) (aircraft.js).
  missileLanded(x, y, by) {
    this.angerAround(x, y, by, ANGER_MISSILE, ANGER_NEAR_R);
  },

  // Human e dies: if an enemy hit it lately, its camp is angered.
  mourn(e) {
    const b = e.brain;
    if (b.camp !== null && b.hitBy !== null && this.tick - b.hitAt <= KILL_WINDOW) this.anger(b.camp, b.hitBy, ANGER_KILL);
  },

  // Once a second (war.js's chores): enemies near the camp anger it; with
  // none, it cools. At full anger, and calm, it hits back. Its tunneller,
  // if it's gone, is given up on.
  campAnger(camp) {
    let humans = 0, helis = 0, by = null;
    for (const o of this.creatures) {
      if (o.grow >= 0) continue;
      const oc = o.brain !== null ? o.brain.camp : o.craft !== null && o.craft.kind === 'heli' && this.flying(o) ? o.craft.camp : null;
      if (oc === null || oc === camp || Math.max(Math.abs(o.x - camp.x), Math.abs(o.y - camp.y)) > ANGER_R) continue;
      if (o.brain !== null) humans++;
      else helis++;
      by = oc;
    }
    if (by !== null) {
      this.anger(camp, by, humans * ANGER_HUMAN + helis * ANGER_HELI);
      camp.enemyAt = this.tick;
    } else if (camp.anger < ANGER_MAX) { // (at full, it stays so till it has hit back)
      camp.anger = Math.max(0, camp.anger - ANGER_COOL);
    }
    const s = camp.sap;
    if (s !== null && !camp.members.has(s.id)) this.endSap(camp, true);
    if (camp.anger >= ANGER_MAX && this.tick - camp.enemyAt >= CALM_FOR) this.hitBack(camp);
  },

  // Is a helicopter or a missile of the camp's ready to go?
  wmdReady(camp) {
    const ln = camp.launcher;
    return (this.alive(camp.heli) && camp.heli.grow < 0) || (ln !== null && this.alive(ln.missile) && ln.missile.grow < 0);
  },

  // Strike the camp it's angry with (or, that one gone, the nearest other):
  // a raid, with a helicopter or missile ready; else a tunnel bomb. Its
  // anger is spent.
  hitBack(camp) {
    let enemy = camp.grudge;
    if (enemy === null || !this.camps.includes(enemy) || enemy.members.size === 0) enemy = this.nearestRival(camp);
    if (enemy === null) {
      camp.anger = 0;
      camp.grudge = null;
      return;
    }
    if (this.wmdReady(camp)) {
      if (camp.raid === null && this.startRaid(camp, enemy)) {
        camp.anger = 0;
        camp.strikes++;
      }
      return;
    }
    if (camp.sap !== null || this.tick < camp.sapRetry) return;
    if (this.startSap(camp, enemy)) {
      camp.anger = 0;
    } else {
      camp.sapRetry = this.tick + SAP_RETRY;
    }
  },

  // ---- the tunneller ---------------------------------------------------------------

  // Send one of the camp's humans with a pickaxe (not its engineer, nor a
  // raider), the one with most of what's needed, to tunnel under `enemy`.
  // False if there's nobody.
  startSap(camp, enemy) {
    if (enemy.gx !== camp.gx || enemy.gy !== camp.gy) return false;
    let best = null, bs = -1;
    for (const id of camp.members) {
      const o = this.creatureById[id];
      if (!o || o.brain === null || o.grow >= 0 || id === camp.engineer) continue;
      const b = o.brain;
      if (b.tool === 0 || b.raid !== null || b.job === 'swimming' || b.job === 'fleeing') continue;
      const score = this.has(b, C4) * 4 + this.has(b, GUNPOWDER) + this.holding(b, METALS) * 2 + this.liningInHand(b) / 4;
      if (score > bs) {
        best = o;
        bs = score;
      }
    }
    if (best === null) return false;
    const across = (enemy.x - camp.x) * camp.gy - (enemy.y - camp.y) * camp.gx;
    camp.sap = {
      id: best.id, enemy, side: across < 0 ? -1 : 1, // the tunneller, its target, and which way that is
      stage: 'gathering', start: this.tick,
      metal: 0, // metal it wants for the wire
      depth: SAP_DEPTH, tx: -1, ty: -1, // where the tunnel ends
      endX: -1, endY: -1, dx: 0, dy: 0, dug: 0, progressAt: this.tick, // how far it has got, and which way
      cells: null, placed: [], charge: null, // the C4: where it goes, where it went, the charge
      wired: new Set(), wire: [], last: -1, spool: 0, short: false, // the wire: its cells, its end, what's left on the spool
      plug: null, firedAt: -1, // the plunger, and when it was pushed
      waitUntil: 0, why: '', // it can't get on just now: it waits till then, for want of this
      woodTrips: 0, lining: 0, // times it has gone for wood since it last dug a spot; lining it had
      legsLeft: null, // the runs still to dig, on a way round other tunnels
    };
    const b = best.brain;
    this.release(b);
    b.tun = null;
    b.path = null;
    b.goalX = -1;
    b.stuck = 0;
    b.job = 'wandering';
    b.think = 0;
    return true;
  },

  // The tunnel job is over: done, or (`failed`) given up on, which puts the
  // camp's anger back (it tries again later).
  endSap(camp, failed) {
    const s = camp.sap;
    if (s === null) return;
    camp.sap = null;
    if (failed) {
      camp.anger = ANGER_MAX;
      camp.sapRetry = this.tick + SAP_RETRY;
      camp.sapsFailed++;
    } else {
      camp.sapsDone++;
      camp.strikes++;
    }
    const o = this.creatureById[s.id];
    if (!o || o.brain === null) return;
    const b = o.brain;
    if (b.tun !== null && b.tun.sap) b.tun = null;
    if (SAP_JOBS.has(b.job)) {
      b.job = 'wandering';
      b.think = 0;
    }
  },

  isSapper(e) {
    const camp = e.brain?.camp;
    return camp != null && camp.sap !== null && camp.sap.id === e.id;
  },

  // Its tunnel job comes before everything else it might do (but fleeing
  // and fights, which come first anyway): the next thing to do for it.
  // True if that gave it a job.
  sapWork(e, b, camp) {
    const s = camp.sap;
    if (s === null || s.id !== e.id) return false;
    if (!this.camps.includes(s.enemy) || this.tick - s.start > SAP_FOR
      || (s.stage === 'gathering' && this.tick - s.start > SAP_GATHER_FOR)
      || (s.stage === 'digging' && this.tick - s.progressAt > SAP_STALL)) {
      this.endSap(camp, true);
      return false;
    }
    if (this.tick < s.waitUntil) return this.sapWait(b, camp, s, null);
    switch (s.stage) {
      case 'gathering': return this.sapGather(e, b, camp, s);
      case 'digging': return this.sapDigWork(e, b, camp, s);
      case 'charging': b.job = 'placing the charge'; return true;
      case 'wiring': b.job = 'laying wire'; return true;
      default: b.job = 'detonating'; return true;
    }
  },

  // Something it needs isn't to be had just now (a resource it skips a
  // while, no wood near, no way to dig yet): it waits by the fire (from
  // now, SAP_WAIT, for `why`: 'gunpowder', 'metal', 'wood' or 'a way';
  // null: it's waiting already), then tries again. True: that's its job.
  sapWait(b, camp, s, why) {
    if (why !== null) {
      s.waitUntil = this.tick + SAP_WAIT;
      s.why = why;
    }
    const job = camp.lit ? 'resting by the fire' : 'wandering';
    if (b.job !== job) {
      this.release(b);
      b.job = job;
    }
    return true;
  },

  // 'busy' (from war.js's helpers) is a job; 'stuck', it waits.
  sapBusy(b, camp, s, r, why) {
    return r === 'busy' || this.sapWait(b, camp, s, why);
  },

  // Gunpowder for the C4 (kneaded as soon as it's in hand), then metal for
  // the wire: as much as the way it means to dig wants.
  sapGather(e, b, camp, s) {
    const gathering = (b.job === 'mining' || b.job === 'gathering wood') && this.carryingOn(e, b, camp);
    const keep = b.weapon !== 0 ? AMMO_LOW : 0; // (for its gun)
    this.share(e, b, camp, 'gunpowder', keep + (SAP_C4 - this.has(b, C4)) * SAP_POWDER - this.has(b, GUNPOWDER));
    while (this.has(b, C4) < SAP_C4 && this.has(b, GUNPOWDER) - keep >= SAP_POWDER) {
      for (let k = 0; k < SAP_POWDER; k++) this.takeOut(b, GUNPOWDER);
      this.stow(b, C4);
    }
    if (this.has(b, C4) < SAP_C4) {
      if (gathering) return true;
      return this.sapBusy(b, camp, s, this.powderFor(e, b, camp, (SAP_C4 - this.has(b, C4)) * SAP_POWDER), 'gunpowder');
    }
    if (s.metal === 0) {
      const p = this.sapPlan(e, camp, s);
      if (p === null) return this.sapWait(b, camp, s, 'a way');
      let spots = p.travel;
      for (const leg of p.legs ?? this.planLegs(p.x, p.y, p.entrance, p.tx, p.ty, e.gx, e.gy)) spots += leg.n;
      const u = (p.x - camp.x) * camp.gy - (p.y - camp.y) * camp.gx;
      const lawn = this.lawn(camp), edge = lawn === null ? 0 : s.side > 0 ? lawn.u1 : -lawn.u0;
      const overland = Math.abs(Math.abs(u) - edge) + PLUNGER_U + 2;
      s.metal = Math.ceil((1.1 * spots + 1.2 * overland + 6) / WIRE_PER_METAL); // (a run of 127 spots took 133 cells)
    }
    this.share(e, b, camp, 'metal', s.metal - this.holding(b, METALS));
    if (this.holding(b, METALS) < s.metal) {
      if (gathering) return true;
      return this.sapBusy(b, camp, s, this.startMining(e, b, camp, 'metal', s.metal) ? 'busy' : 'stuck', 'metal');
    }
    s.stage = 'digging';
    s.progressAt = this.tick;
    return this.sapDigWork(e, b, camp, s);
  },

  // Lining in hand (it goes for wood when it's low, but not over and over
  // with nothing dug: wood it can't get to, say), then on with the tunnel:
  // from where it got to, or a new start.
  sapDigWork(e, b, camp, s) {
    const lining = this.liningInHand(b);
    if (lining > s.lining) s.progressAt = this.tick; // (wood fetched for it is getting on, too)
    s.lining = lining;
    if (b.job === 'tunnelling' && b.tun !== null && b.tun.sap) return true;
    if (b.job === 'gathering wood' && this.carryingOn(e, b, camp)) return true;
    if (lining < TUNNEL_LINING && (lining === 0 || s.woodTrips < WOOD_TRIES)) {
      // (Only wood nearer home than the enemy: deep under the enemy, the
      // nearest is by its camp, and it walked in among them.)
      const far = (x, y, c) => Math.max(Math.abs(x - c.x), Math.abs(y - c.y));
      if (this.gather(e, b, camp, WOOD_ONLY, SAP_WOOD_R, 'gathering wood', false, (x, y) => far(x, y, camp) < far(x, y, s.enemy))) {
        s.woodTrips++;
        return true;
      }
      if (this.liningInHand(b) === 0) return this.sapWait(b, camp, s, 'wood');
    }
    const p = this.sapPlan(e, camp, s);
    if (p === null) return this.sapWait(b, camp, s, 'a way');
    s.tx = p.tx;
    s.ty = p.ty;
    s.depth = p.depth;
    this.release(b);
    s.legsLeft = null;
    b.tun = { tx: p.tx, ty: p.ty, x: p.x, y: p.y, entrance: p.entrance, route: null, legs: null, node: null, sap: true, every: SAP_DIG_EVERY, planned: p.legs };
    b.mineKey = '';
    b.job = 'tunnelling';
    b.pace = 0;
    b.stuck = 0;
    if (b.tool !== 0) b.held = HELD_PICKAXE;
    return true;
  },

  // Where the tunnel ends: SAP_DEPTH (or `depth`) under the middle of the
  // enemy hut's floor (or its fire, with no hut). [x, y] or null.
  sapTarget(enemy, depth) {
    const hut = enemy.hut;
    const u = hut !== null ? hut.u0 + (HUT_W >> 1) : 0;
    const v = (hut !== null ? hut.floor : (this.groundAt(enemy, 0) ?? 1) - 1) + depth;
    const c = this.campCell(enemy, u, v);
    return c < 0 ? null : [c % this.w, (c / this.w) | 0];
  },

  // The way to dig: on from where the tunnel got to; or else the cheapest
  // start (travel, then digging at NEW_COST a spot) whose new run keeps
  // clear of other tunnels: a spot on its own camp's tunnels (the network
  // as reached from its entrances: miners' tunnels often run a long way
  // towards the enemy), or a new entrance on the enemy side of the camp;
  // at the first depth that has one. { x, y, entrance, travel (to get
  // there), tx, ty, depth } or null.
  sapPlan(e, camp, s) {
    const net = this.tunnels, { gx, gy } = e;
    if (net.nodes.size > 0 && (net.gx !== gx || net.gy !== gy)) return null; // dug under another gravity
    if (s.endX >= 0 && this.onNet(s.endX, s.endY) !== null) {
      const t = this.sapTarget(s.enemy, s.depth);
      // (The rest of a way round other tunnels, if it was on one.)
      const legs = s.legsLeft !== null && s.legsLeft.length > 0 ? s.legsLeft.map((l) => ({ ...l })) : null;
      if (t !== null) return { x: s.endX, y: s.endY, entrance: false, travel: 0, tx: t[0], ty: t[1], depth: s.depth, legs };
    }
    const far = (n, c) => Math.max(Math.abs(n.x - c.x), Math.abs(n.y - c.y));
    const own = new Map();
    for (const n of net.nodes.values()) {
      if (n.entrance && far(n, camp) <= OWN_R && far(n, camp) < far(n, s.enemy)) own.set(n.id, far(n, camp));
    }
    const dist = own.size > 0 ? this.netDistances(own).dist : null;
    const across = (p) => s.side * ((p.x - camp.x) * camp.gy - (p.y - camp.y) * camp.gx);
    const starts = (tx, ty) => { // the places to dig from, cheapest first
      const plans = [];
      if (dist !== null) {
        for (const ed of net.edges.values()) {
          const a = net.nodes.get(ed.a);
          for (let k = 0; k <= ed.len; k++) {
            const travel = this.costAlong(ed, k, dist);
            if (!Number.isFinite(travel)) continue;
            const x = a.x + k * ed.dx, y = a.y + k * ed.dy;
            plans.push({ cost: travel + NEW_COST * this.octo(x, y, tx, ty, gx, gy), x, y, entrance: false, travel });
          }
        }
      }
      for (const p of this.entranceSpots(e, camp, tx, ty)) {
        if (across(p) > 0) plans.push({ cost: p.cost, x: p.x, y: p.y, entrance: true, travel: across(p) });
      }
      return plans.sort((p, q) => p.cost - q.cost);
    };
    // A straight way (one or two runs) at the first depth that has one.
    for (const depth of DEPTHS) {
      const t = this.sapTarget(s.enemy, depth);
      if (t === null) continue;
      const [tx, ty] = t, plans = starts(tx, ty);
      for (let k = 0; k < plans.length && k < PLAN_TRIES; k++) {
        const p = plans[k];
        if (this.pathClear(p.x, p.y, this.planLegs(p.x, p.y, p.entrance, tx, ty, gx, gy), gx, gy)) {
          return { x: p.x, y: p.y, entrance: p.entrance, travel: p.travel, tx, ty, depth, legs: null };
        }
      }
    }
    // Else a way round them (a new entrance's shaft first, straight down).
    for (const depth of ROUND_DEPTHS) {
      const t = this.sapTarget(s.enemy, depth);
      if (t === null) continue;
      const [tx, ty] = t, plans = starts(tx, ty);
      for (let k = 0; k < plans.length && k < ROUND_TRIES; k++) {
        const p = plans[k], shaft = p.entrance ? ENTRY_DEPTH : 0;
        const bx = p.x + shaft * gx, by = p.y + shaft * gy;
        if (shaft > 0 && !this.pathClear(p.x, p.y, [{ dx: gx, dy: gy, n: shaft }], gx, gy)) continue;
        const legs = this.planAround(bx, by, tx, ty, gx, gy);
        if (legs === null) continue;
        if (shaft > 0) legs.unshift({ dx: gx, dy: gy, n: shaft });
        return { x: p.x, y: p.y, entrance: p.entrance, travel: p.travel, tx, ty, depth, legs };
      }
    }
    return null;
  },

  // Tunnelling (tunnels.js does the travel and the digging).
  sapTunnel(e, b) {
    const t = b.tun;
    if (t === null || !t.sap || !this.isSapper(e)) {
      this.endTunnel(b);
      return;
    }
    if (t.legs === null) this.tunnelGo(e, b, t);
    else this.tunnelDig(e, b, t);
  },

  // The tunnel has reached (x, y), going (dx, dy) (tunnels.js).
  sapDug(e, x, y, dx, dy) {
    const s = e.brain.camp?.sap;
    if (!s || s.id !== e.id) return;
    s.endX = x;
    s.endY = y;
    s.dx = dx;
    s.dy = dy;
    s.dug++;
    s.woodTrips = 0;
    s.legsLeft = e.brain.tun?.planned ? e.brain.tun.legs : null; // (the rest of a way round, if it's on one)
    s.progressAt = this.tick;
  },

  // At the tunnel's end (tunnels.js): on to the charge.
  sapArrived(e, b) {
    const s = b.camp?.sap;
    if (!s || s.id !== e.id) {
      this.endTunnel(b);
      return;
    }
    b.tun = null;
    s.endX = e.x;
    s.endY = e.y;
    s.stage = 'charging';
    b.job = 'placing the charge';
    b.pace = 0;
  },

  // Pack the face of the tunnel's end with C4, a cell every PLACE_EVERY
  // steps; then it's a charge, and on to the wire.
  sapCharge(e, b) {
    b.hold = true; // (on stairs or in a shaft, it would fall)
    const camp = b.camp, s = camp?.sap;
    if (!s || s.id !== e.id || s.stage !== 'charging') {
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    if (s.cells === null) s.cells = this.chargeCells(e, s);
    if (++b.pace < PLACE_EVERY) return;
    b.pace = 0;
    while (s.cells.length > 0 && this.has(b, C4) > 0) {
      const c = s.cells.shift();
      if (!this.wireOK(c)) continue;
      this.takeOut(b, C4);
      this.putDown(c, C4);
      s.placed.push(c);
      return;
    }
    if (s.placed.length === 0) {
      this.endSap(camp, true);
      return;
    }
    let x = 0, y = 0;
    for (const c of s.placed) {
      x += c % this.w;
      y += (c / this.w) | 0;
    }
    s.charge = {
      cells: s.placed.slice(), x: Math.round(x / s.placed.length), y: Math.round(y / s.placed.length),
      gx: e.gx, gy: e.gy, depth: s.depth, by: camp, wire: s.wired, blownAt: -1,
    };
    this.charges.push(s.charge);
    s.stage = 'wiring';
    b.job = 'laying wire';
    this.layWire(e, b, s);
  },

  // The cells round the face at the tunnel's end (where it stands, going
  // (s.dx, s.dy)), the farthest ahead first: where the C4 goes.
  chargeCells(e, s) {
    const { gx, gy } = e, mask = this.tunnels.mask, w = this.w;
    const cx = e.x - 2.5 * gx, cy = e.y - 2.5 * gy; // the middle of its body
    const box = this.tunnelBox;
    if (!this.boxCells(e.x, e.y, gx, gy, box)) return [];
    const spot = new Set(box); // the spot it stands in
    const out = [];
    for (let y = e.y - 9; y <= e.y + 9; y++) {
      for (let x = e.x - 9; x <= e.x + 9; x++) {
        if (!this.inBounds(x, y)) continue;
        const c = y * w + x;
        if ((mask[c] & INSIDE) !== 0 || !this.wireOK(c)) continue;
        let skin = false; // against the spot (the inside of the tunnel's end)
        for (let dy = -1; dy <= 1 && !skin; dy++) {
          for (let dx = -1; dx <= 1 && !skin; dx++) {
            if (this.inBounds(x + dx, y + dy) && spot.has((y + dy) * w + x + dx)) skin = true;
          }
        }
        if (!skin) continue;
        out.push({ c, ahead: (x - cx) * s.dx + (y - cy) * s.dy, d: Math.abs(x - cx) + Math.abs(y - cy) });
      }
    }
    out.sort((p, q) => q.ahead - p.ahead || p.d - q.d);
    return out.slice(0, SAP_C4).map((p) => p.c);
  },

  // Can a wire (or C4) be put in cell c: ground or rock (not liquid, gas,
  // fire, a creature, a wall, anything hot, dangerous or explosive, or
  // what humans built, but tunnel lining)?
  wireOK(c) {
    const t = this.type[c];
    if (t === 0 || SHAPED[t] || this.wall[c] !== 0 || DANGER[t]) return false;
    const d = DEFS[t];
    if (d.indestructible || d.state === LIQUID || d.state === GAS || d.state === ENERGY || d.explode > 0 || this.temp[c] >= 100) return false;
    return !this.madeByHuman(c) || (this.tunnels.mask[c] & LINED) !== 0;
  },

  // Walk out of the tunnel and back to the plunger's spot, laying wire as
  // it goes; there, the last of it to the plunger.
  sapWire(e, b) {
    const camp = b.camp, s = camp?.sap;
    if (!s || s.id !== e.id || s.stage !== 'wiring') {
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    if (this.leaveTunnel(e, b)) {
      this.layWire(e, b, s);
      return;
    }
    if (s.plug === null) { // (on the side of the camp it came out on)
      const u = (e.x - camp.x) * camp.gy - (e.y - camp.y) * camp.gx;
      s.plug = this.plungerSpot(camp, s, u < 0 ? -1 : 1);
    }
    const p = s.plug;
    const there = p !== null && this.walkTo(e, b, p.kx, p.ky, 0, WALK_EVERY);
    // Nowhere for the plunger by the camp (the ground there blown to
    // bits), or no way to get there: the plunger goes at the end of the
    // wire, where it is.
    if (p === null || (!there && b.job === 'wandering')) {
      this.layWire(e, b, s);
      s.plug = this.plungerHere(e, camp, s);
      if (s.plug === null) {
        this.endSap(camp, true);
        return;
      }
    } else {
      this.layWire(e, b, s);
      if (!there) return;
      this.joinWire(e, b, s, [p.plunger]);
      if (!s.wired.has(p.plunger)) s.plug = this.plungerHere(e, camp, s);
      if (s.plug === null) {
        this.endSap(camp, true);
        return;
      }
    }
    s.stage = 'firing';
    b.job = 'detonating';
    b.pace = 0;
  },

  // The plunger at the wire's end, if that's within reach of where e
  // stands (and the wire there is whole: it was never left behind), e
  // kneeling where it is. As plungerSpot, or null.
  plungerHere(e, camp, s) {
    const c = s.last;
    if (c < 0 || this.type[c] !== COPPER) return null;
    const x = c % this.w, y = (c / this.w) | 0;
    if (Math.abs(x - e.x) > 4 || Math.abs(y - e.y) > 4) return null;
    const u = (x - camp.x) * camp.gy - (y - camp.y) * camp.gx, v = (x - camp.x) * camp.gx + (y - camp.y) * camp.gy;
    const eu = (e.x - camp.x) * camp.gy - (e.y - camp.y) * camp.gx;
    return { kx: e.x, ky: e.y, plunger: c, face: u < eu ? -1 : 1, u, v, cells: this.plungerCells(camp, u, v) };
  },

  // Where the plunger over cell (u, v) of the camp's frame is drawn.
  plungerCells(camp, u, v) {
    const cells = [];
    for (let dv = 1; dv <= 4; dv++) {
      for (let du = -1; du <= 1; du++) {
        const c = this.campCell(camp, u + du, v - dv);
        if (c >= 0) cells.push(c);
      }
    }
    return cells;
  },

  // Wire to under its feet (or beside them, in a shaft), joined on to the
  // end laid so far.
  layWire(e, b, s) {
    const { gx, gy } = e, out = [], air = [];
    for (const [k, up] of [[0, -1], [-1, -1], [1, -1], [-2, 0], [2, 0], [-2, -1], [2, -1]]) {
      const x = e.x + k * gy - up * gx, y = e.y - k * gx - up * gy;
      if (!this.inBounds(x, y)) continue;
      const c = y * this.w + x, t = this.type[c];
      if (s.wired.has(c)) return; // there already
      if ((this.tunnels.mask[c] & INSIDE) !== 0) continue;
      if (this.wireOK(c)) out.push(c);
      else if (this.wall[c] === 0 && (t === 0 || DEFS[t].state === GAS)) air.push(c); // (nothing solid there: strung in the air)
    }
    if (out.length > 0 || air.length > 0) this.joinWire(e, b, s, out.length > 0 ? out : air);
  },

  // The cheapest run of wire (cells joined side to side or corner to
  // corner, never the inside of a tunnel: through the ground (what wireOK
  // allows), or, at AIR_COST a cell, strung across open air where the
  // ground has been blown away) from the end laid so far (at first, the
  // charge) to one of `targets`, within WIRE_REACH of e: laid, a cell of
  // wire per 1/WIRE_PER_METAL of a piece of metal. With no way (or no
  // metal) it's left for now.
  joinWire(e, b, s, targets) {
    const { w, type, wall } = this, mask = this.tunnels.mask;
    const want = new Set(targets.filter((c) => !s.wired.has(c)));
    if (want.size === 0) return;
    const step = (j) => {
      if ((mask[j] & INSIDE) !== 0) return -1;
      if (want.has(j) || this.wireOK(j)) return 1;
      const t = type[j];
      return wall[j] === 0 && (t === 0 || DEFS[t].state === GAS) ? AIR_COST : -1;
    };
    // (Dijkstra, with a bucket for each cost.)
    const dist = new Map(), prev = new Map(), buckets = [];
    const reach = (c, d, p) => {
      dist.set(c, d);
      prev.set(c, p);
      (buckets[d] ??= []).push(c);
    };
    for (const c of s.last >= 0 ? [s.last] : s.charge.cells) reach(c, 0, -1);
    let end = -1;
    for (let d = 0; d < buckets.length && end < 0; d++) {
      const list = buckets[d];
      if (list === undefined) continue;
      for (let i = 0; i < list.length && end < 0; i++) {
        const c = list[i];
        if (dist.get(c) !== d) continue;
        if (want.has(c)) {
          end = c;
          break;
        }
        const x = c % w, y = (c / w) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if ((dx === 0 && dy === 0) || !this.inBounds(nx, ny)) continue;
            if (Math.abs(nx - e.x) > WIRE_REACH || Math.abs(ny - e.y) > WIRE_REACH) continue;
            const j = ny * w + nx, k = step(j);
            if (k > 0 && d + k < (dist.get(j) ?? Infinity)) reach(j, d + k, c);
          }
        }
      }
    }
    if (end < 0) return;
    const run = [];
    for (let c = end; prev.get(c) !== -1; c = prev.get(c)) run.push(c);
    for (let k = run.length - 1; k >= 0; k--) {
      if (s.spool === 0) {
        if (this.takeAny(b, METALS) === 0) {
          s.short = true;
          return;
        }
        s.spool = WIRE_PER_METAL;
      }
      const c = run[k];
      s.spool--;
      this.putDown(c, COPPER);
      mask[c] &= ~LINED;
      s.wired.add(c);
      s.wire.push(c);
      s.last = c;
    }
  },

  // Where it kneels at the plunger: PLUNGER_U past the edge of its lawn on
  // the side `side` (or near there: on ground, not over a tunnel); and the
  // plunger, the wire's end, in the ground 3 cells nearer the camp (clear
  // of its body).
  // { kx, ky (where it kneels), plunger, face, u, v (the plunger's cell in
  // the camp's frame), cells (where the plunger is drawn) } or null.
  plungerSpot(camp, s, side = s.side) {
    const lawn = this.lawn(camp), mask = this.tunnels.mask;
    // Just past the lawn (the nearest such spot, out to PLUNGER_FAR more),
    // short of the tunnel's mouth (a shaft has no ground on top); or else
    // on the other side.
    for (const sd of [side, -side]) {
      const edge = lawn === null ? PLUNGER_U + 5 : sd > 0 ? lawn.u1 : -lawn.u0;
      for (let d = PLUNGER_U; d <= PLUNGER_U + PLUNGER_FAR; d++) {
        const uk = sd * (edge + d), up = uk - 3 * sd;
        const gk = this.groundAt(camp, uk), gp = this.groundAt(camp, up);
        if (gk === null || gp === null) continue;
        const k = this.campCell(camp, uk, gk - 1), p = this.campCell(camp, up, gp);
        if (k < 0 || p < 0 || (mask[k] & INSIDE) !== 0 || (mask[p] & INSIDE) !== 0) continue;
        if (!s.wired.has(p) && !this.wireOK(p)) continue;
        return { kx: k % this.w, ky: (k / this.w) | 0, plunger: p, face: -sd, u: up, v: gp, cells: this.plungerCells(camp, up, gp) };
      }
    }
    return null;
  },

  // Kneel at the plunger and push it; then wait for the bang.
  sapFire(e, b) {
    const camp = b.camp, s = camp?.sap;
    if (!s || s.id !== e.id || s.stage !== 'firing') {
      b.job = 'wandering';
      b.think = 0;
      return;
    }
    const p = s.plug;
    if (s.firedAt < 0) {
      if (!this.walkTo(e, b, p.kx, p.ky, 0, WALK_EVERY)) {
        if (b.job === 'wandering') this.endSap(camp, true);
        return;
      }
      if (e.frame !== FRAME_KNEEL || e.facing !== p.face) this.moveBody(e, e.x, e.y, FRAME_KNEEL, p.face, e.gx, e.gy);
      if (++b.pace < SAP_PRESS) return;
      if (this.type[p.plunger] !== COPPER) {
        this.endSap(camp, true);
        return;
      }
      if (this.life[p.plunger] === 0) this.sparkAt(p.plunger);
      s.firedAt = this.tick;
      return;
    }
    if (!this.charges.includes(s.charge)) this.endSap(camp, false); // (blown)
    else if (this.tick - s.firedAt > SAP_FIZZLE) this.endSap(camp, true);
  },

  // ---- charges --------------------------------------------------------------------

  // Once a step, while there are any: a charge any of whose C4 has gone
  // (gone off, most likely) is blown a few steps later (its C4 has gone off
  // by then).
  stepCharges() {
    const list = this.charges;
    for (let k = list.length - 1; k >= 0; k--) {
      const ch = list[k];
      if (ch.blownAt < 0) {
        if (ch.cells.every((c) => this.type[c] === C4)) continue;
        ch.blownAt = this.tick;
      }
      if (this.tick - ch.blownAt < BLOW_DELAY) continue;
      list.splice(k, 1);
      this.blowCharge(ch);
    }
  },

  // Craters from the charge up to where the hut's floor was over it, and
  // the camp there (if any) angered.
  blowCharge(ch) {
    const n = Math.max(2, Math.ceil(ch.depth / BLOW_STEP));
    let tx = ch.x, ty = ch.y;
    for (let k = 0; k <= n; k++) {
      tx = Math.round(ch.x - (ch.gx * ch.depth * k) / n);
      ty = Math.round(ch.y - (ch.gy * ch.depth * k) / n);
      if (this.inBounds(tx, ty)) this.crater(tx, ty, k === 0 ? BLOW_CHARGE : k === n ? BLOW_TOP : BLOW_MID);
    }
    this.angerAround(tx, ty, ch.by, ANGER_BLAST, ANGER_NEAR_R);
  },
};

