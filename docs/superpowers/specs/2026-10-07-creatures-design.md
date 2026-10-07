# Shaped creatures and humans: design

Date: 2026-10-07. Status: approved in chat, awaiting review of this write-up.

## Goal

1. The bigger creatures get multi-pixel bodies with simple animation,
   instead of being one cell each.
2. A new creature, the **Human**, that gathers fuel into a pile and lights
   a campfire, runs from danger, and builds a small hut.

Today all 18 creatures are single cells of a `critter` element, moved by
`updateCritter` (`src/sim/behaviors.js`). The world is 400 × 240.

Tiny creatures stay single cells and keep `updateCritter` unchanged:
Plankton, Ant, Termite, Bee, Locust, Firefly, Worm, Tardigrade, Butterfly.

All creatures' lifespans are tripled (the `life` ranges of every
`critter` definition, the tiny ones included).

## 1. Body system

### Entities

New file `src/sim/creatures.js`, a World mixin like `sleep.js`. The world
keeps `world.creatures`, a slot array of entities with ids 1 to 65535 and a
free list. An entity has:

- `kind`: its element id;
- `x`, `y`: the anchor cell (the middle of its feet; for swimmers and
  fliers, the middle of its bottom row);
- `facing` (−1 or 1), `frame` (animation frame), `turn` (quarter turns,
  0–3, from the gravity arrow);
- `vx`, `vy`: velocity from blasts and falling;
- `damaged`: a bit per shape pixel, set when that pixel is lost;
- `age`, `lifespan`: old age, in steps;
- `growing`: while it is being born (see Birth);
- `brain`: a human's memory, `null` for animals.

`clearAll` empties the list.

### Shapes

A shaped creature's definition gets `shape`: one or more frames, each a
few short strings, plus a palette of up to 32 colours. Example (bird):

```js
shape: {
  frames: [['a.a', '.b.'], ['...', 'aba']], // wings up, wings down
  palette: { a: '#5a4a3a', b: '#8a6a4a' },
}
```

`.` is no pixel. Pixels are numbered in reading order; the `damaged` bits
use that numbering, and every frame of a creature has the same number of
pixels (so damage carries across frames). The shape is drawn mirrored when
`facing` is −1, and turned by quarter turns so its feet point the way the
gravity arrow points (the nearest of the four directions; under Newtonian
gravity, the direction at the anchor's air block).

### Body cells

A body pixel is a real cell of the creature's element:

- `ctype` holds the entity id (0 = a lone seed cell, see Birth);
- `shade` holds the pixel's palette index;
- `temp` is that pixel's own temperature.

Body cells are solid and not displaceable, so sand piles up on top and
water flows round them, and fire, heat, acid and tools reach them like any
other cell.

### The creature step

`stepCreatures()` runs once a step after the particle pass, for every
entity, whether or not its chunk is asleep. Chunks under a creature are
kept awake. For each entity:

1. **Check the body.** For each undamaged pixel, look at the cell where it
   should be:
   - still the creature's element with this entity's `ctype`: fine;
   - turned into another *creature* (a reaction such as Bird + Fire →
     Phoenix): the whole entity becomes that kind, keeping its place;
   - anything else (burnt, dissolved, erased, eaten by Grey Goo, blown
     away): the pixel is damaged.
2. **Heat and cold.** A pixel whose own temperature is above 60 °C or
   below −15 °C is damaged and its cell cleared (the Phoenix, which is
   `tough`, is exempt as today).
3. **Breath.** A human with its head in a liquid for over 10 s, or a
   swimmer with no pixel touching water, loses one pixel every 30 steps.
4. **Death** when at least half its pixels are damaged, or when `age`
   reaches `lifespan`. There is no other death.
5. **Healing.** A creature that took no damage for 300 steps gets one
   damaged pixel back (only into an empty cell).
6. **Think and move** (sections 2 and 3).

A damaged pixel isn't drawn back when the body moves: the creature walks
about with a visible gap until it heals.

### Moving the body

A move (a step, a turn, a new frame, a fall) works out the new footprint,
then:

- every new cell must be empty, or hold a liquid, gas, fire or other
  displaceable particle; a solid (or another body) blocks the move;
- the old cells are cleared, then the new cells written. Displaced
  particles are moved into the freed cells (or the nearest empty cell; a
  gas with nowhere to go is dropped);
- the body keeps its temperature: each new cell gets the average of the old
  cells.

Walkers and humans fall while nothing is under their feet, with `vy`
growing like a powder's. Swimmers sink slowly out of water.

### Birth

A lone cell of a shaped creature (`ctype` 0) comes from the brush, a
recipe, an egg hatching, breeding, a Clone or a Dispenser. On its update:

1. It picks a placement of the shape that covers the seed cell and whose
   cells are all free (empty or displaceable), trying placements nearest
   the shape's middle first.
2. It becomes an entity with `growing` set, and fills in its pixels ring
   by ring, nearest the seed first, one ring every 2 steps (a human takes
   about 8 steps).
3. A ring blocked by a solid waits. Blocked for 120 steps: the creature
   tries another placement; when none fits, the seed is removed.

### What else touches bodies

Shaped body cells are skipped by everything that moves cells on its own,
and the entity handles it whole:

- **Conveyors** (`machines-motion.js`): a belt under the creature's feet
  moves the whole body.
- **Portals** (`portals.js`): the whole body jumps when its anchor crosses
  a portal line, if there is room on the other side.
- **Blasts and pressure** (`blast`, `tear`): no tearing loose; a blast
  gives the entity velocity away from its centre and damages pixels by
  its strength.
- **Time zones**: the entity's think and move rate follows the zone at its
  anchor.
- **Brush** (`paintArea`): painting a shaped creature places one seed per
  shape-sized spacing, not one per cell.
- **Eraser** (`eraseArea`): erased pixels are damaged pixels.
- **Clone and Dispenser** copy a seed cell, which grows as above.

### Death

The body's cells become the definition's `lifeEnd` drops, pixel by pixel
(Human: a mix of Bone and Meat; Fish: Bone or Meat as now). A creature that
died with most of its damage from heat leaves Ash instead.

## 2. Animals

| Creature | Size | Motion | Frames |
|---|---|---|---|
| Fish | 4×2 | swims in water | tail flick (2) |
| Electric Eel | 6×1 | swims in water | wiggle (2) |
| Squid | 3×4 | swims in upward bursts | tentacles (2) |
| Jellyfish | 3×3 | drifts in water | pulse (2) |
| Bird | 3×2 | flies | wings up/down (2) |
| Frog | 3×2 | walks and hops | (2) |
| Snail | 3×2 | walks slowly | (1) |
| Spider | 3×2 | walks, leaves Silk | legs (2) |
| Phoenix | 5×3 | flies, glows, sets fire | wings (2) |

Behaviour is as now, applied to the whole body:

- Swimmers only move where every new cell is water or salt water; fliers
  only into empty cells and gases; walkers walk along the ground, climb
  steps of 1 cell and fall.
- **Eating**: food touching any body pixel can be eaten, with the same
  rules and chances as now (`eats`).
- **Breeding**: as now; the egg or seed is placed next to the body, and a
  seed grows when there is room.
- Electric Eel jolts, Phoenix fire, Spider and Squid trails come from a
  random body pixel.
- Glow, blink and pulse effects work per cell as now.

## 3. Humans

### Body and recipe

- New element `HUMAN`, category `creature`, discovered by **Clay +
  Lightning**.
- Shape 3×6, 10 pixels: head, two arms and a shirt, torso, hips, two legs.
  Two walking frames (legs apart, legs together), one kneeling frame (for
  lighting the fire), one sitting frame. Every frame has the same 10
  pixels.
- Each human picks a skin tone (one of 4) and a shirt colour (one of 6)
  when born.
- Dies at 5 damaged pixels, or of old age after about 20 minutes (72,000
  steps). Death leaves Bone and Meat; burned to death, Ash.
- A carried cell is drawn as one pixel above its hands (not a body pixel).

### Moving

- Walks one cell every 4 steps; runs one every 2 when fleeing.
- Climbs steps of up to 2 cells, drops from any height.
- No pathfinding: walks straight towards its target, climbing and
  dropping. If it makes no progress for 300 steps it gives up that target
  and won't pick that cell again for a while.
- In a liquid it swims: up, and towards the nearest shore within 40 cells.

### The brain

A human decides every 8 steps, taking the first that applies:

1. **Flee.** Danger within 16 cells: any cell above 80 °C (except its own
   camp's fire and the cells round the pile), Lava, Acid, Napalm, Greek
   Fire, Grey Goo, Virus, Antimatter, a Black Hole, or air pressure above
   a blast threshold. It runs directly away from the nearest danger,
   jumping gaps of 1–2 cells, until none is within 24 cells.
2. **Shelter.** Its camp has a finished hut, and the air round it is below
   10 °C or water, snow or hail is falling within 20 cells: go inside the
   hut and wait.
3. **Campfire.**
   - **Camp.** With no camp, it joins one within 60 cells; otherwise it
     makes one on flat, dry ground near where it stands.
   - **Fuel**: Wood, Coal, Peat and Sawdust, in a cell next to an empty
     one and within 3 cells of ground a human can stand on, up to 60 cells
     from the camp. It walks there, takes one cell (the cell is emptied
     and carried), walks back and drops it on the camp's pile, next to the
     camp spot.
   - **Lighting.** When the pile has 6 cells and isn't burning, it kneels
     beside it and rubs sticks for 180 steps, then sets the pile alight.
   - **Tending.** While the fire burns, if fewer than 4 fuel cells are
     left, it fetches more.
   - **Resting.** Otherwise it sits 2 cells from the fire.
4. **Hut** (once the camp's fire has been lit; one hut per camp).
   - **Site**: ground within 1 cell of flat across 9 columns, at least 4
     cells from the fire.
   - **Blueprint** (about 19 cells): a left wall 8 tall, a right wall with
     a door gap 6 tall at the bottom (2 cells above it), and a flat roof 9
     wide on top.
   - **Material**: Stone, Brick, Granite or Concrete next to an empty cell
     within 80 cells of the camp; Wood only if there is none (and then it
     can catch fire).
   - It carries one cell at a time and places it in the lowest unfinished
     blueprint cell within its reach (3 cells). A blueprint cell already
     filled with any solid counts as done; one holding something that will
     move away (a liquid, a creature) waits.
5. **Idle**: wander near the camp.

### Several humans

A camp is a shared object in `world.camps`: its spot, the pile's cells,
whether the fire has been lit, the hut site and blueprint progress, and
its members. Members split the work: a free human takes the next job
(fetch fuel, light, fetch building material) that nobody else is doing.
A camp with no members left is forgotten.

### Hover note

The cell note for a body cell shows the creature's name and health
(pixels left of total); for a human also its current job: gathering
wood, carrying wood, lighting the fire, resting by the fire, fetching
stone, building the hut, sheltering, fleeing, swimming.

## 4. Rendering and integration

- **Renderer**: a cell of a shaped creature is coloured from that
  creature's shape palette by `shade` (up to 32 colours), instead of the
  8-shade element palette. Glow, blink and pulse are unchanged. Damaged
  pixels are empty cells, so nothing special is drawn.
- **Sleeping areas** (`sleep.js`): chunks under a creature are woken each
  step; creatures are stepped even when their chunk is asleep.
- **Performance levels**: creatures are not reduced at any level.
- **Web Worker** (planned): entity state is plain data on `world`, so it
  moves to the worker with the rest of the simulation.
- **Content**: the campfire uses rubbing sticks in-game only; nothing in
  code, hints or docs describes real-world fire-starting or weapons.

## 5. Testing

New `test/creatures.test.js` and `test/humans.test.js` (node, using the
real `World`):

- A seed cell grows outward ring by ring; blocked growth waits, then tries
  elsewhere, then gives up.
- A body falls as one; sand piles on top; water flows round it.
- Erasing one pixel damages it; erasing half the body kills it; death
  leaves Bone and Meat; burning to death leaves Ash.
- Heat above 60 °C damages only the hot pixels; a damaged creature heals a
  pixel after 300 quiet steps.
- Bird + Fire turns the whole bird into a Phoenix.
- A fish swims and stays in water; a bird changes frames as it flies.
- A conveyor carries a body whole; a time zone slows a creature.
- Painting a shaped creature places spaced seeds.
- Clay + Lightning makes a Human.
- A human in a scripted world with Wood nearby gathers it, piles it and
  lights a fire within a time limit.
- A human runs away from Lava; a human in water swims to shore; one held
  under water loses pixels.
- A human builds a hut from Stone; a second human joins the same camp.
- Every creature's lifespan is three times what it was.
- Existing creature, recipe and sleep tests keep passing.

## 6. Docs

README: the creatures section (shapes, birth, damage, humans).
HANDOFF: the entity contract: anything new that moves or rewrites cells
on its own must skip shaped body cells (or move the whole entity), and
anything that changes a body cell is seen as damage on the next step.
