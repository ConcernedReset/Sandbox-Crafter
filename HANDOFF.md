# Handoff: Sandbox Crafter

A falling-sand physics sandbox (modelled on The Powder Toy) crossed with an
element-crafting game. You start with Sand, Water, Fire and Dirt and discover
the other 563 elements by making things happen in the simulation. The README
covers gameplay, physics and every recipe; this file is the short version for
whoever picks the project up next.

## Where things are

- **Repo:** `concernedreset/sandbox-crafter`, all work on branch
  `claude/sandbox-element-crafter-hke8ck` (no PR has been opened).
- **Playable copy:** https://claude.ai/artifact/2zw1ZdoK1hw18KpwcgNDgo (a
  private Claude artifact that mirrors the repo; see "Publishing" below).

## Running and testing

Plain ES modules, no dependencies, no build step. Node 18+.

```sh
npm start   # serves the folder at http://localhost:8080 (PORT to change)
npm test    # node --test: about 1,330 tests, all passing, in a few seconds
```

`file://` won't work because browsers block ES modules there; use the server,
or `npm run build`, which writes `dist/sandbox-crafter.html` (committed, so
rebuild it before committing source changes): one file with the
CSS and every module inlined that runs from disk. `scripts/build.js` only
understands the import/export forms the code uses now (named imports,
`export const/let/function/class`, `export { a, b }`) and throws on anything
else; `test/build.test.js` checks the bundle runs.

## How the code is laid out

| Path | What it does |
| --- | --- |
| `src/sim/elements.js` | The first 40 elements, the field docs, and the compiler that turns every table into lookups (`DEFS`, `REACT`, `HIT`, `PAIR`, `RULES`) |
| `src/sim/elements-*.js` | The other element tables: `expansion` (next 100, particle hits), `periodic`, `chemistry`, `world`, `machines`, and `more` (gap-fillers added after an audit: missing reactions, uses for dead ends) |
| `src/sim/lookups.js` | Per-element flags packed into typed arrays for hot loops |
| `src/sim/world.js` | The grid (400 × 240, parallel typed arrays), movement, heat, reactions, pressure tearing, painting tools |
| `src/sim/behaviors.js` | Named per-element behaviours (fire, sparks, plants, creatures, black holes...) |
| `src/sim/particles.js` | The flying-particle layer (photons, neutrons...) outside the grid, including reflection and light colour |
| `src/sim/machines.js` | Power, switches and sensors, doors, lamps and other machines |
| `src/sim/air.js` | Coarse pressure / wind grid (4 × 4 cells per block), plus air temperature for convection |
| `src/sim/gravity.js` | Gravity settings and the per-air-block gravity table; the Newtonian solver (`Solver`) |
| `src/sim/fft.js` | Radix-2 FFT used by the Newtonian solver |
| `src/render/renderer.js` | Draws the grid, glow, particles, minimap; heat and pressure views |
| `src/render/tree-view.js` | Draws the recipe tree under the game; drag, zoom and click handling |
| `src/game/tree.js` | Recipe tree layout (pure, tested): which elements show, one link into each, columns and rows |
| `src/game/physics-panel.js` | The Physics strip: gravity dial, strength box, Newtonian and convection switches; saves settings |
| `src/game/` | Input (brush, lines, boxes, zoom gestures), camera, UI, saved progress, demo scene |
| `scripts/recipe-table.js` | Prints the README's spoiler recipe table |

## Things to know before changing anything

- **Elements are data.** Add one by adding an entry to a table and giving it a
  recipe (a transition, a contact reaction or a particle hit). The compiler
  throws on duplicate keys or two reactions for the same pair.
- **Every recipe is tested in the real simulation.** `test/recipes.test.js`
  builds a small lab for each rule and fails if the output never appears.
  Awkward setups go in its `CONTACT_SETUPS`. Every element must also be
  reachable from the starting four, and needs a hint, a description and a
  unique symbol.
- **After changing recipes**, regenerate the README table:
  `node scripts/recipe-table.js` and paste it over the table at the end.
- **Cell state:** `type`, `temp`, `life`, `ctype`, `vx`/`vy`, `shade`,
  `loose`, `clock`. `ctype` is overloaded: a spark's conductor, a fire's fuel,
  a clone's copy, a switch's position. `life` is a machine's power timer.
- **Machines** don't carry current themselves: controls power what touches
  them and spark wires; wires power machines beside them. Power floods a whole
  connected block of one machine type. Doors open by vanishing and remember
  their footprint in `doorTimer`.
- **Light colour** is `ptint` (an element id) per photon. It's set by
  reflecting off a surface or passing through a clear solid or liquid.
  Reflection, laser and ruby colours win over clear materials; the Mirror and
  Beam Splitter never tint.
- **Fire needs air.** Every Fire cell lowers its air block's pressure by
  `FIRE_DRAW`; below `SNUFF_AT` flames go out (embers turn back into their
  fuel) and `World.ignite` refuses (it returns false), except for explosives
  and fuels that don't burn into Fire. Both constants are in `behaviors.js`.
  The recipe lab for burn rules is a box open on one side for this reason.
- **Radioactive elements are stable until disturbed.** Elements in the
  `nuclear` category get `stable: true`. In still air they emit nothing and
  warm and decay at `REST` times their rates; pressure raises their activity;
  hard particles can be absorbed and "kick" an atom (`kick` in
  `particles.js`), which uses the particle up, so only fission multiplies
  neutrons. Constants are in `constants.js`. Their `decay` compiles to rule
  kind `'decay'` ("X + Decay"), and the recipe lab for it pumps pressure.
- **Recipe tree:** each element is shown with its shortest known recipe;
  process names come from `processName` in `src/game/tree.js`. Clicking an
  element narrows the tree with `focusTree` (its sources, its products by any
  known recipe, their partner ingredients, and onward); recipe loops such as
  carbon dioxide and dry ice are cut where they close. The tree
  only redraws when something changes, so call `setTree` after progress
  changes (main.js does this for discoveries, free play, reset and reveals).
- **Gravity is a table, not "y + 1".** Movement reads `world.gravity`'s
  per-air-block arrays: `gx, gy` (pull in g), `ux, uy` (unit vector), `mag`,
  and `dirA/dirB/mix` (the two nearest of the 8 neighbour directions, ring
  S, SW, W, NW, N, NE, E, SE, and the chance of the second). Behaviours with
  a built-in up or down (fire embers, seeds, stalks, fireworks, clouds,
  lightning, creatures, plates, blasts) use the 4-way `downX/downY` instead.
  Write new code against these, not against `i + w`.
- **The straight-down fast path.** With the arrow down, strength ≥ 1 and
  Newtonian off (`gravity.straight`), `movePowder`/`moveLiquid`/`moveGas`
  hand over to `movePowderDown`/`moveLiquidDown`/`moveGasUp`, the original
  plain code, because the general code is about a fifth slower. A test
  (`gravity.test.js`) runs a scene both ways and requires identical results,
  so change both paths together.
- **Newtonian gravity costs nothing while off.** The solver and field arrays
  are built on first use; `stepGravity` weighs the blocks (`MASS` in
  lookups.js) and solves every other frame, about 2 ms.
- **Convection** is off in a bare `World` (tests rely on that), but the Physics
  panel turns it on at start (`DEFAULTS` in physics-panel.js). Off, it touches nothing: `conductHeat`
  keeps the old leak to room temperature. On, `warmAir` trades heat with the
  air of each empty neighbour, and `Air.stepHeat` does buoyancy, carrying,
  blurring and cooling. Buoyancy compares each block with the average of the
  air around it (`localMean`, a box blur), not with room temperature: that is
  what makes cooled air sink and the loop close. The heat's share of the
  pressure is `EXPAND × (t − room temperature)`, applied as the change
  since last frame (`tPressed`), so it can't drift: never add to `p`
  directly when the air's temperature changes. `heatArea` (the Heat and
  Cool tools) also changes the air. Constants are at the top of `air.js`.
- **Plutonium and protons work as in The Powder Toy.** A fission's settings
  (see the field docs in elements.js) can add pressure per split (`pressure`),
  make splits likelier under pressure (`boost`), set what's left to the
  maximum temperature (`hot`) and throw out protons. Flying particles have a
  temperature (`ptemp`, set from the cell they came from); protons pass
  through matter and pull what they pass towards it.
- **Light speed** in clear materials is `LIGHT_SPEED` in lookups.js (1 over
  the refractive index), applied to photons and ultraviolet each frame.
- **Balance numbers live in tests.** If you retune physics (pressure, particle
  impact heat, reactor behaviour), expect the pressure, radiation and
  mechanics tests to need their thresholds revisited. Some are ratios that
  vary with the random seed, so leave some slack.
- **Content line:** the recipes lean on real chemistry, but keep explosives,
  weapons and drugs purely in-game. Don't add real-world synthesis or
  containment instructions, in code, hints or docs.

## Publishing the playable copy

The artifact is `index.html`'s `<title>`/stylesheet lines plus the body
contents, published with `style.css` and every file under `src/` as supporting
files at the same relative paths. New source files have to be added to the
published file list, or the page will fail to load them: that now includes
`src/render/tree-view.js`, `src/game/tree.js`, `src/sim/elements-more.js`,
`src/sim/gravity.js`, `src/sim/fft.js` and `src/game/physics-panel.js`.

## Possible next steps

Nothing is half-finished. Ideas that came up or would fit:

- Logic gates (NOT, AND) and a delay line for machines. The power model has
  no direction, which is the tricky part.
- Directional fans and pistons.
- Saving and loading drawings.
- Plain scroll currently changes brush size; zoom needs Ctrl held. Swapping
  that is a one-line change in `src/game/input.js` if players prefer it.
- A PR to the default branch when the owner is ready.
