// The recipe tree: which elements it shows, the recipe that links each one
// to its ingredients, and where everything sits. Plain data with no DOM, so
// it can be tested in Node; src/render/tree-view.js draws it.
//
// Columns are generations: the starting elements are column 0 and each
// element sits one column right of its latest ingredient. Each element is
// shown with its shortest recipe (the one reaching furthest back towards the
// starters), so it has exactly one connection in. An undiscovered element
// appears once every ingredient of one of its recipes has been found, as a
// '?' with '?' for the process.

import { DEFS, RULES, COLLECTIBLE, CATEGORIES } from '../sim/elements.js';

export const NODE_W = 136; // node size, in tree units (pixels at zoom 1)
export const NODE_H = 40;
export const JOIN = 64; // how far left of a product its ingredient lines meet
export const COL_W = NODE_W + JOIN + 40;
export const ROW_H = 58;
const SWEEPS = 5; // alternating passes to untangle the lines, ending left to right

const MAKES = DEFS.map(() => []); // rule indices by the element they make
const USES = DEFS.map(() => []); // rule indices by the elements that go into them
RULES.forEach((r, k) => {
  MAKES[r.output].push(k);
  for (const i of r.inputs) USES[i].push(k);
});

const CAT_ORDER = Object.fromEntries(CATEGORIES.map((c, k) => [c.key, k]));
const tableOrder = (a, b) => CAT_ORDER[DEFS[a.id].cat] - CAT_ORDER[DEFS[b.id].cat]
  || DEFS[a.id].number - DEFS[b.id].number;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

const PROCESS = {
  heat: 'Heat', cool: 'Cool', pressure: 'Pressure', burn: 'Burn', time: 'Time', decay: 'Decay',
};

// The word written under a connection.
export function processName(rule) {
  if (rule.kind !== 'contact') return PROCESS[rule.kind];
  const particles = rule.inputs.filter((i) => DEFS[i].projectile).length;
  return particles === 2 ? 'Collide' : particles === 1 ? 'Bombard' : 'Mix';
}

// The recipe for `id` whose ingredients all have a column, choosing the one
// whose latest ingredient comes earliest. Returns { rule, col } or null.
function shortest(id, col) {
  let best = null;
  for (const k of MAKES[id]) {
    let c = 0;
    for (const i of RULES[k].inputs) {
      const ci = col.get(i);
      if (ci === undefined) { c = -1; break; }
      if (ci > c) c = ci;
    }
    if (c >= 0 && (best === null || c + 1 < best.col)) best = { rule: k, col: c + 1 };
  }
  return best;
}

// known(id): discovered (everything, in free play).
// revealed(id): the player asked to see this undiscovered element's recipe.
export function buildTree({ known, revealed = () => false }) {
  const found = COLLECTIBLE.filter((d) => known(d.id)).map((d) => d.id);
  const col = new Map();
  const via = new Map();
  for (const id of found) if (DEFS[id].start) col.set(id, 0);
  // Each pass can only move an element to an earlier column, so this settles.
  for (let changed = true; changed;) {
    changed = false;
    for (const id of found) {
      if (DEFS[id].start) continue;
      const b = shortest(id, col);
      if (b !== null && !(col.get(id) <= b.col)) {
        col.set(id, b.col);
        via.set(id, b.rule);
        changed = true;
      }
    }
  }
  // Found without a known recipe (painted in free play, say): a root.
  for (const id of found) if (!col.has(id)) col.set(id, 0);
  // The next step: undiscovered elements with every ingredient found.
  const next = [];
  for (const d of COLLECTIBLE) {
    if (col.has(d.id)) continue;
    const b = shortest(d.id, col);
    if (b !== null) next.push([d.id, b]);
  }
  for (const [id, b] of next) {
    col.set(id, b.col);
    via.set(id, b.rule);
  }

  const nodes = [...col].map(([id, c]) => ({ id, known: known(id), col: c, row: 0, x: 0, y: 0 }));
  const links = [...via].map(([id, k]) => ({
    output: id,
    inputs: RULES[k].inputs,
    rule: k,
    label: known(id) || revealed(id) ? processName(RULES[k]) : '?',
  }));
  return arrange(nodes, links);
}

// Narrow a tree from buildTree down to one element: the recipes behind it,
// back to the starters; everything it makes directly, by any recipe whose
// ingredients have all been found (undiscovered products included, as '?'),
// with the other ingredients those recipes need; and everything those make
// in turn. Nodes get a role: 'focus', 'source' (behind it), 'product' (after
// it) or 'partner' (another ingredient of a product). Returns null if the
// element isn't in the tree.
export function focusTree(tree, id) {
  const shown = new Map(tree.nodes.map((n) => [n.id, n]));
  if (!shown.has(id)) return null;
  const inLink = new Map(tree.links.map((l) => [l.output, l]));
  const outLinks = new Map();
  for (const l of tree.links) {
    for (const i of l.inputs) {
      if (!outLinks.has(i)) outLinks.set(i, []);
      outLinks.get(i).push(l);
    }
  }
  const role = new Map([[id, 'focus']]);
  const links = new Map(); // product -> the link drawn into it

  // Behind: each recipe back to the starters.
  for (const stack = [id]; stack.length;) {
    const l = inLink.get(stack.pop());
    if (!l) continue;
    links.set(l.output, l);
    for (const i of l.inputs) {
      if (!role.has(i)) { role.set(i, 'source'); stack.push(i); }
    }
  }

  // After: what it makes directly, by the tree's own recipe where that uses
  // it, otherwise by the first recipe that does.
  const usable = (r) => r.inputs.every((i) => shown.get(i)?.known);
  const after = [];
  for (const k of USES[id]) {
    const r = RULES[k];
    const o = r.output;
    if (!shown.has(o) || role.get(o) === 'source' || o === id || !usable(r)) continue;
    const own = inLink.get(o);
    if (own && own.inputs.includes(id)) links.set(o, own);
    else if (!links.has(o)) {
      const open = shown.get(o).known || own?.label !== '?';
      links.set(o, { output: o, inputs: r.inputs, rule: k, label: open ? processName(r) : '?' });
    }
    if (!role.has(o)) { role.set(o, 'product'); after.push(o); }
  }
  // ...and what those make in turn, following the tree.
  while (after.length) {
    for (const l of outLinks.get(after.pop()) ?? []) {
      if (role.has(l.output)) continue;
      role.set(l.output, 'product');
      links.set(l.output, l);
      after.push(l.output);
    }
  }
  // The other ingredients of everything after it.
  for (const l of links.values()) {
    for (const i of l.inputs) if (!role.has(i)) role.set(i, 'partner');
  }

  // Columns: each product one right of its latest ingredient; an ingredient
  // with no recipe shown sits just left of the first thing it goes into.
  // Recipes can go round in circles (carbon dioxide freezes into dry ice,
  // which warms back into it): the link that closes a circle is dropped, and
  // its product is shown as a plain ingredient.
  const col = new Map();
  const busy = new Set();
  const place = (n) => {
    if (col.has(n)) return col.get(n);
    busy.add(n);
    let c = 0;
    const l = links.get(n);
    if (l && l.inputs.some((i) => busy.has(i))) {
      links.delete(n);
      if (role.get(n) === 'product') role.set(n, 'partner');
    } else if (l) {
      for (const i of l.inputs) c = Math.max(c, place(i) + 1);
    }
    busy.delete(n);
    col.set(n, c);
    return c;
  };
  for (const n of role.keys()) place(n);
  for (const n of role.keys()) {
    if (links.has(n)) continue;
    let first = Infinity;
    for (const l of links.values()) if (l.inputs.includes(n)) first = Math.min(first, col.get(l.output));
    if (first < Infinity) col.set(n, first - 1);
  }
  const nodes = [...role].map(([n, r]) => ({
    id: n, known: shown.get(n).known, role: r, col: col.get(n), row: 0, x: 0, y: 0,
  }));
  return arrange(nodes, [...links.values()]);
}

// Place nodes (each with a col) in rows: table order to start with, then
// sweeps that sort each column by where its ingredients sit (going right) or
// its products sit (going left), to keep the lines short and untangled. Each
// column is centred on y = 0.
function arrange(nodes, links) {
  const columns = [];
  for (const n of nodes) {
    n.x = n.col * COL_W;
    (columns[n.col] ??= []).push(n);
  }
  for (let c = 0; c < columns.length; c++) columns[c] ??= [];
  const at = new Map(nodes.map((n) => [n.id, n]));
  const inputsOf = new Map();
  const outputsOf = new Map();
  for (const l of links) {
    inputsOf.set(l.output, l.inputs);
    for (const i of l.inputs) {
      if (!outputsOf.has(i)) outputsOf.set(i, []);
      outputsOf.get(i).push(l.output);
    }
  }
  const place = (list) => list.forEach((n, r) => {
    n.row = r;
    n.y = (r - (list.length - 1) / 2) * ROW_H;
  });
  for (const list of columns) {
    list.sort(tableOrder);
    place(list);
  }
  for (let s = 0; s < SWEEPS; s++) {
    const right = s % 2 === 0;
    for (let k = 1; k < columns.length; k++) {
      const list = columns[right ? k : columns.length - 1 - k];
      const key = new Map();
      for (const n of list) {
        const ids = (right ? inputsOf : outputsOf).get(n.id);
        key.set(n, ids?.length ? mean(ids.map((i) => at.get(i).y)) : n.y);
      }
      list.sort((a, b) => key.get(a) - key.get(b));
      place(list);
    }
  }
  return { nodes, links, columns: columns.length };
}
