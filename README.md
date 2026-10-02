# Sandbox Crafter

A falling-sand physics sandbox crossed with an element-crafting game. You start
with four elements (**Sand, Water, Fire and Dirt**) and discover the other 563
by making things happen in the simulation: pour water on dirt, bake mud, crush
wood under pressure, run electricity through water, split uranium with
neutrons, blast a diamond with plasma. Every new element you make is added to
your palette.

All 118 elements of the periodic table are in there, along with ores, lab
chemicals, gems, alloys, food, creatures, weather and a few legends, and
most of the recipes are real reactions: see [What's in the table](#whats-in-the-table).
There are also machines to build with: switches, buttons, clocks and sensors
driving doors, lamps, laser emitters, heaters and more (see
[Machines and circuits](#machines-and-circuits)).

The physics is modelled on [The Powder Toy](https://powdertoy.co.uk/): sand
piles, liquids level out, air pressure builds and tears things apart, fire
uses up the air, and plutonium goes off like a Powder Toy nuke. A
[Physics panel](#physics-panel) lets you turn gravity any way you like, make
it stronger or switch it off, turn on Newtonian gravity (mass pulls on mass)
and convection (hot air rises in loops), and air pressure moves boiling and
melting points: water boils away in a vacuum. Under the game, a
[recipe tree](#how-to-play) maps everything you've found and what's still
waiting.

## Running it

The quickest way to play is the ready-built single file in the repository:
download `dist/sandbox-crafter.html` and open it in a browser. Your
progress is saved in that browser.

The source is plain JavaScript with no dependencies, and no build step is
needed to work on it. ES modules don't load from `file://`, so serve the
folder:

```sh
npm start          # http://localhost:8080 (set PORT to change)
```

Any static file server works too, e.g. `python3 -m http.server`.

To play without a server, build a single file:

```sh
npm run build      # writes dist/sandbox-crafter.html
```

That one HTML file has the stylesheet and every module inlined, so it runs
straight from disk: double-click it, or send it to someone. It's committed
to the repository, so rebuild it before committing code changes. (Without an internet connection the Google fonts fall
back to system ones; progress is saved per file location.)

## How to play

- **Left-drag** paints with the selected element or tool. **Right-drag** erases.
- **Shift-drag** draws a straight line and **Ctrl-drag** (Cmd on a Mac) a
  filled box; both are painted when you let go. The brush can be round or
  square, from a single cell up to 145 cells across.
- **Zoom** with the `+` `−` buttons in the corner of the view, `+` / `-` on the
  keyboard (`0` goes back to the whole world), Ctrl-scroll (Cmd on a Mac, or
  pinch on a trackpad), or a two-finger pinch on a touch screen. It zooms
  towards the pointer, up to 12×. Pan with the arrow keys, a middle-button
  drag or two fingers, or drag the little map that appears while zoomed in.
- The strip above the simulation describes the selected element or tool.
- **Replace** (next to the view buttons, or `R`): while it's on, painting
  overwrites whatever is in the way, Wall included, instead of only filling
  empty space. Painting an element over itself leaves it alone.
- **Tools:** Erase, Wall (indestructible and airtight), Heat, Cool, Wind (drag
  to blow), Mix, Pressure and Vacuum. Mix stirs whatever is under the brush,
  swapping cells at random so layers blend within a few frames; walls stay
  put and the air is left alone.
- **Views:** Normal, Heat (a thermal camera) and Pressure (the air grid).
- **Keys:** `Space` pause, `.` step one frame, `[` `]` brush size, `1` `2` `3` views,
  `R` replace, `+` `-` `0` zoom, arrows pan.
- The **Recipe tree** under the simulation shows everything you've found,
  each element linked to what it's made from with the process written under
  the line. Elements you have the ingredients for appear as **?**, linked to
  their ingredients with a **?** for the process. Drag to move the tree around,
  and Ctrl-scroll or pinch to zoom. Click an element (in the tree, or in the
  palette) to single it out: the
  tree narrows to the recipes behind it, back to the starting four, and
  everything it can make, including **?**s, with the other ingredients each
  of those needs (drawn fainter), then what those make in turn. A card shows
  all the ways it's made (and it's picked up to paint with); a **?** gets a
  hint and, if you're stuck, the recipe. Click empty space, press `Esc` or
  use **Whole tree** to go back.
- Discoveries are saved in your browser. The `⋯` menu has a free-play mode
  that unlocks everything, hard mode, and a reset.
- **Hard mode** (in the `⋯` menu) takes away the Heat, Cool, Wind, Pressure
  and Vacuum tools, which are crossed out: heat, cold and pressure have to
  come from the elements themselves. Mix still works. It also turns the
  recipe tree round.
  Everything you've found is a blank box, and the elements you could make
  next show their names, with only the process (Mix, Heat, Cool...) under
  the line into them. Click one of them and one of its ingredients appears,
  always the same one; the rest stay blank, and the card skips the hint.
  Something made from a single ingredient shows only its process. The
  boxes never go away, so once you've found everything the tree still shows
  its whole shape. Picking an element in the palette doesn't move the tree
  in hard mode. Resetting discoveries keeps hard mode on.

There are eight ways to combine things (the tree calls contact Mix, and
particle hits Bombard or Collide):

| Method   | Example                                          |
| -------- | ------------------------------------------------ |
| Contact  | Dirt touching Water becomes Mud                  |
| Heat     | Sand above 1700 °C melts into Molten Glass       |
| Cold     | Water below 0 °C freezes into Ice                |
| Pressure | Wood crushed in a sealed Wall box becomes Coal   |
| Fire     | Burning Wood leaves Ash and Smoke (fire needs air) |
| Time     | A Plant that grows thick enough turns woody      |
| Decay    | Squeezed or bombarded, Radium decays into Radon  |
| Particles | A Neutron splits Uranium; light knocks Electrons out of Metal |

### Physics panel

The strip between the status line and the recipe tree changes the rules:

- **Gravity dial.** Drag the arrow to point gravity any way you like (Shift
  snaps to 45°; with the dial focused, the arrow keys turn it 15° and `Home`
  resets it; double-click resets it too). Sand piles against whichever wall
  is "down", water pools on the ceiling when it points up, and smoke and
  steam rise the other way. Trees, stalks, fireworks, rain, lightning and
  walking creatures follow the arrow as well.
- **Strength.** A multiple of normal gravity, from 0 to 10. At 0 nothing
  falls: grains and drops hang where you paint them and drift with the air.
- **Newtonian gravity.** Everything with mass pulls on everything else, as in
  The Powder Toy. Mass is density (Water is 1), so a lump of lead pulls
  harder than a cloud of steam; Neutronium, Pulsars and Black Holes are very
  heavy, and a White Hole pushes things away. Light bends as it passes heavy
  things. Set the strength to 0 and paint a big blob to make a planet: loose
  sand falls onto it from every side and gases gather round it. Solid blocks
  stay put but still pull.
- **Convection.** The air gets a temperature of its own. Hot things warm the
  air beside them; the warm air swells (pushing outwards) and rises against
  the arrow, spreads out, cools, sinks back down at the sides and is drawn
  back in at the base. So a hot block sits in a loop of moving air that
  gradually cools it, and smoke and steam ride round with it (in a closed
  box especially; in the open some of the plume escapes off the top of the
  map). The Heat and Cool tools warm and chill the air too, even over empty
  space: a warm bubble rises, a cold pocket sinks. The Heat view shows the
  air's temperature, and pointing at a cell shows it too.
- **Edges.** A little box whose four sides are the roof, floor and walls of
  the world. Click a side to shade it and that edge becomes a void: anything
  that moves out through it vanishes, so a void floor drains away every loose
  grain and drop, water pours off a void side like a waterfall, and smoke
  escapes through a void roof. Things that stay put, like a stone floor
  along the edge, stay. Pressure waves and heat go out through a void edge
  too, instead of bouncing back off it as they do off a solid one. Void
  edges are marked with a purple line on the game.
- **Reset** puts everything back: down, strength 1, Newtonian
  gravity off, convection on, no void edges (how the game starts). The
  settings are remembered in your browser.

## How the physics works

Like The Powder Toy, the world is a grid (400 × 240) where each cell holds at
most one particle. Per-cell state lives in parallel typed arrays: element
type, temperature, lifetime, velocity and a "ctype" (what a spark is running
through, what a fire is burning, what a clone copies).

Each frame (60 per second):

1. **Particles update** bottom-to-top, alternating left/right to avoid drift.
   ("Bottom" is wherever gravity points: the scan starts from that end.)
   - *Powders* fall, accelerate, and slide off slopes diagonally, so they pile up.
   - *Liquids* fall, then flow sideways, and remember their flow direction.
   - *Gases* random-walk with a buoyant bias against gravity.
   - Anything heavier sinks through lighter liquids and gases (sand sinks in
     water, oil floats on it, steam bubbles up through it).
   - Particles are pushed by the air and can be flung by explosions.
2. **Reactions and phase changes.** Each particle checks one random neighbour
   against a reaction table, and checks its own temperature and the local air
   pressure against its transition points.
3. **Heat** conducts between touching particles according to each element's
   conductivity (diamond and metal are fast, wall is a perfect insulator), and
   anything exposed to open air drifts slowly back to room temperature (with
   convection on, towards the temperature of the air beside it instead).
4. **Air** is simulated on a coarse 4 × 4 grid of pressure and velocity cells
   (`src/sim/air.js`). Pressure pushes air from high to low, walls block the
   flow, and the map edges leak to zero. That's why a sealed Wall box can hold
   the pressure needed to make diamonds, and why explosions send out a
   visible shockwave in the Pressure view.

   **Fire uses up air.** Every flame lowers the pressure around it a little,
   so a fire draws air (and smoke and dust) in towards it. In the open, air
   flows back in as fast as the flames use it and a bonfire burns to the end.
   In a sealed box the pressure keeps falling, and once it drops below −3 the
   flames start going out: loose flames vanish and burning wood turns back
   into (still hot) wood. Nothing catches fire in air that thin, except
   explosives, which carry their own oxidiser, and thermite. Open the box and
   the hot fuel catches again by itself.

   **Gravity** is a table with one entry per air block: how hard it pulls
   there and which way (`src/sim/gravity.js`). Normally every entry is the
   same (the dial's direction times its strength). An in-between angle picks
   between the two nearest of the eight neighbouring cells in the right
   proportion, so a 30° slope comes out at 30° on average. With Newtonian
   gravity on, each block's mass (the sum of its particles' densities) pulls
   on every other block with a 1/r² falloff, worked out every other frame
   with a fast Fourier transform so it stays cheap; when it's off none of
   that runs.

   **Convection** (when switched on) gives each air block a temperature.
   Particles next to empty cells trade heat with that air instead of with the
   room; the air warms three times as fast as they cool, presses harder the
   hotter it is (so heating the air in a sealed box raises its pressure until
   it cools again, and in the open hot air pushes outwards and is drawn back
   as it cools), is pushed against gravity in proportion to how
   much warmer it is than the air around it (so air that has cooled below its
   surroundings sinks), is carried along by the wind, and loses its heat to
   the room. The loop this makes is the convection current.

   **Pressure moves boiling and melting points.** Ten units of pressure
   count as one atmosphere. Boiling points follow the chemists' rule of
   thumb (Trouton's rule), so water boils at about 150 °C at +30 and at
   around 270 °C at the limit, and in a deep vacuum it boils away at room
   temperature; steam condenses at the matching temperature, so the two
   don't flip back and forth. Melting points rise more gently under pressure
   (metal at +150 melts about 230 °C later) and don't fall in a vacuum.
   Solids feel the pressure of the air around them, all the way through.
   Chemical changes, burning and ignition don't move. An element's card says
   "at normal pressure" where this applies.

   Strong solids are airtight too. Anything with a strength of 25 or more
   that isn't itself explosive (glass, stone, metals, gems...) seals any air
   cell it runs an unbroken line across, so a closed shell of it holds
   pressure like Wall does. Unlike Wall, it only holds until the pressure
   inside passes its strength: then the inner face tears, and once a hole
   goes right through, the trapped pressure rushes out all at once and the
   torn pieces are flung outward. Pump a closed box of glass, stone, iron,
   steel and tungsten with the Pressure tool and they give way at roughly 27,
   35, 150, 200 and 240; a thicker shell takes longer to tear through but
   gives way at the same pressure. Wood and other weak solids let air
   through. A particle carrying a spark still counts, so a charge set off by
   a spark run through its shell bursts it from the inside.

   **Pressure tears solids apart.** Every solid has a strength: the pressure it
   can take at room temperature before particles on its exposed surface are
   torn loose. Torn-off pieces stay the same element but become debris that
   the air throws around and that falls and piles like rubble (drawn a
   little darker). Debris still sitting against a surface shields it, so a
   blast strips a structure layer by layer. Heat weakens a solid steadily
   towards its melting point (or, for things that burn, its ignition point),
   down to a tenth of its cold strength.

   | Material | Strength | | Material | Strength |
   | -------- | -------: |-| -------- | -------: |
   | Plant, Flower | 5 | | Brick | 45 |
   | Fuse | 10 | | Granite | 60 |
   | Wood | 12 | | Concrete | 70 |
   | Ice | 15 | | Lead | 60 |
   | Glass | 25 | | Gold | 80 |
   | Stone | 40 | | Metal (iron) | 150 |
   | Obsidian | 50 | | Steel | 200 |
   | Titanium | 220 | | Tungsten | 240 |
   | Diamond | 250 | | Wall, Void, Clone | can't tear |

   For scale: a small gunpowder charge peaks at about 70 next to it, a large
   nitro or C4 charge at 100–190, and the pressure tool in a sealed box can
   be pumped all the way to 256. So a gunpowder blast shreds a wooden shed and
   chips stone, while cold iron needs an enormous point-blank charge or a
   pumped pressure box. Iron at 1000 °C, though, is down to about 60 and gives
   way to a gunpowder blast that doesn't touch it cold.
5. **Electricity** travels along conductors as short-lived Spark particles
   followed by a cooldown, so pulses flow along a wire in one direction.
6. **Flying particles** (photons, electrons, protons, neutrons, positrons and
   neutrinos) live on their own layer, like The Powder Toy's photons, so they
   can pass through matter. Each one flies in a straight line and, in every
   cell it enters, passes through, bounces, is absorbed, or triggers a rule:
   - Light passes through glass, water and crystals, bounces off mirrors and
     metal, and heats whatever absorbs it. Ruby amplifies it (in red).
   - Light slows down inside clear things, as it does for real: to about ¾
     of its speed in water and other clear liquids, ⅔ in glass and clear
     solids, and 0.4 in diamond, then speeds up again as it comes out.
   - Light that bounces off something takes on its colour: off gold it turns
     gold, off copper orange. The Mirror element reflects it unchanged.
   - Light shining through something clear takes on its colour too: blue
     through water, green through emerald. Gases don't colour it, and a clear
     material doesn't recolour light that a mirror, a laser or a ruby has
     already coloured, so a red laser stays red through a window.
   - Bounces follow the slope of the surface, read from the reflecting cells
     around the hit, so a diagonal line of mirror turns a beam through a
     right angle.
   - A mirror reflects all the light that reaches it, with no heat or
     pressure. So does any metal with glass (or another clear solid, such as
     quartz or ice) in front of it: light that reaches it through the glass
     always bounces, while bare metal soaks up some of it and warms.
   - Neutrons fly through gases, radioactive elements (uranium, plutonium,
     radium...) and moderators (graphite, heavy water, which slow them), but
     bounce off anything else solid, powdery or liquid, and every bounce
     batters what they hit: it heats up (about 300 °C), the air kicks, a
     solid may have a piece knocked loose as debris, and a loose grain or
     drop is shoved along. Lead and boron soak them up. Slow neutrons split
     uranium three times as readily as fast ones.
   - Protons fly straight through matter too, as in The Powder Toy, each
     carrying its own temperature: every cell one passes through moves a
     quarter of the way to it, and a proton hotter than 500 °C sets fuel and
     explosives alight on its way. In the end one picks up an electron and
     becomes hydrogen. Smash two together and they make a neutron and a
     pion.
   - Charged particles curve near magnets.
   - Whatever finally stops a particle takes a hit: it heats up (by about
     120 °C for light, 450 °C for an alpha particle, 1800 °C for a heavy ion) and the
     air in front of it gets a kick of pressure, so a heavy beam scorches,
     melts and tears apart whatever it's aimed at.
   - Alpha particles and heavy ions are stopped by the first solid or liquid
     they meet (a sheet of paper stops an alpha) and settle there as atoms.
   - Gamma rays get through most things; the denser the material, the more
     it soaks up, so lead stops them and water barely does.
   - X-rays go straight through water, wood and flesh but not bone or metal.
   - Ultraviolet behaves like light except that ordinary glass blocks it
     (quartz doesn't), and it makes fluorescent minerals glow.
   - Microwaves pass through almost everything, heat anything wet, and
     bounce off metal, sparking it.
   - Muons, pions, the Higgs and neutrinos are ghosts that fly through
     matter; the short-lived ones decay into lighter particles.
7. **Radioactivity**: the Radioactive elements are almost perfectly stable
   until something disturbs them. Left alone in still air they throw nothing
   off and only warm and decay at a thousandth of their listed rates (the
   inspector's half-life is for a disturbed sample). Two things stir them up:
   - **Pressure**: squeezed (or sucked on) past 3, they warm, throw off
     particles and decay faster the harder they're squeezed, reaching their
     listed rates at about 23 and four times them in a pumped box.
   - **Particles**: a neutron, proton, electron, positron, alpha particle,
     heavy ion or gamma ray passing through can be swallowed by an atom, which
     may then throw off a particle of its own, warm up, or decay. Each kick
     uses up the particle that caused it, so kicks never run away on their
     own; only fission multiplies neutrons.

   Squeeze radium and it decays to radon, then polonium, then lead, shedding
   helium.
8. **Creatures** (fish, birds, ants, bees, worms and a dozen more) move
   themselves: swimmers through water, flyers through air, walkers along
   surfaces, burrowers through soil. They eat what they find (bees turn
   flowers into honey, worms turn ash into soil), breed or lay eggs when well
   fed, and die of old age, of heat or cold, or, for fish, of being out of
   water, leaving bones, feathers or shells behind.
9. **Growing things**: wheat, sugarcane, cactus and kelp grow straight up to a
   random height; moss, lichen, coral and mould creep into what they feed on.
10. **Light and colour**: gases like neon, argon, xenon and sodium vapour
    glow in their own colours when a current runs through them, and the glow
    spreads down the tube. Fluorescent minerals glow under ultraviolet.
    The alkali metals, strontium, barium, sulfur and friends burn in the
    colours of the flame test chemists use to identify them: sodium yellow,
    potassium lilac, lithium crimson, cesium blue-violet.

### Nuclear physics you can play with

Uranium and plutonium sit still until a neutron arrives (fire some in, or put
a neutron source such as polonium on beryllium beside them). Each uranium
split releases two neutrons and a burst of heat, so whether a pile runs away
once started depends on its size and what surrounds it:

- A 20 × 20 pile of uranium on its own fizzles out after the first few
  splits. A 40 × 40 pile is on the edge: sometimes the chain dies out,
  sometimes it takes off and burns through a good part of its fuel, leaving
  glowing nuclear waste. Heat uranium past 2800 °C and it melts into corium.
- Put rods of **graphite** between the uranium and the same 20 × 20 pile burns
  hot, because slowed neutrons split atoms more easily. That's how the first
  reactor worked.
- Swap some rods for **boron** and it shuts down again.
- Neutrons pass through radioactive elements and graphite, but bounce off
  most other things, so a pile walled in with stone or metal keeps its
  neutrons in (a neutron reflector) and runs hotter.
- **Plutonium** behaves as it does in The Powder Toy. A ball of a few hundred
  grains sits there quietly until a neutron gets in. Then every split throws
  out three neutrons and a proton, heats what's left to 9999 °C and adds a
  big kick of air pressure, and the more pressure there is the more readily
  plutonium splits. So the chain feeds itself: the pressure climbs to the
  limit within a second, tears through stone and metal around it, and the
  hot protons carry the heat deep into the walls. A small pinch hit by the
  same neutrons melts and pops, but has too little in it to blow anything
  apart.
- **Deuterium** and **beryllium** double the neutrons passing through them, and
  **deuterium** and **tritium** fuse into helium above 3000 °C.

These are checked by tests in `test/radiation.test.js`.

### Machines and circuits

The **Machines** group has controls, which you switch on, and machines, which
run on power:

| Control | On while... |
| ------- | ----------- |
| Switch | you've flipped it on (paint Spark on it; paint again to flip it off) |
| Button | for a second and a half after you paint Spark on it |
| Clock | a moment each second: it sends one pulse a second |
| Pressure Plate | anything rests on it: sand, water, a creature, a block |
| Photocell | light shines on it (it turns light into current, not heat) |
| Thermostat | it's hotter than 60 °C |

| Machine | While powered it... |
| ------- | ------------------- |
| Door | opens (vanishes), and shuts again when the power stops, shoving loose things out of the doorway |
| Lamp, Red / Green / Blue Lamp | lights up: a pixel you can switch |
| Laser Emitter | fires a red laser beam out of every open face |
| Heater / Cooler | heats itself to 1200 °C / chills itself to −150 °C |
| Fan | blows air out of every open face (mount it on a wall to aim it) |
| Dispenser | pours out more of the first powder, liquid, gas or creature that touched it |
| Drain | swallows the powders, liquids and gases touching it |

A control that's on powers any machine touching it and sends current into
wires (metal, copper and other conductors) touching it; a wire carrying current
powers every machine along it, as does a battery. Power fills a whole connected
block of the same machine, so a big door opens as one and a wall of lamps
lights together; leave a gap between lamps you want to control separately.
Machines stay on for a third of a second after the power stops, so they run
steadily on a wire's pulses. The **Beam Splitter** is a half-silvered
mirror that reflects half the light and passes the rest.

Some things to build:

- **A door on a switch**: Switch → copper wire → Door. Flip the switch to open
  the door and flip it again to close it.
- **A tripwire**: a Laser Emitter aimed at a Photocell with a Lamp or Door
  touching it. Step into the beam and the lamp goes out, or the door shuts.
- **A light show**: a Clock wired to a row of lamps, and mirror lines at 45°
  steering a laser around the screen, colouring it as it bounces off gold or
  copper.

These are checked by tests in `test/machines.test.js`.

## What's in the table

The 400 elements added in the latest expansion lean on real chemistry and
history wherever it can be played:

- **The whole periodic table.** Calcium comes from electrolysing limestone as
  Davy did, argon from stripping nitrogen out of air with hot magnesium as
  Ramsay did, krypton and xenon from chilling argon. The rare earths are
  separated in the order chemists actually untangled them over a century
  (monazite → rare earths → didymium → neodymium and praseodymium...).
  Actinides are bred by neutron capture and alpha bombardment, and the
  superheavy elements are forged by firing calcium ions at californium,
  berkelium and friends, then decay down the chain one alpha particle at a
  time.
- **Niche reactions.** Gallium melts at hand temperature and crumbles
  aluminium; tin turns to grey powder in the cold; hot ice freezes on touch
  and gets warm; platinum lights hydrogen without a flame; mint candy makes
  cola erupt; fluorine even makes xenon react; liquid rubidium, francium and
  NaK go off in water like cesium; permafrost releases methane as it thaws.
- **Ores and minerals**: galena, sphalerite, pyrite, cassiterite, zircon,
  fluorite and more, plus gems (sapphire, opal, tourmaline, which sparks when
  heated), rocks (marble, slate, basalt, pumice that floats) and fossils.
- **Materials and gadgets**: bronze, brass, solder, stainless steel, nitinol,
  aerogel, graphene, teflon, paper, rubber; light bulbs, LEDs,
  electromagnets, nichrome heaters, potato batteries.
- **Machines**, made the way the real parts are: a clock from quartz and a
  battery, a photocell from selenium on copper (the first light meters), a
  thermostat from mercury and a switch, a cooler from bismuth and tellurium
  (the Peltier material in car fridges), a heater from nichrome on porcelain.
- **Food and life**: bread, cheese, chocolate that melts at 34 °C, popcorn,
  jam; yeast, bacteria, penicillin; fish, frogs, birds, bees, ants, termites,
  spiders, squid, tardigrades, and a phoenix.
- **Weather, space and legends**: fog, hail, ball lightning, aurora,
  rainbows, meteors, supernovas, pulsars, quark-gluon plasma, time crystals,
  ice-nine, grey goo, Greek fire and the elixir of life.

## Project layout

```
index.html, style.css          the page
src/main.js                    wires everything together; game loop
src/sim/elements.js            the first 40 elements, and the compiler that turns
                               all the tables into lookups for the simulation
src/sim/elements-expansion.js  the next 100 elements, their reactions, and what
                               flying particles do when they hit things
src/sim/elements-periodic.js   the rest of the periodic table and its ores
src/sim/elements-chemistry.js  acids, lab chemicals, pigments, rocks and gems
src/sim/elements-world.js      alloys, materials, gadgets, plants, food,
                               creatures, weather, space and more particles
src/sim/elements-machines.js   switches, sensors, doors, lamps and other machines
src/sim/elements-more.js       gap-fillers: ores, reactions that were missing, new uses
src/sim/world.js               the grid simulation: movement, heat, reactions
src/sim/behaviors.js           special behaviours (fire, plants, black holes...)
src/sim/particles.js           the flying-particle layer
src/sim/machines.js            power, controls, doors and the other machines
src/sim/air.js                 the pressure / wind grid, and air temperature for convection
src/sim/gravity.js             gravity's direction and strength, and Newtonian gravity
src/sim/fft.js                 fast Fourier transforms for the Newtonian gravity field
src/render/renderer.js         draws the world, glow, particles, heat and pressure views
src/render/tree-view.js        draws the recipe tree; dragging, zooming and clicking it
src/game/tree.js               lays out the recipe tree (which elements, which links, where)
src/game/physics-panel.js      the Physics panel: gravity dial, strength, the two switches
src/game/                      input, zoom camera, UI, saved progress, starting scene
scripts/recipe-table.js        prints the recipe table at the end of this file
scripts/build.js               bundles the game into one HTML file (dist/)
test/                          node:test suites
```

## Adding an element

1. Add an entry to one of the element lists (for example `WORLD_ELEMENTS` in
   `src/sim/elements-world.js`) with its colours, state, density and any
   `high` / `low` / `pressure` transitions. The fields are documented at the
   top of `elements.js`.
2. Give it a way to be made: a transition on another element, a line in one
   of the reaction lists, or a particle hit. Each pair of ingredients can have
   only one reaction; the compiler throws if two collide.
3. Write a `hint` so the recipe tree can nudge players towards it.
4. Run `npm test`. The recipe suite builds a small lab for **every** recipe
   and checks it actually works in the simulation, and checks that every
   element can be reached from the starting four.

## Tests

```sh
npm test
```

The physics tests cover sand piling, water levelling (and thin films
settling), oil floating on water, heat conduction, pressure containment,
explosions, electricity and burning, including fires going out in a sealed
box and hot fuel relighting once air gets back in. The pressure tests cover blasts tearing
wood before stone before metal, hot metal tearing where cold metal holds,
debris falling, strong shells holding air while wood leaks, a pumped vessel
bursting once the pressure passes its strength, and a charge sealed in steel
blowing the shell apart. The radiation tests cover light (including how it slows in water, glass and
diamond), neutron shielding, reactor criticality, a plutonium ball tearing
open the stone around it while a pinch only pops, hot protons heating and
lighting what they pass through, colliding protons making neutrons, magnets,
decay, and radioactive elements staying still until pressure or particles
disturb them.
The tools tests cover brush shapes, boxes, Replace, Mix (blending layers, keeping every cell, the
walls and temperatures) and particle impacts, and
the camera tests cover zooming and panning. The Physics panel tests cover
reading the strength box, turning the dial and saving the settings; the
build test checks the single-file build runs. The tree tests cover which elements the
recipe tree shows, one connection into each, columns, overlap, free play and
process names. The hard mode tests cover blank boxes and named targets, the
one ingredient shown (the same every time, and none for a single-ingredient
recipe), the tree keeping every box, the blocked tools, Mix still working and
the setting being saved. The machine tests
cover coloured reflections and coloured glass, mirrors of metal behind glass, beams turned by
diagonal mirrors, beam splitters, and every control and machine. The mechanics
tests cover X-rays, gamma rays, ultraviolet and microwaves, gadgets
on a battery, creatures, growing plants, meteors, hot ice, tin pest, gallium,
and the superheavy decay chain. The gravity tests cover the gravity table,
sand piling against whichever wall is down, water on the ceiling, slanted and
weak and strong gravity, gases rising against the arrow, fireworks, trees
and rain following it, and the general movement code matching the fast
straight-down path exactly. The Newtonian tests check the FFT field against
a direct sum, that nothing is built while it's off, that mass pulls sand in
and a White Hole pushes, and that light bends. The edge tests cover a void floor draining sand, water pouring off a void
side, steam escaping a void roof, and a stone floor on a void edge staying
put, and pressure waves and heat going out through void edges instead of
bouncing back. The phase tests cover water
boiling away in a vacuum, staying liquid past 100 °C in a pressure cooker,
and metal that won't melt under heavy pressure. The convection tests cover a
rising plume, the plume turning with the arrow, air flowing in at its base,
the hot block cooling, the pressure rising in a heated sealed box and
settling once it cools, hot air pushing out and being drawn back in the open,
a full loop in a closed box (markers carried up come
back down to the base), the Heat and Cool tools warming and chilling the
air, and a sealed fire still going out. The recipe tests
run all 1200 production rules in the real simulation. About 1,350 tests in
all, and they run in a few seconds.

Regenerate the table below after changing recipes with
`node scripts/recipe-table.js`.

<details>
<summary>Spoilers: every recipe</summary>

| No. | Element | Made from |
| --- | ------- | --------- |
| 5 | Steam | Water + Heat · Salt Water + Heat · Hydrogen + Fire · Nitric Acid + Heat · Sulfuric Acid + Heat · Acid Rain + Heat · Vinegar + Heat · Limewater + Heat · Ink + Heat · Pulp + Heat · Syrup + Heat · Milk + Heat · Blood + Heat · Wine + Heat · Mead + Heat · Fire + Water · Lava + Water · Sulfuric Acid + Water · Sulfuric Acid + Sugar · Quicklime + Water · Lava + Salt Water · Greek Fire + Water · Glitter + Water |
| 6 | Ice | Water + Cold · Salt Water + Cold · Acid Rain + Cold · Wine + Cold |
| 7 | Mud | Permafrost + Heat · Dirt + Water · Adobe + Water |
| 8 | Lava | Dirt + Heat · Stone + Heat · Obsidian + Heat · Brick + Heat · Granite + Heat · Peridot + Heat · Garnet + Heat · Spinel + Heat · Alexandrite + Heat · Tourmaline + Heat · Pumice + Heat · Basalt + Heat · Kimberlite + Heat |
| 9 | Stone | Lava + Cold |
| 10 | Obsidian | Lava + Water · Lava + Ice · Lava + Snow |
| 11 | Molten Glass | Sand + Heat · Glass + Heat · Quartz + Heat · Borax + Heat · Silica Gel + Heat · Topaz + Heat · Jade + Heat · Flint + Heat · Petrified Wood + Heat · Frosted Glass + Heat · Borosilicate Glass + Heat · Lead Crystal + Heat · Stained Glass + Heat · Uranium Glass + Heat · Cranberry Glass + Heat |
| 12 | Glass | Molten Glass + Cold · Geiger Tube + Pressure · Waterglass + Heat · Fiberglass + Fire · Light Bulb + Pressure · Beam Splitter + Pressure · Sand + Lightning |
| 13 | Snow | Bubbles + Cold · Steam + Ice · Cloud + Cold |
| 14 | Brick | Mud + Heat · Clay + Heat · Shale + Heat |
| 15 | Plant | Mud + Water · Elixir of Life + Ash |
| 16 | Wood | Sawdust + Pressure · Plant + Time |
| 17 | Smoke | Plant + Fire · Wood + Fire · Coal + Fire · Oil + Fire · Gunpowder + Fire · Sulfur + Fire · Gasoline + Fire · Plastic + Fire · Sodium + Fire · Napalm + Fire · Potassium + Fire · Graphite + Fire · Ferrofluid + Fire · ANFO + Fire · Dynamite + Fire · C4 + Fire · Lithium + Fire · Grass + Fire · Moss + Fire · Fungus + Fire · Flower + Fire · Fruit + Fire · Cesium + Fire · Phosphorus + Fire · Red Phosphorus + Fire · Arsenic + Heat · Rubidium + Fire · Kerosene + Fire · Tar + Fire · Sunscreen + Fire · Amber + Fire · Resin + Fire · Peat + Fire · Lignite + Fire · Fiberglass + Fire · Glue + Fire · Styrofoam + Fire · Goo + Fire · Silicone + Fire · Candle + Fire · Paper + Fire · Cardboard + Fire · Cotton + Fire · Cloth + Fire · Rubber + Fire · Vulcanized Rubber + Fire · Match + Fire · Sponge + Fire · Carbon Fiber + Fire · Bioplastic + Fire · Sparkler + Fire · Road Flare + Fire · Bread + Fire · Toast + Fire · Fries + Fire · Caramel + Fire · Cheese + Fire · Fried Egg + Fire · Steak + Fire · Feather + Fire · Marshmallow + Fire · Tofu + Fire · Jerky + Fire · Greek Fire + Fire · Sawdust + Fire · Denim + Fire · Lava + Coal |
| 18 | Ash | Plant + Fire · Wood + Fire · Grass + Fire · Moss + Fire · Algae + Fire · Flower + Fire · Seed + Fire · Fallout + Decay · Virus + Heat · Paper + Fire · Cardboard + Fire · Photo Paper + Fire · Photograph + Fire · Cotton + Fire · Cloth + Fire · Silk + Fire · Cactus + Fire · Kelp + Fire · Lichen + Fire · Slime Mold + Fire · Wheat + Fire · Sugarcane + Fire · Popcorn + Fire · Blood + Heat · Phoenix + Time · Sawdust + Fire · Denim + Fire · Chlorine + Plant |
| 19 | Salt Water | Jellyfish + Time · Ash + Water · Salt + Water · Salt + Ice · Lye + Acid · Bleach + Acid · Bleach + Ink · Baking Soda + Acid · Washing Soda + Acid · Bleach + Indigo · Bleach + Tyrian Purple |
| 20 | Salt | Salt Water + Heat · Molten Salt + Cold · Sodium + Chlorine · Sodium + Acid |
| 21 | Coal | Wood + Pressure · Lignite + Pressure |
| 22 | Diamond | Coal + Pressure · Kimberlite + Acid |
| 23 | Metal | Molten Metal + Cold · Magnet + Heat · Cobalt-60 + Decay · Lava + Coal · Coke + Rust · Hematite + Coke |
| 24 | Molten Metal | Metal + Heat · Rust + Heat · Thermite + Fire · Copper + Heat · Aluminum + Heat · Titanium + Heat · Steel + Heat · Tungsten + Heat · Lead + Heat · Silver + Heat · Cobalt-60 + Heat · Gold + Heat · Beryllium + Heat · Vanadium + Heat · Chromium + Heat · Manganese + Heat · Nickel + Heat · Zinc + Heat · Zirconium + Heat · Niobium + Heat · Molybdenum + Heat · Ruthenium + Heat · Rhodium + Heat · Palladium + Heat · Cadmium + Heat · Hafnium + Heat · Tantalum + Heat · Rhenium + Heat · Osmium + Heat · Iridium + Heat · Platinum + Heat · Brittle Aluminum + Heat · Indium + Heat · Tin + Heat · Antimony + Heat · Thallium + Heat · Scandium + Heat · Yttrium + Heat · Lanthanum + Heat · Cerium + Heat · Praseodymium + Heat · Neodymium + Heat · Promethium + Heat · Samarium + Heat · Europium + Heat · Gadolinium + Heat · Terbium + Heat · Dysprosium + Heat · Holmium + Heat · Thulium + Heat · Ytterbium + Heat · Lutetium + Heat · Meteorite + Heat · Bronze + Heat · Brass + Heat · Pewter + Heat · Solder + Heat · Electrum + Heat · Rose Gold + Heat · White Gold + Heat · Sterling Silver + Heat · Stainless Steel + Heat · Galvanized Steel + Heat · Invar + Heat · Nitinol + Heat · Amalgam + Heat · Wood's Metal + Heat · Duralumin + Heat · Tungsten Carbide + Heat · Orichalcum + Heat · Nichrome + Heat |
| 25 | Rust | Ferrofluid + Fire · Pyrite + Heat · Steel Wool + Fire · Metal + Water · Metal + Copper Sulfate · Prussian Blue + Lye · Steel + Water · Metal + Oxygen |
| 26 | Oil | Plant + Pressure · Butter + Heat |
| 27 | Methane | Permafrost + Heat · Liquid Methane + Heat · Plant + Mud |
| 28 | Gunpowder | Coal + Salt |
| 29 | Battery | Metal + Salt Water |
| 30 | Spark | Battery + Metal |
| 31 | Hydrogen | Proton + Time · Liquid Hydrogen + Heat · Quark-Gluon Plasma + Time · Water + Spark · Sodium + Water · Potassium + Water · Lithium + Water · Cesium + Water · Cesium + Ice · Calcium + Water · Rubidium + Water · Francium + Water · Zinc + Acid · NaK + Water · Metal + Acid · Magnesium + Acid · Aluminum + Acid · Sodium + Acid · Lye + Aluminum · Barium + Water · Strontium + Water · Brittle Aluminum + Water · Sodium Vapour + Water · Water + Electron · Electron + Proton |
| 32 | Acid | Chlorine + Hydrogen · Chlorine + Water |
| 33 | Cloud | Steam + Smoke |
| 34 | Lightning | Cloud + Spark |
| 35 | Plasma | Steam + Heat · Plutonium + Neutron · Star + Metal |
| 36 | Thermite | Rust + Gunpowder · Aluminum + Rust |
| 37 | Nitro | Oil + Acid |
| 38 | Cryo | Nitrogen + Cold · Salt + Snow |
| 39 | Clone | Dispenser + Pressure · Diamond + Plasma |
| 40 | Void | Diamond + Pressure · Drain + Pressure |
| 41 | Oxygen | Ozone + Time · Liquid Oxygen + Heat · Hydrogen Peroxide + Heat · Hydrogen Peroxide + Time · Aurora + Time · Water + Spark · Fluorine + Water · Fluorine + Glass · Hydrogen Peroxide + Pyrolusite · Freon + Ozone · Nitrogen + Alpha Particle · Algae + Photon |
| 42 | Nitrogen | Cryo + Time |
| 43 | Ozone | Oxygen + Spark · Oxygen + Photon |
| 44 | Carbon Dioxide | Dry Ice + Heat · Carbon Monoxide + Fire · Soda Water + Time · Cola + Time · Smoke + Oxygen · Acid + Limestone · Limestone + Spark · Acid + Marble · Baking Soda + Vinegar · Yeast + Sugar · Dry Ice + Water · Chalk + Acid · Seashell + Acid · Baking Soda + Acid · Washing Soda + Acid · Acid + Fossil · Acid Rain + Limestone · Vinegar + Limestone · Vinegar + Chalk · Vinegar + Seashell · Vinegar + Marble · Vinegar + Pearl · Lemon + Baking Soda · Fire + Baking Soda · Diamond + Oxygen · Microplastic + Bacteria |
| 45 | Dry Ice | Carbon Dioxide + Cold |
| 46 | Liquid Oxygen | Oxygen + Cold |
| 47 | Clay | Mud + Sand · Mica + Water |
| 48 | Gravel | Stone + Pressure · Concrete + Pressure · Reinforced Concrete + Pressure · Roman Concrete + Pressure |
| 49 | Quartz | Sand + Pressure · Opal + Heat · Citrine + Heat · Smoky Quartz + Heat · Rose Quartz + Heat · Clock + Pressure |
| 50 | Granite | Lava + Pressure |
| 51 | Sulfur | Lava + Steam |
| 52 | Copper | Verdigris + Heat · Photocell + Pressure · Chalcopyrite + Heat · Metal + Copper Sulfate · Malachite + Coal |
| 53 | Verdigris | Copper + Water · Turquoise + Acid |
| 54 | Limestone | Coral + Heat · Salt Water + Stone · Slaked Lime + Carbon Dioxide · Washing Soda + Slaked Lime |
| 55 | Cement | Limestone + Heat |
| 56 | Wet Concrete | Cement + Water |
| 57 | Concrete | Wet Concrete + Time |
| 58 | Propane | Oil + Heat |
| 59 | Gasoline | Oil + Hydrogen |
| 60 | Plastic | Propane + Pressure · Glowstick + Time · Acetylene + Acid |
| 61 | Sodium | Salt + Spark · Molten Salt + Spark |
| 62 | Chlorine | Aqua Regia + Heat · Salt + Spark · Bleach + Acid · Molten Salt + Spark |
| 63 | Lye | Sodium + Water · Potassium + Water · Cesium + Water · Cesium + Ice · Rubidium + Water · Francium + Water · NaK + Water · Washing Soda + Slaked Lime · Barium + Water · Strontium + Water · Sodium Vapour + Water |
| 64 | Soap | Lye + Oil · Lye + Butter |
| 65 | Bubbles | Soap + Water · Hydrogen Peroxide + Blood · Cola + Mint Candy |
| 66 | Napalm | Gasoline + Soap |
| 67 | Potassium | Ash + Spark |
| 68 | Magnesium | Salt Water + Spark |
| 69 | Aluminum | Clay + Spark · Bauxite + Lye |
| 70 | Silicon | Moissanite + Heat · Sand + Magnesium |
| 71 | Titanium | Stone + Magnesium |
| 72 | Boron | Glass + Magnesium |
| 73 | Graphite | Moissanite + Heat · Fullerene + Heat · Coal + Spark |
| 74 | Steel | Reinforced Concrete + Pressure · Pressure Plate + Pressure · Door + Pressure · Metal + Coal |
| 75 | Magnet | Fan + Pressure · Metal + Lightning |
| 76 | Ferrofluid | Oil + Rust |
| 77 | Tungsten | Light Bulb + Pressure · Wolframite + Aluminum |
| 78 | Ammonia | Nitrogen + Hydrogen |
| 79 | Fertilizer | Ammonia + Acid |
| 80 | ANFO | Fertilizer + Oil |
| 81 | Dynamite | Nitro + Clay |
| 82 | C4 | Plastic + Nitro |
| 83 | Fuse | Wood + Gunpowder |
| 84 | Firework | Gunpowder + Copper |
| 85 | Glitter | Firework + Fire |
| 86 | Ruby | Clay + Pressure · Red Lamp + Pressure |
| 87 | Laser | Laser Emitter + Pressure · Ruby + Spark |
| 88 | Cinnabar | Sulfur + Granite |
| 89 | Mercury | Cinnabar + Heat · Mercury Vapour + Cold · Vermilion + Heat · Thermostat + Pressure |
| 90 | Lithium | Granite + Acid |
| 91 | Grass | Dirt + Plant |
| 92 | Moss | Stone + Plant |
| 93 | Fungus | Wood + Mud |
| 94 | Algae | Plant + Salt Water |
| 95 | Photon | Higgs Boson + Time · Plasma + Glass · Star + Hydrogen · Carbon Dioxide + Magnesium · Black Hole + White Hole · Neon + Electron · Heavy Water + Neutrino · Fluorite + Ultraviolet · Europium + Ultraviolet · Terbium + Ultraviolet · Phosphor + Ultraviolet · Chlorophyll + Ultraviolet · Uranium Glass + Ultraviolet |
| 96 | Flower | Epsom Salt + Plant · Plant + Photon |
| 97 | Fruit | Flower + Time · Butterfly + Flower |
| 98 | Seed | Fruit + Time |
| 99 | Alcohol | Fruit + Time · Perfume + Cold · Wine + Heat · Wine + Cold · Mead + Heat · Yeast + Sugar |
| 100 | Electron | Muon + Time · Metal + Photon · Cesium + Photon · Hydrogen + Photon · Lead + Photon · Heavy Water + Neutrino · Neutron + Time |
| 101 | Proton | Hydrogen + Photon · Nitrogen + Alpha Particle · Neutron + Time |
| 102 | Neutron | Polonium + Beryllium · Tritium + Deuterium · Metal + Proton · Lead + Proton · Tungsten + Proton · Beryllium + Alpha Particle · Deuterium + Muon · Proton + Proton |
| 103 | Neutrino | Muon + Time · Pion + Time · Neutron + Time |
| 104 | Pitchblende | Granite + Pressure |
| 105 | Yellowcake | Pitchblende + Heat |
| 106 | Uranium | Protactinium + Decay · Yellowcake + Hydrogen |
| 107 | Plutonium | Curium + Decay · RTG + Pressure · Uranium + Neutron |
| 108 | Thorium | Actinium + Decay · Pitchblende + Acid · Monazite + Acid |
| 109 | Nuclear Waste | Corium + Cold · Uranium + Neutron |
| 110 | Cesium | Uranium + Neutron |
| 111 | Fallout | Plutonium + Neutron |
| 112 | Corium | Uranium + Heat · Plutonium + Heat |
| 113 | Radium | Francium + Decay · Radium Paint + Time · Pitchblende + Spark |
| 114 | Radon | Radium + Decay |
| 115 | Helium | Radium + Decay · Radon + Decay · Polonium + Decay · Superfluid + Time · Tritium + Decay · Alpha Particle + Time · Quark-Gluon Plasma + Time · Tritium + Deuterium · Star + Hydrogen · Lithium + Proton · Lithium + Neutron · Deuterium + Muon |
| 116 | Polonium | Radon + Decay · Astatine + Decay |
| 117 | Lead | Nuclear Waste + Decay · Polonium + Decay · Galena + Heat · Golden Rain + Heat |
| 118 | Silver | Tarnish + Heat · Beam Splitter + Pressure · Lead + Acid · Tarnish + Baking Soda · Silver Chloride + Photon |
| 119 | Mirror | Silver + Glass |
| 120 | Positron | Lead + Photon |
| 121 | Antimatter | Cryo + Positron |
| 122 | Neon | Geiger Tube + Pressure · Helium + Plasma |
| 123 | Geiger Tube | Neon + Chlorine |
| 124 | Superfluid | Helium + Cold |
| 125 | Deuterium | Hydrogen + Neutron |
| 126 | Heavy Water | Deuterium + Fire · Heavy Ice + Heat |
| 127 | Tritium | Lithium + Neutron |
| 128 | Cobalt-60 | Metal + Neutron |
| 129 | Gold | Calaverite + Heat · Dissolved Gold + Heat · Supernova + Time · Mercury + Neutron |
| 130 | Philosopher's Stone | Gold + Mercury |
| 131 | Emerald | Green Lamp + Pressure · Quartz + Verdigris |
| 132 | Beryllium | Emerald + Acid |
| 133 | Amethyst | Geode + Pressure · Quartz + Neutron |
| 134 | Virus | Fungus + Neutron |
| 135 | Star | Hydrogen + Pressure |
| 136 | Neutronium | Lead + Pressure · Supernova + Time |
| 137 | Black Hole | Neutronium + Void |
| 138 | White Hole | Black Hole + Antimatter |
| 139 | Strange Matter | Neutronium + Proton |
| 140 | Dark Matter | Void + Neutrino |
| 141 | Fluorine | Topaz + Heat · Fluorite + Spark |
| 142 | Phosphorus | Bone + Coal |
| 143 | Red Phosphorus | Phosphorus + Photon |
| 144 | Argon | Nitrogen + Magnesium |
| 145 | Bromine | Salt Water + Chlorine |
| 146 | Krypton | Argon + Cryo |
| 147 | Xenon | Xenon Difluoride + Heat · Krypton + Cryo |
| 148 | Xenon Difluoride | Xenon + Fluorine |
| 149 | Iodine | Iodine Vapour + Cold · Kelp + Acid |
| 150 | Iodine Vapour | Iodine + Heat · Golden Rain + Heat |
| 151 | Selenium | Photocell + Pressure · Copper + Acid |
| 152 | Arsenic | Realgar + Heat |
| 153 | Germanium | Sphalerite + Acid |
| 154 | Tellurium | Calaverite + Heat · Cooler + Pressure |
| 155 | Calcium | Calcium Ion + Time · Fluorite + Spark · Limestone + Spark |
| 156 | Rubidium | Lepidolite + Spark |
| 157 | Strontium | Celestine + Spark |
| 158 | Barium | Barite + Spark |
| 159 | Vanadium | Vanadinite + Acid |
| 160 | Chromium | Chromite + Aluminum |
| 161 | Manganese | Pyrolusite + Aluminum |
| 162 | Nickel | Meteorite + Acid |
| 163 | Zinc | Sphalerite + Coal |
| 164 | Zirconium | Zircon + Magnesium |
| 165 | Niobium | Coltan + Acid |
| 166 | Molybdenum | Molybdenite + Heat |
| 167 | Technetium | Molybdenum + Neutron |
| 168 | Ruthenium | Technetium + Decay |
| 169 | Rhodium | Platinum Ore + Nitric Acid |
| 170 | Palladium | Platinum Ore + Nitric Acid |
| 171 | Cadmium | Sphalerite + Heat |
| 172 | Hafnium | Zircon + Acid |
| 173 | Tantalum | Coltan + Spark |
| 174 | Rhenium | Molybdenite + Acid |
| 175 | Osmium | Platinum Ore + Aqua Regia |
| 176 | Iridium | Platinum Ore + Aqua Regia |
| 177 | Platinum | Platinum Ore + Aqua Regia |
| 178 | Gallium | Liquid Gallium + Cold · Bauxite + Lye |
| 179 | Liquid Gallium | Gallium + Heat |
| 180 | Brittle Aluminum | Liquid Gallium + Aluminum · Galinstan + Aluminum |
| 181 | Indium | Sphalerite + Spark |
| 182 | Tin | Grey Tin + Heat · Cassiterite + Coal |
| 183 | Grey Tin | Tin + Cold |
| 184 | Antimony | Stibnite + Metal |
| 185 | Thallium | Pyrite + Acid |
| 186 | Bismuth | Cooler + Pressure · Galena + Coal |
| 187 | Molten Bismuth | Bismuth + Heat · Bismuth Crystal + Heat |
| 188 | Bismuth Crystal | Molten Bismuth + Cold |
| 189 | Rare Earths | Monazite + Acid |
| 190 | Didymium | Rare Earths + Acid |
| 191 | Scandium | Ytterbium + Spark |
| 192 | Yttrium | Ytterbite + Acid |
| 193 | Lanthanum | Rare Earths + Spark |
| 194 | Cerium | Rare Earths + Oxygen |
| 195 | Praseodymium | Didymium + Spark |
| 196 | Neodymium | Didymium + Spark · Neodymium Magnet + Acid |
| 197 | Promethium | Neodymium + Neutron |
| 198 | Samarium | Didymium + Heat · Promethium + Time |
| 199 | Europium | Samarium + Zinc |
| 200 | Gadolinium | Samarium + Acid |
| 201 | Terbium | Yttrium + Acid |
| 202 | Dysprosium | Holmium + Acid |
| 203 | Holmium | Erbium + Acid |
| 204 | Erbium | Yttrium + Acid |
| 205 | Thulium | Erbium + Acid |
| 206 | Ytterbium | Erbium + Heat |
| 207 | Lutetium | Ytterbium + Acid |
| 208 | Ferrocerium | Cerium + Metal |
| 209 | Neodymium Magnet | Neodymium + Metal |
| 210 | Actinium | Radium + Neutron |
| 211 | Francium | Actinium + Decay |
| 212 | Astatine | Bismuth + Alpha Particle |
| 213 | Protactinium | Neptunium + Decay · Thorium + Neutron |
| 214 | Neptunium | Americium + Decay |
| 215 | Americium | Plutonium + Neutron |
| 216 | Curium | Americium + Neutron · Plutonium + Alpha Particle |
| 217 | Berkelium | Einsteinium + Decay · Curium + Neutron · Americium + Alpha Particle |
| 218 | Californium | Berkelium + Decay · Fermium + Decay · Curium + Alpha Particle |
| 219 | Einsteinium | Mendelevium + Decay · Californium + Neutron |
| 220 | Fermium | Nobelium + Decay · Einsteinium + Neutron |
| 221 | Mendelevium | Lawrencium + Decay · Einsteinium + Alpha Particle |
| 222 | Nobelium | Rutherfordium + Decay |
| 223 | Lawrencium | Dubnium + Decay |
| 224 | Rutherfordium | Seaborgium + Decay |
| 225 | Dubnium | Bohrium + Decay |
| 226 | Seaborgium | Hassium + Decay |
| 227 | Bohrium | Meitnerium + Decay |
| 228 | Hassium | Darmstadtium + Decay |
| 229 | Meitnerium | Roentgenium + Decay |
| 230 | Darmstadtium | Copernicium + Decay |
| 231 | Roentgenium | Nihonium + Decay |
| 232 | Copernicium | Flerovium + Decay |
| 233 | Nihonium | Moscovium + Decay |
| 234 | Flerovium | Livermorium + Decay · Plutonium + Calcium Ion |
| 235 | Moscovium | Tennessine + Decay · Americium + Calcium Ion |
| 236 | Livermorium | Oganesson + Decay · Curium + Calcium Ion |
| 237 | Tennessine | Berkelium + Calcium Ion |
| 238 | Oganesson | Californium + Calcium Ion |
| 239 | Alpha Particle | Americium + Decay · Nobelium + Decay · Lawrencium + Decay · Rutherfordium + Decay · Dubnium + Decay · Seaborgium + Decay · Bohrium + Decay · Hassium + Decay · Meitnerium + Decay · Darmstadtium + Decay · Roentgenium + Decay · Copernicium + Decay · Nihonium + Decay · Flerovium + Decay · Moscovium + Decay · Livermorium + Decay · Tennessine + Decay · Oganesson + Decay |
| 240 | Calcium Ion | Calcium + Plasma |
| 241 | Fluorite | Steam + Limestone |
| 242 | Galena | Lead + Sulfur |
| 243 | Sphalerite | Sulfur + Limestone |
| 244 | Pyrite | Metal + Sulfur |
| 245 | Cassiterite | Steam + Granite |
| 246 | Stibnite | Sulfur + Quartz |
| 247 | Barite | Sulfur + Salt Water · Barium + Sulfuric Acid |
| 248 | Celestine | Gypsum + Salt Water |
| 249 | Gypsum | Salt Water + Limestone |
| 250 | Realgar | Sulfur + Steam |
| 251 | Chromite | Peridot + Rust |
| 252 | Peridot | Magnesium + Lava |
| 253 | Pyrolusite | Salt Water + Gravel |
| 254 | Bauxite | Clay + Water · Brittle Aluminum + Water |
| 255 | Meteorite | Meteor + Time |
| 256 | Vanadinite | Galena + Oxygen |
| 257 | Molybdenite | Graphite + Sulfur |
| 258 | Coltan | Cassiterite + Granite |
| 259 | Zircon | Lava + Sand |
| 260 | Lepidolite | Lithium + Granite |
| 261 | Calaverite | Gold + Quartz |
| 262 | Monazite | Granite + Water |
| 263 | Ytterbite | Quartz + Granite |
| 264 | Platinum Ore | Gold + Sand |
| 265 | Nitrogen Dioxide | Nitric Acid + Heat · Aqua Regia + Heat · Nitrogen + Spark · Nitric Acid + Copper |
| 266 | Nitric Acid | Nitrogen Dioxide + Water |
| 267 | Aqua Regia | Nitric Acid + Acid |
| 268 | Dissolved Gold | Gold + Aqua Regia |
| 269 | Hydrofluoric Acid | Fluorine + Water · Fluorine + Hydrogen |
| 270 | Sulfur Dioxide | Sulfur + Fire · Pyrite + Heat · Sulfuric Acid + Heat · Hydrogen Sulfide + Fire · Tarnish + Heat · Chalcopyrite + Heat |
| 271 | Sulfuric Acid | Sulfur Dioxide + Water |
| 272 | Acid Rain | Sulfur Dioxide + Cloud · Smog + Cloud |
| 273 | Hydrogen Peroxide | Water + Ozone |
| 274 | Elephant Toothpaste | Hydrogen Peroxide + Yeast |
| 275 | Bleach | Lye + Chlorine |
| 276 | Vinegar | Alcohol + Oxygen · Wine + Bacteria |
| 277 | Baking Soda | Salt Water + Carbon Dioxide |
| 278 | Washing Soda | Baking Soda + Heat |
| 279 | Sodium Acetate | Hot Ice + Heat · Baking Soda + Vinegar · Vinegar + Lye |
| 280 | Hot Ice | Sodium Acetate + Cold |
| 281 | Quicklime | Calcium + Fire · Slaked Lime + Heat · Pearl + Heat · Marble + Heat · Chalk + Heat · Seashell + Heat |
| 282 | Slaked Lime | Limewater + Heat · Calcium + Water · Quicklime + Water · Calcium Carbide + Water |
| 283 | Limewater | Slaked Lime + Water |
| 284 | Plaster of Paris | Gypsum + Heat · Desert Rose + Heat · Plaster + Heat |
| 285 | Wet Plaster | Plaster of Paris + Water |
| 286 | Borax | Boron + Salt Water |
| 287 | Starch | Potato + Water |
| 288 | Oobleck | Stiff Oobleck + Time · Starch + Water |
| 289 | Stiff Oobleck | Oobleck + Pressure |
| 290 | Super Absorbent | Plastic + Lye |
| 291 | Instant Snow | Super Absorbent + Water |
| 292 | Luminol | Ammonia + Coal |
| 293 | Cold Light | Luminol + Hydrogen Peroxide · Luminol + Blood |
| 294 | Phosphor | Zinc + Sulfur |
| 295 | Radium Paint | Radium + Phosphor |
| 296 | Copper Sulfate | Copper + Sulfuric Acid · White Copper Sulfate + Water |
| 297 | Silver Chloride | Silver + Chlorine |
| 298 | Carbon Monoxide | Carbon Dioxide + Coal |
| 299 | Hydrogen Sulfide | Egg + Time · Ultramarine + Acid |
| 300 | Tarnish | Silver + Hydrogen Sulfide · Silver + Sulfur |
| 301 | Acetone | Quicklime + Vinegar |
| 302 | Antifreeze | Alcohol + Water |
| 303 | Kerosene | Oil + Clay |
| 304 | Tar | Asphalt + Heat · Oil + Oxygen |
| 305 | Soot | Carbon Snake + Pressure · Ink + Heat · Smoke + Metal · Carbon Dioxide + Magnesium |
| 306 | Calcium Carbide | Quicklime + Graphite |
| 307 | Acetylene | Calcium Carbide + Water |
| 308 | Charcoal | Toast + Fire · Fries + Fire · Steak + Fire · Tofu + Fire · Nitrogen + Wood |
| 309 | Activated Charcoal | Steam + Charcoal |
| 310 | Coke | Nitrogen + Coal |
| 311 | Carbon Snake | Sulfuric Acid + Sugar |
| 312 | Mercury Vapour | Mercury + Heat |
| 313 | Sodium Vapour | Sodium + Neon |
| 314 | Smog | Nitrogen Dioxide + Smoke · Fog + Smoke |
| 315 | Freon | Fluorine + Methane |
| 316 | Waterglass | Sand + Lye |
| 317 | Crystal Garden | Waterglass + Copper Sulfate |
| 318 | Golden Rain | Lead + Iodine |
| 319 | Silica Gel | Waterglass + Acid · Crystal Garden + Acid |
| 320 | Epsom Salt | Magnesium + Sulfuric Acid |
| 321 | Molten Salt | Salt + Heat |
| 322 | Prussian Blue | Rust + Blood |
| 323 | Vermilion | Cinnabar + Pressure |
| 324 | Ochre | Clay + Rust |
| 325 | Ultramarine | Lapis Lazuli + Pressure |
| 326 | Indigo | Flower + Bacteria |
| 327 | Tyrian Purple | Seashell + Salt Water |
| 328 | Chlorophyll | Plant + Alcohol |
| 329 | Perfume | Flower + Alcohol |
| 330 | Sunscreen | Titanium + Oil |
| 331 | Sapphire | Blue Lamp + Pressure · Ruby + Titanium |
| 332 | Topaz | Granite + Fluorine |
| 333 | Opal | Quartz + Water |
| 334 | Jade | Peridot + Water |
| 335 | Turquoise | Verdigris + Clay |
| 336 | Lapis Lazuli | Marble + Sulfur |
| 337 | Malachite | Azurite + Time · Verdigris + Limestone |
| 338 | Azurite | Copper + Carbon Dioxide |
| 339 | Citrine | Amethyst + Heat |
| 340 | Smoky Quartz | Quartz + Gamma Ray |
| 341 | Rose Quartz | Quartz + Manganese |
| 342 | Garnet | Slate + Heat |
| 343 | Spinel | Magnesium + Ruby |
| 344 | Alexandrite | Beryllium + Chromium |
| 345 | Tourmaline | Granite + Boron |
| 346 | Moissanite | Silicon + Graphite |
| 347 | Pearl | Seashell + Sand |
| 348 | Amber | Resin + Pressure |
| 349 | Hematite | Rust + Pressure · Ochre + Heat · Lodestone + Heat |
| 350 | Lodestone | Hematite + Lightning |
| 351 | Marble | Limestone + Pressure |
| 352 | Shale | Mud + Pressure |
| 353 | Slate | Shale + Pressure |
| 354 | Sandstone | Sand + Limestone |
| 355 | Chalk | Seashell + Pressure · Limewater + Carbon Dioxide |
| 356 | Flint | Chalk + Quartz |
| 357 | Pumice | Lava + Carbon Dioxide |
| 358 | Basalt | Lava + Salt Water |
| 359 | Geode | Basalt + Amethyst |
| 360 | Desert Rose | Gypsum + Sand |
| 361 | Kimberlite | Peridot + Pressure |
| 362 | Mica | Granite + Potassium |
| 363 | Talc | Peridot + Steam |
| 364 | Kaolin | Clay + Acid |
| 365 | Fulgurite | Sand + Lightning |
| 366 | Fossil | Bone + Pressure |
| 367 | Petrified Wood | Wood + Waterglass |
| 368 | Resin | Wood + Fungus |
| 369 | Peat | Moss + Water |
| 370 | Lignite | Peat + Pressure |
| 371 | Bronze | Copper + Tin |
| 372 | Brass | Copper + Zinc |
| 373 | Pewter | Tin + Antimony |
| 374 | Solder | Tin + Lead |
| 375 | Electrum | Gold + Silver |
| 376 | Rose Gold | Gold + Copper |
| 377 | White Gold | Gold + Palladium |
| 378 | Sterling Silver | Silver + Copper |
| 379 | Stainless Steel | Steel + Chromium |
| 380 | Galvanized Steel | Steel + Zinc |
| 381 | Invar | Metal + Nickel |
| 382 | Nitinol | Nickel + Titanium |
| 383 | Amalgam | Mercury + Silver |
| 384 | Galinstan | Liquid Gallium + Tin |
| 385 | NaK | Sodium + Potassium |
| 386 | Wood's Metal | Bismuth + Lead |
| 387 | Duralumin | Aluminum + Copper |
| 388 | Tungsten Carbide | Tungsten + Graphite |
| 389 | Orichalcum | Brass + Gold |
| 390 | Frosted Glass | Hydrofluoric Acid + Glass |
| 391 | Borosilicate Glass | Glass + Boron |
| 392 | Lead Crystal | Glass + Lead |
| 393 | Stained Glass | Glass + Copper |
| 394 | Uranium Glass | Glass + Yellowcake |
| 395 | Cranberry Glass | Glass + Gold |
| 396 | Fiberglass | Glass + Plastic |
| 397 | Reinforced Concrete | Wet Concrete + Steel |
| 398 | Roman Concrete | Pumice + Slaked Lime |
| 399 | Adobe | Mud + Grass |
| 400 | Plaster | Wet Plaster + Time |
| 401 | Porcelain | Talc + Heat · Kaolin + Heat · Heater + Pressure |
| 402 | Asphalt | Tar + Gravel |
| 403 | Glue | Steam + Bone |
| 404 | Slime | Borax + Glue |
| 405 | Styrofoam | Plastic + Propane |
| 406 | Goo | Plastic + Heat · Nylon + Heat · Rubber + Heat · Acetone + Styrofoam |
| 407 | Teflon | Plastic + Fluorine |
| 408 | Silicone | Silicon + Oil |
| 409 | Nylon | Plastic + Ammonia |
| 410 | Wax | Oil + Cold · Molten Wax + Cold |
| 411 | Molten Wax | Wax + Heat |
| 412 | Candle | Wax + Cotton |
| 413 | Ink | Squid + Water · Soot + Glue |
| 414 | Pulp | Wood + Lye · Paper + Water · Cardboard + Water |
| 415 | Paper | Pulp + Heat · Pulp + Pressure |
| 416 | Cardboard | Paper + Glue |
| 417 | Photo Paper | Paper + Silver Chloride |
| 418 | Photograph | Rainbow + Photo Paper · Photo Paper + Photon · Photo Paper + X-Ray · Photo Paper + Tachyon |
| 419 | Cotton | Flower + Cloud |
| 420 | Cloth | Cotton + Pressure |
| 421 | Silk | Spider + Time |
| 422 | Latex | Wood + Milk |
| 423 | Rubber | Latex + Heat |
| 424 | Vulcanized Rubber | Rubber + Sulfur |
| 425 | Match | Red Phosphorus + Wood |
| 426 | Sponge | Wet Sponge + Pressure · Plastic + Bubbles |
| 427 | Wet Sponge | Sponge + Water |
| 428 | Aerogel | Sand + Alcohol |
| 429 | Carbon Fiber | Graphite + Plastic |
| 430 | Graphene | Graphite + Glue |
| 431 | Fullerene | Graphite + Laser |
| 432 | Steel Wool | Steel + Cotton |
| 433 | Bioplastic | Starch + Vinegar |
| 434 | Microplastic | Plastic + Pressure · Teflon + Pressure |
| 435 | Light Bulb | Glass + Tungsten |
| 436 | LED | Silicon + Gallium |
| 437 | Electromagnet | Fan + Pressure · Metal + Copper |
| 438 | Nichrome | Heater + Pressure · Nickel + Chromium |
| 439 | Potato Battery | Potato + Zinc |
| 440 | RTG | Plutonium + Germanium |
| 441 | Glowstick | Plastic + Cold Light |
| 442 | Sparkler | Fuse + Metal |
| 443 | Road Flare | Strontium + Fuse |
| 444 | Cactus | Plant + Sand |
| 445 | Kelp | Algae + Stone |
| 446 | Coral | Algae + Limestone |
| 447 | Lichen | Fungus + Algae |
| 448 | Seashell | Snail + Time · Firefly + Snail |
| 449 | Yeast | Fungus + Fruit |
| 450 | Bacteria | Meat + Time · Mud + Sugar |
| 451 | Mold | Bread + Time |
| 452 | Slime Mold | Fungus + Slime |
| 453 | Penicillin | Mold + Water |
| 454 | Wheat | Grass + Seed |
| 455 | Sugarcane | Grass + Steam |
| 456 | Flour | Wheat + Pressure |
| 457 | Dough | Flour + Water |
| 458 | Bread | Dough + Heat |
| 459 | Toast | Bread + Heat |
| 460 | Corn | Grass + Fertilizer |
| 461 | Popcorn | Corn + Fire |
| 462 | Potato | Potato Battery + Time · Fruit + Dirt |
| 463 | Fries | Oil + Potato |
| 464 | Lemon | Fruit + Acid |
| 465 | Sugar | Sugarcane + Pressure |
| 466 | Caramel | Sugar + Heat · Candy + Heat · Mint Candy + Heat · Cotton Candy + Heat · Syrup + Heat · Honey + Heat · Jam + Heat · Marshmallow + Fire |
| 467 | Candy | Caramel + Cold |
| 468 | Mint Candy | Candy + Plant |
| 469 | Cotton Candy | Caramel + Cloud |
| 470 | Syrup | Cola + Time · Jelly + Heat · Sugar + Water · Candy + Water · Cotton Candy + Water |
| 471 | Honey | Bee + Flower |
| 472 | Jam | Fruit + Sugar |
| 473 | Cocoa | Seed + Yeast |
| 474 | Chocolate | Melted Chocolate + Cold · Cocoa + Sugar |
| 475 | Melted Chocolate | Chocolate + Heat |
| 476 | Milk | Ice Cream + Heat · Seed + Water |
| 477 | Curds | Milk + Heat · Milk + Vinegar · Lemon + Milk |
| 478 | Cheese | Curds + Pressure · Yogurt + Pressure |
| 479 | Butter | Milk + Pressure |
| 480 | Yogurt | Milk + Bacteria |
| 481 | Ice Cream | Milk + Snow |
| 482 | Egg | Bird + Seed · Bird + Fruit · Bird + Ant · Bird + Worm · Bird + Locust · Seed + Limestone |
| 483 | Fried Egg | Egg + Heat · Naked Egg + Heat · Egg + Microwave |
| 484 | Naked Egg | Egg + Vinegar |
| 485 | Meat | Fish + Time · Electric Eel + Time · Squid + Time · Frog + Time |
| 486 | Steak | Meat + Heat |
| 487 | Blood | Meat + Pressure |
| 488 | Bone | Fish + Time |
| 489 | Feather | Bird + Time |
| 490 | Wine | Yeast + Fruit |
| 491 | Soda Water | Water + Carbon Dioxide |
| 492 | Cola | Soda Water + Caramel |
| 493 | Marshmallow | Sugar + Egg |
| 494 | Tofu | Milk + Salt |
| 495 | Jelly | Glue + Sugar |
| 496 | Jerky | Meat + Salt |
| 497 | Plankton | Algae + Salt Water |
| 498 | Jellyfish | Plankton + Slime |
| 499 | Fish | Egg + Salt Water |
| 500 | Electric Eel | Fish + Battery |
| 501 | Bird | Egg + Cloud |
| 502 | Worm | Mud + Fruit |
| 503 | Snail | Worm + Limestone |
| 504 | Squid | Jellyfish + Ink |
| 505 | Frog | Fish + Mud |
| 506 | Ant | Dirt + Sugar |
| 507 | Termite | Ant + Wood |
| 508 | Spider | Ant + Glue |
| 509 | Locust | Ant + Grass |
| 510 | Bee | Ant + Flower |
| 511 | Butterfly | Worm + Flower |
| 512 | Firefly | Bee + Phosphor |
| 513 | Tardigrade | Lichen + Water · Tun + Water |
| 514 | Phoenix | Bird + Fire |
| 515 | Fog | Dry Ice + Water |
| 516 | Hail | Ice + Cloud |
| 517 | Permafrost | Mud + Cold · Dirt + Ice |
| 518 | Glacier Ice | Snow + Pressure |
| 519 | Liquid Hydrogen | Hydrogen + Cold |
| 520 | Quicksand | Sand + Clay |
| 521 | Aurora | Oxygen + Electron |
| 522 | Ball Lightning | Plasma + Cloud |
| 523 | Rainbow | Cloud + Photon |
| 524 | Meteor | Star + Gravel |
| 525 | Supernova | Star + Metal |
| 526 | Pulsar | Neutronium + Magnet |
| 527 | Quark-Gluon Plasma | Neutronium + Plasma |
| 528 | Time Crystal | Quartz + Dark Matter |
| 529 | Ice-Nine | Ice + Strange Matter |
| 530 | Grey Goo | Graphene + Virus |
| 531 | Elixir of Life | Philosopher's Stone + Water |
| 532 | Greek Fire | Tar + Quicklime |
| 533 | Gamma Ray | Black Hole + White Hole · Electron + Positron |
| 534 | X-Ray | Pulsar + Star · Tungsten + Electron |
| 535 | Ultraviolet | Mercury Vapour + Electron |
| 536 | Microwave | Magnet + Spark |
| 537 | Muon | Pion + Time |
| 538 | Pion | Proton + Proton |
| 539 | Higgs Boson | Muon + Muon |
| 540 | Tachyon | Dark Matter + Neutrino |
| 541 | Switch | Brass + Plastic |
| 542 | Button | Switch + Rubber |
| 543 | Clock | Quartz + Battery · Time Crystal + Switch |
| 544 | Pressure Plate | Button + Steel |
| 545 | Photocell | Selenium + Copper |
| 546 | Thermostat | Switch + Mercury |
| 547 | Door | Steel + Electromagnet |
| 548 | Lamp | LED + Plastic |
| 549 | Red Lamp | Lamp + Ruby |
| 550 | Green Lamp | Lamp + Emerald |
| 551 | Blue Lamp | Lamp + Sapphire |
| 552 | Laser Emitter | Laser + Switch |
| 553 | Heater | Nichrome + Porcelain |
| 554 | Cooler | Bismuth + Tellurium |
| 555 | Fan | Electromagnet + Magnet |
| 556 | Dispenser | Clone + Switch |
| 557 | Drain | Void + Switch |
| 558 | Beam Splitter | Mirror + Quartz |
| 559 | Chalcopyrite | Lava + Sulfur |
| 560 | Wolframite | Steam + Quartz |
| 561 | White Copper Sulfate | Copper Sulfate + Heat |
| 562 | Liquid Methane | Methane + Cold |
| 563 | Heavy Ice | Heavy Water + Cold |
| 564 | Sawdust | Termite + Wood |
| 565 | Tun | Tardigrade + Cold |
| 566 | Mead | Honey + Yeast |
| 567 | Denim | Indigo + Cloth |

</details>
