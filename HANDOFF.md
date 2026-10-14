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
npm test    # node --test: about 1,775 tests, all passing, in two or three minutes (most of it the human situations)
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
| `src/sim/war.js` | Humans' war: building the helipad, anti-air gun and missile launcher (the engineer), the anti-air gun and its shells, raids, births, mending the hut |
| `src/sim/aircraft.js` | The helicopter and missiles: shaped creatures with minds of their own (`e.craft`): flying, shooting, craters |
| `src/sim/planting.js` | A camp whose trees near it run low sends a human out to plant saplings round it (`plantChores`, `plantSpots`, `plantWork`) |
| `src/sim/grudges.js` | Each camp's anger at the others, hitting back (a raid, or a tunneller's C4 under the enemy hut, wired home to a plunger), and charges going off |
| `src/sim/paths.js` | Overland route planning for humans: A* over the places a body can stand or hang (`findPath`), following the plan move by move (`followPath`, `planWay`) |
| `src/render/ai-overlay.js` | Show spheres of influence / Show AI data: camp ranges, huts, lawns, tunnels, claims, members (`drawInfluence`); each human's trail, route, target and goal label (`aiPlan`, `drawAI`, `AITrails`), drawn on the canvas after the picture (`Renderer.showInfluence`, `showAI`) |
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
  `Air.settle` finds it still (`AIR_STILL`, `HEAT_STILL`). Asleep or not,
  `step` still visits every particle (it counts the airtight ones in each
  air block, and `world.count`), so it works out each row's air block once
  (`airRow`) rather than calling `air.at` for each; and `conductHeat` jumps
  over the rest of a fully asleep chunk's row at once. A world with much
  more ground (Deep tribes, three times the particles of Two tribes) was
  1.8 times slower a step for walking over its sleeping stone; now 1.2.
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
  cell. Humans don't walk across a burning pile (`acrossFire`), walk
  through each other (SHARED pixels, below), and treat their own fire's flames over the
  pile, and warm ground round it, as safe; but a reflex (`scorched`) steps
  them back from anything over 100 °C within 2 cells, every step, before
  they think (flames cook a pixel in one touch). After the first lighting
  the hut comes before keeping the fire fed, and only one human tends it
  (`tending`); building material must be open to one side (`openSide`), so
  they don't dig up the floor. A new camp clears flammable ground from its
  fire pit (`clearFirePit`). Swimmers keep `brain.heading` (the way they
  last walked) and resume `wasJob` on leaving the water. Walking
  (`walkTo`) plans the way first (`paths.js`, below) and follows it;
  only with no plan (the search gave up, couldn't tell, or the way kept
  changing under it) does it walk straight at the target as follows. Up
  against a wall
  higher than a step, they first look at it (`cutThrough`): at most
  `THIN_WALL` (4) columns thick at body height, or `SOFT_WALL` (8) if it's
  all wood or growth (a tree trunk), and all diggable, they dig through it.
  Otherwise they climb it, all the way up wherever the target is
  (`climbWall`: a cell every `WALL_EVERY` (12) steps, holding on with
  `brain.hold`/`brain.climbing`; a climb counts as progress only above
  `brain.climbTop`, the highest yet on this walk, so a climb-and-drop
  under an overhang still gives up). Unable to climb (an overhang, a
  ceiling), or with the target itself in the wall just ahead (stone from a
  boulder), they dig (`digToward`) one
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
  drops nothing: what it carried, its tool, gun and armour go with it
  (`forgetCreature` clears its items; it used to spill them round where
  it lay). The pile is lit as **Campfire**
  (`kindle`, `updateCampfire` in behaviors.js); `acrossFire` only cares
  about real Fire, and `stepCamps` (once a step) counts `camp.burned` and
  ages `world.shots`. Crafting (`craftWork`) starts when `canCraft`: the
  hut done and `camp.burned` >= `CRAFT_FIRE_TIME`; order pickaxe,
  levelling the lawn (`flattenWork`, below), gunpowder (`wantsPowder`),
  gun, armour (`craft`).
- **Planning the way** (`paths.js`): `walkTo` calls `followPath`. `findPath`
  is A* over feet positions, in the gravity's frame, using the human's
  real shape: `bodyOf(kind)` gives the cells any walking pose covers (room
  is checked against all of them, so any pose fits) and, per pose (2
  frames x 2 facings), its feet. A place is standing if some pose rests on
  something (`footInfo`: ground, water to swim in, or tunnel "boards"
  as `overTunnel` holds a body: open tunnel inside, but not right on a
  network spot, and only at a mouth (`onBoards`: open air, not tunnel,
  over its head); `overTunnel` holds it up anywhere off the spots, but
  planning ways through a mine's workings on boards led overland ways
  down its shafts, and a human leaving by the mouth walked straight back
  in), or hanging if there's a wall to climb (`wallBeside`).
  Moves: walk a cell (up to a 2 step, else duck a step down; then drop to
  wherever it lands, `MAX_FALL` 80), dig a cell across (level, up or
  down a step; only cells it can dig, never anything `madeByHuman`),
  climb a cell up a wall. Costs in steps: walk 1, step up +0.3, swim 3,
  boards 2, climb 3, dig 1 + 2 per cell, fall 0.05 a cell. Each place
  remembers the pose it stands in, and `followPath` moves into exactly
  that pose (`moveBody` with that frame and facing), so the plan and the
  game agree. Off the plan (exactly, or 2 cells either way in line with a
  place it walked to, never one it's yet to climb to) it plans again, up
  to `MAX_REPLANS` (6), then walks straight at it. Progress (for
  `GIVE_UP`) is only reaching further along than ever. `findPath`
  returns null (no way: the target is given up on at once, and `walkTo`
  doesn't search for that place again for `NO_WAY_FOR` (300) steps,
  `brain.noWay`: a job with no target cell to ban could otherwise search
  every step) only when the human's own spot fits the body model; with `PATH_NODES` (8000) places
  looked at, or in a box `MARGIN` (60) round it and the target, it gives
  up looking (undefined: walk straight at it). Room and footing are
  remembered for the length of a search (`pathMemo`). A typical search
  takes well under a millisecond; the rare biggest ~30-40 ms. Wander goals
  avoid water (`wetAt`). Tested in `test/paths.test.js`; `world.pathStats`
  counts the outcomes.
- **Levelling the camp** (`grounds.js`): the lawn (`lawn(camp)`) is
  `LAWN_R` (20) columns either side of the hut, level with the hut's
  ground row. One human at a time (`camp.flattener`; others carry on
  crafting) with a pickaxe works out from the hut a column at a time
  (`lawnWork`, `lawnColumn`): solids up to 10 above the level dug away
  top-down (wood fells its tree), empty cells down to 4 below filled with
  scaffolding bottom-up (a deeper pit is bridged), skipping the fire pit,
  its ash (which keeps sliding in), ponds, tunnels, human-made cells and
  banned cells. Job `'flattening the
  camp'` (`flatten`); wood for scaffolding is gathered when it has none.
  `camp.flat` once nothing is left. No deposit within `LAWN_DEEP` (8)
  under any lawn is mined (`inLawn` in `findDeposit`), and entrances keep
  `ENTRY_GAP` clear of it. Tested in `test/grounds.test.js`. Mining:
  `startMining(e, b, camp, key, goal)` (tunnels.js) with `RESOURCES` keys,
  `findDeposit` (buried is fine), then `mine`; a resource out of reach is
  skipped for `BAN_FOR` (`brain.skip`). Dig strength comes from `DIG` (1
  for powders, else the solid's strength) against `digLimit` (30 by hand,
  150 with the pickaxe).
- **War** (`war.js`, `aircraft.js`): after `craftWork`, `warWork` gives a
  human with its own gun and armour the camp's war machines, one human at
  a time (`camp.engineer`, cleared in `leaveCamp`), once `warReady` (hut
  done, lawn flat, `canCraft`). Order: `camp.firstWar` ('heli' or 'aa',
  picked with `rand` on first use), the other, then the launcher; a
  machine it can't get on with (`warStep` 'stuck') is skipped for the next.
  Blueprints live on the camp (`camp.pad`, `camp.aa`, `camp.launcher`,
  planned by `warPlan`, retried after `PLAN_RETRY`): `{ name, cells, mats
  ('stone'|'metal'), us, set, done, u0, w, base, ... }`, built bottom-up
  with `putDown` (so `madeByHuman` protects them). The pad goes on the hut
  roof if `SKY` rows over it are clear but for wild growth (`wild`: growth,
  or wood nobody put there; cleared when the helicopter is built), else
  `findSite` on the lawn: ground within 2 of the lawn level (dips filled
  by `supports`), clear of the fire, the rest spots, the hut and each
  other; the gun nearest the hut, the launcher and a lawn pad farthest.
  Jobs: 'building the helipad / anti-air gun / launcher' (`warBuild`),
  'building the helicopter' (`buildHeli`, `HELI_METAL` 10), 'loading the
  anti-air gun' (`loadAA`, to `AA_CAP` 20 when under `AA_LOW` 8),
  'loading the launcher' (`loadLauncher`: `MISSILE_POWDER` 4 +
  `MISSILE_METAL` 2 makes a missile in the tube); stone is fetched
  ('fetching stone', which `chooseWork` then routes here), metal and
  coal/salt mined (`powderFor`; `wantsMore` for salt now honours
  `wantN`). `warCarryingOn` keeps them going. Builders stand 3 cells off a
  ground machine (`standFor`), and step back if their own body is in the
  cell they're building; liquid in a cell is built over. A machine whose work spot
  the engineer gives up getting to waits `PLAN_RETRY` (`waitUntil`, which
  `buildStep` honours, so it gets on with another); one never reached
  from three different places (12 cells apart: from where it rests, the
  way can be shut a while) with nothing built is planned again elsewhere
  (`camp.badSites` keeps it off that span). The launcher waits until the
  other two are up or have nowhere to go (it would spend the helicopter's
  metal). `campChores` also keeps the fire pit clear of growth (`PIT_U`
  either side, `PIT_UP` up): a sapling by the pile grew into a tree that,
  with the pile, cut the camp's hut side off from where everyone rests.
  Aircraft are shaped creatures (Helicopter, Missile: `cat: null`,
  `always`) with a mind in `e.craft` (never `e.brain`), built by
  `buildCraft` (loose stuff, liquid or growth in the footprint is swept
  aside first; they grow ring by ring, and wait if blocked) and stepped by
  `stepCraft` instead of the animal step: no `orient`, no `fling`, mending
  only while `craft.mend` (on the pad, `MEND_EVERY` 30; parked, it stays till
  mended all the way, or no pixel has mended for `MEND_STUCK`). `creatureDies`
  hands them to `craftDies` (a helicopter falls as loose Metal scrap with a
  small blast; a missile `detonate`s). Helicopter (`stepHeli`): 'parked'
  until `heliCall` (its camp raiding, or enemy people within `DEFEND_R`
  of home: `enemyNear`'s `people`; an enemy helicopter or missile alone
  doesn't send it up, two of them couldn't fight it out; on a raid it
  waits `HELI_WAIT` for the missile), 'flying' (`heliFight`: flyby
  passes centred on the enemy people nearest the goal, or its fire,
  `k.cx/cy`; `k.phase` 'approach' (out to its own side at `CLIMB_H`),
  'dive' (to `STRAFE_H` at the near end, `PASS_HALF` out), 'pass'
  (straight across to the far end, low: `heliToward`'s `low` skips the
  cruising height), 'climb' (`PASS_OUT` on, up to `CLIMB_H`), then
  `k.dir` flips and it dives again; a point not reached in `PASS_MAX`
  is given up on. `heliShoot`: a `pellet` every `HELI_GUN_EVERY` (3)
  at the nearest enemy, person or aircraft, within `HELI_GUN_R` (20) in
  sight; cruise `HELI_CRUISE` over the ground), 'home' when the raid ends,
  the defence goes quiet, or it's `HELI_RETREAT` hurt; 'down' with no camp.
  Pellets bounce off it `HELI_ARMOUR` of the time (a missile,
  `MISSILE_ARMOUR`: an anti-air burst is what stops one). Moving (`heliMove`), it
  sweeps aside (`sweepFor`) powders, rubble and wild growth or tree wood in
  its way (a leaf or a branch caught in the gaps of its shape used to pin
  it), and `heliToward` tries every way out before giving up a step
  (`heliStep`); boxed in (another helicopter, a human, an overhang:
  `HELI_STALL` moves without getting 3 cells from one spot) it moves any
  way it can for `HELI_ESCAPE` moves; its targets keep `EDGE` from the
  world's edges. Set down away from its pad ('down'), it tries for home
  again after `HELI_DOWN_FOR`. Missile
  (`stepMissile`): 'loaded'; `launch` sends it up `MISSILE_BOOST`, then
  along `k.way`: straight up to `APEX` (80) over the higher end of its
  way, across at that height, and straight down on the target (a
  diagonal dive ran into the trees round the camps); its way keeps
  `TURN_ROOM` inside the world. It turns its nose (`NOSE` ahead of its
  anchored tail) at most `MISSILE_TURN` a step, speeding to 2 a step and
  pointing in 8 directions (its gx/gy is the way it came from). Leaving
  its tube it sweeps aside loose stuff and growth (sand on its fins);
  after that it tears through what's `wild` (growth and tree wood: in
  Deep tribes, with the surface high up, missiles ran into trunks;
  `sweepFor` with `leavesOnly`) and
  goes off on anything else it hits (but waits up to `MISSILE_HOLD` for
  its own side to move); losing `MISSILE_TOUGH` (3) pixels sets it off;
  `crater` clears the middle, breaks solids loose round it, then a `blast`
  of 30. Paths treat Helicopter and Missile cells as solid (`MACHINE` in
  paths.js). Anti-air (`stepAA`, every step for a built gun): a target
  every `AA_LOOK` (`aaTarget`: another camp's flying missile, then
  helicopter, phoenix, other shaped fliers, then single-cell insects by a
  grid scan every `AA_SCAN`; within `AA_R` (100), `AA_UP` above the gun,
  judged where it would aim, not within `AA_SAFE` of the middle of any of
  its own people, nor its own missile in its tube or parked helicopter
  (`nearOwn`), in sight by
  `aaSight`, which, like the shells (`shellPasses`), goes through leaves
  and other growth: camps sit in forests), tracked and led; the
  barrel turns `AA_TURN` a step; a shell (`world.flak`, `SHELL_SPEED` 2.5,
  fuse set for the distance give or take `AA_FUSE_ERR`, aim give or take
  `AA_JITTER`) every `AA_EVERY` (30) for one gunpowder; `stepFlak` bursts
  it (`flakBurst`: a blast of 6, insects near it killed) at its fuse or on
  hitting anything. `stepWar` runs from `World.step` whenever there are
  camps or shells (not only with creatures). Raids (`campChores`, once a
  second per camp): the clock (`camp.raidAt`) starts with the first war
  machine, `raidGap` `RAID_MIN`..`RAID_MAX` (18,000-36,000 steps), and
  at full anger runs `ANGER_RUSH` (10) times as fast (each chores takes
  9 more `CHORES_EVERY` off it);
  `startRaid` against `nearestRival`: `ceil(members * RAID_SHARE)` armed
  members (not the engineer, not in a tunnel) get `brain.raid`, the
  missile is launched at `aimPoint` (the enemy hut's roof) and the
  helicopter follows; with no rival or nothing to send it tries again
  after `RAID_RETRY`. Raiders: `raidWork` (before sheltering in
  `chooseWork`) keeps 'raiding' (`raidMarch` to `RAID_NEAR` of the
  enemy's fire; the fighting comes from `think`'s `findFoe`), then 'going
  home'; `strayed` ignores a raider. `raidOver`: `RAID_FOR` up, the enemy
  gone, or nobody (nor the helicopter) still at it. `findFoe` also takes
  another camp's flying aircraft. Births (`campChores`): hut done (or
  `noHut`), `canCraft`, fire `burning`, under `POP_CAP` (10): a Human seed
  in the hut (or by the fire) every `BIRTH_EVERY` (3,000) where a body has
  room (`bear`, `roomForBaby`); on its first thought it joins the camp
  whose hut it's in, or else the nearest within `CAMP_JOIN` (`campFor`,
  which `joinOrMakeCamp` uses: it used to take the first in the list). An
  engineer that loses its gun or armour gives the role up. A done hut missing cells is mended (`hut.done = false`), or,
  its floor gone, planned again (`camp.hut = null`, and the lawn and a
  roof pad with it: `camp.hut` can now go back to null, so anything reading
  it must check, as `shelter` does). A living helicopter is sent to its
  camp's current pad (`warStep`), and `warCarryingOn`, `warBuild` and
  `buildHeli` drop a blueprint the camp no longer has. Five older bugs
  this showed up: `giveUp` now lets go of a wall
  (`climbing = false`; a human clinging in a tree crown, with every plan
  unreachable, held on for ever); `prey` never counts a human (a newborn
  has no brain until its first step, and was hunted); `startMining`
  weighs up several deposits (now the camp's plan: see Tunnels), banning
  each it can't plan a tunnel to with `banNear`, instead of giving up on
  a resource whenever the nearest is out of reach; a swimmer up against
  a wall it can't climb out at turns round after `SWIM_TURN` strokes
  (`swimBlocked`; it swam into the pond's high side for ever, half a grown
  camp at once); and `findDeposit` skips deposits with liquid within
  `UNDER_WATER` (20) above (`underWater`: a tunnel to the coal under the
  Wilderness pond let the pond in, and its miners swam in the flooded pit
  for good).
  Overlay: `craftPlan` labels aircraft, `campLabel` shows the machines
  and the raid clock, `drawInfluence` boxes the sites and draws a raid
  arrow; the renderer's `paintWar` draws shells, barrels, rotors and a
  missile's flame; `cellNotes` names machine parts. Tested in
  `test/war.test.js`. Keep it game-only, like the gun.
- **Testing tools** (grudges.js, buttons `#tribe-tools` over the world,
  shown with Show spheres of influence, main.js; each takes `only`, the
  camp picked in `#tribe-pick` (`campNumber`, refreshed as camps come and
  go), or null for all; `endWars(only)` ends the wars on both sides,
  `makePeace(camp, foe)`): `startWars` (`goToWar`
  with every other camp, full anger at `nearestRival`, `startRaid` at
  once, else `raidAt` now), `endWars` (anger, `wars`, `sapFor` cleared;
  the tunneller freed (`freeSapper`, no failure counted); raiders'
  `brain.raid` cleared, so helicopters fly home; `raidAt` 0: the clock
  starts again with a war machine), `kitOut` (every human: pickaxe, gun,
  `ARMOUR_HITS` armour, and `KIT`: wood 200, stone 100, metal 100,
  copper 100, coal 100, gunpowder 200).
- **Grudges** (`grudges.js`): going to war: `startRaid` calls
  `goToWar` both ways; the first time a camp meets an enemy so
  (`camp.wars`) it marks it `camp.sapFor`, and its chores start a
  tunneller against it (`startSap(camp, enemy, 'war')`, `s.cause`)
  once it has nobody tunnelling and `sapRetry` is past; a war job that
  fails sets `sapFor` again (an anger one puts the anger back instead).
  `camp.anger` (0..`ANGER_MAX` 100) at
  `camp.grudge` (the camp that last angered it), raised by `anger(camp,
  by, n)`: `pelletHits` now takes the shooter (a human's or a
  helicopter's camp) and calls `struck` (`ANGER_HIT` 2, and
  `brain.hitBy`/`hitAt`); `forgetCreature` calls `mourn` (dead within
  `KILL_WINDOW` of such a hit: `ANGER_KILL` 25); `detonate` calls
  `missileLanded` (`ANGER_MISSILE` 50 to camps within `ANGER_NEAR_R`);
  a charge going off, `ANGER_BLAST` 60. `campAnger` runs from
  `campChores` (once a second): each enemy human / flying helicopter
  within `ANGER_R` (80) adds 1 / 2 and sets `camp.enemyAt`; with none
  it cools `ANGER_COOL` (0.25), but not from full. At full and
  `CALM_FOR` (1,800 steps) after the last enemy near, `hitBack`: with
  `wmdReady` (a grown helicopter or loaded missile) `startRaid(camp,
  enemy)` (which now takes the target; anger to 0); else `startSap`
  picks a tunneller (a pickaxe, not the engineer, not raiding) into
  `camp.sap`: `{ id, enemy, side, stage, ... }`. `sapWork` (in
  `chooseWork` right after `raidWork`) runs it by stage: 'gathering'
  (`sapGather`: gunpowder kneaded into `SAP_C4` (8) C4 items at
  `SAP_POWDER` (2) each, keeping `AMMO_LOW` for its gun; by the fire,
  camp-mates hand over what they can spare (`share`, humans.js); its
  wood trips only take wood nearer home than the enemy (`gather`'s
  `keep`: deep under the enemy, the nearest was by the enemy's camp,
  and it walked in among them); then `sapPlan` and metal for
  the wire estimated from the plan, `WIRE_PER_METAL` 20),
  'digging' (`sapDigWork`: wood for lining under `TUNNEL_LINING`, from
  as far as `SAP_WOOD_R`, but after `WOOD_TRIES` trips with no spot dug
  it digs with what it has; more lining in hand counts as headway for
  `SAP_STALL`; then `b.tun` with
  `sap: true`, `every: SAP_DIG_EVERY` (1) and `burst: SAP_DIG_BURST`
  (3: `tunnelDig` works the spot up to 3 times a step; a miner, once
  every 8; at 4 it took about 40 steps a spot, and wars were often won
  or lost before the tunnel got there), job 'tunnelling', which
  tunnels.js's `tunnelGo`/`tunnelDig` dig as for mining but call
  `sapDug` per spot and `sapArrived` at the end; `sapPlan` continues
  from `s.endX/endY`, or else digs straight from the cheapest start: a
  spot on its own camp's tunnels (`netDistances` from its entrances
  within `OWN_R` and nearer it than the enemy, plus `NEW_COST` a spot
  dug) or a new entrance on the enemy side, to `sapTarget`: `SAP_DEPTH`
  (30; it was 10) under the enemy hut's middle (under its floor, the row
  the hut stands in). There `sapArrived` turns it straight up (`s.depth`
  to `SAP_TOP`, 8: its head 2 cells under the ground) and it digs on; at
  the top it charges, and the charge's `depth` is measured from the C4,
  so the blast's top crater is at the floor. Its wire also follows the
  roof (`layWire`'s cells over its head: down the shaft, a wire on the
  wall the run came in from reaches the roof, with no way to the floor
  but through the tunnel), and never goes in `s.own` (the boxes of the
  spots it dug and its first spot: the mouth's open box above ground isn't
  marked inside). Tests run it on deeper ground (`field(..., 130, 70)`,
  `w.ground`). Of the `PLAN_TRIES` cheapest starts
  it takes one whose run passes `pathClear` if there is one, else the
  cheapest, digging straight through the tunnels in the way (`workSpot`
  finds their spots open and it walks on, held, so it doesn't fall down
  a shaft). It used to look deeper (down to 70), then for a way round
  (A* over spots clear of other tunnels); in long games the ground
  between the camps was so full of mines that it often found none),
  'charging' (`sapCharge`: `chargeCells`, the cells against its spot
  farthest ahead, filled a cell every `PLACE_EVERY` with `putDown`;
  then a charge in `world.charges`), 'wiring' (`sapWire`: out through
  `leaveTunnel`, then `walkTo` the `plungerSpot` (`PLUNGER_U` past the
  lawn, out to `PLUNGER_FAR` more, on the side it came out, else the
  other: ground with no tunnel under it; the plunger 3 cells nearer the
  camp); with no such spot (a camp's ground cratered by raids) or no way
  there, `plungerHere` puts it at the wire's end where it stands; `layWire` lays Copper under or
  beside its feet as it moves, joined to the end so far by `joinWire`,
  the cheapest short run (Dijkstra with a bucket per cost) through
  `wireOK` cells (never in a tunnel's inside), or open air at
  `AIR_COST`, a tunnel's inside too (round a cratered tunnel mouth, or
  across another tunnel it dug through, the wire is strung across the
  gap; ground-only, it broke there), but never its own tunnel's inside
  (`s.own`, the boxes of the spots it dug, from `sapDug`) nor its body's
  box: strung through them, across a cave it wrapped itself in wire; a cell of wire per 1/20 metal; `putDown`, so `madeByHuman`
  keeps miners off it, and lining it replaces loses `LINED`), 'firing'
  (`sapFire`: kneel `SAP_PRESS`, `sparkAt` the plunger cell; the spark
  runs along the copper and `updateSpark` ignites the C4). Anything it
  can't get on with just now (`powderFor`/`startMining` 'stuck', no
  wood, no plan) makes it wait by the fire `SAP_WAIT` (`sapWait`); it
  gives up (`endSap(camp, true)`: anger back to full, `sapRetry` after
  `SAP_RETRY`) after `SAP_GATHER_FOR` gathering, `SAP_STALL` without a
  spot dug, `SAP_FOR` in all, `SAP_FIZZLE` after pushing with no bang,
  or if it dies or leaves (`leaveCamp`); `strayed` ignores it, `think`
  doesn't send it fighting (`isSapper`: it still flees) unless an
  enemy's bullet hit it in the last `DEFEND_FOR` (300) steps (never
  shooting back, it was shot down in the enemy mines it dug across), and
  `startRaid` never takes it. `stepCharges` (from `stepWar`, which now
  also runs while there are charges): a charge any of whose cells isn't C4
  any more is blown `BLOW_DELAY` later (`blowCharge`: `crater`s from
  the charge up to the hut's floor, at most `BLOW_STEP` apart:
  `BLOW_CHARGE`, `BLOW_MID`, `BLOW_TOP`; whatever set it off).
  `leaveCamp` no longer splices a camp that's already gone
  (`splice(-1)` dropped another). Overlay: `campLabel` shows anger and
  the tunnel stage, `aiPlan` the tunneller's jobs, `paintWar` the
  plunger, `cellNotes` the charge, wire and plunger. Tested in
  `test/grudges.test.js` (camp helpers shared with war.test.js in
  `test/camps.js`). Game-only, like the rest of the war. In Two tribes
  long runs (6 seeds, 100,000 steps) camps hit back with raids in every
  seed, but no tunnel bomb went off: tunnellers were sent, and one dug
  201 spots, packed its charge and wired it back to the surface, but late
  on the camps run short of salt (gunpowder), metal and wood within reach,
  and the ground round them is cratered by raids (the plunger spot and
  the wire's way out). The test field shows the whole job working.
- **Sharing** (`share` in humans.js): a human by its camp's fire (within
  `SHARE_R`) is handed what camp-mates there can spare, up to what it
  needs: gunpowder over `AMMO_LOW`; metal from those with gun and armour
  already; wood from those resting or wandering. Never from the engineer,
  the tunneller or raiders. Called before it sets off to get it:
  `craftWork` (pickaxe wood, gunpowder, gun metal and wood, armour metal),
  `startMining` (lining wood), `warStep`/`buildStep` (the engineer's
  metal and gunpowder) and the tunneller. `gather`/`findWanted` take a
  `keep(x, y)` filter (kept as `brain.fetchKeep` for the rest of the
  trip). Tested in `test/camp-life.test.js`.
- **Planting** (`planting.js`, from `campChores`): every `PLANT_EVERY`
  a lit camp counts the tree wood (`WOOD` nobody put there) and saplings
  within `FUEL_R` (`treesNear`); under `WOOD_LOW` (60) with fewer than
  `SAPLINGS_MAX` saplings, the idle member nearest the fire (not the
  engineer, tunneller or a raider) becomes `camp.planter` with
  `brain.plant`: up to `PLANT_N` spots from `plantSpots` (soil, the
  cell over it empty, `SKY` rows of open air, outside every lawn, no
  tunnel within `NO_TUNNEL` under it, `PLANT_GAP` across from any tree,
  sapling or other spot; nearest first, alternating sides). Job 'planting
  saplings' (`plantWork`): walk to `STAND` cells camp-side of the spot,
  kneel `PLANT_FOR`, `spawn` a Sapling (not `putDown`: its tree is
  anyone's). A planter that stops planting is let go (`plantChores`,
  `leaveCamp`). The Deep tribes world (`deepTribes` in scenes.js: the
  surface about a third of the way down, so a missile's way over the top,
  `APEX` above, stays in the world and over the trees; `DEEP_DIRT` rows
  of dirt over stone; ore veins as wavy lenses with gaps and caves as
  wandering worms of round hollows, `DEEP_CAVE_TOP` to
  `DEEP_CAVE_BOTTOM` down, both from `noise2`/`fbm`, smooth noise on a
  fixed hash, so the world is the same every time) is for long games: in
  Two tribes the ore within reach ran out.
- **Tunnels** (`tunnels.js`): mining digs tunnels. A spot is where a
  human's feet go; its inside is the 3x6 body box. `workSpot` lines first
  (`looseRound`: powders with the inside below or diagonally below are
  swapped for wood, useful ones pocketed; and open air beside the box,
  over it or under its floor, but for the corners, where it is under
  ground: `openToSky` false, natural ground over it (plants, trees,
  creatures and what humans put there don't count: leaves over a mouth
  once got its above-ground sides lined, and that lining roofed the
  cells under it, a cell at a time, till the mouth was walled in); so a
  run across a cave gets walls, a roof and a floor, and another tunnel's
  inside is left open), then digs the box top row first,
  taking its own lining back. `world.tunnels` holds one network: nodes
  (`entrance`, `junction`, `bend`, `end`: `nodeKind`), straight edges at
  45° steps, the way down it was dug with, and a cell `mask` (INSIDE,
  LINED). `planTunnel` picks the cheapest start (network travel, shafts
  1.5x, plus 4x per new spot, two legs diagonal then straight: `legsTo`) or
  a new entrance (`entranceSpots`: 14-90 cells from camp, clear of the
  hut's lawn and of tunnels, `ENTRY_SPACE` (20) from other entrances,
  not on a tree: `groundAt` takes the top of a trunk for ground, and
  miners climbed trees to dig from there).
  Plans are tried cheapest first (up to `PLAN_TRIES`) and taken only if
  the new run keeps `TUNNEL_GAP` (4) solid cells from every other tunnel
  outside `START_R` (8) of its start (`pathClear`); going on along a seam
  checks the same within `SEAM_START_R` (5), and bans that cell if not.
  `startMining` plans for the camp, not just the miner: of up to
  `VEIN_CHOICES` veins (`findDeposit` with a `keep` filter keeping them
  `VEIN_R` apart, nearest first) it skips any a camp-mate's tunnel for
  the same resource is still on its way to (`veinsBeingDug`: its digger
  farther than `VEIN_R` from its target; it skips the resource
  `VEIN_WAIT`, so it gets on with something else, and once that tunnel
  is there the cheapest way to the vein runs through it), and takes the
  cheapest `planTunnel` (travel plus `NEW_COST` a spot: the least new
  digging; `planTunnel` takes the network distances, worked out once).
  Before, each human took the deposit nearest itself, and two often dug
  parallel tunnels, from two new entrances, to one vein.
  Side-by-side runs merge into one cavern humans can't climb out of. `mine` = `tunnelGo` (`netRoute` waypoints, splitting a
  run into a junction where it starts; from tunnels that don't join up
  with the start, the route goes out and overland to one of its
  entrances (`netSources(e, true)`): before, it came back null, and a
  tunneller in its own mine whose plan started in another mine planned,
  dropped and planned again every step until it gave up) then `tunnelDig` (`growTunnel`).
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
  humans would sit on the mouth). `reachSpot` walks to a
  spot and digs it clear if it has filled; `workSpot` bails out liquid
  (`BAIL` cells, then the spot counts flooded). A human off-spot inside a
  tunnel snaps back on (`backOnNet`, never to an entrance). Tunnel lining
  is protected from gatherers but a walker may dig lining in its way.
- **Humans walk through each other** (creatures.js): a pixel of a human
  that lands in a cell another human holds is `SHARED`: part of its body
  but not drawn (the cell stays the other's); `checkBody` gives it the cell
  back once the other has moved off (`sharing`, `THROUGH`).
  `roomForBody` counts another human's cells as room (and `digToward`
  digs for SHARED pixels too), `supported` doesn't
  count them as ground (no standing on heads), and `moveBody`, growth and
  healing handle SHARED pixels. Only whole, hatched human bodies; other
  creatures still block. So humans never get in each other's way, in the
  open or in a 3-wide tunnel, and any number may mine at once. A human
  leaving a cell another shares hands it over at once (`handOver`, also on
  death and removal), so nothing falls into the gap.
- **Reliability** (the Wilderness pass): Giving
  up on a target bans everything of its kind within `BAN_R`. Any tree
  wood a human takes away or digs out fells the tree it was part of
  (`fell(x, y)`: its wood, and a growing tip (`TREE_WOOD`: Sapling,
  turned to wood), found breadth first through wood joined side to side
  or corner to corner (branches climb away corner to corner), but nothing
  humans put there, falls loose (each chunk woken with `wakeAt`: a crown
  high in still air sleeps, and would hang); leaves within `LEAF_REACH`
  of it, through leaves, scatter. Called from `fetch`, `stepAcross`
  and `followPath` digging through, `workSpot` in a tunnel,
  `clearWild` and the lawn's levelling). It used to need trunk right
  above the cell, and search through leaves too, four ways: a branch, a
  crown, a trunk cut through on a walk, a tree whose search wandered off
  into the forest's canopy and ran out, or a growing tip cut off (which
  grew a new tree in the air) were left hanging out of reach. A growing
  tip (trees.js) also checks its trunk still reaches the soil
  (`trunkRooted`) before it grows; cut off any way, it falls like a seed.
  Felling one while fetching sets `brain.felled`:
  `gatherFelled` then fetches every piece within `FELL_R` of the cut,
  past `GATHER` (for up to `FELL_FOR`; 'gathering wood' carries on while
  it's set).
  Hut sites: up to `HUT_R` (40) from the pile, a climbable step of flat,
  growth cleared (`CLEARABLE`, `clearSite`), and `walkable` from the pile
  (no rock in the way). Fetch targets need room for a body to stand within
  reach (`roomToStand`). The pile holds two rows; a burning pile's
  Campfire counts as fuel (`ON_FIRE`). A one-cell puddle under its feet
  isn't swimming. Walk-digging also tries a 2-cell step up. Measured over
  12 Wilderness seeds and 40,000 steps: armour on all 12, by 6,000-8,700
  steps, nobody dead (from fire 5/6, hut 4/6, armour 0/6 at the start);
  `test/humans-wilderness.test.js` runs seed 2 to armour. Later fixes:
  humans wade water under their waist (`wadeDepth`, `SWIM_DEPTH`; afloat
  over 3+ counts as swimming); doorways are 7 high (a cell of headroom for
  growth or ash underfoot) and a blocked human can duck a step down (never
  into a tunnel); the rest spot is somewhere a body fits (`restSpot`); a
  human more than `CAMP_AWAY_R` (150) from its camp for `CAMP_AWAY_FOR`
  (3000) steps on end, standing, leaves it (`strayed`, in `chooseWork`)
  and joins or makes a camp where it is. A
  camp with no hut site twice over moves (`moveCamp`, to a reachable spot
  where a hut fits, `walkable` now also refusing water and drops) or, with
  nowhere to go, does without (`noHut`: crafting starts without a hut);
  fuel in hand goes on a low fire whoever is tending; entrances keep
  `ENTRY_GAP` from tunnels and from entrances others have planned
  (`entranceClaimed`); a human only snaps back onto the network when its
  whole box is inside (`wholeInside`); felled trees' leaves scatter.
  Probe scripts that measure this (milestones, time per job,
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
  there when changing it. **Two tribes** (`twoTribes`) is the war world:
  three humans at each end (`X` mirrors the left half), a ridge between,
  and enough coal, salt and metal on each side for war machines.
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
