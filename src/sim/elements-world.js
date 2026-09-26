// The made and living world: alloys, materials, gadgets, plants, food,
// creatures, weather, space, a few legends, and the rest of the particle zoo.
// Field meanings are documented at the top of elements.js.

import { State } from './constants.js';

const { SOLID, POWDER, LIQUID, GAS, ENERGY } = State;

const melt = (temp) => ({ temp, to: 'MOLTEN_METAL', chance: 0.05, remember: true });

const alloy = (key, name, sym, colors, density, meltAt, strength, extra) => ({
  key, name, sym, cat: 'alloy', state: SOLID, colors, density, conduct: 0.6, conductor: true,
  reflect: 0.4, strength, high: melt(meltAt), ...extra,
});
const material = (key, name, sym, state, colors, extra) => ({ key, name, sym, cat: 'material', state, colors, ...extra });
const food = (key, name, sym, state, colors, extra) => ({ key, name, sym, cat: 'food', state, colors, ...extra });
const life = (key, name, sym, state, colors, extra) => ({ key, name, sym, cat: 'life', state, colors, ...extra });

// A creature. It moves itself, so it's a SOLID that the physics leaves alone.
const WATERS = ['WATER', 'SALT_WATER'];
const critter = (key, name, sym, colors, c, extra) => ({
  key, name, sym, cat: 'creature', state: SOLID, colors, strength: 0, density: 1, conduct: 0.1,
  behavior: 'critter', critter: c, ...extra,
});

export const WORLD_ELEMENTS = [
  // ---- alloys -------------------------------------------------------------------
  alloy('BRONZE', 'Bronze', 'Brz', ['#b8783a', '#ac6e34', '#c48444'], 8.8, 950, 130, {
    desc: 'Copper hardened with tin: the first alloy strong enough for tools and weapons. It gave its name to an age.',
    hint: 'Alloy Copper with Tin.',
  }),
  alloy('BRASS', 'Brass', 'Brs', ['#d8b040', '#cca436', '#e4bc4c'], 8.5, 930, 110, {
    reflect: 0.6,
    desc: 'Golden copper-zinc alloy of trumpets and doorknobs. Germs die on its surface within hours.',
    hint: 'Alloy Copper with Zinc.',
  }),
  alloy('PEWTER', 'Pewter', 'Pwt', ['#a8acae', '#9ea2a4', '#b2b6b8'], 7.3, 245, 40, {
    desc: 'Soft grey tin alloy for plates and tankards. Old pewter had lead in it, which slowly poisoned the people drinking from it.',
    hint: 'Alloy Tin with Antimony.',
  }),
  alloy('SOLDER', 'Solder', 'Sld', ['#b8bcbe', '#aeb2b4', '#c2c6c8'], 8.5, 183, 25, {
    desc: 'Melts at 183 °C, lower than tin or lead on its own, so it joins wires without melting them.',
    hint: 'Alloy Tin with Lead.',
  }),
  alloy('ELECTRUM', 'Electrum', 'Elc', ['#e8d890', '#dccc84', '#f4e49c'], 15, 1000, 80, {
    acidProof: true, reflect: 0.8,
    desc: 'Pale gold alloy of gold and silver that occurs naturally. The first coins, in ancient Lydia, were struck from it.',
    hint: 'Alloy Gold with Silver.',
  }),
  alloy('ROSE_GOLD', 'Rose Gold', 'RAu', ['#e8a890', '#dc9c84', '#f4b49c'], 15, 1000, 90, {
    acidProof: true, reflect: 0.8,
    desc: 'Gold blushed pink with copper. Fabergé loved it.',
    hint: 'Alloy Gold with Copper.',
  }),
  alloy('WHITE_GOLD', 'White Gold', 'WAu', ['#e8e8e0', '#dcdcd4', '#f4f4ec'], 16, 1200, 90, {
    acidProof: true, reflect: 0.85,
    desc: 'Gold whitened with palladium, and usually plated with rhodium to make it gleam.',
    hint: 'Alloy Gold with Palladium.',
  }),
  alloy('STERLING_SILVER', 'Sterling Silver', 'Stg', ['#d8dce0', '#ccd0d4', '#e4e8ec'], 10.4, 893, 100, {
    reflect: 0.9,
    desc: '92.5% silver hardened with copper, the standard for silverware since medieval England.',
    hint: 'Alloy Silver with a little Copper.',
  }),
  alloy('STAINLESS_STEEL', 'Stainless Steel', 'SSt', ['#b8c0c8', '#aeb6be', '#c2cad2'], 8, 1450, 220, {
    acidProof: true, reflect: 0.6,
    desc: 'Steel with chromium, which grows an invisible, self-healing skin of oxide. Harry Brearley found it in 1913 while trying to make better gun barrels.',
    hint: 'Alloy Steel with Chromium.',
  }),
  alloy('GALVANIZED_STEEL', 'Galvanized Steel', 'GSt', ['#a8b0b4', '#b4bcc0', '#9ca4a8', '#c0c8cc'], 7.9, 1500, 200, {
    desc: 'Steel coated in zinc. The zinc corrodes first, sacrificing itself to protect the steel.',
    hint: 'Coat Steel with Zinc.',
  }),
  alloy('INVAR', 'Invar', 'Inv', ['#a0a4a8', '#969a9e', '#aaaeb2'], 8.1, 1427, 150, {
    desc: 'Iron-nickel alloy that barely grows or shrinks with temperature. Its discovery won the 1920 Nobel Prize and made clocks far more accurate.',
    hint: 'Alloy iron (Metal) with Nickel.',
  }),
  alloy('NITINOL', 'Nitinol', 'NiTi', ['#8a8e94', '#80848a', '#94989e'], 6.5, 1310, 150, {
    desc: 'Shape-memory metal: bend it however you like, warm it, and it springs back to the shape it was made in.',
    hint: 'Alloy Nickel with Titanium.',
  }),
  alloy('AMALGAM', 'Amalgam', 'Amg', ['#b8bcc0', '#aeb2b6', '#c2c6ca'], 11, 400, 40, {
    desc: 'Silver dissolved in mercury: soft enough to pack into a tooth, then hard. Dentists used it for 150 years.',
    hint: 'Pour Mercury on Silver.',
  }),
  {
    key: 'GALINSTAN', name: 'Galinstan', sym: 'Gis', cat: 'alloy', state: LIQUID,
    colors: ['#c0c8d0', '#b4bcc4', '#ccd4dc'], density: 6.4, conduct: 0.4, conductor: true, spread: 5, reflect: 0.7,
    desc: 'Gallium, indium and tin: a liquid metal at room temperature that replaced mercury in thermometers because it isn\'t poisonous.',
    hint: 'Stir Tin into Liquid Gallium.',
  },
  {
    key: 'NAK', name: 'NaK', sym: 'NaK', cat: 'alloy', state: LIQUID,
    colors: ['#d8d4dc', '#cec8d2', '#e2dee6'], density: 0.87, conduct: 0.5, conductor: true, spread: 5,
    desc: 'Sodium and potassium melt together into a liquid metal that flows like mercury and explodes in water. Some reactors used it as coolant.',
    hint: 'Press Sodium and Potassium together.',
  },
  alloy('WOODS_METAL', 'Wood\'s Metal', 'WdM', ['#b8b4b8', '#aeaaae', '#c2bec2'], 9.7, 70, 20, {
    desc: 'An alloy of bismuth, lead, tin and cadmium that melts at 70 °C, in hot water. Joke teaspoons made of it melt in your tea. (Named after Barnabas Wood, not the tree.)',
    hint: 'Alloy Bismuth with Lead.',
  }),
  alloy('DURALUMIN', 'Duralumin', 'Dur', ['#b8c0c4', '#aeb6ba', '#c2cace'], 2.8, 640, 150, {
    desc: 'Aluminium toughened with copper, found when a sample left over a weekend turned out stronger on Monday. Zeppelins were built from it.',
    hint: 'Alloy Aluminum with Copper.',
  }),
  alloy('TUNGSTEN_CARBIDE', 'Tungsten Carbide', 'WC', ['#5a5e64', '#50545a', '#64686e'], 15.6, 2870, 300, {
    desc: 'One of the hardest materials ever made: drill bits, saw teeth and ballpoint pen balls.',
    hint: 'Bake Tungsten with Graphite at 1400 °C.',
  }),
  alloy('ORICHALCUM', 'Orichalcum', 'Ori', ['#e8a840', '#dc9c34', '#f4b44c'], 9, 950, 120, {
    cat: 'special', glowAmount: 0.1,
    desc: 'The legendary metal of Atlantis, second only to gold. In 2015 divers found 39 ingots of it in a shipwreck off Sicily: it was a kind of brass.',
    hint: 'Alloy Brass with Gold.',
  }),

  // ---- materials ------------------------------------------------------------------
  material('FROSTED_GLASS', 'Frosted Glass', 'FGl', SOLID, ['#d8e8ee', '#cfe0e8', '#e0eef4'], {
    strength: 25, density: 2.5, acidProof: true, high: { temp: 1600, to: 'MOLTEN_GLASS', chance: 0.02 },
    desc: 'Glass etched to a milky satin frost by hydrofluoric acid.',
    hint: 'Etch Glass with Hydrofluoric Acid.',
  }),
  material('BOROSILICATE', 'Borosilicate Glass', 'BSG', SOLID, ['#c8e4ec', '#bcd8e0', '#d4f0f8'], {
    strength: 40, density: 2.2, transparent: true, uvBlock: true, acidProof: true,
    high: { temp: 1650, to: 'MOLTEN_GLASS', chance: 0.02 },
    desc: 'Lab glass. Boron stops it expanding when heated, so it survives going straight from freezer to flame.',
    hint: 'Melt Boron into Glass.',
  }),
  material('LEAD_CRYSTAL', 'Lead Crystal', 'LCr', SOLID, ['#e8f4fc', '#dceef8', '#f4fcff'], {
    strength: 25, density: 3.1, transparent: true, uvBlock: true, sparkle: true,
    desc: 'Glass with lead in it, which makes it heavy, sparkly, and ring when tapped.',
    hint: 'Melt Lead into Glass.',
  }),
  material('STAINED_GLASS', 'Stained Glass', 'SGl', SOLID, ['#d83a3a', '#3a8ad8', '#3ab86a', '#e8c83a', '#9a4ad8'], {
    strength: 25, density: 2.5, transparent: true, uvBlock: true,
    desc: 'Glass coloured with metal oxides. Medieval windows get their blues from cobalt and their greens from copper.',
    hint: 'Melt Copper into Glass.',
  }),
  material('URANIUM_GLASS', 'Uranium Glass', 'UGl', SOLID, ['#c8f070', '#bce464', '#d4fc7c'], {
    strength: 25, density: 2.6, transparent: true, emits: [{ p: 'ELECTRON', chance: 0.0002 }],
    excite: { color: '#6aff5a' },
    desc: 'Vaseline-yellow glass that glows vivid green under ultraviolet. It\'s very slightly radioactive, and people collect it.',
    hint: 'Melt Yellowcake into Glass.',
  }),
  material('CRANBERRY_GLASS', 'Cranberry Glass', 'CGl', SOLID, ['#c81a4a', '#b81442', '#d42456'], {
    strength: 25, density: 2.6, transparent: true, uvBlock: true,
    desc: 'Gold dissolved in glass as specks too small to see turns it ruby red. The Romans\' Lycurgus Cup, which changes colour in the light, works the same way.',
    hint: 'Melt Gold into Glass.',
  }),
  material('FIBERGLASS', 'Fiberglass', 'FbG', SOLID, ['#e8e0c8', '#dcd4bc', '#f4ecd4'], {
    strength: 60, density: 1.8, acidProof: true, conduct: 0.04,
    desc: 'Glass fibres set in plastic resin: light, strong and rot-proof. Boats, surfboards and wind-turbine blades.',
    hint: 'Weave Glass into Plastic.',
  }),
  material('REINFORCED_CONCRETE', 'Reinforced Concrete', 'RCc', SOLID, ['#a3a39e', '#999994', '#6a6e72'], {
    strength: 150, density: 2.5, conduct: 0.15, nAbsorb: 0.15,
    desc: 'Concrete poured around steel bars. Concrete resists crushing, steel resists stretching, and together they hold up the modern world.',
    hint: 'Pour Wet Concrete around Steel.',
  }),
  material('ROMAN_CONCRETE', 'Roman Concrete', 'RoC', SOLID, ['#b8b0a0', '#aca494', '#c4bcac'], {
    strength: 90, density: 2.3, conduct: 0.1,
    desc: 'Volcanic ash and lime. Roman harbour walls have stood in the sea for 2000 years, growing stronger as seawater grows new crystals inside them.',
    hint: 'Mix Pumice into Slaked Lime.',
  }),
  material('ADOBE', 'Adobe', 'Adb', SOLID, ['#b88a5a', '#ac7e4e', '#c49666'], {
    strength: 25, density: 1.7, conduct: 0.08,
    desc: 'Sun-dried bricks of mud and straw, one of the oldest building materials. Some adobe towns have been lived in for a thousand years.',
    hint: 'Mix Mud with Grass for straw.',
  }),
  material('PLASTER', 'Plaster', 'Pls', SOLID, ['#f2f0ea', '#e8e6e0', '#faf8f2'], {
    strength: 20, density: 1.5, conduct: 0.05,
    desc: 'Set plaster, for casts, walls and sculptures.',
    hint: 'Let Wet Plaster set.',
  }),
  material('PORCELAIN', 'Porcelain', 'Por', SOLID, ['#f8f8fa', '#f0f0f4', '#ffffff', '#3a5ab0'], {
    strength: 60, density: 2.4, conduct: 0.05, acidProof: true,
    desc: 'Kaolin fired at 1300 °C into white, glassy china that rings when tapped. Europeans prized it so much they called it "white gold".',
    hint: 'Fire Kaolin at 1300 °C.',
  }),
  material('ASPHALT', 'Asphalt', 'Asp', SOLID, ['#2e2e30', '#383838', '#252527', '#4a4a4a'], {
    strength: 30, density: 2.3, high: { temp: 150, to: 'TAR', chance: 0.01 },
    desc: 'Tar and gravel: roads. It softens and gets sticky in a heatwave.',
    hint: 'Mix Tar with Gravel.',
  }),
  material('GLUE', 'Glue', 'Glu', LIQUID, ['#f4f2ea', '#eae8e0'], {
    density: 1.1, spread: 1, viscosity: 0.8, sticky: true,
    desc: 'Sticky glue, like the hide glue made by boiling bones for thousands of years.',
    hint: 'Steam Bones.',
  }),
  material('SLIME', 'Slime', 'Slm', LIQUID, ['#7ae05a', '#6ad44c', '#8aec6a'], {
    density: 1.2, spread: 1, viscosity: 0.95, sticky: true,
    desc: 'Stretchy, gloopy polymer that flows slowly and holds together.',
    hint: 'Mix Borax into Glue.',
  }),
  material('STYROFOAM', 'Styrofoam', 'Sty', SOLID, ['#fbfbfb', '#f4f4f4', '#ffffff'], {
    strength: 5, density: 0.05, conduct: 0.01, flammable: 0.3, ignite: 350, burn: { smoke: 0.9 },
    desc: 'Plastic puffed full of gas: about 95% air. It floats, insulates, and collapses dramatically in acetone.',
    hint: 'Puff up Plastic with Propane.',
  }),
  material('GOO', 'Goo', 'Goo', LIQUID, ['#e8e4d8', '#dedace'], {
    density: 1.0, spread: 1, viscosity: 0.9, sticky: true,
    desc: 'What\'s left of styrofoam once acetone lets the air out: a spoonful of sticky plastic.',
    hint: 'Pour Acetone on Styrofoam.',
  }),
  material('TEFLON', 'Teflon', 'PTFE', SOLID, ['#f6f6f4', '#eeeeec', '#fcfcfa'], {
    strength: 30, density: 2.2, conduct: 0.05, acidProof: true,
    desc: 'Almost nothing sticks to it or dissolves it. It was found by accident in 1938 when a cylinder of gas turned into a white powder.',
    hint: 'Let Fluorine attack Plastic.',
  }),
  material('SILICONE', 'Silicone', 'Slc', SOLID, ['#d8e0e8', '#ccd4dc', '#e4ecf4'], {
    strength: 20, density: 1.1, conduct: 0.05, acidProof: true,
    desc: 'Rubbery silicon polymer that shrugs off heat: oven gloves, bakeware and bathroom sealant.',
    hint: 'Combine Silicon with Oil.',
  }),
  material('NYLON', 'Nylon', 'Nyl', SOLID, ['#f2f0e8', '#e8e6de', '#faf8f0'], {
    strength: 35, density: 1.15, flammable: 0.02, ignite: 350, high: { temp: 260, to: 'GOO', chance: 0.02 },
    desc: 'The first fully synthetic fibre (1935). When nylon stockings went on sale, queues stretched round the block.',
    hint: 'Build Plastic with Ammonia.',
  }),
  material('WAX', 'Wax', 'Wax', SOLID, ['#f4ecd0', '#eae2c4', '#fcf4da'], {
    strength: 5, density: 0.9, conduct: 0.05, flammable: 0.02, ignite: 300,
    burn: { fireTemp: 800, fireLife: [60, 120] }, high: { temp: 60, to: 'MOLTEN_WAX', chance: 0.05 },
    desc: 'Paraffin wax, the waxy part of crude oil. It melts at 60 °C and floats on water.',
    hint: 'Chill Oil until the waxy part sets.',
  }),
  material('MOLTEN_WAX', 'Molten Wax', 'MWx', LIQUID, ['#f0e0a0', '#e8d890'], {
    temp: 80, density: 0.8, spread: 3, viscosity: 0.3, airCool: 0.002, low: { temp: 55, to: 'WAX', chance: 0.05 },
    flammable: 0.1, ignite: 250, burn: { fireLife: [40, 80] },
    desc: 'Clear melted wax. It floats up through water in blobs, like a lava lamp.',
    hint: 'Melt Wax.',
  }),
  material('CANDLE', 'Candle', 'Cdl', SOLID, ['#f8f0e0', '#f0e8d8', '#fff8ea'], {
    strength: 5, density: 0.9, flammable: 0.3, ignite: 250, burn: { fireTemp: 900, fireLife: [300, 500] },
    desc: 'Wax with a cotton wick. Lit, it burns for a long time with a small steady flame.',
    hint: 'Put a Cotton wick in Wax.',
  }),
  material('INK', 'Ink', 'Ink', LIQUID, ['#101018', '#181820', '#0c0c12'], {
    density: 1.05, spread: 5,
    desc: 'India ink: lampblack stirred into hide glue, the recipe used for 2000 years.',
    hint: 'Stir Soot into Glue.',
  }),
  material('PULP', 'Pulp', 'Plp', LIQUID, ['#e8e0d0', '#dcd4c4'], {
    density: 1.1, spread: 1, viscosity: 0.8, pressure: { above: 10, to: 'PAPER', chance: 0.02 },
    desc: 'Wood cooked down to a mush of fibres. Press the water out and you have paper.',
    hint: 'Cook Wood in Lye.',
  }),
  material('PAPER', 'Paper', 'Ppr', SOLID, ['#f8f6f0', '#f0eee8', '#fffefa'], {
    strength: 3, density: 0.8, flammable: 0.5, ignite: 233, burn: { ash: 0.3, smoke: 0.2, fireLife: [15, 30] },
    desc: 'Pressed wood fibres. It catches fire at about 233 °C, which is 451 °F.',
    hint: 'Press Pulp.',
  }),
  material('CARDBOARD', 'Cardboard', 'Cbd', SOLID, ['#b8905a', '#ac844e', '#c49c66'], {
    strength: 8, density: 0.7, flammable: 0.2, ignite: 260, burn: { ash: 0.4, smoke: 0.3 },
    desc: 'Paper glued in layers around a wavy middle, far stiffer than the paper it\'s made from.',
    hint: 'Glue Paper together.',
  }),
  material('PHOTO_PAPER', 'Photo Paper', 'PhP', SOLID, ['#f4f4f0', '#eaeae6'], {
    strength: 3, density: 0.8, flammable: 0.5, ignite: 233, burn: { ash: 0.3 },
    desc: 'Paper coated in light-sensitive silver salts. Wherever light or X-rays touch it, it darkens.',
    hint: 'Coat Paper with Silver Chloride.',
  }),
  material('PHOTOGRAPH', 'Photograph', 'Pho', SOLID, ['#2a2a2a', '#5a5a5a', '#8a8a8a', '#c8c8c8'], {
    strength: 3, density: 0.8, flammable: 0.5, ignite: 233, burn: { ash: 0.3 },
    desc: 'An image written in silver wherever the light fell.',
    hint: 'Expose Photo Paper to light.',
  }),
  material('COTTON', 'Cotton', 'Ctn', POWDER, ['#fbfbf8', '#f4f4f0', '#ffffff'], {
    density: 0.3, fallRate: 0.4, airDrag: 0.15, flammable: 0.4, ignite: 250,
    burn: { ash: 0.2, smoke: 0.3, fireLife: [10, 20] }, pressure: { above: 10, to: 'CLOTH', chance: 0.02 },
    desc: 'Fluffy seed fibres from the cotton plant, nearly pure cellulose.',
    hint: 'A Flower with a Cloud caught in it.',
  }),
  material('CLOTH', 'Cloth', 'Clo', SOLID, ['#e8e0d0', '#dcd4c4', '#f4ecdc'], {
    strength: 6, density: 0.9, flammable: 0.2, ignite: 250, burn: { ash: 0.3, smoke: 0.4 },
    desc: 'Woven cotton.',
    hint: 'Press Cotton together tightly.',
  }),
  material('SILK', 'Silk', 'Slk', SOLID, ['#f4f4f8', '#eaeaee', '#fcfcff'], {
    strength: 30, density: 1.3, flammable: 0.3, ignite: 250, burn: { ash: 0.2 },
    desc: 'Spider silk, weight for weight stronger than steel. It\'s spun as a liquid and hardens as it\'s pulled.',
    hint: 'Let a Spider wander about.',
  }),
  material('LATEX', 'Latex', 'Ltx', LIQUID, ['#f8f6ec', '#f0eee4'], {
    density: 0.95, spread: 2, viscosity: 0.6, high: { temp: 80, to: 'RUBBER', chance: 0.02 },
    desc: 'Milky sap tapped from rubber trees. Warm it and it dries into rubber.',
    hint: 'Milky sap from Wood: try Milk.',
  }),
  material('RUBBER', 'Rubber', 'Rbr', SOLID, ['#3a3230', '#443a38', '#302826'], {
    strength: 20, density: 0.95, conduct: 0.05, flammable: 0.02, ignite: 300, burn: { smoke: 0.9 },
    high: { temp: 250, to: 'GOO', chance: 0.02 },
    desc: 'Raw natural rubber: stretchy, but sticky in the heat and brittle in the cold.',
    hint: 'Warm Latex until it dries.',
  }),
  material('VULCANIZED_RUBBER', 'Vulcanized Rubber', 'VRb', SOLID, ['#1e1e20', '#28282a', '#161618'], {
    strength: 40, density: 1.1, conduct: 0.05, flammable: 0.01, ignite: 350, burn: { smoke: 0.9, fireLife: [200, 300] },
    desc: 'Rubber cooked with sulfur. Charles Goodyear found it in 1839 when he dropped some on a hot stove; it stays springy whatever the weather. Every tyre is made of it.',
    hint: 'Cook Rubber with Sulfur.',
  }),
  material('MATCH', 'Match', 'Mch', SOLID, ['#c8a070', '#bc9464', '#8a2a2a'], {
    strength: 5, density: 0.6, flammable: 0.9, ignite: 150, burn: { smoke: 0.4, fireTemp: 900, fireLife: [30, 60] },
    desc: 'A splint of wood with a head that bursts into flame at the slightest heat.',
    hint: 'Tip Wood with Red Phosphorus.',
  }),
  material('SPONGE', 'Sponge', 'Spg', SOLID, ['#f0d860', '#e4cc54', '#fce46c'], {
    strength: 5, density: 0.2,
    desc: 'Foam full of open holes that suck up water.',
    hint: 'Plastic foamed with Bubbles.',
  }),
  material('WET_SPONGE', 'Wet Sponge', 'WSp', SOLID, ['#c8b040', '#bca434', '#d4bc4c'], {
    strength: 5, density: 1.0, pressure: { above: 5, to: 'SPONGE', chance: 0.1 }, wet: true,
    desc: 'A sponge full of water. Squeeze it and the water runs out.',
    hint: 'Let a Sponge soak up Water.',
  }),
  material('AEROGEL', 'Aerogel', 'Agl', SOLID, ['#c8dcf0', '#bcd0e8', '#d4e8fc'], {
    strength: 3, density: 0.01, conduct: 0.001, airCool: 0.00005, transparent: true,
    desc: '"Frozen smoke": a glass foam that is 99.8% air, the lightest solid ever made. A sliver can shield a hand from a blowtorch.',
    hint: 'Dry out a Sand gel in hot Alcohol.',
  }),
  material('CARBON_FIBER', 'Carbon Fiber', 'CFb', SOLID, ['#2a2a2e', '#343438', '#202024', '#3e3e44'], {
    strength: 180, density: 1.6, conduct: 0.4, conductor: true,
    desc: 'Threads of carbon set in plastic: stronger than steel at a fifth of the weight. Racing cars and aircraft are built from it.',
    hint: 'Weave Graphite into Plastic.',
  }),
  material('GRAPHENE', 'Graphene', 'Gph', SOLID, ['#4a4e54', '#40444a', '#54585e'], {
    strength: 250, density: 2.2, conduct: 1.0, conductor: true,
    desc: 'A single layer of carbon atoms, the strongest material ever measured. It was first made in 2004 by peeling graphite with sticky tape, which won a Nobel Prize.',
    hint: 'Peel Graphite with Glue, the sticky-tape way.',
  }),
  material('FULLERENE', 'Fullerene', 'C60', POWDER, ['#3a2a3a', '#443444', '#302030'], {
    density: 1.7,
    desc: 'Buckyballs: sixty carbon atoms in the shape of a football, found in 1985 by blasting graphite with a laser. Named after the architect of geodesic domes.',
    hint: 'Blast Graphite with a Laser.',
  }),
  material('STEEL_WOOL', 'Steel Wool', 'SWl', SOLID, ['#8a9096', '#80868c', '#949aa0'], {
    strength: 10, density: 1, conduct: 0.3, conductor: true, sparkHeat: 150,
    flammable: 0.3, ignite: 400, flame: '#ffd080', burn: { fireTemp: 1500, fireLife: [10, 20], flare: true },
    desc: 'Steel in hair-thin strands. Touch a battery to it and the current makes it burn in a shower of sparks.',
    hint: 'Spin Steel like Cotton.',
  }),
  material('BIOPLASTIC', 'Bioplastic', 'BPl', SOLID, ['#e8dcb0', '#dcd0a4', '#f4e8bc'], {
    strength: 12, density: 1.2, flammable: 0.05, ignite: 300, burn: { smoke: 0.5 },
    desc: 'Plastic cooked from starch and vinegar. Bacteria can eat it, so it rots away instead of lasting for centuries.',
    hint: 'Cook Starch with Vinegar.',
  }),
  material('MICROPLASTIC', 'Microplastic', 'MPl', POWDER, ['#e8f0f8', '#f8e8e8', '#e8f8e8', '#f8f8e0'], {
    density: 0.95, fallRate: 0.6,
    desc: 'Plastic ground into specks too small to see. It\'s now found everywhere from the top of Everest to the deepest ocean trench.',
    hint: 'Grind Plastic under Pressure.',
  }),

  // ---- devices -------------------------------------------------------------------
  {
    key: 'LIGHT_BULB', name: 'Light Bulb', sym: 'Blb', cat: 'device', state: SOLID, strength: 20,
    colors: ['#f8f4e0', '#fff8e8', '#ece8d0'], density: 2.5, conduct: 0.3, conductor: true, sparkHeat: 60,
    airCool: 0.02, hotEmit: { temp: 400, chance: 0.2 },
    desc: 'A tungsten filament in a glass bulb. Run a current through it and it glows, shining light.',
    hint: 'Put Tungsten inside Glass.',
  },
  {
    key: 'LED', name: 'LED', sym: 'LED', cat: 'device', state: SOLID, strength: 30,
    colors: ['#3a4a8a', '#34447c', '#404e96'], density: 2.3, conduct: 0.3, conductor: true, sparkHeat: 0,
    transparent: true, excite: { color: '#4a7aff' },
    desc: 'A light-emitting diode: current makes the crystal itself glow, with barely any heat. Blue ones were so hard to make that their inventors won a Nobel Prize in 2014.',
    hint: 'Silicon doped with Gallium.',
  },
  {
    key: 'ELECTROMAGNET', name: 'Electromagnet', sym: 'EM', cat: 'device', state: SOLID, strength: 150,
    colors: ['#b8783a', '#6a6e76', '#c48444', '#747880'], density: 7.8, conduct: 0.6, conductor: true,
    behavior: 'electromagnet', magnet: 3,
    desc: 'An iron core wrapped in copper wire. It\'s only a magnet while current flows, so a battery switches it on.',
    hint: 'Wrap Copper around iron (Metal).',
  },
  {
    key: 'NICHROME', name: 'Nichrome', sym: 'NiCr', cat: 'device', state: SOLID, strength: 160,
    colors: ['#8a8e92', '#808488', '#94989c'], density: 8.4, conduct: 0.3, conductor: true, sparkHeat: 12,
    airCool: 0.004,
    high: melt(1400),
    desc: 'Nickel-chromium wire that turns electricity into heat without burning out: the glowing coils in toasters and hair dryers.',
    hint: 'Alloy Nickel with Chromium.',
  },
  {
    key: 'POTATO_BATTERY', name: 'Potato Battery', sym: 'PBt', cat: 'device', state: SOLID, strength: 5,
    colors: ['#c8a060', '#bc9454', '#d4ac6c', '#8a9096'], density: 1.1, behavior: 'battery', batteryRate: 0.05,
    desc: 'A potato with zinc stuck in it: a weak battery. The energy comes from the zinc dissolving, not from the potato.',
    hint: 'Stick Zinc into a Potato.',
  },
  {
    key: 'RTG', name: 'RTG', sym: 'RTG', cat: 'device', state: SOLID, strength: 100,
    colors: ['#5a5e64', '#4a4e54', '#e86a3a'], density: 8, conduct: 0.4, behavior: 'battery', batteryRate: 0.2,
    emits: [{ p: 'ALPHA', chance: 0.001 }], glowAmount: 0.3,
    desc: 'A radioisotope generator: plutonium\'s heat turned straight into electricity. Voyager 1 has been running on them since 1977.',
    hint: 'Wrap Plutonium in Germanium thermocouples.',
  },

  {
    key: 'GLOWSTICK', name: 'Glowstick', sym: 'Glw', cat: 'device', state: SOLID, strength: 10,
    colors: ['#5aff5a', '#4af04a', '#6aff6a'], density: 1.1, glowAmount: 1.2,
    life: [1500, 2500], behavior: 'decay', lifeEnd: { to: 'PLASTIC' },
    desc: 'A plastic tube of chemicals that glow when mixed. It fades after a while and is left as plain plastic.',
    hint: 'Seal Cold Light in Plastic.',
  },
  {
    key: 'SPARKLER', name: 'Sparkler', sym: 'Spk', cat: 'explosive', state: SOLID, strength: 10,
    colors: ['#8a8e94', '#6a6e74', '#9a9ea4'], density: 2, flammable: 0.3, ignite: 300, flame: '#fff0c0',
    burn: { fireTemp: 1500, fireLife: [300, 500], flare: true },
    desc: 'Iron filings in a slow-burning coat on a wire. Each spark is a flake of iron burning white-hot in the air.',
    hint: 'Coat a Fuse with iron (Metal).',
  },
  {
    key: 'FLARE', name: 'Road Flare', sym: 'RFl', cat: 'explosive', state: SOLID, strength: 10,
    colors: ['#c83a3a', '#b83434', '#d44444'], density: 1.5, flammable: 0.3, ignite: 250, flame: '#ff2a2a',
    burn: { fireTemp: 1600, fireLife: [400, 600], flare: true },
    desc: 'Strontium burning a brilliant red for a quarter of an hour.',
    hint: 'Pack Strontium around a Fuse.',
  },

  // ---- plants and fungi ----------------------------------------------------------
  life('CACTUS', 'Cactus', 'Cac', SOLID, ['#4a8a3a', '#407e32', '#549644'], {
    strength: 8, density: 0.9, flammable: 0.02, ignite: 300, burn: { ash: 0.4 },
    behavior: 'stalk', stalk: { height: [3, 8], rate: 0.02 },
    desc: 'A plant that stores water in its swollen stem and swapped its leaves for spines. It grows straight up out of sand.',
    hint: 'A Plant that learns to live in Sand.',
  }),
  life('KELP', 'Kelp', 'Klp', SOLID, ['#6a7a2a', '#5e6e24', '#768630'], {
    strength: 5, density: 1.0, flammable: 0.01, ignite: 300, burn: { ash: 0.5 },
    behavior: 'stalk', stalk: { height: [6, 18], rate: 0.05, into: ['WATER', 'SALT_WATER'] },
    desc: 'Giant seaweed that can grow half a metre a day, rising in underwater forests. Its ash was once the world\'s source of iodine.',
    hint: 'Algae that anchors itself to Stone.',
  }),
  life('CORAL', 'Coral', 'Crl', SOLID, ['#e87a6a', '#f09a5a', '#d85a8a', '#f0c86a'], {
    strength: 20, density: 1.5, grow: { into: ['SALT_WATER'], chance: 0.001 }, behavior: 'grow',
    high: { temp: 35, to: 'LIMESTONE', chance: 0.005 },
    desc: 'A colony of tiny animals that build limestone skeletons, fed by algae living inside them. Too warm and they expel the algae and bleach to bare limestone.',
    hint: 'Algae settling on Limestone.',
  }),
  life('LICHEN', 'Lichen', 'Lch', SOLID, ['#a8b870', '#9cac64', '#b4c47c', '#d8c860'], {
    strength: 6, grow: { into: ['STONE', 'BRICK', 'CONCRETE', 'GRANITE', 'MARBLE'], chance: 0.001 },
    behavior: 'grow', flammable: 0.02, ignite: 250, burn: { ash: 0.3 },
    desc: 'A fungus and an alga living as one. Together they survive bare rock, deserts, the Antarctic, and even open space.',
    hint: 'Fungus teaming up with Algae.',
  }),
  life('SEASHELL', 'Seashell', 'Sea', POWDER, ['#f4e8dc', '#e8d8c8', '#f8f0e4', '#e0c8b0'], {
    density: 2.4, pressure: { above: 20, to: 'CHALK', chance: 0.01 },
    desc: 'The empty house of a sea snail, built from limestone pulled out of the water.',
    hint: 'What a Snail leaves behind.',
  }),
  life('YEAST', 'Yeast', 'Yst', POWDER, ['#e8d8b0', '#dccca4', '#f4e4bc'], {
    density: 1.1,
    desc: 'Single-celled fungus that eats sugar and breathes out alcohol and carbon dioxide: the bubbles in bread and the fizz in beer.',
    hint: 'The wild Fungus that lives on Fruit skins.',
  }),
  life('BACTERIA', 'Bacteria', 'Bac', LIQUID, ['#c8d8a0', '#bccc94', '#d4e4ac'], {
    density: 1.02, spread: 2, viscosity: 0.5, wet: true, high: { temp: 70, to: 'WATER', chance: 0.1 },
    desc: 'A culture of microbes. They turn milk into yogurt and wine into vinegar; heat kills them, which is how pasteurisation works.',
    hint: 'Sugar left in Mud.',
  }),
  life('MOLD', 'Mold', 'Mld', SOLID, ['#5a8a6a', '#4e7e5e', '#669676', '#d8e0d0'], {
    strength: 3, grow: { into: ['BREAD', 'FRUIT', 'CHEESE'], chance: 0.003 }, behavior: 'grow',
    desc: 'Fuzzy fungus that grows on old bread and fruit. One kind, Penicillium, makes the first antibiotic.',
    hint: 'Leave Bread out for a long time.',
  }),
  life('SLIME_MOLD', 'Slime Mold', 'SMd', SOLID, ['#f0d830', '#e4cc24', '#fce43c'], {
    strength: 2, grow: { into: ['BREAD', 'SUGAR', 'FLOUR', 'FRUIT', 'DOUGH', 'CHEESE'], chance: 0.01 },
    behavior: 'grow',
    desc: 'A brainless yellow blob that spreads towards food. Scientists laid oat flakes where Tokyo\'s stations are, and it grew a network much like the real railway.',
    hint: 'Fungus meets Slime.',
  }),
  life('PENICILLIN', 'Penicillin', 'Pen', LIQUID, ['#f0e8b0', '#e6dea4'], {
    density: 1.0, spread: 5,
    desc: 'The first antibiotic, noticed by Alexander Fleming in 1928 when mould killed the bacteria on a dish he\'d left out. It does nothing to viruses.',
    hint: 'Soak Mold in Water.',
  }),
  life('WHEAT', 'Wheat', 'Wht', SOLID, ['#e0c060', '#d4b454', '#ecc86c'], {
    strength: 3, density: 0.6, flammable: 0.2, ignite: 250, burn: { ash: 0.3 },
    behavior: 'stalk', stalk: { height: [4, 8], rate: 0.03 }, pressure: { above: 5, to: 'FLOUR', chance: 0.05 },
    desc: 'A grass bred for its seeds. Grind the grain and you get flour.',
    hint: 'Grass grown from Seed.',
  }),
  life('SUGARCANE', 'Sugarcane', 'Scn', SOLID, ['#8ab84a', '#7eac3e', '#96c456'], {
    strength: 5, density: 0.8, flammable: 0.05, ignite: 250, burn: { ash: 0.3 },
    behavior: 'stalk', stalk: { height: [6, 12], rate: 0.03 }, pressure: { above: 5, to: 'SUGAR', chance: 0.05 },
    desc: 'A giant grass with sweet juice in its stems. Crush it and boil the juice to get sugar.',
    hint: 'Grass grown somewhere hot and Steamy.',
  }),

  // ---- food ------------------------------------------------------------------------
  food('FLOUR', 'Flour', 'Flr', POWDER, ['#f8f4ec', '#f0ece4', '#fffcf4'], {
    density: 0.6, fallRate: 0.5, airDrag: 0.12, flammable: 0.4, ignite: 350, explode: 3,
    burn: { fireTemp: 900, fireLife: [8, 15] },
    desc: 'Ground wheat. Flour dust ignites in a flash, and dust explosions have flattened more than one flour mill.',
    hint: 'Grind Wheat under Pressure.',
  }),
  food('DOUGH', 'Dough', 'Dgh', SOLID, ['#f0e4c8', '#e6dabc', '#faeed4'], {
    strength: 3, density: 1.2, high: { temp: 180, to: 'BREAD', chance: 0.02 },
    desc: 'Flour and water. Knead it, let it rise, then bake it.',
    hint: 'Mix Flour with Water.',
  }),
  food('BREAD', 'Bread', 'Brd', SOLID, ['#c8883a', '#bc7c34', '#d49444', '#f0dcb0'], {
    strength: 3, density: 0.4, flammable: 0.02, ignite: 300, burn: { smoke: 0.5 },
    high: { temp: 250, to: 'TOAST', chance: 0.02 },
    life: [1500, 2500], behavior: 'decay', lifeEnd: { to: 'MOLD' },
    desc: 'Baked dough, full of holes left by yeast bubbles. It goes mouldy if you leave it.',
    hint: 'Bake Dough.',
  }),
  food('TOAST', 'Toast', 'Tst', SOLID, ['#8a5a2a', '#7e5024', '#96643a'], {
    strength: 4, density: 0.4, flammable: 0.05, ignite: 300, burn: { to: 'CHARCOAL', toChance: 0.5, smoke: 0.5 },
    desc: 'Bread browned by the Maillard reaction, the same chemistry that browns steak and roasts coffee.',
    hint: 'Toast Bread with more Heat.',
  }),
  food('CORN', 'Corn', 'Crn', POWDER, ['#f0c830', '#e4bc24', '#fcd43c'], {
    density: 1.3, wet: true, flammable: 0.1, ignite: 180, explode: 1, burn: { to: 'POPCORN', toChance: 1 },
    desc: 'Kernels of a grass the Maya bred from a wild weed. Heat one and the water inside turns to steam until it bursts.',
    hint: 'Grass fed with Fertilizer.',
  }),
  food('POPCORN', 'Popcorn', 'Pop', POWDER, ['#fcf8ec', '#f4f0e0', '#fffff4', '#f8e8b0'], {
    density: 0.2, fallRate: 0.5, flammable: 0.2, ignite: 300, burn: { ash: 0.3 },
    desc: 'Corn turned inside out by the steam inside it.',
    hint: 'Heat Corn.',
  }),
  food('POTATO', 'Potato', 'Ptt', POWDER, ['#c8a060', '#bc9454', '#d4ac6c'], {
    density: 1.1, wet: true,
    desc: 'A swollen underground stem packed with starch. Stick zinc in it and it makes a weak battery.',
    hint: 'Fruit buried in Dirt.',
  }),
  food('FRIES', 'Fries', 'Fry', POWDER, ['#f0c850', '#e4bc44', '#fcd45c'], {
    density: 0.8, flammable: 0.02, ignite: 350,
    desc: 'Potato fried in hot oil. Belgium and France both claim them.',
    hint: 'Fry Potato in hot Oil.',
  }),
  food('LEMON', 'Lemon', 'Lmn', POWDER, ['#f8e040', '#ecd434', '#fff04c'], {
    density: 1.0, wet: true,
    desc: 'Sour fruit full of citric acid. British sailors ate limes to stop scurvy, which is how they got the nickname "limeys".',
    hint: 'Fruit soured with Acid.',
  }),
  food('SUGAR', 'Sugar', 'Sug', POWDER, ['#fcfcfc', '#f4f4f4', '#ffffff'], {
    density: 1.6, high: { temp: 160, to: 'CARAMEL', chance: 0.03 },
    desc: 'Sweet crystals crushed out of cane. Heat caramelises it, and sulfuric acid chars it black.',
    hint: 'Crush Sugarcane.',
  }),
  food('CARAMEL', 'Caramel', 'Crm', LIQUID, ['#c87a2a', '#bc6e24', '#d48634'], {
    density: 1.4, temp: 170, spread: 1, viscosity: 0.9, sticky: true, airCool: 0.002,
    low: { temp: 60, to: 'CANDY', chance: 0.02 }, flammable: 0.02, ignite: 250, burn: { smoke: 0.7 },
    desc: 'Sugar melted until it browns, making hundreds of new flavour molecules. Let it cool and it sets hard.',
    hint: 'Melt Sugar.',
  }),
  food('CANDY', 'Candy', 'Cny', SOLID, ['#e84a6a', '#f0a040', '#6ad0e0', '#b06ae8'], {
    strength: 10, density: 1.5, high: { temp: 150, to: 'CARAMEL', chance: 0.02 },
    desc: 'Hard sweets: caramel that cooled into a glass.',
    hint: 'Let Caramel cool.',
  }),
  food('MINT_CANDY', 'Mint Candy', 'Mnt', POWDER, ['#fcfcfc', '#f4f8f4', '#e8f8ec'], {
    density: 1.6,
    desc: 'Chalky mints covered in microscopic pits where bubbles can form, which is why they set off fizzy drinks.',
    hint: 'Flavour Candy with a Plant (mint).',
  }),
  food('COTTON_CANDY', 'Cotton Candy', 'CCy', POWDER, ['#f8c0d8', '#c0d8f8', '#fcd0e4'], {
    density: 0.05, fallRate: 0.1, airDrag: 0.4, high: { temp: 150, to: 'CARAMEL', chance: 0.05 },
    desc: 'Molten sugar flung through tiny holes into threads thinner than hair. One of its inventors was a dentist.',
    hint: 'Spin Caramel into a Cloud.',
  }),
  food('SYRUP', 'Syrup', 'Syr', LIQUID, ['#d8a040', '#cc9434', '#e4ac4c'], {
    density: 1.35, spread: 1, viscosity: 0.85, sticky: true,
    desc: 'Sugar dissolved in water, thick and sticky.',
    hint: 'Dissolve Sugar in Water.',
  }),
  food('HONEY', 'Honey', 'Hny', LIQUID, ['#e8a020', '#dc9418', '#f4ac2c'], {
    density: 1.4, spread: 1, viscosity: 0.93, sticky: true,
    desc: 'Flower nectar concentrated by bees. It never spoils: honey from Egyptian tombs was still edible.',
    hint: 'Let a Bee visit a Flower.',
  }),
  food('JAM', 'Jam', 'Jam', LIQUID, ['#b81a3a', '#a81432', '#c82444'], {
    density: 1.3, spread: 1, viscosity: 0.9, sticky: true,
    desc: 'Fruit boiled with sugar until the pectin in the fruit sets it.',
    hint: 'Boil Fruit with Sugar.',
  }),
  food('COCOA', 'Cocoa', 'Coc', POWDER, ['#5a3420', '#4e2c1a', '#663c26'], {
    density: 1.3,
    desc: 'Seeds of the cacao pod, fermented and roasted. The Maya and Aztecs drank them, and used the beans as money.',
    hint: 'Ferment Seeds with Yeast.',
  }),
  food('CHOCOLATE', 'Chocolate', 'Cho', SOLID, ['#5a3018', '#4e2812', '#663820'], {
    strength: 8, density: 1.3, high: { temp: 34, to: 'MELTED_CHOCOLATE', chance: 0.02 },
    desc: 'Cocoa and sugar. Its fat melts at 34 °C, just under body temperature, so it melts in your mouth.',
    hint: 'Sweeten Cocoa with Sugar.',
  }),
  food('MELTED_CHOCOLATE', 'Melted Chocolate', 'MCh', LIQUID, ['#5a3018', '#663820'], {
    density: 1.3, temp: 40, spread: 1, viscosity: 0.85, sticky: true, low: { temp: 25, to: 'CHOCOLATE', chance: 0.01 },
    desc: 'Chocolate warmed past 34 °C.',
    hint: 'Warm Chocolate.',
  }),
  food('MILK', 'Milk', 'Mlk', LIQUID, ['#fafaf6', '#f4f4f0', '#ffffff'], {
    density: 1.03, spread: 6, wet: true, pressure: { above: 5, to: 'BUTTER', chance: 0.01 },
    desc: 'Fat and protein floating in water, from a cow or (as here) from soaked seeds. Vinegar curdles it, and churning makes butter.',
    hint: 'Soak Seeds in Water, like oat milk.',
  }),
  food('CURDS', 'Curds', 'Crd', POWDER, ['#f8f4e0', '#f0ecd8', '#fffce8'], {
    density: 1.1, pressure: { above: 10, to: 'CHEESE', chance: 0.02 },
    desc: 'Milk protein clumped together by acid, leaving watery whey behind.',
    hint: 'Curdle Milk with Vinegar.',
  }),
  food('CHEESE', 'Cheese', 'Chs', SOLID, ['#f0c850', '#e4bc44', '#fcd45c'], {
    strength: 6, density: 1.1, flammable: 0.02, ignite: 350,
    desc: 'Curds pressed and aged. There are well over a thousand kinds.',
    hint: 'Press Curds together.',
  }),
  food('BUTTER', 'Butter', 'Btr', SOLID, ['#f8e080', '#ecd474', '#fff08c'], {
    strength: 3, density: 0.9, high: { temp: 32, to: 'OIL', chance: 0.01 },
    desc: 'Milk fat, churned until it clumps. It melts just above room temperature.',
    hint: 'Churn Milk under Pressure.',
  }),
  food('YOGURT', 'Yogurt', 'Ygt', LIQUID, ['#f8f8f0', '#f0f0e8'], {
    density: 1.05, spread: 1, viscosity: 0.8, wet: true,
    desc: 'Milk thickened and soured by bacteria eating its sugar.',
    hint: 'Let Bacteria loose in Milk.',
  }),
  food('ICE_CREAM', 'Ice Cream', 'IcC', POWDER, ['#fce8e0', '#f8f0d8', '#e8f4e0', '#f4e0f0'], {
    density: 0.6, temp: -10, airCool: 0.0004, high: { temp: 0, to: 'MILK', chance: 0.02 },
    desc: 'Sweet frozen cream whipped full of air. The first ice cream was made with snow.',
    hint: 'Mix Milk with Snow.',
  }),
  food('EGG', 'Egg', 'Egg', POWDER, ['#f4ead8', '#eadecc', '#fcf2e0'], {
    density: 1.03, wet: true, life: [2500, 3500], behavior: 'decay', lifeEnd: { to: 'HYDROGEN_SULFIDE' },
    high: { temp: 70, to: 'FRIED_EGG', chance: 0.05 },
    desc: 'A living cell in a limestone shell. Cook it and it sets; leave it long enough and it rots into stinking gas.',
    hint: 'A Seed wrapped in a Limestone shell.',
  }),
  food('FRIED_EGG', 'Fried Egg', 'FEg', SOLID, ['#fcfcf8', '#f8f8f0', '#f8c830'], {
    strength: 3, density: 1.0, flammable: 0.02, ignite: 300, burn: { smoke: 0.5 },
    desc: 'Egg white is mostly water and a protein that unravels and tangles when heated, so it turns from clear to solid white.',
    hint: 'Cook an Egg.',
  }),
  food('NAKED_EGG', 'Naked Egg', 'NEg', POWDER, ['#f4ecd8', '#eee4cc'], {
    density: 1.03, wet: true,
    desc: 'An egg left in vinegar: the acid dissolves the shell and leaves a bouncy, see-through egg held together by its membrane.',
    hint: 'Soak an Egg in Vinegar.',
  }),
  food('MEAT', 'Meat', 'Mea', SOLID, ['#c83a3a', '#bc3434', '#d44444', '#f0c8c0'], {
    strength: 5, density: 1.1, wet: true, high: { temp: 70, to: 'STEAK', chance: 0.03 },
    pressure: { above: 10, to: 'BLOOD', chance: 0.01 }, life: [2500, 3500], behavior: 'decay', lifeEnd: { to: 'BACTERIA' },
    desc: 'Muscle: long protein fibres, water and fat. Left out, it rots.',
    hint: 'What a Fish leaves behind (sometimes).',
  }),
  food('STEAK', 'Steak', 'Stk', SOLID, ['#7a4a2a', '#6e4024', '#865432'], {
    strength: 6, density: 1.0, flammable: 0.02, ignite: 300, burn: { to: 'CHARCOAL', toChance: 0.5, smoke: 0.6 },
    desc: 'Cooked meat. The brown crust is the Maillard reaction at work.',
    hint: 'Cook Meat.',
  }),
  food('BLOOD', 'Blood', 'Bld', LIQUID, ['#8a0a14', '#7a0810', '#9a0e18'], {
    density: 1.06, spread: 4, wet: true,
    desc: 'Red because of iron. It makes hydrogen peroxide foam, and luminol glows wherever it has been.',
    hint: 'Squeeze Meat.',
  }),
  food('BONE', 'Bone', 'Bon', SOLID, ['#f0ead8', '#e6e0ce', '#faf4e2'], {
    cat: 'life', strength: 30, density: 1.9, xrayOpaque: true, pressure: { above: 20, to: 'FOSSIL', chance: 0.01 },
    desc: 'Calcium phosphate over a protein frame: light, strong, and the reason X-rays show your skeleton.',
    hint: 'What a Fish leaves behind.',
  }),
  food('FEATHER', 'Feather', 'Fth', POWDER, ['#f8f8f4', '#e8e0d0', '#d0c8b8', '#fcfcf8'], {
    cat: 'life', density: 0.1, fallRate: 0.15, airDrag: 0.3, flammable: 0.3, ignite: 250, burn: { smoke: 0.6 },
    desc: 'Light, strong and warm. Feathers evolved on dinosaurs long before any of them flew.',
    hint: 'What a Bird leaves behind.',
  }),
  food('WINE', 'Wine', 'Win', LIQUID, ['#6a1030', '#5c0c28', '#781438'], {
    density: 0.99, spread: 6, wet: true,
    desc: 'Fermented fruit juice. Left open, bacteria sour it: "vinegar" is French for sour wine.',
    hint: 'Let Yeast loose on Fruit.',
  }),
  food('SODA_WATER', 'Soda Water', 'Sda', LIQUID, ['#e8f4fa', '#dcecf4'], {
    density: 1.0, spread: 8, transparent: true, wet: true, decay: { chance: 0.0005, to: 'WATER', spawn: 'CARBON_DIOXIDE' },
    desc: 'Water with carbon dioxide dissolved in it. Joseph Priestley invented it in 1767 by hanging a bowl of water over a vat of fermenting beer.',
    hint: 'Dissolve Carbon Dioxide in Water.',
  }),
  food('COLA', 'Cola', 'Cla', LIQUID, ['#3a1a10', '#2e140c', '#461f14'], {
    density: 1.04, spread: 7, wet: true, decay: { chance: 0.0005, to: 'SYRUP', spawn: 'CARBON_DIOXIDE' },
    desc: 'Fizzy caramel-coloured drink. Drop a mint into it and all its gas escapes at once in a foaming geyser.',
    hint: 'Flavour Soda Water with Caramel.',
  }),
  food('MARSHMALLOW', 'Marshmallow', 'Msh', SOLID, ['#fcfcfa', '#f8f8f4', '#fffffc'], {
    strength: 2, density: 0.5, flammable: 0.1, ignite: 200, burn: { to: 'CARAMEL', toChance: 0.3, smoke: 0.3 },
    desc: 'Sugar whipped with egg white into a foam. The first ones were made with sap from the marsh-mallow plant.',
    hint: 'Whip Sugar with an Egg.',
  }),

  food('TOFU', 'Tofu', 'Tfu', SOLID, ['#f8f4e8', '#f0ece0', '#fffcf0'], {
    strength: 4, density: 1.1,
    desc: 'Soy milk curdled with nigari, a salt left over from making sea salt, then pressed into blocks.',
    hint: 'Curdle Milk with Salt.',
  }),
  food('JELLY', 'Jelly', 'Jel', SOLID, ['#e83a5a', '#d8304e', '#f44a68'], {
    strength: 2, density: 1.05, transparent: true, high: { temp: 35, to: 'SYRUP', chance: 0.02 },
    desc: 'Sweetened gelatin, which is boiled from animal bones and skin. It melts just below body temperature.',
    hint: 'Sweeten Glue with Sugar (gelatin is a kind of glue).',
  }),
  food('JERKY', 'Jerky', 'Jrk', SOLID, ['#6a2a1a', '#5e2414', '#763020'], {
    strength: 6, density: 0.9, flammable: 0.02, ignite: 300, burn: { smoke: 0.6 },
    desc: 'Meat dried and salted so bacteria can\'t grow in it. It keeps for months.',
    hint: 'Cure Meat with Salt.',
  }),

  // ---- creatures ----------------------------------------------------------------
  critter('PLANKTON', 'Plankton', 'Pkt', ['#6ac8a8', '#5ab898', '#7ad8b8'], {
    moves: 'swim', home: WATERS, speed: 0.1, breed: 0.005,
    eats: [{ food: 'SALT_WATER', becomes: 'SALT_WATER' }],
  }, {
    life: [1500, 2500], render: 'blink', glowAmount: 0.1,
    desc: 'Tiny drifting life that feeds almost everything in the sea. Some kinds flash when disturbed, lighting up waves at night.',
    hint: 'Algae thriving in Salt Water.',
  }),
  critter('JELLYFISH', 'Jellyfish', 'Jly', ['#d8a0f0', '#c890e8', '#e8b8fc'], {
    moves: 'swim', home: WATERS, speed: 0.08, breed: 0.2, eats: [{ food: 'PLANKTON' }],
  }, {
    life: [2000, 3000], lifeEnd: { to: 'SALT_WATER' }, render: 'pulse', alpha: 0.75, glowAmount: 0.2,
    desc: 'A drifting bell of jelly that is 95% water, with no brain, heart or bones. Jellyfish have been around for 500 million years.',
    hint: 'Plankton and Slime.',
  }),
  critter('FISH', 'Fish', 'Fsh', ['#e88a3a', '#6a9ae8', '#e8c83a', '#8ae86a'], {
    moves: 'swim', home: WATERS, speed: 0.4, breed: 0.1, eats: [{ food: 'ALGAE' }, { food: 'PLANKTON' }],
  }, {
    life: [2000, 3000], lifeEnd: { to: 'BONE', alt: 'MEAT', altChance: 0.5 },
    desc: 'Swims through water eating algae and plankton, and breeds when well fed. Out of water it soon dies.',
    hint: 'An Egg laid in Salt Water.',
  }),
  critter('ELECTRIC_EEL', 'Electric Eel', 'Eel', ['#3a4a3a', '#445444', '#6a7a4a'], {
    moves: 'swim', home: WATERS, speed: 0.3, breed: 0.05, spark: 0.02, eats: [{ food: 'FISH' }],
  }, {
    life: [2500, 3500], lifeEnd: { to: 'MEAT' },
    desc: 'Not really an eel but a knifefish that stuns prey with jolts of up to 800 volts. Electric fish inspired Volta\'s first battery.',
    hint: 'A Fish that swallowed a Battery.',
  }),
  critter('BIRD', 'Bird', 'Bir', ['#5a4a3a', '#8a6a4a', '#e8e0d0', '#3a3a3a'], {
    moves: 'fly', speed: 0.5, breed: 0.15, egg: 'EGG',
    eats: [{ food: 'SEED' }, { food: 'FRUIT' }, { food: 'ANT' }, { food: 'WORM' }, { food: 'LOCUST' }],
  }, {
    life: [1800, 2600], lifeEnd: { to: 'FEATHER' },
    desc: 'Flies about eating seeds, fruit and insects, and lays eggs when well fed. Birds are the dinosaurs that survived.',
    hint: 'Hatch an Egg up in a Cloud.',
  }),
  critter('WORM', 'Worm', 'Wrm', ['#c87a7a', '#bc6e6e', '#d48686'], {
    moves: 'burrow', dig: ['DIRT', 'MUD', 'SAND', 'GRASS'], speed: 0.2, breed: 0.05,
    eats: [{ food: 'ASH', becomes: 'DIRT' }, { food: 'FRUIT', becomes: 'DIRT' }],
  }, {
    life: [2000, 3000], lifeEnd: { to: 'DIRT' },
    desc: 'Tunnels through dirt eating ash and rotting fruit, and leaves rich soil behind. Darwin wrote a whole book about them.',
    hint: 'Rotting Fruit in Mud.',
  }),
  critter('SNAIL', 'Snail', 'Snl', ['#c8a070', '#8a6a4a', '#e8c898'], {
    moves: 'walk', speed: 0.05, breed: 0.05,
    eats: [{ food: 'ALGAE' }, { food: 'PLANT' }, { food: 'MOSS' }, { food: 'LICHEN' }],
  }, {
    life: [2000, 3000], lifeEnd: { to: 'SEASHELL' },
    desc: 'A slow grazer that carries its limestone house on its back, and leaves the shell behind when it dies.',
    hint: 'A Worm that builds a Limestone shell.',
  }),
  critter('SQUID', 'Squid', 'Sqd', ['#e8a8a0', '#dc9c94', '#f4b4ac'], {
    moves: 'swim', home: WATERS, speed: 0.4, breed: 0.05, trail: ['INK', 0.02],
    eats: [{ food: 'FISH' }, { food: 'PLANKTON' }],
  }, {
    life: [2000, 3000], lifeEnd: { to: 'MEAT' },
    desc: 'Jet-propelled, with three hearts and blue blood, and it squirts a cloud of ink to escape.',
    hint: 'A Jellyfish that has learned to use Ink.',
  }),
  critter('FROG', 'Frog', 'Frg', ['#5aa83a', '#4e9c30', '#66b444'], {
    moves: 'walk', speed: 0.3, breed: 0.1,
    eats: [{ food: 'ANT' }, { food: 'LOCUST' }, { food: 'BEE' }, { food: 'FIREFLY' }, { food: 'BUTTERFLY' }, { food: 'TERMITE' }],
  }, {
    life: [2000, 3000], lifeEnd: { to: 'MEAT' },
    desc: 'Starts life as a tadpole with gills and ends up a hopping insect-catcher that partly breathes through its skin.',
    hint: 'A Fish that crawls out onto the Mud.',
  }),
  critter('ANT', 'Ant', 'Ant', ['#2a1a14', '#34221a', '#3e2a20'], {
    moves: 'walk', speed: 0.4, breed: 0.2,
    eats: [{ food: 'SUGAR' }, { food: 'FRUIT' }, { food: 'HONEY' }, { food: 'SYRUP' }, { food: 'CANDY' }],
  }, {
    life: [2000, 3000],
    desc: 'Tiny, tireless and always somewhere near the sugar. Ants can carry many times their own weight.',
    hint: 'Spill Sugar on Dirt.',
  }),
  critter('TERMITE', 'Termite', 'Trt', ['#e8d0a8', '#dcc49c', '#f4dcb4'], {
    moves: 'walk', speed: 0.3, breed: 0.1, eats: [{ food: 'WOOD' }, { food: 'PAPER' }, { food: 'CARDBOARD' }],
  }, {
    life: [2000, 3000],
    desc: 'Eats wood, with help from microbes in its gut that digest cellulose. Despite the look, termites aren\'t ants at all: they\'re a kind of cockroach.',
    hint: 'An Ant that develops a taste for Wood.',
  }),
  critter('SPIDER', 'Spider', 'Spd', ['#2a2a2a', '#3a3434', '#1e1e1e'], {
    moves: 'walk', speed: 0.3, breed: 0.1, trail: ['SILK', 0.1],
    eats: [{ food: 'ANT' }, { food: 'BEE' }, { food: 'FIREFLY' }, { food: 'BUTTERFLY' }, { food: 'LOCUST' }, { food: 'TERMITE' }],
  }, {
    life: [2000, 3000],
    desc: 'Eight legs, no wings, and not an insect at all. It trails silk wherever it walks and eats any bug it catches.',
    hint: 'An Ant that learns to spin Glue.',
  }),
  critter('LOCUST', 'Locust', 'Lcs', ['#8a9a3a', '#7e8e30', '#96a644'], {
    moves: 'fly', speed: 0.6, breed: 0.08,
    eats: [{ food: 'PLANT' }, { food: 'GRASS' }, { food: 'WHEAT' }, { food: 'CORN' }, { food: 'SUGARCANE' }],
  }, {
    life: [1500, 2500],
    desc: 'A grasshopper that, when crowded, changes colour and joins a swarm that can strip fields bare.',
    hint: 'An Ant living in the Grass (a grasshopper, near enough).',
  }),
  critter('BEE', 'Bee', 'Bee', ['#f0c020', '#2a2014', '#f0c020', '#3a3020'], {
    moves: 'fly', speed: 0.5, breed: 0.05, eats: [{ food: 'FLOWER', becomes: 'FLOWER', drops: 'HONEY' }],
  }, {
    life: [2000, 3000],
    desc: 'Visits flowers and turns their nectar into honey. Bees are more closely related to ants than to flies.',
    hint: 'An Ant that takes to Flowers.',
  }),
  critter('BUTTERFLY', 'Butterfly', 'Bfy', ['#f08a2a', '#2a2a2a', '#6ab0f0', '#f0e04a'], {
    moves: 'fly', speed: 0.3, breed: 0.02, eats: [{ food: 'FLOWER', becomes: 'FLOWER' }],
  }, {
    life: [1500, 2500],
    desc: 'A caterpillar that dissolved itself inside a chrysalis and rebuilt itself with wings.',
    hint: 'A Worm (think caterpillar) on a Flower.',
  }),
  critter('FIREFLY', 'Firefly', 'Ffy', ['#6a6a3a', '#5e5e30'], {
    moves: 'fly', speed: 0.3,
  }, {
    life: [2000, 3000], render: 'blink', glowAmount: 0.1,
    desc: 'A beetle whose tail makes cold light, blinking in patterns to find a mate. In some forests thousands flash in sync.',
    hint: 'A Bee that picks up a glow from Phosphor.',
  }),
  critter('TARDIGRADE', 'Tardigrade', 'Tdg', ['#d8c8a8', '#ccbc9c', '#e4d4b4'], {
    moves: 'walk', speed: 0.05, breed: 0.05, tough: true,
    eats: [{ food: 'MOSS' }, { food: 'ALGAE' }, { food: 'LICHEN' }],
  }, {
    life: [3000, 3900],
    desc: 'A half-millimetre "water bear" that survives boiling, near absolute zero, radiation and open space by drying into a barrel and waiting it out.',
    hint: 'Water trickling through Lichen.',
  }),
  critter('PHOENIX', 'Phoenix', 'Phx', ['#ff6a1a', '#ffb02a', '#ff3a1a', '#ffe05a'], {
    moves: 'fly', speed: 0.6, ignite: true, tough: true,
  }, {
    cat: 'special', life: [1500, 2500], lifeEnd: { to: 'ASH' }, glowAmount: 0.8, temp: 600, holdTemp: true,
    desc: 'The mythical firebird that burns without being consumed, setting light to whatever it passes, and crumbling to ash at the end of its life.',
    hint: 'A Bird that flies into Fire, and likes it.',
  }),

  // ---- weather and the Earth ------------------------------------------------------
  {
    key: 'FOG', name: 'Fog', sym: 'Fog', cat: 'gas', state: GAS,
    colors: ['#dfe4e8', '#d4d9de'], alpha: 0.6, density: 0.05, rise: 0.02, sink: 0.04, drift: 0.2,
    airDrag: 0.3, life: [400, 800], behavior: 'decay',
    desc: 'Cloud at ground level. The low, rolling fog of stage shows is dry ice dropped into water.',
    hint: 'Drop Dry Ice into Water.',
  },
  {
    key: 'HAIL', name: 'Hail', sym: 'Hl', cat: 'powder', state: POWDER,
    colors: ['#e8f0f8', '#dce6f0', '#f4f8fc'], density: 0.9, temp: -10, airCool: 0.0004,
    high: { temp: 1, to: 'WATER', chance: 0.02 },
    desc: 'Balls of ice that grow as updrafts toss them up and down through a storm cloud, adding a layer each trip.',
    hint: 'Ice tossed about in a Cloud.',
  },
  {
    key: 'PERMAFROST', name: 'Permafrost', sym: 'Pmf', cat: 'solid', state: SOLID, strength: 30,
    colors: ['#6a5a4a', '#c8d8e0', '#5e4e40'], density: 1.8, temp: -10, airCool: 0.0003,
    high: { temp: 1, to: 'MUD', alt: 'METHANE', altChance: 0.2, chance: 0.01 },
    desc: 'Ground frozen solid for thousands of years. As it thaws it lets out methane locked away since the Ice Age.',
    hint: 'Dirt frozen together with Ice.',
  },
  {
    key: 'GLACIER_ICE', name: 'Glacier Ice', sym: 'GIc', cat: 'solid', state: SOLID, strength: 25,
    colors: ['#7ac0e8', '#6ab4e0', '#8acaf0'], density: 0.92, temp: -10, airCool: 0.0002, transparent: true,
    high: { temp: 1, to: 'WATER', chance: 0.02 },
    desc: 'Snow squeezed under its own weight for centuries until the air bubbles are forced out. Without them it soaks up red light and glows blue.',
    hint: 'Squeeze Snow.',
  },
  {
    key: 'LIQUID_HYDROGEN', name: 'Liquid Hydrogen', sym: 'LH2', cat: 'liquid', state: LIQUID,
    colors: ['#d8ecff', '#cce4fc'], density: 0.07, temp: -253, airCool: 0.0004, spread: 6, transparent: true,
    high: { temp: -252, to: 'HYDROGEN', chance: 0.05 },
    desc: 'Hydrogen chilled to −253 °C, so light that a bucketful weighs less than a bag of sugar. With liquid oxygen, it\'s rocket fuel.',
    hint: 'Chill Hydrogen to −253 °C.',
  },
  {
    key: 'QUICKSAND', name: 'Quicksand', sym: 'QSd', cat: 'liquid', state: LIQUID,
    colors: ['#c8a868', '#bc9c5c', '#d4b474'], density: 1.9, spread: 1, viscosity: 0.9,
    desc: 'Sand so soaked it can\'t bear weight. You\'d sink in, but you\'re lighter than it, so you\'d never go all the way under.',
    hint: 'Mix Sand with Clay.',
  },
  {
    key: 'AURORA', name: 'Aurora', sym: 'Aur', cat: 'energy', state: GAS,
    colors: ['#4aff8a', '#3aef7a', '#8a5aff', '#5affa0'], alpha: 0.6, density: 0.02, rise: 0.3, sink: 0.02,
    life: [60, 120], behavior: 'decay', lifeEnd: { to: 'OXYGEN' }, glowAmount: 1.0, render: 'pulse',
    desc: 'Curtains of green and purple light where charged particles from the Sun slam into oxygen high in the sky.',
    hint: 'Fire Electrons into Oxygen.',
  },
  {
    key: 'BALL_LIGHTNING', name: 'Ball Lightning', sym: 'BLt', cat: 'energy', state: ENERGY,
    colors: ['#f0e8ff', '#e0d8ff', '#fff8ff'], temp: 3000, holdTemp: true, density: 0.03,
    rise: 0.05, sink: 0.05, drift: 0.5, life: [100, 250], behavior: 'decay',
    lifeEnd: { to: 'FIRE', explode: 6 }, glowAmount: 1.5, render: 'plasma',
    desc: 'A glowing orb that drifts about for a few seconds before vanishing, sometimes with a bang. Scientists still argue over what it is.',
    hint: 'Plasma caught up in a Cloud.',
  },
  {
    key: 'RAINBOW', name: 'Rainbow', sym: 'Rbw', cat: 'energy', state: ENERGY,
    colors: ['#ff3a3a', '#ff9a2a', '#ffe83a', '#4aff5a', '#3ab0ff', '#5a4aff', '#b04aff'],
    density: 0.02, rise: 0.05, sink: 0.05, drift: 0.3, life: [40, 80], behavior: 'decay', render: 'glitter',
    desc: 'Sunlight split into colours as it bends through raindrops; each drop sends it back at 42 degrees.',
    hint: 'Shine light through a Cloud.',
  },

  // ---- space ------------------------------------------------------------------------
  {
    key: 'METEOR', name: 'Meteor', sym: 'Met', cat: 'special', state: POWDER,
    colors: ['#ff8a3a', '#ffb05a', '#e86a2a'], temp: 2500, holdTemp: true, density: 8, maxSpeed: 8,
    glowAmount: 1, behavior: 'meteor', lifeEnd: { to: 'METEORITE', explode: 10 },
    desc: 'A rock from space, burning white-hot as it falls. It explodes where it lands.',
    hint: 'A Star flinging Gravel.',
  },
  {
    key: 'SUPERNOVA', name: 'Supernova', sym: 'SN', cat: 'special', state: ENERGY, fixed: true,
    colors: ['#ffffff', '#f0f4ff', '#fff8e8'], temp: 9000, holdTemp: true, life: [60, 90], behavior: 'decay',
    lifeEnd: { to: 'NEUTRONIUM', alt: 'GOLD', altChance: 0.4, explode: 30 }, glowAmount: 3, render: 'star',
    desc: 'A star that has fused its core all the way to iron, which can\'t be fused for energy, collapses and rebounds in a blast brighter than a galaxy. Its debris is where gold comes from.',
    hint: 'Feed iron (Metal) to a Star.',
  },
  {
    key: 'PULSAR', name: 'Pulsar', sym: 'PSR', cat: 'special', state: SOLID, strength: 0,
    colors: ['#c8d8ff', '#e0e8ff'], emits: [{ p: 'PHOTON', chance: 0.02 }, { p: 'ELECTRON', chance: 0.01 }],
    behavior: 'magnet', magnet: 3, glowAmount: 0.8, render: 'star', indestructible: true,
    desc: 'A spinning neutron star sweeping beams of radiation around like a lighthouse. The first one found, in 1967, was jokingly labelled LGM-1: "little green men".',
    hint: 'Spin up Neutronium in a strong magnetic field.',
  },
  {
    key: 'QUARK_GLUON_PLASMA', name: 'Quark-Gluon Plasma', sym: 'QGP', cat: 'special', state: ENERGY,
    colors: ['#ff4aff', '#4affff', '#ffff4a'], temp: 9999, holdTemp: true, density: 0.02,
    life: [30, 60], behavior: 'decay', render: 'strange', glowAmount: 2,
    emits: [{ p: 'PROTON', chance: 0.05 }, { p: 'NEUTRON', chance: 0.05 }, { p: 'PION', chance: 0.05 }],
    desc: 'Matter so hot that protons and neutrons melt into a soup of quarks and gluons, as the whole universe was a millionth of a second after the Big Bang.',
    hint: 'Melt Neutronium in Plasma.',
  },
  {
    key: 'TIME_CRYSTAL', name: 'Time Crystal', sym: 'TCr', cat: 'special', state: SOLID, strength: 100,
    colors: ['#8ae8ff', '#ff8ae8', '#e8ff8a', '#8a8aff'], transparent: true, glowAmount: 0.3, render: 'strange',
    emits: [{ p: 'PHOTON', chance: 0.005 }],
    desc: 'A real phase of matter, first made in 2016, whose atoms repeat a pattern in time instead of space, ticking forever without using energy.',
    hint: 'Quartz touched by Dark Matter.',
  },

  {
    key: 'ICE_NINE', name: 'Ice-Nine', sym: 'Ic9', cat: 'special', state: SOLID, strength: 30,
    colors: ['#c8f0ff', '#bce8fc', '#d4f8ff'], temp: 22, transparent: true,
    grow: { into: ['WATER', 'SALT_WATER', 'ICE'], chance: 0.3 }, behavior: 'grow',
    desc: 'Kurt Vonnegut\'s fictional ice that stays frozen at room temperature. One seed crystal turns any water it touches into more of itself.',
    hint: 'Ice corrupted by Strange Matter.',
  },
  {
    key: 'GREY_GOO', name: 'Grey Goo', sym: 'GGo', cat: 'special', state: POWDER,
    colors: ['#8a8e94', '#7e8288', '#969aa0'], density: 2,
    grow: {
      into: ['METAL', 'STEEL', 'COPPER', 'ALUMINUM', 'PLASTIC', 'WOOD', 'STONE', 'GLASS', 'BRICK', 'CONCRETE',
        'SAND', 'DIRT', 'PLANT', 'GRAPHITE', 'GRAPHENE', 'SILICON', 'GRASS', 'COAL'],
      chance: 0.02,
    },
    behavior: 'grow',
    desc: 'Self-copying nanomachines that turn whatever they touch into more of themselves: a famous thought experiment about technology running away. Wall stops them.',
    hint: 'Graphene infected with a Virus.',
  },

  // ---- legends -------------------------------------------------------------------
  {
    key: 'ELIXIR', name: 'Elixir of Life', sym: 'Elx', cat: 'special', state: LIQUID,
    colors: ['#e8c8ff', '#d8b8ff', '#f8d8ff'], density: 1.0, spread: 5, glowAmount: 0.5, render: 'pulse',
    desc: 'The alchemists\' elixir of life, brewed from the philosopher\'s stone. Pour it on ash and things grow again.',
    hint: 'Dissolve a little Philosopher\'s Stone in Water.',
  },
  {
    key: 'GREEK_FIRE', name: 'Greek Fire', sym: 'GrF', cat: 'explosive', state: LIQUID,
    colors: ['#e86a1a', '#dc5e14', '#f47624'], density: 0.9, spread: 3, sticky: true,
    flammable: 0.5, ignite: 200, burn: { smoke: 0.5, fireTemp: 1200, fireLife: [200, 300] },
    desc: 'The Byzantine navy\'s secret weapon, which floated and burned on the sea. The recipe was guarded so well that it\'s been lost; one theory is that quicklime in it heated up on contact with water.',
    hint: 'Mix Tar with Quicklime.',
  },

  // ---- more particles ------------------------------------------------------------
  {
    key: 'GAMMA', name: 'Gamma Ray', sym: 'γ', cat: 'particle', state: ENERGY, projectile: 'gamma',
    colors: ['#e8ffb0'], alpha: 0.8, speed: 3, life: [120, 160],
    desc: 'The most energetic light, from atomic nuclei. It passes through most things: it takes lead or thick concrete to stop it.',
    hint: 'What an Electron and a Positron become when they meet.',
  },
  {
    key: 'XRAY', name: 'X-Ray', sym: 'X', cat: 'particle', state: ENERGY, projectile: 'xray',
    colors: ['#c8e8ff'], alpha: 0.6, speed: 3, life: [100, 150],
    desc: 'Light energetic enough to pass through skin and wood but not bone or metal. Röntgen found them by accident in 1895.',
    hint: 'Fire Electrons into Tungsten, as an X-ray tube does.',
  },
  {
    key: 'UV_LIGHT', name: 'Ultraviolet', sym: 'UV', cat: 'particle', state: ENERGY, projectile: 'uv',
    colors: ['#b07aff'], speed: 3, life: [120, 160],
    desc: 'Light just too violet to see. It makes fluorescent minerals glow and gives you sunburn, and ordinary glass blocks it.',
    hint: 'Fire Electrons through Mercury Vapour.',
  },
  {
    key: 'MICROWAVE', name: 'Microwave', sym: 'μw', cat: 'particle', state: ENERGY, projectile: 'microwave',
    colors: ['#ff9ab0'], alpha: 0.5, speed: 3, life: [100, 150],
    desc: 'Long-wavelength light that sets water molecules jiggling. It passes through plates and paper, heats anything wet, and makes metal spark.',
    hint: 'Run a Spark past a Magnet, like the magnetron in a microwave oven.',
  },
  {
    key: 'MUON', name: 'Muon', sym: 'μ', cat: 'particle', state: ENERGY, projectile: 'ghost',
    colors: ['#9affd8'], speed: 3, charge: -1, life: [60, 90], expire: ['ELECTRON', 'NEUTRINO'],
    desc: 'A heavy cousin of the electron, made when cosmic rays hit the air: one passes through your hand about every second. It can pull deuterium close enough to fuse at room temperature.',
    hint: 'Wait for a Pion to decay.',
  },
  {
    key: 'PION', name: 'Pion', sym: 'π', cat: 'particle', state: ENERGY, projectile: 'ghost',
    colors: ['#ffaaff'], speed: 2.5, charge: 1, life: [10, 20], expire: ['MUON', 'NEUTRINO'],
    desc: 'The particle that helps glue atomic nuclei together. Smash two protons and pions spray out, then decay in a flash into muons.',
    hint: 'Smash two Protons together.',
  },
  {
    key: 'HIGGS', name: 'Higgs Boson', sym: 'H⁰', cat: 'particle', state: ENERGY, projectile: 'ghost',
    colors: ['#ffffff'], speed: 0.5, life: [3, 6], expire: ['PHOTON', 'PHOTON'],
    desc: 'The particle behind the field that gives others their mass, predicted in 1964 and found in 2012. It decays almost at once, most visibly into two flashes of light.',
    hint: 'Collide two Muons, as a future muon collider might.',
  },
  {
    key: 'TACHYON', name: 'Tachyon', sym: 'Ty', cat: 'particle', state: ENERGY, projectile: 'ghost',
    colors: ['#ff5a5a'], speed: 8, life: [20, 30],
    desc: 'A hypothetical particle that always travels faster than light. Physicists are fairly sure it doesn\'t exist; if it did, it could send messages into the past.',
    hint: 'Neutrinos falling into Dark Matter.',
  },
];

export const WORLD_REACTIONS = [
  // Alloys.
  { a: 'COPPER', b: 'TIN', chance: 0.02, aTo: 'BRONZE', bTo: null },
  { a: 'COPPER', b: 'ZINC', chance: 0.02, aTo: 'BRASS', bTo: null },
  { a: 'TIN', b: 'ANTIMONY', chance: 0.02, aTo: 'PEWTER', bTo: null },
  { a: 'TIN', b: 'LEAD', chance: 0.02, aTo: 'SOLDER', bTo: null },
  { a: 'GOLD', b: 'SILVER', chance: 0.02, aTo: 'ELECTRUM', bTo: null },
  { a: 'GOLD', b: 'COPPER', chance: 0.02, aTo: 'ROSE_GOLD', bTo: null },
  { a: 'GOLD', b: 'PALLADIUM', chance: 0.02, aTo: 'WHITE_GOLD', bTo: null },
  { a: 'SILVER', b: 'COPPER', chance: 0.02, aTo: 'STERLING_SILVER', bTo: null },
  { a: 'STEEL', b: 'CHROMIUM', chance: 0.02, aTo: 'STAINLESS_STEEL', bTo: null },
  { a: 'STEEL', b: 'ZINC', chance: 0.02, aTo: 'GALVANIZED_STEEL', bTo: null },
  { a: 'METAL', b: 'NICKEL', chance: 0.02, aTo: 'INVAR', bTo: null },
  { a: 'NICKEL', b: 'TITANIUM', chance: 0.02, aTo: 'NITINOL', bTo: null },
  { a: 'MERCURY', b: 'SILVER', chance: 0.02, aTo: 'AMALGAM', bTo: null },
  { a: 'LIQUID_GALLIUM', b: 'TIN', chance: 0.02, aTo: 'GALINSTAN', bTo: 'EMPTY' },
  { a: 'SODIUM', b: 'POTASSIUM', chance: 0.05, aTo: 'NAK', bTo: 'NAK' },
  { a: 'NAK', b: 'WATER', chance: 0.4, aTo: 'LYE', bTo: 'HYDROGEN', explode: 10, heat: 900 },
  { a: 'BISMUTH', b: 'LEAD', chance: 0.02, aTo: 'WOODS_METAL', bTo: null },
  { a: 'ALUMINUM', b: 'COPPER', chance: 0.02, aTo: 'DURALUMIN', bTo: null },
  { a: 'TUNGSTEN', b: 'GRAPHITE', chance: 0.05, minTemp: 1400, aTo: 'TUNGSTEN_CARBIDE', bTo: 'EMPTY' },
  { a: 'BRASS', b: 'GOLD', chance: 0.02, aTo: 'ORICHALCUM', bTo: null },

  // Materials.
  { a: 'GLASS', b: 'BORON', chance: 0.02, aTo: 'BOROSILICATE', bTo: 'EMPTY' },
  { a: 'GLASS', b: 'LEAD', chance: 0.02, aTo: 'LEAD_CRYSTAL', bTo: null },
  { a: 'GLASS', b: 'COPPER', chance: 0.02, aTo: 'STAINED_GLASS', bTo: null },
  { a: 'GLASS', b: 'YELLOWCAKE', chance: 0.02, aTo: 'URANIUM_GLASS', bTo: 'EMPTY' },
  { a: 'GLASS', b: 'GOLD', chance: 0.02, aTo: 'CRANBERRY_GLASS', bTo: null },
  { a: 'GLASS', b: 'PLASTIC', chance: 0.02, aTo: 'FIBERGLASS', bTo: null },
  { a: 'WET_CONCRETE', b: 'STEEL', chance: 0.02, aTo: 'REINFORCED_CONCRETE', bTo: null },
  { a: 'PUMICE', b: 'SLAKED_LIME', chance: 0.02, aTo: 'ROMAN_CONCRETE', bTo: 'EMPTY' },
  { a: 'MUD', b: 'GRASS', chance: 0.02, aTo: 'ADOBE', bTo: 'EMPTY' },
  { a: 'STEAM', b: 'BONE', chance: 0.02, aTo: 'GLUE', bTo: null },
  { a: 'PLASTIC', b: 'PROPANE', chance: 0.01, aTo: 'STYROFOAM', bTo: 'EMPTY' },
  { a: 'PLASTIC', b: 'FLUORINE', chance: 0.05, aTo: 'TEFLON', bTo: 'EMPTY' },
  { a: 'SILICON', b: 'OIL', chance: 0.02, aTo: 'SILICONE', bTo: 'EMPTY' },
  { a: 'PLASTIC', b: 'AMMONIA', chance: 0.02, aTo: 'NYLON', bTo: 'EMPTY' },
  { a: 'WAX', b: 'COTTON', chance: 0.03, aTo: 'CANDLE', bTo: 'EMPTY' },
  { a: 'WOOD', b: 'LYE', chance: 0.02, aTo: 'PULP', bTo: null },
  { a: 'PAPER', b: 'GLUE', chance: 0.02, aTo: 'CARDBOARD', bTo: 'EMPTY' },
  { a: 'PAPER', b: 'SILVER_CHLORIDE', chance: 0.02, aTo: 'PHOTO_PAPER', bTo: 'EMPTY' },
  { a: 'FLOWER', b: 'CLOUD', chance: 0.01, aTo: 'COTTON', bTo: null },
  { a: 'WOOD', b: 'MILK', chance: 0.005, aTo: null, bTo: 'LATEX' },
  { a: 'RUBBER', b: 'SULFUR', chance: 0.05, minTemp: 140, aTo: 'VULCANIZED_RUBBER', bTo: 'EMPTY' },
  { a: 'RED_PHOSPHORUS', b: 'WOOD', chance: 0.02, aTo: 'EMPTY', bTo: 'MATCH' },
  { a: 'PLASTIC', b: 'BUBBLES', chance: 0.02, aTo: 'SPONGE', bTo: 'EMPTY' },
  { a: 'SPONGE', b: 'WATER', chance: 0.2, aTo: 'WET_SPONGE', bTo: 'EMPTY' },
  { a: 'SAND', b: 'ALCOHOL', chance: 0.02, minTemp: 250, aTo: 'AEROGEL', bTo: 'EMPTY' },
  { a: 'GRAPHITE', b: 'PLASTIC', chance: 0.02, aTo: 'CARBON_FIBER', bTo: null },
  { a: 'GRAPHITE', b: 'GLUE', chance: 0.02, aTo: 'GRAPHENE', bTo: 'EMPTY' },
  { a: 'GRAPHITE', b: 'LASER', chance: 0.05, aTo: 'FULLERENE', bTo: null },
  { a: 'STEEL', b: 'COTTON', chance: 0.02, aTo: 'STEEL_WOOL', bTo: 'EMPTY' },

  // Devices.
  { a: 'GLASS', b: 'TUNGSTEN', chance: 0.02, aTo: 'LIGHT_BULB', bTo: null },
  { a: 'SILICON', b: 'GALLIUM', chance: 0.02, aTo: 'LED', bTo: null },
  { a: 'METAL', b: 'COPPER', chance: 0.02, aTo: 'ELECTROMAGNET', bTo: null },
  { a: 'NICKEL', b: 'CHROMIUM', chance: 0.02, aTo: 'NICHROME', bTo: null },
  { a: 'POTATO', b: 'ZINC', chance: 0.02, aTo: 'POTATO_BATTERY', bTo: null },
  { a: 'PLUTONIUM', b: 'GERMANIUM', chance: 0.05, aTo: 'RTG', bTo: 'EMPTY' },
  { a: 'MAGNET', b: 'SPARK', chance: 0.1, aTo: null, bTo: null, emit: ['MICROWAVE'] },

  // Plants.
  { a: 'PLANT', b: 'SAND', chance: 0.005, aTo: 'CACTUS', bTo: null },
  { a: 'ALGAE', b: 'STONE', chance: 0.005, aTo: 'KELP', bTo: null },
  { a: 'ALGAE', b: 'LIMESTONE', chance: 0.005, aTo: 'CORAL', bTo: null },
  { a: 'FUNGUS', b: 'ALGAE', chance: 0.01, aTo: 'LICHEN', bTo: 'EMPTY' },
  { a: 'FUNGUS', b: 'FRUIT', chance: 0.01, aTo: null, bTo: 'YEAST' },
  { a: 'MUD', b: 'SUGAR', chance: 0.01, aTo: null, bTo: 'BACTERIA' },
  { a: 'MOLD', b: 'WATER', chance: 0.005, aTo: null, bTo: 'PENICILLIN' },
  { a: 'PENICILLIN', b: 'BACTERIA', chance: 0.2, aTo: null, bTo: 'WATER' },
  { a: 'GRASS', b: 'SEED', chance: 0.02, aTo: null, bTo: 'WHEAT' },
  { a: 'GRASS', b: 'STEAM', chance: 0.005, aTo: 'SUGARCANE', bTo: null },
  { a: 'ALGAE', b: 'SALT_WATER', chance: 0.002, aTo: null, bTo: 'PLANKTON' },

  // Food.
  { a: 'FLOUR', b: 'WATER', chance: 0.05, aTo: 'DOUGH', bTo: 'EMPTY' },
  { a: 'GRASS', b: 'FERTILIZER', chance: 0.01, aTo: 'CORN', bTo: 'EMPTY' },
  { a: 'FRUIT', b: 'DIRT', chance: 0.005, aTo: 'POTATO', bTo: null },
  { a: 'OIL', b: 'POTATO', chance: 0.05, minTemp: 170, aTo: null, bTo: 'FRIES' },
  { a: 'FRUIT', b: 'ACID', chance: 0.02, aTo: 'LEMON', bTo: 'EMPTY' },
  { a: 'SUGAR', b: 'WATER', chance: 0.02, aTo: 'EMPTY', bTo: 'SYRUP' },
  { a: 'CANDY', b: 'WATER', chance: 0.005, aTo: 'EMPTY', bTo: 'SYRUP' },
  { a: 'CANDY', b: 'PLANT', chance: 0.02, aTo: 'MINT_CANDY', bTo: null },
  { a: 'CARAMEL', b: 'CLOUD', chance: 0.02, aTo: 'COTTON_CANDY', bTo: null },
  { a: 'COTTON_CANDY', b: 'WATER', chance: 0.3, aTo: 'EMPTY', bTo: 'SYRUP' },
  { a: 'FRUIT', b: 'SUGAR', chance: 0.02, minTemp: 80, aTo: 'JAM', bTo: 'EMPTY' },
  { a: 'SEED', b: 'YEAST', chance: 0.02, aTo: 'COCOA', bTo: null },
  { a: 'COCOA', b: 'SUGAR', chance: 0.02, aTo: 'CHOCOLATE', bTo: 'EMPTY' },
  { a: 'SEED', b: 'WATER', chance: 0.005, aTo: 'EMPTY', bTo: 'MILK' },
  { a: 'MILK', b: 'VINEGAR', chance: 0.05, aTo: 'CURDS', bTo: 'EMPTY' },
  { a: 'MILK', b: 'BACTERIA', chance: 0.02, aTo: 'YOGURT', bTo: null },
  { a: 'MILK', b: 'SNOW', chance: 0.02, aTo: 'ICE_CREAM', bTo: 'EMPTY' },
  { a: 'SEED', b: 'LIMESTONE', chance: 0.01, aTo: 'EGG', bTo: null },
  { a: 'EGG', b: 'VINEGAR', chance: 0.02, aTo: 'NAKED_EGG', bTo: null },
  { a: 'YEAST', b: 'SUGAR', chance: 0.02, aTo: null, bTo: 'ALCOHOL', bAlt: 'CARBON_DIOXIDE', bAltChance: 0.4 },
  { a: 'YEAST', b: 'FRUIT', chance: 0.02, aTo: null, bTo: 'WINE' },
  { a: 'WINE', b: 'BACTERIA', chance: 0.02, aTo: 'VINEGAR', bTo: null },
  { a: 'WATER', b: 'CARBON_DIOXIDE', chance: 0.002, aTo: 'SODA_WATER', bTo: 'EMPTY' },
  { a: 'SODA_WATER', b: 'CARAMEL', chance: 0.02, aTo: 'COLA', bTo: 'EMPTY' },
  { a: 'COLA', b: 'MINT_CANDY', chance: 0.5, aTo: 'BUBBLES', bTo: null, explode: 3 },
  { a: 'SUGAR', b: 'EGG', chance: 0.01, aTo: 'MARSHMALLOW', bTo: 'EMPTY' },

  // Creatures.
  { a: 'PLANKTON', b: 'SLIME', chance: 0.02, aTo: 'JELLYFISH', bTo: 'EMPTY' },
  { a: 'EGG', b: 'SALT_WATER', chance: 0.01, aTo: 'FISH', bTo: null },
  { a: 'FISH', b: 'BATTERY', chance: 0.02, aTo: 'ELECTRIC_EEL', bTo: null },
  { a: 'EGG', b: 'CLOUD', chance: 0.02, aTo: 'BIRD', bTo: null },
  { a: 'MUD', b: 'FRUIT', chance: 0.01, aTo: null, bTo: 'WORM' },
  { a: 'WORM', b: 'LIMESTONE', chance: 0.01, aTo: 'SNAIL', bTo: null },
  { a: 'DIRT', b: 'SUGAR', chance: 0.01, aTo: null, bTo: 'ANT' },
  { a: 'ANT', b: 'WOOD', chance: 0.01, aTo: 'TERMITE', bTo: null },
  { a: 'ANT', b: 'GLUE', chance: 0.01, aTo: 'SPIDER', bTo: null },
  { a: 'ANT', b: 'GRASS', chance: 0.002, aTo: 'LOCUST', bTo: null },
  { a: 'ANT', b: 'FLOWER', chance: 0.01, aTo: 'BEE', bTo: null },
  { a: 'WORM', b: 'FLOWER', chance: 0.01, aTo: 'BUTTERFLY', bTo: null },
  { a: 'BEE', b: 'PHOSPHOR', chance: 0.02, aTo: 'FIREFLY', bTo: null },
  { a: 'LICHEN', b: 'WATER', chance: 0.005, aTo: null, bTo: 'TARDIGRADE' },
  { a: 'BIRD', b: 'FIRE', chance: 0.3, aTo: 'PHOENIX', bTo: null },

  { a: 'MILK', b: 'SALT', chance: 0.02, aTo: 'TOFU', bTo: 'EMPTY' },
  { a: 'GLUE', b: 'SUGAR', chance: 0.02, aTo: 'JELLY', bTo: 'EMPTY' },
  { a: 'MEAT', b: 'SALT', chance: 0.02, aTo: 'JERKY', bTo: 'EMPTY' },
  { a: 'STARCH', b: 'VINEGAR', chance: 0.02, minTemp: 80, aTo: 'BIOPLASTIC', bTo: 'EMPTY' },
  { a: 'PLASTIC', b: 'COLD_LIGHT', chance: 0.05, aTo: 'GLOWSTICK', bTo: 'EMPTY' },
  { a: 'FUSE', b: 'METAL', chance: 0.02, aTo: 'SPARKLER', bTo: null },
  { a: 'STRONTIUM', b: 'FUSE', chance: 0.02, aTo: 'FLARE', bTo: null },
  { a: 'FUNGUS', b: 'SLIME', chance: 0.02, aTo: 'SLIME_MOLD', bTo: 'EMPTY' },
  { a: 'JELLYFISH', b: 'INK', chance: 0.02, aTo: 'SQUID', bTo: 'EMPTY' },
  { a: 'FISH', b: 'MUD', chance: 0.02, aTo: 'FROG', bTo: null },

  // Weather, space and legends.
  { a: 'LIQUID_HYDROGEN', b: 'LOX', chance: 0.1, aTo: 'FIRE', bTo: 'FIRE', explode: 12 },
  { a: 'ICE', b: 'STRANGE_MATTER', chance: 0.1, aTo: 'ICE_NINE', bTo: null },
  { a: 'GRAPHENE', b: 'VIRUS', chance: 0.02, aTo: 'GREY_GOO', bTo: 'EMPTY' },
  { a: 'DRY_ICE', b: 'WATER', chance: 0.1, aTo: 'CARBON_DIOXIDE', bTo: 'FOG' },
  { a: 'ICE', b: 'CLOUD', chance: 0.02, aTo: 'HAIL', bTo: null },
  { a: 'DIRT', b: 'ICE', chance: 0.01, aTo: 'PERMAFROST', bTo: null },
  { a: 'SAND', b: 'CLAY', chance: 0.01, aTo: 'QUICKSAND', bTo: 'EMPTY' },
  { a: 'PLASMA', b: 'CLOUD', chance: 0.05, aTo: 'BALL_LIGHTNING', bTo: null },
  { a: 'STAR', b: 'GRAVEL', chance: 0.05, aTo: null, bTo: 'METEOR' },
  { a: 'STAR', b: 'METAL', chance: 0.1, aTo: 'SUPERNOVA', bTo: 'PLASMA' },
  { a: 'NEUTRONIUM', b: 'MAGNET', chance: 0.05, aTo: 'PULSAR', bTo: null },
  { a: 'NEUTRONIUM', b: 'PLASMA', chance: 0.05, aTo: 'QUARK_GLUON_PLASMA', bTo: null },
  { a: 'QUARTZ', b: 'DARK_MATTER', chance: 0.02, aTo: 'TIME_CRYSTAL', bTo: 'EMPTY' },
  { a: 'PHILOSOPHERS_STONE', b: 'WATER', chance: 0.02, aTo: null, bTo: 'ELIXIR' },
  { a: 'ELIXIR', b: 'ASH', chance: 0.1, aTo: null, bTo: 'PLANT' },
  { a: 'TAR', b: 'QUICKLIME', chance: 0.02, aTo: 'GREEK_FIRE', bTo: 'EMPTY' },
  { a: 'GREEK_FIRE', b: 'WATER', chance: 0.1, aTo: null, bTo: 'STEAM', heat: 250 },
];

export const WORLD_HITS = [
  { p: 'PHOTON', t: 'CLOUD', chance: 0.05, spawn: 'RAINBOW', keep: true },
  { p: 'PHOTON', t: 'PHOTO_PAPER', chance: 0.3, tTo: 'PHOTOGRAPH' },
  { p: 'XRAY', t: 'PHOTO_PAPER', chance: 0.5, tTo: 'PHOTOGRAPH' },
  { p: 'UV_LIGHT', t: 'URANIUM_GLASS', chance: 0.8, action: 'excite', emit: ['PHOTON'] },
  { p: 'ELECTRON', t: 'TUNGSTEN', chance: 0.3, emit: ['XRAY'] },
  { p: 'ELECTRON', t: 'OXYGEN', chance: 0.1, tTo: 'AURORA' },
  { p: 'MICROWAVE', t: 'CORN', chance: 0.3, heat: 200 },
  { p: 'MUON', t: 'DEUTERIUM', chance: 0.1, tTo: 'HELIUM', emit: ['NEUTRON'], keep: true, heat: 500 },
  { p: 'NEUTRINO', t: 'DARK_MATTER', chance: 0.3, emit: ['TACHYON'] },
];

export const WORLD_PAIRS = [
  { a: 'PROTON', b: 'PROTON', chance: 0.3, emit: ['PION', 'PION'] },
  { a: 'MUON', b: 'MUON', chance: 0.5, emit: ['HIGGS'] },
];
