# Portals, time brush, looping edges and wall checklist: design

Date: 2026-10-05. Status: approved in chat, awaiting review of this write-up.

## Goal

Four abstract tools that bend the rules of the sandbox:

1. **Portals**: draw two lines; anything crossing one comes out of the other.
2. **Time brush**: paint areas that run at ¼×, ½×, 2× or 4× speed.
3. **Looping edges**: opposite edges of the world join up.
4. **Wall checklist**: each wall can let chosen kinds of thing through.

When none of them is in use, the simulation behaves and performs exactly as
it does now.

## Shared UI

- The tools grid becomes 3 × 4: Erase, Wall, Spark / Heat, Cool, Wind /
  Mix, Pressure, Vacuum / Portal, Time, and one empty slot.
- Under the tools, an options strip appears for the tools that have options:
  the Wall checklist and the Time speed buttons. It's hidden for the others.
  The choices are kept in localStorage (`sandbox-crafter:tool-options`),
  guarded like the other saved settings.
- Portal and Time work in hard mode: neither makes heat or pressure.
- The inspect line under the game (pointing at a cell) also says when the
  cell is in a time zone ("4× speed"), on a portal ("Portal 2, blue end"),
  or is a wall that lets things through ("Wall: lets liquids, gases through").

## 1. Portals

### Drawing and removing

- With the Portal tool, a drag draws a straight line one cell thick from
  where the press started to where it was released, whatever the brush
  size. The line is 4-connected (no diagonal gaps), so nothing slips between
  its cells.
- The first line drawn is the blue end of a new pair, the next the orange
  end. A pair's first end, until its partner is drawn, is drawn dashed and
  does nothing. Each new pair gets its own two colours (blue and orange,
  then green and magenta, then the next pair of hues round the wheel).
- At most 32 pairs. Past that, a new line isn't drawn, and the inspect line
  says why.
- Right-clicking a portal with the Portal tool, or erasing over any of its
  cells with Erase or a right-click drag, removes the whole pair. Clear
  removes every portal.
- A line can't be drawn over another portal's cells; those cells are
  skipped. A line can be drawn over particles: they go through it on their
  next update.

### How crossing works: a window

- Each end is a list of cells along the line. Something crossing a cell
  part way along one end comes out at the same fraction of the way along
  the other end.
- The pair behaves like a window between two places: what goes in on one
  side of one end comes out on the far side of the other end and keeps
  going. Its direction is turned by the angle between the two lines. A
  line has no direction of its own, so the game reads each end in whichever
  of its two directions makes that turn 90° or less: two parallel ends never
  flip anything, and a floor end paired with a ceiling end makes an endless
  fall.
- Concretely, for each pair the game works out the turn (a rotation R) and,
  for each end, a unit normal n. Crossing end A from its −n side to its +n
  side comes out of end B on its +n side, moving R·v; crossing B the same
  way comes out of A with the inverse turn. Crossing from the +n side comes
  out on the −n side.

### What goes through

- **Anything that moves**: powders, liquids, gases, energy (fire, plasma),
  loose debris, creatures. Movement crosses portal cells as ordinary empty
  space; a particle that ends a frame's move on a portal cell is moved to
  the other end when it is next updated: to the matching cell of the other
  end, then one cell out on the side it's going (the 4-neighbour closest to
  ±n of that end), with its velocity turned. Which side it's going is the
  sign of its velocity along n, or failing that its fall along n, or, for
  something with neither (a still gas), either side at random. If that
  exit cell is taken by something it can't displace, or is itself a portal
  cell, it waits on the line.
- **Flying particles and light**: as they step from cell to cell, entering a
  portal cell moves them at once to the matching point past the other end,
  with their velocity turned, and they carry on the same frame.
- **Air**: every CELL cells along a pair, the air block just past A on its
  −n side evens out with the block just past B on its +n side, and B's −n
  side with A's +n side, PORTAL_SHARE (0.2) of the difference a frame, in
  pressure and (with convection on) air temperature. Wind and warm air come
  through, as through a pipe. Portal cells don't block the air between
  their own two sides.
- **Heat** goes through with whatever moves through.
- Solid blocks, walls and machines never move, so they never go through.

### Data

- `World.portals`: the pairs, each with its id, colours, and two ends; an
  end is its cell list, its unit normal, and (once paired) the turn to the
  other end.
- `World.portalAt` (Int32Array per cell): 0, or which pair, which end and
  which cell along it, packed.
- New file `src/sim/portals.js`: a `Portals` mix-in on `World.prototype`
  (drawing, removing, crossing, the air links), like `Machines`.

## 2. Time brush

- The options strip shows four buttons: ¼×, ½×, 2×, 4×. Painting with the
  Time tool sets the chosen speed on every cell under the brush.
  Right-clicking (or right-dragging) with the Time tool sets cells back to
  normal speed. Clear leaves speeds as they are; loading the starting scene
  resets them all.
- `World.speed` (Uint8Array per cell): 0 normal, then ¼, ½, 2 and 4. It
  belongs to the place, not to what's in it: sand that falls out of a slow
  area speeds back up.
- What a speed does:
  - **Updates.** Each frame, a particle in a ¼× cell is updated only on
    every fourth frame, in a ½× cell on every other frame. After the
    frame's normal pass, the game runs extra passes over the fast areas
    only: one more for 2× cells, three more for 4×, in the same order as
    the main pass, each updating particles that are (still) in a cell fast
    enough for that pass. Everything that happens in an update follows:
    falling and flowing, burning, decay, reactions, machines.
  - **Flying particles** in a cell of speed s move s times as far that
    frame, and their life runs down s times as fast.
  - **Heat** between two cells flows at the slower of their two speeds,
    worked out so that a 4× cell conducts as four steps would and never
    overshoots.
  - **The air** isn't affected: it's a coarse grid shared by neighbouring
    areas.
- The per-cell "updated this frame" stamp (`clock`) changes from the frame
  number to a pass number (`World.pass`, one higher for every pass), so
  extra passes can update a particle again. Everything else keyed to the
  frame number (blinking clocks, conveyors, pipe rebuilds, gravity) still
  uses `tick`, once a frame.
- Drawn with a faint tint over the cell: blue for slow, orange for fast,
  stronger the further from normal.
- Cost: an area at 4× costs about four times as much to run as it would at
  normal speed. Nothing is spent when no area is fast or slow.

## 3. Looping edges

- The Edges box in the Physics panel cycles each side on click: solid →
  void → loop → solid. Loop always comes in pairs: setting the left edge to
  loop sets the right edge too, and changing either away from loop puts
  both back to solid. Looped edges are drawn with a dotted marker on both
  sides of the world. Saved with the physics settings; Reset puts every edge
  back to solid. The world API becomes `setEdges({ top, bottom, left,
  right })` with each side `'solid' | 'void' | 'loop'`; `setVoidEdges`
  keeps working (it sets void or solid).
- Through a looped pair:
  - **Things** that move off one edge come in at the same place on the
    opposite edge, keeping their velocity. Every step to a neighbouring
    cell that checks the edge of the map goes through one helper on
    `World` that returns the neighbour's index across a looped edge, or
    says the edge is solid or a void.
  - **Flying particles** wrap the same way.
  - **Air** wraps: pressure, wind and air heat are continuous across the
    join, and a looped edge doesn't let air (or heat) out of the world the
    way the open edge does. The border ring on a looped side holds the
    values from just inside the opposite side; region labelling joins the
    two sides; with all four sides looped there is no outside at all.
  - **Heat** conducts across the join between touching particles.
  - Reactions with a neighbour (one random neighbour a frame) can happen
    across the join.
- Not across the join: power along wires and machines, brush strokes, blast
  shoves, wall shielding, Newtonian gravity.

## 4. Wall checklist

### Choosing

- When the Wall tool is selected, the options strip shows eight checkboxes,
  all unticked by default:
  - Solids (solid things that move: loose debris, and creatures, the
    elements in the creature category)
  - Powders
  - Liquids
  - Gases
  - Energy (fire, plasma, lightning and other energy elements)
  - Particles (light, neutrons and every other flying particle)
  - Heat
  - Air
- With none ticked, a wall is today's perfect wall. Each wall cell
  remembers the boxes ticked when it was painted. Changing the boxes
  changes only walls painted afterwards.

### The wall layer

- `World.wall` (Uint16Array per cell): 0 where there's no wall; otherwise
  WALL_HERE (256) plus a bit per ticked box: SOLID 1, POWDER 2, LIQUID 4,
  GAS 8, ENERGY 16, PARTICLES 32, HEAT 64, AIR 128.
- A wall cell's type is WALL when nothing is passing through it. Something
  passing through sits in the cell (its type is that thing's) with the wall
  layer still set underneath, the way a spark sits on a wire.
- Placing a Wall (`spawn` or painting) sets the layer (with the current
  boxes when painted with the Wall tool; 0 bits otherwise, so scenes and
  tests get perfect walls). Only erasing, or painting over it with Replace,
  removes a wall.
- `swap` keeps walls in place: after exchanging two cells, a cell with the
  wall layer that has been left empty becomes WALL again, and a cell
  without the layer that has been left holding WALL becomes empty. A
  particle inside a wall that is used up or converted to nothing leaves the
  cell as WALL (`clearCell` restores the wall).

### What each box does

- **Solids, Powders, Liquids, Gases, Energy**: `canEnter` lets a particle of
  that state (for Solids, only loose debris and creatures) into a wall cell
  that lets it through, as if the cell were empty. It moves through the wall
  cell by cell and out of the other side. Anything not allowed in still
  stops at the wall.
- **Particles**: flying particles pass through as if through empty space,
  instead of bouncing. The Glow halo passes too.
- **Heat**: the wall conducts heat like metal (conductivity 0.9) and trades
  heat with the air beside it; it isn't held at room temperature any more.
- **Air**: the wall doesn't block its air block, so pressure, wind and air
  heat pass through, and so do blast shoves (`wallBetween` ignores it), and
  `airOf` looks through it.
- Without the box, each of those behaves exactly as for today's perfect
  wall.

### Look

- A wall that lets anything through is drawn as a mesh: alternate cells (a
  checkerboard) a lighter shade of the wall colour. Something inside it is
  drawn in its own colour on the dark cells and blended with the wall on
  the light ones, so you see what's passing through.

## Code layout

- `src/sim/portals.js` (new): Portals mix-in.
- `src/sim/world.js`: the wall layer, `speed`, extra passes and the `pass`
  stamp, the edge helper and looping, heat across loops and at zone speeds.
- `src/sim/air.js`: looping air, region labelling across loops.
- `src/sim/particles.js`: wall layer, speed, portals and loops for flying
  particles.
- `src/game/input.js`: Portal and Time tools, wall boxes passed to painting.
- `src/game/ui.js`, `index.html`, `style.css`: 3 × 4 tools grid, the
  options strip.
- `src/game/physics-panel.js`: three-state edges.
- `src/render/renderer.js`: portals, time tint, wall mesh, loop markers.

## Testing

New `test/portals.test.js`, `test/time.test.js`, `test/loops.test.js`,
`test/wall-filters.test.js`:

- **Portals**: sand falling onto a floor end comes out of a ceiling end and
  falls again, round and round; water poured on one end flows out of the
  other; a photon crossing one end leaves the other with its direction
  turned 90° for perpendicular ends and unchanged for parallel ones; gas
  spreads through; pressure on one side of a pair reaches the matching side
  of the other; a full exit makes things wait; removing a pair (right-click,
  erase, Clear) removes all its cells; a lone end does nothing; ends can't
  overlap.
- **Time**: sand in a ¼× area falls about a quarter as far in the same
  frames as sand beside it, and in a 4× area about four times; a fire in a
  4× area burns out about four times sooner; a photon crossing a ½× area
  slows there; heat crosses a 4× bar faster without overshooting; right-
  click sets areas back; with no zones, a step is no slower.
- **Loops**: sand falling off the bottom of a top/bottom-looped world comes
  in at the top; a photon wraps; a gust of pressure crosses the join; a
  sealed world with all four sides looped keeps its pressure; void and solid
  edges behave as before; the panel cycles and pairs sides and saves them.
- **Wall checklist**: a liquids-only wall lets water through and stops sand;
  a gases-only wall lets smoke out and keeps water in; a particles wall lets
  light through and a plain wall bounces it; a heat wall conducts and warms,
  a plain one stays at 22 °C; an air wall lets pressure out of a box and a
  plain one holds it; walls never move; a particle passing through and
  burning out leaves the wall whole; erasing removes the layer; the boxes
  are remembered.
- Every existing test still passes, and the demo scene steps as fast as
  before.

## Docs

README: the new tools, the options strip, portals, time zones, looping
edges, wall boxes. HANDOFF: `portalAt` and the crossing rule, `speed` and
the `pass` stamp, the edge helper, the wall layer and how `swap` keeps it.
Rebuild dist.

## Out of scope

Saving and loading portals and zones (nothing is saved yet); portals that
carry solid blocks or power; time zones that change the air; looping power,
brushes or Newtonian gravity; per-wall editing after painting.
