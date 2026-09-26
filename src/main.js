// Entry point: wires the simulation, renderer, input and UI together and
// runs the game loop at a fixed 60 simulation steps per second.

import { World } from './sim/world.js';
import { DEFS, ID } from './sim/elements.js';
import { Renderer } from './render/renderer.js';
import { Input, MAX_BRUSH } from './game/input.js';
import { Progress } from './game/progress.js';
import { loadDemoScene } from './game/scene.js';
import { UI, toolColor } from './game/ui.js';

const WIDTH = 400;
const HEIGHT = 240;
const STEP_MS = 1000 / 60;
const $ = (id) => document.getElementById(id);

const world = new World(WIDTH, HEIGHT, (Math.random() * 2 ** 32) >>> 0);
const progress = new Progress();

const game = {
  world,
  progress,
  selection: { kind: 'element', id: ID.SAND },
  brush: 4,
  brushShape: 'circle',
  paused: false,
  select(sel) {
    this.selection = sel;
    ui.renderPalette();
    ui.renderInspect();
  },
  setBrush(r) {
    this.brush = Math.max(0, Math.min(MAX_BRUSH, r));
    ui.setBrush(this.brush);
  },
};

const ui = new UI(game);
const canvas = $('world');
const renderer = new Renderer(canvas, world);
const input = new Input(canvas, () => world, game);
let hover = null;
input.onHover = (pos) => { hover = pos; };

loadDemoScene(world);
ui.setBrush(game.brush);

// ---- discoveries ----------------------------------------------------------

function collectDiscoveries() {
  if (!world.discoveries.length) return;
  let changed = false;
  for (const { id, rule } of world.discoveries) {
    if (progress.discover(id)) {
      ui.celebrate(id, rule);
      changed = true;
    }
  }
  world.discoveries.length = 0;
  if (changed) {
    if (!progress.tipDismissed) dismissTip();
    ui.refresh();
  }
}

// ---- controls -------------------------------------------------------------

function setPaused(p) {
  game.paused = p;
  $('btn-pause').setAttribute('aria-pressed', String(p));
  $('btn-pause').querySelector('span').textContent = p ? 'Play' : 'Pause';
  $('btn-pause').querySelector('svg').innerHTML = p
    ? '<path d="M4 2.5l9 5.5-9 5.5z"/>'
    : '<path d="M4 3h3v10H4zM9 3h3v10H9z"/>';
  $('btn-step').disabled = !p;
  $('paused-flag').hidden = !p;
}

function stepOnce() {
  if (!game.paused) return;
  world.step();
  collectDiscoveries();
}

function setView(view) {
  renderer.view = view;
  for (const b of document.querySelectorAll('[data-view]')) {
    b.setAttribute('aria-checked', String(b.dataset.view === view));
  }
}

function dismissTip() {
  $('tip').hidden = true;
  progress.tipDismissed = true;
  progress.save();
}

$('btn-pause').addEventListener('click', () => setPaused(!game.paused));
$('btn-step').addEventListener('click', stepOnce);
$('btn-clear').addEventListener('click', () => world.clearAll());
for (const b of document.querySelectorAll('[data-shape]')) {
  b.addEventListener('click', () => {
    game.brushShape = b.dataset.shape;
    for (const o of document.querySelectorAll('[data-shape]')) {
      o.setAttribute('aria-checked', String(o === b));
    }
  });
}
for (const b of document.querySelectorAll('[data-view]')) {
  b.addEventListener('click', () => setView(b.dataset.view));
}
$('tip').hidden = progress.tipDismissed;
$('tip-close').addEventListener('click', dismissTip);

const menu = $('menu');
const menuButton = $('btn-menu');
function setMenu(open) {
  menu.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  if (!open) $('menu-confirm').hidden = true;
}
menuButton.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); });
document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) setMenu(false); });
$('menu-scene').addEventListener('click', () => { loadDemoScene(world); setMenu(false); });
$('menu-freeplay').checked = progress.freePlay;
$('menu-freeplay').addEventListener('change', (e) => {
  progress.freePlay = e.target.checked;
  progress.save();
  if (game.selection.kind === 'element' && !progress.usable(game.selection.id)) {
    game.selection = { kind: 'element', id: ID.SAND };
  }
  ui.refresh();
});
$('menu-reset').addEventListener('click', () => { $('menu-confirm').hidden = false; });
$('menu-reset-no').addEventListener('click', () => { $('menu-confirm').hidden = true; });
$('menu-reset-yes').addEventListener('click', () => {
  progress.reset();
  world.seen.fill(0);
  $('menu-freeplay').checked = false;
  game.selection = { kind: 'element', id: ID.SAND };
  ui.refresh();
  setMenu(false);
});

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
  switch (e.key) {
    case ' ': e.preventDefault(); setPaused(!game.paused); break;
    case '.': stepOnce(); break;
    case '[': game.setBrush(game.brush - 1); break;
    case ']': game.setBrush(game.brush + 1); break;
    case '1': setView('normal'); break;
    case '2': setView('heat'); break;
    case '3': setView('pressure'); break;
    case 'Escape': setMenu(false); break;
    default: break;
  }
});

new ResizeObserver(() => renderer.resize()).observe(canvas);
renderer.resize();

// ---- main loop ----------------------------------------------------------

function brushOutline() {
  if (!hover) return null;
  const sel = game.selection;
  const shape = input.shape;
  let color;
  if (input.erasing || shape?.erase) color = toolColor('erase');
  else if (sel.kind === 'tool') color = toolColor(sel.id);
  else color = DEFS[sel.id].colors[0];
  const outline = { x: hover.x, y: hover.y, r: game.brush, square: game.brushShape === 'square', color };
  if (shape) outline.from = { kind: shape.kind, x: shape.x0, y: shape.y0 };
  return outline;
}

let last = performance.now();
let acc = 0;
let frames = 0;
let fps = 60;
let fpsTime = last;

function frame(now) {
  acc += Math.min(100, now - last);
  last = now;
  let steps = 0;
  while (acc >= STEP_MS && steps < 3) {
    input.apply();
    if (!game.paused) world.step();
    acc -= STEP_MS;
    steps++;
  }
  if (steps === 3) acc = 0; // too slow to keep up; drop the backlog instead of spiralling
  collectDiscoveries();

  renderer.draw(brushOutline());
  ui.renderHud(world, hover);

  frames++;
  if (now - fpsTime >= 500) {
    fps = Math.round((frames * 1000) / (now - fpsTime));
    frames = 0;
    fpsTime = now;
    ui.renderStats(renderer.count, world.pn, fps);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
