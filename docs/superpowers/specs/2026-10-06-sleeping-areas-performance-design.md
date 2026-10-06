# Sleeping areas and a performance setting: design

Date: 2026-10-06. Status: approved in chat, awaiting review of this write-up.

## Goal

Make the game cheaper to run without changing how anything looks or
behaves at the default setting:

1. **Sleeping areas**: parts of the world where nothing is happening aren't
   simulated until something reaches them.
2. **A performance setting** (Auto, High, Medium, Low) that trades a little
   accuracy for speed when the game can't keep up.

Measured before (demo scene, 400 × 240, convection on): 3.3 to 5 ms a step,
about 65 % of it updating particles, 25 % air, 10 % heat, although once
the scene has settled nothing changes from one step to the next (0 cells, the
air perfectly still). A busy scene: about 12 ms a step, 75 % particles.

The Gas and Glow buttons stay as they are, the player's own choice, at
every setting.

## 1. Sleeping areas

### Chunks

The world is divided into chunks of CHUNK × CHUNK cells (CHUNK = 16; 25 ×
15 chunks for the 400 × 240 world, the last row and column partly outside
it when the size isn't a multiple). Each chunk is awake or asleep. All
chunks start awake.

### What sleeping skips

- `update` isn't called for particles in a sleeping chunk.
- `conductHeat` skips cells of a sleeping chunk, except those in its
  rightmost column and bottom row (each cell trades heat with its right and
  lower neighbours, so those cells carry heat across into an awake chunk
  beside or below; heat from an awake chunk to the left or above arrives
  from that chunk's own cells).
- Everything else runs as now: the step's scan still visits every cell to
  build the air's blocked map (walls and airtight shells), and flying
  particles, doors, pipes, portals' air links, gravity and the air still
  run for the whole world.

### Waking

- At the end of every step, each chunk is compared with a snapshot taken at
  the end of the step before: the element and the temperature in every
  cell. Any difference wakes the chunk and its 8 neighbours (a grain taken
  away at the edge of one chunk can unsettle the sand in the next), and the
  snapshot is updated. So anything that changes a sleeping area wakes it on
  the next step (a tool, a blast, heat from next door, a particle flying in,
  a reaction in a neighbour) without the code that made the change having
  to report it.
- A sleeping chunk also wakes while the air over it isn't still: any of its
  air blocks with pressure or wind beyond AIR_STILL (0.01), or air more than
  HEAT_STILL (0.1 °C) from room temperature.
- `setGravity`, `setConvection`, `setEdges`, `addPortal`/`removePortalAt`
  and `paintSpeed` wake every chunk.
- While Newtonian gravity is on, nothing sleeps (the pull everywhere can
  change).

### Falling asleep

An awake chunk falls asleep after SLEEP_AFTER (8) steps in a row in which
nothing in it changed (by the same comparison), and only if nothing in it
can change on its own. A chunk stays awake while any cell in it holds:

- a gas, or energy that isn't fixed in place (it drifts);
- an element with a behaviour (fire, plants, creatures, machines, clones,
  sparks and the rest), or one that is `active` (radioactive, glowing-hot,
  pyroelectric, producing fruit) or holds its own temperature;
- a particle with a countdown running (`life` > 0), torn loose (`loose`),
  or moving (|vx| or |vy| ≥ 0.01);
- a temperature more than HEAT_STILL (0.1 °C) from room temperature (within
  that, it is set to exactly room temperature, so a cooled chunk can sleep);
- a temperature at or past its own high or low phase change, or ignition
  point;
- a particle on a portal cell, or a cell in a time zone;
- a particle with a contact reaction (`REACT`) with any of its four
  neighbours.

The check runs only for chunks that are about to fall asleep.

### Still air

When the whole air grid is still (every pressure and both velocities within
AIR_STILL (0.01) of 0, and, with convection on, every air temperature within
HEAT_STILL (0.1 °C) of room temperature), the air step is skipped. Each step
starts with a cheap scan of the grid, and the air steps again as soon as
anything has stirred it past those. When it settles within them, the grid
is set to exactly still (and the pressure the air's heat was holding goes
with it).

### Seeing it

A **Show sleeping areas** checkbox in the ⋯ menu (off by default, not
saved) draws a faint outline round each sleeping chunk.

## 2. Performance setting

A **Performance** choice in the ⋯ menu: Auto, High, Medium, Low. Saved in
localStorage (`sandbox-crafter:performance`), guarded like the other saved
settings. Default Auto.

| Level | What it does |
| ----- | ------------ |
| High | As now. |
| Medium | Heat is conducted every other step, at the rate two steps would conduct (as time zones do it, so it never overshoots): the same speed for half the cost. The air steps every other step, so winds and blasts spread at half speed. |
| Low | As Medium, plus: at most one simulation step per drawn frame, so a game that can't keep up runs in slow motion instead of stuttering; and at most 4,000 flying particles at once (instead of 12,000; new ones aren't launched past that). |

**Auto** (the default) picks the level itself and starts at High:

- It keeps a running average of the time a drawn frame spends on
  simulation steps plus drawing.
- If that is over the frame's budget (1000 / 60 ms) for AUTO_DOWN (60)
  frames in a row, it drops a level (High → Medium → Low).
- If it is under half the budget for AUTO_UP (180) frames in a row, it goes
  back up a level.
- The menu shows the level it's at: "Auto (Medium)".

## Code layout

- `src/sim/sleep.js` (new): a `Sleep` mix-in: the chunk arrays, the
  snapshot, waking, falling asleep, the restless check, `wakeAll`.
- `src/sim/world.js`: the step skips sleeping chunks' updates, calls the
  sleep bookkeeping at the end of the step, `conductHeat` skips sleeping
  cells, the setters call `wakeAll`, and the quality level
  (`world.quality`: 'high' | 'medium' | 'low') sets the heat and air rates.
- `src/sim/air.js`: the still-air check and skip.
- `src/sim/particles.js`: the flying-particle cap follows the level.
- `src/game/performance.js` (new): the levels, the Auto controller (a pure
  object fed frame times, so it can be tested), load and save.
- `src/main.js`, `index.html`, `style.css`, `src/game/ui.js`: the menu
  entries, Auto's readout, one step per frame at Low.
- `src/render/renderer.js`: the sleeping-area outlines.

## Testing

New `test/sleep.test.js` and `test/performance.test.js`:

- A settled pile of sand and a still pool fall asleep; the starting scene
  settles to (almost) all asleep with the air skipped.
- A sleeping chunk wakes when: a tool paints or heats in it; sand is taken
  from under it in the chunk below (the pile above then falls); heat
  conducts into it from an awake neighbour; air pressure reaches it; a
  particle flies in.
- Slow things still happen: water touching dirt still makes mud; a hot
  block next to a sleeping cold one still warms it; radioactive elements
  keep decaying; plants keep growing.
- Nothing sleeps with Newtonian gravity on.
- Each existing test still passes (the world's behaviour doesn't change).
- The settled starting scene steps at least 3× faster than before.
- Performance: Auto drops a level after 60 slow frames and climbs after 180
  quick ones; Medium conducts heat at the same speed as High (within a few
  per cent) and steps the air every other step; Low caps flying particles
  at 4,000; the setting is saved and bad storage gives Auto.

## Docs

README: sleeping areas, the Performance menu, Show sleeping areas. HANDOFF:
the chunk bookkeeping and the rules for staying awake (any new restless
thing must be added to the check), the still-air skip, the quality levels.
Rebuild dist.

## Out of scope

Running the simulation on a second thread (the next step: shared memory
between threads needs the server to send COOP/COEP headers, which the local
server can; GitHub Pages can't); sleeping flying particles; finer chunks.
