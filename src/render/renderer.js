// Draws the world into a canvas. Particles are written into an ImageData at
// one pixel per cell, then scaled up with nearest-neighbour filtering. Hot
// and energetic particles also feed a low-resolution glow layer that is
// drawn on top with additive blending, which gives fire and lava a bloom.

import { DEFS, ID, NUM, State } from '../sim/elements.js';
import { CELL } from '../sim/air.js';

const BG = [10, 12, 16];
const SHADES = 8;

const pack = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

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
const HEAT = ramp([
  [0, '#141a5c'], [0.18, '#2350c8'], [0.28, '#2fb4d8'], [0.36, '#3cc47a'],
  [0.5, '#e8d13c'], [0.68, '#ff7a26'], [0.85, '#e0262a'], [1, '#ffffff'],
]);

// Map a temperature to a 0..255 index on the heat-view ramp.
function heatIndex(T) {
  let u;
  if (T < 22) u = 0.3 * Math.max(0, T + 273) / 295;
  else u = 0.3 + 0.7 * Math.min(1, Math.log1p((T - 22) / 40) / Math.log1p(6000 / 40));
  return Math.min(255, Math.max(0, (u * 255) | 0));
}

const MODE = {
  PLAIN: 0, GAS: 1, FIRE: 2, PLASMA: 3, SPARK: 4, LIGHTNING: 5, CLONE: 6, VOID: 7, MOLTEN: 8,
  NEON: 9, FLASH: 10, GLITTER: 11, STAR: 12, STRANGE: 13, PULSE: 14, BLINK: 15,
};

// Elements can ask for a drawing style by name with their `render` field.
const RENDER = {
  molten: MODE.MOLTEN, neon: MODE.NEON, flash: MODE.FLASH, glitter: MODE.GLITTER, star: MODE.STAR,
  strange: MODE.STRANGE, pulse: MODE.PULSE, blink: MODE.BLINK, plasma: MODE.PLASMA,
};

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.view = 'normal';
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
    this.glow = document.createElement('canvas');
    this.glow.width = cols;
    this.glow.height = rows;
    this.glowCtx = this.glow.getContext('2d');
    this.glowImage = this.glowCtx.createImageData(cols, rows);
    this.glowAcc = new Float32Array(cols * rows * 3);
  }

  buildPalettes() {
    this.palRGB = new Uint8Array(NUM * SHADES * 3);
    this.mode = new Uint8Array(NUM);
    this.alpha = new Float32Array(NUM);
    this.glowAmt = new Float32Array(NUM);
    this.projColor = new Uint32Array(NUM);
    this.projRGB = new Uint8Array(NUM * 3);
    this.exciteRGB = new Uint8Array(NUM * 3);
    this.flameRGB = new Int16Array(NUM * 3).fill(-1);
    for (const d of DEFS) {
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
      let m = MODE.PLAIN;
      if (d.state === State.GAS) m = MODE.GAS;
      if (d.glow) m = MODE.MOLTEN;
      if (d.excite) m = MODE.NEON;
      if (d.render) m = RENDER[d.render];
      this.mode[d.id] = m;
    }
    this.mode[ID.FIRE] = MODE.FIRE;
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
    const { ctx, canvas } = this;
    this.bufferCtx.putImageData(this.image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.buffer, 0, 0, canvas.width, canvas.height);
    if (this.view !== 'heat') {
      this.glowCtx.putImageData(this.glowImage, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = 'lighter';
      const { cols, rows } = this.world.air;
      // The glow grid can overhang the world slightly; scale to match cells.
      ctx.drawImage(this.glow, 0, 0, cols, rows, 0, 0,
        (canvas.width * cols * CELL) / this.world.w, (canvas.height * rows * CELL) / this.world.h);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (brush) this.drawBrush(brush);
  }

  drawBrush({ x, y, r, color }) {
    const { ctx, canvas } = this;
    const sx = canvas.width / this.world.w;
    const sy = canvas.height / this.world.h;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse((x + 0.5) * sx, (y + 0.5) * sy, (r + 0.5) * sx, (r + 0.5) * sy, 0, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, sx * 0.35);
    ctx.strokeStyle = 'rgba(10,12,16,0.6)';
    ctx.stroke();
    ctx.lineWidth = Math.max(1, sx * 0.18);
    ctx.strokeStyle = color || 'rgba(236,230,216,0.8)';
    ctx.stroke();
    ctx.restore();
  }

  paint() {
    const { world, pixels, palRGB, mode, alpha, glowAmt, frame, view, exciteRGB, flameRGB } = this;
    const { w, h, type, temp, life, ctype, shade, loose } = world;
    const air = world.air;
    const cols = air.cols;
    const glow = this.glowAcc;
    glow.fill(0);
    const bgR = BG[0], bgG = BG[1], bgB = BG[2];
    const bg = pack(bgR, bgG, bgB);
    const heatView = view === 'heat';
    const pressureView = view === 'pressure';
    let count = 0;

    for (let y = 0; y < h; y++) {
      const gRow = ((y / CELL) | 0) * cols;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const t = type[i];
        let r, g, b;

        if (t === 0) {
          if (!pressureView) { pixels[i] = bg; continue; }
          r = bgR; g = bgG; b = bgB;
        } else if (heatView) {
          count++;
          const k = heatIndex(temp[i]) * 3;
          pixels[i] = pack(HEAT[k], HEAT[k + 1], HEAT[k + 2]);
          continue;
        } else {
          count++;
          const s = shade[i] & 7;
          const p = (t * SHADES + s) * 3;
          r = palRGB[p]; g = palRGB[p + 1]; b = palRGB[p + 2];
          let emit = 0;
          switch (mode[t]) {
            case MODE.PLAIN: {
              const T = temp[i];
              if (t === ID.DIAMOND && ((i * 7919 + frame * 3) % 211) === 0) { r = g = b = 255; }
              if (T > 480) {
                const f = Math.min(0.9, (T - 480) / 1400);
                const k = Math.min(255, ((T - 480) / 12) | 0) * 3;
                r += (HOT[k] - r) * f; g += (HOT[k + 1] - g) * f; b += (HOT[k + 2] - b) * f;
                emit = f * 0.5;
              } else if (T < -30) {
                const f = Math.min(0.45, (-30 - T) / 250);
                r += (200 - r) * f; g += (236 - g) * f; b += (255 - b) * f;
              }
              break;
            }
            case MODE.GAS: {
              let a = alpha[t];
              if (t === ID.SMOKE) a *= Math.min(1, life[i] / 120);
              r = bgR + (r - bgR) * a; g = bgG + (g - bgG) * a; b = bgB + (b - bgB) * a;
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
              } else {
                const a = alpha[t];
                r = bgR + (r - bgR) * a; g = bgG + (g - bgG) * a; b = bgB + (b - bgB) * a;
              }
              break;
            }
            case MODE.FLASH:
              if (life[i] > 0) { r = 125; g = 255; b = 138; emit = 1.2; }
              break;
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
              const a = alpha[t];
              r = bgR + (r * pulse - bgR) * a; g = bgG + (g * pulse - bgG) * a; b = bgB + (b * pulse - bgB) * a;
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
                const a = 0.45 + 0.55 * v;
                r = bgR + (r - bgR) * a; g = bgG + (g - bgG) * a; b = bgB + (b - bgB) * a;
              } else if (fuel && !loose && DEFS[fuel].state !== State.GAS && DEFS[fuel].state !== State.LIQUID) {
                // An ember: the fuel's own colour, glowing.
                const q = (fuel * SHADES + s) * 3;
                r = palRGB[q] * 0.35 + r * 0.65; g = palRGB[q + 1] * 0.35 + g * 0.55; b = palRGB[q + 2] * 0.35 + b * 0.4;
              } else {
                const a = 0.45 + 0.55 * v;
                r = bgR + (r - bgR) * a; g = bgG + (g - bgG) * a; b = bgB + (b - bgB) * a;
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
    this.paintProjectiles(heatView);

    // Glow: average per air block, boosted.
    const gp = this.glowImage.data;
    const n = cols * air.rows;
    const gain = 1 / (CELL * CELL) * 2.2;
    for (let k = 0; k < n; k++) {
      gp[k * 4] = Math.min(255, glow[k * 3] * gain);
      gp[k * 4 + 1] = Math.min(255, glow[k * 3 + 1] * gain);
      gp[k * 4 + 2] = Math.min(255, glow[k * 3 + 2] * gain);
      gp[k * 4 + 3] = 255;
    }
  }

  // Photons, electrons and friends: bright single pixels with a little glow.
  paintProjectiles(heatView) {
    const { world, pixels, projColor, projRGB } = this;
    const { px, py, ptype, pn, w } = world;
    const glow = this.glowAcc;
    const cols = world.air.cols;
    const white = pack(255, 255, 255);
    for (let k = 0; k < pn; k++) {
      const x = px[k] | 0, y = py[k] | 0;
      const t = ptype[k];
      pixels[y * w + x] = heatView ? white : projColor[t];
      const gi = (((y / CELL) | 0) * cols + ((x / CELL) | 0)) * 3;
      glow[gi] += projRGB[t * 3] * 0.7;
      glow[gi + 1] += projRGB[t * 3 + 1] * 0.7;
      glow[gi + 2] += projRGB[t * 3 + 2] * 0.7;
    }
  }
}
