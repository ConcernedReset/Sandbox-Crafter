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
piles, liquids level out, air pressure builds and tears things apart (the air
is thick and swirling, as in The Powder Toy), fire uses up the air, and
plutonium goes off like a Powder Toy nuke. There's no top temperature: a Star
burns at the 15 million °C of the Sun's heart. A
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
- **Tools:** Erase, Wall (indestructible, airtight, a perfect insulator and a
  perfect reflector), Spark, Heat, Cool,
  Wind (drag to blow), Mix, Pressure, Vacuum, Portal and Time. Wall and Time
  have options, in a strip under the tools that shows while they're picked;
  the game remembers your choices.
  - **Wall** has a checklist of what may pass: Solids (loose debris and
    creatures), Powders, Liquids, Gases, Energy (fire, plasma, lightning),
    Particles (light, neutrons and the rest), Heat and Air. With nothing
    ticked a wall is a perfect wall. Each wall remembers the boxes that were
    ticked when it was painted, so one world can have a perfect wall next to
    a grate for water, a vent for gas or a window for light. Things that are
    let through seep through the wall cell by cell (the wall never moves);
    a heat wall conducts like metal; an air wall lets pressure, wind and
    blasts through. Walls that let anything through are drawn as a mesh.
  - **Portal**: drag a line for one end, then another for the other end.
    The pair is a window between two places, always two-way: anything that
    crosses one end comes out of the other at the same point along it and
    keeps going, its direction turned by the angle between the two lines
    (never more than 90°, so parallel ends never flip anything: a floor end
    and a ceiling end make an endless fall). Powders, liquids, gases,
    flames, loose debris and creatures go through, and so do light and
    every flying particle, and the air on either side evens out with the air
    on the matching side of the other end, so wind and warm air come
    through too. If the way out is blocked, things wait on the line. The
    first pair is blue and orange, later pairs have their own colours, and
    an end still waiting for its partner is dashed. Right-click a portal (or
    erase any of it) to remove the pair; Clear removes them all. Up to 32
    pairs.
  - **Time** paints areas that run at ¼×, ½×, 2× or 4× speed: everything in
    them falls, flows, burns, decays, reacts and conducts heat at that
    speed, and flying particles slow down or speed up crossing them. The
    speed belongs to the place, so sand that falls out of a slow area speeds
    back up. Slow areas are tinted blue and fast ones orange, with a dashed
    border that crawls slowly backwards or forwards. Right-click to put an
    area back to normal speed; Clear removes every area. The air isn't
    affected.
  - **Spark** is electricity. It fills empty space with sparks, and works
    inside things as well as on them: metal and wires carry a pulse from
    wherever you click, switches flip, machines run, explosives go off,
    neon glows, and anything that reacts to electricity reacts (water splits,
    nitrogen turns to nitrogen dioxide). Anything else is left alone.
  - **Mix** stirs whatever is under the brush, swapping cells at random so
    layers blend within a few frames; walls stay put and the air is left
    alone.
- **Gas** and **Glow** (next to Replace) are display effects, both on to
  start with, and the game remembers your choice. Gas blurs gases, loose
  flames and plasma into soft clouds, as in The Powder Toy, and hot gas
  glows. Glow gives everything hot (lava, molten glass, red-hot metal, fire,
  sparks) a wide soft halo that lingers for a moment. Both only change the
  Normal view.
- **Views:** Normal, Heat (a thermal camera) and Pressure (the air grid). In
  the Heat view white is 6000 °C. There's no top temperature, so past that
  the colour never stops changing: it fades into a bright colour wheel
  (violet, pink, red, orange, yellow, green, cyan, blue and round again) and
  goes once round it every four powers of ten. Plasma is violet, plutonium
  in a lump yellow-green, a Star cyan, Quark-Gluon Plasma pink.
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
  come from the elements themselves. Spark and Mix still work, and in
  their place you get every machine (Switch, Clock, Heater, Cooler, Fan,
  Door, the lamps...) to paint with from the start. They count as found in
  the recipe tree, but only the ones you craft count on the discovery meter.
  It also turns the recipe tree round.
  Everything you've found is a blank box, and the elements you could make
  next show their names, with only the process (Mix, Heat, Cool...) under
  the line into them. Click one of them and one of its ingredients appears,
  always the same one; the rest stay blank, and the card skips the hint.
  Something made from a single ingredient shows only its process. The
  boxes never go away, so once you've found everything the tree still shows
  its whole shape. Picking an element in the palette doesn't move the tree
  in hard mode. Resetting discoveries keeps hard mode on.
- **Performance** (in the `⋯` menu): Auto, High, Medium or Low, remembered
  in your browser. High is the full simulation. Medium works out heat and
  the air every other step (heat at twice the rate, so it spreads about as
  fast; wind and blasts spread at half speed). Low does the same, runs a
  game that can't keep up in slow motion instead of stuttering, and has at
  most 4,000 flying particles at once. Auto, the default, starts at High,
  drops a level when frames take too long for about a second, and climbs
  back after about three seconds of quick frames; the menu shows where it
  is ("Auto (Medium)"). Gas and Glow are your own choice at every level.
- **World** (in the `⋯` menu) clears the world and loads a ready-made one.
  Two are for playing: the **Starting area** (rolling dirt, a sand dune and a
  stone-lined pond) and the **Wilderness**, hills to make a home in, with
  saplings that grow into a forest, logs, boulders, a coal seam, a pond with
  fish, and three humans. Five are showcases: **Creatures** (a pond full of
  swimmers, a meadow full of insects, frogs and snails, birds, a caged
  phoenix and two humans), **Every element** (each in its own little walled
  cell, a stress test), the **Physics lab** (portals, time zones, sieving
  walls, a pressure vessel, liquids by density, lava on water, a storm,
  growing things, a magnet, a laser, a heater for convection and a tiny
  reactor), **Machines** (every machine and control working in its own bay)
  and the **Weapons range** (eight firing points, each set off by painting
  Spark on its switch). Nothing you make in a showcase counts as a
  discovery, until you press Clear or load a play world. Your discoveries
  and physics settings stay as they are.
- **Show sleeping areas** (in the `⋯` menu) outlines the parts of the world
  that are asleep (see below): blue where fully asleep, green where half
  asleep.

There are eight ways to combine things (the tree calls contact Mix, or Spark
when it needs a spark, and particle hits Bombard or Collide):

| Method   | Example                                          |
| -------- | ------------------------------------------------ |
| Contact  | Dirt touching Water becomes Mud                  |
| Heat     | Sand above 1700 °C melts into Molten Glass       |
| Cold     | Water below 0 °C freezes into Ice                |
| Pressure | Wood crushed in a sealed Wall box becomes Coal   |
| Fire     | Burning Wood leaves Ash and Smoke (fire needs air) |
| Time     | A Plant that grows thick enough turns woody      |
| Decay    | Squeezed or bombarded, Radium decays into Radon  |
| Particles | A Neutron splits Uranium; ultraviolet knocks Electrons out of Metal |

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
  air beside them; the warm air swells (pushing outwards) and rises gently
  against the arrow, spreads out along the top, sinks back down at the
  sides and is drawn back in at the base. So a big heat source in the middle
  of the floor drives two steady rolls, as in The Powder Toy: anticlockwise
  on the left, clockwise on the right. A hot block sits in a loop of moving
  air that gradually cools it, and smoke and steam ride round with it. The Heat and Cool tools warm and chill the air too, even over empty
  space: a warm bubble rises, a cold pocket sinks. The Heat view shows the
  air's temperature, and pointing at a cell shows it too.
- **Edges.** A little box whose four sides are the roof, floor and walls of
  the world. Click a side to cycle it: solid, a void, a loop, and back to
  solid. Anything that moves out through a void vanishes, so a void floor
  drains away every loose grain and drop, water pours off a void side like a
  waterfall, and smoke escapes through a void roof. Things that stay put,
  like a stone floor along the edge, stay. Pressure waves and heat go out
  through a void edge too, instead of bouncing back off it as they do off a
  solid one. A loop joins an edge to the opposite one, so loops come in
  pairs: sand that falls off the floor comes in at the roof, water runs off
  one side and in at the other, and light, air, wind and heat carry on round
  too. A world looped on all four sides leaks nothing at all. Void edges are
  marked with a purple line on the game, looped ones with a dashed teal one.
- **Reset** puts everything back: down, strength 1, Newtonian
  gravity off, convection on, solid edges (how the game starts). The
  settings are remembered in your browser.

## How the physics works

Like The Powder Toy, the world is a grid (400 × 240) where each cell holds at
most one particle. Per-cell state lives in parallel typed arrays: element
type, temperature, lifetime, velocity and a "ctype" (what a spark is running
through, what a fire is burning, what a clone copies).

Each frame (60 per second):

0. **Sleeping areas.** The world is divided into 16 × 16 chunks, each
   awake, half asleep or fully asleep. A chunk where nothing has moved for
   8 steps goes **half asleep** when nothing in it would answer the heat
   and air it has: its particles are frozen, while heat still flows through
   it and the air over it moves. That's most of the world while something
   is going on elsewhere: empty sky, settled ground warming slowly, sand in
   a breeze too light to shift it. It wakes when something in it would
   answer: no gas, fire, plants, creatures, machines or anything
   radioactive; nothing past its melting, boiling or ignition point; no
   pair of neighbours that can react; no powder or liquid in a wind strong
   enough to push it (about 0.4 for sand); no solid under pressure that
   could tear it; no portal or time zone. A half-asleep chunk whose
   temperatures haven't changed for 8 steps, with still air round it and
   everything at room temperature (within 0.1 °C counts), goes **fully
   asleep**: its heat isn't worked out either. After every step each chunk
   is compared with how it was: anything moving or changing element (a
   tool, a blast, a grain from next door) wakes it and the chunks round it;
   heat or air reaching a fully asleep chunk brings it to half asleep. The air itself rests while
   it's still everywhere (pressure and wind under 0.01, air within 0.1 °C of
   room temperature). None of this changes how anything behaves; a settled
   scene just costs almost nothing (the starting scene steps three times
   faster once it settles, and with a fire burning in it about 1.6 times).

1. **Particles update** bottom-to-top, alternating left/right to avoid drift.
   ("Bottom" is wherever gravity points: the scan starts from that end.)
   - *Powders* fall, accelerate, and slide off slopes diagonally, so they pile up.
   - *Liquids* fall, then flow sideways, and remember their flow direction.
     Liquid lying on top flows on towards the nearest drop it can see along
     the surface, so a heap of water levels out within a few seconds. A
     denser liquid flows sideways under a lighter one too, so salt water
     poured into water spreads out flat along the bottom.
   - *Gases* random-walk with a buoyant bias against gravity.
   - Anything heavier sinks through lighter liquids and gases (sand sinks in
     water, oil floats on it, steam bubbles up through it). Something sinking
     into a liquid pushes it aside into open space next to it where it can,
     so a stream poured into a pool doesn't carry the pool up with it.
   - Particles are pushed by the air and can be flung by explosions.
2. **Reactions and phase changes.** Each particle checks one random neighbour
   against a reaction table, and checks its own temperature and the local air
   pressure against its transition points.
3. **Heat** conducts between touching particles according to each element's
   conductivity (diamond and metal are fast, wall is a perfect insulator), and
   anything exposed to open air drifts slowly back to room temperature (with
   convection on, it trades heat with the air beside it instead, much
   faster). There is no highest temperature, only absolute zero at the
   bottom: Lightning is 30,000 °C, Plasma 20,000 °C, a Star 15 million °C,
   a Supernova a billion and Quark-Gluon Plasma 5.5 trillion, as hot as
   the real thing. Above 10,000 °C things glow blue-white.
4. **Air** is simulated on a coarse 4 × 4 grid of pressure and velocity cells
   (`src/sim/air.js`), the way The Powder Toy does it. Pressure pushes air
   from high to low, walls block the flow, and the map edges leak to zero.
   Every frame the pressure and the flow are both blurred over each block
   and its neighbours, which makes the air thick and viscous, and the flow
   carries itself along, so gusts keep going and curl into eddies, and an
   explosion pushes out a slow, smooth, rounded front instead of a sharp
   ringing one. A sealed Wall box can hold the pressure needed to make
   diamonds, and explosions send out a visible shockwave in the Pressure view.

   **Wall is a perfect container.** It stays at room temperature whatever
   touches it, and nothing gets through it, even a wall one cell thick or
   drawn on the diagonal: no air, pressure or heat, no flying particle (each
   one bounces off it, neutrinos included), no blast and no Glow halo. Only
   the open air, joined to the edges of the map, slowly loses its pressure
   and its heat to the world beyond; air shut in a sealed box keeps both for
   as long as the box stays shut. So a box of hot air stays hot, a lump of
   lava in a box only warms the air in it, and a plutonium reaction in a box
   leaves the outside untouched.

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
   room, the better they conduct the faster (lava at one end of a sealed box
   melts ice at the other in a few seconds); the air warms three times as
   fast as they cool, and swells as it takes in heat and shrinks as it gives
   it up (so heating the air in a sealed box raises its pressure for as long
   as it stays hot, and in the open hot air pushes outwards and is drawn
   back as it cools; the extra pressure levels off at +40, however hot).
   Heat the wind merely carries along moves no pressure, so a plume rises
   smoothly instead of setting off pressure waves. The air is pushed gently
   against gravity in proportion to how much warmer than the room it is, up
   to a limit, and colder air sinks (The Powder Toy's Boussinesq
   convection); with convection on the map's edges drag on the air going
   through them, so a rising plume turns along the top and comes back down
   instead of pouring off the map. The air is carried along by the wind,
   spreads its heat to the air beside it, and loses its heat to the room.
   The loop this makes is the convection current. Very hot air radiates its heat away fast
   (radiation grows steeply with temperature), and air can only take up so
   much heat from a surface each frame, so the air beside a Star is searing
   but its heat doesn't flood the whole world.

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
     drop is shoved along. Boron, cadmium and the other control-rod metals
     soak them up; lead doesn't (it's a gamma shield, and neutrons bounce off
     it, as they do off real lead). Slow neutrons split
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
     it soaks up (a cell of lead stops about half, like a centimetre of real
     lead), so lead stops them and water barely does. A gamma ray passing a
     lead nucleus can turn into an electron and a positron.
   - X-rays go straight through water, wood and flesh but not bone or metal.
   - Ultraviolet behaves like light except that ordinary glass blocks it
     (quartz doesn't), and it makes fluorescent minerals glow. It carries
     more energy than visible light, so only ultraviolet knocks electrons
     out of metal, splits hydrogen into a proton and an electron, and turns
     oxygen into ozone; visible light frees electrons only from cesium. A
     Star gives off some ultraviolet, as the Sun does, and so does a mercury
     lamp.
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
   fed, and die of old age (they live three times as long as they used to),
   leaving bones, feathers or shells behind.

   The bigger ones have bodies several pixels big, and move as a whole:
   Fish (4 × 2, with a flicking tail), Electric Eel (6 × 2, wiggling), Squid
   (3 × 4, swimming up in bursts), Jellyfish (3 × 3, pulsing), Bird (3 × 2,
   flapping), Frog (3 × 2, climbing 2-cell steps), Snail and Spider (3 × 2),
   Phoenix (5 × 3) and the Human (3 × 6). The tiny ones (plankton, insects,
   worms, tardigrades) are still single pixels. Painted, they're put down a
   body apart, and each grows outward from where it starts over a few
   frames, wherever its body fits. They're hurt pixel by pixel: a pixel
   that's burnt, dissolved, erased, blown away or eaten, or hotter than
   60 °C or colder than −15 °C, is gone, and the body shows the gap. A fish
   out of water, or a human out of breath, loses a pixel every half second.
   Half its pixels gone, a creature dies, and what's left becomes its
   remains (ash, if it burned). A hurt creature grows a pixel back every 2½
   seconds while nothing hurts it. A conveyor carries a creature whole, a
   portal takes it through whole, a blast hurts it and throws it, a piston
   stops against it and a door waits for it. A Bird that catches fire turns
   into a Phoenix, the whole bird.

   **Humans** (Lightning striking Clay) have a mind of their own. A human
   carries as much as it picks up (nothing it digs through is wasted), but
   sets out to gather 10 of a thing at a time. It makes a camp on flat
   ground, scraping the grass off its fire pit, fetches wood (or coal, peat
   or sawdust) from up to 120 cells away, an armful at a time, and piles it
   beside the camp; with six pieces on the pile it kneels and rubs sticks
   until the pile catches as a **Campfire**: a gentle fire that holds 45 °C,
   never spreads and never scares anyone, burns down to ash, and goes out
   in water. Once the fire has been lit it
   builds a hut beside it, 9 wide and 9 high, from stone, brick, granite or
   concrete (wood only if there's nothing else, and then it may catch fire),
   taken from blocks and boulders rather than the ground it stands on: two
   short walls over doorways 6 high, and a roof. Then it keeps the fire fed
   from what it carries and sits a few cells from it, on the side away from
   the hut. Everyone helps build the first pile; after that one human keeps
   the fire going while the others build. Once the hut is up and the fire
   has burned a while, each human crafts for itself, in order: a wooden
   pickaxe (3 wood; with it, it digs anything up to strength 150: stone,
   granite and most metals, not steel or diamond); coal and salt, mined
   from deposits it knows of within 120 cells of camp, which turn into 10
   gunpowder in its pack; metal (any
   metal or alloy) for a gun (5 metal and a wood stock); then 8 more for
   armour. To reach what's buried it digs a **tunnel**, at 45° steps
   (level, stairs, or a shaft it climbs up and down), lining it with
   **Scaffolding** wherever dirt or sand would fall in, so the ground
   around stays put. It cuts 4 scaffolding from each piece of wood in its
   pack; running short, it goes up for wood and
   comes back. Every tunnel joins one
   network the humans share: entrances, junctions, bends and ends, which
   they find their way along, branching off an existing tunnel when that's
   shorter than starting a new one, and digging out or giving up on
   stretches that get blocked. Cutting a tree at its foot brings it down.
   Humans in each other's way trade places. A shot is 4 pellets in a tight spread for 1 gunpowder; each
   pellet takes out the pixel of a creature it hits. Armed humans shoot
   Spiders and Phoenixes near camp, hunt an animal now and then (it leaves
   Meat), and fight humans from other camps; an unarmed human flees an
   armed rival. Armour takes half the hits from pellets and blasts, and
   breaks after 10. It goes back for coal and salt when its gunpowder runs
   low. It shelters
   in the hut from cold air and from rain, snow or hail. It runs from lava,
   acid, napalm, flames, anything very hot, grey goo, viruses, antimatter,
   black holes and blasts, and steps straight back from any flame or
   scorching thing within two cells of it, its own fire's included; it won't
   walk through its own fire, and squeezes past other humans in its way.
   Anything weak in its way (powders, and solids no stronger than
   sandstone: dirt, sand, wood, leaves, ice, glass and the like) it digs
   through a cell at a time, up in steps if where it's going is higher, but
   never what a human built or put down, nor anything stronger. It
   swims across water to where it was going (or, going nowhere, to the
   nearest shore), coming up for air; held under for more than about 10
   seconds, it starts to drown. Humans near each other share a camp and
   split the work. It holds its body at 37 °C, so warm ground near its fire
   doesn't hurt it. It shows what it last picked up or is using in its hand
   (a pickaxe, a gun), and armour turns its shirt grey. Hover over a
   creature to see its health, and what a human is doing and carrying. The
   Wilderness has coal, salt and metal buried in it.
9. **Trees**: a **Sapling** (Seed + Fertilizer) dropped on dirt, mud, grass
   or sand takes root and grows: its trunk climbs to a height of its own (15
   to 45, two cells wide when it's tall), a few branches sprout leaves, and
   then it puts out its crown of **Leaves**: a round oak, a pointed pine or
   a wide flat acacia, green, dark, autumn-coloured or in blossom, thick or
   sparse. It grows up against the gravity arrow. Leaves burn easily. (A
   plain Seed still grows a small tree.)
10. **Growing things**: wheat, sugarcane, cactus and kelp grow straight up to a
   random height; moss, lichen, coral and mould creep into what they feed on.
11. **Light and colour**: gases like neon, argon, xenon and sodium vapour
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
  out three neutrons and a proton, heats what's left to a million °C (in a
  lump; a lone plutonium atom bred inside a uranium pile only adds 450 °C,
  like uranium) and adds a
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
| Switch | you've flipped it on (Spark it; Spark it again to flip it off) |
| Button | for a second and a half after you Spark it |
| Clock | a moment each second: it sends one pulse a second |
| Pressure Plate | anything rests on it: sand, water, a creature, a block |
| Photocell | light shines on it (it turns light into current, not heat) |
| Thermostat | it's hotter than 60 °C |
| Barometer | the air pressure beside it is above +5 |
| Smoke Detector | smoke, or any other gas, touches it |
| Wind Turbine | the wind blows past it faster than 0.5 |
| Inverter | nothing is powering it: a NOT gate (see below) |
| Delay Line | current is creeping along it: a slow, one-way wire (see below) |

| Machine | While powered it... |
| ------- | ------------------- |
| Door | opens (vanishes), and shuts again when the power stops, shoving loose things out of the doorway |
| Lamp, Red / Green / Blue Lamp | lights up: a pixel you can switch |
| Laser Emitter | fires a red laser beam out of every open face |
| Heater | heats up, faster and faster the longer it stays on (20 °C a frame, plus 0.1 °C more for every frame it's been on), with no limit |
| Cooler | chills itself, down to absolute zero |
| Fan | blows air out of every open face (mount it on a wall to aim it) |
| Pump | sucks in the air beside it and blows it out of the far ends of the pipe it sits on, building up pressure there; unpowered, it's shut |
| Conveyor | carries sand, liquids, debris and creatures resting on it along the belt, away from the end the power comes in at |
| Piston | pushes out an arm up to 8 cells, shoving up to 16 things in a row (not walls); the arm pulls back when the power stops |
| Igniter | sets anything flammable touching it alight, and throws little flames into the air beside it |
| Neutron Source | fires neutrons out of its open faces: start a reactor with a switch |
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

Power knows which way it came in. A conveyor carries things away from the end
it's powered from, a piston pushes away from the side its power comes in (a
row of pistons fed from one side pushes together), and powered by the Spark
tool, with no side, a piston pushes up. An **Inverter** answers on the side
opposite its input: it powers what's there unless something powers it. Until
it has been fed it works out which of its wires leads back to a switch or
other control, and takes that as its input. Inverters, and wires joining
inputs together, make any logic. A **Delay Line** carries current one cell
every 4 frames, forwards only, so ten cells wait about two thirds of a second.

Two machines need no power:

- A **Pipe** is an airtight tube, one cell wide. Its open ends are linked: air
  flows in at one and out at the others, even through walls, so the pressure
  at its ends evens out. Put a Pump at one end to drive the air one way.
- A **Safety Valve** is an airtight plug that opens by itself when the
  pressure beside it passes +30 and lets the air through (even set into a
  Wall), and shuts again once it's dropped below +10. Pressure can't crush
  it, since it opens long before.

Hard mode hands out all 30 machines.

Some things to build:

- **A door on a switch**: Switch → copper wire → Door. Flip the switch to open
  the door and flip it again to close it.
- **A tripwire**: a Laser Emitter aimed at a Photocell with a Lamp or Door
  touching it. Step into the beam and the lamp goes out, or the door shuts.
- **A light show**: a Clock wired to a row of lamps, and mirror lines at 45°
  steering a laser around the screen, colouring it as it bounces off gold or
  copper.
- **A pressure chamber**: a Wall box with a Pipe through its wall, a Pump on
  the outside end, a Safety Valve in the wall, and a Barometer inside wired to
  a lamp. Switch the pump on and watch the chamber fill until the valve
  lets go.
- **A fire alarm**: a Smoke Detector wired through a Delay Line to a Fan that
  clears the smoke.
- **A reactor you can start and stop**: a uranium pile with graphite rods, a
  Neutron Source on a switch to start it, and boron to stop it.

These are checked by tests in `test/machines.test.js` and
`test/machines-overhaul.test.js`.

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
src/sim/shapes.js              the bigger creatures' pictures, compiled to pixel offsets
src/sim/creatures.js           creatures several pixels big: birth, damage, healing, moving
src/sim/humans.js              what humans do: camps, campfires, huts, fleeing, swimming
src/sim/elements-more.js       gap-fillers: ores, reactions that were missing, new uses
src/sim/world.js               the grid simulation: movement, heat, reactions
src/sim/behaviors.js           special behaviours (fire, plants, black holes...)
src/sim/particles.js           the flying-particle layer
src/sim/machines.js            power, controls, doors and the other machines
src/sim/air.js                 the pressure / wind grid, and air temperature for convection
src/sim/gravity.js             gravity's direction and strength, and Newtonian gravity
src/sim/fft.js                 fast Fourier transforms for the Newtonian gravity field
src/render/renderer.js         draws the world, soft gas, glow, particles, heat and pressure views
src/render/tree-view.js        draws the recipe tree; dragging, zooming and clicking it
src/game/tree.js               lays out the recipe tree (which elements, which links, where)
src/game/physics-panel.js      the Physics panel: gravity dial, strength, the two switches
src/game/scenes.js             the ready-made worlds in the World menu
src/sim/trees.js               saplings growing into trees
src/game/                      input, zoom camera, UI, saved progress
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
walls and temperatures), the Spark tool inside nitrogen, water, metal and
stone, and particle impacts, and
the camera tests cover zooming and panning. The Physics panel tests cover
reading the strength box, turning the dial and saving the settings; the
build test checks the single-file build runs. The tree tests cover which elements the
recipe tree shows, one connection into each, columns, overlap, free play and
process names, and Spark shown as a process. The hard mode tests cover blank boxes and named targets, the
one ingredient shown (the same every time, and none for a single-ingredient
recipe), the tree keeping every box, the blocked tools, Mix still working and
the setting being saved, Spark working in hard mode, and the machines it
hands out (found in the tree, not on the meter). The machine tests
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
lasting until the box is opened, hot air pushing out and being drawn back in
the open, a full loop in a closed box (markers carried up come back down),
two steady rolls with calm pressure over a big heat source on the floor, the
Heat and Cool tools warming and chilling the air, and a sealed fire still
going out. The heat tests cover heat running
along a metal bar, hot air carrying heat across a room, no top temperature,
the hottest elements' real temperatures, plutonium being a million degrees
only in a lump, the pressure from hot air levelling off and going as it
cools, and a Star scorching the air around it without cooking the world. The
machine overhaul tests cover power remembering which way it came, the Heater
with no limit, the Cooler at absolute zero, the Fan in thick air, a pipe
evening out two boxes, a pump filling one, a safety valve opening and
shutting, a conveyor both ways, a piston pushing and pulling back (and
stopping at a wall), an inverter and a delay line, the three sensors, an
igniter and a neutron source. A
pressure test checks the air is thick: a burst spreads as one smooth front
instead of ringing. The wall tests check a one-cell Wall box keeps its
pressure and its heat, lets nothing out (heat, pressure, a plutonium
reaction, any kind of flying particle, a blast or the Glow halo), not even
through a diagonal wall, and stays at room temperature itself. The
wall-filter tests check the checklist: water through a liquids wall but not
sand, smoke out of a gas box but not water, light through a particles wall,
heat through a heat wall, pressure through an air wall, and walls staying
whole as things pass through them. The portal tests cover the endless fall,
light turned by perpendicular ends and kept straight by parallel ones, smoke
escaping a box through a pair, air through a pair, things waiting when the
way out is blocked, a lone end doing nothing, and removing pairs. The time
tests cover sand falling slower and faster, flames dying sooner and later,
light slowing in a slow area, and heat crossing a fast bar without
overshooting. The loop tests cover sand, water, heat, a gust of pressure and
light crossing the join, and a world looped all round keeping its pressure.
A render test checks the Heat view keeps changing colour, however hot things
get. The sleep tests check settled sand and water fall asleep and wake for
tools, a hole beneath them, heat from next door and moving air; that heat
crosses into a sleeping area as fast as into an awake one; that slow
reactions (water turning dirt to mud), radioactivity and plants carry on;
that nothing sleeps under Newtonian gravity; and that the settled starting
scene needs a tenth of the particle updates. The performance tests check
Medium's heat keeps pace with High's without overshooting, the air steps
every other step, Low's particle cap, Auto's levels, and the saved choice.
The creature tests check shapes compile, a seed grows ring by ring (and
gives up with no room), a body falls whole with sand piling on it, lost
pixels are damage and half the body lost is death, only the hot pixels are
hurt and they heal, death by heat leaves ash, a bird turned to a phoenix
turns whole, fish stay in the water and die out of it, birds flap, snails
climb a step, painting spaces creatures out, conveyors carry them and
portals take them through whole, blasts hurt them, time zones slow them, and
the inspect line shows health and jobs. The human tests check the body, that
a human runs from lava, swims to shore, drowns slowly under a lid, gathers
wood into a pile and lights it, shares a camp, builds a hut with its
doorways open and shelters in it from snow. The human situation tests run
humans, each with three random seeds, through a lone camp, three and five
humans sharing the work, a coal fire, wood far away, up terraces and across
a pond, a pit, rolling hills, a long drop, sideways gravity, a floating
block of wood, nothing to burn, a walled-in room, the Wilderness and the
starting area, and a long 20,000-step run: each must get its fire lit (and
its hut built, where that's the point) without anyone dying or being
badly hurt.
The tree tests check a sapling grows a trunk and a crown, waits for soil,
grows differently every time, and grows against a sideways gravity arrow.
The world tests load every ready-made world and run it, and check the
starting area has no Wall and keeps its pond off the dirt, the wilderness
gives its humans wood and stone and keeps its pond, the creature world has
every creature, the gallery every element and the machine world every
machine (with its lamps lit), and that showcases discover nothing until the
world is cleared.
The recipe tests run all 1243 production rules in the real simulation.
About 1,670 tests in all. Most run in a few seconds; the human situations
and crafting runs take about a minute.

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
| 12 | Glass | Molten Glass + Cold · Geiger Tube + Pressure · Waterglass + Heat · Fiberglass + Fire · Light Bulb + Pressure · Barometer + Pressure · Beam Splitter + Pressure · Sand + Lightning |
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
| 30 | Hydrogen | Proton + Time · Liquid Hydrogen + Heat · Quark-Gluon Plasma + Time · Water + Spark · Sodium + Water · Potassium + Water · Lithium + Water · Cesium + Water · Cesium + Ice · Calcium + Water · Rubidium + Water · Francium + Water · Zinc + Acid · NaK + Water · Metal + Acid · Magnesium + Acid · Aluminum + Acid · Sodium + Acid · Lye + Aluminum · Barium + Water · Strontium + Water · Brittle Aluminum + Water · Sodium Vapour + Water · Water + Electron · Electron + Proton |
| 31 | Acid | Chlorine + Hydrogen · Chlorine + Water |
| 32 | Cloud | Steam + Smoke |
| 33 | Lightning | Cloud + Spark |
| 34 | Plasma | Steam + Heat · Plutonium + Neutron · Star + Metal |
| 35 | Thermite | Rust + Gunpowder · Aluminum + Rust |
| 36 | Nitro | Oil + Acid |
| 37 | Cryo | Nitrogen + Cold · Salt + Snow |
| 38 | Clone | Dispenser + Pressure · Diamond + Plasma |
| 39 | Void | Diamond + Pressure · Drain + Pressure |
| 40 | Oxygen | Ozone + Time · Liquid Oxygen + Heat · Hydrogen Peroxide + Heat · Hydrogen Peroxide + Time · Aurora + Time · Water + Spark · Fluorine + Water · Fluorine + Glass · Hydrogen Peroxide + Pyrolusite · Freon + Ozone · Nitrogen + Alpha Particle · Algae + Photon |
| 41 | Nitrogen | Cryo + Time |
| 42 | Ozone | Oxygen + Spark · Oxygen + Ultraviolet |
| 43 | Carbon Dioxide | Dry Ice + Heat · Carbon Monoxide + Fire · Soda Water + Time · Cola + Time · Smoke + Oxygen · Acid + Limestone · Limestone + Spark · Acid + Marble · Baking Soda + Vinegar · Yeast + Sugar · Dry Ice + Water · Chalk + Acid · Seashell + Acid · Baking Soda + Acid · Washing Soda + Acid · Acid + Fossil · Acid Rain + Limestone · Vinegar + Limestone · Vinegar + Chalk · Vinegar + Seashell · Vinegar + Marble · Vinegar + Pearl · Lemon + Baking Soda · Fire + Baking Soda · Diamond + Oxygen · Microplastic + Bacteria |
| 44 | Dry Ice | Carbon Dioxide + Cold |
| 45 | Liquid Oxygen | Oxygen + Cold |
| 46 | Clay | Mud + Sand · Mica + Water |
| 47 | Gravel | Stone + Pressure · Concrete + Pressure · Reinforced Concrete + Pressure · Roman Concrete + Pressure |
| 48 | Quartz | Sand + Pressure · Opal + Heat · Citrine + Heat · Smoky Quartz + Heat · Rose Quartz + Heat · Clock + Pressure |
| 49 | Granite | Lava + Pressure |
| 50 | Sulfur | Lava + Steam |
| 51 | Copper | Verdigris + Heat · Photocell + Pressure · Delay Line + Pressure · Pipe + Pressure · Chalcopyrite + Heat · Metal + Copper Sulfate · Malachite + Coal |
| 52 | Verdigris | Copper + Water · Turquoise + Acid |
| 53 | Limestone | Coral + Heat · Salt Water + Stone · Slaked Lime + Carbon Dioxide · Washing Soda + Slaked Lime |
| 54 | Cement | Limestone + Heat |
| 55 | Wet Concrete | Cement + Water |
| 56 | Concrete | Wet Concrete + Time |
| 57 | Propane | Oil + Heat |
| 58 | Gasoline | Oil + Hydrogen |
| 59 | Plastic | Propane + Pressure · Glowstick + Time · Smoke Detector + Pressure · Acetylene + Acid |
| 60 | Sodium | Salt + Spark · Molten Salt + Spark |
| 61 | Chlorine | Aqua Regia + Heat · Salt + Spark · Bleach + Acid · Molten Salt + Spark |
| 62 | Lye | Sodium + Water · Potassium + Water · Cesium + Water · Cesium + Ice · Rubidium + Water · Francium + Water · NaK + Water · Washing Soda + Slaked Lime · Barium + Water · Strontium + Water · Sodium Vapour + Water |
| 63 | Soap | Lye + Oil · Lye + Butter |
| 64 | Bubbles | Soap + Water · Hydrogen Peroxide + Blood · Cola + Mint Candy |
| 65 | Napalm | Gasoline + Soap |
| 66 | Potassium | Ash + Spark |
| 67 | Magnesium | Salt Water + Spark |
| 68 | Aluminum | Wind Turbine + Pressure · Clay + Spark · Bauxite + Lye |
| 69 | Silicon | Moissanite + Heat · Inverter + Pressure · Sand + Magnesium |
| 70 | Titanium | Stone + Magnesium |
| 71 | Boron | Glass + Magnesium |
| 72 | Graphite | Moissanite + Heat · Fullerene + Heat · Coal + Spark |
| 73 | Steel | Reinforced Concrete + Pressure · Pressure Plate + Pressure · Door + Pressure · Piston + Pressure · Metal + Coal |
| 74 | Magnet | Fan + Pressure · Metal + Lightning |
| 75 | Ferrofluid | Oil + Rust |
| 76 | Tungsten | Light Bulb + Pressure · Wolframite + Aluminum |
| 77 | Ammonia | Nitrogen + Hydrogen |
| 78 | Fertilizer | Ammonia + Acid |
| 79 | ANFO | Fertilizer + Oil |
| 80 | Dynamite | Nitro + Clay |
| 81 | C4 | Plastic + Nitro |
| 82 | Fuse | Wood + Gunpowder |
| 83 | Firework | Gunpowder + Copper |
| 84 | Glitter | Firework + Fire |
| 85 | Ruby | Clay + Pressure · Red Lamp + Pressure |
| 86 | Laser | Laser Emitter + Pressure · Ruby + Spark |
| 87 | Cinnabar | Sulfur + Granite |
| 88 | Mercury | Cinnabar + Heat · Mercury Vapour + Cold · Vermilion + Heat · Thermostat + Pressure · Barometer + Pressure |
| 89 | Lithium | Granite + Acid |
| 90 | Grass | Dirt + Plant |
| 91 | Moss | Stone + Plant |
| 92 | Fungus | Wood + Mud |
| 93 | Algae | Plant + Salt Water |
| 94 | Photon | Higgs Boson + Time · Plasma + Glass · Star + Hydrogen · Carbon Dioxide + Magnesium · Black Hole + White Hole · Neon + Electron · Heavy Water + Neutrino · Fluorite + Ultraviolet · Europium + Ultraviolet · Terbium + Ultraviolet · Phosphor + Ultraviolet · Chlorophyll + Ultraviolet · Uranium Glass + Ultraviolet |
| 95 | Flower | Epsom Salt + Plant · Plant + Photon |
| 96 | Fruit | Flower + Time · Butterfly + Flower |
| 97 | Seed | Fruit + Time |
| 98 | Alcohol | Fruit + Time · Perfume + Cold · Wine + Heat · Wine + Cold · Mead + Heat · Yeast + Sugar |
| 99 | Electron | Muon + Time · Metal + Ultraviolet · Cesium + Photon · Hydrogen + Ultraviolet · Lead + Gamma Ray · Heavy Water + Neutrino · Neutron + Time |
| 100 | Proton | Hydrogen + Ultraviolet · Nitrogen + Alpha Particle · Neutron + Time |
| 101 | Neutron | Polonium + Beryllium · Tritium + Deuterium · Metal + Proton · Lead + Proton · Tungsten + Proton · Beryllium + Alpha Particle · Deuterium + Muon · Proton + Proton |
| 102 | Neutrino | Muon + Time · Pion + Time · Neutron + Time |
| 103 | Pitchblende | Granite + Pressure |
| 104 | Yellowcake | Pitchblende + Heat |
| 105 | Uranium | Protactinium + Decay · Yellowcake + Hydrogen |
| 106 | Plutonium | Curium + Decay · RTG + Pressure · Uranium + Neutron |
| 107 | Thorium | Actinium + Decay · Pitchblende + Acid · Monazite + Acid |
| 108 | Nuclear Waste | Corium + Cold · Uranium + Neutron |
| 109 | Cesium | Uranium + Neutron |
| 110 | Fallout | Plutonium + Neutron |
| 111 | Corium | Uranium + Heat · Plutonium + Heat |
| 112 | Radium | Francium + Decay · Radium Paint + Time · Neutron Source + Pressure · Pitchblende + Spark |
| 113 | Radon | Radium + Decay |
| 114 | Helium | Radium + Decay · Radon + Decay · Polonium + Decay · Superfluid + Time · Tritium + Decay · Alpha Particle + Time · Quark-Gluon Plasma + Time · Tritium + Deuterium · Star + Hydrogen · Lithium + Proton · Lithium + Neutron · Deuterium + Muon |
| 115 | Polonium | Radon + Decay · Astatine + Decay |
| 116 | Lead | Nuclear Waste + Decay · Polonium + Decay · Galena + Heat · Golden Rain + Heat |
| 117 | Silver | Tarnish + Heat · Beam Splitter + Pressure · Lead + Acid · Tarnish + Baking Soda · Silver Chloride + Photon |
| 118 | Mirror | Silver + Glass |
| 119 | Positron | Lead + Gamma Ray |
| 120 | Antimatter | Cryo + Positron |
| 121 | Neon | Geiger Tube + Pressure · Helium + Plasma |
| 122 | Geiger Tube | Neon + Chlorine |
| 123 | Superfluid | Helium + Cold |
| 124 | Deuterium | Hydrogen + Neutron |
| 125 | Heavy Water | Deuterium + Fire · Heavy Ice + Heat |
| 126 | Tritium | Lithium + Neutron |
| 127 | Cobalt-60 | Metal + Neutron |
| 128 | Gold | Calaverite + Heat · Dissolved Gold + Heat · Supernova + Time · Mercury + Neutron |
| 129 | Philosopher's Stone | Gold + Mercury |
| 130 | Emerald | Green Lamp + Pressure · Quartz + Verdigris |
| 131 | Beryllium | Neutron Source + Pressure · Emerald + Acid |
| 132 | Amethyst | Geode + Pressure · Quartz + Neutron |
| 133 | Virus | Fungus + Neutron |
| 134 | Star | Hydrogen + Pressure |
| 135 | Neutronium | Lead + Pressure · Supernova + Time |
| 136 | Black Hole | Neutronium + Void |
| 137 | White Hole | Black Hole + Antimatter |
| 138 | Strange Matter | Neutronium + Proton |
| 139 | Dark Matter | Void + Neutrino |
| 140 | Fluorine | Topaz + Heat · Fluorite + Spark |
| 141 | Phosphorus | Bone + Coal |
| 142 | Red Phosphorus | Phosphorus + Photon |
| 143 | Argon | Nitrogen + Magnesium |
| 144 | Bromine | Salt Water + Chlorine |
| 145 | Krypton | Argon + Cryo |
| 146 | Xenon | Xenon Difluoride + Heat · Krypton + Cryo |
| 147 | Xenon Difluoride | Xenon + Fluorine |
| 148 | Iodine | Iodine Vapour + Cold · Kelp + Acid |
| 149 | Iodine Vapour | Iodine + Heat · Golden Rain + Heat |
| 150 | Selenium | Photocell + Pressure · Copper + Acid |
| 151 | Arsenic | Realgar + Heat |
| 152 | Germanium | Sphalerite + Acid |
| 153 | Tellurium | Calaverite + Heat · Cooler + Pressure |
| 154 | Calcium | Calcium Ion + Time · Fluorite + Spark · Limestone + Spark |
| 155 | Rubidium | Lepidolite + Spark |
| 156 | Strontium | Celestine + Spark |
| 157 | Barium | Barite + Spark |
| 158 | Vanadium | Vanadinite + Acid |
| 159 | Chromium | Chromite + Aluminum |
| 160 | Manganese | Pyrolusite + Aluminum |
| 161 | Nickel | Meteorite + Acid |
| 162 | Zinc | Sphalerite + Coal |
| 163 | Zirconium | Zircon + Magnesium |
| 164 | Niobium | Coltan + Acid |
| 165 | Molybdenum | Molybdenite + Heat |
| 166 | Technetium | Molybdenum + Neutron |
| 167 | Ruthenium | Technetium + Decay |
| 168 | Rhodium | Platinum Ore + Nitric Acid |
| 169 | Palladium | Platinum Ore + Nitric Acid |
| 170 | Cadmium | Sphalerite + Heat |
| 171 | Hafnium | Zircon + Acid |
| 172 | Tantalum | Coltan + Spark |
| 173 | Rhenium | Molybdenite + Acid |
| 174 | Osmium | Platinum Ore + Aqua Regia |
| 175 | Iridium | Igniter + Pressure · Platinum Ore + Aqua Regia |
| 176 | Platinum | Platinum Ore + Aqua Regia |
| 177 | Gallium | Liquid Gallium + Cold · Bauxite + Lye |
| 178 | Liquid Gallium | Gallium + Heat |
| 179 | Brittle Aluminum | Liquid Gallium + Aluminum · Galinstan + Aluminum |
| 180 | Indium | Sphalerite + Spark |
| 181 | Tin | Grey Tin + Heat · Cassiterite + Coal |
| 182 | Grey Tin | Tin + Cold |
| 183 | Antimony | Stibnite + Metal |
| 184 | Thallium | Pyrite + Acid |
| 185 | Bismuth | Cooler + Pressure · Galena + Coal |
| 186 | Molten Bismuth | Bismuth + Heat · Bismuth Crystal + Heat |
| 187 | Bismuth Crystal | Molten Bismuth + Cold |
| 188 | Rare Earths | Monazite + Acid |
| 189 | Didymium | Rare Earths + Acid |
| 190 | Scandium | Ytterbium + Spark |
| 191 | Yttrium | Ytterbite + Acid |
| 192 | Lanthanum | Rare Earths + Spark |
| 193 | Cerium | Rare Earths + Oxygen |
| 194 | Praseodymium | Didymium + Spark |
| 195 | Neodymium | Didymium + Spark · Neodymium Magnet + Acid |
| 196 | Promethium | Neodymium + Neutron |
| 197 | Samarium | Didymium + Heat · Promethium + Time |
| 198 | Europium | Samarium + Zinc |
| 199 | Gadolinium | Samarium + Acid |
| 200 | Terbium | Yttrium + Acid |
| 201 | Dysprosium | Holmium + Acid |
| 202 | Holmium | Erbium + Acid |
| 203 | Erbium | Yttrium + Acid |
| 204 | Thulium | Erbium + Acid |
| 205 | Ytterbium | Erbium + Heat |
| 206 | Lutetium | Ytterbium + Acid |
| 207 | Ferrocerium | Cerium + Metal |
| 208 | Neodymium Magnet | Neodymium + Metal |
| 209 | Actinium | Radium + Neutron |
| 210 | Francium | Actinium + Decay |
| 211 | Astatine | Bismuth + Alpha Particle |
| 212 | Protactinium | Neptunium + Decay · Thorium + Neutron |
| 213 | Neptunium | Americium + Decay |
| 214 | Americium | Smoke Detector + Pressure · Plutonium + Neutron |
| 215 | Curium | Americium + Neutron · Plutonium + Alpha Particle |
| 216 | Berkelium | Einsteinium + Decay · Curium + Neutron · Americium + Alpha Particle |
| 217 | Californium | Berkelium + Decay · Fermium + Decay · Curium + Alpha Particle |
| 218 | Einsteinium | Mendelevium + Decay · Californium + Neutron |
| 219 | Fermium | Nobelium + Decay · Einsteinium + Neutron |
| 220 | Mendelevium | Lawrencium + Decay · Einsteinium + Alpha Particle |
| 221 | Nobelium | Rutherfordium + Decay |
| 222 | Lawrencium | Dubnium + Decay |
| 223 | Rutherfordium | Seaborgium + Decay |
| 224 | Dubnium | Bohrium + Decay |
| 225 | Seaborgium | Hassium + Decay |
| 226 | Bohrium | Meitnerium + Decay |
| 227 | Hassium | Darmstadtium + Decay |
| 228 | Meitnerium | Roentgenium + Decay |
| 229 | Darmstadtium | Copernicium + Decay |
| 230 | Roentgenium | Nihonium + Decay |
| 231 | Copernicium | Flerovium + Decay |
| 232 | Nihonium | Moscovium + Decay |
| 233 | Flerovium | Livermorium + Decay · Plutonium + Calcium Ion |
| 234 | Moscovium | Tennessine + Decay · Americium + Calcium Ion |
| 235 | Livermorium | Oganesson + Decay · Curium + Calcium Ion |
| 236 | Tennessine | Berkelium + Calcium Ion |
| 237 | Oganesson | Californium + Calcium Ion |
| 238 | Alpha Particle | Americium + Decay · Nobelium + Decay · Lawrencium + Decay · Rutherfordium + Decay · Dubnium + Decay · Seaborgium + Decay · Bohrium + Decay · Hassium + Decay · Meitnerium + Decay · Darmstadtium + Decay · Roentgenium + Decay · Copernicium + Decay · Nihonium + Decay · Flerovium + Decay · Moscovium + Decay · Livermorium + Decay · Tennessine + Decay · Oganesson + Decay |
| 239 | Calcium Ion | Calcium + Plasma |
| 240 | Fluorite | Steam + Limestone |
| 241 | Galena | Lead + Sulfur |
| 242 | Sphalerite | Sulfur + Limestone |
| 243 | Pyrite | Metal + Sulfur |
| 244 | Cassiterite | Steam + Granite |
| 245 | Stibnite | Sulfur + Quartz |
| 246 | Barite | Sulfur + Salt Water · Barium + Sulfuric Acid |
| 247 | Celestine | Gypsum + Salt Water |
| 248 | Gypsum | Salt Water + Limestone |
| 249 | Realgar | Sulfur + Steam |
| 250 | Chromite | Peridot + Rust |
| 251 | Peridot | Magnesium + Lava |
| 252 | Pyrolusite | Salt Water + Gravel |
| 253 | Bauxite | Clay + Water · Brittle Aluminum + Water |
| 254 | Meteorite | Meteor + Time |
| 255 | Vanadinite | Galena + Oxygen |
| 256 | Molybdenite | Graphite + Sulfur |
| 257 | Coltan | Cassiterite + Granite |
| 258 | Zircon | Lava + Sand |
| 259 | Lepidolite | Lithium + Granite |
| 260 | Calaverite | Gold + Quartz |
| 261 | Monazite | Granite + Water |
| 262 | Ytterbite | Quartz + Granite |
| 263 | Platinum Ore | Gold + Sand |
| 264 | Nitrogen Dioxide | Nitric Acid + Heat · Aqua Regia + Heat · Nitrogen + Spark · Nitric Acid + Copper |
| 265 | Nitric Acid | Nitrogen Dioxide + Water |
| 266 | Aqua Regia | Nitric Acid + Acid |
| 267 | Dissolved Gold | Gold + Aqua Regia |
| 268 | Hydrofluoric Acid | Fluorine + Water · Fluorine + Hydrogen |
| 269 | Sulfur Dioxide | Sulfur + Fire · Pyrite + Heat · Sulfuric Acid + Heat · Hydrogen Sulfide + Fire · Tarnish + Heat · Chalcopyrite + Heat |
| 270 | Sulfuric Acid | Sulfur Dioxide + Water |
| 271 | Acid Rain | Sulfur Dioxide + Cloud · Smog + Cloud |
| 272 | Hydrogen Peroxide | Water + Ozone |
| 273 | Elephant Toothpaste | Hydrogen Peroxide + Yeast |
| 274 | Bleach | Lye + Chlorine |
| 275 | Vinegar | Alcohol + Oxygen · Wine + Bacteria |
| 276 | Baking Soda | Salt Water + Carbon Dioxide |
| 277 | Washing Soda | Baking Soda + Heat |
| 278 | Sodium Acetate | Hot Ice + Heat · Baking Soda + Vinegar · Vinegar + Lye |
| 279 | Hot Ice | Sodium Acetate + Cold |
| 280 | Quicklime | Calcium + Fire · Slaked Lime + Heat · Pearl + Heat · Marble + Heat · Chalk + Heat · Seashell + Heat |
| 281 | Slaked Lime | Limewater + Heat · Calcium + Water · Quicklime + Water · Calcium Carbide + Water |
| 282 | Limewater | Slaked Lime + Water |
| 283 | Plaster of Paris | Gypsum + Heat · Desert Rose + Heat · Plaster + Heat |
| 284 | Wet Plaster | Plaster of Paris + Water |
| 285 | Borax | Boron + Salt Water |
| 286 | Starch | Potato + Water |
| 287 | Oobleck | Stiff Oobleck + Time · Starch + Water |
| 288 | Stiff Oobleck | Oobleck + Pressure |
| 289 | Super Absorbent | Plastic + Lye |
| 290 | Instant Snow | Super Absorbent + Water |
| 291 | Luminol | Ammonia + Coal |
| 292 | Cold Light | Luminol + Hydrogen Peroxide · Luminol + Blood |
| 293 | Phosphor | Zinc + Sulfur |
| 294 | Radium Paint | Radium + Phosphor |
| 295 | Copper Sulfate | Copper + Sulfuric Acid · White Copper Sulfate + Water |
| 296 | Silver Chloride | Silver + Chlorine |
| 297 | Carbon Monoxide | Carbon Dioxide + Coal |
| 298 | Hydrogen Sulfide | Egg + Time · Ultramarine + Acid |
| 299 | Tarnish | Silver + Hydrogen Sulfide · Silver + Sulfur |
| 300 | Acetone | Quicklime + Vinegar |
| 301 | Antifreeze | Alcohol + Water |
| 302 | Kerosene | Oil + Clay |
| 303 | Tar | Asphalt + Heat · Oil + Oxygen |
| 304 | Soot | Carbon Snake + Pressure · Ink + Heat · Smoke + Metal · Carbon Dioxide + Magnesium |
| 305 | Calcium Carbide | Quicklime + Graphite |
| 306 | Acetylene | Calcium Carbide + Water |
| 307 | Charcoal | Toast + Fire · Fries + Fire · Steak + Fire · Tofu + Fire · Nitrogen + Wood |
| 308 | Activated Charcoal | Steam + Charcoal |
| 309 | Coke | Nitrogen + Coal |
| 310 | Carbon Snake | Sulfuric Acid + Sugar |
| 311 | Mercury Vapour | Mercury + Heat |
| 312 | Sodium Vapour | Sodium + Neon |
| 313 | Smog | Nitrogen Dioxide + Smoke · Fog + Smoke |
| 314 | Freon | Fluorine + Methane |
| 315 | Waterglass | Sand + Lye |
| 316 | Crystal Garden | Waterglass + Copper Sulfate |
| 317 | Golden Rain | Lead + Iodine |
| 318 | Silica Gel | Waterglass + Acid · Crystal Garden + Acid |
| 319 | Epsom Salt | Magnesium + Sulfuric Acid |
| 320 | Molten Salt | Salt + Heat |
| 321 | Prussian Blue | Rust + Blood |
| 322 | Vermilion | Cinnabar + Pressure |
| 323 | Ochre | Clay + Rust |
| 324 | Ultramarine | Lapis Lazuli + Pressure |
| 325 | Indigo | Flower + Bacteria |
| 326 | Tyrian Purple | Seashell + Salt Water |
| 327 | Chlorophyll | Plant + Alcohol |
| 328 | Perfume | Flower + Alcohol |
| 329 | Sunscreen | Titanium + Oil |
| 330 | Sapphire | Blue Lamp + Pressure · Ruby + Titanium |
| 331 | Topaz | Granite + Fluorine |
| 332 | Opal | Quartz + Water |
| 333 | Jade | Peridot + Water |
| 334 | Turquoise | Verdigris + Clay |
| 335 | Lapis Lazuli | Marble + Sulfur |
| 336 | Malachite | Azurite + Time · Verdigris + Limestone |
| 337 | Azurite | Copper + Carbon Dioxide |
| 338 | Citrine | Amethyst + Heat |
| 339 | Smoky Quartz | Quartz + Gamma Ray |
| 340 | Rose Quartz | Quartz + Manganese |
| 341 | Garnet | Slate + Heat |
| 342 | Spinel | Magnesium + Ruby |
| 343 | Alexandrite | Beryllium + Chromium |
| 344 | Tourmaline | Granite + Boron |
| 345 | Moissanite | Silicon + Graphite |
| 346 | Pearl | Seashell + Sand |
| 347 | Amber | Resin + Pressure |
| 348 | Hematite | Rust + Pressure · Ochre + Heat · Lodestone + Heat |
| 349 | Lodestone | Hematite + Lightning |
| 350 | Marble | Limestone + Pressure |
| 351 | Shale | Mud + Pressure |
| 352 | Slate | Shale + Pressure |
| 353 | Sandstone | Sand + Limestone |
| 354 | Chalk | Seashell + Pressure · Limewater + Carbon Dioxide |
| 355 | Flint | Chalk + Quartz |
| 356 | Pumice | Lava + Carbon Dioxide |
| 357 | Basalt | Lava + Salt Water |
| 358 | Geode | Basalt + Amethyst |
| 359 | Desert Rose | Gypsum + Sand |
| 360 | Kimberlite | Peridot + Pressure |
| 361 | Mica | Granite + Potassium |
| 362 | Talc | Peridot + Steam |
| 363 | Kaolin | Clay + Acid |
| 364 | Fulgurite | Sand + Lightning |
| 365 | Fossil | Bone + Pressure |
| 366 | Petrified Wood | Wood + Waterglass |
| 367 | Resin | Wood + Fungus |
| 368 | Peat | Moss + Water |
| 369 | Lignite | Peat + Pressure |
| 370 | Bronze | Copper + Tin |
| 371 | Brass | Copper + Zinc |
| 372 | Pewter | Tin + Antimony |
| 373 | Solder | Pipe + Pressure · Tin + Lead |
| 374 | Electrum | Gold + Silver |
| 375 | Rose Gold | Gold + Copper |
| 376 | White Gold | Gold + Palladium |
| 377 | Sterling Silver | Silver + Copper |
| 378 | Stainless Steel | Steel + Chromium |
| 379 | Galvanized Steel | Steel + Zinc |
| 380 | Invar | Metal + Nickel |
| 381 | Nitinol | Nickel + Titanium |
| 382 | Amalgam | Mercury + Silver |
| 383 | Galinstan | Liquid Gallium + Tin |
| 384 | NaK | Sodium + Potassium |
| 385 | Wood's Metal | Bismuth + Lead |
| 386 | Duralumin | Aluminum + Copper |
| 387 | Tungsten Carbide | Tungsten + Graphite |
| 388 | Orichalcum | Brass + Gold |
| 389 | Frosted Glass | Hydrofluoric Acid + Glass |
| 390 | Borosilicate Glass | Glass + Boron |
| 391 | Lead Crystal | Glass + Lead |
| 392 | Stained Glass | Glass + Copper |
| 393 | Uranium Glass | Glass + Yellowcake |
| 394 | Cranberry Glass | Glass + Gold |
| 395 | Fiberglass | Glass + Plastic |
| 396 | Reinforced Concrete | Wet Concrete + Steel |
| 397 | Roman Concrete | Pumice + Slaked Lime |
| 398 | Adobe | Mud + Grass |
| 399 | Plaster | Wet Plaster + Time |
| 400 | Porcelain | Talc + Heat · Kaolin + Heat · Heater + Pressure · Igniter + Pressure |
| 401 | Asphalt | Tar + Gravel |
| 402 | Glue | Steam + Bone |
| 403 | Slime | Borax + Glue |
| 404 | Styrofoam | Plastic + Propane |
| 405 | Goo | Plastic + Heat · Nylon + Heat · Rubber + Heat · Acetone + Styrofoam |
| 406 | Teflon | Plastic + Fluorine |
| 407 | Silicone | Silicon + Oil |
| 408 | Nylon | Plastic + Ammonia |
| 409 | Wax | Oil + Cold · Molten Wax + Cold |
| 410 | Molten Wax | Wax + Heat |
| 411 | Candle | Wax + Cotton |
| 412 | Ink | Squid + Water · Soot + Glue |
| 413 | Pulp | Wood + Lye · Paper + Water · Cardboard + Water |
| 414 | Paper | Pulp + Heat · Pulp + Pressure |
| 415 | Cardboard | Paper + Glue |
| 416 | Photo Paper | Paper + Silver Chloride |
| 417 | Photograph | Rainbow + Photo Paper · Photo Paper + Photon · Photo Paper + X-Ray · Photo Paper + Tachyon |
| 418 | Cotton | Flower + Cloud |
| 419 | Cloth | Cotton + Pressure |
| 420 | Silk | Spider + Time |
| 421 | Latex | Wood + Milk |
| 422 | Rubber | Latex + Heat · Conveyor + Pressure |
| 423 | Vulcanized Rubber | Rubber + Sulfur |
| 424 | Match | Red Phosphorus + Wood |
| 425 | Sponge | Wet Sponge + Pressure · Plastic + Bubbles |
| 426 | Wet Sponge | Sponge + Water |
| 427 | Aerogel | Sand + Alcohol |
| 428 | Carbon Fiber | Graphite + Plastic |
| 429 | Graphene | Graphite + Glue |
| 430 | Fullerene | Graphite + Laser |
| 431 | Steel Wool | Steel + Cotton |
| 432 | Bioplastic | Starch + Vinegar |
| 433 | Microplastic | Plastic + Pressure · Teflon + Pressure |
| 434 | Light Bulb | Glass + Tungsten |
| 435 | LED | Silicon + Gallium |
| 436 | Electromagnet | Fan + Pressure · Pump + Pressure · Metal + Copper |
| 437 | Nichrome | Heater + Pressure · Nickel + Chromium |
| 438 | Potato Battery | Potato + Zinc |
| 439 | RTG | Plutonium + Germanium |
| 440 | Glowstick | Plastic + Cold Light |
| 441 | Sparkler | Fuse + Metal |
| 442 | Road Flare | Strontium + Fuse |
| 443 | Cactus | Plant + Sand |
| 444 | Kelp | Algae + Stone |
| 445 | Coral | Algae + Limestone |
| 446 | Lichen | Fungus + Algae |
| 447 | Seashell | Snail + Time · Firefly + Snail |
| 448 | Yeast | Fungus + Fruit |
| 449 | Bacteria | Meat + Time · Mud + Sugar |
| 450 | Mold | Bread + Time |
| 451 | Slime Mold | Fungus + Slime |
| 452 | Penicillin | Mold + Water |
| 453 | Wheat | Grass + Seed |
| 454 | Sugarcane | Grass + Steam |
| 455 | Flour | Wheat + Pressure |
| 456 | Dough | Flour + Water |
| 457 | Bread | Dough + Heat |
| 458 | Toast | Bread + Heat |
| 459 | Corn | Grass + Fertilizer |
| 460 | Popcorn | Corn + Fire |
| 461 | Potato | Potato Battery + Time · Fruit + Dirt |
| 462 | Fries | Oil + Potato |
| 463 | Lemon | Fruit + Acid |
| 464 | Sugar | Sugarcane + Pressure |
| 465 | Caramel | Sugar + Heat · Candy + Heat · Mint Candy + Heat · Cotton Candy + Heat · Syrup + Heat · Honey + Heat · Jam + Heat · Marshmallow + Fire |
| 466 | Candy | Caramel + Cold |
| 467 | Mint Candy | Candy + Plant |
| 468 | Cotton Candy | Caramel + Cloud |
| 469 | Syrup | Cola + Time · Jelly + Heat · Sugar + Water · Candy + Water · Cotton Candy + Water |
| 470 | Honey | Bee + Flower |
| 471 | Jam | Fruit + Sugar |
| 472 | Cocoa | Seed + Yeast |
| 473 | Chocolate | Melted Chocolate + Cold · Cocoa + Sugar |
| 474 | Melted Chocolate | Chocolate + Heat |
| 475 | Milk | Ice Cream + Heat · Seed + Water |
| 476 | Curds | Milk + Heat · Milk + Vinegar · Lemon + Milk |
| 477 | Cheese | Curds + Pressure · Yogurt + Pressure |
| 478 | Butter | Milk + Pressure |
| 479 | Yogurt | Milk + Bacteria |
| 480 | Ice Cream | Milk + Snow |
| 481 | Egg | Bird + Seed · Bird + Fruit · Bird + Ant · Bird + Worm · Bird + Locust · Seed + Limestone |
| 482 | Fried Egg | Egg + Heat · Naked Egg + Heat · Egg + Microwave |
| 483 | Naked Egg | Egg + Vinegar |
| 484 | Meat | Fish + Time · Electric Eel + Time · Squid + Time · Frog + Time |
| 485 | Steak | Meat + Heat |
| 486 | Blood | Meat + Pressure |
| 487 | Bone | Fish + Time |
| 488 | Feather | Bird + Time |
| 489 | Wine | Yeast + Fruit |
| 490 | Soda Water | Water + Carbon Dioxide |
| 491 | Cola | Soda Water + Caramel |
| 492 | Marshmallow | Sugar + Egg |
| 493 | Tofu | Milk + Salt |
| 494 | Jelly | Glue + Sugar |
| 495 | Jerky | Meat + Salt |
| 496 | Plankton | Algae + Salt Water |
| 497 | Jellyfish | Plankton + Slime |
| 498 | Fish | Egg + Salt Water |
| 499 | Electric Eel | Fish + Battery |
| 500 | Bird | Egg + Cloud |
| 501 | Worm | Mud + Fruit |
| 502 | Snail | Worm + Limestone |
| 503 | Squid | Jellyfish + Ink |
| 504 | Frog | Fish + Mud |
| 505 | Ant | Dirt + Sugar |
| 506 | Termite | Ant + Wood |
| 507 | Spider | Ant + Glue |
| 508 | Locust | Ant + Grass |
| 509 | Bee | Ant + Flower |
| 510 | Butterfly | Worm + Flower |
| 511 | Firefly | Bee + Phosphor |
| 512 | Tardigrade | Lichen + Water · Tun + Water |
| 513 | Phoenix | Bird + Fire |
| 514 | Fog | Dry Ice + Water |
| 515 | Hail | Ice + Cloud |
| 516 | Permafrost | Mud + Cold · Dirt + Ice |
| 517 | Glacier Ice | Snow + Pressure |
| 518 | Liquid Hydrogen | Hydrogen + Cold |
| 519 | Quicksand | Sand + Clay |
| 520 | Aurora | Oxygen + Electron |
| 521 | Ball Lightning | Plasma + Cloud |
| 522 | Rainbow | Cloud + Photon |
| 523 | Meteor | Star + Gravel |
| 524 | Supernova | Star + Metal |
| 525 | Pulsar | Neutronium + Magnet |
| 526 | Quark-Gluon Plasma | Neutronium + Plasma |
| 527 | Time Crystal | Quartz + Dark Matter |
| 528 | Ice-Nine | Ice + Strange Matter |
| 529 | Grey Goo | Graphene + Virus |
| 530 | Elixir of Life | Philosopher's Stone + Water |
| 531 | Greek Fire | Tar + Quicklime |
| 532 | Gamma Ray | Cobalt-60 + Decay · Black Hole + White Hole · Electron + Positron |
| 533 | X-Ray | Pulsar + Star · Tungsten + Electron |
| 534 | Ultraviolet | Mercury Vapour + Electron |
| 535 | Microwave | Magnet + Spark |
| 536 | Muon | Pion + Time |
| 537 | Pion | Proton + Proton |
| 538 | Higgs Boson | Muon + Muon |
| 539 | Tachyon | Dark Matter + Neutrino |
| 540 | Switch | Inverter + Pressure · Brass + Plastic |
| 541 | Button | Switch + Rubber |
| 542 | Clock | Delay Line + Pressure · Quartz + Battery · Time Crystal + Switch |
| 543 | Pressure Plate | Button + Steel |
| 544 | Photocell | Selenium + Copper |
| 545 | Thermostat | Switch + Mercury |
| 546 | Inverter | Silicon + Switch |
| 547 | Delay Line | Clock + Copper |
| 548 | Barometer | Mercury + Glass |
| 549 | Smoke Detector | Americium + Plastic |
| 550 | Wind Turbine | Fan + Aluminum |
| 551 | Door | Steel + Electromagnet |
| 552 | Lamp | LED + Plastic |
| 553 | Red Lamp | Lamp + Ruby |
| 554 | Green Lamp | Lamp + Emerald |
| 555 | Blue Lamp | Lamp + Sapphire |
| 556 | Laser Emitter | Laser + Switch |
| 557 | Heater | Nichrome + Porcelain |
| 558 | Cooler | Bismuth + Tellurium |
| 559 | Fan | Wind Turbine + Pressure · Conveyor + Pressure · Electromagnet + Magnet |
| 560 | Dispenser | Clone + Switch |
| 561 | Drain | Void + Switch |
| 562 | Igniter | Iridium + Porcelain |
| 563 | Neutron Source | Radium + Beryllium |
| 564 | Pipe | Pump + Pressure · Copper + Solder |
| 565 | Pump | Piston + Pressure · Pipe + Electromagnet |
| 566 | Safety Valve | Pipe + Brass |
| 567 | Conveyor | Rubber + Fan |
| 568 | Piston | Pump + Steel |
| 569 | Beam Splitter | Mirror + Quartz |
| 570 | Chalcopyrite | Lava + Sulfur |
| 571 | Wolframite | Steam + Quartz |
| 572 | White Copper Sulfate | Copper Sulfate + Heat |
| 573 | Liquid Methane | Methane + Cold |
| 574 | Heavy Ice | Heavy Water + Cold |
| 575 | Sawdust | Termite + Wood |
| 576 | Tun | Tardigrade + Cold |
| 577 | Mead | Honey + Yeast |
| 578 | Denim | Indigo + Cloth |

</details>
