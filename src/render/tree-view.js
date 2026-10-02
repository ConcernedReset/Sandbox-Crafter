// Draws the recipe tree (laid out by src/game/tree.js) on its own canvas
// under the game. Drag to move it around; Ctrl-scroll, a trackpad pinch or a
// two-finger pinch zooms at the pointer; click a node to pick it. It only
// redraws when something has changed.
//
// The view is { zoom, x, y }: (x, y) is the tree point at the canvas's
// top-left corner, and one tree unit is `zoom` CSS pixels.

import { DEFS } from '../sim/elements.js';
import { NODE_W, NODE_H, JOIN } from '../game/tree.js';

const MIN_ZOOM = 0.06;
const MAX_ZOOM = 2;
const TEXT_ZOOM = 0.35; // below this, nodes are drawn as plain boxes
const SLOP = 5; // pixels a press can move and still count as a click
const KEEP = 60; // pixels of the tree kept in view however far it's dragged
const FLASH_MS = 1600;

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// The page's colours and fonts, from its CSS custom properties.
function readTheme() {
  const s = getComputedStyle(document.documentElement);
  const v = (name) => s.getPropertyValue(name).trim();
  const cat = {};
  for (const d of DEFS) if (d.cat && !(d.cat in cat)) cat[d.cat] = v(`--cat-${d.cat}`);
  return {
    bg: v('--chamber'), panel: v('--panel'), panel2: v('--panel-2'),
    line: v('--line'), lineStrong: v('--line-strong'),
    text: v('--text'), muted: v('--muted'), faint: v('--faint'), brass: v('--brass'),
    link: rgba(v('--muted'), 0.55),
    display: v('--font-display'), ui: v('--font-ui'), mono: v('--font-mono'),
    cat,
  };
}

// Shorten text with an ellipsis until it fits in `width`.
function fitText(ctx, s, width) {
  if (ctx.measureText(s).width <= width) return s;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > width) s = s.slice(0, -1);
  return `${s}…`;
}

export class TreeView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.theme = readTheme();
    this.looks = new Map(); // element id -> colours and fitted name (see look)
    this.nodes = [];
    this.links = [];
    this.at = new Map();
    this.zoom = 1;
    this.x = 0;
    this.y = 0;
    this.w = 0; // canvas size in CSS pixels
    this.h = 0;
    this.dpr = 1;
    this.placed = false; // has the view been put somewhere sensible yet?
    this.hover = null; // element ids
    this.picked = null;
    this.flashes = new Map(); // element id -> when its flash started
    this.onPick = null; // called with the clicked node, or null for empty space
    this.dirty = true;
    this.press = null; // { x, y, moved } while the pointer is down
    this.touches = new Map();
    this.pinch = null;

    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e, false));
    canvas.addEventListener('pointercancel', (e) => this.up(e, true));
    canvas.addEventListener('pointerleave', () => { if (!this.press) this.setHover(null); });
    canvas.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return; // plain scrolling scrolls the page
      e.preventDefault();
      const p = this.point(e);
      const d = Math.max(-25, Math.min(25, e.deltaY));
      this.zoomAt(this.zoom * Math.exp(-d * 0.01), p.x, p.y);
    }, { passive: false });
    // The fonts may arrive after the first drawing; names are refitted then.
    document.fonts?.ready.then(() => {
      this.looks.clear();
      this.dirty = true;
    });
  }

  // Show a new tree, keeping the view where it is. `flash` lists elements
  // to draw attention to (new discoveries).
  setTree(tree, flash = []) {
    this.nodes = tree.nodes;
    this.links = tree.links;
    this.at = new Map(tree.nodes.map((n) => [n.id, n]));
    const now = performance.now();
    for (const id of flash) if (this.at.has(id)) this.flashes.set(id, now);
    if (!this.at.has(this.hover)) this.hover = null;
    if (!this.at.has(this.picked)) this.picked = null;
    if (!this.placed && this.w) this.home();
    this.clamp();
    this.dirty = true;
  }

  node(id) {
    return this.at.get(id) ?? null;
  }

  select(id) {
    this.picked = id;
    this.dirty = true;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.dpr = window.devicePixelRatio || 1;
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    if (!this.placed && this.nodes.length) this.home();
    this.clamp();
    this.dirty = true;
  }

  // ---- the view ----------------------------------------------------------

  // Full size, with the starting elements at the left edge.
  home() {
    this.zoom = 1;
    this.x = -NODE_W / 2 - 24;
    this.y = -this.h / 2;
    this.placed = true;
    this.dirty = true;
  }

  // The whole tree, as large as fits (up to full size).
  fit() {
    const b = this.bounds();
    const pad = 24;
    const z = Math.min((this.w - pad * 2) / (b.x1 - b.x0), (this.h - pad * 2) / (b.y1 - b.y0), 1);
    this.zoom = Math.max(MIN_ZOOM, z);
    this.x = (b.x0 + b.x1) / 2 - this.w / 2 / this.zoom;
    this.y = (b.y0 + b.y1) / 2 - this.h / 2 / this.zoom;
    this.clamp();
    this.dirty = true;
  }

  // Show a node: the whole tree if that fits at a readable size, otherwise
  // the node in the middle at that size.
  frame(id) {
    const n = this.at.get(id);
    if (!n || !this.w) return;
    const b = this.bounds();
    const pad = 24;
    const z = Math.min((this.w - pad * 2) / (b.x1 - b.x0), (this.h - pad * 2) / (b.y1 - b.y0), 1);
    this.zoom = Math.max(0.5, z);
    const cx = z >= 0.5 ? (b.x0 + b.x1) / 2 : n.x;
    const cy = z >= 0.5 ? (b.y0 + b.y1) / 2 : n.y;
    this.x = cx - this.w / 2 / this.zoom;
    this.y = cy - this.h / 2 / this.zoom;
    this.placed = true;
    this.clamp();
    this.dirty = true;
  }

  // Move the view so a node is in the middle, at the current zoom.
  centerOn(id) {
    const n = this.at.get(id);
    if (!n || !this.w) return;
    this.x = n.x - this.w / 2 / this.zoom;
    this.y = n.y - this.h / 2 / this.zoom;
    this.clamp();
    this.dirty = true;
  }

  zoomBy(dir) {
    this.zoomAt(this.zoom * (dir > 0 ? 1.25 : 0.8));
  }

  // Zoom to z, keeping the tree point under (sx, sy) where it is.
  zoomAt(z, sx = this.w / 2, sy = this.h / 2) {
    z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    const tx = this.x + sx / this.zoom, ty = this.y + sy / this.zoom;
    this.zoom = z;
    this.x = tx - sx / z;
    this.y = ty - sy / z;
    this.clamp();
    this.dirty = true;
  }

  bounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of this.nodes) {
      x0 = Math.min(x0, n.x - NODE_W / 2 - JOIN);
      x1 = Math.max(x1, n.x + NODE_W / 2);
      y0 = Math.min(y0, n.y - NODE_H / 2);
      y1 = Math.max(y1, n.y + NODE_H / 2);
    }
    return { x0, y0, x1, y1 };
  }

  // Don't let the tree be dragged right out of sight.
  clamp() {
    if (!this.nodes.length || !this.w) return;
    const b = this.bounds();
    const k = KEEP / this.zoom, vw = this.w / this.zoom, vh = this.h / this.zoom;
    this.x = Math.min(Math.max(this.x, b.x0 - vw + k), b.x1 - k);
    this.y = Math.min(Math.max(this.y, b.y0 - vh + k), b.y1 - k);
  }

  // ---- pointer -----------------------------------------------------------

  point(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  nodeAt(sx, sy) {
    const tx = this.x + sx / this.zoom, ty = this.y + sy / this.zoom;
    for (const n of this.nodes) {
      if (Math.abs(tx - n.x) <= NODE_W / 2 && Math.abs(ty - n.y) <= NODE_H / 2) return n;
    }
    return null;
  }

  setHover(id) {
    if (id === this.hover) return;
    this.hover = id;
    this.canvas.classList.toggle('over-node', id !== null);
    this.dirty = true;
  }

  down(e) {
    const p = this.point(e);
    this.canvas.setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, p);
      if (this.touches.size === 2) { this.startPinch(); return; }
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.press = { x: p.x, y: p.y, moved: false };
  }

  move(e) {
    const p = this.point(e);
    if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, p);
    if (this.pinch) { this.movePinch(); return; }
    if (this.press) {
      const dx = p.x - this.press.x, dy = p.y - this.press.y;
      if (!this.press.moved && Math.hypot(dx, dy) < SLOP) return;
      if (!this.press.moved) {
        this.press.moved = true;
        this.canvas.classList.add('dragging');
        this.setHover(null);
      }
      this.x -= dx / this.zoom;
      this.y -= dy / this.zoom;
      this.press.x = p.x;
      this.press.y = p.y;
      this.clamp();
      this.dirty = true;
      return;
    }
    if (e.pointerType === 'mouse') this.setHover(this.nodeAt(p.x, p.y)?.id ?? null);
  }

  up(e, cancelled) {
    this.touches.delete(e.pointerId);
    if (this.pinch) {
      // Lifting a finger ends the pinch; the other one doesn't start a drag.
      if (this.touches.size < 2) this.pinch = null;
      this.press = null;
      return;
    }
    const press = this.press;
    this.press = null;
    this.canvas.classList.remove('dragging');
    if (!press || press.moved || cancelled) return;
    const p = this.point(e);
    if (this.onPick) this.onPick(this.nodeAt(p.x, p.y));
  }

  startPinch() {
    this.press = null;
    const [a, b] = [...this.touches.values()];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    this.pinch = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      zoom: this.zoom,
      tx: this.x + mx / this.zoom,
      ty: this.y + my / this.zoom,
    };
  }

  // Keep the tree point first pinched under the fingers as they spread and move.
  movePinch() {
    const [a, b] = [...this.touches.values()];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const p = this.pinch;
    const z = p.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, p.dist));
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    this.x = p.tx - mx / this.zoom;
    this.y = p.ty - my / this.zoom;
    this.clamp();
    this.dirty = true;
  }

  // ---- drawing -----------------------------------------------------------

  draw(now) {
    if (this.flashes.size) {
      for (const [id, t] of this.flashes) if (now - t > FLASH_MS) this.flashes.delete(id);
      this.dirty = true;
    }
    if (!this.dirty || !this.w) return;
    this.dirty = false;
    const { ctx, zoom, dpr, theme: c } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -this.x * zoom * dpr, -this.y * zoom * dpr);
    const view = {
      x0: this.x - NODE_W, y0: this.y - NODE_H,
      x1: this.x + this.w / zoom + NODE_W, y1: this.y + this.h / zoom + NODE_H,
    };
    // Connections are drawn a batch at a time; those to and from the node
    // under the pointer (or the picked one) go last, on top, in brass.
    const lit = this.hover ?? this.picked;
    const known = [], unknown = [], hot = [];
    for (const l of this.links) {
      if (!this.linkInView(l, view)) continue;
      if (lit !== null && (l.output === lit || l.inputs.includes(lit))) hot.push(l);
      else (this.at.get(l.output).known ? known : unknown).push(l);
    }
    this.drawLinks(known, c.link, c.muted, 1.25, null);
    this.drawLinks(unknown, c.lineStrong, c.faint, 1.25, [5, 4]);
    this.drawLinks(hot, c.brass, c.brass, 2.5, null);
    for (const n of this.nodes) {
      if (n.x < view.x0 || n.x > view.x1 || n.y < view.y0 || n.y > view.y1) continue;
      this.drawNode(n, now);
    }
  }

  linkInView(l, view) {
    const o = this.at.get(l.output);
    let x0 = o.x - NODE_W / 2 - JOIN, y0 = o.y, y1 = o.y;
    for (const i of l.inputs) {
      const n = this.at.get(i);
      if (n.x < x0) x0 = n.x;
      if (n.y < y0) y0 = n.y;
      if (n.y > y1) y1 = n.y;
    }
    return o.x > view.x0 && x0 < view.x1 && y1 > view.y0 && y0 < view.y1;
  }

  // Lines from each ingredient curve into a join point just left of the
  // product, then run straight into it, with the process written underneath.
  drawLinks(list, color, textColor, width, dash) {
    if (!list.length) return;
    const { ctx, zoom } = this;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(width, 1 / zoom);
    ctx.setLineDash(dash ?? []);
    ctx.beginPath();
    for (const l of list) {
      const o = this.at.get(l.output);
      const ex = o.x - NODE_W / 2, jx = ex - JOIN, y = o.y;
      for (const i of l.inputs) {
        const n = this.at.get(i);
        const sx = n.x + NODE_W / 2, sy = n.y;
        const bend = Math.max(24, (jx - sx) * 0.5);
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(sx + bend, sy, jx - bend, y, jx, y);
      }
      ctx.moveTo(jx, y);
      ctx.lineTo(ex - 6, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Arrowheads into the products, and a dot where two ingredients meet.
    ctx.beginPath();
    for (const l of list) {
      const o = this.at.get(l.output);
      const ex = o.x - NODE_W / 2, jx = ex - JOIN, y = o.y;
      ctx.moveTo(ex, y);
      ctx.lineTo(ex - 8, y - 4.5);
      ctx.lineTo(ex - 8, y + 4.5);
      ctx.closePath();
      if (l.inputs.length > 1) {
        ctx.moveTo(jx + 3, y);
        ctx.arc(jx, y, 3, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    if (zoom < TEXT_ZOOM) return;
    ctx.font = `500 10.5px ${this.theme.mono}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = textColor;
    for (const l of list) {
      const o = this.at.get(l.output);
      ctx.fillText(l.label, o.x - NODE_W / 2 - JOIN / 2, o.y + 5);
    }
  }

  // Colours and the fitted name for each element, worked out once.
  look(d) {
    let s = this.looks.get(d.id);
    if (s) return s;
    const cat = this.theme.cat[d.cat] || this.theme.lineStrong;
    this.ctx.font = `500 12.5px ${this.theme.ui}`;
    s = {
      cat,
      edge: rgba(cat, 0.45),
      wash: rgba(d.colors[0], 0.2),
      symFont: `700 ${d.sym.length > 2 ? 12 : 15}px ${this.theme.display}`,
      name: fitText(this.ctx, d.name, NODE_W - 50),
    };
    this.looks.set(d.id, s);
    return s;
  }

  drawNode(n, now) {
    const { ctx, theme: c, zoom } = this;
    const d = DEFS[n.id];
    const x = n.x - NODE_W / 2, y = n.y - NODE_H / 2;
    const lit = n.id === this.picked || n.id === this.hover;
    // In a focused tree, the other ingredients of its products stand back.
    ctx.globalAlpha = n.role === 'partner' && !lit ? 0.6 : 1;
    ctx.beginPath();
    ctx.roundRect(x, y, NODE_W, NODE_H, 7);
    if (n.face === 'blank') {
      // Hard mode: something found, with nothing to say what.
      ctx.fillStyle = c.panel2;
      ctx.fill();
      ctx.strokeStyle = lit ? c.brass : c.lineStrong;
      ctx.lineWidth = Math.max(lit ? 2 : 1, 1 / zoom);
      ctx.stroke();
    } else if (n.face === 'name') {
      // A wash of the element's own colour and a stripe of its category's,
      // like the palette tiles. Dashed if it hasn't been made yet (hard mode).
      const s = this.look(d);
      ctx.fillStyle = c.panel2;
      ctx.fill();
      ctx.fillStyle = s.wash;
      ctx.fill();
      ctx.fillStyle = s.cat;
      ctx.fillRect(x, y + 6, 3, NODE_H - 12);
      if (!n.known) ctx.setLineDash([4, 3]);
      ctx.strokeStyle = lit ? c.brass : n.known ? s.edge : s.cat;
      ctx.lineWidth = Math.max(lit ? 2 : 1, 1 / zoom);
      ctx.stroke();
      ctx.setLineDash([]);
      if (zoom >= TEXT_ZOOM) {
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillStyle = c.text;
        ctx.font = s.symFont;
        ctx.fillText(d.sym, x + 22, n.y + 1);
        ctx.textAlign = 'left';
        ctx.font = `500 12.5px ${c.ui}`;
        ctx.fillText(s.name, x + 42, n.y + 1);
      }
    } else {
      ctx.fillStyle = c.panel;
      ctx.fill();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = lit ? c.brass : c.lineStrong;
      ctx.lineWidth = Math.max(lit ? 2 : 1, 1 / zoom);
      ctx.stroke();
      ctx.setLineDash([]);
      if (zoom >= TEXT_ZOOM) {
        ctx.fillStyle = lit ? c.brass : c.muted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 17px ${c.display}`;
        ctx.fillText('?', n.x, n.y + 1);
      }
    }
    ctx.globalAlpha = 1;
    const t = this.flashes.get(n.id);
    if (t !== undefined) { // a ring spreading out from a new discovery
      const f = Math.min(1, (now - t) / FLASH_MS);
      const g = 3 + f * 16;
      ctx.strokeStyle = rgba(c.brass, 1 - f);
      ctx.lineWidth = Math.max(2, 1.5 / zoom);
      ctx.beginPath();
      ctx.roundRect(x - g, y - g, NODE_W + 2 * g, NODE_H + 2 * g, 7 + g);
      ctx.stroke();
    }
  }
}
