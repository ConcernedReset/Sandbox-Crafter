// Entry point: wires the simulation, renderer, input and UI together and
// runs the game loop at a fixed 60 simulation steps per second.

import { World } from './sim/world.js';
import { DEFS, ID } from './sim/elements.js';
import { Renderer } from './render/renderer.js';
import { TreeView } from './render/tree-view.js';
import { Input, MAX_BRUSH, HARD_BLOCKED } from './game/input.js';
import { Camera } from './game/camera.js';
import { Progress } from './game/progress.js';
import { loadDemoScene } from './game/scene.js';
import { UI, toolColor } from './game/ui.js';
import { buildTree, focusTree } from './game/tree.js';
import { PhysicsPanel } from './game/physics-panel.js';

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
  replace: false, // painting overwrites what's in the way
  get hard() { return progress.hard; },
  select(sel) {
    this.selection = sel;
    ui.renderPalette();
    ui.renderInspect();
    followSelection(sel);
  },
  setBrush(r) {
    this.brush = Math.max(0, Math.min(MAX_BRUSH, r));
    ui.setBrush(this.brush);
  },
};

const ui = new UI(game);
const canvas = $('world');
const camera = new Camera(WIDTH, HEIGHT);
const renderer = new Renderer(canvas, world, camera);
const input = new Input(canvas, () => world, game, camera);
let hover = null;
input.onHover = (pos) => { hover = pos; };

loadDemoScene(world);
ui.setBrush(game.brush);
new PhysicsPanel(world);

// ---- recipe tree ------------------------------------------------------------

const treeView = new TreeView($('tree'));
let focusId = null; // the element the tree is narrowed to, if any
let whole = null; // the whole tree, focused or not

// Rebuild the tree from the player's progress; `flash` lists new discoveries.
// While an element is singled out, only its part of the tree is shown.
function refreshTree(flash = []) {
  whole = buildTree({
    known: (id) => progress.freePlay || progress.has(id),
    revealed: (id) => progress.revealed.has(DEFS[id].key),
    hard: progress.hard,
  });
  const part = focusId === null ? null : focusTree(whole, focusId);
  if (part === null) focusId = null;
  treeView.setTree(part ?? whole, flash);
  treeView.select(focusId);
  // Name what's singled out, unless it's one of hard mode's blank boxes.
  const face = focusId === null ? 'blank' : treeView.node(focusId).face;
  $('tree-focus').hidden = face === 'blank';
  $('tree-focus').textContent = face === 'name' ? DEFS[focusId].name : '?';
  $('tree-back').hidden = focusId === null;
}

// Single out one element: the recipes behind it and everything it makes.
function focusOn(id) {
  focusId = id;
  refreshTree();
  treeView.frame(id);
}

// Back to the whole tree, with the element that was singled out in the middle.
function unfocus() {
  if (focusId === null) return;
  const was = focusId;
  focusId = null;
  refreshTree();
  treeView.centerOn(was);
}

// Clicking a node singles it out, shows how it's made, and picks a discovered
// element up to paint with. Clicking empty space goes back to the whole tree.
// In hard mode a blank box only narrows the tree, and something still to
// make gets a card with the whole tree's recipe for it, the same one
// focusing on it shows.
treeView.onPick = (node) => {
  if (!node) {
    ui.hideCard();
    unfocus();
    return;
  }
  if (progress.hard) {
    ui.showCard(node.id, whole.links.find((l) => l.output === node.id) ?? null);
  } else {
    if (node.known && progress.usable(node.id)) game.select({ kind: 'element', id: node.id });
    ui.showCard(node.id);
  }
  if (node.id !== focusId) focusOn(node.id);
};
ui.onReveal = () => refreshTree();

// Picking an element from the palette singles it out in the tree, and moves
// an open card along to it. Not in hard mode, where what it makes would give
// away what goes into things still to make.
function followSelection(sel) {
  if (sel.kind !== 'element' || progress.hard) return;
  if (ui.cardId !== null && ui.cardId !== sel.id) ui.showCard(sel.id);
  if (focusId !== sel.id) focusOn(sel.id);
}
$('tree-back').addEventListener('click', () => { ui.hideCard(); unfocus(); });
$('tree-zoom-in').addEventListener('click', () => treeView.zoomBy(1));
$('tree-zoom-out').addEventListener('click', () => treeView.zoomBy(-1));
$('tree-fit').addEventListener('click', () => treeView.fit());
new ResizeObserver(() => treeView.resize()).observe($('tree'));
refreshTree();

// ---- discoveries ----------------------------------------------------------

function collectDiscoveries() {
  if (!world.discoveries.length) return;
  const found = [];
  for (const { id, rule } of world.discoveries) {
    if (progress.discover(id)) {
      ui.celebrate(id, rule);
      found.push(id);
    }
  }
  world.discoveries.length = 0;
  if (found.length) {
    if (!progress.tipDismissed) dismissTip();
    ui.refresh();
    refreshTree(found);
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

// Replace: painting overwrites whatever is in the way.
function setReplace(on) {
  game.replace = on;
  $('btn-replace').setAttribute('aria-pressed', String(on));
}

// ---- zoom -----------------------------------------------------------------

// Zoom in or out a step, towards the pointer if it's over the world.
function zoomStep(dir) {
  if (input.over) {
    const { fx, fy } = input.fraction(input.clientX, input.clientY);
    camera.step(dir, fx, fy);
  } else {
    camera.step(dir);
  }
}

let shownZoom = 0;
function updateZoomControls() {
  if (camera.zoom === shownZoom) return;
  shownZoom = camera.zoom;
  const z = camera.zoom;
  $('zoom-reset').textContent = `${z < 10 ? Math.round(z * 10) / 10 : Math.round(z)}×`;
  $('zoom-out').disabled = z <= 1;
  $('zoom-reset').disabled = z <= 1;
  $('zoom-in').disabled = z >= camera.maxZoom;
  $('minimap').hidden = z <= 1;
}

$('zoom-in').addEventListener('click', () => camera.step(1));
$('zoom-out').addEventListener('click', () => camera.step(-1));
$('zoom-reset').addEventListener('click', () => camera.zoomTo(1));

// Click or drag on the map to move the view there.
const minimap = $('minimap');
function lookAt(e) {
  const rect = minimap.getBoundingClientRect();
  camera.centerOn(((e.clientX - rect.left) / rect.width) * WIDTH, ((e.clientY - rect.top) / rect.height) * HEIGHT);
}
minimap.addEventListener('pointerdown', (e) => { minimap.setPointerCapture(e.pointerId); lookAt(e); });
minimap.addEventListener('pointermove', (e) => { if (minimap.hasPointerCapture(e.pointerId)) lookAt(e); });

function dismissTip() {
  $('tip').hidden = true;
  progress.tipDismissed = true;
  progress.save();
}

$('btn-pause').addEventListener('click', () => setPaused(!game.paused));
$('btn-step').addEventListener('click', stepOnce);
$('btn-clear').addEventListener('click', () => world.clearAll());
$('btn-replace').addEventListener('click', () => setReplace(!game.replace));
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
  refreshTree();
});
$('menu-hard').checked = progress.hard;
$('menu-hard').addEventListener('change', (e) => {
  progress.hard = e.target.checked;
  progress.save();
  const sel = game.selection;
  if (progress.hard && sel.kind === 'tool' && HARD_BLOCKED.has(sel.id)) {
    game.selection = { kind: 'element', id: ID.SAND };
  }
  ui.hideCard();
  ui.refresh();
  focusId = null;
  refreshTree();
});
$('menu-reset').addEventListener('click', () => { $('menu-confirm').hidden = false; });
$('menu-reset-no').addEventListener('click', () => { $('menu-confirm').hidden = true; });
$('menu-reset-yes').addEventListener('click', () => {
  progress.reset();
  world.seen.fill(0);
  $('menu-freeplay').checked = false;
  game.selection = { kind: 'element', id: ID.SAND };
  ui.hideCard();
  ui.refresh();
  focusId = null;
  refreshTree();
  treeView.home();
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
    case 'r': case 'R': setReplace(!game.replace); break;
    case '=': case '+': zoomStep(1); break;
    case '-': case '_': zoomStep(-1); break;
    case '0': camera.zoomTo(1); break;
    case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': {
      if (camera.zoom <= 1 || e.target.closest?.('.panel')) break;
      e.preventDefault();
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      camera.pan(d[0] * camera.vw * 0.1, d[1] * camera.vh * 0.1);
      break;
    }
    case 'Escape':
      if (!menu.hidden) setMenu(false);
      else if (focusId !== null) { ui.hideCard(); unfocus(); }
      break;
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

  input.relocate(); // the view may have moved under a still pointer
  updateZoomControls();
  renderer.draw(brushOutline());
  if (camera.zoom > 1) renderer.drawMinimap(minimap);
  treeView.draw(now);
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
