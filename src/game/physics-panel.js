// The Physics panel under the game: which way gravity pulls (a dial you
// turn), how hard (a text box), Newtonian gravity, convection, and which
// edges of the world are a void (a box whose sides you click). Settings
// are kept in localStorage, guarded like saved progress, and applied to the
// world at start.

import { MAX_STRENGTH } from '../sim/gravity.js';

const KEY = 'sandbox-crafter:physics';
const NO_EDGES = Object.freeze({ top: false, bottom: false, left: false, right: false });
export const DEFAULTS = Object.freeze({ angle: 0, strength: 1, newtonian: false, convection: true, edges: NO_EDGES });
const NAMES = ['Down', 'Down-left', 'Left', 'Up-left', 'Up', 'Up-right', 'Right', 'Down-right'];
// Keys that turn the dial, in degrees clockwise.
const TURN = { ArrowRight: 15, ArrowUp: 15, ArrowLeft: -15, ArrowDown: -15, PageUp: 45, PageDown: -45 };

const wrap = (a) => ((Math.round(a) % 360) + 360) % 360;

// "Down", "Up-left"... at multiples of 45 degrees, otherwise the angle.
export function angleText(deg) {
  return deg % 45 === 0 ? NAMES[deg / 45] : `${deg}°`;
}

// The strength typed into the box (a trailing x is fine), kept to 0-10,
// or null if it can't be read.
export function parseStrength(text) {
  const s = String(text ?? '').trim().replace(/\s*[x×]$/i, '').replace(',', '.');
  if (s === '') return null;
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return Math.min(MAX_STRENGTH, Math.max(0, Math.round(v * 100) / 100));
}

// The dial's angle for a pointer (dx, dy) from its centre: whole degrees
// clockwise from straight down, 0-359. `snap` rounds to 45.
export function dialAngle(dx, dy, snap = false) {
  const a = (Math.atan2(-dx, dy) * 180) / Math.PI;
  const step = snap ? 45 : 1;
  return wrap(Math.round(a / step) * step);
}

export function loadSettings(storage = globalThis.localStorage) {
  try {
    const data = JSON.parse(storage.getItem(KEY));
    if (!data || typeof data !== 'object') return { ...DEFAULTS };
    return {
      angle: Number.isFinite(data.angle) ? wrap(data.angle) : DEFAULTS.angle,
      strength: parseStrength(data.strength) ?? DEFAULTS.strength,
      newtonian: !!data.newtonian,
      convection: data.convection === undefined ? DEFAULTS.convection : !!data.convection,
      edges: {
        top: !!data.edges?.top, bottom: !!data.edges?.bottom, left: !!data.edges?.left, right: !!data.edges?.right,
      },
    };
  } catch {
    return { ...DEFAULTS }; // unreadable or unavailable storage
  }
}

export function saveSettings(settings, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Nothing to do; the settings just won't be remembered.
  }
}

export class PhysicsPanel {
  constructor(world, doc = document) {
    this.world = world;
    this.doc = doc;
    const $ = (id) => doc.getElementById(id);
    this.dial = $('grav-dial');
    this.arrow = $('grav-arrow');
    this.readout = $('grav-angle');
    this.box = $('grav-strength');
    this.newton = $('grav-newton');
    this.convect = $('convection');
    this.edges = [...doc.querySelectorAll('[data-edge]')];
    this.settings = loadSettings();
    this.bind($('physics-reset'));
    this.apply();
  }

  // Push the settings into the world and the controls, and save them.
  apply() {
    const s = this.settings;
    this.world.setGravity({ angle: s.angle, strength: s.strength, newtonian: s.newtonian });
    this.world.setConvection(s.convection);
    this.world.setVoidEdges(s.edges);
    for (const b of this.edges) b.setAttribute('aria-pressed', String(s.edges[b.dataset.edge]));
    this.arrow.setAttribute('transform', `rotate(${s.angle})`);
    this.dial.setAttribute('aria-valuenow', String(s.angle));
    this.dial.setAttribute('aria-valuetext', angleText(s.angle));
    this.readout.textContent = angleText(s.angle);
    if (this.doc.activeElement !== this.box) this.box.value = String(s.strength);
    this.newton.checked = s.newtonian;
    this.convect.checked = s.convection;
    saveSettings(s);
  }

  update(change) {
    Object.assign(this.settings, change);
    this.apply();
  }

  bind(reset) {
    const { dial, box } = this;
    const turnTo = (e) => {
      const r = dial.getBoundingClientRect();
      const a = dialAngle(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), e.shiftKey);
      if (a !== this.settings.angle) this.update({ angle: a });
    };
    dial.addEventListener('pointerdown', (e) => { dial.setPointerCapture(e.pointerId); turnTo(e); });
    dial.addEventListener('pointermove', (e) => { if (dial.hasPointerCapture(e.pointerId)) turnTo(e); });
    dial.addEventListener('dblclick', () => this.update({ angle: 0 }));
    dial.addEventListener('keydown', (e) => {
      let a;
      if (TURN[e.key] !== undefined) a = wrap(this.settings.angle + TURN[e.key]);
      else if (e.key === 'Home') a = 0;
      else return;
      e.preventDefault();
      e.stopPropagation(); // arrow keys would also pan the camera
      this.update({ angle: a });
    });
    const commit = () => {
      const v = parseStrength(box.value);
      if (v !== null && v !== this.settings.strength) this.update({ strength: v });
      box.value = String(this.settings.strength);
    };
    box.addEventListener('change', commit);
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { commit(); box.blur(); }
      else if (e.key === 'Escape') { box.value = String(this.settings.strength); box.blur(); }
    });
    this.newton.addEventListener('change', () => this.update({ newtonian: this.newton.checked }));
    this.convect.addEventListener('change', () => this.update({ convection: this.convect.checked }));
    for (const b of this.edges) {
      b.addEventListener('click', () => {
        const side = b.dataset.edge;
        this.update({ edges: { ...this.settings.edges, [side]: !this.settings.edges[side] } });
      });
    }
    reset.addEventListener('click', () => { this.settings = { ...DEFAULTS }; this.apply(); });
  }
}
