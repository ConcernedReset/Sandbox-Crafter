# Handoff: Sandbox Crafter

A falling-sand physics sandbox (modelled on The Powder Toy) crossed with an
element-crafting game. You start with Sand, Water, Fire and Dirt and discover
the other 554 elements by making things happen in the simulation. The README
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
npm test    # node --test: about 1,020 tests, all passing, in a few seconds
```

`file://` won't work because browsers block ES modules there; use the server.

## How the code is laid out

| Path | What it does |
| --- | --- |
| `src/sim/elements.js` | The first 40 elements, the field docs, and the compiler that turns every table into lookups (`DEFS`, `REACT`, `HIT`, `PAIR`, `RULES`) |
| `src/sim/elements-*.js` | The other element tables: `expansion` (next 100, particle hits), `periodic`, `chemistry`, `world`, `machines` |
| `src/sim/lookups.js` | Per-element flags packed into typed arrays for hot loops |
| `src/sim/world.js` | The grid (400 × 240, parallel typed arrays), movement, heat, reactions, pressure tearing, painting tools |
| `src/sim/behaviors.js` | Named per-element behaviours (fire, sparks, plants, creatures, black holes...) |
| `src/sim/particles.js` | The flying-particle layer (photons, neutrons...) outside the grid, including reflection and light colour |
| `src/sim/machines.js` | Power, switches and sensors, doors, lamps and other machines |
| `src/sim/air.js` | Coarse pressure / wind grid (4 × 4 cells per block) |
| `src/render/renderer.js` | Draws the grid, glow, particles, minimap; heat and pressure views |
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
published file list, or the page will fail to load them.

## Possible next steps

Nothing is half-finished. Ideas that came up or would fit:

- Logic gates (NOT, AND) and a delay line for machines. The power model has
  no direction, which is the tricky part.
- Directional fans and pistons.
- Saving and loading drawings.
- Plain scroll currently changes brush size; zoom needs Ctrl held. Swapping
  that is a one-line change in `src/game/input.js` if players prefer it.
- A PR to the default branch when the owner is ready.
