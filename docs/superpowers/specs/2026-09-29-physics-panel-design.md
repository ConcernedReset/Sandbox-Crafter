# Physics panel: gravity direction and strength, Newtonian gravity, convection

Date: 2026-09-29. Approved in chat. Adds a Physics panel with four controls and
the simulation features behind them.

## Goals

- A **Physics** strip between the HUD and the recipe tree with:
  - an **arrow dial** that sets the direction of gravity (any angle),
  - a **strength** text box (a multiple of normal gravity),
  - a **Newtonian gravity** checkbox (mass attracts mass, as in The Powder Toy),
  - a **Convection** checkbox (hot things heat the air, the hot air pushes out
    and rises, cools, and flows back, slowly cooling the hot thing).
- With the defaults (arrow down, strength 1, both boxes off) the simulation
  behaves **exactly** as it does today: same moves, same random numbers.
- **No lag while off:** with Newtonian gravity off there is no mass pass, no
  field solve and no per-cell field lookups beyond what movement already
  does. Convection off skips all air-temperature work.

## 1. Gravity settings (`src/sim/gravity.js`, new)

`class Gravity` owns the settings and everything derived from them. `World`
creates one (`world.gravity`) sized to its air grid.

- **Angle** in degrees, clockwise on screen from straight down: 0 down, 90
  left, 180 up, 270 right. Unit vector `(ux, uy) = (-sin a, cos a)`.
- **Strength** `s`, 0 to 10, default 1. The uniform gravity is `s * (ux, uy)`
  in "g" (1 g accelerates a particle by `GRAVITY` = 0.12 cells per frame per
  frame, as now).
- **Per-block gravity table.** For each air block (4 x 4 cells), in g:
  - `gx, gy`: total gravity (uniform plus the Newtonian field when on),
  - `ux, uy`: its unit vector (0, 0 when there is none),
  - `mag`: its size,
  - `dirA, dirB, mix`: the two nearest of the 8 neighbour directions and the
    chance of picking `dirB`, so an in-between angle averages out right.
  With Newtonian off every block holds the uniform values, filled once when
  a setting changes. With it on, the table is refilled after each field solve.
- The **4-way arrow** `(downX, downY)`: the arrow snapped to the nearest of
  down, left, up and right. Behaviours use it (section 3).
- `set({ angle, strength, newtonian })` updates and refills; `World` exposes
  `setGravity(...)` and `setConvection(on)`.

## 2. Movement follows gravity (`src/sim/world.js`)

Direction ring, clockwise from down: S, SW, W, NW, N, NE, E, SE (index 0-7).

- **Acceleration.** `pushByAir` adds `GRAVITY * (gx, gy)` of the particle's
  block to powders, liquids and loose solids. Gases and drifting energy get
  only the Newtonian part (as in The Powder Toy, which pulls every non-solid).
- **The one-cell-a-frame fall.** Today a slow powder or liquid still moves one
  cell down each frame. That becomes: if the velocity along the gravity unit
  vector is between -0.5 and 1, set that component to 1 and keep the rest.
  `travel`'s random rounding then spreads an in-between angle over the two
  nearest cells. It happens every frame when `mag >= 1`, and with chance
  `mag` when it is weaker; with no gravity there is no fall.
- **Sliding and spreading** use the ring: a blocked grain tries the two cells
  at +-45 degrees from down; a liquid tries +-45 degrees, then flows along
  +-90 degrees, checking for a drop "below" (along down) each target. "Above"
  (what is pressing on a liquid) is the cell opposite down.
- **Density checks** (`canEnter`) take the sign of the move along the gravity
  unit vector (above 0.3 is "down", below -0.3 is "up", else sideways)
  instead of the change in y.
- **Stopping.** Where the code zeroes `vy` and halves `vx`, it now removes the
  velocity along gravity and halves the rest. Formulas are written so the
  default case gives bit-identical numbers (for example `vy - along * uy` is
  exactly 0 when `uy = 1`).
- **Gases** (and fire, plasma and other drifting energy). `rise` moves them
  against the uniform arrow and `sink` along it (a ring direction, dithered
  like the fall), with chances scaled by `min(1, s)`; the random sideways
  jitter runs across the arrow. With strength 0 they diffuse evenly (rise =
  sink = 0.3). The Newtonian field acts on them only through velocity. The
  random numbers are drawn in the same order as today.
- **Scan order.** Rows run from the "downstream" end: bottom first when the
  arrow points down (as now), top first when it points up, alternating each
  frame when it is mostly sideways or off. Within a row, the direction still
  alternates, except that a mostly sideways arrow scans from the downstream
  side so a column of grains moves together.

## 3. Behaviours follow the arrow (`src/sim/behaviors.js`, `world.js`)

Anything hard-coded to "up" or "down" uses the 4-way arrow instead: ember
flames thrown upward, cloud rain, lightning (strikes along down, strike
area rotated), seed trunks and canopies, stalks, fireworks (climb and trail),
superfluid creeping up walls, creatures (fall, walk, climb a step), grass
needing open space above, fruit dropped below, pressure plates (what rests
"on top"), and the blast's "thrown up off the ground" push. The Newtonian
field does not turn these. Glitter and meteors are falling objects, so they
use their block's full gravity (arrow plus Newtonian) like other particles.

## 4. Newtonian gravity (`src/sim/gravity.js`, `src/sim/fft.js`, new)

- **Mass.** Each cell adds `MASS[type]` to its air block: its density (Water
  = 1). Walls, energy (fire, plasma, glitter) and empty cells add nothing.
  Specials: Black Hole 2000, Pulsar 1000, Neutronium keeps its density
  (1000), Dark Matter 50 (invisible mass), Star 200, White Hole -500 (pushes
  things away).
- **Field.** For every block, the pull of every other block with a 1/r^2
  falloff, softened at one block: `g = G * sum(m * d / (|d|^2 + 0.5)^1.5)`,
  `d` in blocks. Computed by FFT convolution on a zero-padded power-of-two
  grid (256 x 128 for the 100 x 60 blocks of the game): the mass is
  transformed, multiplied by the precomputed transforms of the x and y
  kernels combined as `Kx + i*Ky`, and transformed back once; the real part is
  `gx`, the imaginary part `gy`. Rows known to be empty are skipped.
- **Cadence.** The field is solved every other frame; the table is refilled
  after each solve.
- **Lazy setup.** FFT buffers and kernel transforms are built the first time
  Newtonian gravity is switched on and kept afterwards. Off costs nothing.
- **What it moves.** Everything `pushByAir` moves (section 2). Fixed solids
  stay put.
- **Flying particles** (light, neutrons...) are bent by the field when it is
  on: velocity plus `LENS * field`, then rescaled to the old speed.
- `G` is tuned so a 40-cell-wide disc of sand pulls about 1 g at its surface.

## 5. Convection (`src/sim/air.js`, `world.js`)

- **Air temperature** `air.t` per block, starting at room temperature
  (`AMBIENT`, 22 degrees). The border ring stays at room temperature: the map
  edge is open air.
- **Heat exchange.** Where a particle faces empty cells it now trades heat
  with its block's air instead of with a fixed room temperature, at the same
  per-element rate (`AIR_COOL`). The heat it gives the air warms the block by
  `AIR_SHARE` times as much (air holds little heat).
- **Expansion.** Heat given to a block's air raises its pressure by `EXPAND`
  per degree; heat the air loses lowers it again. So a hot thing pushes air
  outward, and the air draws back in as it cools.
- **Buoyancy.** Each face's air velocity gains `BUOYANCY * (T - AMBIENT)`
  (the two blocks' mean) against the local gravity (uniform plus Newtonian).
  A plume rises, the low pressure it leaves pulls cool air in at the base: a
  loop. With no gravity only expansion acts.
- **Carrying and cooling.** Air temperature is carried by the air velocity
  (semi-Lagrangian, bilinear), smoothed a little, and relaxes towards room
  temperature by `AIR_TEMP_LOSS` per frame (the room soaks up heat). Sealed
  blocks keep their temperature and neither give nor take any.
- **Off** (the default): none of this runs; the exchange is the old
  fixed-temperature leak and `air.t` is not touched.
- **Fire still suffocates.** A fire in a sealed box must still go out with
  convection on; `EXPAND` is tuned with that as a limit.

## 6. Panel (`index.html`, `style.css`, `src/game/physics-panel.js`, new)

- A `section.physics` between `.hud` and `.tree`, styled like the other panels
  (same width rules, one row that wraps on narrow screens):
  - **Dial:** a round button (`role="slider"`, 0-359, value text such as
    "Down" or "30 degrees") with an arrow drawn in SVG. Drag to rotate (whole
    degrees; Shift snaps to 45), Left/Right arrow keys turn it 15 degrees,
    Home or double-click resets to down. Key presses don't reach the camera.
  - **Angle readout** beside it: a name at multiples of 45 (Down, Down-left,
    Left, Up-left, Up, Up-right, Right, Down-right), otherwise degrees.
  - **Strength:** a text box (`inputmode="decimal"`), applied on Enter or
    blur, clamped to 0-10; anything unreadable reverts. A "x" suffix.
  - **Newtonian gravity** and **Convection** checkboxes.
  - **Reset** button: back to down, 1, off, off.
- Settings are saved in `localStorage` (`sandbox-crafter:physics`), guarded
  like saved progress, and applied at start.
- `--screen-w` leaves room for the strip so the game view and the panel fit
  in the window together.

## 7. Views (`src/render/renderer.js`, `src/game/ui.js`)

- **Heat view** with convection on: empty cells show their block's air
  temperature, dimmed, where it differs from room temperature by more than
  2 degrees.
- **HUD:** with convection on, pointing at a cell also shows its air
  temperature.

## Testing

- **Identical by default:** a probe fingerprints two seeded scenes (the demo
  scene and a mixed scene with every affected behaviour) before and after;
  the fingerprints must match. All existing tests pass unchanged.
- `test/gravity.test.js`: the table for straight down is exact; sideways
  gravity piles sand against the side wall; up gravity sends water to the
  ceiling and steam down; a 30 degree arrow slants the fall; strength 0 leaves
  sand hanging; strength 2 falls faster than 1; a firework climbs against a
  sideways arrow; the settings clamp.
- `test/newtonian.test.js`: the FFT field matches a direct sum on a small
  grid; with Newtonian off no field is ever built; a heavy blob pulls in
  loose sand with gravity strength 0; a White Hole pushes it away; light
  bends passing a heavy mass.
- `test/convection.test.js`: off leaves `air.t` untouched; on, air above a hot
  block warms more than air below it, air rises above it and flows in at its
  base, and flipping the arrow flips the plume; the hot block cools; heating
  raises the pressure around it; a sealed fire still goes out.
- **Speed:** demo scene ms/step before and after, with each option off and
  on, reported in chat.
- The single-file build picks up the new modules; `test/build.test.js`
  already checks every module is inlined.

## Docs

README: a Physics panel section (controls, what each does, planets with
strength 0, convection). HANDOFF: layout rows for the new files and notes on
the gravity table, the identical-default rule and the lazy Newtonian setup.
