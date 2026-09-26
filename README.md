# Sandbox Crafter

A falling-sand physics sandbox crossed with an element-crafting game. You start
with four elements (**Sand, Water, Fire and Dirt**) and discover the other 536
by making things happen in the simulation: pour water on dirt, bake mud, crush
wood under pressure, run electricity through water, split uranium with
neutrons, blast a diamond with plasma. Every new element you make is added to
your palette.

All 118 elements of the periodic table are in there, along with ores, lab
chemicals, gems, alloys, food, creatures, weather and a few legends, and
most of the recipes are real reactions: see [What's in the table](#whats-in-the-table).

The physics is modelled on [The Powder Toy](https://powdertoy.co.uk/).

## Running it

It's plain JavaScript with no dependencies and no build step. ES modules don't
load from `file://`, so serve the folder:

```sh
npm start          # http://localhost:8080 (set PORT to change)
```

Any static file server works too, e.g. `python3 -m http.server`.

## How to play

- **Left-drag** paints with the selected element or tool. **Right-drag** erases.
- **Tools:** Erase, Wall (indestructible and airtight), Heat, Cool, Wind (drag
  to blow), Pressure and Vacuum.
- **Views:** Normal, Heat (a thermal camera) and Pressure (the air grid).
- **Keys:** `Space` pause, `.` step one frame, `[` `]` brush size, `1` `2` `3` views.
- The **Recipe book** gives a hint for each element you have the ingredients
  for, and can reveal the recipe if you're stuck.
- Discoveries are saved in your browser. The `⋯` menu has a free-play mode
  that unlocks everything, and a reset.

There are seven ways to combine things:

| Method   | Example                                          |
| -------- | ------------------------------------------------ |
| Contact  | Dirt touching Water becomes Mud                  |
| Heat     | Sand above 1700 °C melts into Molten Glass       |
| Cold     | Water below 0 °C freezes into Ice                |
| Pressure | Wood crushed in a sealed Wall box becomes Coal   |
| Fire     | Burning Wood leaves Ash and Smoke                |
| Time     | A Plant that grows thick enough turns woody      |
| Particles | A Neutron splits Uranium; light knocks Electrons out of Metal |

## How the physics works

Like The Powder Toy, the world is a grid (400 × 240) where each cell holds at
most one particle. Per-cell state lives in parallel typed arrays: element
type, temperature, lifetime, velocity and a "ctype" (what a spark is running
through, what a fire is burning, what a clone copies).

Each frame (60 per second):

1. **Particles update** bottom-to-top, alternating left/right to avoid drift.
   - *Powders* fall, accelerate, and slide off slopes diagonally, so they pile up.
   - *Liquids* fall, then flow sideways, and remember their flow direction.
   - *Gases* random-walk with a buoyant bias upward.
   - Anything heavier sinks through lighter liquids and gases (sand sinks in
     water, oil floats on it, steam bubbles up through it).
   - Particles are pushed by the air and can be flung by explosions.
2. **Reactions and phase changes.** Each particle checks one random neighbour
   against a reaction table, and checks its own temperature and the local air
   pressure against its transition points.
3. **Heat** conducts between touching particles according to each element's
   conductivity (diamond and metal are fast, wall is a perfect insulator), and
   anything exposed to open air drifts slowly back to room temperature.
4. **Air** is simulated on a coarse 4 × 4 grid of pressure and velocity cells
   (`src/sim/air.js`). Pressure pushes air from high to low, walls block the
   flow, and the map edges leak to zero. That's why a sealed Wall box can hold
   the pressure needed to make diamonds, and why explosions send out a
   visible shockwave in the Pressure view.

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
     metal, and heats whatever absorbs it. Ruby amplifies it.
   - Neutrons pass through most things, are soaked up by lead, boron and
     wall, and are slowed by graphite, heavy water and plastic. Slow neutrons
     split uranium three times as readily as fast ones.
   - Charged particles curve near magnets.
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
7. **Radioactivity**: radioactive elements warm themselves, throw off
   particles, and decay at random (the inspector shows each half-life).
   Radium decays to radon, then polonium, then lead, shedding helium.
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
    Strontium, barium, sulfur and friends burn with coloured flames.

### Nuclear physics you can play with

Each uranium split releases two neutrons and a burst of heat, so whether a
pile runs away depends on its size and what surrounds it:

- A 20 × 20 pile of uranium on its own stays calm; a 40 × 40 pile goes
  critical and burns through half its fuel, leaving glowing nuclear waste.
  Heat uranium past 2800 °C and it melts into corium.
- Put rods of **graphite** between the uranium and the same 20 × 20 pile burns
  hot, because slowed neutrons split atoms more easily. That's how the first
  reactor worked.
- Swap some rods for **boron** and it shuts down again.
- **Plutonium** releases three neutrons per split. A small pinch sits there; a
  ball of a few hundred grains detonates in a flash of plasma and fallout.
- **Deuterium** and **beryllium** double the neutrons passing through them, and
  **deuterium** and **tritium** fuse into helium above 3000 °C.

These are checked by tests in `test/radiation.test.js`.

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
src/sim/world.js               the grid simulation: movement, heat, reactions
src/sim/behaviors.js           special behaviours (fire, plants, black holes...)
src/sim/particles.js           the flying-particle layer
src/sim/air.js                 the pressure / wind grid
src/render/renderer.js         draws the world, glow, particles, heat and pressure views
src/game/                      input, UI, saved progress, starting scene
scripts/recipe-table.js        prints the recipe table at the end of this file
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
3. Write a `hint` so the recipe book can nudge players towards it.
4. Run `npm test`. The recipe suite builds a small lab for **every** recipe
   and checks it actually works in the simulation, and checks that every
   element can be reached from the starting four.

## Tests

```sh
npm test
```

The physics tests cover sand piling, water levelling (and thin films
settling), oil floating on water, heat conduction, pressure containment,
explosions, electricity and burning. The pressure tests cover blasts tearing
wood before stone before metal, hot metal tearing where cold metal holds,
debris falling, strong shells holding air while wood leaks, a pumped vessel
bursting once the pressure passes its strength, and a charge sealed in steel
blowing the shell apart. The radiation tests cover light, neutron
shielding, reactor criticality, the plutonium blast, magnets and decay. The
mechanics tests cover X-rays, gamma rays, ultraviolet and microwaves, gadgets
on a battery, creatures, growing plants, meteors, hot ice, tin pest, gallium,
and the superheavy decay chain. The recipe tests run all 929 production rules
in the real simulation.

Regenerate the table below after changing recipes with
`node scripts/recipe-table.js`.

<details>
<summary>Spoilers: every recipe</summary>

| No. | Element | Made from |
| --- | ------- | --------- |
| 5 | Steam | Water + Heat · Salt Water + Heat · Hydrogen + Fire · Fire + Water · Lava + Water · Sulfuric Acid + Water · Sulfuric Acid + Sugar · Quicklime + Water · Lava + Salt Water · Greek Fire + Water |
| 6 | Ice | Water + Cold · Salt Water + Cold |
| 7 | Mud | Permafrost + Heat · Dirt + Water |
| 8 | Lava | Dirt + Heat · Stone + Heat · Obsidian + Heat · Brick + Heat · Granite + Heat · Basalt + Heat |
| 9 | Stone | Lava + Cold |
| 10 | Obsidian | Lava + Water · Lava + Ice |
| 11 | Molten Glass | Sand + Heat · Glass + Heat · Quartz + Heat · Frosted Glass + Heat · Borosilicate Glass + Heat |
| 12 | Glass | Molten Glass + Cold · Sand + Lightning |
| 13 | Snow | Steam + Ice · Cloud + Cold |
| 14 | Brick | Mud + Heat · Clay + Heat |
| 15 | Plant | Mud + Water · Elixir of Life + Ash |
| 16 | Wood | Plant + Time |
| 17 | Smoke | Plant + Fire · Wood + Fire · Coal + Fire · Oil + Fire · Gunpowder + Fire · Sulfur + Fire · Gasoline + Fire · Plastic + Fire · Napalm + Fire · Graphite + Fire · ANFO + Fire · Dynamite + Fire · Grass + Fire · Moss + Fire · Fungus + Fire · Flower + Fire · Fruit + Fire · Phosphorus + Fire · Red Phosphorus + Fire · Arsenic + Heat · Kerosene + Fire · Tar + Fire · Amber + Fire · Resin + Fire · Peat + Fire · Lignite + Fire · Styrofoam + Fire · Paper + Fire · Cardboard + Fire · Cotton + Fire · Cloth + Fire · Rubber + Fire · Vulcanized Rubber + Fire · Match + Fire · Bioplastic + Fire · Bread + Fire · Toast + Fire · Caramel + Fire · Fried Egg + Fire · Steak + Fire · Feather + Fire · Marshmallow + Fire · Jerky + Fire · Greek Fire + Fire · Lava + Coal |
| 18 | Ash | Plant + Fire · Wood + Fire · Grass + Fire · Moss + Fire · Algae + Fire · Flower + Fire · Seed + Fire · Fallout + Time · Virus + Heat · Paper + Fire · Cardboard + Fire · Photo Paper + Fire · Photograph + Fire · Cotton + Fire · Cloth + Fire · Silk + Fire · Cactus + Fire · Kelp + Fire · Lichen + Fire · Wheat + Fire · Sugarcane + Fire · Popcorn + Fire · Phoenix + Time · Chlorine + Plant |
| 19 | Salt Water | Jellyfish + Time · Ash + Water · Salt + Water · Salt + Ice · Lye + Acid · Bleach + Acid · Bleach + Ink |
| 20 | Salt | Salt Water + Heat · Molten Salt + Cold · Sodium + Chlorine |
| 21 | Coal | Wood + Pressure · Lignite + Pressure |
| 22 | Diamond | Coal + Pressure · Kimberlite + Acid |
| 23 | Metal | Molten Metal + Cold · Cobalt-60 + Time · Lava + Coal · Coke + Rust |
| 24 | Molten Metal | Metal + Heat · Rust + Heat · Thermite + Fire · Copper + Heat · Aluminum + Heat · Titanium + Heat · Steel + Heat · Tungsten + Heat · Lead + Heat · Silver + Heat · Cobalt-60 + Heat · Gold + Heat · Beryllium + Heat · Vanadium + Heat · Chromium + Heat · Manganese + Heat · Nickel + Heat · Zinc + Heat · Zirconium + Heat · Niobium + Heat · Molybdenum + Heat · Ruthenium + Heat · Rhodium + Heat · Palladium + Heat · Cadmium + Heat · Hafnium + Heat · Tantalum + Heat · Rhenium + Heat · Osmium + Heat · Iridium + Heat · Platinum + Heat · Indium + Heat · Tin + Heat · Antimony + Heat · Thallium + Heat · Scandium + Heat · Yttrium + Heat · Lanthanum + Heat · Cerium + Heat · Praseodymium + Heat · Neodymium + Heat · Promethium + Heat · Samarium + Heat · Europium + Heat · Gadolinium + Heat · Terbium + Heat · Dysprosium + Heat · Holmium + Heat · Thulium + Heat · Ytterbium + Heat · Lutetium + Heat · Meteorite + Heat · Bronze + Heat · Brass + Heat · Pewter + Heat · Solder + Heat · Electrum + Heat · Rose Gold + Heat · White Gold + Heat · Sterling Silver + Heat · Stainless Steel + Heat · Galvanized Steel + Heat · Invar + Heat · Nitinol + Heat · Amalgam + Heat · Wood's Metal + Heat · Duralumin + Heat · Tungsten Carbide + Heat · Orichalcum + Heat · Nichrome + Heat |
| 25 | Rust | Metal + Water · Metal + Copper Sulfate |
| 26 | Oil | Plant + Pressure · Butter + Heat |
| 27 | Methane | Permafrost + Heat · Plant + Mud |
| 28 | Gunpowder | Coal + Salt |
| 29 | Battery | Metal + Salt Water |
| 30 | Spark | Battery + Metal |
| 31 | Hydrogen | Liquid Hydrogen + Heat · Water + Spark · Sodium + Water · Potassium + Water · Lithium + Water · Cesium + Water · Cesium + Ice · Calcium + Water · Rubidium + Water · Francium + Water · Zinc + Acid · NaK + Water · Water + Electron · Electron + Proton |
| 32 | Acid | Salt + Hydrogen · Chlorine + Hydrogen |
| 33 | Cloud | Steam + Smoke |
| 34 | Lightning | Cloud + Spark |
| 35 | Plasma | Steam + Heat · Plutonium + Neutron · Star + Metal |
| 36 | Thermite | Rust + Gunpowder · Aluminum + Rust |
| 37 | Nitro | Oil + Acid |
| 38 | Cryo | Nitrogen + Cold · Salt + Snow |
| 39 | Clone | Diamond + Plasma |
| 40 | Void | Diamond + Pressure |
| 41 | Oxygen | Ozone + Time · Liquid Oxygen + Heat · Hydrogen Peroxide + Time · Aurora + Time · Water + Spark · Fluorine + Water · Hydrogen Peroxide + Pyrolusite · Freon + Ozone · Nitrogen + Alpha Particle |
| 42 | Nitrogen | Cryo + Time |
| 43 | Ozone | Oxygen + Spark · Oxygen + Photon |
| 44 | Carbon Dioxide | Dry Ice + Heat · Carbon Monoxide + Fire · Soda Water + Time · Cola + Time · Smoke + Oxygen · Acid + Limestone · Limestone + Spark · Acid + Marble · Baking Soda + Vinegar · Yeast + Sugar · Dry Ice + Water |
| 45 | Dry Ice | Carbon Dioxide + Cold |
| 46 | Liquid Oxygen | Oxygen + Cold |
| 47 | Clay | Mud + Sand |
| 48 | Gravel | Stone + Pressure |
| 49 | Quartz | Sand + Pressure |
| 50 | Granite | Lava + Pressure |
| 51 | Sulfur | Lava + Steam |
| 52 | Copper | Lava + Sulfur · Metal + Copper Sulfate |
| 53 | Verdigris | Copper + Water |
| 54 | Limestone | Coral + Heat · Salt Water + Stone · Slaked Lime + Carbon Dioxide |
| 55 | Cement | Limestone + Heat |
| 56 | Wet Concrete | Cement + Water |
| 57 | Concrete | Wet Concrete + Time |
| 58 | Propane | Oil + Heat |
| 59 | Gasoline | Oil + Hydrogen |
| 60 | Plastic | Propane + Pressure · Glowstick + Time |
| 61 | Sodium | Salt + Spark |
| 62 | Chlorine | Salt + Spark · Bleach + Acid |
| 63 | Lye | Sodium + Water · Potassium + Water · Cesium + Water · Cesium + Ice · Rubidium + Water · Francium + Water · NaK + Water |
| 64 | Soap | Lye + Oil |
| 65 | Bubbles | Soap + Water · Hydrogen Peroxide + Blood · Cola + Mint Candy |
| 66 | Napalm | Gasoline + Soap |
| 67 | Potassium | Ash + Spark |
| 68 | Magnesium | Salt Water + Spark |
| 69 | Aluminum | Clay + Spark · Bauxite + Lye |
| 70 | Silicon | Sand + Magnesium |
| 71 | Titanium | Stone + Magnesium |
| 72 | Boron | Glass + Magnesium |
| 73 | Graphite | Coal + Spark |
| 74 | Steel | Metal + Coal |
| 75 | Magnet | Metal + Lightning |
| 76 | Ferrofluid | Oil + Rust |
| 77 | Tungsten | Metal + Plasma |
| 78 | Ammonia | Nitrogen + Hydrogen |
| 79 | Fertilizer | Ammonia + Acid |
| 80 | ANFO | Fertilizer + Oil |
| 81 | Dynamite | Nitro + Clay |
| 82 | C4 | Plastic + Nitro |
| 83 | Fuse | Wood + Gunpowder |
| 84 | Firework | Gunpowder + Copper |
| 85 | Glitter | Firework + Fire |
| 86 | Ruby | Clay + Pressure |
| 87 | Laser | Ruby + Spark |
| 88 | Cinnabar | Sulfur + Granite |
| 89 | Mercury | Cinnabar + Heat · Mercury Vapour + Cold |
| 90 | Lithium | Granite + Acid |
| 91 | Grass | Dirt + Plant |
| 92 | Moss | Stone + Plant |
| 93 | Fungus | Wood + Mud |
| 94 | Algae | Plant + Salt Water |
| 95 | Photon | Higgs Boson + Time · Plasma + Glass · Star + Hydrogen · Neon + Electron · Heavy Water + Neutrino · Fluorite + Ultraviolet · Europium + Ultraviolet · Terbium + Ultraviolet · Phosphor + Ultraviolet · Chlorophyll + Ultraviolet · Uranium Glass + Ultraviolet |
| 96 | Flower | Plant + Photon |
| 97 | Fruit | Flower + Time |
| 98 | Seed | Fruit + Time |
| 99 | Alcohol | Fruit + Time · Yeast + Sugar |
| 100 | Electron | Muon + Time · Metal + Photon · Cesium + Photon · Hydrogen + Photon · Lead + Photon · Heavy Water + Neutrino · Neutron + Time |
| 101 | Proton | Hydrogen + Photon · Nitrogen + Alpha Particle · Neutron + Time |
| 102 | Neutron | Polonium + Beryllium · Tritium + Deuterium · Metal + Proton · Lead + Proton · Tungsten + Proton · Beryllium + Alpha Particle · Deuterium + Muon |
| 103 | Neutrino | Muon + Time · Pion + Time · Neutron + Time |
| 104 | Pitchblende | Granite + Pressure |
| 105 | Yellowcake | Pitchblende + Heat |
| 106 | Uranium | Protactinium + Time · Yellowcake + Hydrogen |
| 107 | Plutonium | Curium + Time · Uranium + Neutron |
| 108 | Thorium | Actinium + Time · Pitchblende + Acid · Monazite + Acid |
| 109 | Nuclear Waste | Corium + Cold · Uranium + Neutron |
| 110 | Cesium | Uranium + Neutron |
| 111 | Fallout | Plutonium + Neutron |
| 112 | Corium | Uranium + Heat · Plutonium + Heat |
| 113 | Radium | Francium + Time · Pitchblende + Spark |
| 114 | Radon | Radium + Time |
| 115 | Helium | Radium + Time · Radon + Time · Polonium + Time · Superfluid + Time · Tritium + Time · Alpha Particle + Time · Tritium + Deuterium · Star + Hydrogen · Lithium + Proton · Lithium + Neutron · Deuterium + Muon |
| 116 | Polonium | Radon + Time · Astatine + Time |
| 117 | Lead | Nuclear Waste + Time · Polonium + Time · Galena + Heat |
| 118 | Silver | Lead + Acid · Tarnish + Baking Soda · Silver Chloride + Photon |
| 119 | Mirror | Silver + Glass |
| 120 | Positron | Lead + Photon |
| 121 | Antimatter | Cryo + Positron |
| 122 | Neon | Helium + Plasma |
| 123 | Geiger Tube | Neon + Chlorine |
| 124 | Superfluid | Helium + Cold |
| 125 | Deuterium | Hydrogen + Neutron |
| 126 | Heavy Water | Deuterium + Fire |
| 127 | Tritium | Lithium + Neutron |
| 128 | Cobalt-60 | Metal + Neutron |
| 129 | Gold | Calaverite + Heat · Dissolved Gold + Heat · Supernova + Time · Mercury + Neutron |
| 130 | Philosopher's Stone | Gold + Mercury |
| 131 | Emerald | Quartz + Verdigris |
| 132 | Beryllium | Emerald + Acid |
| 133 | Amethyst | Quartz + Neutron |
| 134 | Virus | Fungus + Neutron |
| 135 | Star | Hydrogen + Pressure |
| 136 | Neutronium | Lead + Pressure · Supernova + Time |
| 137 | Black Hole | Neutronium + Void |
| 138 | White Hole | Black Hole + Antimatter |
| 139 | Strange Matter | Neutronium + Proton |
| 140 | Dark Matter | Void + Neutrino |
| 141 | Fluorine | Fluorite + Spark |
| 142 | Phosphorus | Bone + Coal |
| 143 | Red Phosphorus | Phosphorus + Photon |
| 144 | Argon | Nitrogen + Magnesium |
| 145 | Bromine | Salt Water + Chlorine |
| 146 | Krypton | Argon + Cryo |
| 147 | Xenon | Xenon Difluoride + Heat · Krypton + Cryo |
| 148 | Xenon Difluoride | Xenon + Fluorine |
| 149 | Iodine | Iodine Vapour + Cold · Kelp + Acid |
| 150 | Iodine Vapour | Iodine + Heat |
| 151 | Selenium | Copper + Acid |
| 152 | Arsenic | Realgar + Heat |
| 153 | Germanium | Sphalerite + Acid |
| 154 | Tellurium | Calaverite + Heat |
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
| 168 | Ruthenium | Technetium + Time |
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
| 180 | Brittle Aluminum | Liquid Gallium + Aluminum |
| 181 | Indium | Sphalerite + Spark |
| 182 | Tin | Grey Tin + Heat · Cassiterite + Coal |
| 183 | Grey Tin | Tin + Cold |
| 184 | Antimony | Stibnite + Metal |
| 185 | Thallium | Pyrite + Acid |
| 186 | Bismuth | Galena + Coal |
| 187 | Molten Bismuth | Bismuth + Heat · Bismuth Crystal + Heat |
| 188 | Bismuth Crystal | Molten Bismuth + Cold |
| 189 | Rare Earths | Monazite + Acid |
| 190 | Didymium | Rare Earths + Acid |
| 191 | Scandium | Ytterbium + Spark |
| 192 | Yttrium | Ytterbite + Acid |
| 193 | Lanthanum | Rare Earths + Spark |
| 194 | Cerium | Rare Earths + Oxygen |
| 195 | Praseodymium | Didymium + Spark |
| 196 | Neodymium | Didymium + Spark |
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
| 211 | Francium | Actinium + Time |
| 212 | Astatine | Bismuth + Alpha Particle |
| 213 | Protactinium | Neptunium + Time · Thorium + Neutron |
| 214 | Neptunium | Americium + Time |
| 215 | Americium | Plutonium + Neutron |
| 216 | Curium | Americium + Neutron · Plutonium + Alpha Particle |
| 217 | Berkelium | Einsteinium + Time · Curium + Neutron · Americium + Alpha Particle |
| 218 | Californium | Berkelium + Time · Fermium + Time · Curium + Alpha Particle |
| 219 | Einsteinium | Mendelevium + Time · Californium + Neutron |
| 220 | Fermium | Nobelium + Time · Einsteinium + Neutron |
| 221 | Mendelevium | Lawrencium + Time · Einsteinium + Alpha Particle |
| 222 | Nobelium | Rutherfordium + Time |
| 223 | Lawrencium | Dubnium + Time |
| 224 | Rutherfordium | Seaborgium + Time |
| 225 | Dubnium | Bohrium + Time |
| 226 | Seaborgium | Hassium + Time |
| 227 | Bohrium | Meitnerium + Time |
| 228 | Hassium | Darmstadtium + Time |
| 229 | Meitnerium | Roentgenium + Time |
| 230 | Darmstadtium | Copernicium + Time |
| 231 | Roentgenium | Nihonium + Time |
| 232 | Copernicium | Flerovium + Time |
| 233 | Nihonium | Moscovium + Time |
| 234 | Flerovium | Livermorium + Time · Plutonium + Calcium Ion |
| 235 | Moscovium | Tennessine + Time · Americium + Calcium Ion |
| 236 | Livermorium | Oganesson + Time · Curium + Calcium Ion |
| 237 | Tennessine | Berkelium + Calcium Ion |
| 238 | Oganesson | Californium + Calcium Ion |
| 239 | Alpha Particle | Americium + Time · Nobelium + Time · Lawrencium + Time · Rutherfordium + Time · Dubnium + Time · Seaborgium + Time · Bohrium + Time · Hassium + Time · Meitnerium + Time · Darmstadtium + Time · Roentgenium + Time · Copernicium + Time · Nihonium + Time · Flerovium + Time · Moscovium + Time · Livermorium + Time · Tennessine + Time · Oganesson + Time |
| 240 | Calcium Ion | Calcium + Plasma |
| 241 | Fluorite | Steam + Limestone |
| 242 | Galena | Lead + Sulfur |
| 243 | Sphalerite | Sulfur + Limestone |
| 244 | Pyrite | Metal + Sulfur |
| 245 | Cassiterite | Steam + Granite |
| 246 | Stibnite | Sulfur + Quartz |
| 247 | Barite | Sulfur + Salt Water |
| 248 | Celestine | Gypsum + Salt Water |
| 249 | Gypsum | Salt Water + Limestone |
| 250 | Realgar | Sulfur + Steam |
| 251 | Chromite | Peridot + Rust |
| 252 | Peridot | Magnesium + Lava |
| 253 | Pyrolusite | Salt Water + Gravel |
| 254 | Bauxite | Clay + Water |
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
| 265 | Nitrogen Dioxide | Nitrogen + Spark · Nitric Acid + Copper |
| 266 | Nitric Acid | Nitrogen Dioxide + Water |
| 267 | Aqua Regia | Nitric Acid + Acid |
| 268 | Dissolved Gold | Gold + Aqua Regia |
| 269 | Hydrofluoric Acid | Fluorine + Water · Fluorine + Hydrogen |
| 270 | Sulfur Dioxide | Sulfur + Fire · Hydrogen Sulfide + Fire |
| 271 | Sulfuric Acid | Sulfur Dioxide + Water |
| 272 | Acid Rain | Sulfur Dioxide + Cloud |
| 273 | Hydrogen Peroxide | Water + Ozone |
| 274 | Elephant Toothpaste | Hydrogen Peroxide + Yeast |
| 275 | Bleach | Lye + Chlorine |
| 276 | Vinegar | Alcohol + Oxygen · Wine + Bacteria |
| 277 | Baking Soda | Salt Water + Carbon Dioxide |
| 278 | Washing Soda | Baking Soda + Heat |
| 279 | Sodium Acetate | Hot Ice + Heat · Baking Soda + Vinegar |
| 280 | Hot Ice | Sodium Acetate + Cold |
| 281 | Quicklime | Calcium + Fire |
| 282 | Slaked Lime | Calcium + Water · Quicklime + Water · Calcium Carbide + Water |
| 283 | Limewater | Slaked Lime + Water |
| 284 | Plaster of Paris | Gypsum + Heat |
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
| 296 | Copper Sulfate | Copper + Sulfuric Acid |
| 297 | Silver Chloride | Silver + Chlorine |
| 298 | Carbon Monoxide | Carbon Dioxide + Coal |
| 299 | Hydrogen Sulfide | Egg + Time |
| 300 | Tarnish | Silver + Hydrogen Sulfide |
| 301 | Acetone | Quicklime + Vinegar |
| 302 | Antifreeze | Alcohol + Water |
| 303 | Kerosene | Oil + Clay |
| 304 | Tar | Asphalt + Heat · Oil + Oxygen |
| 305 | Soot | Smoke + Metal |
| 306 | Calcium Carbide | Quicklime + Graphite |
| 307 | Acetylene | Calcium Carbide + Water |
| 308 | Charcoal | Toast + Fire · Steak + Fire · Nitrogen + Wood |
| 309 | Activated Charcoal | Steam + Charcoal |
| 310 | Coke | Nitrogen + Coal |
| 311 | Carbon Snake | Sulfuric Acid + Sugar |
| 312 | Mercury Vapour | Mercury + Heat |
| 313 | Sodium Vapour | Sodium + Neon |
| 314 | Smog | Nitrogen Dioxide + Smoke |
| 315 | Freon | Fluorine + Methane |
| 316 | Waterglass | Sand + Lye |
| 317 | Crystal Garden | Waterglass + Copper Sulfate |
| 318 | Golden Rain | Lead + Iodine |
| 319 | Silica Gel | Waterglass + Acid |
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
| 331 | Sapphire | Ruby + Titanium |
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
| 349 | Hematite | Rust + Pressure |
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
| 401 | Porcelain | Kaolin + Heat |
| 402 | Asphalt | Tar + Gravel |
| 403 | Glue | Steam + Bone |
| 404 | Slime | Borax + Glue |
| 405 | Styrofoam | Plastic + Propane |
| 406 | Goo | Nylon + Heat · Rubber + Heat · Acetone + Styrofoam |
| 407 | Teflon | Plastic + Fluorine |
| 408 | Silicone | Silicon + Oil |
| 409 | Nylon | Plastic + Ammonia |
| 410 | Wax | Oil + Cold · Molten Wax + Cold |
| 411 | Molten Wax | Wax + Heat |
| 412 | Candle | Wax + Cotton |
| 413 | Ink | Squid + Water · Soot + Glue |
| 414 | Pulp | Wood + Lye |
| 415 | Paper | Pulp + Pressure |
| 416 | Cardboard | Paper + Glue |
| 417 | Photo Paper | Paper + Silver Chloride |
| 418 | Photograph | Photo Paper + Photon · Photo Paper + X-Ray |
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
| 434 | Microplastic | Plastic + Pressure |
| 435 | Light Bulb | Glass + Tungsten |
| 436 | LED | Silicon + Gallium |
| 437 | Electromagnet | Metal + Copper |
| 438 | Nichrome | Nickel + Chromium |
| 439 | Potato Battery | Potato + Zinc |
| 440 | RTG | Plutonium + Germanium |
| 441 | Glowstick | Plastic + Cold Light |
| 442 | Sparkler | Fuse + Metal |
| 443 | Road Flare | Strontium + Fuse |
| 444 | Cactus | Plant + Sand |
| 445 | Kelp | Algae + Stone |
| 446 | Coral | Algae + Limestone |
| 447 | Lichen | Fungus + Algae |
| 448 | Seashell | Snail + Time |
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
| 462 | Potato | Fruit + Dirt |
| 463 | Fries | Oil + Potato |
| 464 | Lemon | Fruit + Acid |
| 465 | Sugar | Sugarcane + Pressure |
| 466 | Caramel | Sugar + Heat · Candy + Heat · Cotton Candy + Heat · Marshmallow + Fire |
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
| 477 | Curds | Milk + Vinegar |
| 478 | Cheese | Curds + Pressure |
| 479 | Butter | Milk + Pressure |
| 480 | Yogurt | Milk + Bacteria |
| 481 | Ice Cream | Milk + Snow |
| 482 | Egg | Bird + Seed · Bird + Fruit · Bird + Ant · Bird + Worm · Bird + Locust · Seed + Limestone |
| 483 | Fried Egg | Egg + Heat |
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
| 513 | Tardigrade | Lichen + Water |
| 514 | Phoenix | Bird + Fire |
| 515 | Fog | Dry Ice + Water |
| 516 | Hail | Ice + Cloud |
| 517 | Permafrost | Dirt + Ice |
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
| 533 | Gamma Ray | Electron + Positron |
| 534 | X-Ray | Tungsten + Electron |
| 535 | Ultraviolet | Mercury Vapour + Electron |
| 536 | Microwave | Magnet + Spark |
| 537 | Muon | Pion + Time |
| 538 | Pion | Proton + Proton |
| 539 | Higgs Boson | Muon + Muon |
| 540 | Tachyon | Dark Matter + Neutrino |

</details>
