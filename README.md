# Sandbox Crafter

A falling-sand physics sandbox crossed with an element-crafting game. You start
with four elements (**Sand, Water, Fire and Dirt**) and discover the other 136
by making things happen in the simulation: pour water on dirt, bake mud, crush
wood under pressure, run electricity through water, split uranium with
neutrons, blast a diamond with plasma. Every new element you make is added to
your palette.

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
7. **Radioactivity**: radioactive elements warm themselves, throw off
   particles, and decay at random (the inspector shows each half-life).
   Radium decays to radon, then polonium, then lead, shedding helium.

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

## Project layout

```
index.html, style.css          the page
src/main.js                    wires everything together; game loop
src/sim/elements.js            the first 40 elements, and the compiler that turns
                               all the tables into lookups for the simulation
src/sim/elements-expansion.js  the other 100 elements, their reactions, and what
                               flying particles do when they hit things
src/sim/world.js               the grid simulation: movement, heat, reactions
src/sim/behaviors.js           special behaviours (fire, plants, black holes...)
src/sim/particles.js           the flying-particle layer
src/sim/air.js                 the pressure / wind grid
src/render/renderer.js         draws the world, glow, particles, heat and pressure views
src/game/                      input, UI, saved progress, starting scene
test/                          node:test suites
```

## Adding an element

1. Add an entry to `EXPANSION_ELEMENTS` in `src/sim/elements-expansion.js`
   with its colours, state, density and any `high` / `low` / `pressure`
   transitions. The fields are documented at the top of `elements.js`.
2. Give it a way to be made: a transition on another element, a line in
   `EXPANSION_REACTIONS`, or a particle hit in `PARTICLE_HITS`.
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
recipe tests run all 250 production rules in the real simulation.

<details>
<summary>Spoilers: every recipe</summary>

| No. | Element | Made from |
| --- | ------- | --------- |
| 5 | Steam | Water + Heat · Salt Water + Heat · Hydrogen + Fire · Fire + Water · Lava + Water |
| 6 | Ice | Water + Cold · Salt Water + Cold |
| 7 | Mud | Dirt + Water |
| 8 | Lava | Dirt + Heat · Stone + Heat · Obsidian + Heat · Brick + Heat · Granite + Heat |
| 9 | Stone | Lava + Cold |
| 10 | Obsidian | Lava + Water · Lava + Ice |
| 11 | Molten Glass | Sand + Heat · Glass + Heat · Quartz + Heat |
| 12 | Glass | Molten Glass + Cold · Sand + Lightning |
| 13 | Snow | Steam + Ice · Cloud + Cold |
| 14 | Brick | Mud + Heat · Clay + Heat |
| 15 | Plant | Mud + Water |
| 16 | Wood | Plant + Time |
| 17 | Smoke | Plant + Fire · Wood + Fire · Coal + Fire · Oil + Fire · Gunpowder + Fire · Sulfur + Fire · Gasoline + Fire · Plastic + Fire · Napalm + Fire · Graphite + Fire · ANFO + Fire · Dynamite + Fire · Grass + Fire · Moss + Fire · Fungus + Fire · Flower + Fire · Fruit + Fire · Lava + Coal |
| 18 | Ash | Plant + Fire · Wood + Fire · Grass + Fire · Moss + Fire · Algae + Fire · Flower + Fire · Seed + Fire · Fallout + Time · Virus + Heat · Chlorine + Plant |
| 19 | Salt Water | Ash + Water · Salt + Water · Salt + Ice · Lye + Acid |
| 20 | Salt | Salt Water + Heat · Sodium + Chlorine |
| 21 | Coal | Wood + Pressure |
| 22 | Diamond | Coal + Pressure |
| 23 | Metal | Molten Metal + Cold · Cobalt-60 + Time · Lava + Coal |
| 24 | Molten Metal | Metal + Heat · Rust + Heat · Thermite + Fire · Copper + Heat · Aluminum + Heat · Titanium + Heat · Steel + Heat · Tungsten + Heat · Lead + Heat · Silver + Heat · Cobalt-60 + Heat · Gold + Heat · Beryllium + Heat |
| 25 | Rust | Metal + Water |
| 26 | Oil | Plant + Pressure |
| 27 | Methane | Plant + Mud |
| 28 | Gunpowder | Coal + Salt |
| 29 | Battery | Metal + Salt Water |
| 30 | Spark | Battery + Metal |
| 31 | Hydrogen | Water + Spark · Sodium + Water · Potassium + Water · Lithium + Water · Cesium + Water · Cesium + Ice · Water + Electron · Electron + Proton |
| 32 | Acid | Salt + Hydrogen · Chlorine + Hydrogen |
| 33 | Cloud | Steam + Smoke |
| 34 | Lightning | Cloud + Spark |
| 35 | Plasma | Steam + Heat · Plutonium + Neutron |
| 36 | Thermite | Rust + Gunpowder · Aluminum + Rust |
| 37 | Nitro | Oil + Acid |
| 38 | Cryo | Nitrogen + Cold · Salt + Snow |
| 39 | Clone | Diamond + Plasma |
| 40 | Void | Diamond + Pressure |
| 41 | Oxygen | Ozone + Time · Liquid Oxygen + Heat · Water + Spark |
| 42 | Nitrogen | Cryo + Time |
| 43 | Ozone | Oxygen + Spark · Oxygen + Photon |
| 44 | Carbon Dioxide | Dry Ice + Heat · Smoke + Oxygen · Acid + Limestone |
| 45 | Dry Ice | Carbon Dioxide + Cold |
| 46 | Liquid Oxygen | Oxygen + Cold |
| 47 | Clay | Mud + Sand |
| 48 | Gravel | Stone + Pressure |
| 49 | Quartz | Sand + Pressure |
| 50 | Granite | Lava + Pressure |
| 51 | Sulfur | Lava + Steam |
| 52 | Copper | Lava + Sulfur |
| 53 | Verdigris | Copper + Water |
| 54 | Limestone | Salt Water + Stone |
| 55 | Cement | Limestone + Heat |
| 56 | Wet Concrete | Cement + Water |
| 57 | Concrete | Wet Concrete + Time |
| 58 | Propane | Oil + Heat |
| 59 | Gasoline | Oil + Hydrogen |
| 60 | Plastic | Propane + Pressure |
| 61 | Sodium | Salt + Spark |
| 62 | Chlorine | Salt + Spark |
| 63 | Lye | Sodium + Water · Potassium + Water · Cesium + Water · Cesium + Ice |
| 64 | Soap | Lye + Oil |
| 65 | Bubbles | Soap + Water |
| 66 | Napalm | Gasoline + Soap |
| 67 | Potassium | Ash + Spark |
| 68 | Magnesium | Salt Water + Spark |
| 69 | Aluminum | Clay + Spark |
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
| 89 | Mercury | Cinnabar + Heat |
| 90 | Lithium | Granite + Acid |
| 91 | Grass | Dirt + Plant |
| 92 | Moss | Stone + Plant |
| 93 | Fungus | Wood + Mud |
| 94 | Algae | Plant + Salt Water |
| 95 | Photon | Plasma + Glass · Star + Hydrogen · Neon + Electron · Heavy Water + Neutrino · Electron + Positron |
| 96 | Flower | Plant + Photon |
| 97 | Fruit | Flower + Time |
| 98 | Seed | Fruit + Time |
| 99 | Alcohol | Fruit + Time |
| 100 | Electron | Metal + Photon · Cesium + Photon · Hydrogen + Photon · Lead + Photon · Heavy Water + Neutrino · Neutron + Time |
| 101 | Proton | Hydrogen + Photon · Neutron + Time |
| 102 | Neutron | Polonium + Beryllium · Tritium + Deuterium · Metal + Proton · Lead + Proton · Tungsten + Proton |
| 103 | Neutrino | Neutron + Time |
| 104 | Pitchblende | Granite + Pressure |
| 105 | Yellowcake | Pitchblende + Heat |
| 106 | Uranium | Yellowcake + Hydrogen · Thorium + Neutron |
| 107 | Plutonium | Uranium + Neutron |
| 108 | Thorium | Pitchblende + Acid |
| 109 | Nuclear Waste | Corium + Cold · Uranium + Neutron |
| 110 | Cesium | Uranium + Neutron |
| 111 | Fallout | Plutonium + Neutron |
| 112 | Corium | Uranium + Heat · Plutonium + Heat |
| 113 | Radium | Pitchblende + Spark |
| 114 | Radon | Radium + Time |
| 115 | Helium | Radium + Time · Radon + Time · Polonium + Time · Superfluid + Time · Tritium + Time · Tritium + Deuterium · Star + Hydrogen · Lithium + Proton · Lithium + Neutron |
| 116 | Polonium | Radon + Time |
| 117 | Lead | Nuclear Waste + Time · Polonium + Time |
| 118 | Silver | Lead + Acid |
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
| 129 | Gold | Mercury + Neutron |
| 130 | Philosopher's Stone | Gold + Mercury |
| 131 | Emerald | Quartz + Verdigris |
| 132 | Beryllium | Emerald + Acid |
| 133 | Amethyst | Quartz + Neutron |
| 134 | Virus | Fungus + Neutron |
| 135 | Star | Hydrogen + Pressure |
| 136 | Neutronium | Lead + Pressure |
| 137 | Black Hole | Neutronium + Void |
| 138 | White Hole | Black Hole + Antimatter |
| 139 | Strange Matter | Neutronium + Proton |
| 140 | Dark Matter | Void + Neutrino |

</details>
