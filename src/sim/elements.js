// Every element, reaction and recipe in the game is defined in this file and
// in elements-expansion.js. The simulation, the palette and the recipe book
// are all generated from these tables, so a recipe that exists here is
// guaranteed to be something the simulation can actually do (see
// test/recipes.test.js).

import { State, AMBIENT } from './constants.js';
import {
  EXPANSION_ELEMENTS, EXPANSION_REACTIONS, PARTICLE_HITS, PARTICLE_PAIRS,
} from './elements-expansion.js';

export { State, AMBIENT };
const { SOLID, POWDER, LIQUID, GAS, ENERGY } = State;

export const CATEGORIES = [
  { key: 'powder', name: 'Powders' },
  { key: 'liquid', name: 'Liquids' },
  { key: 'gas', name: 'Gases' },
  { key: 'solid', name: 'Solids' },
  { key: 'mineral', name: 'Minerals & gems' },
  { key: 'metal', name: 'Metals' },
  { key: 'life', name: 'Life' },
  { key: 'explosive', name: 'Explosives' },
  { key: 'energy', name: 'Energy' },
  { key: 'particle', name: 'Particles' },
  { key: 'nuclear', name: 'Radioactive' },
  { key: 'special', name: 'Exotic' },
];

// Element fields (all optional except key/name/sym/cat/state):
//   colors      shade variants, picked per particle
//   density     heavier things sink through lighter liquids and gases
//   temp        spawn temperature (°C)
//   conduct     heat conductivity 0..1
//   airCool     how fast it drifts to room temperature per exposed face
//   holdTemp    acts as a heat (or cold) source while it exists
//   life        [min, max] lifetime in frames, for things that burn out
//   high / low  { temp, to, chance, alt, altChance } phase changes
//   pressure    { above, to, chance } or { above, ignite: true }
//   flammable   chance per frame to catch fire when touching a flame
//   ignite      temperature at which it catches fire on its own
//   burn        what burning leaves behind (see normalize())
//   explode     air pressure released when it ignites
//   spread      how far a liquid flows sideways per frame
//   viscosity   chance a liquid refuses to flow sideways this frame
//   rise/sink   gas buoyancy (chance per frame to move up/down)
//   drift       chance per frame that a gas wanders at all (clouds hang still)
//   airDrag     how strongly air currents push it around
//   behavior    name of a custom update routine in world.js
//   alpha       how see-through a gas is drawn (0..1)
// Radiation and particles:
//   projectile  flies in a straight line on the particle layer (photon, ...)
//   speed, charge   for projectiles; charged ones curve near magnets
//   emits       [{ p, chance }] particles thrown off each frame
//   selfHeat    °C gained per frame (radioactive warmth)
//   decay       { chance, to, spawn } random decay, like a half-life
//   fission     what a neutron does when it splits this element
//   transparent / opaque / reflect   how light treats it
//   nAbsorb     chance per cell of swallowing a neutron; moderator slows them
// Other:
//   lifeEnd     { to, alt, altChance } what it becomes when its life runs out
//   produce     { el, chance } drops this element into an empty neighbour
//   grow        { into, chance, surface } spreads into these neighbours
//   high: melt(t)  metals remember what they were inside Molten Metal
export const ELEMENT_LIST = [
  { key: 'EMPTY', name: 'Empty', sym: '', cat: null, state: State.EMPTY, colors: ['#000000'] },

  // ---- starting elements -------------------------------------------------
  {
    key: 'SAND', name: 'Sand', sym: 'Sa', cat: 'powder', state: POWDER, start: true,
    colors: ['#e3c88a', '#d9bb78', '#ecd49a', '#cfae6b', '#e8cc8f'],
    density: 1.6, conduct: 0.15,
    high: { temp: 1700, to: 'MOLTEN_GLASS', chance: 0.05 },
    pressure: { above: 20, to: 'QUARTZ', chance: 0.01 },
    desc: 'Fine grains that pile up and sink through water.',
  },
  {
    key: 'WATER', name: 'Water', sym: 'Wa', cat: 'liquid', state: LIQUID, start: true,
    colors: ['#2f7fd8', '#3486e0', '#2a78cf', '#3a8de6'],
    density: 1.0, conduct: 0.3, spread: 8, transparent: true,
    high: { temp: 100, to: 'STEAM', chance: 0.2 },
    low: { temp: 0, to: 'ICE', chance: 0.1 },
    desc: 'Flows and levels out. Boils at 100 °C, freezes at 0 °C.',
  },
  {
    key: 'FIRE', name: 'Fire', sym: 'Fi', cat: 'energy', state: ENERGY, start: true,
    colors: ['#ff9a3c'], density: 0.02, temp: 800, holdTemp: true, conduct: 0.45,
    life: [35, 70], rise: 0.45, sink: 0.05, airDrag: 0.5, behavior: 'fire',
    desc: 'Rises, flickers out, and sets flammable things alight.',
  },
  {
    key: 'DIRT', name: 'Dirt', sym: 'Dt', cat: 'powder', state: POWDER, start: true,
    colors: ['#7a5234', '#6e4a2e', '#835a3a', '#664429'],
    density: 1.4, conduct: 0.12,
    high: { temp: 1200, to: 'LAVA', chance: 0.05 },
    desc: 'Loose earth. Soaks up water.',
  },

  // ---- first discoveries -------------------------------------------------
  {
    key: 'STEAM', name: 'Steam', sym: 'St', cat: 'gas', state: GAS,
    colors: ['#c9d6e3', '#b8c7d6', '#d4dfea'], alpha: 0.5, density: 0.05, temp: 110, conduct: 0.1,
    airCool: 0.002, rise: 0.6, sink: 0.05, airDrag: 0.4,
    low: { temp: 95, to: 'WATER', chance: 0.008 },
    high: { temp: 3000, to: 'PLASMA', chance: 0.1 },
    desc: 'Hot water vapour. Rises, then condenses back into water.',
    hint: 'Water can\'t stand the heat.',
  },
  {
    key: 'ICE', name: 'Ice', sym: 'Ic', cat: 'solid', state: SOLID,
    colors: ['#bfe6f5', '#a8dcf0', '#cdeef9', '#b4e1f3'], density: 0.9, temp: -15, conduct: 0.4,
    airCool: 0.0003, transparent: true,
    high: { temp: 1, to: 'WATER', chance: 0.03 },
    desc: 'Frozen water. Melts back above 0 °C.',
    hint: 'Chill Water below its freezing point.',
  },
  {
    key: 'MUD', name: 'Mud', sym: 'Mu', cat: 'liquid', state: LIQUID,
    colors: ['#5a3d27', '#533823', '#61432b', '#4d3420'], density: 1.3, conduct: 0.2,
    spread: 1, viscosity: 0.85,
    high: { temp: 150, to: 'BRICK', chance: 0.04 },
    desc: 'Thick, slow sludge that sinks under water.',
    hint: 'Dirt gets messy when it gets wet.',
  },
  {
    key: 'LAVA', name: 'Lava', sym: 'Lv', cat: 'liquid', state: LIQUID,
    colors: ['#ff5a1f', '#f24d12', '#ff7a2e', '#e84410'], density: 2.5, temp: 1100, conduct: 0.3,
    airCool: 0.0006, spread: 2, viscosity: 0.6, glow: true,
    low: { temp: 850, to: 'STONE', chance: 0.05 },
    pressure: { above: 15, to: 'GRANITE', chance: 0.01 },
    desc: 'Molten rock at about 1100 °C. Sets things on fire.',
    hint: 'Dirt melts if you get it hot enough. Really hot.',
  },
  {
    key: 'STONE', name: 'Stone', sym: 'Sn', cat: 'solid', state: SOLID,
    colors: ['#8a8d91', '#7f8286', '#94979b', '#777a7e'], density: 2.5, conduct: 0.2,
    high: { temp: 1050, to: 'LAVA', chance: 0.02 },
    pressure: { above: 25, to: 'GRAVEL', chance: 0.01 },
    desc: 'Solid rock. Good for building.',
    hint: 'Let Lava cool down on its own.',
  },
  {
    key: 'OBSIDIAN', name: 'Obsidian', sym: 'Ob', cat: 'solid', state: SOLID,
    colors: ['#2a2135', '#231c2e', '#33283f', '#1d1726'], density: 2.4, conduct: 0.15,
    high: { temp: 1300, to: 'LAVA', chance: 0.02 },
    desc: 'Volcanic glass, made when lava is quenched.',
    hint: 'Cool Lava suddenly, with something wet.',
  },
  {
    key: 'MOLTEN_GLASS', name: 'Molten Glass', sym: 'Mgl', cat: 'liquid', state: LIQUID,
    colors: ['#ffb347', '#ffa733', '#ffc063'], density: 2.3, temp: 1800, conduct: 0.2,
    airCool: 0.001, spread: 1, viscosity: 0.8, glow: true,
    low: { temp: 1300, to: 'GLASS', chance: 0.05 },
    desc: 'Glowing, syrupy glass. Pour it into shape before it sets.',
    hint: 'Sand melts at about 1700 °C.',
  },
  {
    key: 'GLASS', name: 'Glass', sym: 'Gl', cat: 'solid', state: SOLID,
    colors: ['#9fd3e6', '#b0dcec', '#94cbe0'], density: 2.5, conduct: 0.1, acidProof: true, transparent: true,
    high: { temp: 1600, to: 'MOLTEN_GLASS', chance: 0.02 },
    pressure: { above: 30, to: 'SAND', chance: 0.05 },
    desc: 'Acid can\'t eat through it. Shatters under heavy pressure.',
    hint: 'Let Molten Glass cool.',
  },
  {
    key: 'SNOW', name: 'Snow', sym: 'Sw', cat: 'powder', state: POWDER,
    colors: ['#f2f6fa', '#e6eef6', '#ffffff', '#dde7f0'], density: 0.5, temp: -8, conduct: 0.2,
    airCool: 0.0004, fallRate: 0.35, airDrag: 0.15,
    high: { temp: 1, to: 'WATER', chance: 0.02 },
    desc: 'Drifts down slowly and floats on water.',
    hint: 'Steam freezes when it touches something icy.',
  },
  {
    key: 'BRICK', name: 'Brick', sym: 'Bk', cat: 'solid', state: SOLID,
    colors: ['#a0462f', '#8f3d29', '#b04f35', '#9a4a33'], density: 2.0, conduct: 0.1,
    high: { temp: 1500, to: 'LAVA', chance: 0.02 },
    desc: 'Baked mud. Takes a lot of heat before it gives.',
    hint: 'Bake Mud.',
  },
  {
    key: 'PLANT', name: 'Plant', sym: 'Pl', cat: 'life', state: SOLID,
    colors: ['#3fa34d', '#37953f', '#4cb35a', '#2f8a3a'], density: 1.0, conduct: 0.1,
    flammable: 0.12, ignite: 250, burn: { ash: 0.2, smoke: 0.35 },
    pressure: { above: 10, to: 'OIL', chance: 0.02 },
    behavior: 'plant',
    desc: 'Grows into any water it touches.',
    hint: 'Leave Mud sitting under Water and wait.',
  },
  {
    key: 'WOOD', name: 'Wood', sym: 'Wd', cat: 'solid', state: SOLID,
    colors: ['#8a5a2b', '#7d5026', '#946233', '#6f4722'], density: 1.2, conduct: 0.08,
    flammable: 0.05, ignite: 300, burn: { ash: 0.3, smoke: 0.5, fireLife: [80, 140] },
    pressure: { above: 10, to: 'COAL', chance: 0.02 },
    desc: 'Burns slowly and leaves ash behind.',
    hint: 'A Plant that grows thick enough hardens on the inside.',
  },
  {
    key: 'SMOKE', name: 'Smoke', sym: 'Sk', cat: 'gas', state: GAS,
    colors: ['#6b6b70', '#5f5f64', '#77777c'], alpha: 0.75, density: 0.08, temp: 120, conduct: 0.05,
    airCool: 0.003, life: [120, 260], rise: 0.45, sink: 0.08, airDrag: 0.4, behavior: 'decay',
    desc: 'Drifts upward and fades away.',
    hint: 'Burn something that grew.',
  },
  {
    key: 'ASH', name: 'Ash', sym: 'As', cat: 'powder', state: POWDER,
    colors: ['#b8b4ac', '#aaa69e', '#c4c0b8', '#9f9b94'], density: 0.7, conduct: 0.1,
    fallRate: 0.6, airDrag: 0.12,
    desc: 'Light, powdery leftovers. Floats on water.',
    hint: 'What\'s left after Wood burns?',
  },
  {
    key: 'SALT_WATER', name: 'Salt Water', sym: 'Bn', cat: 'liquid', state: LIQUID,
    colors: ['#2f94b8', '#3399bd', '#2a8bad', '#3aa2c4'], density: 1.1, conduct: 0.3, spread: 8, transparent: true,
    high: { temp: 102, to: 'STEAM', chance: 0.2, alt: 'SALT', altChance: 0.35 },
    low: { temp: -18, to: 'ICE', chance: 0.1 },
    desc: 'Brine. Freezes at a lower temperature than fresh water.',
    hint: 'Soak Ash in Water.',
  },
  {
    key: 'SALT', name: 'Salt', sym: 'Sl', cat: 'powder', state: POWDER,
    colors: ['#f4f1ec', '#e9e5de', '#fbfaf7', '#e2ddd5'], density: 2.1, conduct: 0.2,
    desc: 'Dissolves in water and melts ice.',
    hint: 'Boil the Salt Water away.',
  },
  {
    key: 'COAL', name: 'Coal', sym: 'C', cat: 'powder', state: POWDER,
    colors: ['#2b2b2e', '#232326', '#333337', '#1e1e21'], density: 1.5, conduct: 0.15,
    flammable: 0.01, ignite: 450, burn: { smoke: 0.4, fireTemp: 1100, fireLife: [120, 220] },
    pressure: { above: 40, to: 'DIAMOND', chance: 0.01 },
    desc: 'Hard to light, but burns long and hot.',
    hint: 'Crush Wood under heavy pressure. A big brush helps.',
  },
  {
    key: 'DIAMOND', name: 'Diamond', sym: 'Dm', cat: 'mineral', state: SOLID,
    colors: ['#bff4ff', '#d8fbff', '#a6ecfa', '#e8feff'], density: 3.5, conduct: 1.0,
    acidProof: true, sparkle: true, transparent: true,
    pressure: { above: 100, to: 'VOID', chance: 0.005 },
    desc: 'Won\'t melt, won\'t dissolve, and conducts heat better than anything.',
    hint: 'Squeeze Coal much harder. Walls keep pressure from escaping.',
  },
  {
    key: 'METAL', name: 'Metal', sym: 'Fe', cat: 'metal', state: SOLID,
    colors: ['#8e9aa8', '#86929f', '#98a4b1', '#7f8b98'], density: 7.8, conduct: 0.9,
    conductor: true, reflect: 0.5,
    high: { temp: 1538, to: 'MOLTEN_METAL', chance: 0.05, remember: true },
    desc: 'Iron. Conducts heat and electricity. Melts at 1538 °C.',
    hint: 'Smelt it: mix Coal into Lava.',
  },
  {
    key: 'MOLTEN_METAL', name: 'Molten Metal', sym: 'Mt', cat: 'liquid', state: LIQUID,
    colors: ['#ffcf6b', '#ffc04d', '#ffdb85'], density: 7.0, temp: 1700, conduct: 0.6,
    airCool: 0.0008, spread: 3, viscosity: 0.3, glow: true,
    low: { temp: 1450, to: 'METAL', chance: 0.05, restore: true },
    desc: 'Molten metal. It remembers which metal it was, and sets back into it as it cools.',
    hint: 'Metal melts at 1538 °C.',
  },
  {
    key: 'RUST', name: 'Rust', sym: 'Rs', cat: 'powder', state: POWDER,
    colors: ['#9c4a1e', '#8a4019', '#aa5626', '#7f3a16'], density: 2.0, conduct: 0.2,
    high: { temp: 1538, to: 'MOLTEN_METAL', chance: 0.02, remember: 'METAL' },
    desc: 'Crumbly iron oxide.',
    hint: 'Leave Metal sitting in Water.',
  },
  {
    key: 'OIL', name: 'Oil', sym: 'Oi', cat: 'liquid', state: LIQUID,
    colors: ['#4a3a1c', '#54421f', '#3f3118'], density: 0.8, conduct: 0.1, spread: 3, viscosity: 0.2,
    flammable: 0.08, ignite: 400, burn: { smoke: 0.6, fireLife: [60, 120] },
    high: { temp: 350, to: 'PROPANE', chance: 0.05 },
    desc: 'Floats on water and burns readily. Heated without a flame, it cracks into propane.',
    hint: 'Compress Plants.',
  },
  {
    key: 'METHANE', name: 'Methane', sym: 'Me', cat: 'gas', state: GAS,
    colors: ['#9fc2a0', '#93b694'], alpha: 0.3, density: 0.04, conduct: 0.05, rise: 0.55, sink: 0.05,
    airDrag: 0.4, flammable: 1, ignite: 540, burn: { fireTemp: 1000, fireLife: [10, 25] },
    explode: 3,
    desc: 'Swamp gas. Pops when lit.',
    hint: 'Plants rotting in Mud give off gas.',
  },
  {
    key: 'GUNPOWDER', name: 'Gunpowder', sym: 'Gp', cat: 'explosive', state: POWDER,
    colors: ['#4a4a52', '#3f3f47', '#56565e', '#5d5048'], density: 1.3, conduct: 0.2,
    flammable: 0.9, ignite: 250, burn: { smoke: 0.5, fireTemp: 1300, fireLife: [20, 40] },
    explode: 8,
    desc: 'Explodes when it touches fire or a spark.',
    hint: 'Mix Coal with Salt.',
  },
  {
    key: 'BATTERY', name: 'Battery', sym: 'Bt', cat: 'solid', state: SOLID,
    colors: ['#3b4a3a', '#2f3d2e', '#46573f'], density: 3.0, conduct: 0.2, behavior: 'battery',
    desc: 'Sends a steady stream of sparks into touching metal.',
    hint: 'Metal soaking in Salt Water holds a charge.',
  },
  {
    key: 'SPARK', name: 'Spark', sym: 'Sp', cat: 'energy', state: ENERGY, fixed: true,
    colors: ['#fff7a8', '#ffe96b'], life: [4, 4], behavior: 'spark',
    desc: 'Electricity. Runs along metal. Paint it onto metal or into the air.',
    hint: 'Touch a Battery to Metal.',
  },
  {
    key: 'HYDROGEN', name: 'Hydrogen', sym: 'H', cat: 'gas', state: GAS,
    colors: ['#d6e9ff', '#c9e1ff'], alpha: 0.22, density: 0.01, conduct: 0.2, rise: 0.8, sink: 0.03,
    airDrag: 0.5, flammable: 1, ignite: 500,
    pressure: { above: 80, to: 'STAR', chance: 0.002 },
    burn: { to: 'STEAM', toChance: 0.5, fireTemp: 1500, fireLife: [8, 18] }, explode: 4,
    desc: 'The lightest gas. Burns explosively into steam.',
    hint: 'Run electricity through Water.',
  },
  {
    key: 'ACID', name: 'Acid', sym: 'Ac', cat: 'liquid', state: LIQUID,
    colors: ['#8be04e', '#7fd443', '#96ea59'], density: 1.05, conduct: 0.3, spread: 4,
    acidProof: true, transparent: true, behavior: 'acid',
    desc: 'Eats through almost everything except glass and diamond.',
    hint: 'Hydrogen reacts with Salt.',
  },
  {
    key: 'CLOUD', name: 'Cloud', sym: 'Cl', cat: 'gas', state: GAS,
    colors: ['#dfe4ea', '#d2d8df', '#e9edf1'], alpha: 0.85, density: 0.06, temp: 10, conduct: 0.1,
    airCool: 0.0005, rise: 0.06, sink: 0.05, airDrag: 0.3, drift: 0.12, behavior: 'cloud',
    desc: 'Hangs in the air and rains. Snows when it is below freezing.',
    hint: 'Steam needs Smoke particles to condense on.',
  },
  {
    key: 'LIGHTNING', name: 'Lightning', sym: 'Lt', cat: 'energy', state: ENERGY, fixed: true,
    colors: ['#f4f0ff', '#dcd4ff'], temp: 8000, holdTemp: true, conduct: 0.3,
    life: [150, 240], behavior: 'lightning',
    desc: 'A bolt that strikes downward, melting sand and sparking metal.',
    hint: 'Put a Spark into a Cloud.',
  },
  {
    key: 'PLASMA', name: 'Plasma', sym: 'Pm', cat: 'energy', state: ENERGY,
    colors: ['#e07bff'], density: 0.015, temp: 5000, holdTemp: true, conduct: 0.5,
    life: [25, 55], rise: 0.6, sink: 0.05, airDrag: 0.5, behavior: 'plasma',
    desc: 'Superheated gas at 5000 °C. Melts nearly anything.',
    hint: 'Superheat Steam past 3000 °C.',
  },
  {
    key: 'THERMITE', name: 'Thermite', sym: 'Tr', cat: 'explosive', state: POWDER,
    colors: ['#7b4a3a', '#6d4033', '#865243', '#5e5a58'], density: 2.0, conduct: 0.2,
    flammable: 0.05, ignite: 900, burn: { to: 'MOLTEN_METAL', toChance: 0.8, temp: 3000, fireTemp: 2500 },
    desc: 'Burns at 3000 °C into molten iron.',
    hint: 'Mix Rust with Gunpowder.',
  },
  {
    key: 'NITRO', name: 'Nitro', sym: 'Ni', cat: 'explosive', state: LIQUID,
    colors: ['#e6dc5a', '#dcd24f', '#efe56a'], density: 1.2, conduct: 0.2, spread: 4,
    flammable: 1, ignite: 200, burn: { fireTemp: 2500, fireLife: [15, 30] }, explode: 30,
    pressure: { above: 10, ignite: true, chance: 0.5 },
    desc: 'Violently explosive. Even a pressure wave sets it off.',
    hint: 'Treat Oil with Acid.',
  },
  {
    key: 'CRYO', name: 'Cryo', sym: 'Cr', cat: 'liquid', state: LIQUID,
    colors: ['#bdf3ff', '#a8ecfb', '#cff7ff'], density: 0.8, temp: -196, holdTemp: true,
    conduct: 0.5, spread: 5, life: [400, 700], behavior: 'decay', lifeEnd: { to: 'NITROGEN' },
    transparent: true,
    desc: 'Liquid nitrogen at −196 °C. Freezes what it touches, then boils away.',
    hint: 'Salt makes Snow extremely cold.',
  },
  {
    key: 'CLONE', name: 'Clone', sym: 'Cn', cat: 'special', state: SOLID,
    colors: ['#d9c23a', '#cdb52f', '#e2cb45'], conduct: 0, acidProof: true, behavior: 'clone',
    desc: 'Copies the first element that touches it, forever.',
    hint: 'Blast a Diamond with Plasma.',
  },
  {
    key: 'VOID', name: 'Void', sym: 'Vo', cat: 'special', state: SOLID,
    colors: ['#120a1c', '#1a0f28', '#0d0715'], conduct: 0, acidProof: true, behavior: 'void', indestructible: true,
    desc: 'Deletes anything it touches and pulls air in.',
    hint: 'Compress a Diamond until it collapses.',
  },

  ...EXPANSION_ELEMENTS,

  // ---- always available ---------------------------------------------------
  {
    key: 'WALL', name: 'Wall', sym: 'Wl', cat: null, state: SOLID, always: true,
    colors: ['#565d6b', '#4f5664', '#5d6472'], conduct: 0, acidProof: true, indestructible: true,
    nAbsorb: 1,
    desc: 'Indestructible and airtight. Use it to build containers.',
  },
];

// Contact reactions: when `a` touches `b`, each has a chance per frame to
// turn into aTo / bTo. null means "stays the same", 'EMPTY' means "is used up".
// keepA / keepB keep the old temperature instead of the new element's own.
export const REACTIONS = [
  { a: 'DIRT', b: 'WATER', chance: 0.04, aTo: 'MUD', bTo: 'EMPTY' },
  { a: 'FIRE', b: 'WATER', chance: 0.3, aTo: 'EMPTY', bTo: 'STEAM' },
  { a: 'LAVA', b: 'WATER', chance: 0.25, aTo: 'OBSIDIAN', bTo: 'STEAM', keepA: true },
  { a: 'LAVA', b: 'ICE', chance: 0.25, aTo: 'OBSIDIAN', bTo: 'WATER', keepA: true },
  { a: 'STEAM', b: 'ICE', chance: 0.05, aTo: 'SNOW', bTo: null },
  { a: 'MUD', b: 'WATER', chance: 0.00008, aTo: 'PLANT', bTo: null },
  { a: 'PLANT', b: 'MUD', chance: 0.0006, aTo: 'METHANE', bTo: null },
  { a: 'ASH', b: 'WATER', chance: 0.01, aTo: 'EMPTY', bTo: 'SALT_WATER' },
  { a: 'SALT', b: 'WATER', chance: 0.02, aTo: 'EMPTY', bTo: 'SALT_WATER' },
  { a: 'SALT', b: 'ICE', chance: 0.02, aTo: 'SALT_WATER', bTo: 'WATER' },
  { a: 'SALT', b: 'SNOW', chance: 0.03, aTo: 'EMPTY', bTo: 'CRYO' },
  { a: 'LAVA', b: 'COAL', chance: 0.05, aTo: 'METAL', bTo: 'SMOKE' },
  { a: 'METAL', b: 'WATER', chance: 0.0005, aTo: 'RUST', bTo: null },
  { a: 'METAL', b: 'SALT_WATER', chance: 0.01, aTo: 'BATTERY', bTo: 'EMPTY' },
  { a: 'STEAM', b: 'SMOKE', chance: 0.05, aTo: 'CLOUD', bTo: 'CLOUD' },
  { a: 'SALT', b: 'HYDROGEN', chance: 0.05, aTo: 'ACID', bTo: 'EMPTY' },
  { a: 'COAL', b: 'SALT', chance: 0.01, aTo: 'GUNPOWDER', bTo: 'GUNPOWDER' },
  { a: 'RUST', b: 'GUNPOWDER', chance: 0.02, aTo: 'THERMITE', bTo: 'THERMITE' },
  { a: 'OIL', b: 'ACID', chance: 0.05, aTo: 'NITRO', bTo: 'EMPTY' },
  { a: 'DIAMOND', b: 'PLASMA', chance: 0.004, aTo: 'CLONE', bTo: 'EMPTY' },
  { a: 'WATER', b: 'SPARK', chance: 0.15, aTo: 'HYDROGEN', aAlt: 'OXYGEN', aAltChance: 0.34, bTo: null },
  { a: 'CLOUD', b: 'SPARK', chance: 0.5, aTo: 'LIGHTNING', bTo: null },
  { a: 'SAND', b: 'LIGHTNING', chance: 0.5, aTo: 'GLASS', bTo: null },
  ...EXPANSION_REACTIONS,
];

// Rules that come from custom behaviours rather than the tables above. They
// are listed here so the recipe book can show them.
export const SPECIAL_RULES = [
  { id: 'plant-wood', kind: 'time', inputs: ['PLANT'], output: 'WOOD' },
  { id: 'battery-spark', kind: 'contact', inputs: ['BATTERY', 'METAL'], output: 'SPARK' },
  { id: 'cloud-snow', kind: 'cool', inputs: ['CLOUD'], output: 'SNOW' },
  { id: 'neutron-proton', kind: 'time', inputs: ['NEUTRON'], output: 'PROTON' },
  { id: 'neutron-electron', kind: 'time', inputs: ['NEUTRON'], output: 'ELECTRON' },
  { id: 'neutron-neutrino', kind: 'time', inputs: ['NEUTRON'], output: 'NEUTRINO' },
  { id: 'firework-glitter', kind: 'burn', inputs: ['FIREWORK'], output: 'GLITTER' },
];

// ---------------------------------------------------------------------------
// Compile the tables above into id-indexed arrays for the simulation.

export const ID = {};
ELEMENT_LIST.forEach((e, i) => {
  if (e.key in ID) throw new Error(`Duplicate element "${e.key}"`);
  ID[e.key] = i;
});
export const NUM = ELEMENT_LIST.length;
if (NUM > 255) throw new Error('Element ids must fit in a byte');

const id = (key) => {
  if (key === null || key === undefined) return -1;
  if (!(key in ID)) throw new Error(`Unknown element "${key}"`);
  return ID[key];
};

// How each kind of flying particle behaves when it meets matter.
export const PMODE = { photon: 1, electron: 2, proton: 3, neutron: 4, positron: 5, neutrino: 6 };

// RULES: every way an element can be produced, for discovery tracking and
// the recipe book. { kind, inputs: [ids], output: id }
export const RULES = [];
function addRule(kind, inputs, output) {
  if (output <= 0 || inputs.includes(output)) return -1;
  const existing = RULES.findIndex(
    (r) => r.kind === kind && r.output === output && r.inputs.join() === inputs.join());
  if (existing >= 0) return existing;
  RULES.push({ kind, inputs, output });
  return RULES.length - 1;
}

function normalize(e, i) {
  const d = {
    id: i,
    key: e.key,
    name: e.name,
    sym: e.sym,
    cat: e.cat,
    state: e.state,
    start: !!e.start,
    always: !!e.always,
    colors: e.colors,
    alpha: e.alpha ?? (e.state === GAS ? 0.5 : 1),
    density: e.density ?? 1,
    temp: e.temp ?? AMBIENT,
    conduct: e.conduct ?? 0.1,
    airCool: e.airCool ?? 0.001,
    holdTemp: !!e.holdTemp,
    lifeMin: e.life ? e.life[0] : 0,
    lifeMax: e.life ? e.life[1] : 0,
    high: null,
    low: null,
    pressure: null,
    flammable: e.flammable ?? 0,
    ignite: e.ignite ?? Infinity,
    igniteChance: 0,
    burn: null,
    explode: e.explode ?? 0,
    spread: e.spread ?? 3,
    viscosity: e.viscosity ?? 0,
    rise: e.rise ?? 0.5,
    sink: e.sink ?? 0.05,
    drift: e.drift ?? 1,
    airDrag: e.airDrag ?? (e.state === LIQUID ? 0.06 : 0.05),
    drag: e.drag ?? (e.state === GAS || e.state === ENERGY ? 0.3 : 0.025),
    fallRate: e.fallRate ?? 1,
    maxSpeed: e.maxSpeed ?? 5,
    conductor: !!e.conductor,
    acidProof: !!e.acidProof,
    indestructible: !!e.indestructible,
    fixed: !!e.fixed,
    glow: !!e.glow,
    glowAmount: e.glowAmount ?? 0,
    sparkle: !!e.sparkle,
    behavior: e.behavior ?? null,
    reactive: false,
    // radiation and particles
    projectile: !!e.projectile,
    pmode: e.projectile ? PMODE[e.projectile] : 0,
    speed: e.speed ?? 0,
    charge: e.charge ?? 0,
    emits: null,
    selfHeat: e.selfHeat ?? 0,
    decay: null,
    fission: null,
    transparent: !!e.transparent,
    opaque: !!e.opaque,
    reflect: e.reflect ?? 0,
    nAbsorb: e.nAbsorb ?? 0,
    moderator: !!e.moderator,
    detector: !!e.detector,
    hotEmit: e.hotEmit ?? null,
    sparkHeat: e.sparkHeat ?? 1,
    // everything else
    lifeEnd: null,
    produce: null,
    grow: null,
    sticky: !!e.sticky,
    crush: !!e.crush,
    permeable: !!e.permeable,
    desc: e.desc ?? '',
    hint: e.hint ?? '',
  };
  // Liquids, gases and loose energy can be pushed aside by heavier things.
  d.displaceable = !d.projectile
    && (e.state === LIQUID || e.state === GAS || (e.state === ENERGY && !d.fixed));
  if (d.flammable > 0) d.igniteChance = Math.min(1, Math.max(0.02, d.flammable * 4));
  if (d.explode > 0) d.igniteChance = Math.max(d.igniteChance, 0.5);
  return d;
}

export const DEFS = ELEMENT_LIST.map(normalize);

function compileTransition(src, key, kind) {
  if (!src) return null;
  const t = {
    temp: src.temp ?? 0,
    above: src.above ?? 0,
    to: src.to ? id(src.to) : -1,
    chance: src.chance ?? 1,
    alt: src.alt ? id(src.alt) : -1,
    altChance: src.altChance ?? 0,
    ignite: !!src.ignite,
    // remember: the new particle keeps note of what it was (Molten Metal)
    remember: src.remember === true ? ID[key] : src.remember ? id(src.remember) : 0,
    // restore: cool back into whatever was remembered
    restore: !!src.restore,
    rule: -1,
    altRule: -1,
  };
  if (t.to >= 0) t.rule = addRule(kind, [ID[key]], t.to);
  if (t.alt >= 0) t.altRule = addRule(kind, [ID[key]], t.alt);
  return t;
}

// An outcome with an optional alternative: { to, alt, altChance } -> ids + rules.
function compileOutcome(src, inputs, kind) {
  if (!src) return null;
  const o = {
    to: id(src.to),
    alt: src.alt ? id(src.alt) : -1,
    altChance: src.altChance ?? 0,
    spawn: src.spawn ? id(src.spawn) : -1,
    chance: src.chance ?? 1,
    rule: -1,
    altRule: -1,
    spawnRule: -1,
  };
  if (o.to > 0) o.rule = addRule(kind, inputs, o.to);
  if (o.alt > 0) o.altRule = addRule(kind, inputs, o.alt);
  if (o.spawn > 0) o.spawnRule = addRule(kind, inputs, o.spawn);
  return o;
}

const emitList = (keys, inputs, kind) => (keys ?? []).map((k) => ({
  id: id(k), rule: addRule(kind, inputs, id(k)),
}));

ELEMENT_LIST.forEach((e, i) => {
  const d = DEFS[i];
  d.high = compileTransition(e.high, e.key, 'heat');
  d.low = compileTransition(e.low, e.key, 'cool');
  d.pressure = compileTransition(e.pressure, e.key, 'pressure');
  if (d.flammable > 0 || d.explode > 0) {
    const b = e.burn ?? {};
    d.burn = {
      to: b.to ? id(b.to) : ID.FIRE,
      toChance: b.toChance ?? 1,
      temp: b.temp ?? 0,
      ash: b.ash ?? 0,
      smoke: b.smoke ?? 0,
      fireTemp: b.fireTemp ?? 900,
      fireLifeMin: b.fireLife ? b.fireLife[0] : 40,
      fireLifeMax: b.fireLife ? b.fireLife[1] : 80,
      flare: !!b.flare,
      launch: !!b.launch,
      toRule: -1,
      ashRule: -1,
      smokeRule: -1,
    };
    if (d.burn.to !== ID.FIRE) d.burn.toRule = addRule('burn', [i], d.burn.to);
    if (d.burn.ash > 0) d.burn.ashRule = addRule('burn', [i], ID.ASH);
    if (d.burn.smoke > 0) d.burn.smokeRule = addRule('burn', [i], ID.SMOKE);
  }
  if (e.emits) d.emits = e.emits.map((m) => ({ id: id(m.p), chance: m.chance }));
  if (e.decay) d.decay = compileOutcome(e.decay, [i], 'time');
  if (e.lifeEnd) d.lifeEnd = compileOutcome(e.lifeEnd, [i], 'time');
  if (e.produce) {
    d.produce = { id: id(e.produce.el), chance: e.produce.chance, rule: addRule('time', [i], id(e.produce.el)) };
  }
  if (e.grow) {
    const into = new Uint8Array(NUM);
    for (const k of e.grow.into) into[id(k)] = 1;
    d.grow = { into, chance: e.grow.chance, surface: !!e.grow.surface };
  }
});

// One flag so the simulation can skip radioactivity checks for most elements.
for (const d of DEFS) {
  d.active = d.selfHeat !== 0 || d.emits !== null || d.hotEmit !== null
    || d.decay !== null || d.produce !== null;
}

// Fission settings need the neutron's id, so they are compiled after DEFS.
ELEMENT_LIST.forEach((e, i) => {
  if (!e.fission) return;
  const f = e.fission;
  const inputs = [i, ID.NEUTRON];
  DEFS[i].fission = {
    neutrons: f.neutrons,
    heat: f.heat ?? 0,
    blast: f.blast ?? 0,
    photons: f.photons ?? 0,
    products: (f.products ?? []).map(([k, w]) => ({ id: id(k), w, rule: addRule('contact', inputs, id(k)) })),
    captureTo: f.capture ? id(f.capture[0]) : -1,
    captureChance: f.capture ? f.capture[1] : 0,
    captureRule: f.capture ? addRule('contact', inputs, id(f.capture[0])) : -1,
  };
});

// Reaction lookup: REACT[self * NUM + other] -> what happens to self/other.
export const REACT = new Array(NUM * NUM).fill(null);
for (const r of REACTIONS) {
  const a = id(r.a), b = id(r.b);
  const inputs = [a, b];
  const side = (to, alt, altChance) => {
    const o = { to: id(to), alt: alt ? id(alt) : -1, altChance: altChance ?? 0, rule: -1, altRule: -1 };
    if (o.to >= 0) o.rule = addRule('contact', inputs, o.to);
    if (o.alt >= 0) o.altRule = addRule('contact', inputs, o.alt);
    return o;
  };
  const sa = side(r.aTo, r.aAlt, r.aAltChance);
  const sb = side(r.bTo, r.bAlt, r.bAltChance);
  const shared = {
    chance: r.chance,
    minTemp: r.minTemp ?? -Infinity,
    explode: r.explode ?? 0,
    heat: r.heat ?? 0,
    spawn: r.spawn ? id(r.spawn) : -1,
    spawnRule: r.spawn ? addRule('contact', inputs, id(r.spawn)) : -1,
    emit: emitList(r.emit, inputs, 'contact'),
  };
  REACT[a * NUM + b] = { ...shared, self: sa, other: sb, keepSelf: !!r.keepA, keepOther: !!r.keepB };
  REACT[b * NUM + a] = { ...shared, self: sb, other: sa, keepSelf: !!r.keepB, keepOther: !!r.keepA };
  DEFS[a].reactive = true;
  DEFS[b].reactive = true;
}

// Particle hits: HIT[particle * NUM + target].
export const HIT = new Array(NUM * NUM).fill(null);
for (const h of PARTICLE_HITS) {
  const p = id(h.p), t = id(h.t);
  if (!DEFS[p].projectile) throw new Error(`${h.p} is not a particle`);
  const inputs = [t, p];
  HIT[p * NUM + t] = {
    chance: h.chance,
    fission: !!h.fission,
    tTo: h.tTo ? id(h.tTo) : -1,
    tRule: h.tTo ? addRule('contact', inputs, id(h.tTo)) : -1,
    spawn: h.spawn ? id(h.spawn) : -1,
    spawnRule: h.spawn ? addRule('contact', inputs, id(h.spawn)) : -1,
    pTo: h.pTo ? id(h.pTo) : -1,
    pRule: h.pTo ? addRule('contact', inputs, id(h.pTo)) : -1,
    emit: emitList(h.emit, inputs, 'contact'),
    copy: !!h.copy,
    keep: !!h.keep,
    heat: h.heat ?? 0,
    explode: h.explode ?? 0,
    action: h.action ?? null,
    recover: h.recover ?? 0,
  };
}

// Particle pairs: PAIR[a * NUM + b].
export const PAIR = new Array(NUM * NUM).fill(null);
for (const r of PARTICLE_PAIRS) {
  const a = id(r.a), b = id(r.b);
  const entry = {
    chance: r.chance,
    gridTo: r.gridTo ? id(r.gridTo) : -1,
    gridRule: r.gridTo ? addRule('contact', [a, b], id(r.gridTo)) : -1,
    emit: emitList(r.emit, [a, b], 'contact'),
  };
  PAIR[a * NUM + b] = entry;
  PAIR[b * NUM + a] = entry;
}

export const SPECIAL = {};
for (const s of SPECIAL_RULES) {
  SPECIAL[s.id] = addRule(s.kind, s.inputs.map(id), id(s.output));
}

// Elements the player collects, in table order (excludes EMPTY and WALL).
export const COLLECTIBLE = DEFS.filter((d) => d.id !== 0 && !d.always);
COLLECTIBLE.forEach((d, n) => { d.number = n + 1; });
export const STARTERS = COLLECTIBLE.filter((d) => d.start).map((d) => d.key);

const KIND_LABEL = {
  heat: (a) => `${a} + Heat`,
  cool: (a) => `${a} + Cold`,
  pressure: (a) => `${a} + Pressure`,
  burn: (a) => `${a} + Fire`,
  time: (a) => `${a} + Time`,
  contact: (a, b) => `${a} + ${b}`,
};

export function ruleLabel(rule) {
  const names = rule.inputs.map((i) => DEFS[i].name);
  return KIND_LABEL[rule.kind](...names);
}

// All the ways to make an element, as rule indices.
export function rulesFor(elementId) {
  const out = [];
  RULES.forEach((r, i) => { if (r.output === elementId) out.push(i); });
  return out;
}

// Rough half-life in seconds for something that decays with chance p per frame.
export function halfLife(p) {
  return Math.log(2) / (p * 60);
}
