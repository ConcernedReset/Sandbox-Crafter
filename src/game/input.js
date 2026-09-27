// Mouse, touch and pen input on the world canvas. Strokes are interpolated
// between pointer events so fast drags leave a continuous line, and the
// selected tool keeps acting every frame while the pointer is held down.
// Holding Shift while dragging draws a straight line, and Ctrl (or Cmd) a
// filled box; both are only applied when the button is released.
//
// The view zooms with Ctrl-scroll (a trackpad pinch sends the same thing) or
// a two-finger pinch on a touch screen, and pans with a middle-button drag
// or by moving both fingers. See camera.js.

import { DEFS, ID, State } from '../sim/elements.js';

export const HEAT_RATE = 30; // °C per frame under the brush
export const PRESSURE_RATE = 2; // pressure units per frame under the brush
const WIND_STRENGTH = 0.6;

// How densely each kind of element is sprinkled by the brush.
const DENSITY = {
  [State.POWDER]: 0.5,
  [State.LIQUID]: 0.7,
  [State.GAS]: 0.5,
  [State.ENERGY]: 0.6,
  [State.SOLID]: 1,
};

export const TOOLS = ['erase', 'wall', 'heat', 'cool', 'wind', 'pressure', 'vacuum'];
export const MAX_BRUSH = 72;

export class Input {
  constructor(canvas, getWorld, state, camera) {
    this.canvas = canvas;
    this.getWorld = getWorld;
    this.state = state; // { selection: {kind, id}, brush }
    this.camera = camera;
    this.down = false;
    this.erasing = false;
    this.over = false;
    this.x = 0;
    this.y = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.shape = null; // { kind: 'line' | 'box', x0, y0, erase } while Shift/Ctrl-dragging
    this.onHover = null;
    this.clientX = 0; // where the pointer last was, in page pixels
    this.clientY = 0;
    this.touches = new Map(); // fingers on the screen, for pinching
    this.pinch = null;
    this.panning = null; // a middle-button drag

    canvas.addEventListener('pointerdown', (e) => this.pointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.pointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.pointerUp(e));
    canvas.addEventListener('pointercancel', (e) => this.pointerUp(e));
    canvas.addEventListener('pointerleave', () => { this.over = false; this.hover(); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // no autoscroll
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) { // Ctrl-scroll or a trackpad pinch zooms at the pointer
        const { fx, fy } = this.fraction(e.clientX, e.clientY);
        const d = Math.max(-25, Math.min(25, e.deltaY));
        this.camera.zoomTo(this.camera.zoom * Math.exp(-d * 0.01), fx, fy);
        this.toCell(e);
        this.hover();
        return;
      }
      this.state.setBrush(this.state.brush + (e.deltaY < 0 ? 1 : -1));
    }, { passive: false });
  }

  // How far across and down the view a point on the page is (0..1).
  fraction(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return { fx: (clientX - rect.left) / rect.width, fy: (clientY - rect.top) / rect.height };
  }

  toCell(e) {
    this.clientX = e.clientX;
    this.clientY = e.clientY;
    this.locate();
  }

  locate() {
    const { fx, fy } = this.fraction(this.clientX, this.clientY);
    const c = this.camera.cellAt(fx, fy);
    this.x = c.x;
    this.y = c.y;
  }

  // The view moved under a still pointer (keys, buttons): update the cell.
  relocate() {
    if (!this.over) return;
    this.locate();
    this.hover();
  }

  pointerDown(e) {
    this.canvas.setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size >= 2) { this.startPinch(); return; }
    }
    if (e.button === 1) { // the middle button drags the view around
      e.preventDefault();
      this.panning = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    this.toCell(e);
    this.over = true;
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      this.shape = { kind: e.shiftKey ? 'line' : 'box', x0: this.x, y0: this.y, erase: e.button === 2 };
      this.hover();
      return;
    }
    this.down = true;
    this.erasing = e.button === 2;
    this.lastX = this.x;
    this.lastY = this.y;
    this.hover();
  }

  pointerMove(e) {
    if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch) { this.movePinch(); return; }
    if (this.panning) {
      const rect = this.canvas.getBoundingClientRect();
      const cam = this.camera;
      cam.pan(-((e.clientX - this.panning.x) / rect.width) * cam.vw,
        -((e.clientY - this.panning.y) / rect.height) * cam.vh);
      this.panning = { x: e.clientX, y: e.clientY };
    }
    this.toCell(e);
    this.over = true;
    this.hover();
  }

  // Two fingers down: stop painting and pinch-zoom instead.
  startPinch() {
    this.down = false;
    this.shape = null;
    this.erasing = false;
    const { dist, mx, my } = this.fingers();
    const { fx, fy } = this.fraction(mx, my);
    const cam = this.camera;
    this.pinch = { dist, zoom: cam.zoom, px: cam.x + fx * cam.vw, py: cam.y + fy * cam.vh };
  }

  // Keep the point first pinched under the fingers as they spread and move.
  movePinch() {
    const { dist, mx, my } = this.fingers();
    const { fx, fy } = this.fraction(mx, my);
    const p = this.pinch;
    this.camera.zoomTo(p.zoom * (dist / Math.max(1, p.dist)));
    this.camera.anchor(p.px, p.py, fx, fy);
  }

  fingers() {
    const [a, b] = [...this.touches.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  pointerUp(e) {
    this.touches.delete(e.pointerId);
    if (this.pinch) {
      // Lifting a finger ends the pinch; the other one doesn't start painting.
      if (this.touches.size < 2) this.pinch = null;
      this.over = false;
      this.hover();
      return;
    }
    if (this.panning) {
      this.panning = null;
      this.canvas.style.cursor = '';
      return;
    }
    if (this.shape) {
      this.toCell(e);
      this.commitShape(this.shape);
      this.shape = null;
    }
    this.down = false;
    this.erasing = false;
    if (e.pointerType !== 'mouse') this.over = false;
    this.hover();
  }

  hover() {
    if (this.onHover) this.onHover(this.over ? { x: this.x, y: this.y } : null);
  }

  // Called once per simulation step.
  apply() {
    if (!this.down) return;
    const world = this.getWorld();
    world.brushShape = this.state.brushShape;
    const area = this.strokeArea(world, this.lastX, this.lastY, this.x, this.y);
    this.act(world, area, this.x - this.lastX, this.y - this.lastY, this.erasing);
    this.lastX = this.x;
    this.lastY = this.y;
  }

  // Every cell the brush covers on its way from (x0, y0) to (x1, y1), each
  // visited once, so a stroke heats or pressurises evenly along its length.
  strokeArea(world, x0, y0, x1, y1) {
    const r = this.state.brush;
    const dx = x1 - x0, dy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(1, r * 0.5)));
    return (fn) => {
      const seen = new Set();
      for (let s = 1; s <= steps; s++) {
        const px = Math.round(x0 + (dx * s) / steps);
        const py = Math.round(y0 + (dy * s) / steps);
        world.brushArea(px, py, r)((i, x, y) => {
          if (seen.has(i)) return;
          seen.add(i);
          fn(i, x, y);
        });
      }
    };
  }

  // Draw the finished line (with the brush) or fill the finished box.
  commitShape(shape) {
    const world = this.getWorld();
    world.brushShape = this.state.brushShape;
    const { x0, y0 } = shape, x1 = this.x, y1 = this.y;
    const area = shape.kind === 'box'
      ? (fn) => world.forRect(x0, y0, x1, y1, fn)
      : this.strokeArea(world, x0, y0, x1, y1);
    // A line drawn with the brush starts at the first point, not just after it.
    const start = shape.kind === 'line' ? world.brushArea(x0, y0, this.state.brush) : null;
    const both = start ? (fn) => { start(fn); area(fn); } : area;
    this.act(world, both, x1 - x0, y1 - y0, shape.erase);
  }

  act(world, area, dx, dy, erasing) {
    if (erasing) { world.eraseArea(area); return; }
    const sel = this.state.selection;
    if (sel.kind === 'element') {
      world.paintArea(area, sel.id, DENSITY[DEFS[sel.id].state] ?? 1);
      return;
    }
    switch (sel.id) {
      case 'erase': world.eraseArea(area); break;
      case 'wall': world.paintArea(area, ID.WALL, 1); break;
      case 'heat': world.heatArea(area, HEAT_RATE); break;
      case 'cool': world.heatArea(area, -HEAT_RATE); break;
      case 'pressure': world.pressurizeArea(area, PRESSURE_RATE); break;
      case 'vacuum': world.pressurizeArea(area, -PRESSURE_RATE); break;
      case 'wind':
        if (dx || dy) {
          const len = Math.hypot(dx, dy);
          const k = Math.min(4, len) * WIND_STRENGTH;
          world.blowArea(area, (dx / len) * k, (dy / len) * k);
        }
        break;
      default: break;
    }
  }
}
