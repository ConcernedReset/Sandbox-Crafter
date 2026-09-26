// Mouse, touch and pen input on the world canvas. Strokes are interpolated
// between pointer events so fast drags leave a continuous line, and the
// selected tool keeps acting every frame while the pointer is held down.
// Holding Shift while dragging draws a straight line, and Ctrl (or Cmd) a
// filled box; both are only applied when the button is released.

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
  constructor(canvas, getWorld, state) {
    this.canvas = canvas;
    this.getWorld = getWorld;
    this.state = state; // { selection: {kind, id}, brush }
    this.down = false;
    this.erasing = false;
    this.over = false;
    this.x = 0;
    this.y = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.shape = null; // { kind: 'line' | 'box', x0, y0, erase } while Shift/Ctrl-dragging
    this.onHover = null;

    canvas.addEventListener('pointerdown', (e) => this.pointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.pointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.pointerUp(e));
    canvas.addEventListener('pointercancel', (e) => this.pointerUp(e));
    canvas.addEventListener('pointerleave', () => { this.over = false; this.hover(); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.state.setBrush(this.state.brush + (e.deltaY < 0 ? 1 : -1));
    }, { passive: false });
  }

  toCell(e) {
    const rect = this.canvas.getBoundingClientRect();
    const world = this.getWorld();
    this.x = Math.floor(((e.clientX - rect.left) / rect.width) * world.w);
    this.y = Math.floor(((e.clientY - rect.top) / rect.height) * world.h);
  }

  pointerDown(e) {
    this.canvas.setPointerCapture(e.pointerId);
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
    this.toCell(e);
    this.over = true;
    this.hover();
  }

  pointerUp(e) {
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
