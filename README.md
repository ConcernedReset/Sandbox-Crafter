# Sandbox Crafter

A falling-sand physics sandbox crossed with an element-crafting game. You start
with four elements (**Sand, Water, Fire and Dirt**) and discover the other 36
by making things happen in the simulation: pour water on dirt, bake mud, crush
wood under pressure, run electricity through water, blast a diamond with
plasma. Every new element you make is added to your palette.

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

There are six ways to combine things:

| Method   | Example                                          |
| -------- | ------------------------------------------------ |
| Contact  | Dirt touching Water becomes Mud                  |
| Heat     | Sand above 1700 °C melts into Molten Glass       |
| Cold     | Water below 0 °C freezes into Ice                |
| Pressure | Wood crushed in a sealed Wall box becomes Coal   |
| Fire     | Burning Wood leaves Ash and Smoke                |
| Time     | A Plant that grows thick enough turns woody      |

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
5. **Electricity** travels along conductors as short-lived Spark particles
   followed by a cooldown, so pulses flow along a wire in one direction.

## Project layout

```
index.html, style.css     the page
src/main.js               wires everything together; game loop
src/sim/elements.js       every element, reaction and recipe (the data)
src/sim/world.js          the particle simulation
src/sim/air.js            the pressure / wind grid
src/render/renderer.js    draws the world, glow, heat and pressure views
src/game/                 input, UI, saved progress, starting scene
test/                     node:test suites
```

## Adding an element

1. Add an entry to `ELEMENT_LIST` in `src/sim/elements.js` with its colours,
   state, density and any `high` / `low` / `pressure` transitions.
2. Give it a way to be made: a transition on another element, or a line in
   `REACTIONS`.
3. Write a `hint` so the recipe book can nudge players towards it.
4. Run `npm test`. The recipe suite builds a small lab for **every** recipe
   and checks it actually works in the simulation, and checks that every
   element can be reached from the starting four.

## Tests

```sh
npm test
```

The physics tests cover sand piling, water levelling, oil floating on water,
heat conduction, pressure containment, explosions, electricity and burning.
The recipe tests run all 65 production rules in the real simulation.

<details>
<summary>Spoilers: the full recipe list</summary>

| No. | Element      | Made from                                                   |
| --- | ------------ | ----------------------------------------------------------- |
| 5   | Steam        | Water + Heat · Salt Water + Heat · Hydrogen + Fire · Fire + Water · Lava + Water |
| 6   | Ice          | Water + Cold · Salt Water + Cold                            |
| 7   | Mud          | Dirt + Water                                                |
| 8   | Lava         | Dirt + Heat · Stone + Heat · Obsidian + Heat · Brick + Heat |
| 9   | Stone        | Lava + Cold (let it cool)                                   |
| 10  | Obsidian     | Lava + Water · Lava + Ice                                   |
| 11  | Molten Glass | Sand + Heat · Glass + Heat                                  |
| 12  | Glass        | Molten Glass + Cold · Sand + Lightning                      |
| 13  | Snow         | Steam + Ice · Cloud + Cold                                  |
| 14  | Brick        | Mud + Heat                                                  |
| 15  | Plant        | Mud + Water                                                 |
| 16  | Wood         | Plant + Time                                                |
| 17  | Smoke        | Plant, Wood, Coal, Oil or Gunpowder + Fire · Lava + Coal    |
| 18  | Ash          | Plant + Fire · Wood + Fire                                  |
| 19  | Salt Water   | Ash + Water · Salt + Water · Salt + Ice                     |
| 20  | Salt         | Salt Water + Heat                                           |
| 21  | Coal         | Wood + Pressure                                             |
| 22  | Diamond      | Coal + Pressure                                             |
| 23  | Metal        | Lava + Coal · Molten Metal + Cold                           |
| 24  | Molten Metal | Metal + Heat · Rust + Heat · Thermite + Fire                |
| 25  | Rust         | Metal + Water                                               |
| 26  | Oil          | Plant + Pressure                                            |
| 27  | Methane      | Plant + Mud                                                 |
| 28  | Gunpowder    | Coal + Salt                                                 |
| 29  | Battery      | Metal + Salt Water                                          |
| 30  | Spark        | Battery + Metal                                             |
| 31  | Hydrogen     | Water + Spark                                               |
| 32  | Acid         | Salt + Hydrogen                                             |
| 33  | Cloud        | Steam + Smoke                                               |
| 34  | Lightning    | Cloud + Spark                                               |
| 35  | Plasma       | Steam + Heat (past 3000 °C)                                 |
| 36  | Thermite     | Rust + Gunpowder                                            |
| 37  | Nitro        | Oil + Acid                                                  |
| 38  | Cryo         | Salt + Snow                                                 |
| 39  | Clone        | Diamond + Plasma                                            |
| 40  | Void         | Diamond + Pressure (a lot of it)                            |

</details>
