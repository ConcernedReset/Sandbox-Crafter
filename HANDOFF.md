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
npm test    # node --test: about 1,670 tests, all passing, in about a minute (most of it the human situations)
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
| `src/render/renderer.js` | Draws the grid, the Gas and Glow effects, particles, minimap; heat and pressure views |
| `src/render/tree-view.js` | Draws the recipe tree under the game; drag, zoom and click handling |
| `src/game/tree.js` | Recipe tree layout (pure, tested): which elements show, one link into each, columns and rows |
| `src/game/physics-panel.js` | The Physics strip: gravity dial, strength box, Newtonian and convection switches; saves settings |
| `src/game/` | Input (brush, lines, boxes, zoom gestures), camera, UI, saved progress, the ready-made worlds (`scenes.js`) |
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
- **Machine code** lives in three mix-ins: `machines.js` (power, controls,
  logic and sensors, doors and valves, heater, cooler, igniter, neutron
  source), `machines-air.js` (fan, pipe networks, pump) and
  `machines-motion.js` (conveyor, piston). Piston Arm is a hidden `always`
  element. The Safety Valve has no crush rule on purpose.
- **Power has a direction.** `powerCell(j, from)` records, for the whole
  block it powers, the cell the power came from (`powerFrom`) and the way it
  was going (`powerDir`, a DX4/DY4 index; -1 from the Spark tool). Every
  caller passes a source. Conveyors use `powerFrom`, pistons `powerDir`.
- **Inverters** are fed through `feedInverter`, not the block flood:
  `ctype` counts the frames it stays fed, `powerDir` is its output side.
  Power from its output side, or from a wire cell it sparked itself in the
  last 3 frames (`echo`), is ignored. An unfed inverter calls
  `findInverterInput` every 15 frames (tracing wires back to a source) so it
  never answers into its own input wire, where its pulses would cancel the
  switch's.
- **Delay Lines** are also outside the flood: `ctype` is the charge
  countdown, `life` the rest after firing (the rest is what makes it
  one-way).
- **Pipe networks** (`machines-air.js`): pipe and pump cells push themselves
  onto `pipeCells` during the update; `stepPipes` rebuilds the networks
  every 10 frames or when the count changes. A pipe opens only at its ends
  (cells with one network neighbour); an opening is two blocks (beside it,
  and the next one out), because a pipe can seal its own block.
- **Wall is a perfect container** (`test/walls.test.js`). `conductHeat`
  pins it at room temperature. `Air.label` splits the open air blocks into
  regions (relabelled only when the blocked map changes): `OUTSIDE` is
  everything joined to the border ring, and each sealed pocket gets its own
  number. Blurs, the flow's self-advection and the heat's advection never
  read across regions, and only `OUTSIDE`
  loses pressure (`PRESSURE_LOSS`), heat (`airLoss`), is sponged at void
  edges, or (convection off) cools the particles beside it. A cell in a
  block a wall runs through has no air of its own: `World.airOf` finds the
  nearest open block in a straight line that doesn't cross a wall or strong
  solid, so the cells just inside a one-cell wall use the box's air and the
  ones just outside the room's. Pressure added in such a block is still lost
  (blast balance depends on it). Every projectile bounces off Wall
  (`hitCell`, plus a check for slipping between diagonal wall cells),
  `blast` skips anything behind a wall (`wallBetween`), and the Glow
  halo's blur stops at blocks with wall in them (`glowBlur`).
- **The wall layer** (`walls.js`): `World.wall` is 0 or `WALL_HERE` plus a
  `PASS` bit per checklist box; `setWall` keeps `meshCount` (for the
  renderer). Something passing through a wall sits in the cell with the
  layer underneath: `canEnter` lets in elements whose `PASS_BIT` the wall
  has, `swap` calls `keepWall` so a wall left empty is WALL again and a
  WALL moved out of place vanishes, and `clearCell` on a passer restores
  the wall (on the WALL itself it removes it, so tests can still open a box
  with `clearCell`). `spawn(i, WALL)` uses `world.wallMask` (the Wall tool
  sets it while painting). The air, heat, particle and blast code check the
  layer, not the type.
- **Time zones** (`time.js`): `World.speed` per cell. `clock` stamps the
  update *pass* (`World.pass`, one higher per pass), not the frame, so the
  extra passes for fast cells (`fastPasses`, over `zoneBox` only) can
  update a particle again; everything timed by frames still uses `tick`.
  Slow cells skip frames (`SLOW_EVERY`); heat between cells uses
  `zoneRate` (as many steps as the slower speed); flying particles move and
  age at their cell's speed.
- **Portals** (`portals.js`): `portalAt` packs (slot + 1) << 17 | end << 16
  | position. Moves stop on a portal cell (`travel`, liquid spreading); the
  particle goes through on its next update (`crossPortal`, at the top of
  `update`), to the matching cell of the other end and one cell out on the
  side it's heading (its velocity across the end, or its fall). Ends are
  read so the turn between them is at most 90°. Flying particles go through
  as they enter (`portalProjectile`); `stepPortalAir` links the air on
  each side of one end to the matching side of the other.
- **Sleeping areas** (`sleep.js`): 16 × 16 chunks, awake, half asleep
  (`chunkAwake` 0: no `update`) or fully asleep (`chunkFull` 1: no
  `conductHeat` either, except its right column and bottom row, which carry
  heat across). `stepSleep` compares every chunk with a snapshot after each
  step: an element change (`chunkMoved`) wakes the chunk and its 8
  neighbours; a temperature change (`chunkWarmed`) or stirring air
  (`airStirs`, one block of margin, since a solid feels its neighbours'
  pressure) brings a fully asleep chunk to half asleep. Awake → half after
  `SLEEP_AFTER` steps with nothing moving when `responsive` finds nothing
  that would answer the current heat and air; half → awake when it does
  (both checked every `CHECK_EVERY` steps, staggered); half → full after
  `SLEEP_AFTER` steps without temperature changes, with still air, when
  `restless` (the same at room temperature) finds nothing. **Anything new
  that changes on its own, or answers heat or air, must be added to
  `RESTLESS`, `responsive` and `restless`**, or it will stall while its
  area sleeps. The setters that change the rules
  (gravity, convection, edges, portals, time zones) call `wakeAll`;
  nothing sleeps under Newtonian gravity. `world.sleeping = false` turns it
  off (tests compare with it). The air skips its whole step while
  `Air.settle` finds it still (`AIR_STILL`, `HEAT_STILL`).
- **Shaped creatures** (`shapes.js`, `creatures.js`): an element with a
  `shape` (frames of small pictures, palette letters, `pulse`) gets the
  `body` behaviour. Each creature is an entity in `world.creatures` /
  `creatureById`; its body is real cells of its element, `ctype` = the
  entity's id, `shade` = the palette slot (the renderer reads `shapeRGB`).
  A lone cell (`ctype` 0) is a seed: `updateBody` hatches it, finding a
  placement for the whole body round it, and `growStep` grows the rest ring
  by ring. `stepCreatures` runs after the particle pass (and fast passes),
  before heat and air: `checkBody` treats any cell that's no longer the
  entity's as a damaged pixel (a cell converted into another shaped
  creature turns the whole creature into it), then age, healing, gravity,
  portals, conveyor pushes, blasts and the animal or human step.
  `initLife` gives shaped cells no life (the entity keeps `age`). **The
  entity contract: anything new that moves or rewrites cells on its own
  must skip shaped body cells (`SHAPED[t]`) or move the whole entity** (see
  `nudgeCreature`, `portalCreature`, `blastCreatures`, `shove`,
  `shutDoor`, `paintCreatures`); anything that changes a body cell is
  damage on the creature's next step. Creatures treat every world edge as
  solid (loops and voids aren't crossed). New creatures get
  `NEWBORN_GRACE` steps before heat can hurt them (a human made by
  lightning is born in heated clay).
- **Humans** (`humans.js`): `stepHuman` keeps the body at 37 °C, handles
  breath (drowning fills the lost pixel with the liquid, so it leaves no air
  pocket) and swimming, falling, then `think` every 8 steps (danger, then
  `chooseWork`) and `act` every step. `brain.job` is the job's
  user-facing name (shown in the inspect line). Camps live in
  `world.camps` with their own frame (`campCell(camp, u, v)`: u across,
  v down from the pile's spot); claims stop two humans fetching the same
  cell. Humans don't walk across a burning pile (`acrossFire`), squeeze
  past each other (`passBy`), and treat their own fire's flames over the
  pile, and warm ground round it, as safe; but a reflex (`scorched`) steps
  them back from anything over 100 °C within 2 cells, every step, before
  they think (flames cook a pixel in one touch). After the first lighting
  the hut comes before keeping the fire fed, and only one human tends it
  (`tending`); building material must be open to one side (`openSide`), so
  they don't dig up the floor. A new camp clears flammable ground from its
  fire pit (`clearFirePit`). Swimmers keep `brain.heading` (the way they
  last walked) and resume `wasJob` on leaving the water. `passBy` squeezes
  past a whole row of humans (up to 14 cells, never through anything
  solid). Walking (`walkTo`) and blocked, they dig (`digToward`) one
  cell of whatever stops a level step, or a step up: only if every blocking
  cell is `diggable` (a powder or a solid of strength <= 30, not hot, not
  a danger, and not `madeByHuman`). `world.humanMade` maps cells to what a
  human put there (`putDown`); an entry counts while the cell
  still holds that element. Weak junk that falls into the fire pile is
  cleared for fuel (`pileSpace`).
  Inventory: `brain.items` (element -> count, no limit; gathering trips aim for `GATHER` = 10), `tool`,
  `weapon`, `armour` (hits left) and `held` (an element, `HELD_PICKAXE` or
  `HELD_GUN`; the renderer's `paintHumans` draws it). `stow` mixes Coal and
  Salt into Gunpowder (`mixPowder`); `gather` fills its hands from
  `findWanted`; jobs under way carry on through `carryingOn`. A dead human
  drops its items (`dropInventory`). The pile is lit as **Campfire**
  (`kindle`, `updateCampfire` in behaviors.js); `acrossFire` only cares
  about real Fire, and `stepCamps` (once a step) counts `camp.burned` and
  ages `world.shots`. Crafting (`craftWork`) starts when `canCraft`: the
  hut done and `camp.burned` >= `CRAFT_FIRE_TIME`; order pickaxe,
  gunpowder (`wantsPowder`), gun, armour (`craft`). Mining:
  `startMining(e, b, camp, key, goal)` (tunnels.js) with `RESOURCES` keys,
  `findDeposit` (buried is fine), then `mine`; a resource out of reach is
  skipped for `BAN_FOR` (`brain.skip`). Dig strength comes from `DIG` (1
  for powders, else the solid's strength) against `digLimit` (30 by hand,
  150 with the pickaxe).
- **Tunnels** (`tunnels.js`): mining digs tunnels. A spot is where a
  human's feet go; its inside is the 3x6 body box. `workSpot` lines first
  (`looseRound`: powders with the inside below or diagonally below are
  swapped for wood, useful ones pocketed), then digs the box top row first,
  taking its own lining back. `world.tunnels` holds one network: nodes
  (`entrance`, `junction`, `bend`, `end`: `nodeKind`), straight edges at
  45° steps, the way down it was dug with, and a cell `mask` (INSIDE,
  LINED). `planTunnel` picks the cheapest start (network travel, shafts
  1.5x, plus 4x per new spot, two legs diagonal then straight: `legsTo`) or
  a new entrance (`entranceSpot`: 10-40 cells from camp, clear of the hut
  and of tunnels). `mine` = `tunnelGo` (`netRoute` waypoints, splitting a
  run into a junction where it starts) then `tunnelDig` (`growTunnel`).
  `stepAlong` moves spot to spot, re-lines, and repairs (`workSpot`);
  undiggable blockage drops the run (`dropStretch`, `prune`). `brain.hold`
  stops `stepHuman` dropping a human in shafts and stairs; `overTunnel`
  lets humans cross a tunnel's mouth overland; `walkTo` first calls
  `leaveTunnel` (out by the nearest entrance). Lining is **Scaffolding**:
  `lineCell` cuts 4 from a wood in the pack when it has none
  (`cutScaffolding`); recovered face lining goes back in the pack as
  scaffolding. Before tunnelling it wants `TUNNEL_LINING` (24) in hand,
  counting 4 per wood (`liningInHand`), and gathers wood if short. The
  recipe lab sends a human tunnelling (`tunnelLab` in recipes.test.js).
  Humans never fetch human-placed wood (`findWanted` skips `madeByHuman`).
  Tested in `test/tunnels.test.js`. A new entrance starts as a shaft
  `ENTRY_DEPTH` (7) deep; entrances keep 14+ cells from the fire (resting
  humans would sit on the mouth). One human in the tunnels at a time
  (`inTunnels`: two can't pass in a 3-wide tunnel). `reachSpot` walks to a
  spot and digs it clear if it has filled; `workSpot` bails out liquid
  (`BAIL` cells, then the spot counts flooded). A human off-spot inside a
  tunnel snaps back on (`backOnNet`, never to an entrance). Tunnel lining
  is protected from gatherers but a walker may dig lining in its way.
- **Reliability** (the Wilderness pass): humans in each other's way trade
  places (`swapPlaces`: exact cells and pose, so it always fits; not more
  often than `SWAP_EVERY`), and head-to-head the younger steps back. Giving
  up on a target bans everything of its kind within `BAN_R`. Taking wood
  with trunk above fells the tree (`fell`: its wood and leaves fall loose).
  Hut sites: up to `HUT_R` (40) from the pile, a climbable step of flat,
  growth cleared (`CLEARABLE`, `clearSite`), and `walkable` from the pile
  (no rock in the way). Fetch targets need room for a body to stand within
  reach (`roomToStand`). The pile holds two rows; a burning pile's
  Campfire counts as fuel (`ON_FIRE`). A one-cell puddle under its feet
  isn't swimming. Walk-digging also tries a 2-cell step up. Measured over
  12 Wilderness seeds and 40,000 steps: fire 11, hut and pickaxe 9, armour
  8 (from fire 5/6, hut 4/6, armour 0/6), usually by 9,000-16,000 steps;
  `test/humans-wilderness.test.js` runs seed 2 to armour. Still weak: two
  seeds never build a hut, one stalls after the pickaxe, one never lights
  its fire. Probe scripts that measure this (milestones, time per job,
  stuck episodes) are worth rewriting when you come back to it.
  Shooting: `findFoe` (Spiders, Phoenixes, `rival` humans), `findPrey`
  (hunting, at most every 2,000 steps), `shootAt` holds fire unless the
  target is first on the line (`lineFirst`), `shoot` fires 4 `pellet`s for
  1 gunpowder, `pelletHits` lets armour take half; `blastCreatures` does
  too. Animals killed by gunfire (`e.shot`) leave Meat. Tests:
  `campfire`, `humans-inventory`, `humans-mining`, `humans-crafting` and
  `humans-guns` test files. The gun and gunpowder are the game's own: keep
  them free of real-world detail. `test/humans-situations.test.js` runs humans through many
  situations with several seeds; add a situation there for any new
  behaviour or any reported misbehaviour. The hut has doorways in both
  walls so it doesn't cut the camp off. Keep their behaviour in-game: no
  real-world fire-starting or weapon detail.
- **Ready-made worlds** (`src/game/scenes.js`): `SCENES` (key, name,
  build, `showcase`), `loadScene(world, key)`; `loadDemoScene` is the
  starting area. Each builder uses `tools(world)` (put/set/rect/box/disc,
  `switchOn`) and the world's own API (portals, time zones, `wallMask`,
  `pressurize`). A showcase sets `world.recording = false`, so `record`
  discovers nothing until `clearAll` (the Clear button) or a play world.
  `test/scenes.test.js` loads and runs every one; keep each scene's checks
  there when changing it.
- **Trees** (`trees.js`): a Sapling falls like a powder until it lands on
  soil, then its ctype holds its looks (shape, leaf scheme, crown
  thickness, thick trunk, height; see the top of the file) and its life the
  trunk still to grow. The sapling climbs, leaving Wood; the crown is grown
  in one step at the end. Leaves' eight colours are grouped into schemes by
  `shade`. Leaves are discovered by the `sapling-leaves` rule.
- **Quality levels** (`World.setQuality`, `src/game/performance.js`):
  'medium' and 'low' run `conductHeat` and `air.step` on alternate steps;
  heat then uses `k < 0.25 ? 2k : 0.5` per exchange (twice the rate, capped
  where a pair would overshoot), and the open-air and convection rates are
  doubled. 'low' caps `pCap` at 4,000 and main.js runs one step per frame.
  `AutoQuality.feed(ms)` is fed each drawn frame's time.
- **Looping edges**: `World.setEdges` ('solid' | 'void' | 'loop'; loops pair
  up). Every step to a neighbouring cell that checks the map's edge goes
  through `World.cellAt`, which wraps across a loop; the straight-down fast
  paths are skipped while anything loops. The air keeps a copy of the
  opposite side in the border ring on looped sides (`Air.wrapRing`), keeps
  the two copies of each seam face equal (`syncSeams`), and `label` joins
  pockets across the seam (`loopRing`, `mirror`), so a world looped all
  round has no outside and leaks nothing.
- **Doors and valves** share the door code; `doorKind` says what an open
  doorway turns back into. An open valve vents itself (`ventValve`), since
  air can't pass a block with any Wall in it.
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
- **Spark is a tool, not a discovery** (`always: true`, like Wall). The
  Spark tool is `World.sparkArea`: empty cells get a spark, anything else
  gets `zap`, what a spark touching it would do (conductors pulse,
  switches press, machines power, explosives light, gases glow, and a
  Spark contact reaction runs its half via `reactOther`). In the tree,
  always-available inputs aren't boxes (`PARTS` in `tree.js`), and a
  recipe needing Spark is labelled "Spark".
- **Recipe tree:** each element is shown with its shortest known recipe;
  process names come from `processName` in `src/game/tree.js`. Clicking an
  element narrows the tree with `focusTree` (its sources, its products by any
  known recipe, their partner ingredients, and onward); recipe loops such as
  carbon dioxide and dry ice are cut where they close. The tree
  only redraws when something changes, so call `setTree` after progress
  changes (main.js does this for discoveries, free play, hard mode, reset
  and reveals).
- **Hard mode** (`progress.hard`, saved; kept by reset) hands out every
  Machines-category element (`progress.given`): `usable` and `known`
  (the tree) include them, `has` and the meter don't. `HARD_BLOCKED` in
  `input.js` lists the tools it takes away (`Input.act` ignores them, the
  tool bar crosses them out). Spark stays, and the Mix tool (`World.mixArea`): it swaps
  random cells under the brush, never indestructible ones, and never touches
  the air. `buildTree({ hard })` gives each node a
  `face` ('name', '?' or 'blank'): found elements are blank, things to make
  are named, every link shows its process. `focusTree` on something to make
  names one ingredient, `clue(link)` (the first input; none when there is
  only one, which would give the whole recipe away), and the card uses
  the same link from the whole tree so the two always agree. Card hints are
  skipped because they spell out recipes, and palette picks don't refocus
  the tree, since what an element makes gives its partners away.
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
  blurring and cooling. Buoyancy is The Powder Toy's Boussinesq mode:
  `BUOYANCY` (1/10000) per degree above room temperature, at most
  `BUOYANT_MAX` (0.01) a frame, colder air sinking. With convection on,
  `Air.step` also drags the flow through the map's edge (`EDGE_DRAG`), or
  a plume pours off the top and the whole world becomes a chimney. Stronger
  buoyancy, or buoyancy against a local average, made the flow chaotic (see
  the rolls test in convection.test.js). The heat's share of the pressure
  is `thermal(t)` (`EXPAND` a degree near room temperature, levelling off
  at `THERMAL_MAX`). Only heat gained or lost moves it: changes since last
  frame from particles and tools (`tPressed`, step 0) and the room's
  cooling (step 4). Heat carried or blurred from block to block moves no
  pressure; counting that set off pressure waves all along a plume. Never
  add to `p` directly when the air's temperature changes. `heatArea` (the Heat and Cool tools) also
  changes the air. Particles trade heat with the air at `TOUCH` (world.js:
  conductivity × `AIR_TOUCH`), at most `AIR_FLUX` a frame; hot air
  radiates (`airLoss`, growing with the cube of absolute temperature), and
  the flow carries heat at most `HEAT_REACH` blocks a frame. Those three
  keep a Star (15 million °C) from heating the whole world through the air;
  `test/heat.test.js` checks it. Constants are at the top of `air.js`.
- **The air is thick, as in The Powder Toy.** `Air.thicken` runs after the
  pressure and velocity updates: it blurs pressure and both velocity fields
  with TPT's 3 × 3 kernel (closed blocks and faces count as the block's own
  value) and advects the velocity along itself (`ADVECT`). Losses are TPT's
  (0.9999 pressure, 0.999 velocity). Peaks come out lower and broader than
  before the change; pressure thresholds in tests were checked against it.
- **No top temperature.** `MIN_TEMP` (absolute zero) is the only clamp; don't
  reintroduce a maximum. Plutonium's `hot` split leaves a cell at least
  `FISSION_HOT` (a million degrees), but only in a lump (`inLump`: 13 of
  the 24 cells around it the same element), so plutonium bred inside a
  uranium pile splits like uranium and the reactor puzzle still works.
- **Display effects** are `renderer.gas` and `renderer.glow`, buttons
  in main.js, saved under `sandbox-crafter:display`. Gas cells (a `wisp`
  opacity in `paint`) go to a half-resolution layer, blurred by the canvas
  (`ctx.filter`, on the GPU) or by `blur` where that isn't supported; only
  the box round the gas is worked on. Glow blurs the per-block light layer
  and keeps `GLOW_LINGER` of last frame's. Both only apply to the Normal
  view.
- **Plutonium and protons work as in The Powder Toy.** A fission's settings
  (see the field docs in elements.js) can add pressure per split (`pressure`),
  make splits likelier under pressure (`boost`), leave what's left at a
  million degrees in a lump (`hot`, see below) and throw out protons. Flying particles have a
  temperature (`ptemp`, set from the cell they came from); protons pass
  through matter and pull what they pass towards it. Neutrons bounce off
  anything that isn't a gas, a radioactive element or a moderator
  (`NEUTRON_STOPS`) and `batter` it: heat, a pressure kick, a chance to
  knock a solid loose. Passing through fuel and moderators keeps the reactor
  puzzle (graphite to run a pile, boron to stop it).
- **Pressure moves phase changes.** `HIGH_PHASE`/`LOW_PHASE` (lookups.js)
  say whether a transition is boiling-like or melting-like; `Air.phaseFactors`
  works out a factor per block each frame (sealed blocks take it from the air
  around them), and `World.phaseTemp` applies it in `update`. With no
  pressure every factor is exactly 1, so thresholds are unchanged.
- **Void edges** are `world.voidEdges` (bits `VOID_TOP` and so on, set with
  `setVoidEdges`). `travel`/`travelAlong` clear a particle that moves out
  through one and set `world.vanished`, which every mover checks; liquids
  treat a void side as a drop, and gases' sideways step can leave too.
  The air's `voidSides` (the same bits) makes `Air.sponge` damp pressure,
  flow and air heat in the last few blocks before a void edge, so waves
  leave instead of reflecting; `conductHeat` lets edge particles lose heat
  out through it.
- **Replace** is `world.replace`, set from the game state by input.js
  before each stroke; `paintArea` overwrites occupied cells when it's on.
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
