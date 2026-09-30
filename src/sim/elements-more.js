// Filling the gaps: the few elements the earlier tables were missing, and
// the reactions you'd expect but that didn't happen yet. Acids fizz on
// metals and chalk, alkali metals burn in their flame-test colours (see their
// entries), ores are smelted the way they really are, and things that were
// dead ends now lead somewhere. Field meanings are documented at the top of
// elements.js.

import { State } from './constants.js';

const { SOLID, POWDER, LIQUID, ENERGY } = State;

export const MORE_ELEMENTS = [
  // ---- particles ----------------------------------------------------------------
  {
    key: 'ANTINEUTRON', name: 'Antineutron', sym: 'n̄', cat: 'particle', state: ENERGY, projectile: 'antineutron',
    colors: ['#ffb0d8'], speed: 2, life: [80, 120],
    desc: "The neutron's antimatter twin. It slips through matter like a neutron until it meets a nucleus, then both vanish in a burst of gamma rays.",
    hint: 'Collide Protons head-on, hard.',
  },
  // ---- ores ---------------------------------------------------------------------
  {
    key: 'CHALCOPYRITE', name: 'Chalcopyrite', sym: 'Cpy', cat: 'mineral', state: SOLID, strength: 40,
    colors: ['#c8a83a', '#b89a30', '#d4b446', '#5a8ab0'], density: 4.2, conduct: 0.3, reflect: 0.3,
    high: { temp: 900, to: 'COPPER', alt: 'SULFUR_DIOXIDE', altChance: 0.3, chance: 0.03 },
    desc: 'Brassy copper-iron sulfide with a rainbow tarnish, the ore most of the world\'s copper comes from. Roasting it drives the sulfur off as choking gas and leaves the copper.',
    hint: 'Sulfur mixing into Lava.',
  },
  {
    key: 'WOLFRAMITE', name: 'Wolframite', sym: 'Wfm', cat: 'mineral', state: SOLID, strength: 60,
    colors: ['#2e2a28', '#3a3532', '#26221f', '#4a4540'], density: 7.3, conduct: 0.2,
    desc: 'Heavy black tungsten ore. Tin smelters called it "wolf\'s froth" because it ate up their tin like a wolf, which is why tungsten\'s symbol is W.',
    hint: 'Hot Steam seeping through Quartz veins.',
  },

  // ---- chemistry ----------------------------------------------------------------
  {
    key: 'ANHYDROUS_COPPER_SULFATE', name: 'White Copper Sulfate', sym: 'wCuS', cat: 'chemical', state: POWDER,
    colors: ['#f0f0ec', '#e6e6e0', '#f8f8f4'], density: 3.6,
    desc: 'Copper sulfate with its water baked out, and its blue gone with it. A drop of water turns it blue again, and warm: the classic school test for water.',
    hint: 'Bake blue Copper Sulfate.',
  },
  {
    key: 'LIQUID_METHANE', name: 'Liquid Methane', sym: 'LNG', cat: 'liquid', state: LIQUID,
    colors: ['#c8dcc8', '#bcd0bc'], density: 0.42, temp: -165, airCool: 0.0004, spread: 6, transparent: true,
    flammable: 0.3, ignite: 540, burn: { fireTemp: 1000, fireLife: [20, 40] },
    high: { temp: -160, to: 'METHANE', chance: 0.05 },
    desc: 'Methane chilled below −162 °C: the LNG that tankers carry across oceans. Saturn\'s moon Titan has whole lakes and rivers of it.',
    hint: 'Chill Methane below −162 °C.',
  },
  {
    key: 'HEAVY_ICE', name: 'Heavy Ice', sym: 'DIc', cat: 'nuclear', state: POWDER,
    colors: ['#9ab8e8', '#8aacdc', '#a8c4f0'], density: 1.1, temp: -5, airCool: 0.0004, transparent: true,
    high: { temp: 4, to: 'HEAVY_WATER', chance: 0.03 },
    desc: 'Frozen heavy water. It melts at 3.8 °C rather than 0 °C, and unlike ordinary ice it\'s heavier than water, so it sinks.',
    hint: 'Chill Heavy Water just below 4 °C.',
  },

  // ---- the living world -----------------------------------------------------------
  {
    key: 'SAWDUST', name: 'Sawdust', sym: 'Swd', cat: 'powder', state: POWDER,
    colors: ['#d8b078', '#cca46c', '#e4bc84'], density: 0.3, fallRate: 0.5, airDrag: 0.15,
    flammable: 0.3, ignite: 250, burn: { ash: 0.4, smoke: 0.3, fireLife: [10, 20] },
    pressure: { above: 15, to: 'WOOD', chance: 0.02 },
    desc: 'Fine crumbs of wood. Squeezed hard enough it packs back into a solid board, the way chipboard is made.',
    hint: 'What Termites leave behind when they eat Wood.',
  },
  {
    key: 'TUN', name: 'Tun', sym: 'Tun', cat: 'creature', state: POWDER,
    colors: ['#c8b890', '#bcac84', '#d4c49c'], density: 1.1,
    desc: 'A tardigrade curled up into a dried barrel with its body all but stopped. Tuns have survived decades on a shelf, and open space; add water and they wake up.',
    hint: 'Freeze a Tardigrade.',
  },
  {
    key: 'MEAD', name: 'Mead', sym: 'Med', cat: 'food', state: LIQUID,
    colors: ['#e8b840', '#dcac34', '#f4c44c'], density: 1.0, spread: 6, wet: true,
    high: { temp: 80, to: 'ALCOHOL', alt: 'STEAM', altChance: 0.5, chance: 0.02 },
    desc: 'Honey wine, perhaps the oldest alcoholic drink of all: traces of it turn up in 9000-year-old pottery. Boil it and the alcohol comes off first.',
    hint: 'Let Yeast loose in Honey.',
  },
  {
    key: 'DENIM', name: 'Denim', sym: 'Dnm', cat: 'material', state: SOLID, strength: 10,
    colors: ['#2a4a8a', '#34549a', '#243f78', '#4a6aaa'], density: 0.9,
    flammable: 0.2, ignite: 250, burn: { ash: 0.3, smoke: 0.4 },
    desc: 'Tough cotton twill dyed with indigo. Only the lengthwise threads take the dye, which is why jeans are blue outside and pale inside.',
    hint: 'Dye Cloth with Indigo.',
  },
];

export const MORE_REACTIONS = [
  // Acids eat reactive metals, giving off hydrogen...
  { a: 'METAL', b: 'ACID', chance: 0.03, aTo: 'EMPTY', bTo: 'HYDROGEN' },
  { a: 'MAGNESIUM', b: 'ACID', chance: 0.1, aTo: 'EMPTY', bTo: 'HYDROGEN', heat: 100 },
  { a: 'ALUMINUM', b: 'ACID', chance: 0.04, aTo: 'EMPTY', bTo: 'HYDROGEN', heat: 50 },
  { a: 'SODIUM', b: 'ACID', chance: 0.2, aTo: 'SALT', bTo: 'HYDROGEN', explode: 2, heat: 300 },
  { a: 'BARIUM', b: 'SULFURIC_ACID', chance: 0.05, aTo: 'BARITE', bTo: 'EMPTY', heat: 60 },
  // ...fizz on anything made of chalk...
  { a: 'CHALK', b: 'ACID', chance: 0.05, aTo: 'CARBON_DIOXIDE', bTo: 'EMPTY' },
  { a: 'SEASHELL', b: 'ACID', chance: 0.05, aTo: 'CARBON_DIOXIDE', bTo: 'EMPTY' },
  { a: 'BAKING_SODA', b: 'ACID', chance: 0.3, aTo: 'CARBON_DIOXIDE', bTo: 'SALT_WATER' },
  { a: 'WASHING_SODA', b: 'ACID', chance: 0.2, aTo: 'CARBON_DIOXIDE', bTo: 'SALT_WATER' },
  { a: 'ACID', b: 'FOSSIL', chance: 0.02, aTo: 'CARBON_DIOXIDE', bTo: null },
  { a: 'ACID_RAIN', b: 'LIMESTONE', chance: 0.02, aTo: 'WATER', bTo: 'CARBON_DIOXIDE' },
  { a: 'VINEGAR', b: 'LIMESTONE', chance: 0.02, aTo: 'EMPTY', bTo: 'CARBON_DIOXIDE' },
  { a: 'VINEGAR', b: 'CHALK', chance: 0.05, aTo: 'EMPTY', bTo: 'CARBON_DIOXIDE' },
  { a: 'VINEGAR', b: 'SEASHELL', chance: 0.03, aTo: 'EMPTY', bTo: 'CARBON_DIOXIDE' },
  { a: 'VINEGAR', b: 'MARBLE', chance: 0.01, aTo: 'EMPTY', bTo: 'CARBON_DIOXIDE' },
  // Cleopatra is said to have dissolved a pearl in vinegar to win a bet.
  { a: 'VINEGAR', b: 'PEARL', chance: 0.02, aTo: 'EMPTY', bTo: 'CARBON_DIOXIDE' },
  { a: 'LEMON', b: 'BAKING_SODA', chance: 0.2, aTo: 'EMPTY', bTo: 'CARBON_DIOXIDE' },
  // ...and neutralise bases.
  { a: 'SLAKED_LIME', b: 'ACID', chance: 0.1, aTo: 'EMPTY', bTo: 'WATER', heat: 40 },
  { a: 'VINEGAR', b: 'LYE', chance: 0.1, aTo: 'SODIUM_ACETATE', bTo: 'EMPTY', heat: 30 },
  { a: 'LEMON', b: 'MILK', chance: 0.05, aTo: 'EMPTY', bTo: 'CURDS' },
  { a: 'CHLORINE', b: 'WATER', chance: 0.02, aTo: 'EMPTY', bTo: 'ACID' },
  // Acids that pick things apart.
  { a: 'ULTRAMARINE', b: 'ACID', chance: 0.05, aTo: 'HYDROGEN_SULFIDE', bTo: 'EMPTY' },
  { a: 'TURQUOISE', b: 'ACID', chance: 0.03, aTo: 'VERDIGRIS', bTo: 'EMPTY' },
  { a: 'CRYSTAL_GARDEN', b: 'ACID', chance: 0.03, aTo: 'SILICA_GEL', bTo: 'EMPTY' },
  { a: 'NEODYMIUM_MAGNET', b: 'ACID', chance: 0.03, aTo: 'NEODYMIUM', bTo: 'EMPTY' },
  { a: 'ACETYLENE', b: 'ACID', chance: 0.02, aTo: 'PLASTIC', bTo: 'EMPTY' },

  // Lye and soda.
  { a: 'LYE', b: 'ALUMINUM', chance: 0.03, aTo: null, bTo: 'EMPTY', spawn: 'HYDROGEN', heat: 60 },
  { a: 'LYE', b: 'BUTTER', chance: 0.03, aTo: 'SOAP', bTo: 'EMPTY' },
  { a: 'PRUSSIAN_BLUE', b: 'LYE', chance: 0.05, aTo: 'RUST', bTo: null },
  { a: 'WASHING_SODA', b: 'SLAKED_LIME', chance: 0.03, aTo: 'LYE', bTo: 'LIMESTONE' },

  // Water.
  { a: 'BARIUM', b: 'WATER', chance: 0.05, aTo: 'LYE', bTo: 'HYDROGEN', heat: 100 },
  { a: 'STRONTIUM', b: 'WATER', chance: 0.03, aTo: 'LYE', bTo: 'HYDROGEN', heat: 80 },
  { a: 'BRITTLE_ALUMINUM', b: 'WATER', chance: 0.03, aTo: 'BAUXITE', bTo: 'HYDROGEN' },
  { a: 'SODIUM_VAPOR', b: 'WATER', chance: 0.1, aTo: 'HYDROGEN', bTo: 'LYE', heat: 200 },
  { a: 'ANHYDROUS_COPPER_SULFATE', b: 'WATER', chance: 0.2, aTo: 'COPPER_SULFATE', bTo: 'EMPTY', heat: 30 },
  { a: 'INSTANT_SNOW', b: 'SALT', chance: 0.1, aTo: 'WATER', bTo: 'EMPTY' },
  { a: 'PAPER', b: 'WATER', chance: 0.005, aTo: 'PULP', bTo: 'EMPTY' },
  { a: 'CARDBOARD', b: 'WATER', chance: 0.003, aTo: 'PULP', bTo: 'EMPTY' },
  { a: 'ADOBE', b: 'WATER', chance: 0.003, aTo: 'MUD', bTo: null },
  { a: 'MICA', b: 'WATER', chance: 0.001, aTo: 'CLAY', bTo: null },
  { a: 'TUN', b: 'WATER', chance: 0.02, aTo: 'TARDIGRADE', bTo: null },
  { a: 'GLITTER', b: 'WATER', chance: 0.3, aTo: 'EMPTY', bTo: 'STEAM' },

  // Rust and tarnish.
  { a: 'STEEL', b: 'WATER', chance: 0.0003, aTo: 'RUST', bTo: null },
  { a: 'METAL', b: 'OXYGEN', chance: 0.002, aTo: 'RUST', bTo: 'EMPTY' },
  { a: 'SILVER', b: 'SULFUR', chance: 0.02, aTo: 'TARNISH', bTo: 'EMPTY' },

  // Fire and furnaces.
  { a: 'FIRE', b: 'SAND', chance: 0.2, aTo: 'EMPTY', bTo: null },
  { a: 'FIRE', b: 'BAKING_SODA', chance: 0.3, aTo: 'EMPTY', bTo: 'CARBON_DIOXIDE' },
  { a: 'LAVA', b: 'SNOW', chance: 0.25, aTo: 'OBSIDIAN', bTo: 'WATER', keepA: true },
  // Lavoisier burned a diamond in oxygen and got nothing but carbon dioxide.
  { a: 'DIAMOND', b: 'OXYGEN', chance: 0.05, minTemp: 700, aTo: 'CARBON_DIOXIDE', bTo: 'EMPTY', heat: 200 },
  // Burning magnesium tears the oxygen out of carbon dioxide, leaving soot.
  {
    a: 'CARBON_DIOXIDE', b: 'MAGNESIUM', chance: 0.3, minTemp: 650, aTo: 'SOOT', bTo: 'EMPTY',
    heat: 500, emit: ['PHOTON'],
  },
  { a: 'HEMATITE', b: 'COKE', chance: 0.05, minTemp: 1000, aTo: 'METAL', bTo: 'EMPTY' },
  // The first copper ever smelted was malachite heated with charcoal.
  { a: 'MALACHITE', b: 'COAL', chance: 0.05, minTemp: 700, aTo: 'COPPER', bTo: 'EMPTY' },
  { a: 'WOLFRAMITE', b: 'ALUMINUM', chance: 0.05, minTemp: 500, aTo: 'TUNGSTEN', bTo: 'EMPTY', heat: 300 },
  { a: 'STEAM', b: 'QUARTZ', chance: 0.01, aTo: null, bTo: 'WOLFRAMITE' },
  { a: 'MOLTEN_SALT', b: 'SPARK', chance: 0.1, aTo: 'SODIUM', bTo: null, spawn: 'CHLORINE' },

  // Dyes, pigments and odds and ends.
  { a: 'BLEACH', b: 'INDIGO', chance: 0.1, aTo: 'SALT_WATER', bTo: 'EMPTY' },
  { a: 'BLEACH', b: 'TYRIAN_PURPLE', chance: 0.1, aTo: 'SALT_WATER', bTo: 'EMPTY' },
  { a: 'INDIGO', b: 'CLOTH', chance: 0.03, aTo: 'EMPTY', bTo: 'DENIM' },
  { a: 'EPSOM_SALT', b: 'PLANT', chance: 0.02, aTo: 'EMPTY', bTo: 'FLOWER' },
  { a: 'GALINSTAN', b: 'ALUMINUM', chance: 0.02, aTo: null, bTo: 'BRITTLE_ALUMINUM' },
  { a: 'FOG', b: 'SMOKE', chance: 0.05, aTo: 'SMOG', bTo: 'SMOG' },
  { a: 'SMOG', b: 'CLOUD', chance: 0.02, aTo: 'EMPTY', bTo: 'ACID_RAIN' },
  { a: 'MICROPLASTIC', b: 'BACTERIA', chance: 0.01, aTo: 'CARBON_DIOXIDE', bTo: null },
  { a: 'HONEY', b: 'YEAST', chance: 0.02, aTo: 'MEAD', bTo: null },
  { a: 'RAINBOW', b: 'PHOTO_PAPER', chance: 0.1, aTo: 'EMPTY', bTo: 'PHOTOGRAPH' },
  { a: 'TIME_CRYSTAL', b: 'SWITCH', chance: 0.03, aTo: null, bTo: 'CLOCK' },

  // Space.
  {
    a: 'BLACK_HOLE', b: 'WHITE_HOLE', chance: 0.3, aTo: 'EMPTY', bTo: 'EMPTY',
    emit: ['PHOTON', 'PHOTON', 'GAMMA'], explode: 20,
  },
  // A pulsar stripping gas off a companion star shines in X-rays.
  { a: 'PULSAR', b: 'STAR', chance: 0.05, aTo: null, bTo: null, emit: ['XRAY'] },
  { a: 'GREY_GOO', b: 'LIGHTNING', chance: 0.5, aTo: 'SAND', bTo: null },
];

// What particles do to these elements (see PARTICLE_HITS in elements-expansion.js).
export const MORE_HITS = [
  { p: 'PHOTON', t: 'ALGAE', chance: 0.05, spawn: 'OXYGEN' },
  { p: 'MICROWAVE', t: 'EGG', chance: 0.3, tTo: 'FRIED_EGG', explode: 1 },
  { p: 'TACHYON', t: 'PHOTO_PAPER', chance: 0.3, tTo: 'PHOTOGRAPH' },
];
