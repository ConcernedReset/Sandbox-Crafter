// Draws the world into a canvas. Particles are written into an ImageData at
// one pixel per cell, then scaled up with nearest-neighbour filtering. Two
// effects, each switched on and off by a button (`gas`, `glow`):
//   - Gas: gases (and loose flames, and plasma) go on a layer of their own at
//     half resolution, blurred and blended into soft clouds as in The Powder
//     Toy, then drawn over the world.
//   - Glow: hot and energetic particles feed a low-resolution light layer,
//     blurred into a wide halo that lingers a few frames, drawn on top with
//     additive blending.
// A camera ({ x, y, vw, vh } in cells) picks the part of the world shown, so
// zooming in just scales up a smaller piece of the same image.

import { DEFS, ID, NUM, State, AMBIENT } from '../sim/elements.js';
import { CELL } from '../sim/air.js';
import { VOID_TOP, VOID_BOTTOM, VOID_LEFT, VOID_RIGHT } from '../sim/world.js';
import { PASS } from '../sim/walls.js';
import { portalHues } from '../sim/portals.js';
import { SHAPED } from '../sim/creatures.js';
import { SHAPE_COLORS } from '../sim/shapes.js';

const BG = [10, 12, 16];
const SHADES = 8;
const GAS_GAIN = 1.7; // how solid the blurred gas looks
const GAS_SPREAD = 2.3; // how far gas is blurred, in cells (a standard deviation)
const GLOW_GAIN = 3; // how bright the halo is
const GLOW_LINGER = 0.82; // the share of last frame's halo kept (an afterglow)
// Things past ULTRA_HOT glow blue-white, like the hottest stars, fully so by
// ULTRA_HOT × 1000.
const ULTRA_HOT = 10000;

const pack = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// The colour of light an element gives off, or tints light bouncing off it:
// its `light` colour, or its own colour turned up to full brightness.
function lightOf(d) {
  if (d.light) return hex(d.light);
  const c = hex(d.colors[0]);
  const m = Math.max(1, ...c);
  return c.map((v) => Math.round((v * 255) / m * 0.75 + 255 * 0.25));
}

// Build a 256-entry colour ramp from [position, '#rrggbb'] stops.
function ramp(stops) {
  const out = new Uint8Array(256 * 3);
  for (let k = 0; k < 256; k++) {
    const u = k / 255;
    let s = 0;
    while (s < stops.length - 2 && u > stops[s + 1][0]) s++;
    const [u0, c0] = stops[s], [u1, c1] = stops[s + 1];
    const f = Math.min(1, Math.max(0, (u - u0) / (u1 - u0 || 1)));
    const a = hex(c0), b = hex(c1);
    for (let c = 0; c < 3; c++) out[k * 3 + c] = Math.round(a[c] + (b[c] - a[c]) * f);
  }
  return out;
}

// Incandescence, starting at the Draper point (~525 °C) where hot things
// first visibly glow, up to white heat.
const HOT = ramp([[0, '#5a0d04'], [0.12, '#a3200a'], [0.3, '#e2461a'], [0.5, '#ff8f2e'], [0.75, '#ffd46a'], [1, '#fff6e2']]);
const FIRE = ramp([[0, '#3a0a04'], [0.25, '#b3260b'], [0.55, '#ff7a22'], [0.8, '#ffc04a'], [1, '#fff1b0']]);
const PLASMA = ramp([[0, '#3a0b5a'], [0.4, '#a02ce0'], [0.75, '#f07cff'], [1, '#fff0ff']]);
// The Heat view's colours. Up to white heat (6000 °C) a thermal camera's
// ramp: navy at absolute zero, blue, green, yellow, orange, red, white. Past
// that there's no top temperature, so the colour never stops changing: it
// fades from white into a bright hue wheel (violet, pink, red, orange,
// yellow, green, cyan, blue, violet again) and goes round it once every
// HEAT_TURN powers of ten, for ever. The wheel is kept light, so nothing that
// hot looks like the deep blues of cold.
const HEAT_WHITE = 6000;
const HEAT_FADE = 0.4; // powers of ten from white into the wheel
const HEAT_TURN = 4; // powers of ten once round the wheel
const HEAT_ON = HEAT_WHITE * 10 ** HEAT_FADE; // where the wheel starts
const HEAT_LIGHT = 0.66; // the wheel's lightness (HSL)

// A colour at hue h (degrees), full saturation, lightness l (HSL).
function hsl(h, l) {
  const c = 1 - Math.abs(2 * l - 1);
  const k = (n) => {
    const m = (n + h / 30) % 12;
    return Math.round((l - (c / 2) * Math.max(-1, Math.min(m - 3, 9 - m, 1))) * 255);
  };
  return [k(0), k(8), k(4)];
}
const toHex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const WHEEL_START = 270; // violet

// Entries 0..255: the ramp to white and on into the wheel; 256..511: the wheel.
const HEAT = new Uint8Array(512 * 3);
HEAT.set(ramp([
  [0, '#141a5c'], [0.162, '#2350c8'], [0.252, '#2fb4d8'], [0.324, '#3cc47a'],
  [0.45, '#e8d13c'], [0.612, '#ff7a26'], [0.765, '#e0262a'], [0.9, '#ffffff'],
  [1, toHex(hsl(WHEEL_START, HEAT_LIGHT))],
]));
for (let k = 0; k < 256; k++) HEAT.set(hsl(WHEEL_START + (k / 256) * 360, HEAT_LIGHT), (256 + k) * 3);

// Map a temperature to its entry in HEAT.
function heatIndex(T) {
  if (T >= HEAT_ON) {
    const f = Math.log10(T / HEAT_ON) / HEAT_TURN;
    return 256 + (((f - Math.floor(f)) * 256) | 0);
  }
  let u;
  if (T < 22) u = 0.27 * Math.max(0, T + 273) / 295;
  else if (T <= HEAT_WHITE) u = 0.27 + 0.63 * Math.log1p((T - 22) / 40) / Math.log1p((HEAT_WHITE - 22) / 40);
  else u = 0.9 + 0.1 * Math.log10(T / HEAT_WHITE) / HEAT_FADE;
  return Math.min(255, Math.max(0, (u * 255) | 0));
}

// The Heat view's colour for temperature T, as [r, g, b].
export function heatRGB(T) {
  const k = heatIndex(T) * 3;
  return [HEAT[k], HEAT[k + 1], HEAT[k + 2]];
}

// How a time zone is tinted: blue for slow, orange for fast, stronger the
// further from normal speed.
const ZONE_TINT = [null,
  { rgb: [90, 160, 255], strength: 0.32 }, { rgb: [90, 160, 255], strength: 0.16 },
  { rgb: [255, 150, 60], strength: 0.16 }, { rgb: [255, 150, 60], strength: 0.32 }];
export const zoneTint = (code) => ZONE_TINT[code];

// The colour of end `end` (0 or 1) of portal pair `slot`.
export const portalRGB = (slot, end) => hsl(portalHues(slot)[end], 0.62);
// The outline round a sleeping area (Show sleeping areas): blue when fully
// asleep, green when half asleep (particles frozen, heat and air moving).
const SLEEP_RGB = [120, 200, 255];
const HALF_SLEEP_RGB = [110, 230, 120];
// The lighter cells of the mesh a wall that lets things through is drawn as.
const WALL_LIGHT = [124, 132, 148];

// Box-blur an interleaved array of `ch` (3 or 4) channels, w wide, in
// place, radius 1, across then down, over columns x0..x1 and rows y0..y1
// only; `tmp` is scratch of the same size.
function blur(a, tmp, w, ch, x0, y0, x1, y1) {
  const k = 1 / 3, four = ch === 4;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0, i = (y * w + x0) * ch; x <= x1; x++, i += ch) {
      const l = x > x0 ? i - ch : i, r = x < x1 ? i + ch : i;
      tmp[i] = (a[l] + a[i] + a[r]) * k;
      tmp[i + 1] = (a[l + 1] + a[i + 1] + a[r + 1]) * k;
      tmp[i + 2] = (a[l + 2] + a[i + 2] + a[r + 2]) * k;
      if (four) tmp[i + 3] = (a[l + 3] + a[i + 3] + a[r + 3]) * k;
    }
  }
  const row = w * ch;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0, i = (y * w + x0) * ch; x <= x1; x++, i += ch) {
      const u = y > y0 ? i - row : i, d = y < y1 ? i + row : i;
      a[i] = (tmp[u] + tmp[i] + tmp[d]) * k;
      a[i + 1] = (tmp[u + 1] + tmp[i + 1] + tmp[d + 1]) * k;
      a[i + 2] = (tmp[u + 2] + tmp[i + 2] + tmp[d + 2]) * k;
      if (four) a[i + 3] = (tmp[u + 3] + tmp[i + 3] + tmp[d + 3]) * k;
    }
  }
}

// The Glow halo's blur (three colour channels per air block): like blur,
// except that light doesn't cross a wall. Blocks with any Wall in them
// (`mask`) stay dark, and count as the block's own light to the blocks
// beside them.
export function glowBlur(a, tmp, w, h, mask) {
  const k = 1 / 3;
  for (let y = 0; y < h; y++) {
    for (let x = 0, c = y * w; x < w; x++, c++) {
      const i = c * 3;
      if (mask[c]) { tmp[i] = 0; tmp[i + 1] = 0; tmp[i + 2] = 0; continue; }
      const l = x > 0 && !mask[c - 1] ? i - 3 : i, r = x < w - 1 && !mask[c + 1] ? i + 3 : i;
      tmp[i] = (a[l] + a[i] + a[r]) * k;
      tmp[i + 1] = (a[l + 1] + a[i + 1] + a[r + 1]) * k;
      tmp[i + 2] = (a[l + 2] + a[i + 2] + a[r + 2]) * k;
    }
  }
  const row = w * 3;
  for (let y = 0; y < h; y++) {
    for (let x = 0, c = y * w; x < w; x++, c++) {
      const i = c * 3;
      if (mask[c]) { a[i] = 0; a[i + 1] = 0; a[i + 2] = 0; continue; }
      const u = y > 0 && !mask[c - w] ? i - row : i, d = y < h - 1 && !mask[c + w] ? i + row : i;
      a[i] = (tmp[u] + tmp[i] + tmp[d]) * k;
      a[i + 1] = (tmp[u + 1] + tmp[i + 1] + tmp[d + 1]) * k;
      a[i + 2] = (tmp[u + 2] + tmp[i + 2] + tmp[d + 2]) * k;
    }
  }
}

// What the Gas effect blurs into soft clouds: gases, and the glowing energy
// that looks like gas (flames, plasma, ball lightning). Not things that
// merely glow like neon (an LED, phosphor, fluorite).
export const SOFT = Uint8Array.from(DEFS, (d) => (d.id !== 0 && !d.projectile
  && (d.state === State.GAS || d.id === ID.FIRE || d.id === ID.PLASMA || d.id === ID.BALL_LIGHTNING) ? 1 : 0));

const MODE = {
  PLAIN: 0, GAS: 1, FIRE: 2, PLASMA: 3, SPARK: 4, LIGHTNING: 5, CLONE: 6, VOID: 7, MOLTEN: 8,
  NEON: 9, FLASH: 10, GLITTER: 11, STAR: 12, STRANGE: 13, PULSE: 14, BLINK: 15, LAMP: 16, MACHINE: 17,
};

// Elements can ask for a drawing style by name with their `render` field.
const RENDER = {
  molten: MODE.MOLTEN, neon: MODE.NEON, flash: MODE.FLASH, glitter: MODE.GLITTER, star: MODE.STAR,
  strange: MODE.STRANGE, pulse: MODE.PULSE, blink: MODE.BLINK, plasma: MODE.PLASMA,
  lamp: MODE.LAMP, machine: MODE.MACHINE,
};

export class Renderer {
  constructor(canvas, world, camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // Can the canvas blur what it draws (on the GPU)? If not, the gas layer
    // is blurred here instead.
    this.gpuBlur = false;
    if (typeof this.ctx.filter === 'string') {
      this.ctx.filter = 'blur(1px)';
      this.gpuBlur = this.ctx.filter === 'blur(1px)';
      this.ctx.filter = 'none';
    }
    this.camera = camera ?? { x: 0, y: 0, vw: world.w, vh: world.h };
    this.view = 'normal';
    this.gas = true; // the Gas effect (see the top of this file)
    this.glow = true; // the Glow effect
    this.showSleep = false; // outline sleeping areas (sleep.js)
    this.frame = 0;
    this.count = 0;
    this.setWorld(world);
    this.buildPalettes();
  }

  setWorld(world) {
    this.world = world;
    this.buffer = document.createElement('canvas');
    this.buffer.width = world.w;
    this.buffer.height = world.h;
    this.bufferCtx = this.buffer.getContext('2d');
    this.image = this.bufferCtx.createImageData(world.w, world.h);
    this.pixels = new Uint32Array(this.image.data.buffer);

    const { cols, rows } = world.air;
    this.glowCanvas = document.createElement('canvas');
    this.glowCanvas.width = cols;
    this.glowCanvas.height = rows;
    this.glowCtx = this.glowCanvas.getContext('2d');
    this.glowImage = this.glowCtx.createImageData(cols, rows);
    this.glowAcc = new Float32Array(cols * rows * 3);
    this.glowLast = new Float32Array(cols * rows * 3);
    this.glowTmp = new Float32Array(cols * rows * 3);
    this.glowWall = new Uint8Array(cols * rows); // air blocks with Wall in them

    // The gas layer, at half resolution: colour times opacity, and opacity.
    this.gw = Math.ceil(world.w / 2);
    this.gh = Math.ceil(world.h / 2);
    this.gasCanvas = document.createElement('canvas');
    this.gasCanvas.width = this.gw;
    this.gasCanvas.height = this.gh;
    this.gasCtx = this.gasCanvas.getContext('2d');
    this.gasImage = this.gasCtx.createImageData(this.gw, this.gh);
    this.gasAcc = new Float32Array(this.gw * this.gh * 4);
    this.gasTmp = new Float32Array(this.gw * this.gh * 4);
    this.gasCells = 0;
    this.gasBox = null; // [x0, y0, x1, y1] of the gas layer drawn last, in its pixels
  }

  buildPalettes() {
    this.palRGB = new Uint8Array(NUM * SHADES * 3);
    this.shapeRGB = new Uint8Array(NUM * SHAPE_COLORS * 3); // shaped creatures' pixels (shapes.js)
    this.mode = new Uint8Array(NUM);
    this.alpha = new Float32Array(NUM);
    this.glowAmt = new Float32Array(NUM);
    this.projColor = new Uint32Array(NUM);
    this.projRGB = new Uint8Array(NUM * 3);
    this.exciteRGB = new Uint8Array(NUM * 3);
    this.flameRGB = new Int16Array(NUM * 3).fill(-1);
    this.lightRGB = new Uint8Array(NUM * 3);
    this.lightColor = new Uint32Array(NUM);
    for (const d of DEFS) {
      const light = lightOf(d);
      this.lightRGB.set(light, d.id * 3);
      this.lightColor[d.id] = pack(...light);
      this.alpha[d.id] = d.alpha;
      this.glowAmt[d.id] = d.glowAmount;
      if (d.excite) this.exciteRGB.set(d.excite.rgb, d.id * 3);
      if (d.flame) this.flameRGB.set(hex(d.flame), d.id * 3);
      if (d.projectile) {
        // Ghostly particles (neutrinos) are drawn faintly.
        const a = d.alpha;
        const [r, g, b] = hex(d.colors[0]).map((c, k) => Math.round(BG[k] + (c - BG[k]) * a));
        this.projColor[d.id] = pack(r, g, b);
        this.projRGB.set([r, g, b], d.id * 3);
      }
      for (let s = 0; s < SHADES; s++) {
        const [r, g, b] = hex(d.colors[s % d.colors.length]);
        this.palRGB.set([r, g, b], (d.id * SHADES + s) * 3);
      }
      if (d.shape) d.shape.colors.forEach((rgb, s) => this.shapeRGB.set(rgb, (d.id * SHAPE_COLORS + s) * 3));
      let m = MODE.PLAIN;
      if (d.state === State.GAS) m = MODE.GAS;
      if (d.glow) m = MODE.MOLTEN;
      if (d.excite) m = MODE.NEON;
      if (d.machine) m = MODE.MACHINE;
      if (d.render) m = RENDER[d.render];
      this.mode[d.id] = m;
    }
    this.mode[ID.FIRE] = MODE.FIRE;
    this.mode[ID.CAMPFIRE] = MODE.FIRE;
    this.mode[ID.PLASMA] = MODE.PLASMA;
    this.mode[ID.SPARK] = MODE.SPARK;
    this.mode[ID.LIGHTNING] = MODE.LIGHTNING;
    this.mode[ID.CLONE] = MODE.CLONE;
    this.mode[ID.VOID] = MODE.VOID;
    this.mode[ID.NEON] = MODE.NEON;
    this.mode[ID.GEIGER] = MODE.FLASH;
    this.mode[ID.GLITTER] = MODE.GLITTER;
    this.mode[ID.STAR] = MODE.STAR;
    this.mode[ID.WHITE_HOLE] = MODE.STAR;
    this.mode[ID.STRANGE_MATTER] = MODE.STRANGE;
    this.mode[ID.VIRUS] = MODE.PULSE;
    this.mode[ID.ANTIMATTER] = MODE.PULSE;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  draw(brush) {
    this.frame++;
    this.paint();
    const { ctx, canvas, camera: cam } = this;
    this.bufferCtx.putImageData(this.image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.buffer, cam.x, cam.y, cam.vw, cam.vh, 0, 0, canvas.width, canvas.height);
    if (this.gasCells > 0) {
      this.gasCtx.putImageData(this.gasImage, 0, 0);
      ctx.imageSmoothingEnabled = true;
      if (this.gpuBlur) ctx.filter = `blur(${(GAS_SPREAD * canvas.width) / cam.vw}px)`;
      ctx.drawImage(this.gasCanvas, cam.x / 2, cam.y / 2, cam.vw / 2, cam.vh / 2, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';
    }
    if (this.glow && this.view !== 'heat') {
      this.glowCtx.putImageData(this.glowImage, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = 'lighter';
      // One glow pixel per air block.
      ctx.drawImage(this.glowCanvas, cam.x / CELL, cam.y / CELL, cam.vw / CELL, cam.vh / CELL,
        0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }
    this.drawEdges();
    if (brush) this.drawBrush(brush);
  }

  // A purple line along each edge of the world that's a void.
  // Void edges are a solid violet bar; looped ones a dashed teal line on
  // both sides of the join.
  drawEdges() {
    const { ctx, canvas, camera: cam, world } = this;
    const v = world.voidEdges;
    if (!v && !world.loopX && !world.loopY) return;
    const sx = canvas.width / cam.vw, sy = canvas.height / cam.vh;
    const x0 = -cam.x * sx, y0 = -cam.y * sy;
    const x1 = (world.w - cam.x) * sx, y1 = (world.h - cam.y) * sy;
    const t = Math.max(2, Math.round(canvas.width / 300));
    ctx.fillStyle = 'rgba(150, 115, 255, 0.85)';
    if (v & VOID_TOP) ctx.fillRect(x0, y0, x1 - x0, t);
    if (v & VOID_BOTTOM) ctx.fillRect(x0, y1 - t, x1 - x0, t);
    if (v & VOID_LEFT) ctx.fillRect(x0, y0, t, y1 - y0);
    if (v & VOID_RIGHT) ctx.fillRect(x1 - t, y0, t, y1 - y0);
    if (world.loopX || world.loopY) {
      ctx.save();
      ctx.strokeStyle = 'rgba(79, 209, 197, 0.9)';
      ctx.lineWidth = t;
      ctx.setLineDash([t * 2, t * 2]);
      ctx.beginPath();
      if (world.loopX) { ctx.moveTo(x0 + t / 2, y0); ctx.lineTo(x0 + t / 2, y1); ctx.moveTo(x1 - t / 2, y0); ctx.lineTo(x1 - t / 2, y1); }
      if (world.loopY) { ctx.moveTo(x0, y0 + t / 2); ctx.lineTo(x1, y0 + t / 2); ctx.moveTo(x0, y1 - t / 2); ctx.lineTo(x1, y1 - t / 2); }
      ctx.stroke();
      ctx.restore();
    }
  }

  // A small map of the whole world with the zoomed-in view marked on it.
  drawMinimap(map) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(map.clientWidth * dpr));
    const h = Math.max(1, Math.round(map.clientHeight * dpr));
    if (map.width !== w || map.height !== h) { map.width = w; map.height = h; }
    const m = map.getContext('2d');
    const cam = this.camera;
    m.imageSmoothingEnabled = true;
    m.drawImage(this.buffer, 0, 0, w, h);
    const sx = w / this.world.w, sy = h / this.world.h;
    const x0 = cam.x * sx, y0 = cam.y * sy, x1 = x0 + cam.vw * sx, y1 = y0 + cam.vh * sy;
    m.fillStyle = 'rgba(10, 12, 16, 0.55)'; // dim what's off screen
    m.fillRect(0, 0, w, y0);
    m.fillRect(0, y1, w, h - y1);
    m.fillRect(0, y0, x0, y1 - y0);
    m.fillRect(x1, y0, w - x1, y1 - y0);
    m.strokeStyle = '#d9a441';
    m.lineWidth = dpr * 1.5;
    m.strokeRect(x0 + m.lineWidth / 2, y0 + m.lineWidth / 2, x1 - x0 - m.lineWidth, y1 - y0 - m.lineWidth);
  }

  // The brush outline, plus the line or box being dragged out with Shift or Ctrl.
  drawBrush({ x, y, r, square, color, from }) {
    const { ctx, canvas, camera: cam } = this;
    const sx = canvas.width / cam.vw;
    const sy = canvas.height / cam.vh;
    const base = canvas.width / this.world.w; // the outline stays thin when zoomed in
    ctx.save();
    ctx.translate(-cam.x * sx, -cam.y * sy);
    ctx.beginPath();
    if (from && from.kind === 'box') {
      const x0 = Math.min(from.x, x), y0 = Math.min(from.y, y);
      ctx.rect(x0 * sx, y0 * sy, (Math.abs(x - from.x) + 1) * sx, (Math.abs(y - from.y) + 1) * sy);
    } else {
      const outline = (cx, cy) => {
        if (square) ctx.rect((cx - r) * sx, (cy - r) * sy, (2 * r + 1) * sx, (2 * r + 1) * sy);
        else ctx.ellipse((cx + 0.5) * sx, (cy + 0.5) * sy, (r + 0.5) * sx, (r + 0.5) * sy, 0, 0, Math.PI * 2);
      };
      outline(x, y);
      if (from) {
        ctx.moveTo((from.x + 0.5) * sx + (square ? 0 : (r + 0.5) * sx), (from.y + 0.5) * sy);
        outline(from.x, from.y);
        ctx.moveTo((from.x + 0.5) * sx, (from.y + 0.5) * sy);
        ctx.lineTo((x + 0.5) * sx, (y + 0.5) * sy);
      }
    }
    ctx.lineWidth = Math.max(1, base * 0.35);
    ctx.strokeStyle = 'rgba(10,12,16,0.6)';
    ctx.stroke();
    ctx.lineWidth = Math.max(1, base * 0.18);
    ctx.strokeStyle = color || 'rgba(236,230,216,0.8)';
    ctx.stroke();
    ctx.restore();
  }

  paint() {
    const { world, pixels, palRGB, shapeRGB, mode, alpha, glowAmt, frame, view, exciteRGB, flameRGB, lightRGB } = this;
    const { w, h, type, temp, life, ctype, shade, loose, doorTimer, doorKind, wall } = world;
    const air = world.air;
    const cols = air.cols;
    const glow = this.glowAcc, glowWall = this.glowWall;
    glow.fill(0);
    glowWall.fill(0);
    const bgR = BG[0], bgG = BG[1], bgB = BG[2];
    const bg = pack(bgR, bgG, bgB);
    const heatView = view === 'heat';
    const pressureView = view === 'pressure';
    const airHeat = heatView && air.heat; // show the air's own temperature
    // Soft gas only in the normal view: the others colour every cell.
    const soft = this.gas && view === 'normal';
    const gas = this.gasAcc, gw = this.gw;
    if (soft) gas.fill(0);
    let gasCells = 0;
    let gx0 = gw, gy0 = this.gh, gx1 = -1, gy1 = -1; // where the gas is
    let count = 0;

    for (let y = 0; y < h; y++) {
      const gRow = ((y / CELL) | 0) * cols;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const t = type[i];
        let r, g, b;

        // Light doesn't get past a wall, unless it lets particles through.
        if (wall[i] !== 0 && (wall[i] & PASS.particles) === 0) glowWall[gRow + ((x / CELL) | 0)] = 1;
        if (t === 0) {
          if (doorTimer[i] !== 0 && !heatView) {
            // An open doorway: a faint ghost of the door (or valve).
            const q = ((doorKind[i] || ID.DOOR) * SHADES + (x + y) % 3) * 3;
            r = bgR + (palRGB[q] - bgR) * 0.25; g = bgG + (palRGB[q + 1] - bgG) * 0.25; b = bgB + (palRGB[q + 2] - bgB) * 0.25;
          } else {
            if (airHeat) {
              // With convection on, the heat view shows warm and cold air, dimmed.
              const at = air.t[air.at(x, y)];
              if (at > AMBIENT + 2 || at < AMBIENT - 2) {
                const k = heatIndex(at) * 3;
                pixels[i] = pack((bgR + (HEAT[k] - bgR) * 0.45) | 0, (bgG + (HEAT[k + 1] - bgG) * 0.45) | 0,
                  (bgB + (HEAT[k + 2] - bgB) * 0.45) | 0);
                continue;
              }
            }
            if (!pressureView) { pixels[i] = bg; continue; }
            r = bgR; g = bgG; b = bgB;
          }
        } else if (heatView) {
          count++;
          const k = heatIndex(temp[i]) * 3;
          pixels[i] = pack(HEAT[k], HEAT[k + 1], HEAT[k + 2]);
          continue;
        } else {
          count++;
          const s = shade[i] & 7;
          if (SHAPED[t] === 1) { // a creature's pixel: its own palette (shapes.js)
            const p = (t * SHAPE_COLORS + (shade[i] & 31)) * 3;
            r = shapeRGB[p]; g = shapeRGB[p + 1]; b = shapeRGB[p + 2];
          } else {
            const p = (t * SHADES + s) * 3;
            r = palRGB[p]; g = palRGB[p + 1]; b = palRGB[p + 2];
          }
          let emit = 0;
          let wisp = -1; // see-through: drawn this opaque (and blurred, if SOFT)
          switch (mode[t]) {
            case MODE.PLAIN: {
              const T = temp[i];
              if (t === ID.DIAMOND && ((i * 7919 + frame * 3) % 211) === 0) { r = g = b = 255; }
              if (T > 480) {
                const f = Math.min(0.9, (T - 480) / 1400);
                const k = Math.min(255, ((T - 480) / 12) | 0) * 3;
                r += (HOT[k] - r) * f; g += (HOT[k + 1] - g) * f; b += (HOT[k + 2] - b) * f;
                emit = f * 0.5;
                if (T > ULTRA_HOT) {
                  const u = Math.min(1, Math.log10(T / ULTRA_HOT) / 3);
                  r += (205 - r) * u; g += (222 - g) * u; b += (255 - b) * u;
                  emit += u * 0.5;
                }
              } else if (T < -30) {
                const f = Math.min(0.45, (-30 - T) / 250);
                r += (200 - r) * f; g += (236 - g) * f; b += (255 - b) * f;
              }
              break;
            }
            case MODE.GAS: {
              let a = alpha[t];
              if (t === ID.SMOKE) a *= Math.min(1, life[i] / 120);
              const T = temp[i];
              if (T > 480) { // hot gas glows
                const f = Math.min(0.9, (T - 480) / 1400);
                const k = Math.min(255, ((T - 480) / 12) | 0) * 3;
                r += (HOT[k] - r) * f; g += (HOT[k + 1] - g) * f; b += (HOT[k + 2] - b) * f;
                a += (1 - a) * f * 0.6;
                emit = f * 0.6;
              }
              wisp = a;
              break;
            }
            case MODE.MOLTEN: {
              // Darker crust as it nears its freezing point; a slow shimmer.
              const d = DEFS[t];
              const lo = d.low ? d.low.temp : 0;
              const f = Math.min(1, Math.max(0.25, (temp[i] - lo) / (d.temp - lo)));
              const wave = 0.85 + 0.15 * Math.sin((x * 0.35 + y * 0.6 + frame * 0.08 + s) * 0.9);
              const c = ctype[i];
              if (c) { // molten copper, gold... tinted by the metal it was
                const q = (c * SHADES + s) * 3;
                r = r * 0.6 + palRGB[q] * 0.4; g = g * 0.6 + palRGB[q + 1] * 0.4; b = b * 0.6 + palRGB[q + 2] * 0.4;
              }
              r *= f * wave; g *= f * f * wave; b *= f * f * wave;
              emit = 0.45 * f;
              break;
            }
            case MODE.NEON: {
              if (life[i] > 0) { // excited by current or light: a bright sign glow
                const q = t * 3, f = 0.7 + Math.min(1, life[i] / 20) * 0.3;
                r = exciteRGB[q] * f; g = exciteRGB[q + 1] * f; b = exciteRGB[q + 2] * f;
                emit = 0.45;
                if (SOFT[t]) wisp = 0.9; // a glowing gas; a glowing solid stays sharp
              } else {
                wisp = alpha[t];
              }
              break;
            }
            case MODE.FLASH:
              if (life[i] > 0) { r = 125; g = 255; b = 138; emit = 1.2; }
              break;
            case MODE.LAMP: // a pixel that lights up while powered
              if (life[i] > 0) {
                const q = t * 3, f = 0.92 + 0.08 * (s & 1);
                r = lightRGB[q] * f; g = lightRGB[q + 1] * f; b = lightRGB[q + 2] * f;
                emit = 0.6;
              }
              break;
            case MODE.MACHINE: { // controls and machines show a light while on
              const c = ctype[i];
              if (c && t === ID.DISPENSER) { // tinted by what it pours
                const q = (c * SHADES + s) * 3;
                r = r * 0.6 + palRGB[q] * 0.4; g = g * 0.6 + palRGB[q + 1] * 0.4; b = b * 0.6 + palRGB[q + 2] * 0.4;
              }
              if (life[i] > 0) {
                const q = t * 3;
                r = r * 0.4 + lightRGB[q] * 0.6; g = g * 0.4 + lightRGB[q + 1] * 0.6; b = b * 0.4 + lightRGB[q + 2] * 0.6;
                emit = 0.3;
              }
              break;
            }
            case MODE.GLITTER: {
              const a = Math.min(1, life[i] / 30);
              r = bgR + (r - bgR) * a; g = bgG + (g - bgG) * a; b = bgB + (b - bgB) * a;
              emit = 0.9 * a;
              break;
            }
            case MODE.STAR: {
              const flick = 0.9 + (((i * 57 + frame * 13) & 7) / 7) * 0.1;
              r *= flick; g *= flick; b *= flick;
              break;
            }
            case MODE.STRANGE: {
              const q = (t * SHADES + ((s + (frame >> 3)) % 3)) * 3;
              r = palRGB[q]; g = palRGB[q + 1]; b = palRGB[q + 2];
              break;
            }
            case MODE.BLINK: { // fireflies and plankton flash on and off
              const on = ((frame + ((i * 37) & 127)) % 110) < 14;
              if (on) { r = r * 0.4 + 153; g = g * 0.4 + 153; b = b * 0.4 + 60; emit = 1.1; }
              break;
            }
            case MODE.PULSE: {
              const pulse = 0.8 + 0.2 * Math.sin(frame * 0.15 + x * 0.3 + y * 0.2);
              r *= pulse; g *= pulse; b *= pulse;
              wisp = alpha[t];
              break;
            }
            case MODE.FIRE: {
              const c = ctype[i];
              const fuel = c & 0x7fff, loose = c & 0x8000;
              const flick = ((i * 131 + frame * 17) & 15) / 15;
              const v = Math.min(1, life[i] / 45) * 0.8 + flick * 0.2;
              const k = Math.min(255, (v * 255) | 0) * 3;
              r = FIRE[k]; g = FIRE[k + 1]; b = FIRE[k + 2];
              const fq = fuel * 3;
              if (fuel && flameRGB[fq] >= 0) { // strontium burns red, barium green, sulfur blue
                const f = 0.45 + 0.55 * v;
                r = r * 0.2 + flameRGB[fq] * 0.8 * f;
                g = g * 0.2 + flameRGB[fq + 1] * 0.8 * f;
                b = b * 0.2 + flameRGB[fq + 2] * 0.8 * f;
                wisp = 0.45 + 0.55 * v;
              } else if (fuel && !loose && DEFS[fuel].state !== State.GAS && DEFS[fuel].state !== State.LIQUID) {
                // An ember: the fuel's own colour, glowing.
                const q = (fuel * SHADES + s) * 3;
                r = palRGB[q] * 0.35 + r * 0.65; g = palRGB[q + 1] * 0.35 + g * 0.55; b = palRGB[q + 2] * 0.35 + b * 0.4;
              } else {
                wisp = 0.45 + 0.55 * v; // a loose flame
              }
              emit = 0.9 * v;
              break;
            }
            case MODE.PLASMA: {
              const flick = ((i * 97 + frame * 29) & 15) / 15;
              const v = Math.min(1, life[i] / 40) * 0.75 + flick * 0.25;
              const k = Math.min(255, (v * 255) | 0) * 3;
              r = PLASMA[k]; g = PLASMA[k + 1]; b = PLASMA[k + 2];
              emit = 1.1 * v;
              if (soft) wisp = 0.85;
              break;
            }
            case MODE.SPARK: {
              const on = ((i + frame) & 1) === 0;
              r = 255; g = on ? 250 : 225; b = on ? 190 : 90;
              emit = 1.4;
              break;
            }
            case MODE.LIGHTNING: {
              const a = ctype[i] === 1 ? Math.min(1, life[i] / 5) : 1;
              r = bgR + (244 - bgR) * a; g = bgG + (238 - bgG) * a; b = bgB + (255 - bgB) * a;
              emit = 2 * a;
              break;
            }
            case MODE.CLONE: {
              const c = ctype[i];
              if (c) {
                const q = (c * SHADES + s) * 3;
                r = r * 0.7 + palRGB[q] * 0.3; g = g * 0.7 + palRGB[q + 1] * 0.3; b = b * 0.7 + palRGB[q + 2] * 0.3;
              }
              break;
            }
            case MODE.VOID: {
              const pulse = 0.5 + 0.5 * Math.sin(frame * 0.1 + (x + y) * 0.4);
              r = 18 + 40 * pulse; g = 8 + 10 * pulse; b = 30 + 60 * pulse;
              break;
            }
            default: break;
          }
          // Debris torn off by pressure is drawn a little darker than intact solid.
          if (loose[i]) { r *= 0.78; g *= 0.78; b *= 0.78; }
          emit += glowAmt[t];
          if (emit > 0) {
            const gi = (gRow + ((x / CELL) | 0)) * 3;
            glow[gi] += r * emit;
            glow[gi + 1] += g * emit;
            glow[gi + 2] += b * emit;
          }
          if (wisp >= 0) { // see-through: blended with the background, or blurred
            if (soft && SOFT[t]) { // onto the gas layer; the cell itself shows the background
              const hx = x >> 1, hy = y >> 1, q = (hy * gw + hx) * 4;
              gas[q] += r * wisp; gas[q + 1] += g * wisp; gas[q + 2] += b * wisp; gas[q + 3] += wisp;
              gasCells++;
              if (hx < gx0) gx0 = hx;
              if (hx > gx1) gx1 = hx;
              if (hy < gy0) gy0 = hy;
              if (hy > gy1) gy1 = hy;
              pixels[i] = bg;
              continue;
            }
            r = bgR + (r - bgR) * wisp; g = bgG + (g - bgG) * wisp; b = bgB + (b - bgB) * wisp;
          }
        }

        if (pressureView) {
          const p = air.p[air.at(x, y)];
          const a = Math.min(0.75, Math.abs(p) / 30);
          r *= 0.55; g *= 0.55; b *= 0.55;
          if (p > 0) { r += (255 - r) * a; g += (70 - g) * a; b += (60 - b) * a; }
          else { r += (60 - r) * a; g += (130 - g) * a; b += (255 - b) * a; }
        }
        pixels[i] = pack(r | 0, g | 0, b | 0);
      }
    }

    this.count = count;
    this.paintOverlays();
    this.paintProjectiles(heatView);

    this.gasCells = soft ? gasCells : 0;
    if (this.gasCells > 0) this.paintGas(gx0, gy0, gx1, gy1);
    if (this.glow && !heatView) this.paintGlow();
  }

  // Drawn over the cells, in every view: walls that let things through (a
  // mesh), time zones (a tint, and a dashed border that crawls along), and
  // portals.
  paintOverlays() {
    const { world, pixels, frame } = this;
    const { w, h } = world;
    const blend = (i, rgb, a) => {
      const c = pixels[i];
      const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
      pixels[i] = pack((r + (rgb[0] - r) * a) | 0, (g + (rgb[1] - g) * a) | 0, (b + (rgb[2] - b) * a) | 0);
    };
    if (world.meshCount !== 0) {
      const wall = world.wall;
      for (let y = 0; y < h; y++) {
        for (let x = y & 1; x < w; x += 2) { // every other cell: a checkerboard
          const i = y * w + x;
          if ((wall[i] & 255) !== 0) blend(i, WALL_LIGHT, 0.55);
        }
      }
    }
    if (world.zoneCount !== 0) {
      const speed = world.speed;
      const crawl = frame >> 2;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x, s = speed[i];
          if (s === 0) continue;
          const tint = ZONE_TINT[s];
          const edge = (x > 0 && speed[i - 1] !== s) || (x < w - 1 && speed[i + 1] !== s)
            || (y > 0 && speed[i - w] !== s) || (y < h - 1 && speed[i + w] !== s);
          if (edge) {
            // Backwards for a slow zone, forwards for a fast one.
            const on = (((x + y + (s <= 2 ? -crawl : crawl)) >> 1) & 1) === 0;
            blend(i, tint.rgb, on ? 0.95 : tint.strength * 1.6);
          } else {
            blend(i, tint.rgb, tint.strength);
          }
        }
      }
    }
    if (world.portalCells !== 0) {
      world.portals.forEach((p, slot) => {
        if (p === null) return;
        [p.a, p.b].forEach((e, end) => {
          if (e === null) return;
          const [r, g, b] = portalRGB(slot, end);
          const c = pack(r, g, b);
          e.cells.forEach((i, pos) => {
            // A lone end is dashed until its partner is drawn.
            if (p.b === null && ((pos >> 1) & 1) === 1) return;
            pixels[i] = c;
          });
        });
      });
    }
    // Show sleeping areas: a faint outline round each sleeping chunk.
    if (this.showSleep) {
      const { chunkAwake, chunkFull, cw, ch } = world;
      for (let c = 0; c < cw * ch; c++) {
        if (chunkAwake[c]) continue;
        const rgb = chunkFull[c] ? SLEEP_RGB : HALF_SLEEP_RGB;
        const x0 = (c % cw) * 16, y0 = ((c / cw) | 0) * 16;
        const x1 = Math.min(w, x0 + 16) - 1, y1 = Math.min(h, y0 + 16) - 1;
        for (let x = x0; x <= x1; x++) { blend(y0 * w + x, rgb, 0.35); blend(y1 * w + x, rgb, 0.35); }
        for (let y = y0 + 1; y < y1; y++) { blend(y * w + x0, rgb, 0.35); blend(y * w + x1, rgb, 0.35); }
      }
    }
    // What a human carries: one pixel above its hands, on the side it faces.
    for (const e of world.creatures) {
      const b = e.brain;
      if (b === null || b.carry === 0) continue;
      const up = e.frame >= 2 ? 4 : 5; // kneeling and sitting, its hands are lower
      const x = e.x + e.facing * e.gy - up * e.gx, y = e.y - e.facing * e.gx - up * e.gy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const q = b.carry * SHADES * 3;
      pixels[y * w + x] = pack(this.palRGB[q], this.palRGB[q + 1], this.palRGB[q + 2]);
    }
  }

  // Turn the gas layer into an image, blurred (here, unless the canvas blurs
  // it as it's drawn): each pixel the average colour of the gas around it,
  // as opaque as there is gas. Only the box round the gas (x0..y1, with room
  // for the blur to spread) is worked on.
  paintGas(x0, y0, x1, y1) {
    const { gasAcc: a, gasTmp, gw, gh } = this;
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2);
    x1 = Math.min(gw - 1, x1 + 2); y1 = Math.min(gh - 1, y1 + 2);
    if (!this.gpuBlur) {
      blur(a, gasTmp, gw, 4, x0, y0, x1, y1);
      blur(a, gasTmp, gw, 4, x0, y0, x1, y1);
    }
    const out = this.gasImage.data;
    // Clear what was drawn last time, then draw this time's box.
    const last = this.gasBox;
    if (last) {
      for (let y = last[1]; y <= last[3]; y++) {
        for (let x = last[0], q = (y * gw + x) * 4 + 3; x <= last[2]; x++, q += 4) out[q] = 0;
      }
    }
    this.gasBox = [x0, y0, x1, y1];
    const gain = 0.25 * GAS_GAIN * 255;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0, q = (y * gw + x) * 4; x <= x1; x++, q += 4) {
        const cover = a[q + 3];
        if (cover < 0.004) { out[q + 3] = 0; continue; }
        const inv = 1 / cover;
        out[q] = a[q] * inv;
        out[q + 1] = a[q + 1] * inv;
        out[q + 2] = a[q + 2] * inv;
        out[q + 3] = cover * gain;
      }
    }
  }

  // The halo: the light given off in each air block, kept from fading
  // faster than GLOW_LINGER a frame, blurred wide and boosted. It stops at
  // walls (glowBlur).
  paintGlow() {
    const { glowAcc: g, glowLast: last, glowTmp } = this;
    for (let k = 0; k < g.length; k++) {
      const kept = last[k] * GLOW_LINGER;
      if (g[k] < kept) g[k] = kept;
    }
    last.set(g);
    const { cols, rows } = this.world.air;
    glowBlur(g, glowTmp, cols, rows, this.glowWall);
    glowBlur(g, glowTmp, cols, rows, this.glowWall);
    const gp = this.glowImage.data;
    const gain = (1 / (CELL * CELL)) * GLOW_GAIN;
    for (let k = 0; k < cols * rows; k++) {
      gp[k * 4] = Math.min(255, g[k * 3] * gain);
      gp[k * 4 + 1] = Math.min(255, g[k * 3 + 1] * gain);
      gp[k * 4 + 2] = Math.min(255, g[k * 3 + 2] * gain);
      gp[k * 4 + 3] = 255;
    }
  }

  // Photons, electrons and friends: bright single pixels with a little glow.
  // Light that has bounced off something is drawn in that thing's colour.
  paintProjectiles(heatView) {
    const { world, pixels, projColor, projRGB, lightColor, lightRGB } = this;
    const { px, py, ptype, ptint, pn, w } = world;
    const glow = this.glowAcc;
    const cols = world.air.cols;
    const white = pack(255, 255, 255);
    for (let k = 0; k < pn; k++) {
      const x = px[k] | 0, y = py[k] | 0;
      const t = ptype[k], tint = ptint[k];
      const rgb = tint ? lightRGB : projRGB, q = (tint || t) * 3;
      pixels[y * w + x] = heatView ? white : tint ? lightColor[tint] : projColor[t];
      const gi = (((y / CELL) | 0) * cols + ((x / CELL) | 0)) * 3;
      glow[gi] += rgb[q] * 0.7;
      glow[gi + 1] += rgb[q + 1] * 0.7;
      glow[gi + 2] += rgb[q + 2] * 0.7;
    }
  }
}
