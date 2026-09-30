// The single-file build: every module is stitched in and still works.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readdir } from 'node:fs/promises';
import { build } from '../scripts/build.js';

test('the build inlines the stylesheet and every module, with no imports left', async () => {
  const { html, modules } = await build();
  assert.ok(!html.includes('src="src/main.js"') && !html.includes('href="style.css"'));
  assert.ok(html.includes('<style>') && html.includes('.tree-card'));
  const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  assert.ok(!/^\s*(import|export)\b/m.test(script), 'no import or export statements');
  for (const dir of ['sim', 'game', 'render']) {
    for (const f of await readdir(new URL(`../src/${dir}/`, import.meta.url))) {
      assert.ok(modules.includes(`src/${dir}/${f}`), `src/${dir}/${f} is built in`);
    }
  }
  assert.equal(modules.at(-1), 'src/main.js', 'the game starts after everything it needs');
});

test('the built modules run: the simulation steps and a recipe still works', async () => {
  const { html } = await build();
  const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  // Everything but main.js, which needs a page to run in.
  const cut = script.indexOf('__modules["src/main.js"]');
  const modules = vm.runInNewContext(`${script.slice(0, cut)}; __modules`, { console });
  const { World } = modules['src/sim/world.js'];
  const { ID } = modules['src/sim/elements.js'];
  const w = new World(40, 30, 1);
  for (let x = 10; x < 30; x++) { w.spawn(29 * 40 + x, ID.DIRT); w.spawn(28 * 40 + x, ID.WATER); }
  for (let f = 0; f < 300 && !w.seen[ID.MUD]; f++) w.step();
  assert.ok(w.seen[ID.MUD], 'Dirt and Water made Mud');
  assert.ok(modules['src/game/tree.js'].buildTree({ known: () => true }).nodes.length > 500);
});
