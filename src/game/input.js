// Mouse, touch and pen input on the world canvas. Strokes are interpolated
// between pointer events so fast drags leave a continuous line, and the
// selected tool keeps acting every frame while the pointer is held down.

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
    this.down = true;
    this.erasing = e.button === 2;
    this.over = true;
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
    const r = this.state.brush;
    const dx = this.x - this.lastX, dy = this.y - this.lastY;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / Math.max(1, r * 0.5)));
    for (let s = 1; s <= steps; s++) {
      const px = Math.round(this.lastX + (dx * s) / steps);
      const py = Math.round(this.lastY + (dy * s) / steps);
      this.act(world, px, py, r, dx, dy);
    }
    this.lastX = this.x;
    this.lastY = this.y;
  }

  act(world, x, y, r, dx, dy) {
    if (this.erasing) { world.erase(x, y, r); return; }
    const sel = this.state.selection;
    if (sel.kind === 'element') {
      world.paint(x, y, r, sel.id, DENSITY[DEFS[sel.id].state] ?? 1);
      return;
    }
    switch (sel.id) {
      case 'erase': world.erase(x, y, r); break;
      case 'wall': world.paint(x, y, r, ID.WALL, 1); break;
      case 'heat': world.heat(x, y, r, HEAT_RATE); break;
      case 'cool': world.heat(x, y, r, -HEAT_RATE); break;
      case 'pressure': world.pressurize(x, y, r, PRESSURE_RATE); break;
      case 'vacuum': world.pressurize(x, y, r, -PRESSURE_RATE); break;
      case 'wind':
        if (dx || dy) {
          const len = Math.hypot(dx, dy);
          const k = Math.min(4, len) * WIND_STRENGTH;
          world.blow(x, y, r, (dx / len) * k, (dy / len) * k);
        }
        break;
      default: break;
    }
  }
}
