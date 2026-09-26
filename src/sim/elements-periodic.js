// Completing the periodic table: every element from fluorine to oganesson
// that the earlier tables didn't have, with the ores they come from and the
// reactions chemists and physicists actually used to find them. Recipes
// follow the real history where it can be played: Davy's electrolysis,
// Ramsay's noble gases, the century-long untangling of the rare earths, and
// the particle beams that built the superheavy elements one atom at a time.
// Field meanings are documented at the top of elements.js.

import { State } from './constants.js';

const { SOLID, POWDER, LIQUID, GAS, ENERGY } = State;

// Metals remember what they were when they melt into Molten Metal, and turn
// back into the same metal when it cools.
const melt = (temp) => ({ temp, to: 'MOLTEN_METAL', chance: 0.05, remember: true });

// A plain, solid, conducting metal. Most of the table looks like this.
const metal = (key, name, sym, colors, density, meltAt, strength, extra = {}) => ({
  key, name, sym, cat: 'metal', state: SOLID, colors, density, conduct: 0.6, conductor: true,
  reflect: 0.4, strength, high: melt(meltAt), ...extra,
});

// A rare earth metal: all fifteen lanthanides, plus scandium and yttrium.
const rareEarth = (key, name, sym, colors, density, meltAt, extra = {}) => ({
  key, name, sym, cat: 'rareearth', state: SOLID, colors, density, conduct: 0.3, conductor: true,
  reflect: 0.3, strength: 60, high: melt(meltAt), ...extra,
});

// A superheavy element: a few atoms that last a second or two, then decay by
// throwing off an alpha particle.
const superheavy = (key, name, sym, colors, decaysTo, chance, extra = {}) => ({
  key, name, sym, cat: 'nuclear', state: POWDER, colors, density: 18, glowAmount: 0.25,
  selfHeat: 0.3, render: 'pulse', decay: { chance, to: decaysTo, spawn: 'ALPHA' }, ...extra,
});

// A mineral you mine an element from.
const ore = (key, name, sym, colors, density, strength, extra = {}) => ({
  key, name, sym, cat: 'mineral', state: SOLID, colors, density, conduct: 0.2, strength, ...extra,
});

export const PERIODIC_ELEMENTS = [
  // ---- halogens, noble gases and other non-metals -------------------------
  {
    key: 'FLUORINE', name: 'Fluorine', sym: 'F', cat: 'gas', state: GAS,
    colors: ['#e8f08a', '#dde67a'], alpha: 0.4, density: 0.17, rise: 0.15, sink: 0.25, airDrag: 0.4,
    desc: 'The most reactive element there is. It sets wood alight, turns water into acid, etches glass, and is the only thing that can make xenon react.',
    hint: 'Split Fluorite with electricity, as Henri Moissan finally managed in 1886.',
  },
  {
    key: 'PHOSPHORUS', name: 'Phosphorus', sym: 'P', cat: 'powder', state: POWDER,
    colors: ['#f4f1d0', '#ece8c0', '#faf7de'], density: 1.8, conduct: 0.1, glowAmount: 0.3,
    flammable: 0.8, ignite: 40, burn: { smoke: 0.8, fireTemp: 900, fireLife: [20, 40] },
    desc: 'White phosphorus glows green in the dark as it reacts with the air, and bursts into flame at just 40 °C. Keep it under water.',
    hint: 'Bake Bone with Coal, the way phosphorus is made in a furnace.',
  },
  {
    key: 'RED_PHOSPHORUS', name: 'Red Phosphorus', sym: 'rP', cat: 'powder', state: POWDER,
    colors: ['#a8323a', '#962b33', '#b83a42'], density: 2.2, conduct: 0.1,
    flammable: 0.1, ignite: 260, burn: { smoke: 0.6, fireTemp: 900, fireLife: [20, 40] },
    desc: 'The safe form of phosphorus. It doesn\'t glow or light itself, which is why it\'s on the side of every matchbox.',
    hint: 'Leave Phosphorus out in the light.',
  },
  {
    key: 'ARGON', name: 'Argon', sym: 'Ar', cat: 'gas', state: GAS,
    colors: ['#d9d2ec', '#cfc7e6'], alpha: 0.2, density: 0.09, rise: 0.2, sink: 0.2, airDrag: 0.4,
    excite: { color: '#c98bff' },
    desc: 'The "lazy" gas: it reacts with nothing, so it smothers flames and shields welds. Glows lavender when a current runs through it.',
    hint: 'Heat Nitrogen with Magnesium: the magnesium soaks up the nitrogen and leaves something lazier behind.',
  },
  {
    key: 'BROMINE', name: 'Bromine', sym: 'Br', cat: 'liquid', state: LIQUID,
    colors: ['#8a1f14', '#7a1a10', '#9a2618'], density: 3.1, conduct: 0.1, spread: 3,
    desc: 'One of only two elements that are liquid at room temperature. Dark red and fuming, and it sets aluminium alight.',
    hint: 'Bubble Chlorine through Salt Water: that\'s how bromine is pulled out of the sea.',
  },
  {
    key: 'KRYPTON', name: 'Krypton', sym: 'Kr', cat: 'gas', state: GAS,
    colors: ['#dcdce8', '#d2d2e0'], alpha: 0.2, density: 0.12, rise: 0.15, sink: 0.3, airDrag: 0.4,
    excite: { color: '#ebe6ff' },
    desc: 'Its name means "the hidden one". Glows brilliant white with a current, and once defined the length of a metre.',
    hint: 'Chill Argon with Cryo; the heavier gases in air condense first.',
  },
  {
    key: 'XENON', name: 'Xenon', sym: 'Xe', cat: 'gas', state: GAS,
    colors: ['#c9d7f0', '#bccce8'], alpha: 0.25, density: 0.2, rise: 0.1, sink: 0.35, airDrag: 0.35,
    excite: { color: '#7fb0ff' },
    desc: 'Heavy noble gas that flashes blue-white in camera flashes and headlights. Unlike its cousins, fluorine can force it to react.',
    hint: 'Chill Krypton with Cryo.',
  },
  {
    key: 'XENON_DIFLUORIDE', name: 'Xenon Difluoride', sym: 'XeF', cat: 'chemical', state: POWDER,
    colors: ['#f4f6fa', '#eaedf3', '#fbfcfe'], density: 4.3,
    high: { temp: 130, to: 'XENON', chance: 0.02 },
    desc: 'White crystals of a compound everyone thought couldn\'t exist: until 1962, noble gases were supposed to be completely unreactive.',
    hint: 'Fluorine is so aggressive it will even attack Xenon.',
  },
  {
    key: 'IODINE', name: 'Iodine', sym: 'I', cat: 'powder', state: POWDER,
    colors: ['#3d2a4a', '#342340', '#463154'], density: 4.9, conduct: 0.1,
    high: { temp: 114, to: 'IODINE_VAPOR', chance: 0.05 },
    desc: 'Shiny blue-black crystals that turn straight into violet vapour when warmed. First found in 1811 in seaweed ash.',
    hint: 'Treat Kelp with Acid, like Bernard Courtois did.',
  },
  {
    key: 'IODINE_VAPOR', name: 'Iodine Vapour', sym: 'Iv', cat: 'gas', state: GAS,
    colors: ['#9a4fd0', '#8a44c0'], alpha: 0.45, density: 0.3, temp: 130, rise: 0.1, sink: 0.3,
    airDrag: 0.35, airCool: 0.003, low: { temp: 90, to: 'IODINE', chance: 0.02 },
    desc: 'Violet vapour that turns back into crystals on anything cool.',
    hint: 'Warm Iodine.',
  },
  {
    key: 'SELENIUM', name: 'Selenium', sym: 'Se', cat: 'solid', state: SOLID, strength: 20,
    colors: ['#6b6f74', '#61656a', '#75797e'], density: 4.8, conduct: 0.2,
    desc: 'Conducts electricity far better in the light than in the dark. That discovery led to the first photocells, and later to photocopiers.',
    hint: 'Dissolve Copper in Acid: selenium turns up in the sludge copper refineries leave behind.',
  },
  {
    key: 'ARSENIC', name: 'Arsenic', sym: 'As', cat: 'solid', state: POWDER,
    colors: ['#8c8f93', '#818488', '#97999d'], density: 5.7, conduct: 0.2,
    high: { temp: 615, to: 'SMOKE', chance: 0.05 },
    desc: 'Grey metalloid that skips melting entirely: heated, it turns straight into a vapour that smells of garlic. Once the poisoner\'s favourite.',
    hint: 'Roast Realgar.',
  },
  {
    key: 'GERMANIUM', name: 'Germanium', sym: 'Ge', cat: 'solid', state: SOLID, strength: 60,
    colors: ['#9aa0a6', '#8f959b', '#a5abb1'], density: 5.3, conduct: 0.4,
    desc: 'Mendeleev\'s "eka-silicon", predicted in 1871 and found in 1886. The first transistors were made from it, and light falling on it makes a current.',
    hint: 'Leach Sphalerite with Acid; germanium hides in zinc ore.',
  },
  {
    key: 'TELLURIUM', name: 'Tellurium', sym: 'Te', cat: 'solid', state: SOLID, strength: 30,
    colors: ['#b9bec4', '#aeb3b9', '#c4c9cf'], density: 6.2, conduct: 0.3,
    desc: 'Brittle silvery metalloid, and the only element that combines with gold in nature.',
    hint: 'Roast Calaverite.',
  },

  // ---- alkali and alkaline earth metals ----------------------------------
  {
    key: 'CALCIUM', name: 'Calcium', sym: 'Ca', cat: 'metal', state: POWDER,
    colors: ['#e4e2dc', '#d8d6cf', '#eeece6'], density: 1.55, conduct: 0.6, flame: '#ff6a3a',
    flammable: 0.02, ignite: 800, burn: { to: 'QUICKLIME', toChance: 0.7, fireTemp: 1500, fireLife: [30, 50] },
    desc: 'Soft metal that fizzes steadily in water, making hydrogen and slaked lime. Burns with an orange-red flame into quicklime.',
    hint: 'Split Limestone with electricity, as Humphry Davy did in 1808.',
  },
  {
    key: 'RUBIDIUM', name: 'Rubidium', sym: 'Rb', cat: 'metal', state: POWDER,
    colors: ['#e2d9c9', '#d6cdbd', '#ece3d3'], density: 1.53, conduct: 0.5,
    desc: 'Alkali metal that bursts into flame the moment it touches water, worse than potassium. Named for the deep red lines in its spectrum.',
    hint: 'Run electricity through Lepidolite.',
  },
  {
    key: 'STRONTIUM', name: 'Strontium', sym: 'Sr', cat: 'metal', state: POWDER,
    colors: ['#e9e0c8', '#ddd4bc', '#f2e9d2'], density: 2.64, conduct: 0.5, flame: '#ff2a2a',
    flammable: 0.05, ignite: 700, burn: { fireTemp: 1400, fireLife: [30, 50] },
    desc: 'Burns with the deep crimson of red fireworks and road flares. Named after Strontian, a village in Scotland.',
    hint: 'Split Celestine with electricity.',
  },
  {
    key: 'BARIUM', name: 'Barium', sym: 'Ba', cat: 'metal', state: POWDER,
    colors: ['#d8d4c4', '#ccc8b8', '#e2ded0'], density: 3.5, conduct: 0.5, flame: '#7dff5a',
    flammable: 0.05, ignite: 700, burn: { fireTemp: 1400, fireLife: [30, 50] }, xrayOpaque: true,
    desc: 'Burns with the apple-green flame of green fireworks. It blocks X-rays, which is why patients drink a "barium meal" before a scan.',
    hint: 'Split Barite with electricity.',
  },

  // ---- transition metals ----------------------------------------------------
  metal('VANADIUM', 'Vanadium', 'V', ['#8a9aa6', '#7f8f9b', '#95a5b1'], 6.0, 1910, 150, {
    desc: 'Hard steel-grey metal named after Vanadís, the Norse goddess of beauty, for its many colourful compounds. A pinch makes steel much tougher.',
    hint: 'Dissolve Vanadinite, the red lead ore, in Acid.',
  }),
  metal('CHROMIUM', 'Chromium', 'Cr', ['#c9d3dc', '#bfc9d2', '#d5dee6'], 7.19, 1907, 170, {
    reflect: 0.8, acidProof: true,
    desc: 'Mirror-bright metal that never tarnishes. A trace of it makes rubies red and emeralds green; added to steel it makes stainless steel.',
    hint: 'Burn Chromite with Aluminum, the way thermite burns rust.',
  }),
  metal('MANGANESE', 'Manganese', 'Mn', ['#a7a39a', '#9c988f', '#b2aea5'], 7.2, 1246, 120, {
    desc: 'Brittle grey metal. Steel can\'t be made without it.',
    hint: 'Burn Pyrolusite with Aluminum.',
  }),
  metal('NICKEL', 'Nickel', 'Ni', ['#b7b09a', '#aca590', '#c2bba5'], 8.9, 1455, 150, {
    desc: 'Tough silvery metal. German miners called its ore Kupfernickel, "copper demon", because it looked like copper ore but yielded none.',
    hint: 'Dissolve the iron out of a Meteorite with Acid; what\'s left is nickel.',
  }),
  metal('ZINC', 'Zinc', 'Zn', ['#b8c2c6', '#aeb8bc', '#c2ccd0'], 7.1, 420, 60, {
    desc: 'Bluish-grey metal. Acid dissolves it in a stream of hydrogen bubbles, and a coat of it keeps steel from rusting.',
    hint: 'Smelt Sphalerite with Coal.',
  }),
  metal('ZIRCONIUM', 'Zirconium', 'Zr', ['#b5b9bd', '#aaaeb2', '#c0c4c8'], 6.5, 1855, 160, {
    acidProof: true,
    desc: 'Neutrons pass straight through it, so nuclear fuel rods are sheathed in it.',
    hint: 'Heat Zircon with Magnesium.',
  }),
  metal('NIOBIUM', 'Niobium', 'Nb', ['#a3a8b5', '#989daa', '#aeb3c0'], 8.57, 2477, 130, {
    desc: 'Named after Niobe, daughter of Tantalus, because it\'s always found with tantalum. MRI magnets are wound from niobium wire.',
    hint: 'Dissolve Coltan in Acid.',
  }),
  metal('MOLYBDENUM', 'Molybdenum', 'Mo', ['#9da3a8', '#92989d', '#a8aeb3'], 10.2, 2623, 190, {
    desc: 'Its name comes from the Greek for lead: its ore was mistaken for lead, and for graphite, until 1778.',
    hint: 'Roast Molybdenite.',
  }),
  {
    key: 'TECHNETIUM', name: 'Technetium', sym: 'Tc', cat: 'nuclear', state: SOLID, strength: 100,
    colors: ['#a9b0b5', '#9ea5aa', '#b4bbc0'], density: 11, conduct: 0.5, conductor: true,
    emits: [{ p: 'ELECTRON', chance: 0.002 }], glowAmount: 0.1,
    decay: { chance: 0.0003, to: 'RUTHENIUM' },
    desc: 'The first element made artificially (1937) and the lightest with no stable form. Hospitals brew it from molybdenum for medical scans.',
    hint: 'Bombard Molybdenum with Neutrons.',
  },
  metal('RUTHENIUM', 'Ruthenium', 'Ru', ['#b6bcc2', '#abb1b7', '#c1c7cd'], 12.4, 2334, 200, {
    acidProof: true,
    desc: 'Hard platinum-group metal named after Russia. Technetium slowly decays into it.',
    hint: 'Wait for Technetium to decay.',
  }),
  metal('RHODIUM', 'Rhodium', 'Rh', ['#dfe4e8', '#d4d9dd', '#e9eef2'], 12.4, 1964, 180, {
    reflect: 0.95, acidProof: true,
    desc: 'The rarest and priciest of the precious metals, and one of the shiniest. Car exhausts use it to clean up fumes.',
    hint: 'Leach Platinum Ore with Nitric Acid.',
  }),
  metal('PALLADIUM', 'Palladium', 'Pd', ['#c9cccf', '#bec1c4', '#d4d7da'], 12.0, 1555, 110, {
    acidProof: true,
    desc: 'Soaks up hydrogen like a sponge: a lump can swallow 900 times its own volume of the gas.',
    hint: 'Leach Platinum Ore with Nitric Acid.',
  }),
  metal('CADMIUM', 'Cadmium', 'Cd', ['#c1c6cc', '#b6bbc1', '#cbd0d6'], 8.65, 321, 40, {
    nAbsorb: 0.9,
    desc: 'Soft metal that swallows neutrons, so reactor control rods are made of it. Its sulfide is the brilliant cadmium yellow of artists\' paints.',
    hint: 'Heat Sphalerite. In 1817 Stromeyer found cadmium in zinc ore that turned yellow when roasted.',
  }),
  metal('HAFNIUM', 'Hafnium', 'Hf', ['#b6b9bd', '#abaeb2', '#c1c4c8'], 13.3, 2233, 170, {
    nAbsorb: 0.8,
    desc: 'Zirconium\'s chemical twin, which is why nobody noticed it until 1923. Unlike zirconium it gobbles neutrons.',
    hint: 'Dissolve Zircon in Acid.',
  }),
  metal('TANTALUM', 'Tantalum', 'Ta', ['#9aa0b0', '#8f95a5', '#a5abbb'], 16.7, 3017, 200, {
    acidProof: true,
    desc: 'Almost nothing corrodes it: like Tantalus in the myth, it stands in acid without taking a drop. Phones are full of tiny tantalum capacitors.',
    hint: 'Run electricity through Coltan.',
  }),
  metal('RHENIUM', 'Rhenium', 'Re', ['#a4a9ae', '#999ea3', '#afb4b9'], 21, 3186, 230, {
    desc: 'The last stable element to be discovered (1925). It melts at 3186 °C, and jet-engine turbine blades depend on it.',
    hint: 'Leach Molybdenite with Acid.',
  }),
  metal('OSMIUM', 'Osmium', 'Os', ['#8e9aad', '#8390a3', '#99a5b8'], 22.6, 3033, 240, {
    acidProof: true,
    desc: 'The densest element: a brick of it would outweigh a person. Named after the sharp smell of its oxide.',
    hint: 'Aqua Regia leaves a black residue behind when it dissolves Platinum Ore.',
  }),
  metal('IRIDIUM', 'Iridium', 'Ir', ['#d0d3d8', '#c5c8cd', '#dbdee3'], 22.5, 2446, 250, {
    acidProof: true,
    desc: 'The most corrosion-proof metal. A thin layer of it in rocks all over the world marks the asteroid impact that ended the dinosaurs.',
    hint: 'Aqua Regia can\'t dissolve everything in Platinum Ore.',
  }),
  metal('PLATINUM', 'Platinum', 'Pt', ['#e0e2e4', '#d5d7d9', '#ebedef'], 21.4, 1768, 130, {
    acidProof: true, reflect: 0.7,
    desc: 'Precious metal that nothing tarnishes. Hydrogen catches fire on its surface without a flame, the trick behind the first lighters in the 1820s.',
    hint: 'Dissolve Platinum Ore in Aqua Regia.',
  }),

  // ---- softer metals ----------------------------------------------------------
  metal('GALLIUM', 'Gallium', 'Ga', ['#c3cdd6', '#b8c2cb', '#ced8e0'], 5.9, 30, 30, {
    high: { temp: 30, to: 'LIQUID_GALLIUM', chance: 0.05 },
    desc: 'Melts at 30 °C, so it melts in your hand. Unlike most metals it expands when it freezes.',
    hint: 'Treat Bauxite with Lye; gallium is a by-product of refining aluminium.',
  }),
  {
    key: 'LIQUID_GALLIUM', name: 'Liquid Gallium', sym: 'Gal', cat: 'liquid', state: LIQUID,
    colors: ['#c9d2da', '#bec7cf', '#d4dde5'], density: 6.1, conduct: 0.4, conductor: true,
    spread: 5, reflect: 0.7, low: { temp: 18, to: 'GALLIUM', chance: 0.02 },
    desc: 'Liquid metal at hand temperature. It soaks into aluminium and turns it to crumbs.',
    hint: 'Warm Gallium above 30 °C.',
  },
  {
    key: 'BRITTLE_ALUMINUM', name: 'Brittle Aluminum', sym: 'bAl', cat: 'metal', state: POWDER,
    colors: ['#a9b2b8', '#9ea7ad', '#b4bdc3'], density: 2.5, conduct: 0.4,
    desc: 'Aluminium ruined by gallium, which slipped between its grains. Now it crumbles at a touch.',
    hint: 'Pour Liquid Gallium onto Aluminum.',
  },
  metal('INDIUM', 'Indium', 'In', ['#c8ccd6', '#bdc1cb', '#d3d7e1'], 7.3, 157, 8, {
    desc: 'So soft a fingernail scratches it, and it squeals when you bend it. Every touchscreen has a clear film of it.',
    hint: 'Run electricity through Sphalerite.',
  }),
  metal('TIN', 'Tin', 'Sn', ['#d3d6d9', '#c8cbce', '#dee1e4'], 7.3, 232, 50, {
    low: { temp: 13, to: 'GREY_TIN', chance: 0.0003 },
    desc: 'Soft silvery metal. Below 13 °C it slowly crumbles into grey powder: "tin pest", which legend blames for Napoleon\'s buttons failing in Russia.',
    hint: 'Smelt Cassiterite with Coal.',
  }),
  {
    key: 'GREY_TIN', name: 'Grey Tin', sym: 'gSn', cat: 'metal', state: POWDER,
    colors: ['#8e9296', '#83878b', '#999da1'], density: 5.8, conduct: 0.2,
    high: { temp: 60, to: 'TIN', chance: 0.01 },
    desc: 'Tin that fell apart in the cold. Warm it up and it turns back into metal.',
    hint: 'Leave Tin somewhere cold, and be patient.',
  },
  {
    key: 'ANTIMONY', name: 'Antimony', sym: 'Sb', cat: 'solid', state: SOLID, strength: 30,
    colors: ['#a7adb4', '#9ca2a9', '#b2b8bf'], density: 6.7, conduct: 0.3, high: melt(631),
    desc: 'Brittle, flaky metalloid. Ancient Egyptians ground its ore into black eyeliner.',
    hint: 'Heat Stibnite with iron (Metal).',
  },
  metal('THALLIUM', 'Thallium', 'Tl', ['#b0b5ae', '#a5aaa3', '#bbc0b9'], 11.9, 304, 15, {
    desc: 'Soft, heavy metal named for the bright green line in its spectrum (thallos, a green shoot). Notoriously poisonous.',
    hint: 'Leach Pyrite with Acid, like the sludge William Crookes found it in.',
  }),
  metal('BISMUTH', 'Bismuth', 'Bi', ['#d9c9cf', '#cebec4', '#e3d3d9'], 9.8, 271, 20, {
    conduct: 0.1, high: { temp: 271, to: 'MOLTEN_BISMUTH', chance: 0.05 },
    desc: 'Heavy pinkish metal that magnets push away. Melt it and let it cool, and it grows rainbow crystals.',
    hint: 'Smelt Galena with Coal; bismuth comes out alongside the lead.',
  }),
  {
    key: 'MOLTEN_BISMUTH', name: 'Molten Bismuth', sym: 'mBi', cat: 'liquid', state: LIQUID,
    colors: ['#ffd08a', '#ffc470', '#ffdb9e'], density: 10, temp: 350, conduct: 0.3, airCool: 0.0008,
    spread: 3, glow: true, low: { temp: 260, to: 'BISMUTH_CRYSTAL', chance: 0.05 },
    desc: 'Molten bismuth. As it cools it crystallises into rainbow hoppers.',
    hint: 'Melt Bismuth. It melts at just 271 °C.',
  },
  {
    key: 'BISMUTH_CRYSTAL', name: 'Bismuth Crystal', sym: 'Bix', cat: 'mineral', state: SOLID, strength: 20,
    colors: ['#d85ad8', '#4ad0e8', '#e8c84a', '#6a6ae8', '#4ae88a'], density: 9.8, conduct: 0.1,
    high: { temp: 271, to: 'MOLTEN_BISMUTH', chance: 0.05 },
    desc: 'Stair-stepped "hopper" crystals. The rainbow is an oxide film only a few atoms thick, which colours light like a soap bubble.',
    hint: 'Let Molten Bismuth cool.',
  },

  // ---- the rare earths ------------------------------------------------------
  {
    key: 'RARE_EARTHS', name: 'Rare Earths', sym: 'REE', cat: 'rareearth', state: POWDER,
    colors: ['#e8e0d0', '#ddd5c4', '#f0e9da'], density: 6,
    desc: 'A mixed powder of elements so alike that chemists spent a century separating them.',
    hint: 'Dissolve Monazite in Acid.',
  },
  {
    key: 'DIDYMIUM', name: 'Didymium', sym: 'Did', cat: 'rareearth', state: POWDER,
    colors: ['#c9b4c8', '#bda8bc', '#d4c0d3'], density: 6.5,
    high: { temp: 1000, to: 'SAMARIUM', chance: 0.01 },
    desc: 'For forty years chemists thought this was one element, the "twin" of lanthanum. In 1885 it turned out to be two, with a third hiding inside.',
    hint: 'Soak Rare Earths in more Acid.',
  },
  rareEarth('SCANDIUM', 'Scandium', 'Sc', ['#d7dbe0', '#cdd1d6', '#e1e5e9'], 2.99, 1541, {
    strength: 110,
    desc: 'Light, strong metal. Mendeleev predicted it in 1871 before anyone had seen it; racing bikes are made with it.',
    hint: 'Run electricity through Ytterbium, where Nilson found it hiding in 1879.',
  }),
  rareEarth('YTTRIUM', 'Yttrium', 'Y', ['#c4c8c9', '#b9bdbe', '#cfd3d4'], 4.47, 1526, {
    desc: 'Named after Ytterby, a Swedish village whose one quarry gave its name to four elements.',
    hint: 'Dissolve Ytterbite in Acid.',
  }),
  rareEarth('LANTHANUM', 'Lanthanum', 'La', ['#c9ccc5', '#bec1ba', '#d4d7d0'], 6.15, 920, {
    desc: 'The first rare earth, "lying hidden" inside cerium until 1839. Camera lenses and hybrid-car batteries are full of it.',
    hint: 'Run electricity through Rare Earths.',
  }),
  rareEarth('CERIUM', 'Cerium', 'Ce', ['#cfc9b8', '#c4beac', '#dad4c3'], 6.77, 795, {
    flammable: 0.05, ignite: 160, flame: '#fff2c0', burn: { fireTemp: 1800, fireLife: [20, 40], flare: true },
    desc: 'The commonest rare earth. Scrape it and the shavings catch fire in the air, which is why lighter flints are made from it.',
    hint: 'Leave Rare Earths in Oxygen: cerium is the one that grabs it first.',
  }),
  rareEarth('PRASEODYMIUM', 'Praseodymium', 'Pr', ['#c7cbb8', '#bcc0ad', '#d2d6c3'], 6.77, 935, {
    desc: '"Green twin", one half of didymium. Glassblowers\' goggles use it to filter out the yellow glare of hot glass.',
    hint: 'Split Didymium with electricity.',
  }),
  rareEarth('NEODYMIUM', 'Neodymium', 'Nd', ['#c2c4cc', '#b7b9c1', '#cdcfd7'], 7.0, 1024, {
    desc: '"New twin", the other half of didymium. With iron and boron it makes the strongest permanent magnets there are.',
    hint: 'Split Didymium with electricity.',
  }),
  rareEarth('PROMETHIUM', 'Promethium', 'Pm', ['#a8e0c0', '#98d4b2', '#b8eccc'], 7.26, 1042, {
    emits: [{ p: 'ELECTRON', chance: 0.004 }], glowAmount: 0.5, selfHeat: 0.02,
    decay: { chance: 0.0006, to: 'SAMARIUM' },
    desc: 'The only radioactive rare earth. It glows faintly and was once painted on watch dials. Decays into samarium.',
    hint: 'Fire Neutrons into Neodymium.',
  }),
  rareEarth('SAMARIUM', 'Samarium', 'Sm', ['#d0cdb8', '#c5c2ad', '#dbd8c3'], 7.52, 1072, {
    nAbsorb: 0.6,
    desc: 'Named after a mineral that was named after a mining official, making it the first element named (indirectly) after a person.',
    hint: 'Heat Didymium; something else crystallises out of it.',
  }),
  rareEarth('EUROPIUM', 'Europium', 'Eu', ['#cfd2c2', '#c4c7b7', '#dadcce'], 5.24, 826, {
    strength: 30, excite: { color: '#ff3a4a' },
    desc: 'Under ultraviolet light it glows red, and euro banknotes use that to foil forgers.',
    hint: 'Reduce Samarium with Zinc; europium is the one that comes out.',
  }),
  rareEarth('GADOLINIUM', 'Gadolinium', 'Gd', ['#bfc2c4', '#b4b7b9', '#caccce'], 7.9, 1313, {
    nAbsorb: 1,
    desc: 'Swallows neutrons better than any other stable element, and is magnetic only when cooler than about 20 °C. Doctors inject it to brighten MRI scans.',
    hint: 'Dissolve Samarium in Acid.',
  }),
  rareEarth('TERBIUM', 'Terbium', 'Tb', ['#c8cabb', '#bdbfb0', '#d3d5c6'], 8.23, 1356, {
    excite: { color: '#5aff7a' },
    desc: 'Glows bright green under ultraviolet, which is where the green in fluorescent lamps and old TV screens came from.',
    hint: 'Dissolve Yttrium in Acid.',
  }),
  rareEarth('DYSPROSIUM', 'Dysprosium', 'Dy', ['#c3c5c0', '#b8bab5', '#ced0cb'], 8.55, 1407, {
    desc: 'Greek for "hard to get at": it took Lecoq de Boisbaudran more than thirty tries to separate it. Wind-turbine magnets need it to stay strong when hot.',
    hint: 'Dissolve Holmium in Acid, and keep trying.',
  }),
  rareEarth('HOLMIUM', 'Holmium', 'Ho', ['#c9c7b8', '#bebcad', '#d4d2c3'], 8.8, 1474, {
    desc: 'Has the strongest magnetic moment of any element, so it\'s used to focus the fields of the most powerful magnets. Named after Stockholm.',
    hint: 'Dissolve Erbium in Acid.',
  }),
  rareEarth('ERBIUM', 'Erbium', 'Er', ['#dcc3c8', '#d0b7bc', '#e8cfd4'], 9.07, 1529, {
    high: { temp: 1500, to: 'YTTERBIUM', chance: 0.01 },
    desc: 'Silvery metal with pink salts. Erbium-laced glass boosts the light in undersea internet cables.',
    hint: 'Dissolve Yttrium in Acid.',
  }),
  rareEarth('THULIUM', 'Thulium', 'Tm', ['#c4c9cb', '#b9bec0', '#cfd4d6'], 9.32, 1545, {
    desc: 'The rarest stable rare earth, named after Thule, the mythical far north.',
    hint: 'Dissolve Erbium in Acid.',
  }),
  rareEarth('YTTERBIUM', 'Ytterbium', 'Yb', ['#cfd1cc', '#c4c6c1', '#dadcd7'], 6.9, 824, {
    strength: 40,
    desc: 'Another element named after Ytterby. Ytterbium atomic clocks are among the most precise ever built.',
    hint: 'Heat Erbium, as Marignac did in 1878.',
  }),
  rareEarth('LUTETIUM', 'Lutetium', 'Lu', ['#c7cacb', '#bcbfc0', '#d2d5d6'], 9.84, 1652, {
    strength: 90,
    desc: 'The last and densest rare earth, split out of ytterbium in 1907 and named after Lutetia, Roman Paris.',
    hint: 'Dissolve Ytterbium in Acid.',
  }),
  {
    key: 'FERROCERIUM', name: 'Ferrocerium', sym: 'FeCe', cat: 'alloy', state: SOLID, strength: 60,
    colors: ['#77736c', '#6c6861', '#827e77'], density: 6.8, conduct: 0.3,
    desc: 'Lighter flint. Strike it with steel and white-hot shavings fly off and catch fire.',
    hint: 'Alloy Cerium with iron (Metal).',
  },
  {
    key: 'NEODYMIUM_MAGNET', name: 'Neodymium Magnet', sym: 'NdB', cat: 'alloy', state: SOLID, strength: 130,
    colors: ['#a3a6ad', '#b8bbc2', '#8e9198'], density: 7.5, conduct: 0.4, behavior: 'magnet', magnet: 4,
    desc: 'Neodymium, iron and boron: the strongest permanent magnet material, with four times the pull of an ordinary magnet.',
    hint: 'Alloy Neodymium with iron (Metal).',
  },

  // ---- actinides ----------------------------------------------------------------
  {
    key: 'ACTINIUM', name: 'Actinium', sym: 'Ac', cat: 'nuclear', state: POWDER,
    colors: ['#dde8ff', '#cfdcf8', '#e8f0ff'], density: 10, selfHeat: 0.1, glowAmount: 0.8,
    emits: [{ p: 'ALPHA', chance: 0.003 }],
    decay: { chance: 0.0006, to: 'THORIUM', alt: 'FRANCIUM', altChance: 0.3 },
    desc: 'So radioactive it glows pale blue in the dark, lighting up the air around it. Decays into thorium, and now and then into francium.',
    hint: 'Radium that catches a Neutron.',
  },
  {
    key: 'FRANCIUM', name: 'Francium', sym: 'Fr', cat: 'nuclear', state: POWDER,
    colors: ['#e8d8b0', '#dccca4', '#f2e2bc'], density: 2.5, selfHeat: 0.3, glowAmount: 0.4,
    emits: [{ p: 'ELECTRON', chance: 0.01 }], decay: { chance: 0.004, to: 'RADIUM' },
    desc: 'The last alkali metal and the least stable natural element: there\'s under a kilogram in the whole Earth at any moment. It would outdo cesium in water.',
    hint: 'Wait for Actinium to decay.',
  },
  {
    key: 'ASTATINE', name: 'Astatine', sym: 'At', cat: 'nuclear', state: POWDER,
    colors: ['#2a2a30', '#34343a', '#3e3e44'], density: 6.4, selfHeat: 0.5, glowAmount: 0.2,
    emits: [{ p: 'ALPHA', chance: 0.01 }], decay: { chance: 0.002, to: 'POLONIUM' },
    desc: 'The rarest natural element: less than a gram exists in the Earth\'s crust at any moment.',
    hint: 'Hit Bismuth with Alpha particles.',
  },
  {
    key: 'PROTACTINIUM', name: 'Protactinium', sym: 'Pa', cat: 'nuclear', state: POWDER,
    colors: ['#c8d0b8', '#bcc4ac', '#d4dcc4'], density: 15.4, glowAmount: 0.15,
    emits: [{ p: 'ELECTRON', chance: 0.001 }], decay: { chance: 0.001, to: 'URANIUM' },
    desc: 'The middle step of the thorium fuel cycle: thorium catches a neutron, becomes protactinium, then decays into uranium that can be split.',
    hint: 'Thorium that catches a Neutron.',
  },
  {
    key: 'NEPTUNIUM', name: 'Neptunium', sym: 'Np', cat: 'nuclear', state: POWDER,
    colors: ['#8a9aa0', '#7e8e94', '#96a6ac'], density: 20.2, glowAmount: 0.1,
    emits: [{ p: 'ALPHA', chance: 0.0005 }], decay: { chance: 0.0002, to: 'PROTACTINIUM' },
    desc: 'The first element beyond uranium, found in 1940 and named after the next planet out, as uranium is named after Uranus.',
    hint: 'Wait for Americium to decay.',
  },
  {
    key: 'AMERICIUM', name: 'Americium', sym: 'Am', cat: 'nuclear', state: POWDER,
    colors: ['#c0c4b0', '#b4b8a4', '#cccfbc'], density: 13.7, selfHeat: 0.02, glowAmount: 0.2,
    emits: [{ p: 'ALPHA', chance: 0.003 }, { p: 'GAMMA', chance: 0.001 }],
    decay: { chance: 0.0004, to: 'NEPTUNIUM', spawn: 'ALPHA' },
    desc: 'A speck sits in most smoke detectors: its alpha particles carry a tiny current across the air until smoke gets in the way.',
    hint: 'Plutonium that catches a Neutron without splitting.',
  },
  {
    key: 'CURIUM', name: 'Curium', sym: 'Cm', cat: 'nuclear', state: POWDER,
    colors: ['#c8b8d8', '#bcacd0', '#d4c4e4'], density: 13.5, selfHeat: 0.3, glowAmount: 0.6,
    emits: [{ p: 'ALPHA', chance: 0.004 }], decay: { chance: 0.0003, to: 'PLUTONIUM' },
    desc: 'Named after Marie and Pierre Curie. It glows purple and keeps itself hot enough to power space probes.',
    hint: 'Hit Plutonium with Alpha particles, as Seaborg\'s team did in 1944.',
  },
  {
    key: 'BERKELIUM', name: 'Berkelium', sym: 'Bk', cat: 'nuclear', state: POWDER,
    colors: ['#b8c8b0', '#acbca4', '#c4d4bc'], density: 14.8, glowAmount: 0.2,
    emits: [{ p: 'ELECTRON', chance: 0.003 }], decay: { chance: 0.0005, to: 'CALIFORNIUM' },
    desc: 'Made in Berkeley in 1949 by hitting americium with alpha particles. Decays into californium.',
    hint: 'Hit Americium with Alpha particles.',
  },
  {
    key: 'CALIFORNIUM', name: 'Californium', sym: 'Cf', cat: 'nuclear', state: POWDER,
    colors: ['#d8d0b0', '#ccc4a4', '#e4dcbc'], density: 15.1, selfHeat: 0.1, glowAmount: 0.3,
    emits: [{ p: 'NEUTRON', chance: 0.004 }],
    desc: 'Splits all by itself, spraying neutrons. A speck of it kick-starts reactors and sniffs out gold and oil underground.',
    hint: 'Hit Curium with Alpha particles.',
  },
  {
    key: 'EINSTEINIUM', name: 'Einsteinium', sym: 'Es', cat: 'nuclear', state: POWDER,
    colors: ['#b8d8f0', '#accce4', '#c4e4fc'], density: 8.8, selfHeat: 0.5, glowAmount: 0.9,
    emits: [{ p: 'ALPHA', chance: 0.004 }], decay: { chance: 0.001, to: 'BERKELIUM' },
    desc: 'Named after Einstein. A sample glows blue and gives off so much heat that it damages its own crystal.',
    hint: 'Californium that catches a Neutron.',
  },
  {
    key: 'FERMIUM', name: 'Fermium', sym: 'Fm', cat: 'nuclear', state: POWDER,
    colors: ['#d0c0e0', '#c4b4d4', '#dcccec'], density: 9.7, selfHeat: 0.5, glowAmount: 0.5,
    emits: [{ p: 'ALPHA', chance: 0.005 }], decay: { chance: 0.002, to: 'CALIFORNIUM' },
    desc: 'Named after Enrico Fermi. The heaviest element that can be built up just by feeding neutrons to lighter ones.',
    hint: 'Einsteinium that catches a Neutron.',
  },
  {
    key: 'MENDELEVIUM', name: 'Mendelevium', sym: 'Md', cat: 'nuclear', state: POWDER,
    colors: ['#c0e0d0', '#b4d4c4', '#ccecdc'], density: 10.3, selfHeat: 0.5, glowAmount: 0.4,
    emits: [{ p: 'ALPHA', chance: 0.006 }], decay: { chance: 0.003, to: 'EINSTEINIUM' },
    desc: 'Named after Mendeleev. The first batch, in 1955, was seventeen atoms, identified one at a time.',
    hint: 'Hit Einsteinium with Alpha particles.',
  },
  superheavy('NOBELIUM', 'Nobelium', 'No', ['#d8e0a8', '#ccd49c', '#e4ecb4'], 'FERMIUM', 0.004, {
    desc: 'Named after Alfred Nobel. Labs in three countries claimed to have found it first, and the argument lasted thirty years.',
    hint: 'Wait for Rutherfordium to decay.',
  }),
  superheavy('LAWRENCIUM', 'Lawrencium', 'Lr', ['#b0c8e0', '#a4bcd4', '#bcd4ec'], 'MENDELEVIUM', 0.004, {
    desc: 'The last actinide, named after Ernest Lawrence, inventor of the cyclotron that made so many of its neighbours.',
    hint: 'Wait for Dubnium to decay.',
  }),
  superheavy('RUTHERFORDIUM', 'Rutherfordium', 'Rf', ['#c8b8b0', '#bcaca4', '#d4c4bc'], 'NOBELIUM', 0.006, {
    desc: 'The first element past the actinides, named after Ernest Rutherford, who first split the atom.',
    hint: 'Wait for Seaborgium to decay.',
  }),
  superheavy('DUBNIUM', 'Dubnium', 'Db', ['#b8c0c8', '#acb4bc', '#c4ccd4'], 'LAWRENCIUM', 0.006, {
    desc: 'Named after Dubna, the Russian town whose lab raced Berkeley to make it; the "Transfermium Wars" over who got there first lasted decades.',
    hint: 'Wait for Bohrium to decay.',
  }),
  superheavy('SEABORGIUM', 'Seaborgium', 'Sg', ['#c0c8b0', '#b4bca4', '#ccd4bc'], 'RUTHERFORDIUM', 0.008, {
    desc: 'Named after Glenn Seaborg while he was still alive, a first. He liked that his address could be written in elements: Sg, Lr, Bk, Cf, Am.',
    hint: 'Wait for Hassium to decay.',
  }),
  superheavy('BOHRIUM', 'Bohrium', 'Bh', ['#b0b8c8', '#a4acbc', '#bcc4d4'], 'DUBNIUM', 0.008, {
    desc: 'Named after Niels Bohr. Only a few dozen atoms of it have ever existed.',
    hint: 'Wait for Meitnerium to decay.',
  }),
  superheavy('HASSIUM', 'Hassium', 'Hs', ['#c8c0b8', '#bcb4ac', '#d4ccc4'], 'SEABORGIUM', 0.008, {
    desc: 'Named after Hesse, the German state where it was made. Chemists have studied its compounds a handful of atoms at a time.',
    hint: 'Wait for Darmstadtium to decay.',
  }),
  superheavy('MEITNERIUM', 'Meitnerium', 'Mt', ['#d0b8c8', '#c4acbc', '#dcc4d4'], 'BOHRIUM', 0.01, {
    desc: 'Named after Lise Meitner, who worked out how nuclear fission works and was left out of the Nobel Prize for it.',
    hint: 'Wait for Roentgenium to decay.',
  }),
  superheavy('DARMSTADTIUM', 'Darmstadtium', 'Ds', ['#b8c8c0', '#acbcb4', '#c4d4cc'], 'HASSIUM', 0.01, {
    desc: 'Made in Darmstadt in 1994 by fusing nickel into lead. It lasts a few seconds at best.',
    hint: 'Wait for Copernicium to decay.',
  }),
  superheavy('ROENTGENIUM', 'Roentgenium', 'Rg', ['#e0d0a0', '#d4c494', '#ecdcac'], 'MEITNERIUM', 0.01, {
    desc: 'Named after Wilhelm Röntgen, discoverer of X-rays. Chemically it should behave like an even heavier gold.',
    hint: 'Wait for Nihonium to decay.',
  }),
  superheavy('COPERNICIUM', 'Copernicium', 'Cn', ['#c8d0d8', '#bcc4cc', '#d4dce4'], 'DARMSTADTIUM', 0.008, {
    state: LIQUID, spread: 4, density: 14,
    desc: 'Named after Copernicus. Relativity makes its electrons so sluggish that it may be a liquid at room temperature, like a super-heavy mercury.',
    hint: 'Wait for Flerovium to decay.',
  }),
  superheavy('NIHONIUM', 'Nihonium', 'Nh', ['#e0b8b8', '#d4acac', '#ecc4c4'], 'ROENTGENIUM', 0.01, {
    desc: 'The first element discovered in Asia, named after Nihon, Japan. The team took nine years to catch three atoms.',
    hint: 'Wait for Moscovium to decay.',
  }),
  superheavy('FLEROVIUM', 'Flerovium', 'Fl', ['#c0c8d0', '#b4bcc4'], 'COPERNICIUM', 0.008, {
    state: GAS, alpha: 0.5, density: 0.5, rise: 0.05, sink: 0.4, airDrag: 0.3,
    desc: 'Named after Georgy Flyorov. It may be the most volatile metal of all; experiments hint it behaves almost like a gas.',
    hint: 'Wait for Livermorium to decay, or fire Calcium Ions at Plutonium.',
  }),
  superheavy('MOSCOVIUM', 'Moscovium', 'Mc', ['#d0c8b0', '#c4bca4', '#dcd4bc'], 'NIHONIUM', 0.01, {
    desc: 'Named after the Moscow region. Made by firing calcium at americium, and gone within a second.',
    hint: 'Wait for Tennessine to decay, or fire Calcium Ions at Americium.',
  }),
  superheavy('LIVERMORIUM', 'Livermorium', 'Lv', ['#b8d0c8', '#acc4bc', '#c4dcd4'], 'FLEROVIUM', 0.008, {
    desc: 'Named after the Lawrence Livermore lab in California. Made by firing calcium at curium.',
    hint: 'Wait for Oganesson to decay, or fire Calcium Ions at Curium.',
  }),
  superheavy('TENNESSINE', 'Tennessine', 'Ts', ['#c8b8d0', '#bcacc4', '#d4c4dc'], 'MOSCOVIUM', 0.01, {
    desc: 'Named after Tennessee, where its berkelium target was made; the target had to be flown to Russia before it decayed.',
    hint: 'Fire Calcium Ions at Berkelium.',
  }),
  superheavy('OGANESSON', 'Oganesson', 'Og', ['#d8d8e8', '#ccccdc', '#e4e4f4'], 'LIVERMORIUM', 0.01, {
    desc: 'Element 118, the end of the table so far. It sits under the noble gases but is probably a solid, and only five atoms have ever been seen.',
    hint: 'Fire Calcium Ions at Californium.',
  }),

  // ---- beams for building new elements ----------------------------------
  {
    key: 'ALPHA', name: 'Alpha Particle', sym: 'α', cat: 'particle', state: ENERGY, projectile: 'alpha',
    colors: ['#ffd27a'], speed: 1.2, charge: 1, life: [25, 40], expire: ['HELIUM'],
    desc: 'A helium nucleus flung out of a decaying atom. A sheet of paper stops it, and where it stops it grabs two electrons and becomes helium.',
    hint: 'Americium throws them off as it decays.',
  },
  {
    key: 'CALCIUM_ION', name: 'Calcium Ion', sym: 'Ca+', cat: 'particle', state: ENERGY, projectile: 'ion',
    colors: ['#ff9a5a'], speed: 2, charge: 1, life: [60, 90], expire: ['CALCIUM'],
    desc: 'A calcium nucleus stripped of its electrons and fired at high speed. Beams of calcium-48 aimed at heavy targets forged the last five elements of the table.',
    hint: 'Blast Calcium with Plasma.',
  },

  // ---- ores -----------------------------------------------------------------------
  ore('FLUORITE', 'Fluorite', 'Flu', ['#8a5ad0', '#6ac08a', '#7a4ac0', '#5ab0e0'], 3.2, 40, {
    transparent: true, excite: { color: '#7a8aff' },
    desc: 'Purple and green crystals that glow under ultraviolet light. The word "fluorescence" was coined for it. Also the ore of fluorine.',
    hint: 'Hot Steam seeping through Limestone deposits it.',
  }),
  ore('GALENA', 'Galena', 'Gn', ['#7d8088', '#72757d', '#888b93'], 7.6, 30, {
    high: { temp: 900, to: 'LEAD', chance: 0.02 },
    desc: 'Heavy, shiny grey cubes of lead ore. Early radios picked up signals with a crystal of it and a "cat\'s whisker" wire.',
    hint: 'Lead that sits in Sulfur.',
  }),
  ore('SPHALERITE', 'Sphalerite', 'Sph', ['#6a4a2a', '#5e4024', '#765430'], 4.0, 35, {
    high: { temp: 900, to: 'CADMIUM', chance: 0.02 },
    desc: 'Brown, resinous zinc ore. Miners called it "blende", the deceiver, because it looks like lead ore but gives no lead. It hides gallium, germanium, indium and cadmium too.',
    hint: 'Sulfur seeping through Limestone.',
  }),
  ore('PYRITE', 'Pyrite', 'Py', ['#c8b04a', '#bca43e', '#d4bc56'], 5.0, 50, {
    reflect: 0.6,
    desc: 'Fool\'s gold: brassy cubes of iron sulfide. Its name means "fire stone", because it throws sparks when struck with steel.',
    hint: 'Metal that sits in Sulfur.',
  }),
  ore('CASSITERITE', 'Cassiterite', 'Cst', ['#3a2a22', '#46342a', '#2e221c'], 7.0, 60, {
    desc: 'Heavy, dark tin ore. Bronze Age traders crossed seas to find it.',
    hint: 'Hot Steam working its way through Granite.',
  }),
  ore('STIBNITE', 'Stibnite', 'Stb', ['#6e737a', '#63686f', '#798085'], 4.6, 20, {
    desc: 'Clusters of steel-grey needle crystals, the ore of antimony.',
    hint: 'Sulfur seeping into Quartz veins.',
  }),
  ore('BARITE', 'Barite', 'Brt', ['#e8e4dc', '#dcd8d0', '#f2eee6'], 4.5, 30, {
    xrayOpaque: true, excite: { color: '#ffb060' },
    desc: 'Heavy white mineral. In 1603 an Italian shoemaker found that roasted "Bologna stone" glowed after sitting in sunlight: the first known glow-in-the-dark material.',
    hint: 'Sulfur meeting Salt Water on the sea floor.',
  }),
  ore('CELESTINE', 'Celestine', 'Cel', ['#a8c8e8', '#9cbcdc', '#b4d4f4'], 3.9, 30, {
    transparent: true,
    desc: 'Sky-blue crystals, named for the colour of the heavens. The ore of strontium.',
    hint: 'Gypsum soaking in Salt Water.',
  }),
  ore('GYPSUM', 'Gypsum', 'Gy', ['#f0ece2', '#e4e0d6', '#f8f4ec'], 2.3, 20, {
    high: { temp: 150, to: 'PLASTER_OF_PARIS', chance: 0.02 },
    desc: 'Soft white mineral left behind when salty lakes dry up. Bake it and you get plaster.',
    hint: 'Salt Water drying out over Limestone.',
  }),
  ore('REALGAR', 'Realgar', 'Rlg', ['#d8402a', '#c83622', '#e44c34'], 3.5, 15, {
    high: { temp: 300, to: 'ARSENIC', chance: 0.02 },
    desc: 'Ruby-red arsenic ore from hot springs. Light slowly ruins it, so museums keep it in the dark.',
    hint: 'Sulfur and Steam at a hot spring.',
  }),
  ore('CHROMITE', 'Chromite', 'Chr', ['#2c2a2a', '#383434', '#222020'], 4.6, 60, {
    desc: 'Black ore of chromium, from rocks that came up from the Earth\'s mantle.',
    hint: 'Rust working its way into Peridot.',
  }),
  ore('PERIDOT', 'Peridot', 'Pdt', ['#9ac43a', '#8cb830', '#a8d046'], 3.3, 90, {
    transparent: true, acidProof: true, pressure: { above: 40, to: 'KIMBERLITE', chance: 0.01 },
    desc: 'Olive-green gem from the Earth\'s mantle, carried up by volcanoes. It turns up in meteorites too.',
    hint: 'Lava rich in Magnesium.',
  }),
  ore('PYROLUSITE', 'Pyrolusite', 'Pyl', ['#2a2a2e', '#343438', '#202024'], 5.0, 30, {
    desc: 'Black manganese ore. Glassmakers called it "glassmaker\'s soap" because a pinch cleared the green out of glass. It makes hydrogen peroxide fizz.',
    hint: 'Nodules that grow on Gravel on the sea floor, under Salt Water.',
  }),
  {
    key: 'BAUXITE', name: 'Bauxite', sym: 'Bx', cat: 'mineral', state: POWDER,
    colors: ['#b8583a', '#a84e32', '#c46444'], density: 2.5, conduct: 0.15,
    desc: 'Red tropical earth, the world\'s aluminium ore. It forms where heavy rain washes everything but the aluminium out of clay.',
    hint: 'Clay left soaking in Water, like soil in the tropics.',
  },
  ore('METEORITE', 'Meteorite', 'Mtr', ['#4a4642', '#57524d', '#3e3b38', '#8a8680'], 7.8, 160, {
    conduct: 0.5, conductor: true, high: melt(1500),
    desc: 'Iron and nickel from space, with a crust burned black on the way down. Cut and etched, it shows a criss-cross pattern that only forms by cooling over millions of years.',
    hint: 'What\'s left when a Meteor lands.',
  }),
  ore('VANADINITE', 'Vanadinite', 'Vnd', ['#d8341a', '#c82c14', '#e44022'], 6.9, 25, {
    desc: 'Bright red hexagonal crystals that form where lead ore weathers in dry country.',
    hint: 'Leave Galena out in the Oxygen.',
  }),
  ore('MOLYBDENITE', 'Molybdenite', 'Mlb', ['#6e737c', '#636871', '#797e87'], 5.0, 15, {
    high: { temp: 600, to: 'MOLYBDENUM', chance: 0.02 },
    desc: 'Soft, greasy grey flakes that were mistaken for graphite until Scheele showed they were something new.',
    hint: 'Graphite and Sulfur look alike. Put them together.',
  }),
  ore('COLTAN', 'Coltan', 'Clt', ['#2c2a30', '#38363c', '#222026'], 6.5, 60, {
    desc: 'Black ore of niobium and tantalum, and the source of the metal in every phone\'s capacitors.',
    hint: 'Cassiterite and Granite side by side in a pegmatite.',
  }),
  ore('ZIRCON', 'Zircon', 'Zrc', ['#b8583a', '#d8a060', '#a04830', '#e0e0d0'], 4.6, 130, {
    transparent: true, emits: [{ p: 'ALPHA', chance: 0.00005 }],
    desc: 'Tough little crystals that survive almost anything. Some from Australia are 4.4 billion years old, the oldest pieces of the Earth ever found.',
    hint: 'Crystals that form as Lava cools with Sand in it.',
  }),
  ore('LEPIDOLITE', 'Lepidolite', 'Lpd', ['#b890c8', '#ac84bc', '#c49cd4'], 2.8, 20, {
    desc: 'Lilac mica full of lithium. Rubidium was first found in it, in 1861, by the colour of its light.',
    hint: 'Lithium soaking into Granite.',
  }),
  ore('CALAVERITE', 'Calaverite', 'Clv', ['#c8bc80', '#bcb074', '#d4c88c'], 9.2, 20, {
    high: { temp: 450, to: 'TELLURIUM', alt: 'GOLD', altChance: 0.5, chance: 0.02 },
    desc: 'Brassy gold telluride. In the 1896 Kalgoorlie gold rush, miners filled potholes with it until someone noticed the streets were paved with gold ore.',
    hint: 'Gold in Quartz veins.',
  }),
  ore('MONAZITE', 'Monazite', 'Mnz', ['#b8784a', '#aa6c40', '#c48454'], 5.1, 25, {
    state: POWDER, emits: [{ p: 'ALPHA', chance: 0.0002 }], glowAmount: 0.03,
    desc: 'Heavy reddish-brown sand that holds most of the rare earths, plus a little thorium.',
    hint: 'Leave Granite under Water and let it weather.',
  }),
  ore('YTTERBITE', 'Ytterbite', 'Ytb', ['#2a2622', '#34302b', '#211e1a'], 4.4, 60, {
    desc: 'Heavy black rock from the Ytterby quarry in Sweden. Four elements are named after the village.',
    hint: 'Look where Quartz meets Granite: that\'s where rare rocks form.',
  }),
  {
    key: 'PLATINUM_ORE', name: 'Platinum Ore', sym: 'PtO', cat: 'mineral', state: POWDER,
    colors: ['#a7a8a3', '#9c9d98', '#b2b3ae'], density: 15, conduct: 0.3,
    desc: 'Grains of "platina", little silver, that Spanish prospectors found in the gold sands of Colombia and threw away as a nuisance.',
    hint: 'Pan Sand that has Gold in it.',
  },
];

export const PERIODIC_REACTIONS = [
  // Fluorine attacks nearly everything.
  { a: 'FLUORITE', b: 'SPARK', chance: 0.1, aTo: 'CALCIUM', bTo: null, spawn: 'FLUORINE' },
  { a: 'FLUORINE', b: 'WATER', chance: 0.2, aTo: 'OXYGEN', bTo: 'HYDROFLUORIC_ACID', heat: 150 },
  { a: 'FLUORINE', b: 'HYDROGEN', chance: 0.5, aTo: 'HYDROFLUORIC_ACID', bTo: 'FIRE', explode: 4 },
  { a: 'FLUORINE', b: 'WOOD', chance: 0.3, aTo: 'EMPTY', bTo: 'FIRE', heat: 300 },
  { a: 'FLUORINE', b: 'GLASS', chance: 0.05, aTo: 'EMPTY', bTo: 'SAND' },
  { a: 'XENON', b: 'FLUORINE', chance: 0.03, aTo: 'XENON_DIFLUORIDE', bTo: 'EMPTY' },

  // Non-metals.
  { a: 'BONE', b: 'COAL', chance: 0.05, minTemp: 800, aTo: 'PHOSPHORUS', bTo: null },
  { a: 'NITROGEN', b: 'MAGNESIUM', chance: 0.05, minTemp: 400, aTo: 'ARGON', bTo: null },
  { a: 'FIRE', b: 'ARGON', chance: 0.3, aTo: 'EMPTY', bTo: null },
  { a: 'SALT_WATER', b: 'CHLORINE', chance: 0.02, aTo: null, bTo: 'BROMINE' },
  { a: 'BROMINE', b: 'ALUMINUM', chance: 0.05, aTo: 'EMPTY', bTo: 'FIRE', heat: 400, explode: 2 },
  { a: 'ARGON', b: 'CRYO', chance: 0.02, aTo: 'KRYPTON', bTo: null },
  { a: 'KRYPTON', b: 'CRYO', chance: 0.02, aTo: 'XENON', bTo: null },
  { a: 'KELP', b: 'ACID', chance: 0.03, aTo: 'IODINE', bTo: 'EMPTY' },
  { a: 'COPPER', b: 'ACID', chance: 0.01, aTo: 'SELENIUM', bTo: 'EMPTY' },
  { a: 'SPHALERITE', b: 'ACID', chance: 0.03, aTo: 'GERMANIUM', bTo: 'EMPTY' },

  // Alkali and alkaline earth metals.
  { a: 'LIMESTONE', b: 'SPARK', chance: 0.05, aTo: 'CALCIUM', bTo: null, spawn: 'CARBON_DIOXIDE' },
  { a: 'CALCIUM', b: 'WATER', chance: 0.02, aTo: 'SLAKED_LIME', bTo: 'HYDROGEN', heat: 60 },
  { a: 'LEPIDOLITE', b: 'SPARK', chance: 0.05, aTo: 'RUBIDIUM', bTo: null },
  { a: 'RUBIDIUM', b: 'WATER', chance: 0.3, aTo: 'LYE', bTo: 'HYDROGEN', explode: 8, heat: 800 },
  { a: 'FRANCIUM', b: 'WATER', chance: 0.4, aTo: 'LYE', bTo: 'HYDROGEN', explode: 14, heat: 1200 },
  { a: 'CELESTINE', b: 'SPARK', chance: 0.05, aTo: 'STRONTIUM', bTo: null },
  { a: 'BARITE', b: 'SPARK', chance: 0.05, aTo: 'BARIUM', bTo: null },
  { a: 'CALCIUM', b: 'PLASMA', chance: 0.1, aTo: 'EMPTY', bTo: null, emit: ['CALCIUM_ION'] },

  // Transition metals.
  { a: 'VANADINITE', b: 'ACID', chance: 0.03, aTo: 'VANADIUM', bTo: 'EMPTY' },
  { a: 'CHROMITE', b: 'ALUMINUM', chance: 0.05, minTemp: 500, aTo: 'CHROMIUM', bTo: 'EMPTY', heat: 300 },
  { a: 'PYROLUSITE', b: 'ALUMINUM', chance: 0.05, minTemp: 500, aTo: 'MANGANESE', bTo: 'EMPTY', heat: 300 },
  { a: 'METEORITE', b: 'ACID', chance: 0.03, aTo: 'NICKEL', bTo: 'EMPTY' },
  { a: 'SPHALERITE', b: 'COAL', chance: 0.04, minTemp: 700, aTo: 'ZINC', bTo: null },
  { a: 'ZINC', b: 'ACID', chance: 0.05, aTo: 'EMPTY', bTo: 'HYDROGEN' },
  { a: 'ZIRCON', b: 'MAGNESIUM', chance: 0.05, minTemp: 500, aTo: 'ZIRCONIUM', bTo: 'EMPTY' },
  { a: 'ZIRCON', b: 'ACID', chance: 0.03, aTo: 'HAFNIUM', bTo: 'EMPTY' },
  { a: 'COLTAN', b: 'ACID', chance: 0.03, aTo: 'NIOBIUM', bTo: 'EMPTY' },
  { a: 'COLTAN', b: 'SPARK', chance: 0.05, aTo: 'TANTALUM', bTo: null },
  { a: 'MOLYBDENITE', b: 'ACID', chance: 0.03, aTo: 'RHENIUM', bTo: 'EMPTY' },
  {
    a: 'PLATINUM_ORE', b: 'AQUA_REGIA', chance: 0.02,
    aTo: 'IRIDIUM', aAlt: 'OSMIUM', aAltChance: 0.5, bTo: 'PLATINUM',
  },
  {
    a: 'PLATINUM_ORE', b: 'NITRIC_ACID', chance: 0.02,
    aTo: 'PALLADIUM', aAlt: 'RHODIUM', aAltChance: 0.4, bTo: 'EMPTY',
  },
  { a: 'PLATINUM', b: 'HYDROGEN', chance: 0.05, aTo: null, bTo: 'FIRE', heat: 100 },
  { a: 'PALLADIUM', b: 'HYDROGEN', chance: 0.2, aTo: null, bTo: 'EMPTY' },

  // Softer metals.
  { a: 'BAUXITE', b: 'LYE', chance: 0.03, aTo: 'ALUMINUM', aAlt: 'GALLIUM', aAltChance: 0.3, bTo: null },
  { a: 'LIQUID_GALLIUM', b: 'ALUMINUM', chance: 0.02, aTo: null, bTo: 'BRITTLE_ALUMINUM' },
  { a: 'SPHALERITE', b: 'SPARK', chance: 0.05, aTo: 'INDIUM', bTo: null },
  { a: 'CASSITERITE', b: 'COAL', chance: 0.04, minTemp: 600, aTo: 'TIN', bTo: null },
  { a: 'STIBNITE', b: 'METAL', chance: 0.04, minTemp: 500, aTo: 'ANTIMONY', bTo: null },
  { a: 'PYRITE', b: 'ACID', chance: 0.03, aTo: 'THALLIUM', bTo: 'EMPTY' },
  { a: 'GALENA', b: 'COAL', chance: 0.04, minTemp: 500, aTo: 'BISMUTH', bTo: null },

  // The rare earths, separated the way they really were.
  { a: 'GRANITE', b: 'WATER', chance: 0.002, aTo: 'MONAZITE', bTo: null },
  { a: 'MONAZITE', b: 'ACID', chance: 0.03, aTo: 'RARE_EARTHS', aAlt: 'THORIUM', aAltChance: 0.15, bTo: 'EMPTY' },
  { a: 'RARE_EARTHS', b: 'SPARK', chance: 0.05, aTo: 'LANTHANUM', bTo: null },
  { a: 'RARE_EARTHS', b: 'OXYGEN', chance: 0.03, aTo: 'CERIUM', bTo: 'EMPTY' },
  { a: 'RARE_EARTHS', b: 'ACID', chance: 0.02, aTo: 'DIDYMIUM', bTo: 'EMPTY' },
  { a: 'DIDYMIUM', b: 'SPARK', chance: 0.05, aTo: 'NEODYMIUM', aAlt: 'PRASEODYMIUM', aAltChance: 0.45, bTo: null },
  { a: 'SAMARIUM', b: 'ZINC', chance: 0.03, aTo: 'EUROPIUM', bTo: null },
  { a: 'SAMARIUM', b: 'ACID', chance: 0.03, aTo: 'GADOLINIUM', bTo: 'EMPTY' },
  { a: 'QUARTZ', b: 'GRANITE', chance: 0.005, aTo: null, bTo: 'YTTERBITE' },
  { a: 'YTTERBITE', b: 'ACID', chance: 0.03, aTo: 'YTTRIUM', bTo: 'EMPTY' },
  { a: 'YTTRIUM', b: 'ACID', chance: 0.03, aTo: 'TERBIUM', aAlt: 'ERBIUM', aAltChance: 0.5, bTo: 'EMPTY' },
  { a: 'ERBIUM', b: 'ACID', chance: 0.03, aTo: 'HOLMIUM', aAlt: 'THULIUM', aAltChance: 0.4, bTo: 'EMPTY' },
  { a: 'HOLMIUM', b: 'ACID', chance: 0.008, aTo: 'DYSPROSIUM', bTo: 'EMPTY' },
  { a: 'YTTERBIUM', b: 'ACID', chance: 0.03, aTo: 'LUTETIUM', bTo: 'EMPTY' },
  { a: 'YTTERBIUM', b: 'SPARK', chance: 0.05, aTo: 'SCANDIUM', bTo: null },
  { a: 'CERIUM', b: 'METAL', chance: 0.02, aTo: 'FERROCERIUM', bTo: null },
  { a: 'FERROCERIUM', b: 'STEEL', chance: 0.02, aTo: 'FIRE', bTo: null },
  { a: 'NEODYMIUM', b: 'METAL', chance: 0.02, aTo: 'NEODYMIUM_MAGNET', bTo: null },

  // Ores.
  { a: 'STEAM', b: 'LIMESTONE', chance: 0.01, aTo: null, bTo: 'FLUORITE' },
  { a: 'LEAD', b: 'SULFUR', chance: 0.01, aTo: 'GALENA', bTo: 'EMPTY' },
  { a: 'GALENA', b: 'OXYGEN', chance: 0.005, aTo: 'VANADINITE', bTo: 'EMPTY' },
  { a: 'SULFUR', b: 'LIMESTONE', chance: 0.01, aTo: 'EMPTY', bTo: 'SPHALERITE' },
  { a: 'METAL', b: 'SULFUR', chance: 0.01, aTo: 'PYRITE', bTo: 'EMPTY' },
  { a: 'PYRITE', b: 'STEEL', chance: 0.01, aTo: 'FIRE', bTo: null },
  { a: 'STEAM', b: 'GRANITE', chance: 0.01, aTo: null, bTo: 'CASSITERITE' },
  { a: 'SULFUR', b: 'QUARTZ', chance: 0.01, aTo: 'EMPTY', bTo: 'STIBNITE' },
  { a: 'SULFUR', b: 'SALT_WATER', chance: 0.01, aTo: 'BARITE', bTo: null },
  { a: 'GYPSUM', b: 'SALT_WATER', chance: 0.01, aTo: 'CELESTINE', bTo: null },
  { a: 'SALT_WATER', b: 'LIMESTONE', chance: 0.002, aTo: null, bTo: 'GYPSUM' },
  { a: 'SULFUR', b: 'STEAM', chance: 0.01, aTo: 'REALGAR', bTo: null },
  { a: 'PERIDOT', b: 'RUST', chance: 0.01, aTo: 'CHROMITE', bTo: 'EMPTY' },
  { a: 'MAGNESIUM', b: 'LAVA', chance: 0.2, aTo: 'PERIDOT', bTo: null },
  { a: 'SALT_WATER', b: 'GRAVEL', chance: 0.003, aTo: null, bTo: 'PYROLUSITE' },
  { a: 'CLAY', b: 'WATER', chance: 0.002, aTo: 'BAUXITE', bTo: null },
  { a: 'GRAPHITE', b: 'SULFUR', chance: 0.01, aTo: 'MOLYBDENITE', bTo: 'EMPTY' },
  { a: 'CASSITERITE', b: 'GRANITE', chance: 0.005, aTo: null, bTo: 'COLTAN' },
  { a: 'LAVA', b: 'SAND', chance: 0.01, aTo: null, bTo: 'ZIRCON' },
  { a: 'LITHIUM', b: 'GRANITE', chance: 0.01, aTo: 'EMPTY', bTo: 'LEPIDOLITE' },
  { a: 'GOLD', b: 'QUARTZ', chance: 0.005, aTo: 'CALAVERITE', bTo: null },
  { a: 'GOLD', b: 'SAND', chance: 0.005, aTo: null, bTo: 'PLATINUM_ORE' },
];

// What particles do to these elements (see PARTICLE_HITS in elements-expansion.js).
export const PERIODIC_HITS = [
  { p: 'PHOTON', t: 'PHOSPHORUS', chance: 0.1, tTo: 'RED_PHOSPHORUS' },
  { p: 'PHOTON', t: 'SELENIUM', chance: 0.6, action: 'spark' },
  { p: 'PHOTON', t: 'GERMANIUM', chance: 0.5, action: 'spark' },
  { p: 'PHOTON', t: 'BARITE', chance: 0.3, action: 'excite' },
  { p: 'UV_LIGHT', t: 'FLUORITE', chance: 0.8, action: 'excite', emit: ['PHOTON'] },
  { p: 'UV_LIGHT', t: 'EUROPIUM', chance: 0.8, action: 'excite', emit: ['PHOTON'] },
  { p: 'UV_LIGHT', t: 'TERBIUM', chance: 0.8, action: 'excite', emit: ['PHOTON'] },
  { p: 'NEUTRON', t: 'MOLYBDENUM', chance: 0.05, tTo: 'TECHNETIUM' },
  { p: 'NEUTRON', t: 'NEODYMIUM', chance: 0.05, tTo: 'PROMETHIUM' },
  { p: 'NEUTRON', t: 'RADIUM', chance: 0.05, tTo: 'ACTINIUM' },
  { p: 'NEUTRON', t: 'AMERICIUM', chance: 0.05, tTo: 'CURIUM' },
  { p: 'NEUTRON', t: 'CURIUM', chance: 0.05, tTo: 'BERKELIUM' },
  { p: 'NEUTRON', t: 'CALIFORNIUM', chance: 0.03, tTo: 'EINSTEINIUM' },
  { p: 'NEUTRON', t: 'EINSTEINIUM', chance: 0.03, tTo: 'FERMIUM' },
  { p: 'ALPHA', t: 'BISMUTH', chance: 0.2, tTo: 'ASTATINE' },
  { p: 'ALPHA', t: 'PLUTONIUM', chance: 0.2, tTo: 'CURIUM' },
  { p: 'ALPHA', t: 'AMERICIUM', chance: 0.2, tTo: 'BERKELIUM' },
  { p: 'ALPHA', t: 'CURIUM', chance: 0.2, tTo: 'CALIFORNIUM' },
  { p: 'ALPHA', t: 'EINSTEINIUM', chance: 0.2, tTo: 'MENDELEVIUM' },
  { p: 'ALPHA', t: 'BERYLLIUM', chance: 0.3, emit: ['NEUTRON'] },
  { p: 'ALPHA', t: 'NITROGEN', chance: 0.1, tTo: 'OXYGEN', emit: ['PROTON'] },
  { p: 'CALCIUM_ION', t: 'PLUTONIUM', chance: 0.2, tTo: 'FLEROVIUM' },
  { p: 'CALCIUM_ION', t: 'AMERICIUM', chance: 0.2, tTo: 'MOSCOVIUM' },
  { p: 'CALCIUM_ION', t: 'CURIUM', chance: 0.2, tTo: 'LIVERMORIUM' },
  { p: 'CALCIUM_ION', t: 'BERKELIUM', chance: 0.2, tTo: 'TENNESSINE' },
  { p: 'CALCIUM_ION', t: 'CALIFORNIUM', chance: 0.2, tTo: 'OGANESSON' },
];

export const PERIODIC_PAIRS = [];
