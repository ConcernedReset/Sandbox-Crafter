# Machine overhaul: design

Date: 2026-10-03. Status: approved in chat, awaiting review of this write-up.

## Goal

Make the Machines group a real toolkit: improve the existing heat and air
machines, give power a direction so things can move one way, and add 13 new
machines covering air (pipes and pumps), motion, logic, sensing and energy.
Everything stays in the existing model: machines are elements in the
Machines category, crafted from parts, crushed back into them, powered by
controls and wires, and handed out in hard mode.

## Changes to existing machines

| Machine | Now | After |
| ------- | --- | ----- |
| Heater | +25 °C a frame while powered, stops at 1200 °C | +20 °C a frame while powered, no limit |
| Cooler | −25 °C a frame, stops at −150 °C | −20 °C a frame, down to absolute zero (−273 °C) |
| Fan | blows out of every open face, push 0.25 | same, push retuned so it still moves smoke and dust in the thick air |

## New machines

All are solid, Machines category, `machine: <kind>`, crafted by contact like
the existing ones (chance 0.03), and give way under pressure into their
parts. Recipes follow how the real thing is made.

| Machine | Kind | Recipe | What it does |
| ------- | ---- | ------ | ------------ |
| Pipe | `pipe` | Copper + Solder | Airtight tube. Its open ends are linked (see Pipe networks). Not powered. |
| Pump | `pump` | Pipe + Electromagnet | Part of a pipe network. While powered, moves air from beside it out through the network's other openings. |
| Safety Valve | `valve` | Pipe + Brass | Airtight. Opens (vanishes, like a door) while the pressure beside it is above +30, and shuts once it falls below +10. Not powered. |
| Conveyor | `conveyor` | Rubber + Fan | While powered, carries loose things resting on top of it along the belt, away from where the power came in. |
| Piston | `piston` | Pump + Steel | While powered, pushes out an arm up to 8 cells, shoving what's in front; pulls the arm back when the power stops. |
| Inverter | `inverter` | Silicon + Switch | A control: on unless powered (a NOT gate). Takes power on one side and outputs on the opposite side. |
| Delay Line | `delay` | Clock + Copper | A slow, one-way wire: current creeps along it one cell every 4 frames. |
| Barometer | `barometer` | Mercury + Glass | A control: on while the air pressure beside it is above +5. |
| Smoke Detector | `smoke` | Americium + Plastic | A control: on while smoke or any other gas touches it. |
| Wind Turbine | `turbine` | Fan + Aluminum | A control: on while the wind beside it blows faster than 0.5. |
| Igniter | `igniter` | Iridium + Porcelain | While powered, sets anything flammable touching it alight and throws small flames into empty cells beside it. |
| Neutron Source | `neutron` | Radium + Beryllium | While powered, fires neutrons out of its open faces. |

Plus one hidden helper element, **Piston Arm** (`always: true`, so it is
neither a discovery nor in the palette): the extended arm of a piston. Solid,
airtight, strength 200, not indestructible.

## Power direction

Power currently fills a machine's connected block with no memory of where it
came from. Add `world.powerFrom` (Int32Array, one per cell): when power
reaches a machine, every cell of the block it fills records the index of the
cell the power came from.

`powerCell(j, from)` takes the source cell:

- a control signalling (`signal(x, y)`): the control's cell;
- a spark on a wire (`updateSpark`, `sparkNeighbors`): the spark's cell;
- the Spark tool (`zap`): the machine cell itself (no direction).

Machines that use it:

- **Conveyor**: each cell's direction is the sign of its position minus the
  entry's, along the axis across gravity (x when gravity points up or down,
  y when it points sideways). Power from the left end carries things right.
  A cell level with the entry (the Spark tool on the belt itself) carries
  things the "positive" way.
- **Piston**: extends along whichever axis the entry is farther away on,
  away from the entry. Powered with no direction (the Spark tool), it
  extends against gravity.
- **Inverter**: its input side is where power last came from; it outputs on
  the opposite side only, and ignores power arriving on its output side, so
  its own output can't switch it off. Until it has ever been powered it
  outputs on every side.
- **Delay Line**: see below.

## Pipe networks

- A network is a 4-connected group of Pipe and Pump cells.
- Its **openings** are the air blocks of empty (or gas) cells touching it
  that aren't sealed. An opening touching a Pump is that pump's intake.
- Pipe and Pump cells are airtight, so they also wall off the air like any
  strong solid.
- Each frame, for every network:
  - **Passive:** each opening's pressure moves 20 % of the way towards the
    average of all the network's openings. Pressure is shared, not created.
  - **Pumping:** each powered pump moves up to 1.5 units of pressure a frame
    from its intake blocks to the other openings, split evenly. The usual
    ±256 limit holds at both ends.
- Pipe cells add themselves to a list as the frame's update reaches them.
  Networks are rebuilt from that list every 10 frames, or straight away when
  the number of pipe cells changes. With no pipes, nothing runs.

## Machines built on the door code

The Door opens by vanishing and remembers its doorway (`doorTimer`). Add
`doorKind` (Uint16Array per cell), the element a doorway turns back into, so
the same code serves Doors and Safety Valves:

- `openDoor(j)` records `doorKind` for every cell it opens.
- `shutDoor(c)` spawns `doorKind[c]`.
- An open valve's doorway stays open while the pressure in its air block (or
  the blocks beside it) is above +10. Below that its timer runs down as a
  door's does, and it shuts, shoving loose things aside.

## The other new machines

- **Delay Line.** Each cell has three states, kept in `ctype`: idle,
  charging (counting down 4 frames), cooldown (12 frames).
  - A charging cell that finishes fires once. It starts current in wires
    touching it, powers machines touching it, and sets touching idle delay
    cells charging, except the cell that charged it, which is in cooldown.
  - Power or a spark reaching an idle delay cell starts it charging.
  - Delay cells are left out of the connected-block flood, so the line
    doesn't light up all at once.
  - A line of n cells waits about 4n frames.
- **Piston.**
  - While powered: each frame the arm grows by one cell in the piston's
    direction, up to 8. The cell in front is pushed one step along. The push
    shoves up to 16 cells in a row and needs a free (or gas) cell at the end
    of the row; otherwise the arm stalls. Walls and anything indestructible
    can't be pushed.
  - When the power stops: the arm shrinks by one cell a frame. Pushed things
    stay where they are.
- **Conveyor.** Every 2 frames, the cell on top of each powered belt cell
  moves one cell along the belt if that cell is free (or gas). It carries
  powders, liquids, loose debris and creatures; whole solid blocks stay put.
- **Sensors (Barometer, Smoke Detector, Wind Turbine).** These are controls,
  like the Thermostat. They work out each frame whether they're on, then
  power their connected block and signal.
- **Igniter.** Calls `ignite` on flammable neighbours, and puts Fire into
  empty neighbours with a 20 % chance a frame.
- **Neutron Source.** Each open face fires a neutron with a 15 % chance a
  frame, flying straight out.

## Code layout

`machines.js` is 326 lines and would roughly triple, so split it:

- `machines.js`: the shared parts, controls (including the new logic and
  sensors), `updateMachine` and its dispatch, power and `powerFrom`, doors
  and valves.
- `machines-air.js`: Fan, Pipe, Pump, the network code.
- `machines-motion.js`: Conveyor, Piston.

All three are mixed into `World.prototype` the same way `Machines` is now.
The new element definitions and recipes go in `elements-machines.js`. The
renderer gets lights for the new controls (they use the existing MACHINE
drawing mode) and draws the Piston Arm like steel.

## Testing

New `test/machines-overhaul.test.js` (the existing `machines.test.js` keeps
its tests; the heater and cooler limits there change):

- Heater passes 20,000 °C after long enough powered; Cooler reaches −273 °C.
- A fan still blows a puff of smoke well clear of it in the thick air.
- A pipe through a wall evens out a pressurised box and an empty one.
- A pump fills a sealed box through a pipe and leaves suction at its own
  end; unpowered, it does nothing.
- A safety valve holds below +30, opens above it, and shuts again once the
  pressure has dropped.
- A conveyor carries sand away from the end it's powered from, both ways.
- A piston pushes a column of sand away from its power and pulls its arm back
  when the switch goes off; it can't push a wall.
- An inverter powers a lamp until its input switch goes on; its own output
  doesn't switch it off.
- A delay line of 10 cells lights a lamp about 40 frames after the switch.
- Barometer, smoke detector and wind turbine each switch a lamp on only when
  their condition holds.
- An igniter lights wood; a neutron source starts a uranium pile.
- Speed: the demo scene, which has no pipes, steps as fast as before.

Every new recipe is also run in the real simulation by `recipes.test.js`, and
the "everything can be discovered" check covers the new machines.

## Docs

README: the machine tables (controls and machines), the new controls and
machines, power direction. HANDOFF: `powerFrom`, pipe networks, `doorKind`,
the delay states, where each machine lives. Regenerate the recipe table;
rebuild dist.

## Out of scope

Pipes that carry particles (only air), adjustable sensor thresholds, an AND
gate (inverters and joined wires make any logic), saving and loading.
