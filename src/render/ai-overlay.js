// Two looks under the hood, drawn on the canvas over the picture (menu:
// Show spheres of influence, Show AI data).
//
// Spheres of influence: for each camp, in its own colour, the square it
// gathers and mines in, the square newcomers join it from, and the one past
// which a member strikes out on its own; its hut and levelled lawn; the
// cells its humans are on their way to fetch; a line to each member; and a
// label with how it's doing. The tunnel network (shared by every camp) too.
//
// AI data: for each human, a fading trail of where it has been, the way it
// means to go (dashed) and its target (a crosshair), coloured by the kind
// of goal, with a label over its head saying what it's doing.

import {
  FUEL_R, MINE_R, CAMP_JOIN, CAMP_AWAY_R, HUT_W, HUT_WALL, GATHER,
} from '../sim/humans.js';
import { DEFS } from '../sim/elements.js';

export const CAMP_COLORS = ['#f6c344', '#5ec8f2', '#f2708e', '#8be06a', '#c38bf2', '#f29a4b'];

// The kinds of goal, by job: [kind, colour].
const GOAL = {
  'gathering wood': ['gather', '#6fdc6f'],
  'fetching stone': ['gather', '#6fdc6f'],
  'carrying wood': ['gather', '#6fdc6f'],
  'lighting the fire': ['build', '#f5a142'],
  'building the hut': ['build', '#f5a142'],
  'flattening the camp': ['build', '#f5a142'],
  mining: ['mine', '#e8c547'],
  shooting: ['fight', '#ff4d4d'],
  hunting: ['fight', '#ff4d4d'],
  fleeing: ['flee', '#ff5fd2'],
  'resting by the fire': ['rest', '#6fa8ff'],
  sheltering: ['rest', '#6fa8ff'],
  swimming: ['swim', '#4fd1c5'],
};
const WANDER = ['wander', '#a7adb8'];

// The kind of goal a job is, and its colour: { kind, color }.
export function goalOf(job) {
  const [kind, color] = GOAL[job] ?? WANDER;
  return { kind, color };
}

// A stable number for each camp (1, 2, ...), for its colour and label.
const campIds = new WeakMap();
let nextCampId = 1;
export function campNumber(camp) {
  if (!campIds.has(camp)) campIds.set(camp, nextCampId++);
  return campIds.get(camp);
}
export const campColor = (camp) => CAMP_COLORS[(campNumber(camp) - 1) % CAMP_COLORS.length];

const cellXY = (world, c) => [c % world.w, (c / world.w) | 0];

// The route a tunnel plan still has to take, from (x, y): through the
// network's waypoints to its start, then along the legs it will dig.
function tunnelPath(world, e, t) {
  const pts = [[e.x, e.y]];
  const walk = (x, y, legs) => {
    for (const leg of legs) {
      x += leg.dx * leg.n;
      y += leg.dy * leg.n;
      pts.push([x, y]);
    }
  };
  if (t.legs !== null) {
    walk(e.x, e.y, t.legs);
    return pts;
  }
  if (t.route !== null && t.route !== undefined) for (const p of t.route.wps) pts.push([p.x, p.y]);
  pts.push([t.x, t.y]);
  walk(t.x, t.y, world.planLegs(t.x, t.y, t.entrance, t.tx, t.ty, e.gx, e.gy));
  return pts;
}

// What human e is up to: { kind, color, label, target: [x, y] or null,
// path: [[x, y], ...] (from where it is), arrow: [dx, dy] or null }.
export function aiPlan(world, e) {
  const b = e.brain, camp = b.camp;
  const job = b.job === 'swimming' ? b.wasJob : b.job;
  const { kind, color } = goalOf(b.job);
  let target = null, path = null, arrow = null, detail = '';
  const at = (c) => (c >= 0 ? cellXY(world, c) : null);
  switch (job) {
    case 'gathering wood':
    case 'fetching stone':
    case 'flattening the camp':
      target = at(b.target);
      if (b.fetchSet) detail = `${world.holding(b, b.fetchSet)}/${GATHER}`;
      break;
    case 'carrying wood':
    case 'lighting the fire':
      if (camp) target = [camp.x, camp.y];
      break;
    case 'resting by the fire':
      if (camp) target = at(world.restSpot(e, camp));
      break;
    case 'building the hut':
      if (camp?.hut) {
        const k = world.nextHutCell(camp.hut);
        if (k >= 0) target = at(camp.hut.cells[k]);
        detail = `${camp.hut.cells.filter((c) => !world.builtAt(c)).length} to go`;
      }
      break;
    case 'sheltering':
      if (camp?.hut) target = at(world.campCell(camp, camp.hut.u0 + (HUT_W >> 1), camp.hut.floor));
      break;
    case 'mining':
      if (b.tun) {
        target = [b.tun.tx, b.tun.ty];
        path = tunnelPath(world, e, b.tun);
        detail = `${b.mineKey} ${world.holding(b, b.fetchSet ?? new Uint8Array(1))}/${b.wantN}`;
        if (b.tun.legs === null) detail += b.tun.entrance ? ', to a new entrance' : ', through the tunnels';
      }
      break;
    case 'shooting':
    case 'hunting': {
      const o = world.creatureById[b.foe];
      if (o) {
        target = [o.x - 2 * o.gx, o.y - 2 * o.gy];
        detail = DEFS[o.kind].name.toLowerCase();
      }
      break;
    }
    case 'fleeing':
      arrow = [b.fleeDir * e.gy, -b.fleeDir * e.gx];
      break;
    default:
      if (b.goalX >= 0) target = [b.goalX, b.goalY];
  }
  if (path === null && target !== null) path = [[e.x, e.y], target];
  const extra = [];
  if (b.job === 'swimming') extra.push('swimming');
  if (b.climbing && !world.supported(e)) extra.push('climbing'); // on a wall now (the flag outlives the climb)
  if (b.stuck > 60) extra.push(`stuck ${b.stuck}`);
  const label = [b.job === 'swimming' ? job : b.job, detail].filter(Boolean).join(' ') + (extra.length ? ` (${extra.join(', ')})` : '');
  return { kind, color, label, target, path, arrow };
}

// A camp's state, for its label: "Camp 1 · 3 humans · fire 3200 · hut ✓ ·
// level ✓ · 1 away".
export function campLabel(world, camp) {
  const away = [...camp.members].filter((id) => {
    const o = world.creatureById[id];
    return o && Math.max(Math.abs(o.x - camp.x), Math.abs(o.y - camp.y)) > CAMP_AWAY_R;
  }).length;
  const n = camp.members.size;
  const hut = camp.noHut ? 'no hut' : camp.hut === null ? 'no hut yet' : camp.hut.done ? 'hut ✓' : 'hut …';
  const parts = [`Camp ${campNumber(camp)}`, `${n} human${n === 1 ? '' : 's'}`,
    camp.lit ? `fire ${camp.burned}` : 'no fire yet', hut];
  if (camp.hut?.done) parts.push(camp.flat ? 'level ✓' : 'level …');
  if (away > 0) parts.push(`${away} away`);
  return parts.join(' · ');
}

// Trails: where each human has been lately, sampled every few frames.
const TRAIL_EVERY = 4, TRAIL_LEN = 120;
export class AITrails {
  constructor() {
    this.paths = new Map(); // creature id -> [[x, y], ...], oldest first
    this.tick = 0;
  }

  record(world) {
    if (this.tick++ % TRAIL_EVERY !== 0) return;
    const seen = new Set();
    for (const e of world.creatures) {
      if (e.brain === null || e.brain === undefined) continue;
      seen.add(e.id);
      let p = this.paths.get(e.id);
      if (!p) this.paths.set(e.id, (p = []));
      const last = p[p.length - 1];
      if (!last || last[0] !== e.x || last[1] !== e.y) p.push([e.x, e.y]);
      if (p.length > TRAIL_LEN) p.shift();
    }
    for (const id of this.paths.keys()) if (!seen.has(id)) this.paths.delete(id);
  }
}

// From cells to canvas pixels: { px(x), py(y), s (pixels a cell), font }.
export function viewOf(canvas, cam) {
  const sx = canvas.width / cam.vw, sy = canvas.height / cam.vh;
  return {
    px: (x) => (x + 0.5 - cam.x) * sx,
    py: (y) => (y + 0.5 - cam.y) * sy,
    sx, sy,
    line: Math.max(1, Math.round(canvas.width / 900)),
    font: Math.max(11, Math.round(canvas.width / 120)),
    placed: [], // labels drawn so far this frame: [x0, y0, x1, y1]
  };
}

// A label on a dark tab, centred over (x, y), moved up clear of the labels
// already drawn (humans standing together, say).
function label(ctx, v, text, x, y, color) {
  ctx.font = `600 ${v.font}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const w = ctx.measureText(text).width, pad = v.font * 0.3, h = v.font + pad * 1.4;
  const hits = (y0) => v.placed.some(([a, b, c, d]) => x - w / 2 - pad < c && x + w / 2 + pad > a && y0 < d && y0 + h > b);
  for (let k = 0; k < 20 && hits(y - v.font - pad); k++) y -= h + 2;
  v.placed.push([x - w / 2 - pad, y - v.font - pad, x + w / 2 + pad, y - v.font - pad + h]);
  ctx.fillStyle = 'rgba(12, 14, 20, 0.72)';
  ctx.fillRect(x - w / 2 - pad, y - v.font - pad, w + 2 * pad, h);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// A square of "radius" r (cells, as the game measures: the larger of the
// two distances) round (x, y), with its name at the top.
function rangeSquare(ctx, v, x, y, r, color, dash, name) {
  ctx.setLineDash(dash.map((d) => d * v.line));
  ctx.strokeStyle = color;
  ctx.strokeRect(v.px(x - r - 0.5), v.py(y - r - 0.5), (2 * r + 1) * v.sx, (2 * r + 1) * v.sy);
  ctx.setLineDash([]);
  ctx.font = `${Math.round(v.font * 0.85)}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.fillText(name, v.px(x - r) + 3 * v.line, v.py(y - r) + 2 * v.line);
}

export function drawInfluence(ctx, world, v) {
  ctx.save();
  ctx.lineWidth = v.line;
  // The tunnel network, shared by every camp.
  const net = world.tunnels;
  if (net && net.edges.size > 0) {
    ctx.strokeStyle = 'rgba(232, 197, 71, 0.85)';
    ctx.lineWidth = v.line * 2;
    ctx.beginPath();
    for (const ed of net.edges.values()) {
      const a = net.nodes.get(ed.a), b = net.nodes.get(ed.b);
      if (!a || !b) continue;
      ctx.moveTo(v.px(a.x), v.py(a.y));
      ctx.lineTo(v.px(b.x), v.py(b.y));
    }
    ctx.stroke();
    ctx.lineWidth = v.line;
    for (const n of net.nodes.values()) {
      const r = (n.entrance ? 3 : 1.5) * v.line + v.sx * (n.entrance ? 0.8 : 0.3);
      ctx.fillStyle = n.entrance ? '#ffe28a' : 'rgba(232, 197, 71, 0.9)';
      ctx.fillRect(v.px(n.x) - r, v.py(n.y) - r, 2 * r, 2 * r);
    }
  }
  for (const camp of world.camps) {
    const color = campColor(camp);
    ctx.globalAlpha = 0.9;
    rangeSquare(ctx, v, camp.x, camp.y, Math.max(FUEL_R, MINE_R), color, [], `gathers and mines (${Math.max(FUEL_R, MINE_R)})`);
    rangeSquare(ctx, v, camp.x, camp.y, CAMP_JOIN, color, [6, 4], `newcomers join (${CAMP_JOIN})`);
    rangeSquare(ctx, v, camp.x, camp.y, CAMP_AWAY_R, color, [2, 5], `strays leave past (${CAMP_AWAY_R})`);
    ctx.globalAlpha = 1;
    // Its hut and lawn.
    const hut = camp.hut;
    if (hut) {
      const corner = (u, vv) => cellXY(world, world.campCell(camp, u, vv));
      const [ax, ay] = corner(hut.u0, hut.floor - HUT_WALL), [bx, by] = corner(hut.u0 + HUT_W - 1, hut.floor);
      ctx.strokeStyle = color;
      ctx.lineWidth = v.line * 2;
      ctx.setLineDash(hut.done ? [] : [4 * v.line, 3 * v.line]);
      ctx.strokeRect(v.px(Math.min(ax, bx) - 0.5), v.py(Math.min(ay, by) - 0.5),
        (Math.abs(bx - ax) + 1) * v.sx, (Math.abs(by - ay) + 1) * v.sy);
      ctx.setLineDash([]);
      const l = world.lawn(camp);
      if (l) {
        const [lx0, ly0] = corner(l.u0, l.level), [lx1, ly1] = corner(l.u1, l.level);
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = Math.max(v.line * 3, v.sy * 0.8);
        ctx.beginPath();
        ctx.moveTo(v.px(lx0), v.py(ly0));
        ctx.lineTo(v.px(lx1), v.py(ly1));
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.lineWidth = v.line;
    }
    // Cells claimed: someone's on the way.
    ctx.strokeStyle = color;
    for (const c of camp.claims) {
      const [x, y] = cellXY(world, c), r = Math.max(2 * v.line, v.sx * 0.6);
      ctx.beginPath();
      ctx.moveTo(v.px(x) - r, v.py(y) - r); ctx.lineTo(v.px(x) + r, v.py(y) + r);
      ctx.moveTo(v.px(x) + r, v.py(y) - r); ctx.lineTo(v.px(x) - r, v.py(y) + r);
      ctx.stroke();
    }
    // A line to each member (dashed red when it's strayed past the limit).
    for (const id of camp.members) {
      const o = world.creatureById[id];
      if (!o) continue;
      const far = Math.max(Math.abs(o.x - camp.x), Math.abs(o.y - camp.y)) > CAMP_AWAY_R;
      ctx.strokeStyle = far ? '#ff4d4d' : color;
      ctx.setLineDash(far ? [4 * v.line, 3 * v.line] : []);
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(v.px(camp.x), v.py(camp.y));
      ctx.lineTo(v.px(o.x - 3 * o.gx), v.py(o.y - 3 * o.gy));
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }
    ctx.fillStyle = color;
    const r = Math.max(3 * v.line, v.sx);
    ctx.beginPath();
    ctx.arc(v.px(camp.x), v.py(camp.y), r, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, v, campLabel(world, camp), v.px(camp.x - 16 * camp.gx), v.py(camp.y - 16 * camp.gy), color);
  }
  ctx.restore();
}

export function drawAI(ctx, world, v, trails) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const e of world.creatures) {
    if (!e.brain) continue;
    const plan = aiPlan(world, e);
    // Where it's been: fading with age.
    const trail = trails?.paths.get(e.id);
    if (trail && trail.length > 1) {
      ctx.strokeStyle = plan.color;
      ctx.lineWidth = v.line * 2;
      for (let k = 1; k < trail.length; k++) {
        ctx.globalAlpha = 0.08 + 0.5 * (k / trail.length);
        ctx.beginPath();
        ctx.moveTo(v.px(trail[k - 1][0]), v.py(trail[k - 1][1]));
        ctx.lineTo(v.px(trail[k][0]), v.py(trail[k][1]));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // Where it means to go.
    if (plan.path && plan.path.length > 1) {
      ctx.strokeStyle = plan.color;
      ctx.lineWidth = v.line * 2;
      ctx.setLineDash([5 * v.line, 4 * v.line]);
      ctx.beginPath();
      ctx.moveTo(v.px(plan.path[0][0]), v.py(plan.path[0][1]));
      for (const [x, y] of plan.path.slice(1)) ctx.lineTo(v.px(x), v.py(y));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (plan.target) {
      const [x, y] = plan.target, r = Math.max(4 * v.line, v.sx * 1.5);
      ctx.strokeStyle = plan.color;
      ctx.lineWidth = v.line * 2;
      ctx.beginPath();
      ctx.arc(v.px(x), v.py(y), r, 0, Math.PI * 2);
      ctx.moveTo(v.px(x) - r * 1.6, v.py(y)); ctx.lineTo(v.px(x) + r * 1.6, v.py(y));
      ctx.moveTo(v.px(x), v.py(y) - r * 1.6); ctx.lineTo(v.px(x), v.py(y) + r * 1.6);
      ctx.stroke();
    }
    if (plan.arrow) {
      const [dx, dy] = plan.arrow, len = 10;
      const x0 = v.px(e.x - 3 * e.gx), y0 = v.py(e.y - 3 * e.gy);
      const x1 = v.px(e.x - 3 * e.gx + dx * len), y1 = v.py(e.y - 3 * e.gy + dy * len);
      const a = Math.atan2(y1 - y0, x1 - x0), h = Math.max(6 * v.line, v.sx * 2);
      ctx.strokeStyle = plan.color;
      ctx.lineWidth = v.line * 3;
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.lineTo(x1 - h * Math.cos(a - 0.5), y1 - h * Math.sin(a - 0.5));
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - h * Math.cos(a + 0.5), y1 - h * Math.sin(a + 0.5));
      ctx.stroke();
    }
    label(ctx, v, plan.label, v.px(e.x - 8 * e.gx), v.py(e.y - 8 * e.gy), plan.color);
  }
  ctx.restore();
}
