// Builds the whole game into one HTML file that runs straight from disk
// (double-click it; no server needed):  npm run build  ->  dist/sandbox-crafter.html
//
// Browsers won't load ES modules from file:// URLs, so every module under
// src/ is wrapped in a function and stitched into a single inline script,
// in dependency order. Each module's imports become reads from the modules
// before it. This only understands the plain forms the project uses:
//   import { a, b } from './x.js';
//   export const / let / function / class name ...
//   export { a, b };

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const IMPORT = /import\s*\{([^}]*)\}\s*from\s*'([^']+)';?/g;
const EXPORT_DECL = /^export\s+(const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm;
const EXPORT_LIST = /^export\s*\{([^}]*)\};?[^\S\n]*$/gm;

const names = (list) => list.split(',').map((s) => s.trim()).filter(Boolean);

// Turn one module's source into a function body that returns its exports.
function wrap(source, key, deps) {
  const exported = [];
  let body = source.replace(IMPORT, (m, list, from) => {
    const dep = deps.get(from);
    return `const { ${names(list).join(', ')} } = __modules[${JSON.stringify(dep)}];`;
  });
  body = body.replace(EXPORT_DECL, (m, kind, name) => {
    exported.push(name);
    return `${kind} ${name}`;
  });
  body = body.replace(EXPORT_LIST, (m, list) => {
    exported.push(...names(list));
    return '';
  });
  if (/^\s*export\b/m.test(body) || /^\s*import\b/m.test(body)) {
    throw new Error(`${key}: an import or export the build doesn't understand`);
  }
  return `__modules[${JSON.stringify(key)}] = (() => {\n${body}\nreturn { ${exported.join(', ')} };\n})();\n`;
}

// Every module reachable from the entry point, dependencies first.
async function collect(entry) {
  const order = [];
  const state = new Map(); // path -> 'visiting' | 'done'
  const sources = new Map();
  const visit = async (file) => {
    if (state.get(file) === 'done') return;
    if (state.get(file) === 'visiting') throw new Error(`Import cycle through ${relative(root, file)}`);
    state.set(file, 'visiting');
    const source = await readFile(file, 'utf8');
    const deps = new Map();
    for (const [, , from] of source.matchAll(IMPORT)) {
      const dep = resolve(dirname(file), from);
      deps.set(from, relative(root, dep).replaceAll('\\', '/'));
      await visit(dep);
    }
    sources.set(file, { source, deps });
    state.set(file, 'done');
    order.push(file);
  };
  await visit(entry);
  return order.map((file) => ({ key: relative(root, file).replaceAll('\\', '/'), ...sources.get(file) }));
}

export async function build() {
  const modules = await collect(join(root, 'src', 'main.js'));
  const script = `'use strict';\nconst __modules = {};\n${
    modules.map((m) => wrap(m.source, m.key, m.deps)).join('\n')}`;
  const css = await readFile(join(root, 'style.css'), 'utf8');
  let html = await readFile(join(root, 'index.html'), 'utf8');
  const styleTag = '<link rel="stylesheet" href="style.css">';
  const scriptTag = '<script type="module" src="src/main.js"></script>';
  if (!html.includes(styleTag) || !html.includes(scriptTag)) {
    throw new Error('index.html no longer links style.css and src/main.js the way the build expects');
  }
  // Nothing inside the inline code may end its tag early.
  const safe = (s, tag) => s.replaceAll(`</${tag}`, `<\\/${tag}`);
  html = html
    .replace(styleTag, () => `<style>\n${safe(css, 'style')}</style>`)
    .replace(scriptTag, () => `<script>\n${safe(script, 'script')}</script>`);
  return { html, modules: modules.map((m) => m.key) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { html, modules } = await build();
  const out = join(root, 'dist', 'sandbox-crafter.html');
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, html);
  console.log(`Built ${relative(root, out)} from ${modules.length} modules (${Math.round(html.length / 1024)} KB).`);
}
