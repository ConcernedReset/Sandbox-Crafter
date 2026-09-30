# Fire that uses up air, stable nuclear elements, and a recipe tree

Date: 2026-09-27. Approved in chat. Three independent changes to Sandbox Crafter.

## 1. Flames use up air

**Goal:** fire draws air in and makes a low-pressure pocket; when the pressure
around a flame falls far enough, the flame goes out.

- Every `FIRE` cell (flames and burning embers) adds `-FIRE_DRAW` pressure to
  its air block each frame (`src/sim/behaviors.js`, `burnOut`). Plasma is not
  a flame and is unchanged.
- **Snuffing:** when the pressure a flame feels is below `SNUFF_AT`, it has a
  chance per frame of going out that grows with how far below it is.
  - A loose flame (a flame with no fuel, or one thrown off an ember) disappears.
  - An ember burning a solid, sticky or non-explosive powder fuel turns back
    into that fuel and keeps its temperature.
  - Any other flame disappears (its fuel is spent).
- **No ignition in thin air:** `World.ignite` does nothing while the pressure
  at the cell is below `SNUFF_AT`, unless the element is an explosive
  (`explode > 0`, it carries its own oxidiser) or burns into something other
  than Fire (thermite and friends). Hot fuel left behind therefore relights by
  itself once air comes back (a backdraft).
- **Tuning targets** (values found by tests, starting at `FIRE_DRAW = 0.04`,
  `SNUFF_AT = -3`):
  - A wood fire in the open burns most of the wood, as today.
  - The same fire inside a sealed Wall box goes out while most of the wood is
    still there.
  - Opening the box lets the still-hot wood catch again.
  - Air visibly flows towards a large fire in the Pressure view.
- **Recipes:** the recipe-test lab for `burn` rules is a sealed box; it gets
  an opening so air can reach the flames. Recipe outputs are unchanged.

## 2. Nuclear elements are stable until disturbed

**Scope:** every element in the Radioactive category (`cat: 'nuclear'`, 45
elements). Other elements that radiate (RTG, Cesium, Radium Paint...) are
unchanged.

- The compiler marks these elements `stable: true`.
- **At rest** their self-heating, particle emission and decay run at
  `REST = 1/200` of their table values.
- **Pressure** wakes them: activity = `REST + max(0, |p| - 3) / 20`, capped at
  4. So pressure 23 gives roughly today's rates and a pumped box more.
  `p` is the pressure the cell feels (`pressureOn`, magnitude, so suction
  counts too).
- **Particles** kick them: when a neutron, proton, electron, positron, alpha,
  ion or gamma ray enters a stable cell and no `HIT` rule fired, there is a
  `KICK_CHANCE` (0.3) chance of a kick. A kick:
  - emits each of the element's `emits` particles with chance
    `min(1, chance * KICK_SCALE)`,
  - heats it by `selfHeat * KICK_SCALE`,
  - decays it with chance `min(0.9, decay.chance * KICK_SCALE)`,
  with `KICK_SCALE = 200` as the starting value. The particle then carries on
  as it would have (passes through or is absorbed).
  Kicked cells throw off particles that can kick their neighbours, so a big
  enough pile keeps itself going and a small one fizzles.
- Existing `HIT` rules (neutron fission, neutron capture, alpha bombardment)
  still take priority and are unchanged.
- **Decay becomes its own process.** `decay` fields compile to rule kind
  `'decay'` (label "X + Decay") instead of `'time'`. Hints that say "Wait for X
  to decay" are rewritten to say to squeeze or bombard it. Descriptions that
  promise spontaneous behaviour (Corium keeping itself hot, Californium
  "splits all by itself", a big plutonium ball detonating) are reworded.
- **Tests:** stable piles stay put at rest; pressure and a neutron each wake a
  pile; the reactor, plutonium, radium-chain and oganesson-chain tests start
  their reactions with neutrons or pressure; the recipe lab for `decay` rules
  pumps pressure into the box.

## 3. Recipe tree viewport (replaces the Recipe book tab)

### Placement

- A new `.tree` section directly under the game viewport and its HUD line,
  the same width as the game screen and the same 5:3 shape. The inspector
  stays below it.
- The page now scrolls on wide screens (the game keeps its size); the Elements
  panel is sticky so it stays in view.
- The Recipe book tab and the tab bar are removed. The "to try" count moves to
  the tree's header.

### What it shows

- Every discovered element (every element in Free play), and a `?` node for
  each undiscovered element whose ingredients have all been discovered.
- Each node has one incoming connection: its recipe with the shortest chain
  back to the starters, among recipes whose inputs are all known. Starters
  (and any orphan) are roots.
- A connection runs from each input (one or two) to a junction just left of
  the product, then into the product. The process name is written under the
  junction-to-product segment.
- Process names: Heat, Cool, Pressure, Burn, Time, Decay; for contact rules
  Mix (two elements), Bombard (a particle and an element) or Collide (two
  particles).
- A `?` node shows `?` for its name, and its connection's label is `?` until
  the player reveals the recipe (the existing `progress.revealed` set).

### Layout (`src/game/tree.js`, pure, no DOM)

- `buildTree({ known(id), freePlay, revealed(id) })` returns
  `{ nodes, links, cols }`:
  - node: `{ id, known, col, row, x, y }`
  - link: `{ output, inputs: [ids], kind, label }`
- Column = generation: starters are column 0; a node's column is one more
  than the highest column among its connection's inputs.
- Rows: nodes start in (category, number) order within each column, then a
  few left-to-right barycentre sweeps reorder them by the average row of their
  inputs. Each column is centred vertically.
- Fixed spacing: `COL_W` between columns, `ROW_H` between rows, in tree
  units.

### Drawing and interaction (`src/render/tree-view.js`)

- Canvas, sized for the device pixel ratio, redrawn only when something
  changes (data, pan, zoom, hover, a flash animation). Offscreen nodes are
  skipped.
- Node: rounded box with the category colour, symbol and name. `?` node:
  dashed box with `?`.
- **Drag** pans. **Ctrl-scroll / pinch** zooms at the pointer (plain scroll
  scrolls the page). Two-finger pinch on touch. Zoom buttons (−, fit, +) in a
  corner. Zoom range about 0.3× to 2×.
- **Hover** highlights the node and its connections in and out.
- **Click** a known node: selects that element for painting (if usable) and
  opens a card listing all its recipes whose inputs are known. **Click** a `?`
  node: the card shows its hint and "Show the recipe", which reveals the
  process on that connection. The card is DOM, over the tree's corner, with a
  close button.
- A new discovery rebuilds the layout, keeps the current pan and zoom, and
  flashes the new node.

### UI wiring

- `index.html`: tree section markup; tab bar and recipe panel removed.
- `src/game/ui.js`: recipe book code removed; tree card rendering and the
  "to try" count added.
- `src/main.js`: creates the tree view; refreshes it on discoveries, Free
  play, reset and reveal; routes node clicks.
- `style.css`: tree styles; sticky panel; wide-screen fit-to-window rule
  replaced.

### Tests (`test/tree.test.js`)

- Starting four: only starters are known; every `?` node's inputs are
  starters and its label is `?`.
- Every non-root node has exactly one incoming link, and every input sits in
  an earlier column.
- No two nodes share a column and row.
- Free play: all 558 elements, no `?`.
- A revealed `?` shows its real process name.
- Process names for each rule kind, including Mix / Bombard / Collide.

## Docs

README: fire and radioactivity sections, the nuclear section, the methods
table (Decay), the recipe book → recipe tree, and the regenerated recipe
table. HANDOFF: new file (`src/render/tree-view.js`, `src/game/tree.js`) for
the published file list.

## Not in scope

- Radioactive elements outside the Radioactive category.
- Showing every undiscovered element (only the next step).
- Changing how elements glow at rest.
