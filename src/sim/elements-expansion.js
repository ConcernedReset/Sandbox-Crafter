// The expansion: 100 more elements. Chemistry, metals and minerals, life,
// explosives, subatomic particles, the radioactive decay chain, and a few
// exotic things at the end of the tree. Field meanings are documented at the
// top of elements.js.

import { State } from './constants.js';

const { SOLID, POWDER, LIQUID, GAS, ENERGY } = State;

// Metals remember what they were when they melt into Molten Metal, and turn
// back into the same metal when it cools.
const melt = (temp) => ({ temp, to: 'MOLTEN_METAL', chance: 0.05, remember: true });

export const EXPANSION_ELEMENTS = [
  // ---- air and the gases in it --------------------------------------------
  {
    key: 'OXYGEN', name: 'Oxygen', sym: 'O', cat: 'gas', state: GAS,
    colors: ['#bcd7ff', '#c8defc'], alpha: 0.25, density: 0.07, rise: 0.35, sink: 0.15, airDrag: 0.4,
    flammable: 0.4, burn: { fireTemp: 1300, fireLife: [10, 20] },
    low: { temp: -183, to: 'LOX', chance: 0.1 },
    desc: 'Feeds fire, so flames flare up wherever it is. Liquefies at −183 °C.',
    hint: 'Running electricity through Water gives off more than one gas.',
  },
  {
    key: 'NITROGEN', name: 'Nitrogen', sym: 'N', cat: 'gas', state: GAS,
    colors: ['#c7c9d9', '#bec0d2'], alpha: 0.2, density: 0.065, rise: 0.4, sink: 0.1, airDrag: 0.4,
    low: { temp: -196, to: 'CRYO', chance: 0.05 },
    desc: 'Inert gas that smothers flames. Condenses back into Cryo at −196 °C.',
    hint: 'Let Cryo boil away.',
  },
  {
    key: 'OZONE', name: 'Ozone', sym: 'O3', cat: 'gas', state: GAS,
    colors: ['#8fb6ff', '#7fa8f5'], alpha: 0.35, density: 0.09, rise: 0.3, sink: 0.2, airDrag: 0.4,
    opaque: true, decay: { chance: 0.0008, to: 'OXYGEN' },
    desc: 'Pale blue gas that soaks up light. Slowly turns back into oxygen.',
    hint: 'Sparks change the Oxygen around them.',
  },
  {
    key: 'CARBON_DIOXIDE', name: 'Carbon Dioxide', sym: 'CO2', cat: 'gas', state: GAS,
    colors: ['#d0d0d0', '#c4c4c4'], alpha: 0.25, density: 0.15, rise: 0.05, sink: 0.35, airDrag: 0.35,
    low: { temp: -78, to: 'DRY_ICE', chance: 0.05 },
    desc: 'Heavy gas that pools on the ground and puts out fires.',
    hint: 'Smoke burns away completely when there is extra Oxygen. Acid fizzes on Limestone too.',
  },
  {
    key: 'DRY_ICE', name: 'Dry Ice', sym: 'Di', cat: 'solid', state: SOLID, strength: 12,
    colors: ['#eef3f7', '#e3eaf0', '#f5f8fa'], temp: -80, conduct: 0.2, airCool: 0.0004,
    high: { temp: -78, to: 'CARBON_DIOXIDE', chance: 0.01 },
    desc: 'Frozen carbon dioxide. Turns straight into gas without melting.',
    hint: 'Chill Carbon Dioxide to −78 °C.',
  },
  {
    key: 'LOX', name: 'Liquid Oxygen', sym: 'Lx', cat: 'liquid', state: LIQUID,
    colors: ['#9cc9ff', '#8bbdf7'], density: 1.14, temp: -190, conduct: 0.3, airCool: 0.0004, spread: 5,
    transparent: true, high: { temp: -183, to: 'OXYGEN', chance: 0.03 },
    desc: 'Oxygen at −190 °C. Explodes on contact with fuels.',
    hint: 'Chill Oxygen until it liquefies.',
  },

  // ---- rocks, clay and building materials ---------------------------------
  {
    key: 'CLAY', name: 'Clay', sym: 'Cy', cat: 'powder', state: POWDER,
    colors: ['#b87a55', '#ad6f4b', '#c38561'], density: 1.8, conduct: 0.12,
    high: { temp: 900, to: 'BRICK', chance: 0.03 },
    pressure: { above: 40, to: 'RUBY', chance: 0.01 },
    desc: 'Sticky earth. Bakes into brick.',
    hint: 'Mix Mud with Sand.',
  },
  {
    key: 'GRAVEL', name: 'Gravel', sym: 'Gv', cat: 'powder', state: POWDER,
    colors: ['#7c7f84', '#6d7075', '#8a8d92', '#63666b'], density: 2.2, conduct: 0.15, permeable: true,
    desc: 'Crushed stone. Liquids drain straight through it.',
    hint: 'Crush Stone.',
  },
  {
    key: 'QUARTZ', name: 'Quartz', sym: 'Qz', cat: 'mineral', state: SOLID, strength: 55,
    colors: ['#f1f4f7', '#e5ebf0', '#dbe3ea'], conduct: 0.15, transparent: true, acidProof: true,
    high: { temp: 1700, to: 'MOLTEN_GLASS', chance: 0.02 },
    desc: 'Clear crystal. Light passes straight through.',
    hint: 'Squeeze Sand.',
  },
  {
    key: 'GRANITE', name: 'Granite', sym: 'Gt', cat: 'mineral', state: SOLID, strength: 60,
    colors: ['#b9a39c', '#a8948d', '#c7b3ab', '#8f7f79'], density: 2.7, conduct: 0.2,
    high: { temp: 1250, to: 'LAVA', chance: 0.02 },
    pressure: { above: 40, to: 'PITCHBLENDE', chance: 0.01 },
    desc: 'Speckled rock that forms when magma cools under pressure.',
    hint: 'Squeeze Lava before it cools.',
  },
  {
    key: 'SULFUR', name: 'Sulfur', sym: 'S', cat: 'mineral', state: POWDER,
    colors: ['#e8d84a', '#dccb3c', '#f0e05a'], density: 2.0, conduct: 0.1,
    flammable: 0.05, ignite: 232, burn: { smoke: 0.6, fireTemp: 800 },
    desc: 'Yellow mineral from volcanic vents. Burns with a blue flame.',
    hint: 'Steam rising off Lava leaves deposits behind.',
  },
  {
    key: 'COPPER', name: 'Copper', sym: 'Cu', cat: 'metal', state: SOLID, strength: 120,
    colors: ['#c7743e', '#b86a37', '#d27f48'], density: 8.96, conduct: 0.95, conductor: true,
    reflect: 0.5, high: melt(1085),
    desc: 'Excellent conductor. Turns green in water.',
    hint: 'Smelt a sulfur ore: add Sulfur to Lava.',
  },
  {
    key: 'VERDIGRIS', name: 'Verdigris', sym: 'Vd', cat: 'powder', state: POWDER,
    colors: ['#4fb39a', '#45a58d', '#5ac1a6'], density: 1.9, conduct: 0.1,
    desc: 'Green crust that grows on wet copper.',
    hint: 'Leave Copper in Water.',
  },
  {
    key: 'LIMESTONE', name: 'Limestone', sym: 'Ls', cat: 'mineral', state: SOLID, strength: 35,
    colors: ['#dad3bf', '#cfc8b3', '#e3dccb'], density: 2.7, conduct: 0.15,
    high: { temp: 850, to: 'CEMENT', chance: 0.02 },
    desc: 'Pale rock from the sea floor. Roast it to make cement.',
    hint: 'Leave Stone under Salt Water.',
  },
  {
    key: 'CEMENT', name: 'Cement', sym: 'Cm', cat: 'powder', state: POWDER,
    colors: ['#b5b2a8', '#aaa79d', '#c0bdb3'], density: 1.5, conduct: 0.1,
    desc: 'Grey powder that hardens when mixed with water.',
    hint: 'Roast Limestone.',
  },
  {
    key: 'WET_CONCRETE', name: 'Wet Concrete', sym: 'Wc', cat: 'liquid', state: LIQUID,
    colors: ['#9a9a95', '#90908b', '#a4a49f'], density: 2.4, conduct: 0.1, spread: 1, viscosity: 0.9,
    life: [500, 800], behavior: 'decay', lifeEnd: { to: 'CONCRETE' },
    desc: 'Pour it where you want it and it sets into concrete.',
    hint: 'Mix Cement with Water.',
  },
  {
    key: 'CONCRETE', name: 'Concrete', sym: 'Cc', cat: 'solid', state: SOLID, strength: 70,
    colors: ['#a3a39e', '#999994', '#adada8'], density: 2.4, conduct: 0.1, nAbsorb: 0.15,
    desc: 'Strong building material that also blocks some radiation.',
    hint: 'Wait for Wet Concrete to set.',
  },

  // ---- fuels and plastics -------------------------------------------------
  {
    key: 'PROPANE', name: 'Propane', sym: 'Pp', cat: 'gas', state: GAS,
    colors: ['#d8c8a8', '#cfbf9e'], alpha: 0.3, density: 0.1, rise: 0.1, sink: 0.3, airDrag: 0.35,
    flammable: 1, ignite: 470, explode: 3, burn: { fireTemp: 1200, fireLife: [12, 25] },
    pressure: { above: 20, to: 'PLASTIC', chance: 0.02 },
    desc: 'Heavy fuel gas that sinks and pools. Explodes when lit.',
    hint: 'Heat Oil without letting it catch fire.',
  },
  {
    key: 'GASOLINE', name: 'Gasoline', sym: 'Gs', cat: 'liquid', state: LIQUID,
    colors: ['#e0c860', '#d6bd52', '#e8d270'], density: 0.72, spread: 5,
    flammable: 0.35, ignite: 280, explode: 1, burn: { smoke: 0.3, fireTemp: 1000, fireLife: [30, 60] },
    desc: 'Light, runny fuel that burns fast.',
    hint: 'Refine Oil with Hydrogen.',
  },
  {
    key: 'PLASTIC', name: 'Plastic', sym: 'Pc', cat: 'solid', state: SOLID, strength: 18,
    colors: ['#e9edf2', '#dfe4ea', '#f2f4f7'], conduct: 0.05, acidProof: true, moderator: true,
    flammable: 0.02, ignite: 350, burn: { smoke: 0.9, fireLife: [40, 80] },
    desc: 'Acid-proof and insulating. Burns with thick smoke.',
    hint: 'Compress Propane.',
  },

  // ---- salt chemistry -------------------------------------------------------
  {
    key: 'SODIUM', name: 'Sodium', sym: 'Na', cat: 'metal', state: POWDER,
    colors: ['#dfe2e6', '#d3d7dc', '#e8eaed'], density: 0.97, conduct: 0.5,
    desc: 'Soft metal that floats on water, then explodes.',
    hint: 'Split Salt with electricity.',
  },
  {
    key: 'CHLORINE', name: 'Chlorine', sym: 'Ch', cat: 'gas', state: GAS,
    colors: ['#c8e05a', '#bcd64c'], alpha: 0.55, density: 0.2, rise: 0.08, sink: 0.35, airDrag: 0.35,
    desc: 'Heavy, poisonous gas. Kills plants, and explodes with hydrogen when heated or lit.',
    hint: 'Split Salt with electricity.',
  },
  {
    key: 'LYE', name: 'Lye', sym: 'Ly', cat: 'liquid', state: LIQUID,
    colors: ['#e9edd8', '#dfe4cb'], density: 1.3, spread: 4, acidProof: true, behavior: 'lye',
    desc: 'Caustic liquid that dissolves plants and wood. Neutralises acid.',
    hint: 'Drop Sodium in Water, then stand back.',
  },
  {
    key: 'SOAP', name: 'Soap', sym: 'So', cat: 'powder', state: POWDER,
    colors: ['#f2d7e3', '#ead0dc', '#f7e1ea'], density: 1.1,
    desc: 'Makes bubbles in water.',
    hint: 'Mix Lye with Oil.',
  },
  {
    key: 'BUBBLES', name: 'Bubbles', sym: 'Bu', cat: 'gas', state: GAS,
    colors: ['#eaf6ff', '#ffffff', '#f1e8ff'], alpha: 0.45, density: 0.03, rise: 0.55, sink: 0.1,
    airDrag: 0.5, life: [120, 300], behavior: 'decay',
    desc: 'Soap bubbles. They float up and pop.',
    hint: 'Mix Soap into Water.',
  },
  {
    key: 'NAPALM', name: 'Napalm', sym: 'Nm', cat: 'explosive', state: LIQUID,
    colors: ['#c9721c', '#bb6616', '#d17d26'], density: 0.9, spread: 1, viscosity: 0.85, sticky: true,
    flammable: 0.4, ignite: 250, burn: { smoke: 0.5, fireTemp: 1200, fireLife: [200, 320] },
    desc: 'Jellied fuel that sticks where it lands and burns for a long time.',
    hint: 'Thicken Gasoline with Soap.',
  },
  {
    key: 'POTASSIUM', name: 'Potassium', sym: 'K', cat: 'metal', state: POWDER,
    colors: ['#d8d3e0', '#cdc7d6'], density: 0.86, conduct: 0.5,
    desc: 'Even more violent in water than sodium.',
    hint: 'Run electricity through Ash, like Humphry Davy did.',
  },

  // ---- metals from electricity and heat ----------------------------------
  {
    key: 'MAGNESIUM', name: 'Magnesium', sym: 'Mg', cat: 'metal', state: POWDER,
    colors: ['#d0d4d8', '#c4c9ce', '#dadde1'], density: 1.7, conduct: 0.6,
    flammable: 0.02, ignite: 650, burn: { fireTemp: 3000, fireLife: [25, 45], flare: true },
    desc: 'Burns with a blinding white light that throws off photons. Hot magnesium pulls pure elements out of minerals.',
    hint: 'Run electricity through Salt Water.',
  },
  {
    key: 'ALUMINUM', name: 'Aluminum', sym: 'Al', cat: 'metal', state: SOLID, strength: 100,
    colors: ['#c3cbd2', '#b8c0c8', '#ced5db'], density: 2.7, conduct: 0.9, conductor: true,
    reflect: 0.6, high: melt(660),
    desc: 'Light metal. Mixed with rust it makes thermite.',
    hint: 'Run electricity through Clay.',
  },
  {
    key: 'SILICON', name: 'Silicon', sym: 'Si', cat: 'solid', state: SOLID, strength: 45,
    colors: ['#3f4a66', '#36405a', '#495573'], conduct: 0.3,
    desc: 'Solar cell. Light hitting it sends a spark into the metal it touches.',
    hint: 'Heat Sand with Magnesium.',
  },
  {
    key: 'TITANIUM', name: 'Titanium', sym: 'Ti', cat: 'metal', state: SOLID, strength: 220,
    colors: ['#9a9fa8', '#8f949d', '#a5aab2'], density: 4.5, conduct: 0.08, acidProof: true,
    reflect: 0.3, high: melt(1668),
    desc: 'Strong, acid-proof and slow to conduct heat.',
    hint: 'Heat Stone with Magnesium.',
  },
  {
    key: 'BORON', name: 'Boron', sym: 'B', cat: 'mineral', state: POWDER,
    colors: ['#4b3b2f', '#56453a', '#40322a'], density: 2.3, nAbsorb: 0.7,
    desc: 'Soaks up neutrons. Use it to control a reactor.',
    hint: 'Heat Glass with Magnesium.',
  },
  {
    key: 'GRAPHITE', name: 'Graphite', sym: 'Gr', cat: 'solid', state: SOLID, strength: 25,
    colors: ['#3a3c40', '#333539', '#44464a'], conduct: 0.5, conductor: true, moderator: true,
    flammable: 0.003, ignite: 700, burn: { smoke: 0.3, fireTemp: 1100, fireLife: [100, 200] },
    desc: 'Conducts electricity, and slows neutrons so they split atoms more easily.',
    hint: 'Run a current through Coal.',
  },
  {
    key: 'STEEL', name: 'Steel', sym: 'Ss', cat: 'metal', state: SOLID, strength: 200,
    colors: ['#7d8894', '#737e8a', '#87929e'], density: 7.9, conduct: 0.5, conductor: true,
    reflect: 0.4, high: melt(1510),
    desc: 'Iron hardened with carbon. It doesn\'t rust.',
    hint: 'Heat Metal with Coal.',
  },
  {
    key: 'MAGNET', name: 'Magnet', sym: 'Mag', cat: 'metal', state: SOLID, strength: 120,
    colors: ['#b83a3a', '#5b5f6b', '#a83434', '#6a6e7a'], density: 7.8, conduct: 0.6, behavior: 'magnet',
    desc: 'Bends the paths of charged particles and pulls ferrofluid.',
    hint: 'Strike Metal with Lightning.',
  },
  {
    key: 'FERROFLUID', name: 'Ferrofluid', sym: 'Ff', cat: 'liquid', state: LIQUID,
    colors: ['#1c1c22', '#24242c', '#18181d'], density: 1.3, spread: 3, viscosity: 0.3, behavior: 'ferrofluid',
    desc: 'Oil full of iron dust. Magnets pull it towards them.',
    hint: 'Stir Rust into Oil.',
  },
  {
    key: 'TUNGSTEN', name: 'Tungsten', sym: 'W', cat: 'metal', state: SOLID, strength: 240,
    colors: ['#8d8f94', '#83858a', '#96989d'], density: 19.3, conduct: 0.5, conductor: true,
    sparkHeat: 60, hotEmit: { temp: 1800, chance: 0.08 }, high: melt(3422),
    desc: 'Melts at 3422 °C. Put a current through it and it glows like a bulb filament.',
    hint: 'Forge Metal in Plasma.',
  },

  // ---- explosives -----------------------------------------------------------
  {
    key: 'AMMONIA', name: 'Ammonia', sym: 'NH3', cat: 'gas', state: GAS,
    colors: ['#e6e2b0', '#dcd7a0'], alpha: 0.3, density: 0.045, rise: 0.5, airDrag: 0.4,
    desc: 'Pungent gas. The starting point for fertiliser.',
    hint: 'Warm Nitrogen and Hydrogen together, but not hot enough to light the hydrogen.',
  },
  {
    key: 'FERTILIZER', name: 'Fertilizer', sym: 'Fz', cat: 'powder', state: POWDER,
    colors: ['#efeade', '#e6e0d0', '#f5f1e6'], density: 1.7,
    flammable: 0.02, ignite: 210, explode: 5, burn: { fireTemp: 1100, fireLife: [10, 20] },
    desc: 'Makes plants grow fast. Explodes if it gets too hot.',
    hint: 'Neutralise Ammonia with Acid.',
  },
  {
    key: 'ANFO', name: 'ANFO', sym: 'Af', cat: 'explosive', state: POWDER,
    colors: ['#e6d6b8', '#dccbaa', '#efdfc4'], density: 1.0,
    flammable: 0.3, ignite: 250, explode: 14, burn: { smoke: 0.5, fireTemp: 1500, fireLife: [15, 30] },
    desc: 'Mining explosive. Cheap and very powerful.',
    hint: 'Soak Fertilizer in Oil.',
  },
  {
    key: 'DYNAMITE', name: 'Dynamite', sym: 'Dy', cat: 'explosive', state: SOLID, strength: 15,
    colors: ['#c9453a', '#b83c32', '#d4503f'], conduct: 0.1,
    flammable: 0.08, ignite: 250, explode: 16, burn: { smoke: 0.4, fireTemp: 1500, fireLife: [15, 30] },
    desc: 'Nitro soaked into clay, so it only goes off when you light it.',
    hint: 'Soak Nitro into Clay.',
  },
  {
    key: 'C4', name: 'C4', sym: 'C4', cat: 'explosive', state: SOLID, strength: 20,
    colors: ['#e8e2c8', '#ded7bc', '#f0ead2'], conduct: 0.05,
    ignite: 5000, explode: 26, burn: { fireTemp: 2000, fireLife: [15, 30] },
    desc: 'Plastic explosive. Fire won\'t set it off, but a spark or another blast will.',
    hint: 'Knead Plastic with Nitro.',
  },
  {
    key: 'FUSE', name: 'Fuse', sym: 'Fs', cat: 'explosive', state: SOLID, strength: 10,
    colors: ['#8a7045', '#7d6540', '#957a4c'], conduct: 0.05,
    flammable: 0.35, ignite: 300, burn: { fireTemp: 700, fireLife: [6, 12] },
    desc: 'Burns steadily along its length. Use it to light things from a distance.',
    hint: 'Coat Wood in Gunpowder.',
  },
  {
    key: 'FIREWORK', name: 'Firework', sym: 'Fw', cat: 'explosive', state: POWDER,
    colors: ['#d64545', '#3f7fd6', '#e0b43a', '#44b86a'], density: 1.2,
    flammable: 0.6, ignite: 250, burn: { launch: true }, behavior: 'firework',
    desc: 'Light it and it shoots upward, then bursts into coloured sparks.',
    hint: 'Pack Gunpowder with Copper.',
  },
  {
    key: 'GLITTER', name: 'Glitter', sym: 'Gi', cat: 'energy', state: ENERGY,
    colors: ['#ff5a5a', '#ffb13d', '#fff05a', '#6aff7a', '#5ad8ff', '#7a7aff', '#e06aff', '#ffffff'],
    density: 0.5, life: [40, 90], behavior: 'glitter',
    desc: 'Coloured sparks from a firework.',
    hint: 'Light a Firework.',
  },

  // ---- gems and light -------------------------------------------------------
  {
    key: 'RUBY', name: 'Ruby', sym: 'Rb', cat: 'mineral', state: SOLID, strength: 180,
    colors: ['#d11d4a', '#c01642', '#e02a57'], conduct: 0.3, transparent: true, acidProof: true,
    behavior: 'recover',
    desc: 'Red crystal. Light passing through it is amplified, a photon at a time. Put it between mirrors for a laser.',
    hint: 'Squeeze Clay very hard.',
  },
  {
    key: 'LASER', name: 'Laser', sym: 'Lz', cat: 'energy', state: SOLID, strength: 60,
    colors: ['#5a1a1a', '#6b2020', '#4d1616'], conduct: 0.2, behavior: 'laser', glowAmount: 0.3,
    desc: 'Fires beams of light out of every exposed face.',
    hint: 'Pump a Ruby with a Spark.',
  },
  {
    key: 'CINNABAR', name: 'Cinnabar', sym: 'Ci', cat: 'mineral', state: POWDER,
    colors: ['#b8322a', '#a82a23', '#c63d33'], density: 8.1,
    high: { temp: 580, to: 'MERCURY', chance: 0.05 },
    desc: 'Red mercury ore.',
    hint: 'Sulfur seeping into Granite.',
  },
  {
    key: 'MERCURY', name: 'Mercury', sym: 'Hg', cat: 'metal', state: LIQUID,
    colors: ['#c7ccd4', '#b9bfc8', '#d5d9df'], density: 13.5, conduct: 0.3, conductor: true,
    spread: 6, reflect: 0.8,
    desc: 'A metal that is liquid at room temperature. Conducts electricity.',
    hint: 'Roast Cinnabar.',
  },
  {
    key: 'LITHIUM', name: 'Lithium', sym: 'Li', cat: 'metal', state: POWDER,
    colors: ['#e8e4dc', '#dcd8d0'], density: 0.53, conduct: 0.5,
    desc: 'The lightest metal: it floats. Neutrons turn it into tritium.',
    hint: 'Leach Granite with Acid.',
  },

  // ---- life -------------------------------------------------------------------
  {
    key: 'GRASS', name: 'Grass', sym: 'Gz', cat: 'life', state: POWDER,
    colors: ['#5cae3e', '#51a036', '#68bb49'], density: 1.4,
    flammable: 0.1, ignite: 250, burn: { ash: 0.3, smoke: 0.2 },
    grow: { into: ['DIRT'], chance: 0.003, surface: true }, behavior: 'grow',
    desc: 'Spreads across the surface of dirt.',
    hint: 'Plants take root in Dirt.',
  },
  {
    key: 'MOSS', name: 'Moss', sym: 'Ms', cat: 'life', state: SOLID, strength: 6,
    colors: ['#4f7a3a', '#456e32', '#5a8744'], conduct: 0.1,
    flammable: 0.03, ignite: 250, burn: { ash: 0.2, smoke: 0.3 },
    grow: { into: ['STONE', 'CONCRETE', 'BRICK'], chance: 0.002 }, behavior: 'grow',
    desc: 'Creeps slowly across stone.',
    hint: 'Plants cling to Stone.',
  },
  {
    key: 'FUNGUS', name: 'Fungus', sym: 'Fu', cat: 'life', state: SOLID, strength: 6,
    colors: ['#d8c49a', '#cbb68b', '#e3d1a8'], conduct: 0.1, glowAmount: 0.12,
    flammable: 0.03, ignite: 250, burn: { smoke: 0.4 },
    grow: { into: ['WOOD', 'PLANT'], chance: 0.004 }, behavior: 'grow',
    desc: 'Eats its way through wood. Glows faintly in the dark.',
    hint: 'Wood rots in Mud.',
  },
  {
    key: 'ALGAE', name: 'Algae', sym: 'Ae', cat: 'life', state: POWDER,
    colors: ['#3f9a5a', '#358c50', '#48a864'], density: 0.95, fallRate: 0.5,
    flammable: 0.02, ignite: 250, burn: { ash: 0.4 },
    grow: { into: ['WATER', 'SALT_WATER'], chance: 0.002 }, behavior: 'grow',
    desc: 'Floats and spreads through water.',
    hint: 'Plants in Salt Water.',
  },
  {
    key: 'PHOTON', name: 'Photon', sym: 'Ph', cat: 'particle', state: ENERGY, projectile: 'photon',
    colors: ['#fff6c8'], speed: 3, life: [150, 200],
    desc: 'Light. Travels in straight lines, passes through glass and water, bounces off mirrors and metal, and heats whatever absorbs it.',
    hint: 'Plasma shining through Glass.',
  },
  {
    key: 'FLOWER', name: 'Flower', sym: 'Fl', cat: 'life', state: SOLID, strength: 5,
    colors: ['#f07aa8', '#f2c14a', '#b98cf0', '#f5f5f5', '#f07aa8'], conduct: 0.1,
    flammable: 0.1, ignite: 250, burn: { ash: 0.3, smoke: 0.3 },
    produce: { el: 'FRUIT', chance: 0.0008 },
    desc: 'Blooms where light falls on a plant, and bears fruit.',
    hint: 'Shine light on a Plant.',
  },
  {
    key: 'FRUIT', name: 'Fruit', sym: 'Fr', cat: 'life', state: POWDER,
    colors: ['#e0442e', '#f06a2a', '#d93a4a', '#f2a23a'], density: 1.0,
    flammable: 0.02, ignite: 300, burn: { smoke: 0.4 },
    life: [900, 1500], behavior: 'decay', lifeEnd: { to: 'SEED', alt: 'ALCOHOL', altChance: 0.35 },
    desc: 'Falls from flowers. Rots into seeds, and sometimes ferments.',
    hint: 'Flowers bear fruit if you wait.',
  },
  {
    key: 'SEED', name: 'Seed', sym: 'Sd', cat: 'life', state: POWDER,
    colors: ['#8a6a3a', '#7d5e32', '#94733f'], density: 1.1, behavior: 'seed',
    flammable: 0.05, ignite: 250, burn: { ash: 0.5 },
    desc: 'Drop it on Dirt, Mud or Grass and it grows into a tree.',
    hint: 'Rotting Fruit leaves seeds behind.',
  },
  {
    key: 'ALCOHOL', name: 'Alcohol', sym: 'Et', cat: 'liquid', state: LIQUID,
    colors: ['#e8f0f5', '#dfe9f0'], alpha: 0.7, density: 0.79, spread: 6, transparent: true,
    flammable: 0.3, ignite: 365, burn: { fireTemp: 900, fireLife: [20, 40] },
    desc: 'Clear spirit that burns with almost no smoke.',
    hint: 'Fruit sometimes ferments as it rots.',
  },

  // ---- subatomic particles ------------------------------------------------
  {
    key: 'ELECTRON', name: 'Electron', sym: 'e-', cat: 'particle', state: ENERGY, projectile: 'electron',
    colors: ['#7fe3ff'], speed: 2, charge: -1, life: [60, 100],
    desc: 'Negative charge. Sparks the metal it hits and makes neon glow.',
    hint: 'Light knocks them out of Metal.',
  },
  {
    key: 'PROTON', name: 'Proton', sym: 'p+', cat: 'particle', state: ENERGY, projectile: 'proton',
    colors: ['#ff6a6a'], speed: 1.5, charge: 1, life: [60, 100],
    desc: 'Positive charge. Knocks neutrons out of metal, and grabs an electron to become hydrogen.',
    hint: 'Light can strip the electron off Hydrogen.',
  },
  {
    key: 'NEUTRON', name: 'Neutron', sym: 'n', cat: 'particle', state: ENERGY, projectile: 'neutron',
    colors: ['#b9b0ff'], speed: 2, life: [80, 120],
    desc: 'Passes through most matter. Splits uranium and plutonium. Decays after a few seconds.',
    hint: 'Fire Protons at Metal.',
  },
  {
    key: 'NEUTRINO', name: 'Neutrino', sym: 'Nu', cat: 'particle', state: ENERGY, projectile: 'neutrino',
    colors: ['#9dffc0'], alpha: 0.3, speed: 3, life: [200, 260],
    desc: 'A ghost particle that passes through almost everything.',
    hint: 'Wait for a Neutron to decay.',
  },

  // ---- the uranium ore chain ------------------------------------------------
  {
    key: 'PITCHBLENDE', name: 'Pitchblende', sym: 'Pi', cat: 'nuclear', state: SOLID, strength: 50,
    colors: ['#2d302b', '#252823', '#3a4a32', '#2a2d28'], density: 7, conduct: 0.2,
    emits: [{ p: 'PHOTON', chance: 0.0003 }, { p: 'NEUTRON', chance: 0.00003 }], glowAmount: 0.06,
    high: { temp: 700, to: 'YELLOWCAKE', chance: 0.02 },
    desc: 'Black uranium ore, faintly radioactive.',
    hint: 'Crush Granite much harder.',
  },
  {
    key: 'YELLOWCAKE', name: 'Yellowcake', sym: 'Yc', cat: 'nuclear', state: POWDER,
    colors: ['#e6c42a', '#d9b61e', '#f0cf3a'], density: 5, emits: [{ p: 'NEUTRON', chance: 0.00005 }],
    desc: 'Processed uranium ore. Mildly radioactive.',
    hint: 'Roast Pitchblende.',
  },
  {
    key: 'URANIUM', name: 'Uranium', sym: 'U', cat: 'nuclear', state: POWDER,
    colors: ['#5f7a5a', '#56704f', '#6a8464'], density: 19, conduct: 0.3, selfHeat: 0.01,
    emits: [{ p: 'NEUTRON', chance: 0.0004 }], glowAmount: 0.12,
    fission: {
      neutrons: 2, heat: 450, blast: 0.6,
      products: [['NUCLEAR_WASTE', 0.3], ['CESIUM', 0.06]], capture: ['PLUTONIUM', 0.12],
    },
    high: { temp: 2800, to: 'CORIUM', chance: 0.05 },
    desc: 'Heavy and radioactive. A neutron splits it into two more neutrons and a burst of heat. Pile enough together and it runs hot.',
    hint: 'Reduce Yellowcake with Hydrogen.',
  },
  {
    key: 'PLUTONIUM', name: 'Plutonium', sym: 'Pu', cat: 'nuclear', state: POWDER,
    colors: ['#8a6f6a', '#7d625d', '#967a75'], density: 19.8, conduct: 0.3, selfHeat: 0.05,
    emits: [{ p: 'NEUTRON', chance: 0.0015 }], glowAmount: 0.25,
    fission: {
      neutrons: 3, heat: 1500, blast: 6, photons: 2,
      products: [['FALLOUT', 0.4], ['PLASMA', 0.3]],
    },
    high: { temp: 2500, to: 'CORIUM', chance: 0.05 },
    desc: 'Extremely fissile. Each split releases three neutrons, so a big enough pile runs away into a nuclear explosion.',
    hint: 'Uranium that catches a neutron without splitting.',
  },
  {
    key: 'THORIUM', name: 'Thorium', sym: 'Th', cat: 'nuclear', state: POWDER,
    colors: ['#9aa39a', '#8e978e', '#a6afa6'], density: 11.7, emits: [{ p: 'NEUTRON', chance: 0.00005 }],
    desc: 'Mildly radioactive. Neutrons slowly breed it into uranium.',
    hint: 'Leach Pitchblende with Acid.',
  },
  {
    key: 'NUCLEAR_WASTE', name: 'Nuclear Waste', sym: 'Nw', cat: 'nuclear', state: LIQUID,
    colors: ['#6fe36a', '#5fd65a', '#7ff07a'], density: 3, spread: 1, viscosity: 0.8, selfHeat: 0.08,
    emits: [{ p: 'ELECTRON', chance: 0.002 }, { p: 'PHOTON', chance: 0.001 }], glowAmount: 0.5,
    decay: { chance: 0.00008, to: 'LEAD' },
    desc: 'Glowing leftovers from fission. Stays radioactive for a long time, then settles into lead.',
    hint: 'Split Uranium with a Neutron.',
  },
  {
    key: 'CESIUM', name: 'Cesium', sym: 'Cs', cat: 'metal', state: POWDER,
    colors: ['#e8d7a0', '#dcca92', '#f0e0ae'], density: 1.9, conduct: 0.5,
    emits: [{ p: 'PHOTON', chance: 0.0008 }], glowAmount: 0.1,
    desc: 'Explodes in water harder than any other metal. Light knocks electrons out of it two at a time.',
    hint: 'A fragment left behind when Uranium splits.',
  },
  {
    key: 'FALLOUT', name: 'Fallout', sym: 'Fo', cat: 'nuclear', state: POWDER,
    colors: ['#8d9a7a', '#7f8c6d', '#9aa886'], density: 0.9, fallRate: 0.4, airDrag: 0.2,
    emits: [{ p: 'ELECTRON', chance: 0.003 }], glowAmount: 0.2, decay: { chance: 0.0003, to: 'ASH' },
    desc: 'Radioactive dust from a nuclear blast.',
    hint: 'Split Plutonium.',
  },
  {
    key: 'CORIUM', name: 'Corium', sym: 'Cor', cat: 'nuclear', state: LIQUID,
    colors: ['#ff8a3d', '#ff7a2a', '#ffa050'], density: 18, temp: 2800, conduct: 0.4, airCool: 0.0002,
    spread: 1, viscosity: 0.8, glow: true, selfHeat: 0.6, emits: [{ p: 'NEUTRON', chance: 0.004 }],
    low: { temp: 1800, to: 'NUCLEAR_WASTE', chance: 0.02 },
    desc: 'Molten reactor fuel. Keeps itself hot and burns through almost anything.',
    hint: 'Let Uranium overheat.',
  },

  // ---- Marie Curie's decay chain ------------------------------------------
  {
    key: 'RADIUM', name: 'Radium', sym: 'Ra', cat: 'nuclear', state: POWDER,
    colors: ['#d6f7e9', '#c6f0dc', '#e3fbf1'], density: 5.5, selfHeat: 0.15,
    emits: [{ p: 'PHOTON', chance: 0.004 }], glowAmount: 0.9,
    decay: { chance: 0.0008, to: 'RADON', spawn: 'HELIUM' },
    desc: 'Glows in the dark. Decays into radon, shedding helium.',
    hint: 'Split Pitchblende with electricity, like Marie Curie.',
  },
  {
    key: 'RADON', name: 'Radon', sym: 'Rn', cat: 'nuclear', state: GAS,
    colors: ['#b3f0c9', '#a0e6b8'], alpha: 0.4, density: 0.25, rise: 0.05, sink: 0.3, airDrag: 0.35,
    emits: [{ p: 'PHOTON', chance: 0.0015 }], glowAmount: 0.35,
    decay: { chance: 0.0015, to: 'POLONIUM', spawn: 'HELIUM' },
    desc: 'Heavy radioactive gas that seeps downward and decays into polonium.',
    hint: 'Wait for Radium to decay.',
  },
  {
    key: 'HELIUM', name: 'Helium', sym: 'He', cat: 'gas', state: GAS,
    colors: ['#ffe9c7', '#fff1d9'], alpha: 0.2, density: 0.015, rise: 0.85, sink: 0.02, airDrag: 0.5,
    low: { temp: -269, to: 'SUPERFLUID', chance: 0.1 },
    desc: 'Light, unburnable gas. Radioactive elements shed it as they decay.',
    hint: 'Radium gives it off as it decays.',
  },
  {
    key: 'POLONIUM', name: 'Polonium', sym: 'Po', cat: 'nuclear', state: POWDER,
    colors: ['#c9c3b8', '#bdb6aa', '#d4cec4'], density: 9.2, selfHeat: 1.2,
    emits: [{ p: 'NEUTRON', chance: 0.0015 }], glowAmount: 0.4,
    decay: { chance: 0.0006, to: 'LEAD', spawn: 'HELIUM' },
    desc: 'Intensely radioactive and hot to the touch. Paired with beryllium it pours out neutrons.',
    hint: 'Wait for Radon to decay.',
  },
  {
    key: 'LEAD', name: 'Lead', sym: 'Pb', cat: 'metal', state: SOLID, strength: 60,
    colors: ['#6d7280', '#626775', '#777c89'], density: 11.3, conduct: 0.35, conductor: true,
    nAbsorb: 0.35, high: melt(327),
    pressure: { above: 120, to: 'NEUTRONIUM', chance: 0.005 },
    desc: 'Soft, heavy metal that stops radiation. Melts at 327 °C.',
    hint: 'Where the radioactive decay chain ends.',
  },
  {
    key: 'SILVER', name: 'Silver', sym: 'Ag', cat: 'metal', state: SOLID, strength: 90,
    colors: ['#d4d8dd', '#c8ccd2', '#e0e3e7'], density: 10.5, conduct: 1.0, conductor: true,
    reflect: 0.9, high: melt(962),
    desc: 'The best conductor of all. Coats glass to make mirrors.',
    hint: 'Dissolve Lead in Acid and see what\'s left over.',
  },
  {
    key: 'MIRROR', name: 'Mirror', sym: 'Mi', cat: 'solid', state: SOLID, strength: 25,
    colors: ['#d9e4ec', '#e6eef4', '#cfdbe4'], conduct: 0.1, reflect: 1, acidProof: true,
    desc: 'Reflects light perfectly.',
    hint: 'Coat Glass with Silver.',
  },
  {
    key: 'POSITRON', name: 'Positron', sym: 'e+', cat: 'particle', state: ENERGY, projectile: 'positron',
    colors: ['#ff78e0'], speed: 2, charge: 1, life: [60, 100],
    desc: 'An antimatter electron. Annihilates with matter in a flash of light.',
    hint: 'High-energy light hitting Lead.',
  },
  {
    key: 'ANTIMATTER', name: 'Antimatter', sym: 'AM', cat: 'particle', state: GAS,
    colors: ['#c79bff', '#b789f5', '#d6adff'], alpha: 0.85, density: 0.03, rise: 0.25, sink: 0.15,
    airDrag: 0.4, behavior: 'antimatter', glowAmount: 0.3,
    desc: 'Annihilates anything it touches except Wall. Keep it in a sealed box.',
    hint: 'Trap Positrons in Cryo.',
  },
  {
    key: 'NEON', name: 'Neon', sym: 'Ne', cat: 'gas', state: GAS,
    colors: ['#f08a6a', '#e87c5c'], alpha: 0.35, density: 0.03, rise: 0.6, airDrag: 0.4, behavior: 'neon',
    desc: 'Glows red-orange when electricity or electrons pass through it.',
    hint: 'Fuse Helium inside Plasma, the way stars do.',
  },
  {
    key: 'GEIGER', name: 'Geiger Tube', sym: 'Gc', cat: 'solid', state: SOLID, strength: 30,
    colors: ['#5a6b5a', '#4f5f4f', '#657665'], conduct: 0.1, detector: true, behavior: 'geiger',
    desc: 'Radiation detector. Flashes, and sparks the metal it touches, when a particle passes through.',
    hint: 'Neon with a dash of Chlorine, the gas inside real Geiger counters.',
  },
  {
    key: 'SUPERFLUID', name: 'Superfluid', sym: 'Sf', cat: 'liquid', state: LIQUID,
    colors: ['#f4e6ff', '#ecdcff'], alpha: 0.7, density: 0.15, temp: -271, holdTemp: true, conduct: 1,
    spread: 10, transparent: true, life: [600, 1200], behavior: 'superfluid', lifeEnd: { to: 'HELIUM' },
    desc: 'Helium near absolute zero. It flows with no friction and creeps up walls.',
    hint: 'Cool Helium to within a few degrees of absolute zero.',
  },

  // ---- heavy hydrogen and fusion -------------------------------------------
  {
    key: 'DEUTERIUM', name: 'Deuterium', sym: 'D', cat: 'nuclear', state: GAS,
    colors: ['#c9d9ff', '#bccff9'], alpha: 0.3, density: 0.02, rise: 0.7, sink: 0.05, airDrag: 0.5,
    flammable: 1, ignite: 5000, explode: 4, behavior: 'recover',
    burn: { to: 'HEAVY_WATER', toChance: 0.5, fireTemp: 1500, fireLife: [8, 18] },
    desc: 'Heavy hydrogen. Every neutron that hits it comes out as two.',
    hint: 'Let Hydrogen catch a Neutron.',
  },
  {
    key: 'HEAVY_WATER', name: 'Heavy Water', sym: 'D2O', cat: 'nuclear', state: LIQUID,
    colors: ['#3d6fc4', '#4577cc', '#3668bb'], density: 1.1, conduct: 0.3, spread: 7,
    transparent: true, moderator: true,
    desc: 'Water made from deuterium. Slows neutrons down without swallowing them.',
    hint: 'Burn Deuterium.',
  },
  {
    key: 'TRITIUM', name: 'Tritium', sym: 'T', cat: 'nuclear', state: GAS,
    colors: ['#b8f5c8', '#a8eeb9'], alpha: 0.35, density: 0.02, rise: 0.75, sink: 0.05, airDrag: 0.5,
    emits: [{ p: 'ELECTRON', chance: 0.0008 }], glowAmount: 0.25, decay: { chance: 0.0002, to: 'HELIUM' },
    flammable: 1, ignite: 5000, explode: 4, burn: { fireTemp: 1500, fireLife: [8, 18] },
    desc: 'Radioactive hydrogen that glows faintly. Heat it past 3000 °C with deuterium and they fuse. A flame just burns them.',
    hint: 'Lithium splits when a Neutron hits it.',
  },
  {
    key: 'COBALT', name: 'Cobalt-60', sym: 'Co', cat: 'nuclear', state: SOLID, strength: 150,
    colors: ['#5a6fa8', '#50649a', '#6479b5'], density: 8.9, conduct: 0.6, conductor: true,
    emits: [{ p: 'PHOTON', chance: 0.004 }], glowAmount: 0.25, decay: { chance: 0.00005, to: 'METAL' },
    high: melt(1495),
    desc: 'Metal made radioactive by neutrons. It shines gamma rays.',
    hint: 'Bombard Metal with Neutrons.',
  },

  // ---- alchemy ----------------------------------------------------------------
  {
    key: 'GOLD', name: 'Gold', sym: 'Au', cat: 'metal', state: SOLID, strength: 80,
    colors: ['#f2c53d', '#e6b830', '#f7d256'], density: 19.3, conduct: 0.8, conductor: true,
    acidProof: true, reflect: 0.9, high: melt(1064),
    desc: 'Never rusts or dissolves. The alchemists\' dream.',
    hint: 'Real alchemy: hit Mercury with Neutrons.',
  },
  {
    key: 'PHILOSOPHERS_STONE', name: 'Philosopher\'s Stone', sym: 'PS', cat: 'special', state: SOLID, strength: 0,
    colors: ['#b0122d', '#9c0f28', '#c41a36'], conduct: 0.2, acidProof: true, glowAmount: 0.25,
    behavior: 'philosopher',
    desc: 'Turns the metals it touches into gold.',
    hint: 'Marry Gold with Mercury.',
  },
  {
    key: 'EMERALD', name: 'Emerald', sym: 'Em', cat: 'mineral', state: SOLID, strength: 150,
    colors: ['#1fa86a', '#1a9960', '#28b877'], conduct: 0.3, transparent: true, acidProof: true,
    desc: 'Green gem, and the ore of beryllium.',
    hint: 'Quartz stained by Verdigris.',
  },
  {
    key: 'BERYLLIUM', name: 'Beryllium', sym: 'Be', cat: 'metal', state: SOLID, strength: 140,
    colors: ['#b4bfb6', '#a9b4ab', '#bec9c0'], density: 1.85, conduct: 0.7, high: melt(1287),
    behavior: 'recover',
    desc: 'Light metal. Neutrons that hit it come out doubled.',
    hint: 'Dissolve Emerald in Acid.',
  },
  {
    key: 'AMETHYST', name: 'Amethyst', sym: 'Ay', cat: 'mineral', state: SOLID, strength: 120,
    colors: ['#9b59d0', '#8d4cc2', '#a968dc'], conduct: 0.3, transparent: true, acidProof: true,
    desc: 'Purple quartz, coloured by radiation.',
    hint: 'Irradiate Quartz with Neutrons.',
  },
  {
    key: 'VIRUS', name: 'Virus', sym: 'Vi', cat: 'life', state: LIQUID,
    colors: ['#a23fbf', '#9336b0', '#b04bcc'], density: 1.02, spread: 3, life: [400, 800],
    behavior: 'virus', high: { temp: 70, to: 'ASH', chance: 0.1 },
    desc: 'Infects anything living it touches. Heat kills it.',
    hint: 'Irradiate Fungus.',
  },

  // ---- the far end of the table ------------------------------------------
  {
    key: 'STAR', name: 'Star', sym: 'Sun', cat: 'special', state: SOLID,
    colors: ['#fff2b0', '#ffe680', '#fff8d6'], temp: 6000, holdTemp: true, conduct: 0.5,
    emits: [{ p: 'PHOTON', chance: 0.03 }], glowAmount: 1.2, indestructible: true,
    desc: 'A miniature sun. Fuses hydrogen into helium and floods the chamber with light.',
    hint: 'Squeeze Hydrogen until it ignites.',
  },
  {
    key: 'NEUTRONIUM', name: 'Neutronium', sym: 'Nn', cat: 'special', state: POWDER,
    colors: ['#d7dcff', '#c3c9f7', '#e8ebff'], density: 1000, conduct: 0.5, crush: true,
    glowAmount: 0.3, behavior: 'neutronium',
    desc: 'Neutron-star matter. Sinks through everything, and bursts into neutrons if the pressure drops.',
    hint: 'Crush Lead with enormous pressure.',
  },
  {
    key: 'BLACK_HOLE', name: 'Black Hole', sym: 'BH', cat: 'special', state: SOLID,
    colors: ['#000000', '#05010a'], conduct: 0, indestructible: true, acidProof: true, behavior: 'blackhole',
    desc: 'Swallows everything nearby and drags the air around it inward.',
    hint: 'Drop Neutronium into Void.',
  },
  {
    key: 'WHITE_HOLE', name: 'White Hole', sym: 'WH', cat: 'special', state: SOLID,
    colors: ['#ffffff', '#f4f7ff'], conduct: 0, indestructible: true, acidProof: true,
    glowAmount: 0.8, behavior: 'whitehole',
    desc: 'The reverse of a black hole: it pours out matter and light.',
    hint: 'Feed Antimatter to a Black Hole.',
  },
  {
    key: 'STRANGE_MATTER', name: 'Strange Matter', sym: 'Sq', cat: 'special', state: POWDER,
    colors: ['#44e0c8', '#d94fd0', '#e8e46a'], density: 50, conduct: 0.2, glowAmount: 0.3,
    behavior: 'strange',
    desc: 'Turns everything it touches into more of itself. Only Wall and Antimatter stop it.',
    hint: 'Smash a Proton into Neutronium.',
  },
  {
    key: 'DARK_MATTER', name: 'Dark Matter', sym: 'Dk', cat: 'special', state: GAS,
    colors: ['#3a2a5a', '#2e2248', '#44336a'], alpha: 0.4, density: 0.05, behavior: 'darkmatter',
    desc: 'Drifts straight through solid matter as if it weren\'t there.',
    hint: 'Neutrinos falling into Void.',
  },
];

export const EXPANSION_REACTIONS = [
  // Air and fire.
  { a: 'FIRE', b: 'NITROGEN', chance: 0.3, aTo: 'EMPTY', bTo: null },
  { a: 'FIRE', b: 'CARBON_DIOXIDE', chance: 0.4, aTo: 'EMPTY', bTo: null },
  { a: 'OXYGEN', b: 'SPARK', chance: 0.1, aTo: 'OZONE', bTo: null },
  { a: 'SMOKE', b: 'OXYGEN', chance: 0.05, aTo: 'CARBON_DIOXIDE', bTo: 'EMPTY' },
  { a: 'ACID', b: 'LIMESTONE', chance: 0.05, aTo: 'EMPTY', bTo: 'CARBON_DIOXIDE' },
  { a: 'NITROGEN', b: 'HYDROGEN', chance: 0.02, aTo: 'AMMONIA', bTo: 'AMMONIA', minTemp: 200 },
  { a: 'LOX', b: 'OIL', chance: 0.03, aTo: 'FIRE', bTo: 'FIRE', explode: 8 },
  { a: 'LOX', b: 'GASOLINE', chance: 0.03, aTo: 'FIRE', bTo: 'FIRE', explode: 8 },
  { a: 'LOX', b: 'ALCOHOL', chance: 0.03, aTo: 'FIRE', bTo: 'FIRE', explode: 8 },
  { a: 'LOX', b: 'COAL', chance: 0.03, aTo: 'FIRE', bTo: 'FIRE', explode: 8 },

  // Rocks and building.
  { a: 'MUD', b: 'SAND', chance: 0.02, aTo: 'CLAY', bTo: 'EMPTY' },
  { a: 'LAVA', b: 'STEAM', chance: 0.02, aTo: null, bTo: 'SULFUR' },
  { a: 'LAVA', b: 'SULFUR', chance: 0.03, aTo: 'COPPER', bTo: 'EMPTY' },
  { a: 'COPPER', b: 'WATER', chance: 0.0005, aTo: 'VERDIGRIS', bTo: null },
  { a: 'SULFUR', b: 'GRANITE', chance: 0.01, aTo: 'CINNABAR', bTo: null },
  { a: 'SALT_WATER', b: 'STONE', chance: 0.001, aTo: null, bTo: 'LIMESTONE' },
  { a: 'CEMENT', b: 'WATER', chance: 0.05, aTo: 'WET_CONCRETE', bTo: 'EMPTY' },

  // Fuels.
  { a: 'OIL', b: 'HYDROGEN', chance: 0.02, aTo: 'GASOLINE', bTo: 'EMPTY' },
  { a: 'OIL', b: 'RUST', chance: 0.02, aTo: 'FERROFLUID', bTo: 'EMPTY' },

  // Salt chemistry and the alkali metals.
  { a: 'SALT', b: 'SPARK', chance: 0.1, aTo: 'SODIUM', bTo: null, spawn: 'CHLORINE' },
  { a: 'SODIUM', b: 'WATER', chance: 0.1, aTo: 'LYE', bTo: 'HYDROGEN', explode: 3, heat: 300 },
  { a: 'POTASSIUM', b: 'WATER', chance: 0.2, aTo: 'LYE', bTo: 'HYDROGEN', explode: 6, heat: 600 },
  { a: 'LITHIUM', b: 'WATER', chance: 0.005, aTo: null, bTo: 'HYDROGEN' },
  { a: 'CESIUM', b: 'WATER', chance: 0.4, aTo: 'LYE', bTo: 'HYDROGEN', explode: 12, heat: 1000 },
  { a: 'CESIUM', b: 'ICE', chance: 0.3, aTo: 'LYE', bTo: 'HYDROGEN', explode: 12, heat: 1000 },
  { a: 'SODIUM', b: 'CHLORINE', chance: 0.05, aTo: 'SALT', bTo: 'EMPTY', explode: 1, heat: 400 },
  { a: 'CHLORINE', b: 'HYDROGEN', chance: 0.3, aTo: 'ACID', bTo: 'ACID', minTemp: 250, explode: 2 },
  { a: 'CHLORINE', b: 'PLANT', chance: 0.05, aTo: 'EMPTY', bTo: 'ASH' },
  { a: 'LYE', b: 'OIL', chance: 0.03, aTo: 'SOAP', bTo: 'EMPTY' },
  { a: 'LYE', b: 'ACID', chance: 0.1, aTo: 'SALT_WATER', bTo: 'SALT_WATER', heat: 50 },
  { a: 'SOAP', b: 'WATER', chance: 0.02, aTo: null, aAlt: 'EMPTY', aAltChance: 0.3, bTo: 'BUBBLES' },
  { a: 'GASOLINE', b: 'SOAP', chance: 0.03, aTo: 'NAPALM', bTo: 'EMPTY' },

  // Electrolysis and smelting.
  { a: 'SALT_WATER', b: 'SPARK', chance: 0.05, aTo: 'MAGNESIUM', bTo: null },
  { a: 'CLAY', b: 'SPARK', chance: 0.1, aTo: 'ALUMINUM', bTo: null },
  { a: 'ASH', b: 'SPARK', chance: 0.1, aTo: 'POTASSIUM', bTo: null },
  { a: 'COAL', b: 'SPARK', chance: 0.1, aTo: 'GRAPHITE', bTo: null },
  { a: 'PITCHBLENDE', b: 'SPARK', chance: 0.05, aTo: 'RADIUM', bTo: null },
  { a: 'RUBY', b: 'SPARK', chance: 0.1, aTo: 'LASER', bTo: null },
  { a: 'SAND', b: 'MAGNESIUM', chance: 0.05, aTo: 'SILICON', bTo: 'EMPTY', minTemp: 500 },
  { a: 'STONE', b: 'MAGNESIUM', chance: 0.05, aTo: 'TITANIUM', bTo: 'EMPTY', minTemp: 500 },
  { a: 'GLASS', b: 'MAGNESIUM', chance: 0.05, aTo: 'BORON', bTo: 'EMPTY', minTemp: 500 },
  { a: 'METAL', b: 'COAL', chance: 0.05, aTo: 'STEEL', bTo: 'EMPTY', minTemp: 900 },
  { a: 'METAL', b: 'LIGHTNING', chance: 0.5, aTo: 'MAGNET', bTo: null },
  { a: 'METAL', b: 'PLASMA', chance: 0.1, aTo: 'TUNGSTEN', bTo: null },
  { a: 'ALUMINUM', b: 'RUST', chance: 0.02, aTo: 'THERMITE', bTo: 'THERMITE' },
  { a: 'LEAD', b: 'ACID', chance: 0.01, aTo: 'SILVER', bTo: 'EMPTY' },
  { a: 'SILVER', b: 'GLASS', chance: 0.03, aTo: 'EMPTY', bTo: 'MIRROR' },
  { a: 'GRANITE', b: 'ACID', chance: 0.02, aTo: 'LITHIUM', bTo: 'EMPTY' },
  { a: 'PITCHBLENDE', b: 'ACID', chance: 0.02, aTo: 'THORIUM', bTo: 'EMPTY' },
  { a: 'YELLOWCAKE', b: 'HYDROGEN', chance: 0.03, aTo: 'URANIUM', bTo: 'EMPTY' },
  { a: 'QUARTZ', b: 'VERDIGRIS', chance: 0.02, aTo: 'EMERALD', bTo: 'EMPTY' },
  { a: 'EMERALD', b: 'ACID', chance: 0.02, aTo: 'BERYLLIUM', bTo: 'EMPTY' },
  { a: 'GOLD', b: 'MERCURY', chance: 0.01, aTo: 'PHILOSOPHERS_STONE', bTo: 'EMPTY' },

  // Explosives.
  { a: 'AMMONIA', b: 'ACID', chance: 0.05, aTo: 'FERTILIZER', bTo: 'EMPTY' },
  { a: 'FERTILIZER', b: 'OIL', chance: 0.03, aTo: 'ANFO', bTo: 'EMPTY' },
  { a: 'FERTILIZER', b: 'PLANT', chance: 0.05, aTo: 'PLANT', bTo: null },
  { a: 'NITRO', b: 'CLAY', chance: 0.03, aTo: 'EMPTY', bTo: 'DYNAMITE' },
  { a: 'PLASTIC', b: 'NITRO', chance: 0.03, aTo: 'C4', bTo: 'EMPTY' },
  { a: 'WOOD', b: 'GUNPOWDER', chance: 0.01, aTo: 'FUSE', bTo: 'EMPTY' },
  { a: 'GUNPOWDER', b: 'COPPER', chance: 0.01, aTo: 'FIREWORK', bTo: null },

  // Life.
  { a: 'DIRT', b: 'PLANT', chance: 0.01, aTo: 'GRASS', bTo: null },
  { a: 'STONE', b: 'PLANT', chance: 0.002, aTo: 'MOSS', bTo: null },
  { a: 'WOOD', b: 'MUD', chance: 0.002, aTo: 'FUNGUS', bTo: null },
  { a: 'PLANT', b: 'SALT_WATER', chance: 0.005, aTo: null, bTo: 'ALGAE' },

  // Light, nuclear and beyond.
  { a: 'PLASMA', b: 'GLASS', chance: 0.1, aTo: 'PHOTON', bTo: null },
  { a: 'HELIUM', b: 'PLASMA', chance: 0.05, aTo: 'NEON', bTo: null },
  { a: 'NEON', b: 'CHLORINE', chance: 0.02, aTo: 'GEIGER', bTo: 'EMPTY' },
  { a: 'POLONIUM', b: 'BERYLLIUM', chance: 0.05, aTo: null, bTo: null, emit: ['NEUTRON'] },
  {
    a: 'TRITIUM', b: 'DEUTERIUM', chance: 0.3, aTo: 'HELIUM', bTo: 'HELIUM', minTemp: 3000,
    emit: ['NEUTRON', 'NEUTRON'], explode: 14, heat: 4000,
  },
  { a: 'STAR', b: 'HYDROGEN', chance: 0.1, aTo: null, bTo: 'HELIUM', emit: ['PHOTON'] },
  { a: 'NEUTRONIUM', b: 'VOID', chance: 0.3, aTo: 'BLACK_HOLE', bTo: null },
  { a: 'BLACK_HOLE', b: 'ANTIMATTER', chance: 0.3, aTo: 'WHITE_HOLE', bTo: 'EMPTY' },
];

// What happens when a flying particle (photon, electron...) enters a cell
// holding element `t`. Checked before the particle's default behaviour.
//   tTo     the target turns into this        emit   particles thrown out
//   spawn   element placed in an empty cell   pTo    the particle settles as this element
//   keep    the particle carries on           copy   emitted particles fly the same way
//   fission split the target (see the target's `fission` settings)
//   action  'spark' (sparks touching metal) or 'excite' (makes the target glow)
//   recover frames the target needs before it can do this again (limits gain)
export const PARTICLE_HITS = [
  { p: 'PHOTON', t: 'METAL', chance: 0.25, emit: ['ELECTRON'] },
  { p: 'PHOTON', t: 'CESIUM', chance: 0.6, emit: ['ELECTRON', 'ELECTRON'] },
  { p: 'PHOTON', t: 'HYDROGEN', chance: 0.4, tTo: 'PROTON', emit: ['ELECTRON'] },
  { p: 'PHOTON', t: 'LEAD', chance: 0.2, emit: ['POSITRON', 'ELECTRON'] },
  { p: 'PHOTON', t: 'RUBY', chance: 0.3, emit: ['PHOTON'], copy: true, keep: true, recover: 20 },
  { p: 'PHOTON', t: 'PLANT', chance: 0.1, tTo: 'FLOWER' },
  { p: 'PHOTON', t: 'SILICON', chance: 0.6, action: 'spark' },
  { p: 'PHOTON', t: 'OXYGEN', chance: 0.02, tTo: 'OZONE' },
  { p: 'PHOTON', t: 'CHLORINE', chance: 0.3, heat: 400 },
  { p: 'ELECTRON', t: 'NEON', chance: 0.9, action: 'excite', emit: ['PHOTON'] },
  { p: 'ELECTRON', t: 'WATER', chance: 0.1, tTo: 'HYDROGEN' },
  { p: 'PROTON', t: 'METAL', chance: 0.3, emit: ['NEUTRON', 'NEUTRON'] },
  { p: 'PROTON', t: 'LEAD', chance: 0.3, emit: ['NEUTRON', 'NEUTRON', 'NEUTRON'] },
  { p: 'PROTON', t: 'TUNGSTEN', chance: 0.4, emit: ['NEUTRON', 'NEUTRON', 'NEUTRON'] },
  { p: 'PROTON', t: 'LITHIUM', chance: 0.4, tTo: 'HELIUM', spawn: 'HELIUM', heat: 800, explode: 2 },
  { p: 'PROTON', t: 'NEUTRONIUM', chance: 0.3, tTo: 'STRANGE_MATTER' },
  { p: 'NEUTRON', t: 'URANIUM', chance: 0.06, fission: true },
  { p: 'NEUTRON', t: 'PLUTONIUM', chance: 0.3, fission: true },
  { p: 'NEUTRON', t: 'THORIUM', chance: 0.05, tTo: 'URANIUM' },
  { p: 'NEUTRON', t: 'DEUTERIUM', chance: 0.08, emit: ['NEUTRON'], keep: true, recover: 30 },
  { p: 'NEUTRON', t: 'BERYLLIUM', chance: 0.1, emit: ['NEUTRON'], keep: true, recover: 30 },
  { p: 'NEUTRON', t: 'HYDROGEN', chance: 0.05, tTo: 'DEUTERIUM' },
  { p: 'NEUTRON', t: 'LITHIUM', chance: 0.1, tTo: 'TRITIUM', spawn: 'HELIUM' },
  { p: 'NEUTRON', t: 'METAL', chance: 0.02, tTo: 'COBALT' },
  { p: 'NEUTRON', t: 'MERCURY', chance: 0.05, tTo: 'GOLD' },
  { p: 'NEUTRON', t: 'QUARTZ', chance: 0.05, tTo: 'AMETHYST' },
  { p: 'NEUTRON', t: 'FUNGUS', chance: 0.1, tTo: 'VIRUS' },
  { p: 'POSITRON', t: 'CRYO', chance: 0.3, tTo: 'ANTIMATTER' },
  { p: 'NEUTRINO', t: 'VOID', chance: 0.5, pTo: 'DARK_MATTER' },
  { p: 'NEUTRINO', t: 'HEAVY_WATER', chance: 0.02, emit: ['PHOTON', 'ELECTRON'] },
];

// When two flying particles land in the same cell.
export const PARTICLE_PAIRS = [
  { a: 'ELECTRON', b: 'PROTON', chance: 0.8, gridTo: 'HYDROGEN' },
  { a: 'ELECTRON', b: 'POSITRON', chance: 0.9, emit: ['PHOTON', 'PHOTON'] },
];
