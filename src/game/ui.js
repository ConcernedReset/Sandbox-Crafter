// Builds and updates everything around the canvas: the discovery meter, the
// tool bar, the element palette, the recipe book, toasts and the HUD.

import {
  DEFS, ID, CATEGORIES, COLLECTIBLE, RULES, State, ruleLabel, rulesFor, halfLife,
} from '../sim/elements.js';
import { TOOLS, HEAT_RATE } from './input.js';

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
  erase: {
    name: 'Erase', color: '#c9a39a',
    icon: '<path d="M8 17h9M3.6 12.4l7-7a1.5 1.5 0 0 1 2.1 0l2.9 2.9a1.5 1.5 0 0 1 0 2.1L9.5 16.5H6.6l-3-3a.8.8 0 0 1 0-1.1z"/>',
    desc: 'Removes anything under the brush. Right-click erases with any tool selected.',
  },
  wall: {
    name: 'Wall', color: '#9aa3b2',
    icon: '<path d="M3 4h14v12H3zM3 8h14M3 12h14M8 4v4M12 8v4M8 12v4"/>',
    desc: 'Indestructible and airtight. Build sealed boxes to hold pressure, or containers for liquids.',
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
    this.buildMeter();
    this.buildTools();
    this.bindTabs();
    this.bindBrush();
    this.refresh();
  }

  // ---- discovery meter ---------------------------------------------------

  buildMeter() {
    $('meter-total').textContent = COLLECTIBLE.length;
    $('meter-cells').innerHTML = COLLECTIBLE.map(() => '<i></i>').join('');
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
    $('palette').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-id]');
      if (b) this.game.select({ kind: 'element', id: Number(b.dataset.id) });
    });
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

  setBrush(r) {
    $('brush').value = r;
    $('brush-out').textContent = r;
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
      const tiles = items.map((d) => {
        if (!progress.usable(d.id)) {
          return `<div class="tile locked" style="--cat:var(--cat-${d.cat})" aria-label="Undiscovered element">
            <span class="tile-num">${d.number}</span><span class="tile-sym">?</span><span class="tile-name">???</span></div>`;
        }
        const pressed = selection.kind === 'element' && selection.id === d.id;
        const extra = (this.fresh.has(d.id) ? ' fresh' : '') + (d.sym.length > 2 ? ' long' : '');
        return `<button type="button" class="tile${extra}" data-id="${d.id}" aria-pressed="${pressed}" style="${tileStyle(d)}" title="${esc(d.name)}: ${esc(d.desc)}">
          <span class="tile-num">${d.number}</span><span class="tile-sym">${esc(d.sym)}</span><span class="tile-name">${esc(d.name)}</span><span class="tile-swatch"></span></button>`;
      }).join('');
      return `<section class="group" style="--cat:var(--cat-${cat.key})">
        <div class="group-head">${cat.name}<span>${known}/${all.length}</span></div>
        <div class="tiles">${tiles}</div></section>`;
    }).join('');
    $('palette').innerHTML = groups || `<p class="empty-search">No discovered element matches “${esc(this.filter)}”.</p>`;
    this.fresh.clear();
    if (hadFocus) $('palette').querySelector('[aria-pressed="true"]')?.focus();

    for (const b of $('tools').children) {
      b.setAttribute('aria-pressed', String(selection.kind === 'tool' && selection.id === b.dataset.tool));
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
    if (d.high) facts.push(`Changes above <b>${fmtTemp(d.high.temp)}</b>`);
    if (d.low && !d.low.restore) facts.push(`Changes below <b>${fmtTemp(d.low.temp)}</b>`);
    if (d.flammable > 0 && d.ignite < 5000) facts.push(`Ignites at <b>${fmtTemp(d.ignite)}</b>`);
    if (d.explode > 0) facts.push('<b>Explosive</b>');
    if (d.pressure) facts.push(`Gives way above pressure <b>${d.pressure.above}</b>`);
    if (d.strength > 0) facts.push(`Tears loose above pressure <b>${d.strength}</b> (less when hot)`);
    if (d.emits || d.fission) facts.push('<b>Radioactive</b>');
    if (d.decay) facts.push(`Half-life <b>≈ ${fmtDuration(halfLife(d.decay.chance))}</b>`);
    if (d.fission) facts.push(`Splits into <b>${d.fission.neutrons} neutrons</b>`);
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

  // ---- recipe book -------------------------------------------------------

  // Undiscovered elements whose ingredients the player already has.
  available() {
    const { progress } = this.game;
    return COLLECTIBLE.filter((d) => !progress.has(d.id)
      && rulesFor(d.id).some((r) => RULES[r].inputs.every((i) => progress.has(i))));
  }

  renderRecipes() {
    const { progress } = this.game;
    const avail = this.available();
    const badge = $('recipe-badge');
    badge.hidden = avail.length === 0;
    badge.textContent = avail.length;

    const knownRules = (d) => rulesFor(d.id)
      .filter((r) => progress.freePlay || RULES[r].inputs.every((i) => progress.has(i)))
      .map((r) => esc(ruleLabel(RULES[r])));

    const tryNext = avail.map((d) => {
      const revealed = progress.freePlay || progress.revealed.has(d.key);
      const how = revealed
        ? `<div class="recipe-text">${knownRules(d).join('<br>')}</div>`
        : `<button type="button" class="reveal" data-reveal="${d.id}">Show the recipe</button>`;
      return `<div class="hint-card">${mini(d, false)}<div><p>${esc(d.hint)}</p>${how}</div></div>`;
    }).join('');

    const found = COLLECTIBLE.filter((d) => !d.start && progress.has(d.id)).map((d) => `
      <div class="recipe-row">${mini(d)}<div><div class="name">${esc(d.name)}</div>
      <div class="how">${knownRules(d).join(' · ')}</div></div></div>`).join('');

    const starters = COLLECTIBLE.filter((d) => d.start).map((d) => d.name).join(', ');
    const locked = COLLECTIBLE.length - progress.count - avail.length;

    $('recipes').innerHTML = `<div class="book">
      <p class="book-intro">Mix, heat, cool, squeeze and electrify what you have. Each time something new forms in the chamber, it's added to your palette. You started with ${esc(starters)}.</p>
      ${avail.length ? `<section><h3>Try next</h3><div class="book-list">${tryNext}</div></section>` : ''}
      ${found ? `<section><h3>Discovered</h3><div class="book-list">${found}</div></section>` : ''}
      ${locked > 0 ? `<p class="locked-note">${locked} more element${locked === 1 ? '' : 's'} need ingredients you haven't found yet.</p>` : ''}
      ${progress.count === COLLECTIBLE.length ? '<p class="book-intro">You\'ve discovered every element. The whole table is yours.</p>' : ''}
    </div>`;
  }

  bindTabs() {
    const tabs = [$('tab-elements'), $('tab-recipes')];
    const panels = [$('panel-elements'), $('panel-recipes')];
    tabs.forEach((tab, k) => tab.addEventListener('click', () => {
      tabs.forEach((t, j) => t.setAttribute('aria-selected', String(j === k)));
      panels.forEach((p, j) => { p.hidden = j !== k; });
    }));
    $('recipes').addEventListener('click', (e) => {
      const b = e.target.closest('[data-reveal]');
      if (!b) return;
      this.game.progress.reveal(Number(b.dataset.reveal));
      this.renderRecipes();
    });
  }

  refresh() {
    this.renderMeter();
    this.renderPalette();
    this.renderInspect();
    this.renderRecipes();
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
    if (!hover || !world.inBounds(hover.x, hover.y)) {
      cell.textContent = 'Point at a particle to inspect it';
    } else {
      const i = hover.y * world.w + hover.x;
      const t = world.type[i];
      const p = world.pressureAt(hover.x, hover.y);
      const sep = '<span class="sep">·</span>';
      let name = t ? DEFS[t].name : 'Air';
      const c = world.ctype[i];
      if (c && t === ID.SPARK) name = `Spark on ${DEFS[c].name}`;
      else if (c && t === ID.FIRE) name = `Burning ${DEFS[c].name}`;
      else if (c && t === ID.CLONE) name = `Clone of ${DEFS[c].name}`;
      if (world.loose[i]) name += ' (torn loose)';
      const temp = t ? `${sep}${fmtTemp(world.temp[i])}` : '';
      cell.innerHTML = `<b>${esc(name)}</b>${temp}${sep}pressure ${p >= 0 ? '+' : ''}${p.toFixed(1)}${sep}x ${hover.x} y ${hover.y}`;
    }
  }

  renderStats(count, flying, fps) {
    const rays = flying ? ` · ${flying.toLocaleString('en-US')} in flight` : '';
    $('hud-stats').textContent = `${count.toLocaleString('en-US')} particles${rays} · ${fps} fps`;
  }
}
