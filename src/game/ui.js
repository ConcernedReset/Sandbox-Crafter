// Builds and updates everything around the canvas: the discovery meter, the
// tool bar, the element palette, the recipe tree's card and count, toasts and
// the HUD. The tree itself is drawn by src/render/tree-view.js.

import {
  DEFS, ID, CATEGORIES, COLLECTIBLE, RULES, State, ruleLabel, rulesFor, halfLife,
} from '../sim/elements.js';
import { TOOLS, HARD_BLOCKED, HEAT_RATE } from './input.js';
import { clue, processName } from './tree.js';
import { AIRTIGHT, HIGH_PHASE, LOW_PHASE } from '../sim/lookups.js';
import { PASS_ORDER } from '../sim/walls.js';
import { cellNotes } from './cell-notes.js';

const $ = (id) => document.getElementById(id);

const STATE_NAME = {
  [State.SOLID]: 'Solid',
  [State.POWDER]: 'Powder',
  [State.LIQUID]: 'Liquid',
  [State.GAS]: 'Gas',
  [State.ENERGY]: 'Energy',
};

function stateName(d) {
  return d.projectile ? 'Particle' : STATE_NAME[d.state];
}

function fmtDuration(seconds) {
  if (seconds < 90) return `${Math.round(seconds)} s`;
  return `${Math.round(seconds / 60)} min`;
}

const TOOL_INFO = {
  spark: {
    name: 'Spark', color: '#ffe96b',
    icon: '<path d="M11.5 2L4.5 11h5l-1 7 7-9h-5z"/>',
    desc: 'Electricity. Sends a pulse through metal and wires, presses switches and powers machines, even from inside them. Sparks whatever reacts to electricity, and fills empty space with sparks.',
  },
  erase: {
    name: 'Erase', color: '#c9a39a',
    icon: '<path d="M8 17h9M3.6 12.4l7-7a1.5 1.5 0 0 1 2.1 0l2.9 2.9a1.5 1.5 0 0 1 0 2.1L9.5 16.5H6.6l-3-3a.8.8 0 0 1 0-1.1z"/>',
    desc: 'Removes anything under the brush. Right-click erases with any tool selected.',
  },
  wall: {
    name: 'Wall', color: '#9aa3b2',
    icon: '<path d="M3 4h14v12H3zM3 8h14M3 12h14M8 4v4M12 8v4M8 12v4"/>',
    desc: 'Indestructible, airtight and a perfect insulator. Tick boxes below to let things through the walls you paint next: a grate for water, a vent for gas, a window for light.',
  },
  portal: {
    name: 'Portal', color: '#5aa8ff',
    icon: '<path d="M6 3c-2 2-2 12 0 14M14 3c2 2 2 12 0 14M3 10h4M13 10h4M5.5 8L7 10l-1.5 2M15.5 8L17 10l-1.5 2"/>',
    desc: 'Drag a line for one end of a portal, then another for the other end. Anything crossing one end comes out of the other, still going, and air flows through. Right-click a portal to remove the pair.',
  },
  time: {
    name: 'Time', color: '#ffb347',
    icon: '<path d="M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM10 6.5V10l2.5 2"/>',
    desc: 'Paint an area that runs slower or faster than the rest of the world. Right-click to put an area back to normal speed. Clear removes every area.',
  },
  heat: {
    name: 'Heat', color: '#ff7d3f',
    icon: '<path d="M10 17.5c-3 0-5-2-5-4.7 0-3 2.6-4.4 3-7.6 2.2 1.4 3 3.3 2.8 4.9 1-.6 1.6-1.6 1.7-2.9 1.8 1.4 2.5 3.4 2.5 5.6 0 2.7-2 4.7-5 4.7z"/>',
    desc: `Raises the temperature of whatever is under the brush by ${HEAT_RATE} °C per frame.`,
  },
  cool: {
    name: 'Cool', color: '#7cc8ff',
    icon: '<path d="M10 2v16M3.1 6l13.8 8M16.9 6L3.1 14M7.6 3.4L10 4.8l2.4-1.4M7.6 16.6L10 15.2l2.4 1.4"/>',
    desc: `Lowers the temperature under the brush by ${HEAT_RATE} °C per frame, down to absolute zero.`,
  },
  wind: {
    name: 'Wind', color: '#cfd6e0',
    icon: '<path d="M3 7.5h9.5a2.5 2.5 0 1 0-2.5-2.5M3 11h12a2.5 2.5 0 1 1-2.5 2.5M3 14.5h5"/>',
    desc: 'Drag to blow air in that direction. Gases and light powders follow the wind.',
  },
  mix: {
    name: 'Mix', color: '#c39bff',
    icon: '<path d="M3 6h3c2 0 3 1 4 4s2 4 4 4h3M3 14h3c2 0 3-1 4-4s2-4 4-4h3M14.5 3.5L17 6l-2.5 2.5M14.5 11.5L17 14l-2.5 2.5"/>',
    desc: 'Stirs whatever is under the brush, swapping cells at random so layers blend in moments. Walls stay put, and the air is left alone.',
  },
  pressure: {
    name: 'Pressure', color: '#ff6b5a',
    icon: '<path d="M10 2v5M7.5 4.5L10 7l2.5-2.5M10 18v-5M7.5 15.5L10 13l2.5 2.5M2 10h5M4.5 7.5L7 10l-2.5 2.5M18 10h-5M15.5 7.5L13 10l2.5 2.5"/>',
    desc: 'Pumps air in. It leaks away in the open, but a sealed Wall box holds it, and pressure builds.',
  },
  vacuum: {
    name: 'Vacuum', color: '#6b9bff',
    icon: '<path d="M10 7V2M7.5 4.5L10 2l2.5 2.5M10 13v5M7.5 15.5L10 18l2.5-2.5M7 10H2M4.5 7.5L2 10l2.5 2.5M13 10h5M15.5 7.5L18 10l-2.5 2.5"/>',
    desc: 'Pulls air out, creating suction that drags light things towards the brush.',
  },
};

export function toolColor(id) {
  return TOOL_INFO[id]?.color;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function tileStyle(d) {
  const c = d.colors;
  return `--cat:var(--cat-${d.cat});--c0:${c[0]};--c1:${c[1 % c.length]};--c2:${c[2 % c.length]};--c3:${c[3 % c.length]}`;
}

function mini(d, known = true) {
  if (!known) return `<span class="mini unknown" style="--cat:var(--cat-${d.cat})">?</span>`;
  const long = d.sym.length > 2 ? ' long' : '';
  return `<span class="mini${long}" style="${tileStyle(d)}">${esc(d.sym)}</span>`;
}

function fmtTemp(t) {
  return `${Math.round(t).toLocaleString('en-US')} °C`;
}

export class UI {
  constructor(game) {
    this.game = game;
    this.fresh = new Set();
    this.filter = '';
    this.cardId = null; // the element whose card is open under the tree
    this.cardLink = null; // and the tree's link into it (hard mode)
    this.onReveal = null; // called with an element id after its recipe is revealed
    this.buildMeter();
    this.buildTools();
    this.bindCard();
    this.bindBrush();
    this.refresh();
  }

  // ---- discovery meter ---------------------------------------------------

  buildMeter() {
    $('meter-total').textContent = COLLECTIBLE.length;
    const cells = $('meter-cells');
    // Four rows of cells, however many elements there are.
    cells.style.setProperty('--meter-cols', Math.ceil(COLLECTIBLE.length / 4));
    cells.innerHTML = COLLECTIBLE.map(() => '<i></i>').join('');
  }

  renderMeter() {
    const { progress } = this.game;
    $('meter-count').textContent = progress.count;
    const cells = $('meter-cells').children;
    COLLECTIBLE.forEach((d, k) => {
      cells[k].style.background = progress.has(d.id) ? `var(--cat-${d.cat})` : '';
    });
  }

  // ---- tools, brush, palette ---------------------------------------------

  buildTools() {
    $('tools').innerHTML = TOOLS.map((t) => {
      const info = TOOL_INFO[t];
      return `<button type="button" class="tool" data-tool="${t}" aria-pressed="false" title="${esc(info.name)}" style="--tool:${info.color}">
        <svg viewBox="0 0 20 20" aria-hidden="true">${info.icon}</svg><span>${esc(info.name)}</span></button>`;
    }).join('');
    $('tools').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tool]');
      if (b) this.game.select({ kind: 'tool', id: b.dataset.tool });
    });
    $('tool-options').addEventListener('change', (e) => {
      const bit = Number(e.target.dataset.pass);
      if (!bit) return;
      const m = this.game.toolOptions.wallMask;
      this.game.setToolOptions({ wallMask: e.target.checked ? m | bit : m & ~bit });
    });
    $('tool-options').addEventListener('click', (e) => {
      const b = e.target.closest('[data-speed]');
      if (b) this.game.setToolOptions({ timeSpeed: Number(b.dataset.speed) });
    });
    $('palette').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-id]');
      if (b) this.game.select({ kind: 'element', id: Number(b.dataset.id) });
    });
  }

  // The options strip: the Wall checklist, or the Time brush's speeds.
  renderToolOptions() {
    const box = $('tool-options');
    const { selection: sel, toolOptions: o } = this.game;
    const id = sel.kind === 'tool' ? sel.id : null;
    if (id === 'wall') {
      box.innerHTML = `<div class="opt-head">Lets through</div><div class="opt-grid">${PASS_ORDER.map(([name, bit]) =>
        `<label class="opt-check"><input type="checkbox" data-pass="${bit}"${o.wallMask & bit ? ' checked' : ''}> ${name[0].toUpperCase()}${name.slice(1)}</label>`).join('')}</div>`;
    } else if (id === 'time') {
      box.innerHTML = `<div class="opt-head">Speed</div><div class="opt-speeds" role="radiogroup" aria-label="Speed">${['¼×', '½×', '2×', '4×'].map((s, k) =>
        `<button type="button" role="radio" data-speed="${k + 1}" aria-checked="${o.timeSpeed === k + 1}">${s}</button>`).join('')}</div>`;
    } else {
      box.innerHTML = '';
    }
    box.hidden = id !== 'wall' && id !== 'time';
  }

  // A short message in the HUD line for a couple of seconds.
  flash(text) {
    this.flashText = text;
    this.flashUntil = performance.now() + 2000;
  }

  bindBrush() {
    const input = $('brush');
    input.addEventListener('input', () => this.game.setBrush(Number(input.value)));
    const search = $('search');
    search.addEventListener('input', () => {
      this.filter = search.value.trim().toLowerCase();
      this.renderPalette();
    });
  }

  // The slider holds the brush radius; the readout shows its width in cells.
  setBrush(r) {
    $('brush').value = r;
    $('brush-out').textContent = 2 * r + 1;
    $('brush-out').title = `${2 * r + 1} cells across`;
  }

  renderPalette() {
    const { progress, selection } = this.game;
    const hadFocus = $('palette').contains(document.activeElement);
    const q = this.filter;
    // While searching, only show matching elements the player can use.
    const matches = (d) => !q || (progress.usable(d.id)
      && (d.name.toLowerCase().includes(q) || d.sym.toLowerCase() === q));
    const groups = CATEGORIES.map((cat) => {
      const all = COLLECTIBLE.filter((d) => d.cat === cat.key);
      const items = all.filter(matches);
      if (!items.length) return '';
      const known = all.filter((d) => progress.usable(d.id)).length;
      // Undiscovered elements are summed up in one tile rather than shown one by one.
      const locked = items.length - items.filter((d) => progress.usable(d.id)).length;
      const more = locked ? `<div class="tile locked more" style="--cat:var(--cat-${cat.key})" aria-label="${locked} undiscovered">
            <span class="tile-num">&nbsp;</span><span class="tile-sym">+${locked}</span><span class="tile-name">to discover</span></div>` : '';
      const tiles = items.filter((d) => progress.usable(d.id)).map((d) => {
        const pressed = selection.kind === 'element' && selection.id === d.id;
        const extra = (this.fresh.has(d.id) ? ' fresh' : '') + (d.sym.length > 2 ? ' long' : '');
        return `<button type="button" class="tile${extra}" data-id="${d.id}" aria-pressed="${pressed}" style="${tileStyle(d)}" title="${esc(d.name)}: ${esc(d.desc)}">
          <span class="tile-num">${d.number}</span><span class="tile-sym">${esc(d.sym)}</span><span class="tile-name">${esc(d.name)}</span><span class="tile-swatch"></span></button>`;
      }).join('');
      return `<section class="group" style="--cat:var(--cat-${cat.key})">
        <div class="group-head">${cat.name}<span>${known}/${all.length}</span></div>
        <div class="tiles">${tiles}${more}</div></section>`;
    }).join('');
    $('palette').innerHTML = groups || `<p class="empty-search">No discovered element matches “${esc(this.filter)}”.</p>`;
    this.fresh.clear();
    if (hadFocus) $('palette').querySelector('[aria-pressed="true"]')?.focus();

    for (const b of $('tools').children) {
      const t = b.dataset.tool;
      b.setAttribute('aria-pressed', String(selection.kind === 'tool' && selection.id === t));
      // Hard mode crosses out the tools it takes away.
      const blocked = progress.hard && HARD_BLOCKED.has(t);
      b.disabled = blocked;
      b.classList.toggle('blocked', blocked);
      b.title = blocked ? `${TOOL_INFO[t].name}: not in hard mode` : TOOL_INFO[t].name;
    }
  }

  renderInspect() {
    const { selection } = this.game;
    const box = $('inspect');
    if (selection.kind === 'tool') {
      const info = TOOL_INFO[selection.id];
      box.innerHTML = `<div class="inspect-head">
          <span class="mini" style="--cat:var(--line-strong);--c0:${info.color}"><svg viewBox="0 0 20 20" width="20" height="20" style="fill:none;stroke:${info.color};stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">${info.icon}</svg></span>
          <div><div class="inspect-title">${esc(info.name)}</div><div class="inspect-sub">Tool</div></div></div>
        <p>${esc(info.desc)}</p>`;
      return;
    }
    const d = DEFS[selection.id];
    const facts = [];
    const solidish = d.state === State.SOLID || d.state === State.ENERGY;
    if (!solidish && !d.projectile) facts.push(`Density <b>${d.density}</b>`);
    if (d.temp !== 22 && !d.projectile) facts.push(`Starts at <b>${fmtTemp(d.temp)}</b>`);
    const normal = (kind) => (kind ? ' at normal pressure' : '');
    if (d.high) facts.push(`Changes above <b>${fmtTemp(d.high.temp)}</b>${normal(HIGH_PHASE[d.id])}`);
    if (d.low && !d.low.restore) facts.push(`Changes below <b>${fmtTemp(d.low.temp)}</b>${normal(LOW_PHASE[d.id])}`);
    if (d.flammable > 0 && d.ignite < 5000) facts.push(`Ignites at <b>${fmtTemp(d.ignite)}</b>`);
    if (d.explode > 0) facts.push('<b>Explosive</b>');
    if (d.pressure) facts.push(`Gives way above pressure <b>${d.pressure.above}</b>`);
    if (d.strength > 0) facts.push(`Tears loose above pressure <b>${d.strength}</b> (less when hot)`);
    if (AIRTIGHT[d.id]) facts.push('<b>Airtight</b>: a closed shell holds pressure until it tears');
    if (d.emits || d.fission) facts.push('<b>Radioactive</b>');
    if (d.decay) facts.push(`Half-life <b>≈ ${fmtDuration(halfLife(d.decay.chance))}</b>`);
    if (d.fission) facts.push(`Splits into <b>${d.fission.neutrons} neutrons</b>`);
    if (d.critter) {
      const where = { swim: 'Swims in water', fly: 'Flies', walk: 'Walks and climbs', burrow: 'Burrows through soil' };
      facts.push(`<b>Alive.</b> ${where[d.critter.moves]}`);
      const eats = DEFS.filter((e) => d.critter.food[e.id] && e.id !== ID.SALT_WATER).map((e) => e.name);
      if (eats.length) facts.push(`Eats <b>${esc(eats.join(', '))}</b>`);
      if (d.critter.tough) facts.push('<b>Survives heat and cold</b>');
    }
    if (d.stalk) facts.push('<b>Grows straight up</b>');
    if (d.behavior === 'magnet') facts.push(d.magnet > 1 ? `<b>Magnet</b>, ${d.magnet}× the usual pull` : '<b>Magnet</b>');
    if (d.behavior === 'electromagnet') facts.push('<b>Magnetic while current flows</b>');
    if (d.behavior === 'battery') facts.push(d.batteryRate < 1 ? '<b>Weak battery</b>' : '<b>Battery</b>');
    if (d.excite) facts.push('<b>Glows</b> when excited');
    if (d.hotSpark) facts.push(`<b>Sparks</b> when heated past ${fmtTemp(d.hotSpark.temp)}`);
    if (d.flame) facts.push(`Burns with a <b style="color:${d.flame}">coloured flame</b>`);
    if (d.uvBlock) facts.push('<b>Blocks ultraviolet</b>');
    if (d.xrayOpaque) facts.push('<b>Stops X-rays</b>');
    if (d.wet && !d.projectile) facts.push('<b>Heated by microwaves</b>');
    if (d.conductor) facts.push('<b>Conducts electricity</b>');
    if (d.transparent) facts.push('<b>Transparent</b>');
    if (d.reflect >= 0.8) facts.push('<b>Reflects light</b>');
    if (d.nAbsorb >= 0.3 && !d.always) facts.push('<b>Absorbs neutrons</b>');
    if (d.moderator) facts.push('<b>Slows neutrons</b>');
    if (d.acidProof) facts.push('<b>Acid-proof</b>');
    if (d.projectile) facts.push(`Speed <b>${d.speed} cells/frame</b>`);
    if (d.charge) facts.push(`Charge <b>${d.charge > 0 ? '+' : '−'}1</b>`);
    const sub = d.number ? `No. ${d.number} · ${stateName(d)}` : stateName(d);
    box.innerHTML = `<div class="inspect-head">${mini(d)}
        <div><div class="inspect-title">${esc(d.name)}</div><div class="inspect-sub">${sub}</div></div></div>
      <p>${esc(d.desc)}</p>
      ${facts.length ? `<ul class="facts">${facts.map((f) => `<li>${f}</li>`).join('')}</ul>` : ''}`;
  }

  // ---- recipe tree: the count and the card ----------------------------------

  // Undiscovered elements whose ingredients the player already has.
  available() {
    const { progress } = this.game;
    return COLLECTIBLE.filter((d) => !progress.known(d.id)
      && rulesFor(d.id).some((r) => RULES[r].inputs.every((i) => progress.known(i))));
  }

  renderTreeCount() {
    const n = this.game.progress.freePlay ? 0 : this.available().length;
    const count = $('tree-count');
    count.hidden = n === 0;
    count.textContent = `${n} to try`;
  }

  // The recipes for d the player can see: those whose ingredients they have.
  knownRecipes(d) {
    const { progress } = this.game;
    return rulesFor(d.id)
      .filter((r) => RULES[r].inputs.every((i) => progress.known(i)))
      .map((r) => `<li class="recipe-text">${esc(ruleLabel(RULES[r]))}</li>`)
      .join('');
  }

  // The card for a node clicked in the tree: how a discovered element is
  // made, or the hint for an undiscovered one. In hard mode only things still
  // to make get a card, with the tree's link into them (`link`): the process
  // and one ingredient, but not the hint, which would give the rest away.
  showCard(id, link = null) {
    const { progress } = this.game;
    const d = DEFS[id];
    const known = progress.known(id);
    const close = `<button type="button" class="tree-card-close" data-close aria-label="Close">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.1L8 6.6l4.5-4.5 1.4 1.4L9.4 8l4.5 4.5-1.4 1.4L8 9.4l-4.5 4.5-1.4-1.4L6.6 8 2.1 3.5z"/></svg></button>`;
    let body;
    if (progress.hard) {
      if (known || !link) { this.hideCard(); return; }
      const shown = clue(link);
      const recipe = shown === null ? '?' : `${DEFS[shown].name}${' + ?'.repeat(link.inputs.length - 1)}`;
      body = `<div class="inspect-head">${mini(d)}
          <div><div class="inspect-title">${esc(d.name)}</div><div class="inspect-sub">No. ${d.number} · Not made yet</div></div>${close}</div>
        <div class="tree-card-label">${esc(processName(RULES[link.rule]))}</div>
        <p class="recipe-text">${esc(recipe)}</p>`;
    } else if (known) {
      const how = d.start
        ? '<p class="desc">One of the four elements you start with.</p>'
        : `<div class="tree-card-label">Made by</div><ul class="tree-card-list">${this.knownRecipes(d)}</ul>`;
      body = `<div class="inspect-head">${mini(d)}
          <div><div class="inspect-title">${esc(d.name)}</div><div class="inspect-sub">No. ${d.number} · ${stateName(d)}</div></div>${close}</div>
        ${how}<p class="desc">${esc(d.desc)}</p>`;
    } else {
      const how = progress.revealed.has(d.key)
        ? `<div class="tree-card-label">Recipe</div><ul class="tree-card-list">${this.knownRecipes(d)}</ul>`
        : `<button type="button" class="reveal" data-reveal="${id}">Show the recipe</button>`;
      body = `<div class="inspect-head">${mini(d, false)}
          <div><div class="inspect-title">Undiscovered</div><div class="inspect-sub">You have everything it needs</div></div>${close}</div>
        <p>${esc(d.hint)}</p>${how}`;
    }
    const card = $('tree-card');
    card.innerHTML = body;
    card.hidden = false;
    this.cardId = id;
    this.cardLink = link;
  }

  hideCard() {
    $('tree-card').hidden = true;
    this.cardId = null;
    this.cardLink = null;
  }

  bindCard() {
    $('tree-card').addEventListener('click', (e) => {
      const reveal = e.target.closest('[data-reveal]');
      if (reveal) {
        const id = Number(reveal.dataset.reveal);
        this.game.progress.reveal(id);
        this.showCard(id);
        if (this.onReveal) this.onReveal(id);
        return;
      }
      if (e.target.closest('[data-close]')) this.hideCard();
    });
  }

  refresh() {
    this.renderMeter();
    this.renderPalette();
    this.renderInspect();
    this.renderToolOptions();
    this.renderTreeCount();
    if (this.cardId !== null) this.showCard(this.cardId, this.cardLink);
  }

  // ---- discovery toast ---------------------------------------------------

  celebrate(id, rule) {
    const d = DEFS[id];
    this.fresh.add(id);
    const how = rule >= 0 ? ruleLabel(RULES[rule]) : '';
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${mini(d)}<div><div class="toast-eyebrow">New element · No. ${d.number}</div>
      <div class="toast-name">${esc(d.name)}</div>${how ? `<div class="toast-how">${esc(how)}</div>` : ''}</div>`;
    const box = $('toasts');
    box.prepend(el);
    while (box.children.length > 3) box.lastElementChild.remove();
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 320);
    }, 4200);
  }

  // ---- HUD -----------------------------------------------------------------

  renderHud(world, hover) {
    const cell = $('hud-cell');
    if (this.flashUntil && performance.now() < this.flashUntil) {
      cell.textContent = this.flashText;
    } else if (!hover || !world.inBounds(hover.x, hover.y)) {
      cell.textContent = 'Point at a particle to inspect it';
    } else {
      const i = hover.y * world.w + hover.x;
      const t = world.type[i];
      const p = world.pressureAt(hover.x, hover.y);
      const sep = '<span class="sep">·</span>';
      let name = t ? DEFS[t].name : 'Air';
      const c = world.ctype[i];
      if (c && t === ID.SPARK) name = `Spark on ${DEFS[c].name}`;
      else if ((c & 0x7fff) && t === ID.FIRE) name = `Burning ${DEFS[c & 0x7fff].name}`;
      else if (c && t === ID.CLONE) name = `Clone of ${DEFS[c].name}`;
      if (world.loose[i]) name += ' (torn loose)';
      // With convection on, the air has a temperature of its own.
      const airT = world.air.heat ? fmtTemp(world.air.t[world.air.at(hover.x, hover.y)]) : '';
      let temp = t ? `${sep}${fmtTemp(world.temp[i])}` : '';
      if (airT) temp += t ? `${sep}air ${airT}` : `${sep}${airT}`;
      const notes = cellNotes(world, i);
      if (notes.length) temp = `${sep}${esc(notes.join(' · '))}${temp}`;
      cell.innerHTML = `<b>${esc(name)}</b>${temp}${sep}pressure ${p >= 0 ? '+' : ''}${p.toFixed(1)}${sep}x ${hover.x} y ${hover.y}`;
    }
  }

  renderStats(count, flying, fps) {
    const rays = flying ? ` · ${flying.toLocaleString('en-US')} in flight` : '';
    $('hud-stats').textContent = `${count.toLocaleString('en-US')} particles${rays} · ${fps} fps`;
  }
}
