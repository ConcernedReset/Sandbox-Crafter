// Ready-made worlds for the World menu. Each clears the world and builds a
// scene with the world's own tools (spawn, portals, time zones, walls); the
// player's discoveries and physics settings are left alone. Placing an
// element in a scene doesn't count as discovering it, and in a showcase
// nothing that happens does either (world.recording), until the world is
// cleared or a play world loaded.

import { DEFS, ID, COLLECTIBLE, State } from '../sim/elements.js';
import { SHAPED } from '../sim/creatures.js';
import { PASS } from '../sim/walls.js';

const { LIQUID } = State;

// Drawing helpers. `put` fills empty cells only; `set` overwrites.
function tools(world) {
  const { w, h } = world;
  const id = (t) => {
    if (typeof t !== 'number' || !DEFS[t]) throw new Error(`no such element: ${t}`);
    return t;
  };
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const put = (x, y, t) => {
    if (!inside(x, y)) return -1;
    const i = y * w + x;
    if (world.type[i] !== 0) return -1;
    world.spawn(i, id(t));
    return i;
  };
  const set = (x, y, t) => {
    if (!inside(x, y)) return -1;
    const i = y * w + x;
    if (world.type[i] !== 0) {
      if (world.wall[i] !== 0) world.setWall(i, 0);
      world.clearCell(i);
    }
    if (t !== 0) world.spawn(i, id(t));
    return i;
  };
  const rect = (x0, y0, x1, y1, t, over = true) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) (over ? set : put)(x, y, t);
  };
  // A hollow box, `thick` cells thick.
  const box = (x0, y0, x1, y1, t, thick = 1) => {
    rect(x0, y0, x1, y0 + thick - 1, t);
    rect(x0, y1 - thick + 1, x1, y1, t);
    rect(x0, y0, x0 + thick - 1, y1, t);
    rect(x1 - thick + 1, y0, x1, y1, t);
  };
  const disc = (cx, cy, r, t, over = true) => {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.8) (over ? set : put)(x, y, t);
      }
    }
  };
  // A switch, already on.
  const switchOn = (x, y) => {
    const i = set(x, y, ID.SWITCH);
    if (i >= 0) world.ctype[i] = 1;
  };
  return { w, h, put, set, rect, box, disc, switchOn };
}

// Rolling ground: the height of the surface at x.
const rolling = (h, base, a1, a2, phase = 0) => (x) => Math.round(h - base + Math.sin(x / 37 + phase) * a1 + Math.sin(x / 13 + 1.7 + phase) * a2);

// ---- the starting area ---------------------------------------------------------

// Rolling dirt, a sand dune and a stone-lined pond. It uses only the
// starting elements (and stone, so the water never touches the dirt: the
// first discovery is left for the player).
function startingArea(world) {
  const { w, h, put } = tools(world);
  const ground = rolling(h, 34, 5, 2);
  for (let x = 0; x < w; x++) for (let y = ground(x); y < h; y++) put(x, y, ID.DIRT);
  // A sand dune on the left.
  for (let x = 20; x < 150; x++) {
    const top = ground(x) - Math.round(Math.max(0, 26 - Math.abs(x - 80) * 0.42));
    for (let y = top; y < ground(x); y++) put(x, y, ID.SAND);
  }
  // The pond on the right, in a stone basin sitting on a stone floor.
  const x0 = 250, x1 = 360;
  const floorY = Math.min(...Array.from({ length: x1 - x0 + 1 }, (_, k) => ground(x0 + k))) - 3;
  const rimTop = floorY - 30;
  for (let x = x0; x <= x1; x++) {
    for (let y = floorY; y < ground(x); y++) put(x, y, ID.STONE);
  }
  for (let y = rimTop; y < floorY; y++) {
    for (let k = 0; k < 3; k++) { put(x0 + k, y, ID.STONE); put(x1 - k, y, ID.STONE); }
  }
  for (let y = rimTop + 8; y < floorY; y++) {
    for (let x = x0 + 3; x <= x1 - 3; x++) put(x, y, ID.WATER);
  }
}

// ---- the wilderness ------------------------------------------------------------

// Hills of dirt under grass, saplings that grow into a forest, fallen logs,
// boulders, a coal seam in a cliff, a stone-lined pond with fish, and three
// humans to make a home of it.
function wilderness(world) {
  const { w, h, put, set, rect, disc } = tools(world);
  const ground = rolling(h, 60, 10, 4, 0.6);
  for (let x = 0; x < w; x++) {
    const g = ground(x);
    for (let y = g; y < h; y++) put(x, y, y < g + 2 ? ID.GRASS : y > h - 20 ? ID.STONE : ID.DIRT);
  }
  // A cliff on the right with a seam of coal and a clay bank.
  for (let x = 330; x < w; x++) {
    const top = ground(x) - Math.min(30, (x - 330) * 1.5);
    for (let y = Math.round(top); y < ground(x); y++) put(x, y, ID.STONE);
  }
  rect(352, ground(352) - 14, 399, ground(352) - 11, ID.COAL);
  rect(300, ground(300), 320, ground(300) + 4, ID.CLAY);
  // A pond in a stone basin, with fish: level, just under the lower rim.
  const px0 = 170, px1 = 230, py = Math.max(...Array.from({ length: 61 }, (_, k) => ground(px0 + k)));
  const rim = Math.max(ground(px0 - 3), ground(px1 + 3)) + 1;
  for (let x = px0 - 2; x <= px1 + 2; x++) for (let y = Math.min(ground(x), rim); y <= py + 14; y++) set(x, y, ID.STONE);
  for (let x = px0; x <= px1; x++) {
    for (let y = Math.min(ground(x), rim); y < rim; y++) set(x, y, 0);
    for (let y = rim; y <= py + 11; y++) set(x, y, ID.WATER);
  }
  for (let k = 0; k < 4; k++) set(px0 + 10 + k * 12, py + 6, ID.FISH);
  set(px0 + 30, py + 9, ID.ALGAE);
  // Saplings: they grow into a forest of oaks, pines and acacias.
  for (const x of [20, 34, 50, 66, 88, 104, 120, 262, 278, 296]) put(x, ground(x) - 1, ID.SAPLING);
  // Fallen logs and boulders.
  for (const [x0, len] of [[40, 9], [140, 7], [250, 8]]) rect(x0, ground(x0) - 3, x0 + len, ground(x0) - 1, ID.WOOD, false);
  for (const [cx, r] of [[80, 4], [150, 5], [245, 4], [312, 6]]) disc(cx, ground(cx) - r + 1, r, ID.STONE, false);
  // Flowers here and there.
  for (let x = 10; x < 330; x += 23) put(x, ground(x) - 1, ID.FLOWER);
  // Three humans.
  for (const x of [95, 125, 155]) set(x, ground(x) - 8, ID.HUMAN);
}

// ---- the element gallery -------------------------------------------------------

// Every element in the table, each in its own little walled cell, in table
// order: a stress test that shows everything at once.
function gallery(world) {
  const { w, h, set, rect, box } = tools(world);
  const CW = 8, CH = 9; // a cell, walls included: 6 x 7 inside
  const cols = Math.floor(w / CW);
  COLLECTIBLE.forEach((d, n) => {
    const x0 = (n % cols) * CW, y0 = Math.floor(n / cols) * CH;
    if (y0 + CH > h) return;
    box(x0, y0, x0 + CW - 1, y0 + CH - 1, ID.WALL);
    const ix0 = x0 + 1, iy0 = y0 + 1, ix1 = x0 + CW - 2, iy1 = y0 + CH - 2;
    const t = d.id;
    if (d.projectile) {
      for (let k = 0; k < 6; k++) world.spawnProjectile(t, ix0 + 1 + (k % 3) + 0.5, iy0 + 2 + (k >> 1) + 0.5, 0, 0);
    } else if (SHAPED[t]) {
      // One creature, in water if it's a swimmer.
      if (d.critter.moves === 'swim') rect(ix0, iy0, ix1, iy1, ID.WATER);
      set(ix0 + 3, iy1, t);
    } else if (d.state === LIQUID) {
      rect(ix0, iy0 + 3, ix1, iy1, t);
    } else {
      rect(ix0, iy0 + 2, ix1, iy1, t);
    }
  });
}

// ---- the physics lab -----------------------------------------------------------

// One bay each for portals, time zones, walls that sieve, a pressure vessel
// with a safety valve, liquids settling by density, lava meeting water, a
// storm cloud, growing things, a magnet, a laser and mirrors, and a heater
// for convection. Bays are 100 x 80, three rows of four.
function physicsLab(world) {
  const { w, h, put, set, rect, box, disc, switchOn } = tools(world);
  const bay = (k, build) => {
    const ox = (k % 4) * 100, oy = Math.floor(k / 4) * 80;
    rect(ox, oy + 76, ox + 99, oy + 79, ID.STONE); // its floor
    build(ox, oy, oy + 75); // floor: the row just above the stone
  };
  // 0. Portals: sand pours round and round between a floor and a ceiling portal.
  bay(0, (ox, oy, fy) => {
    world.addPortal(ox + 30, fy - 4, ox + 70, fy - 4);
    world.addPortal(ox + 30, oy + 4, ox + 70, oy + 4);
    rect(ox + 45, oy + 20, ox + 55, oy + 30, ID.SAND);
  });
  // 1. Time zones: three sand columns falling at ¼×, 1× and 4×.
  bay(1, (ox, oy, fy) => {
    for (const [k, code] of [[0, 1], [1, 0], [2, 4]]) {
      const x0 = ox + 10 + k * 30;
      if (code) world.paintSpeed((fn) => world.forRect(x0, oy + 2, x0 + 20, fy, fn), code);
      rect(x0 + 6, oy + 4, x0 + 14, oy + 16, ID.SAND);
    }
  });
  // 2. Walls that sieve: a mesh that lets liquids through but not powders,
  // under a mix of sand and water; and one that lets only heat through.
  bay(2, (ox, oy, fy) => {
    world.wallMask = PASS.liquid;
    rect(ox + 10, oy + 40, ox + 50, oy + 40, ID.WALL);
    world.wallMask = 0;
    box(ox + 8, oy + 10, ox + 52, oy + 41, ID.STONE);
    set(ox + 30, oy + 41, 0); // a drain hole under the mesh
    for (let y = oy + 20; y < oy + 39; y++) for (let x = ox + 10; x <= ox + 50; x++) set(x, y, (x + y) % 3 === 0 ? ID.SAND : ID.WATER);
    world.wallMask = PASS.heat;
    rect(ox + 70, oy + 30, ox + 70, fy, ID.WALL);
    world.wallMask = 0;
    rect(ox + 60, fy - 6, ox + 68, fy, ID.LAVA);
    rect(ox + 72, fy - 6, ox + 80, fy, ID.ICE);
  });
  // 3. A pressure vessel: a sealed stone tank full of high pressure, with a
  // safety valve in its lid.
  bay(3, (ox, oy, fy) => {
    box(ox + 20, oy + 20, ox + 80, fy, ID.STONE, 3);
    set(ox + 50, oy + 20, ID.VALVE);
    set(ox + 50, oy + 21, ID.VALVE);
    set(ox + 50, oy + 22, ID.VALVE);
    world.pressurize(ox + 50, oy + 48, 20, 40);
    rect(ox + 30, fy - 8, ox + 70, fy - 3, ID.SAND);
  });
  // 4. Density: oil floats on water, water on salt water; sand sinks through all.
  bay(4, (ox, oy, fy) => {
    box(ox + 25, oy + 15, ox + 75, fy, ID.GLASS);
    rect(ox + 26, fy - 14, ox + 74, fy - 1, ID.SALT_WATER);
    rect(ox + 26, fy - 28, ox + 74, fy - 15, ID.WATER);
    rect(ox + 26, fy - 40, ox + 74, fy - 29, ID.OIL);
    rect(ox + 45, oy + 16, ox + 55, oy + 22, ID.SAND);
  });
  // 5. Lava pours onto water: steam, obsidian and stone.
  bay(5, (ox, oy, fy) => {
    box(ox + 10, oy + 40, ox + 90, fy, ID.STONE, 2);
    rect(ox + 12, oy + 60, ox + 88, fy - 2, ID.WATER);
    rect(ox + 40, oy + 5, ox + 60, oy + 15, ID.LAVA);
  });
  // 6. A storm: a cloud over a sand dune and a metal rod; its lightning
  // fuses sand to glass.
  bay(6, (ox, oy, fy) => {
    rect(ox + 15, oy + 6, ox + 85, oy + 12, ID.CLOUD);
    for (let x = ox + 5; x < ox + 95; x++) {
      const top = fy - Math.round(Math.max(0, 14 - Math.abs(x - ox - 50) * 0.35));
      rect(x, top, x, fy, ID.SAND);
    }
    rect(ox + 75, oy + 40, ox + 75, fy, ID.METAL);
    set(ox + 40, oy + 13, ID.LIGHTNING);
  });
  // 7. Growing things: saplings and seeds on soil, plant in a pool.
  bay(7, (ox, oy, fy) => {
    rect(ox, fy - 3, ox + 99, fy, ID.DIRT);
    for (const x of [15, 40, 65]) put(ox + x, fy - 4, ID.SAPLING);
    put(ox + 28, fy - 4, ID.SEED);
    put(ox + 52, fy - 4, ID.SEED);
    box(ox + 78, fy - 20, ox + 98, fy - 3, ID.STONE);
    rect(ox + 79, fy - 18, ox + 97, fy - 4, ID.WATER);
    rect(ox + 87, fy - 5, ox + 89, fy - 4, ID.PLANT);
  });
  // 8. A magnet: ferrofluid spikes towards it, iron filings gather.
  bay(8, (ox, oy, fy) => {
    rect(ox + 45, oy + 10, ox + 55, oy + 20, ID.MAGNET);
    box(ox + 20, oy + 40, ox + 80, fy, ID.GLASS);
    rect(ox + 21, fy - 8, ox + 79, fy - 1, ID.FERROFLUID);
  });
  // 9. Light: a laser through a block of glass onto a photocell that lights
  // a lamp, and a mirror over it.
  bay(9, (ox, oy, fy) => {
    set(ox + 5, fy, ID.BATTERY);
    set(ox + 6, fy, ID.LASER_EMITTER);
    rect(ox + 5, fy - 1, ox + 7, fy - 1, ID.STONE);
    rect(ox + 30, fy - 6, ox + 40, fy, ID.GLASS);
    rect(ox + 20, oy + 10, ox + 80, oy + 10, ID.MIRROR);
    set(ox + 90, fy, ID.PHOTOCELL);
    set(ox + 91, fy, ID.LAMP);
  });
  // 10. Convection: a heater on the floor (turn on Convection in the Physics
  // panel to see the air roll), with feathers to show the air moving.
  bay(10, (ox, oy, fy) => {
    switchOn(ox + 40, fy);
    rect(ox + 41, fy, ox + 59, fy, ID.HEATER);
    for (let k = 0; k < 12; k++) put(ox + 10 + k * 7, oy + 30 + (k % 3) * 8, ID.FEATHER);
  });
  // 11. A tiny reactor behind lead, with a Geiger counter: start it with
  // the neutron source's switch (paint Spark on it).
  bay(11, (ox, oy, fy) => {
    box(ox + 30, oy + 30, ox + 70, fy, ID.LEAD, 3);
    rect(ox + 33, fy - 10, ox + 67, fy - 3, ID.WATER);
    disc(ox + 50, fy - 9, 3, ID.URANIUM);
    set(ox + 36, fy - 2, ID.NEUTRON_SOURCE);
    set(ox + 35, fy - 2, ID.SWITCH);
    set(ox + 80, fy, ID.GEIGER);
    disc(ox + 15, fy - 3, 3, ID.FALLOUT, false);
  });
}

// ---- creatures -----------------------------------------------------------------

// A pond full of swimmers, a meadow full of insects, frogs and snails,
// saplings growing into trees, birds overhead, a phoenix in a glass cage,
// and two humans with wood and stone to build with.
function creatures(world) {
  const { w, h, put, set, rect, box, disc } = tools(world);
  const ground = (x) => Math.round(h - 40 + Math.sin(x / 41) * 4);
  for (let x = 0; x < w; x++) {
    const g = ground(x);
    for (let y = g; y < h; y++) put(x, y, y < g + 2 ? ID.GRASS : ID.DIRT);
  }
  // The pond, stone-lined, deep enough for everything that swims.
  const p0 = 10, p1 = 130, pt = h - 44;
  for (let x = p0 - 3; x <= p1 + 3; x++) for (let y = pt; y < h; y++) set(x, y, ID.STONE);
  for (let x = p0; x <= p1; x++) for (let y = pt + 1; y < h - 3; y++) set(x, y, ID.SALT_WATER);
  rect(p0, h - 6, p1, h - 4, ID.SAND);
  for (const [t, xs, y] of [
    [ID.FISH, [20, 45, 70, 95], pt + 12], [ID.ELECTRIC_EEL, [30, 90], pt + 28],
    [ID.SQUID, [55, 115], pt + 22], [ID.JELLYFISH, [40, 80, 120], pt + 8],
  ]) for (const x of xs) set(x, y, t);
  for (let k = 0; k < 20; k++) set(p0 + 5 + k * 6, pt + 4 + (k % 5) * 6, ID.PLANKTON);
  for (let x = p0 + 2; x < p1; x += 9) set(x, h - 7, ID.ALGAE);
  // The meadow: flowers, saplings, and its creatures.
  for (let x = 140; x < 330; x += 7) put(x, ground(x) - 1, ID.FLOWER);
  for (const x of [150, 185, 230, 270, 310]) put(x, ground(x) - 2, ID.SAPLING);
  rect(200, ground(200) - 2, 206, ground(200) - 1, ID.SUGAR, false);
  for (const [t, xs] of [
    [ID.ANT, [196, 210, 214]], [ID.SNAIL, [160, 250]], [ID.FROG, [175, 290]], [ID.SPIDER, [220]],
    [ID.LOCUST, [240, 260]],
  ]) for (const x of xs) set(x, ground(x) - 6, t);
  for (const x of [150, 200, 260, 300]) set(x, ground(x) + 6, ID.WORM);
  for (const [t, xs, y] of [
    [ID.BEE, [170, 230, 280], 150], [ID.BUTTERFLY, [190, 250], 140], [ID.FIREFLY, [210, 300], 130],
    [ID.BIRD, [60, 160, 240, 340], 60],
  ]) for (const x of xs) set(x, y, t);
  // A phoenix in a glass cage.
  box(170, 40, 200, 70, ID.GLASS);
  set(185, 55, ID.PHOENIX);
  // Two humans, a log pile and a boulder.
  rect(345, ground(345) - 4, 356, ground(345) - 1, ID.WOOD, false);
  disc(390, ground(390) - 3, 5, ID.STONE, false);
  for (const x of [365, 375]) set(x, ground(x) - 8, ID.HUMAN);
}

// ---- the weapons range ---------------------------------------------------------

// Eight firing points, each with its own detonator: paint Spark on a
// station's switch (far left of it) to set it off. Everything here is the
// game's own; nothing in it works like the real thing.
function weaponsRange(world) {
  const { w, h, put, set, rect, box, disc } = tools(world);
  // Station k: 100 x 120, floor at fy; a switch and a wire, and an igniter
  // at its end unless the station runs the wire on itself (an igniter
  // doesn't carry current).
  const station = (k, build, ownWire = false) => {
    const ox = (k % 4) * 100, oy = Math.floor(k / 4) * 120;
    const fy = oy + 109;
    rect(ox, fy + 1, ox + 99, oy + 119, ID.STONE);
    rect(ox, oy, ox, fy, ID.STONE); // a wall between stations
    set(ox + 4, fy, ID.SWITCH);
    rect(ox + 5, fy, ox + 10, fy, ID.METAL);
    set(ox + 11, fy, ownWire ? ID.METAL : ID.IGNITER);
    build(ox, oy, fy);
  };
  // 0. Dynamite in a stone bunker, with a fuse out to the igniter.
  station(0, (ox, oy, fy) => {
    box(ox + 40, fy - 30, ox + 80, fy, ID.STONE, 3);
    rect(ox + 54, fy - 10, ox + 66, fy - 1, ID.DYNAMITE);
    rect(ox + 12, fy, ox + 56, fy, ID.FUSE);
  });
  // 1. A trail of gunpowder to a heap of it beside a brick wall.
  station(1, (ox, oy, fy) => {
    rect(ox + 12, fy, ox + 55, fy, ID.GUNPOWDER);
    for (let x = ox + 55; x <= ox + 75; x++) rect(x, fy - Math.round(12 - Math.abs(x - ox - 65) * 1.1), x, fy, ID.GUNPOWDER);
    rect(ox + 82, fy - 40, ox + 88, fy, ID.BRICK);
  });
  // 2. Nitro in a glass jar, its igniter set into the jar's side.
  station(2, (ox, oy, fy) => {
    box(ox + 40, fy - 16, ox + 60, fy, ID.GLASS);
    set(ox + 40, fy - 16, 0);
    rect(ox + 41, fy - 12, ox + 59, fy - 1, ID.NITRO);
    rect(ox + 12, fy, ox + 39, fy, ID.METAL);
    set(ox + 39, fy - 1, ID.METAL);
    set(ox + 40, fy - 1, ID.IGNITER);
  }, true);
  // 3. A heap of ANFO with a stick of dynamite in it as a booster.
  station(3, (ox, oy, fy) => {
    for (let x = ox + 40; x <= ox + 80; x++) rect(x, fy - Math.round(14 - Math.abs(x - ox - 60) * 0.7), x, fy, ID.ANFO);
    rect(ox + 58, fy - 3, ox + 62, fy, ID.DYNAMITE);
    rect(ox + 12, fy, ox + 57, fy, ID.FUSE);
  });
  // 4. Thermite on a steel plate: the plate carries the current to the
  // igniter on top.
  station(4, (ox, oy, fy) => {
    rect(ox + 12, fy, ox + 39, fy, ID.METAL);
    rect(ox + 40, fy - 2, ox + 85, fy, ID.STEEL);
    rect(ox + 55, fy - 9, ox + 70, fy - 3, ID.THERMITE);
    set(ox + 54, fy - 3, ID.IGNITER);
  }, true);
  // 5. Napalm and Greek fire in stone trays, beside wooden sheds. The wire
  // runs over the sheds to the second tray.
  station(5, (ox, oy, fy) => {
    for (const [x0, t] of [[18, ID.NAPALM], [58, ID.GREEK_FIRE]]) {
      box(ox + x0, fy - 5, ox + x0 + 22, fy, ID.STONE);
      rect(ox + x0 + 1, fy - 4, ox + x0 + 21, fy - 1, t);
      box(ox + x0 + 4, fy - 20, ox + x0 + 18, fy - 6, ID.WOOD);
      set(ox + x0, fy - 1, ID.IGNITER); // set into the tray's side
    }
    rect(ox + 12, fy - 22, ox + 12, fy, ID.METAL);
    rect(ox + 13, fy - 1, ox + 17, fy - 1, ID.METAL);
    rect(ox + 12, fy - 22, ox + 57, fy - 22, ID.METAL);
    rect(ox + 57, fy - 22, ox + 57, fy - 1, ID.METAL);
  }, true);
  // 6. Fireworks along a fuse.
  station(6, (ox, oy, fy) => {
    rect(ox + 12, fy, ox + 90, fy, ID.FUSE);
    for (let x = ox + 20; x <= ox + 90; x += 10) set(x, fy - 1, ID.FIREWORK);
  });
  // 7. Flares and sparklers on a stand, lit along a fuse.
  station(7, (ox, oy, fy) => {
    rect(ox + 12, fy, ox + 85, fy, ID.FUSE);
    for (let x = ox + 20; x <= ox + 85; x += 6) {
      rect(x, fy - 6, x, fy - 1, x % 12 < 6 ? ID.FLARE : ID.SPARKLER);
    }
  });
}

// ---- machines ------------------------------------------------------------------

// Every machine and control, each working in its own bay, six bays across
// and five down.
function machines(world) {
  const { w, h, put, set, rect, box, disc, switchOn } = tools(world);
  let k = 0;
  // Bay 66 x 48 with a stone floor; floor row fy (the row above the stone).
  const bay = (build) => {
    const ox = (k % 6) * 66, oy = Math.floor(k / 6) * 48;
    k++;
    rect(ox, oy + 45, ox + 65, oy + 47, ID.STONE);
    build(ox, oy, oy + 44);
  };
  const battery = (x, y) => set(x, y, ID.BATTERY);
  // Lamps of every colour, on batteries.
  for (const t of [ID.LAMP, ID.RED_LAMP, ID.GREEN_LAMP, ID.BLUE_LAMP]) {
    bay((ox, oy, fy) => {
      battery(ox + 6, fy);
      rect(ox + 7, fy, ox + 14, fy, ID.METAL);
      rect(ox + 15, fy - 4, ox + 19, fy, t);
    });
  }
  // A switch (on), a button and a clock, each lighting a lamp.
  bay((ox, oy, fy) => { switchOn(ox + 6, fy); rect(ox + 7, fy, ox + 14, fy, ID.METAL); rect(ox + 15, fy - 2, ox + 17, fy, ID.LAMP); });
  bay((ox, oy, fy) => { set(ox + 6, fy, ID.BUTTON); rect(ox + 7, fy, ox + 14, fy, ID.METAL); rect(ox + 15, fy - 2, ox + 17, fy, ID.LAMP); });
  bay((ox, oy, fy) => { set(ox + 6, fy, ID.CLOCK); rect(ox + 7, fy, ox + 14, fy, ID.METAL); rect(ox + 15, fy - 2, ox + 17, fy, ID.LAMP); });
  // A pressure plate with sand piled on it.
  bay((ox, oy, fy) => {
    rect(ox + 10, fy, ox + 20, fy, ID.PRESSURE_PLATE);
    rect(ox + 12, fy - 6, ox + 18, fy - 1, ID.SAND);
    set(ox + 21, fy, ID.LAMP);
  });
  // A laser on a photocell.
  bay((ox, oy, fy) => {
    battery(ox + 4, fy);
    set(ox + 5, fy, ID.LASER_EMITTER);
    rect(ox + 4, fy - 1, ox + 6, fy - 1, ID.STONE);
    set(ox + 40, fy, ID.PHOTOCELL);
    set(ox + 41, fy, ID.LAMP);
    rect(ox + 42, fy - 1, ox + 42, fy, ID.STONE);
  });
  // A thermostat warmed by a heater.
  bay((ox, oy, fy) => {
    battery(ox + 10, fy);
    set(ox + 11, fy, ID.HEATER);
    set(ox + 12, fy, ID.THERMOSTAT);
    set(ox + 13, fy, ID.LAMP);
  });
  // An inverter: its lamp is lit while its switch is off.
  bay((ox, oy, fy) => {
    set(ox + 4, fy, ID.SWITCH);
    rect(ox + 5, fy, ox + 11, fy, ID.METAL);
    set(ox + 12, fy, ID.INVERTER);
    rect(ox + 13, fy, ox + 17, fy, ID.COPPER);
    rect(ox + 18, fy - 2, ox + 20, fy, ID.LAMP);
  });
  // A delay line.
  bay((ox, oy, fy) => {
    switchOn(ox + 4, fy);
    rect(ox + 5, fy, ox + 6, fy, ID.METAL);
    rect(ox + 7, fy, ox + 26, fy, ID.DELAY);
    set(ox + 27, fy, ID.LAMP);
  });
  // A barometer in a pressurised tank.
  bay((ox, oy, fy) => {
    box(ox + 10, oy + 14, ox + 50, fy, ID.STONE, 2);
    set(ox + 30, fy - 2, ID.BAROMETER);
    set(ox + 31, fy - 2, ID.LAMP);
    world.pressurize(ox + 30, oy + 28, 12, 20);
  });
  // A smoke detector over a small fire.
  bay((ox, oy, fy) => {
    rect(ox + 20, fy - 2, ox + 28, fy, ID.WOOD);
    set(ox + 24, fy - 3, ID.FIRE);
    rect(ox + 20, oy + 18, ox + 28, oy + 18, ID.STONE);
    set(ox + 24, oy + 19, ID.SMOKE_DETECTOR);
    set(ox + 25, oy + 19, ID.LAMP);
  });
  // A fan blowing on a wind turbine.
  bay((ox, oy, fy) => {
    battery(ox + 6, fy);
    set(ox + 7, fy, ID.FAN);
    set(ox + 16, fy, ID.WIND_TURBINE);
    set(ox + 17, fy, ID.LAMP);
  });
  // A door on a clock: it opens and shuts, letting sand through.
  bay((ox, oy, fy) => {
    box(ox + 9, oy + 4, ox + 21, fy - 20, ID.STONE);
    rect(ox + 10, fy - 20, ox + 20, fy - 20, ID.DOOR);
    set(ox + 4, fy - 20, ID.CLOCK);
    rect(ox + 5, fy - 20, ox + 9, fy - 20, ID.METAL);
    rect(ox + 10, oy + 8, ox + 20, oy + 18, ID.SAND);
  });
  // A laser heating a stone wall.
  bay((ox, oy, fy) => {
    battery(ox + 4, fy);
    set(ox + 5, fy, ID.LASER_EMITTER);
    rect(ox + 4, fy - 1, ox + 6, fy - 1, ID.STONE);
    rect(ox + 50, fy - 10, ox + 52, fy, ID.STONE);
  });
  // A heater melting ice, and a cooler freezing water in a glass cup.
  bay((ox, oy, fy) => {
    battery(ox + 4, fy);
    rect(ox + 5, fy - 2, ox + 12, fy, ID.HEATER);
    rect(ox + 5, fy - 8, ox + 12, fy - 3, ID.ICE);
  });
  bay((ox, oy, fy) => {
    battery(ox + 4, fy);
    rect(ox + 5, fy - 2, ox + 12, fy, ID.COOLER);
    rect(ox + 4, fy - 12, ox + 4, fy - 3, ID.GLASS);
    rect(ox + 13, fy - 12, ox + 13, fy - 3, ID.GLASS);
    rect(ox + 5, fy - 10, ox + 12, fy - 3, ID.WATER);
  });
  // A fan blowing a sand pile away.
  bay((ox, oy, fy) => {
    battery(ox + 4, fy);
    rect(ox + 5, fy - 3, ox + 5, fy, ID.FAN);
    for (let x = ox + 10; x <= ox + 24; x++) rect(x, fy - Math.round(6 - Math.abs(x - ox - 17) * 0.8), x, fy, ID.SAND);
  });
  // A dispenser pouring sand into a bin.
  bay((ox, oy, fy) => {
    rect(ox + 4, oy + 18, ox + 14, oy + 18, ID.STONE);
    battery(ox + 8, oy + 17);
    set(ox + 9, oy + 17, ID.DISPENSER);
    set(ox + 10, oy + 17, ID.SAND);
    box(ox + 4, fy - 14, ox + 20, fy, ID.GLASS);
    set(ox + 9, fy - 14, 0);
  });
  // A drain emptying a tank of water.
  bay((ox, oy, fy) => {
    box(ox + 10, oy + 14, ox + 40, fy, ID.GLASS);
    rect(ox + 11, oy + 20, ox + 39, fy - 1, ID.WATER);
    set(ox + 25, fy, ID.DRAIN);
    battery(ox + 25, fy + 1);
  });
  // An igniter setting a block of wood alight.
  bay((ox, oy, fy) => {
    battery(ox + 4, fy);
    set(ox + 5, fy, ID.IGNITER);
    rect(ox + 6, fy - 5, ox + 14, fy, ID.WOOD);
  });
  // A neutron source and a Geiger counter.
  bay((ox, oy, fy) => {
    battery(ox + 4, fy);
    set(ox + 5, fy, ID.NEUTRON_SOURCE);
    set(ox + 25, fy, ID.GEIGER);
  });
  // A pump moving the air from one tank, along a pipe, into another, whose
  // safety valve lets it out once it's high.
  bay((ox, oy, fy) => {
    box(ox + 2, fy - 16, ox + 22, fy, ID.STONE, 2);
    box(ox + 40, fy - 16, ox + 62, fy, ID.STONE, 2);
    rect(ox + 4, fy - 8, ox + 44, fy - 8, ID.PIPE);
    set(ox + 4, fy - 8, ID.PUMP);
    battery(ox + 4, fy - 7);
    set(ox + 51, fy - 16, ID.VALVE);
    set(ox + 51, fy - 15, ID.VALVE);
  });
  // A conveyor carrying sand.
  bay((ox, oy, fy) => {
    battery(ox + 4, fy);
    rect(ox + 5, fy, ox + 55, fy, ID.CONVEYOR);
    rect(ox + 8, fy - 5, ox + 14, fy - 1, ID.SAND);
  });
  // A piston shoving a row of stone.
  bay((ox, oy, fy) => {
    battery(ox + 4, fy);
    set(ox + 5, fy, ID.PISTON);
    rect(ox + 6, fy, ox + 9, fy, ID.STONE);
  });
}

export const SCENES = [
  { key: 'start', name: 'Starting area', build: startingArea },
  { key: 'wilderness', name: 'Wilderness (for humans)', build: wilderness },
  { key: 'creatures', name: 'Creatures', build: creatures, showcase: true },
  { key: 'gallery', name: 'Every element (stress test)', build: gallery, showcase: true },
  { key: 'lab', name: 'Physics lab', build: physicsLab, showcase: true },
  { key: 'machines', name: 'Machines', build: machines, showcase: true },
  { key: 'weapons', name: 'Weapons range', build: weaponsRange, showcase: true },
];

// Clear the world and build scene `key`.
export function loadScene(world, key) {
  const scene = SCENES.find((s) => s.key === key);
  if (!scene) throw new Error(`no scene ${key}`);
  world.clearAll();
  world.wallMask = 0;
  scene.build(world);
  world.recording = !scene.showcase;
}

// The scene a new game starts with.
export function loadDemoScene(world) {
  loadScene(world, 'start');
}
