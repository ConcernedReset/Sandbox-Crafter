// Chemistry and geology: acids, lab reagents, classic demonstrations, pigments,
// rocks, gems and fossils. Most recipes here are real reactions, simplified to
// two ingredients. Field meanings are documented at the top of elements.js.

import { State } from './constants.js';

const { SOLID, POWDER, LIQUID, GAS } = State;

const chem = (key, name, sym, state, colors, extra) => ({ key, name, sym, cat: 'chemical', state, colors, ...extra });
const acid = (key, name, sym, colors, density, extra) => chem(key, name, sym, LIQUID, colors, {
  density, spread: 5, acidProof: true, transparent: true, behavior: 'acid', ...extra,
});
const gem = (key, name, sym, colors, strength, extra) => ({
  key, name, sym, cat: 'mineral', state: SOLID, colors, strength, conduct: 0.3, transparent: true,
  acidProof: true, ...extra,
});
const rock = (key, name, sym, colors, density, strength, extra) => ({
  key, name, sym, cat: 'mineral', state: SOLID, colors, density, strength, conduct: 0.2, ...extra,
});

export const CHEMISTRY_ELEMENTS = [
  // ---- acids --------------------------------------------------------------------
  chem('NITROGEN_DIOXIDE', 'Nitrogen Dioxide', 'NO2', GAS, ['#b8602a', '#a85424'], {
    alpha: 0.5, density: 0.16, rise: 0.1, sink: 0.3, airDrag: 0.35,
    desc: 'Choking red-brown gas, the colour of city smog. Lightning and electric arcs make it out of the air.',
    hint: 'Put an electric arc (Spark) through Nitrogen.',
  }),
  acid('NITRIC_ACID', 'Nitric Acid', 'HNO', ['#f2eeb8', '#e8e4ac'], 1.5, {
    desc: 'Fuming acid that stains skin yellow and dissolves copper in a cloud of brown gas.',
    hint: 'Dissolve Nitrogen Dioxide in Water.',
  }),
  acid('AQUA_REGIA', 'Aqua Regia', 'AR', ['#e8a040', '#dc9434', '#f4ac4c'], 1.2, {
    transparent: false,
    desc: '"Royal water", nitric and hydrochloric acid together: the only acid that dissolves gold and platinum. In 1940 a chemist dissolved two Nobel medals in it to hide them from the Nazis.',
    hint: 'Mix Nitric Acid with Acid.',
  }),
  chem('DISSOLVED_GOLD', 'Dissolved Gold', 'AuCl', LIQUID, ['#f0c830', '#e4bc24', '#fcd43c'], {
    density: 1.4, spread: 3, high: { temp: 150, to: 'GOLD', chance: 0.02 },
    desc: 'Gold dissolved in aqua regia. Boil it off and the gold comes back, which is how the hidden Nobel medals were recast after the war.',
    hint: 'Dissolve Gold in Aqua Regia.',
  }),
  acid('HYDROFLUORIC_ACID', 'Hydrofluoric Acid', 'HF', ['#e8f4e0', '#dceed4'], 1.15, {
    desc: 'The one acid that eats glass, so it has to be kept in plastic bottles. Glassworkers use it to etch patterns.',
    hint: 'Fluorine meeting Water.',
  }),
  chem('SULFUR_DIOXIDE', 'Sulfur Dioxide', 'SO2', GAS, ['#e0e0c8', '#d4d4bc'], {
    alpha: 0.3, density: 0.2, rise: 0.08, sink: 0.35, airDrag: 0.35,
    desc: 'Choking gas from burning sulfur and erupting volcanoes. Dissolved in rain, it makes acid rain.',
    hint: 'Burn Sulfur.',
  }),
  acid('SULFURIC_ACID', 'Sulfuric Acid', 'H2S', ['#f2eed8', '#e8e4cc'], 1.8, {
    spread: 3, viscosity: 0.3,
    desc: 'Thick, heavy "oil of vitriol" that is desperate for water. It chars sugar into a rising black column, and water poured into it boils.',
    hint: 'Dissolve Sulfur Dioxide in Water.',
  }),
  chem('ACID_RAIN', 'Acid Rain', 'AcR', LIQUID, ['#9cb8c8', '#90acbc'], {
    density: 1.0, spread: 8, transparent: true, wet: true,
    desc: 'Rain soured by sulfur from smokestacks and volcanoes. It eats away marble statues and limestone.',
    hint: 'Let Sulfur Dioxide drift into a Cloud.',
  }),

  // ---- lab bench classics -----------------------------------------------------
  chem('HYDROGEN_PEROXIDE', 'Hydrogen Peroxide', 'H2O2', LIQUID, ['#e8f4fb', '#dcecf5'], {
    density: 1.45, spread: 6, transparent: true, wet: true,
    decay: { chance: 0.0003, to: 'WATER', spawn: 'OXYGEN' },
    desc: 'Water with an extra oxygen atom it wants to lose. It slowly fizzes back into water, and a catalyst makes it foam furiously.',
    hint: 'Ozone dissolving in Water.',
  }),
  chem('ELEPHANT_TOOTHPASTE', 'Elephant Toothpaste', 'ET', POWDER, ['#f8f0e8', '#f0e4d8', '#fff8f0'], {
    density: 0.3, fallRate: 0.4, temp: 50, life: [300, 500], behavior: 'decay', lifeEnd: { to: 'WATER' },
    desc: 'A column of foam full of oxygen from peroxide split in a hurry. It\'s warm, because splitting peroxide gives off heat.',
    hint: 'Add Yeast to Hydrogen Peroxide.',
  }),
  chem('BLEACH', 'Bleach', 'Blc', LIQUID, ['#f0f4d8', '#e8eccc'], {
    density: 1.1, spread: 6, transparent: true,
    desc: 'Chlorine dissolved in lye. It strips the colour out of dyes and ink. Never mix it with acid: it gives off chlorine gas.',
    hint: 'Bubble Chlorine through Lye.',
  }),
  chem('VINEGAR', 'Vinegar', 'Vg', LIQUID, ['#e8dcb8', '#dcd0ac'], {
    density: 1.01, spread: 7, transparent: true, wet: true,
    desc: 'Sour, dilute acetic acid, made when bacteria feed on alcohol. It fizzes with baking soda and dissolves eggshells.',
    hint: 'Leave Alcohol open to the Oxygen.',
  }),
  chem('BAKING_SODA', 'Baking Soda', 'BkS', POWDER, ['#fafafa', '#f2f2f2', '#ffffff'], {
    density: 2.2, high: { temp: 150, to: 'WASHING_SODA', chance: 0.02 },
    desc: 'Sodium bicarbonate. It fizzes with vinegar, and heat breaks it down into carbon dioxide, which is what makes cakes rise.',
    hint: 'Bubble Carbon Dioxide through Salt Water, the way the Solvay process does.',
  }),
  chem('WASHING_SODA', 'Washing Soda', 'WSd', POWDER, ['#eef0f2', '#e4e6e8', '#f6f8fa'], {
    density: 2.5,
    desc: 'Sodium carbonate, baking soda\'s stronger cousin, for softening water and cutting grease.',
    hint: 'Heat Baking Soda.',
  }),
  chem('SODIUM_ACETATE', 'Sodium Acetate', 'NaAc', LIQUID, ['#eef4f8', '#e4ecf2'], {
    density: 1.3, spread: 5, transparent: true, low: { temp: -5, to: 'HOT_ICE', chance: 0.02 },
    desc: 'A supercooled solution that should have frozen but hasn\'t. Touch it with a crystal and it freezes solid in seconds, getting warm.',
    hint: 'Neutralise Vinegar with Baking Soda.',
  }),
  chem('HOT_ICE', 'Hot Ice', 'HI', SOLID, ['#f4f8fa', '#eaf0f4', '#fcfeff'], {
    strength: 10, temp: 54, density: 1.45, high: { temp: 58, to: 'SODIUM_ACETATE', chance: 0.05 },
    desc: 'Sodium acetate crystals, warm to the touch. Hand warmers are full of it; boil them and the crystals melt back into liquid.',
    hint: 'Chill Sodium Acetate until it gives up waiting and crystallises.',
  }),
  chem('QUICKLIME', 'Quicklime', 'QL', POWDER, ['#f8f6ee', '#eeece4', '#fffdf6'], {
    density: 3.3, hotEmit: { temp: 1200, chance: 0.08 },
    desc: 'Burnt lime. Water makes it hiss and boil. Heated white-hot it glows brilliantly: the "limelight" of Victorian theatres.',
    hint: 'Burn Calcium.',
  }),
  chem('SLAKED_LIME', 'Slaked Lime', 'SL', POWDER, ['#f4f4ee', '#eaeae2', '#fafaf6'], {
    density: 2.2,
    desc: 'White powder that soaks up carbon dioxide from the air and hardens back into limestone. Romans built with it.',
    hint: 'Calcium fizzing in Water, or Quicklime slaked with Water.',
  }),
  chem('LIMEWATER', 'Limewater', 'LW', LIQUID, ['#e4eef2', '#dce6ea'], {
    density: 1.0, spread: 8, transparent: true, wet: true,
    desc: 'Clear lime solution that turns milky the moment carbon dioxide touches it: the classic school test for CO₂.',
    hint: 'Stir Slaked Lime into Water.',
  }),
  chem('PLASTER_OF_PARIS', 'Plaster of Paris', 'PoP', POWDER, ['#f4f2ec', '#eae8e2', '#fcfaf4'], {
    density: 1.2,
    desc: 'Gypsum baked until its water is driven off. Add water back and it sets hard. Named after the gypsum quarries of Montmartre.',
    hint: 'Bake Gypsum.',
  }),
  chem('WET_PLASTER', 'Wet Plaster', 'WPl', LIQUID, ['#e8e6de', '#dedcd4'], {
    density: 1.6, spread: 1, viscosity: 0.85, life: [400, 700], behavior: 'decay', lifeEnd: { to: 'PLASTER' },
    desc: 'Plaster slurry. Pour it where you want it; it warms up as it sets.',
    hint: 'Mix Plaster of Paris with Water.',
  }),
  chem('BORAX', 'Borax', 'Bor', POWDER, ['#f0f4f6', '#e6eaec', '#f8fcfe'], {
    density: 1.7,
    desc: 'White mineral from dried-up desert lakes. It links glue molecules together into slime.',
    hint: 'Boron dissolving into Salt Water, as in Death Valley\'s dry lakes.',
  }),
  chem('STARCH', 'Starch', 'Stc', POWDER, ['#fbfbf6', '#f2f2ea', '#ffffff'], {
    density: 1.5, flammable: 0.3, ignite: 300, burn: { fireLife: [8, 15] },
    desc: 'Fine white powder plants store energy in. Mix it with water and you get something that can\'t decide whether it\'s a liquid.',
    hint: 'Soak a Potato in Water.',
  }),
  chem('OOBLECK', 'Oobleck', 'Oo', LIQUID, ['#f4f0e0', '#eae6d6'], {
    density: 1.6, spread: 1, viscosity: 0.7, pressure: { above: 3, to: 'STIFF_OOBLECK', chance: 0.5 },
    desc: 'Cornstarch and water. It flows when left alone but stiffens the instant it\'s shoved; you can run across a pool of it.',
    hint: 'Stir Starch into Water.',
  }),
  chem('STIFF_OOBLECK', 'Stiff Oobleck', 'SOo', SOLID, ['#e8e4d2', '#dedac8'], {
    strength: 5, density: 1.6, life: [30, 60], behavior: 'decay', lifeEnd: { to: 'OOBLECK' },
    desc: 'Oobleck caught mid-shove: solid for a moment, then it relaxes back into goo.',
    hint: 'Hit Oobleck with a pressure wave.',
  }),
  chem('SUPER_ABSORBENT', 'Super Absorbent', 'SAP', POWDER, ['#fcfcfc', '#f4f4f4'], {
    density: 0.8,
    desc: 'Sodium polyacrylate, the stuff inside nappies. It soaks up hundreds of times its weight in water.',
    hint: 'Treat Plastic with Lye.',
  }),
  chem('INSTANT_SNOW', 'Instant Snow', 'ISn', POWDER, ['#ffffff', '#f4f8fc', '#eef4fa'], {
    density: 0.4, fallRate: 0.5, airDrag: 0.12,
    desc: 'Fluffy fake snow made of swollen polymer gel. It feels cool, but it never melts.',
    hint: 'Add Water to Super Absorbent.',
  }),
  chem('LUMINOL', 'Luminol', 'Lum', POWDER, ['#f0e8a8', '#e6de9c'], {
    density: 1.6,
    desc: 'Pale yellow powder that glows blue wherever there\'s a trace of blood, so crime-scene investigators spray it.',
    hint: 'Heat Ammonia with Coal (luminol is a coal-tar chemical).',
  }),
  chem('COLD_LIGHT', 'Cold Light', 'CL', LIQUID, ['#5ab0ff', '#4aa0f0', '#6ac0ff'], {
    density: 1.0, spread: 6, glowAmount: 1.0, life: [300, 600], behavior: 'decay', lifeEnd: { to: 'WATER' },
    desc: 'Chemiluminescence: light from a chemical reaction instead of heat, as in glow sticks. It fades as the chemicals run out.',
    hint: 'Mix Luminol with Hydrogen Peroxide.',
  }),
  chem('PHOSPHOR', 'Phosphor', 'Phr', POWDER, ['#dcefcf', '#d0e6c2', '#e8f6dc'], {
    density: 3.2, excite: { color: '#8aff9a' },
    desc: 'Zinc sulfide, the green glow of watch dials and old TV screens. Light or ultraviolet sets it shining.',
    hint: 'Zinc and Sulfur.',
  }),
  chem('RADIUM_PAINT', 'Radium Paint', 'RaP', LIQUID, ['#c8f0b0', '#bce4a4', '#d4fcbc'], {
    density: 1.5, spread: 1, viscosity: 0.8, glowAmount: 0.9, selfHeat: 0.01,
    emits: [{ p: 'ALPHA', chance: 0.001 }],
    desc: 'Radium mixed into phosphor: it glows without any light at all. The "Radium Girls" who painted watch dials with it in the 1920s were poisoned, and their lawsuits changed workplace safety law.',
    hint: 'Mix Radium into Phosphor.',
  }),
  chem('COPPER_SULFATE', 'Copper Sulfate', 'CuS', POWDER, ['#2a7ad8', '#2470cc', '#3a8ae4'], {
    density: 3.6,
    desc: 'Brilliant blue crystals. Drop iron into it and the iron comes out coated in copper.',
    hint: 'Dissolve Copper in hot Sulfuric Acid.',
  }),
  chem('SILVER_CHLORIDE', 'Silver Chloride', 'AgCl', POWDER, ['#f4f4f0', '#eaeae4'], {
    density: 5.6,
    desc: 'White powder that darkens in light as specks of silver form: the chemistry of black-and-white photography.',
    hint: 'Chlorine tarnishing Silver.',
  }),
  chem('CARBON_MONOXIDE', 'Carbon Monoxide', 'CO', GAS, ['#d8d8d8', '#cccccc'], {
    alpha: 0.15, density: 0.06, rise: 0.3, flammable: 1, ignite: 600, flame: '#4a6aff',
    burn: { to: 'CARBON_DIOXIDE', toChance: 0.5, fireTemp: 1200, fireLife: [10, 20] },
    desc: 'Invisible, odourless and poisonous: it\'s what makes a blocked chimney deadly. It burns with a blue flame.',
    hint: 'Pass Carbon Dioxide over red-hot Coal.',
  }),
  chem('HYDROGEN_SULFIDE', 'Hydrogen Sulfide', 'HS', GAS, ['#e4e8c0', '#d8dcb4'], {
    alpha: 0.25, density: 0.07, rise: 0.3, flammable: 1, ignite: 260, flame: '#5a7aff',
    burn: { to: 'SULFUR_DIOXIDE', toChance: 0.5, fireTemp: 1000, fireLife: [10, 20] },
    desc: 'The smell of rotten eggs and sulfur springs. It burns blue and turns silver black.',
    hint: 'Leave an Egg to rot.',
  }),
  chem('TARNISH', 'Tarnish', 'Tsh', POWDER, ['#2a2a2e', '#343438', '#202024'], {
    density: 7.2,
    desc: 'Black silver sulfide, the dark film on old spoons. Baking soda and a bit of aluminium foil turn it back into silver.',
    hint: 'Rotten-egg gas (Hydrogen Sulfide) blackens Silver.',
  }),
  chem('ACETONE', 'Acetone', 'Act', LIQUID, ['#eef4f8', '#e4ecf2'], {
    density: 0.78, spread: 7, transparent: true,
    flammable: 0.4, ignite: 465, burn: { fireTemp: 900, fireLife: [15, 30] },
    desc: 'Nail-polish remover. It evaporates in seconds, burns readily, and melts a styrofoam cup into a puddle of goo.',
    hint: 'Heat Quicklime with Vinegar; acetone used to be made by roasting calcium acetate.',
  }),
  chem('ANTIFREEZE', 'Antifreeze', 'AF', LIQUID, ['#5ae06a', '#4ad45c'], {
    density: 1.1, spread: 6, transparent: true,
    desc: 'Stays liquid far below freezing and melts ice it touches. Car radiators use a sweet-tasting but poisonous kind.',
    hint: 'Mix Alcohol into Water: the mixture freezes far below 0 °C.',
  }),
  chem('KEROSENE', 'Kerosene', 'Krs', LIQUID, ['#e8e0c8', '#ded6bc'], {
    density: 0.8, spread: 5, flammable: 0.2, ignite: 220, burn: { smoke: 0.3, fireTemp: 1000, fireLife: [30, 60] },
    desc: 'Lamp oil and jet fuel. Refining it from oil in the 1850s gave the world cheap light, and saved the whales hunted for lamp oil.',
    hint: 'Crack hot Oil over Clay.',
  }),
  chem('TAR', 'Tar', 'Tar', LIQUID, ['#1e1a16', '#28231d', '#16130f'], {
    density: 1.2, spread: 1, viscosity: 0.95, sticky: true,
    flammable: 0.02, ignite: 400, burn: { smoke: 0.9, fireLife: [200, 300] },
    desc: 'Thick black pitch. A drop of it in Brisbane has been dripping since 1927; one falls about once a decade.',
    hint: 'Leave Oil out in the air until it thickens.',
  }),
  chem('SOOT', 'Soot', 'Sot', POWDER, ['#141414', '#1c1c1c', '#101010'], {
    density: 0.3, fallRate: 0.3, airDrag: 0.2, flammable: 0.05, ignite: 500, burn: { fireLife: [10, 20] },
    desc: 'Fine black carbon from smoky flames, the "lampblack" in ink and paint.',
    hint: 'Let Smoke settle on cold Metal.',
  }),
  chem('CALCIUM_CARBIDE', 'Calcium Carbide', 'CaC', POWDER, ['#6a6e72', '#5e6266', '#767a7e'], {
    density: 2.2,
    desc: 'Grey rock that fizzes out flammable gas the moment it gets wet. Miners\' lamps and early car headlamps dripped water on it and burned the gas.',
    hint: 'Heat Quicklime with Graphite in an electric furnace, very hot.',
  }),
  chem('ACETYLENE', 'Acetylene', 'C2H', GAS, ['#e0e0f0', '#d4d4e8'], {
    alpha: 0.2, density: 0.045, rise: 0.4, flammable: 1, ignite: 305, explode: 5, flame: '#e8f0ff',
    burn: { fireTemp: 3100, fireLife: [15, 30] },
    desc: 'Burns hotter than any other common fuel, over 3000 °C: hot enough to cut through steel.',
    hint: 'Wet some Calcium Carbide.',
  }),
  chem('CHARCOAL', 'Charcoal', 'Chc', POWDER, ['#1e1e20', '#28282a', '#161618'], {
    cat: 'powder', density: 0.5, flammable: 0.02, ignite: 350, burn: { fireTemp: 1100, fireLife: [150, 250] },
    desc: 'Wood baked without air until only carbon is left. It burns hotter and cleaner than wood, and it floats.',
    hint: 'Heat Wood where there\'s no air, only hot Nitrogen.',
  }),
  chem('ACTIVATED_CHARCOAL', 'Activated Charcoal', 'ACh', POWDER, ['#101012', '#18181a', '#0c0c0e'], {
    density: 0.4,
    desc: 'Charcoal riddled with tiny pores: a spoonful has the surface area of a football pitch. It soaks up smoke, smells and stains.',
    hint: 'Steam some Charcoal.',
  }),
  chem('COKE', 'Coke', 'Cok', POWDER, ['#3a3a40', '#444448', '#303036'], {
    cat: 'powder', density: 1.1, flammable: 0.01, ignite: 600, burn: { fireTemp: 1500, fireLife: [200, 300] },
    desc: 'Coal baked without air. In 1709 Abraham Darby smelted iron with it instead of charcoal and started the Industrial Revolution.',
    hint: 'Heat Coal where there\'s no air, only hot Nitrogen.',
  }),
  chem('CARBON_SNAKE', 'Carbon Snake', 'CSn', SOLID, ['#1a1614', '#221d1a', '#120f0d'], {
    strength: 3, density: 0.3, flammable: 0.02, ignite: 500, behavior: 'stalk',
    stalk: { height: [10, 25], rate: 0.2 },
    desc: 'Sulfuric acid rips the water out of sugar, leaving a black column of carbon foam that rises out of the beaker, steaming.',
    hint: 'Pour Sulfuric Acid on Sugar.',
  }),
  chem('MERCURY_VAPOR', 'Mercury Vapour', 'HgV', GAS, ['#c8d4d8', '#bcc8cc'], {
    alpha: 0.3, density: 0.4, temp: 400, airCool: 0.003, rise: 0.1, sink: 0.3, airDrag: 0.35,
    low: { temp: 340, to: 'MERCURY', chance: 0.02 }, excite: { color: '#8ae8d8', emit: 'UV_LIGHT' },
    desc: 'Boiled mercury. A current makes it glow blue-green and pour out ultraviolet; coat the tube in phosphor and you have a fluorescent lamp.',
    hint: 'Boil Mercury.',
  }),
  chem('SODIUM_VAPOR', 'Sodium Vapour', 'NaV', GAS, ['#e8d8a8', '#dccca0'], {
    alpha: 0.3, density: 0.08, rise: 0.3, airDrag: 0.4, excite: { color: '#ffb030' },
    desc: 'The orange glow of old streetlights. Sodium lamps start up on neon, then the sodium warms and takes over.',
    hint: 'Sodium sealed in with Neon, like a streetlamp.',
  }),
  chem('SMOG', 'Smog', 'Smg', GAS, ['#8a7a5a', '#7e6e50'], {
    alpha: 0.55, density: 0.08, rise: 0.1, sink: 0.1, drift: 0.3, life: [400, 800], behavior: 'decay',
    desc: 'Smoke and exhaust cooked into a brown haze. London\'s Great Smog of 1952 lasted five days.',
    hint: 'Nitrogen Dioxide mixing with Smoke.',
  }),
  chem('FREON', 'Freon', 'CFC', GAS, ['#e8f0f4', '#dce6ec'], {
    alpha: 0.15, density: 0.2, temp: -30, holdTemp: true, rise: 0.1, sink: 0.3, airDrag: 0.35,
    desc: 'The refrigerant in old fridges. Harmless down here, but high up each molecule destroys thousands of ozone molecules, so it was banned worldwide in 1987.',
    hint: 'Let Fluorine react with Methane.',
  }),
  chem('WATERGLASS', 'Waterglass', 'WGl', LIQUID, ['#e0ecee', '#d6e2e4'], {
    density: 1.4, spread: 2, viscosity: 0.6, transparent: true,
    desc: 'Sodium silicate: liquid glass. It fireproofs wood, preserved eggs before fridges, and grows crystal gardens.',
    hint: 'Dissolve hot Sand in Lye.',
  }),
  chem('CRYSTAL_GARDEN', 'Crystal Garden', 'CGd', SOLID, ['#2a8ae8', '#4ac0e0', '#6ae0b0', '#2a6ad0'], {
    strength: 5, density: 1.5, behavior: 'stalk', stalk: { height: [6, 16], rate: 0.1, into: ['WATERGLASS', 'WATER'] },
    desc: 'Hollow mineral tubes that shoot upward when metal-salt crystals are dropped into waterglass. A Victorian parlour favourite.',
    hint: 'Drop Copper Sulfate into Waterglass.',
  }),
  chem('GOLDEN_RAIN', 'Golden Rain', 'GRn', POWDER, ['#f8d840', '#f0cc30', '#ffe460'], {
    density: 6, fallRate: 0.3, sparkle: true, glowAmount: 0.15,
    desc: 'Lead iodide: glittering golden flakes that drift down like the snow in a snow globe.',
    hint: 'Iodine on Lead.',
  }),
  chem('SILICA_GEL', 'Silica Gel', 'SiG', POWDER, ['#f0f4f8', '#e8eef4', '#f8a0c8'], {
    density: 0.7,
    desc: 'Glassy beads riddled with pores that soak up moisture: the "do not eat" sachets in new shoes.',
    hint: 'Set Waterglass with Acid.',
  }),
  chem('EPSOM_SALT', 'Epsom Salt', 'MgS', POWDER, ['#f4f8fa', '#eaeef0', '#fcfeff'], {
    density: 1.7,
    desc: 'Magnesium sulfate, named after a bitter spring in Epsom, England. Gardeners feed it to tomatoes and roses.',
    hint: 'Dissolve Magnesium in Sulfuric Acid.',
  }),
  chem('MOLTEN_SALT', 'Molten Salt', 'MSl', LIQUID, ['#f8e8c8', '#f0dcb8', '#fff0d4'], {
    density: 1.6, temp: 850, spread: 5, glow: true, conductor: true, conduct: 0.4, airCool: 0.0008,
    low: { temp: 780, to: 'SALT', chance: 0.05 },
    desc: 'Salt melted at 801 °C. Unlike solid salt it conducts electricity, which is how Davy first pulled sodium out of it. Some reactor designs run on it.',
    hint: 'Melt Salt.',
  }),

  // ---- pigments -------------------------------------------------------------------
  chem('PRUSSIAN_BLUE', 'Prussian Blue', 'PB', POWDER, ['#1a3a8a', '#16327c', '#20449a'], {
    density: 1.8,
    desc: 'The first modern synthetic pigment, made by accident in 1706 from dried blood and iron. Doctors use it to pull radioactive cesium and thallium out of the body.',
    hint: 'Iron Rust meeting Blood.',
  }),
  chem('VERMILION', 'Vermilion', 'Vrm', POWDER, ['#e0301e', '#d22818', '#ec3c28'], {
    density: 8,
    desc: 'The brilliant red of Chinese lacquer and medieval manuscripts: ground-up cinnabar.',
    hint: 'Grind Cinnabar under Pressure.',
  }),
  chem('OCHRE', 'Ochre', 'Och', POWDER, ['#c8862a', '#b87a24', '#d49234', '#a85a2a'], {
    density: 2.5,
    desc: 'Earth coloured by iron: the yellows and reds of cave paintings made 40,000 years ago.',
    hint: 'Clay stained with Rust.',
  }),
  chem('ULTRAMARINE', 'Ultramarine', 'Ult', POWDER, ['#1a3ad8', '#1432c8', '#2448e4'], {
    density: 2.4,
    desc: 'Ground lapis lazuli: the most expensive blue in history, worth more than gold, and saved for the Virgin Mary\'s robes.',
    hint: 'Grind Lapis Lazuli under Pressure.',
  }),
  chem('INDIGO', 'Indigo', 'Ind', POWDER, ['#2a2a7a', '#24246c', '#303088'], {
    density: 1.5,
    desc: 'Blue dye fermented out of plants: the colour of blue jeans, and for centuries a crop worth fighting over.',
    hint: 'Ferment Flowers with Bacteria.',
  }),
  chem('TYRIAN_PURPLE', 'Tyrian Purple', 'TyP', POWDER, ['#7a1a5a', '#6c164e', '#881e66'], {
    density: 1.5,
    desc: 'Royal purple, squeezed from sea snails: about ten thousand of them for one gram. Only emperors were allowed to wear it.',
    hint: 'Steep Seashells in Salt Water.',
  }),
  chem('CHLOROPHYLL', 'Chlorophyll', 'Chl', LIQUID, ['#3ab04a', '#30a040', '#44c054'], {
    density: 0.9, spread: 4, excite: { color: '#ff3a3a' },
    desc: 'The green of leaves, soaked out with alcohol. Shine ultraviolet on it and it glows blood-red.',
    hint: 'Soak a Plant in Alcohol.',
  }),
  chem('PERFUME', 'Perfume', 'Pfm', GAS, ['#f8d0e8', '#f0c4dc'], {
    alpha: 0.2, density: 0.05, rise: 0.4, life: [300, 600], behavior: 'decay',
    desc: 'Flower oils dissolved in alcohol, drifting off as a sweet-smelling vapour.',
    hint: 'Soak Flowers in Alcohol.',
  }),
  chem('SUNSCREEN', 'Sunscreen', 'SPF', LIQUID, ['#fafaf2', '#f2f2ea'], {
    density: 1.0, spread: 1, viscosity: 0.8,
    desc: 'White lotion of titanium dioxide that soaks up ultraviolet before it reaches your skin.',
    hint: 'Grind Titanium into Oil.',
  }),

  // ---- gems ------------------------------------------------------------------------
  gem('SAPPHIRE', 'Sapphire', 'Sap', ['#1a4ad8', '#1440c8', '#2454e4'], 180, {
    desc: 'Blue corundum: the same crystal as ruby, coloured by titanium and iron instead of chromium.',
    hint: 'A Ruby with Titanium in it instead of chromium.',
  }),
  gem('TOPAZ', 'Topaz', 'Tpz', ['#f0b040', '#e4a434', '#f8bc4c'], 160, {
    desc: 'Golden gem that needs fluorine to grow, so it forms where fluorine-rich vapour seeps through granite.',
    hint: 'Fluorine seeping through Granite.',
  }),
  gem('OPAL', 'Opal', 'Opl', ['#e8f0f8', '#7ae0e8', '#e88ad8', '#8ae88a', '#f8d86a'], 40, {
    transparent: false, render: 'strange',
    desc: 'Tiny silica spheres stacked in rows that split light into flashing colours. Up to a fifth of an opal is water.',
    hint: 'Quartz soaking in Water for a very long time.',
  }),
  gem('JADE', 'Jade', 'Jd', ['#3a9a5a', '#349050', '#44a864'], 120, {
    transparent: false,
    desc: 'Tough green stone that is harder to break than steel. Chinese carvers worked it for 7000 years, grinding it with sand because nothing could cut it.',
    hint: 'Peridot altered by Water deep underground.',
  }),
  gem('TURQUOISE', 'Turquoise', 'Tq', ['#40c8c0', '#38bcb4', '#4ad4cc', '#8a7a5a'], 50, {
    transparent: false,
    desc: 'Sky-blue stone of copper and aluminium veined with brown rock, mined in Sinai 5000 years ago.',
    hint: 'Verdigris staining Clay.',
  }),
  gem('LAPIS_LAZULI', 'Lapis Lazuli', 'Lap', ['#1a3aa8', '#14329a', '#2442b8', '#d8b840'], 50, {
    transparent: false, pressure: { above: 30, to: 'ULTRAMARINE', chance: 0.01 },
    desc: 'Deep blue stone flecked with golden pyrite, mined in the same Afghan valley for 6000 years.',
    hint: 'Sulfur baked into Marble.',
  }),
  gem('MALACHITE', 'Malachite', 'Mal', ['#1a8a4a', '#24a05a', '#14783e', '#2ab864'], 40, {
    transparent: false, acidProof: false,
    desc: 'Green stone with swirling bands. Ancient Egyptians ground it into eye paint.',
    hint: 'Verdigris seeping into Limestone.',
  }),
  gem('AZURITE', 'Azurite', 'Azr', ['#1a3ac8', '#1432b8', '#2444d8'], 40, {
    transparent: false, acidProof: false, decay: { chance: 0.0003, to: 'MALACHITE' },
    desc: 'Deep blue copper carbonate. It slowly turns into green malachite, which is why some old painted skies are green.',
    hint: 'Copper left in Carbon Dioxide.',
  }),
  gem('CITRINE', 'Citrine', 'Ctr', ['#f0b830', '#e4ac24', '#fcc43c'], 120, {
    desc: 'Golden quartz. Most citrine in shops is amethyst that has been baked.',
    hint: 'Bake Amethyst.',
  }),
  gem('SMOKY_QUARTZ', 'Smoky Quartz', 'SQz', ['#5a4a3a', '#4e3e30', '#665644'], 55, {
    desc: 'Quartz darkened by natural radiation from the rocks around it.',
    hint: 'Irradiate Quartz with Gamma rays.',
  }),
  gem('ROSE_QUARTZ', 'Rose Quartz', 'RQz', ['#f0b8c8', '#e8acbc', '#f8c4d4'], 55, {
    desc: 'Soft pink quartz, coloured by microscopic fibres of another mineral inside it.',
    hint: 'Quartz with a trace of Manganese.',
  }),
  gem('GARNET', 'Garnet', 'Grn', ['#8a1a2a', '#7c1624', '#982030'], 130, {
    desc: 'Deep red crystals that grow as slate is baked deep underground. Much sandpaper is crushed garnet.',
    hint: 'Bake Slate.',
  }),
  gem('SPINEL', 'Spinel', 'Spn', ['#d8204a', '#c81a42', '#e42a56'], 160, {
    desc: 'The "Black Prince\'s Ruby" in the British crown jewels turned out to be a spinel, a different mineral altogether.',
    hint: 'Magnesium creeping into a Ruby.',
  }),
  gem('ALEXANDRITE', 'Alexandrite', 'Alx', ['#2a8a7a', '#8a2a5a', '#249070'], 170, {
    desc: 'Emerald by day and ruby by lamplight: it changes colour with the light. Found in the Urals in 1834, on the future Tsar Alexander\'s birthday.',
    hint: 'Beryllium with a touch of Chromium.',
  }),
  gem('TOURMALINE', 'Tourmaline', 'Trm', ['#d83a6a', '#3ab86a', '#c8304e', '#44c478'], 120, {
    hotSpark: { temp: 100, chance: 0.02 },
    desc: 'Pink-and-green "watermelon" crystals. Heat one and it builds up an electric charge: Dutch traders used warm tourmaline to pull ash out of their pipes.',
    hint: 'Boron in Granite.',
  }),
  gem('MOISSANITE', 'Moissanite', 'Moi', ['#e8f4f0', '#dcece8', '#f4fcf8'], 250, {
    sparkle: true,
    desc: 'Silicon carbide, nearly as hard as diamond and more sparkly. Henri Moissan first found natural crystals of it in a meteor crater.',
    hint: 'Fuse Silicon with Graphite at 1800 °C.',
  }),
  gem('PEARL', 'Pearl', 'Prl', ['#f8f4f0', '#f0ece8', '#fffcf8'], 20, {
    transparent: false, acidProof: false, sparkle: true, density: 2.7,
    desc: 'Layer upon layer of shell laid down around a grain of sand to wall it off.',
    hint: 'A grain of Sand inside a Seashell.',
  }),
  gem('AMBER', 'Amber', 'Amb', ['#e8901a', '#dc8414', '#f49c26'], 20, {
    acidProof: false, density: 1.1, flammable: 0.02, ignite: 300, burn: { smoke: 0.5 },
    desc: 'Tree resin hardened over millions of years, sometimes with an insect inside. Rubbed, it picks up static; the Greek for amber, elektron, gave us "electricity".',
    hint: 'Squeeze Resin for a very long time.',
  }),

  // ---- rocks and fossils ------------------------------------------------------
  rock('HEMATITE', 'Hematite', 'Hem', ['#4a2a2a', '#5a3232', '#3e2222', '#8a3a2a'], 5.3, 90, {
    desc: 'Heavy iron ore that looks silvery black but grinds into blood-red powder. Mars is red because its dust is full of it.',
    hint: 'Squeeze Rust.',
  }),
  rock('LODESTONE', 'Lodestone', 'Lds', ['#2a2a2e', '#343438', '#202024'], 5.2, 90, {
    behavior: 'magnet',
    desc: 'Naturally magnetic iron ore, probably magnetised by lightning. Chinese navigators floated it to make the first compasses.',
    hint: 'Strike Hematite with Lightning.',
  }),
  rock('MARBLE', 'Marble', 'Mrb', ['#f2f0ec', '#e6e4e0', '#faf8f4', '#c8c8d0'], 2.7, 45, {
    desc: 'Limestone recrystallised by heat and pressure: the stone of Michelangelo\'s David. Acid rain slowly dissolves it.',
    hint: 'Squeeze Limestone.',
  }),
  rock('SHALE', 'Shale', 'Shl', ['#5a5550', '#504b46', '#645f5a'], 2.4, 25, {
    pressure: { above: 35, to: 'SLATE', chance: 0.01 },
    desc: 'Mud pressed into rock in thin layers. Some shale holds oil and gas.',
    hint: 'Squeeze Mud.',
  }),
  rock('SLATE', 'Slate', 'Slt', ['#3a4048', '#343a42', '#40464e'], 2.8, 50, {
    high: { temp: 700, to: 'GARNET', chance: 0.005 },
    desc: 'Shale squeezed harder until it splits into flat sheets: roof tiles and old school blackboards.',
    hint: 'Squeeze Shale.',
  }),
  rock('SANDSTONE', 'Sandstone', 'Sst', ['#d8b880', '#ccac74', '#e4c48c', '#c49a64'], 2.3, 30, {
    desc: 'Sand grains glued together by lime. The rose-red city of Petra is carved from it.',
    hint: 'Sand cemented by Limestone.',
  }),
  rock('CHALK', 'Chalk', 'Chk', ['#f8f8f4', '#f0f0ec', '#fffffc'], 1.8, 10, {
    state: POWDER,
    desc: 'Soft white rock made almost entirely of the shells of tiny sea creatures. The White Cliffs of Dover are a pile of them.',
    hint: 'Breathe Carbon Dioxide into Limewater, or crush Seashells.',
  }),
  rock('FLINT', 'Flint', 'Fnt', ['#3a3834', '#44423e', '#302e2a'], 2.6, 100, {
    desc: 'Glassy stone that forms inside chalk. Chipped, it takes an edge sharper than steel; struck with steel, it throws sparks.',
    hint: 'Quartz that forms inside Chalk.',
  }),
  rock('PUMICE', 'Pumice', 'Pum', ['#d8d4c8', '#ccc8bc', '#e4e0d4'], 0.6, 10, {
    state: POWDER,
    desc: 'Volcanic froth frozen solid, so full of bubbles that it floats. After some eruptions, rafts of it drift across the ocean for years.',
    hint: 'Lava frothing with Carbon Dioxide.',
  }),
  rock('BASALT', 'Basalt', 'Bas', ['#2e3032', '#383a3c', '#26282a'], 3.0, 60, {
    high: { temp: 1200, to: 'LAVA', chance: 0.02 },
    desc: 'Dark volcanic rock that makes up the floor of every ocean. Lava cooling in the sea piles up in pillow shapes.',
    hint: 'Pour Lava into Salt Water.',
  }),
  rock('GEODE', 'Geode', 'Geo', ['#6a5a8a', '#9a6ad0', '#3a3434', '#b88ae8'], 2.6, 60, {
    desc: 'A dull rock ball that cracks open onto a cave of crystals, grown by water seeping into a gas bubble in old lava.',
    hint: 'Amethyst growing inside Basalt.',
  }),
  rock('DESERT_ROSE', 'Desert Rose', 'DRs', ['#d8a878', '#cc9c6c', '#e4b484'], 2.4, 20, {
    desc: 'Petal-shaped gypsum crystals that grow in desert sand, trapping the sand inside them.',
    hint: 'Gypsum growing in Sand.',
  }),
  rock('KIMBERLITE', 'Kimberlite', 'Kmb', ['#3a4a3a', '#445444', '#304030'], 3.0, 60, {
    desc: 'Blue-green rock that shot up from 150 km down in volcanic pipes, carrying diamonds with it.',
    hint: 'Squeeze Peridot as hard as the deep mantle does.',
  }),
  rock('MICA', 'Mica', 'Mca', ['#c8c0a8', '#bcb49c', '#d4ccb4'], 2.8, 20, {
    transparent: true,
    desc: 'Peels apart into clear, heat-proof sheets. Before cheap glass, stove and lantern windows were made of it.',
    hint: 'Potassium soaking into Granite.',
  }),
  rock('TALC', 'Talc', 'Tlc', ['#f0f0ea', '#e6e6e0', '#f8f8f2'], 2.7, 5, {
    state: POWDER,
    desc: 'The softest mineral: a fingernail scratches it. Ground up, it\'s talcum powder.',
    hint: 'Steam altering Peridot.',
  }),
  rock('KAOLIN', 'Kaolin', 'Kln', ['#f8f6f0', '#f0eee8', '#fffef8'], 2.6, 5, {
    state: POWDER, high: { temp: 1300, to: 'PORCELAIN', chance: 0.02 },
    desc: 'Pure white china clay, named after a hill in China. Europe spent centuries trying to copy the porcelain made from it.',
    hint: 'Wash Clay with Acid until only the whitest part is left.',
  }),
  rock('FULGURITE', 'Fulgurite', 'Flg', ['#b8a888', '#aa9a7a', '#c4b494'], 2.0, 20, {
    desc: 'Hollow tubes of glass fused into sand where lightning struck: "petrified lightning".',
    hint: 'Lightning striking Sand.',
  }),
  rock('FOSSIL', 'Fossil', 'Fsl', ['#b8a888', '#a89878', '#c4b494', '#8a7a5a'], 2.5, 40, {
    desc: 'Bone turned to stone as minerals seeped in and replaced it, grain by grain.',
    hint: 'Bury Bone under heavy Pressure.',
  }),
  rock('PETRIFIED_WOOD', 'Petrified Wood', 'PWd', ['#8a6a4a', '#a07a50', '#6a4a3a', '#c89a6a'], 2.6, 60, {
    desc: 'Wood turned to stone: silica soaked into every cell and copied it in quartz, growth rings and all.',
    hint: 'Soak Wood in Waterglass.',
  }),
  {
    key: 'RESIN', name: 'Resin', sym: 'Rsn', cat: 'liquid', state: LIQUID,
    colors: ['#c8801a', '#bc7414', '#d48c26'], density: 1.05, spread: 1, viscosity: 0.95, sticky: true,
    flammable: 0.05, ignite: 300, burn: { smoke: 0.6, fireLife: [80, 150] },
    pressure: { above: 20, to: 'AMBER', chance: 0.01 },
    desc: 'Sticky sap that pine trees bleed to seal wounds and trap fungus and insects.',
    hint: 'Wood bleeds it where Fungus attacks.',
  },
  {
    key: 'PEAT', name: 'Peat', sym: 'Pet', cat: 'powder', state: POWDER,
    colors: ['#4a3420', '#3e2c1a', '#563c26'], density: 0.9, flammable: 0.02, ignite: 300,
    burn: { smoke: 0.7, fireLife: [300, 500] }, pressure: { above: 20, to: 'LIGNITE', chance: 0.01 },
    desc: 'Half-rotted moss from waterlogged bogs, dug and dried as fuel. Bogs preserve things so well that 2000-year-old bodies have been found in them.',
    hint: 'Moss drowning in Water.',
  },
  {
    key: 'LIGNITE', name: 'Lignite', sym: 'Lgn', cat: 'powder', state: POWDER,
    colors: ['#3a2a1a', '#302214', '#443220'], density: 1.2, flammable: 0.01, ignite: 350,
    burn: { smoke: 0.6, fireLife: [150, 250] }, pressure: { above: 30, to: 'COAL', chance: 0.01 },
    desc: 'Brown coal: peat halfway to becoming coal.',
    hint: 'Squeeze Peat.',
  },
];

export const CHEMISTRY_REACTIONS = [
  // Acids.
  { a: 'NITROGEN', b: 'SPARK', chance: 0.05, aTo: 'NITROGEN_DIOXIDE', bTo: null },
  { a: 'NITROGEN_DIOXIDE', b: 'WATER', chance: 0.05, aTo: 'EMPTY', bTo: 'NITRIC_ACID' },
  { a: 'NITRIC_ACID', b: 'COPPER', chance: 0.03, aTo: 'NITROGEN_DIOXIDE', bTo: 'EMPTY' },
  { a: 'NITRIC_ACID', b: 'ACID', chance: 0.05, aTo: 'AQUA_REGIA', bTo: 'AQUA_REGIA' },
  { a: 'GOLD', b: 'AQUA_REGIA', chance: 0.02, aTo: 'DISSOLVED_GOLD', bTo: 'EMPTY' },
  { a: 'HYDROFLUORIC_ACID', b: 'GLASS', chance: 0.05, aTo: null, bTo: 'FROSTED_GLASS' },
  { a: 'SULFUR_DIOXIDE', b: 'WATER', chance: 0.03, aTo: 'EMPTY', bTo: 'SULFURIC_ACID' },
  { a: 'SULFUR_DIOXIDE', b: 'CLOUD', chance: 0.02, aTo: 'EMPTY', bTo: 'ACID_RAIN' },
  { a: 'SULFURIC_ACID', b: 'WATER', chance: 0.05, aTo: null, bTo: 'STEAM', heat: 80 },
  { a: 'SULFURIC_ACID', b: 'SUGAR', chance: 0.1, aTo: 'STEAM', bTo: 'CARBON_SNAKE', heat: 150 },
  { a: 'COPPER', b: 'SULFURIC_ACID', chance: 0.02, minTemp: 100, aTo: 'COPPER_SULFATE', bTo: 'EMPTY' },
  { a: 'ACID_RAIN', b: 'MARBLE', chance: 0.02, aTo: 'WATER', bTo: 'EMPTY' },
  { a: 'ACID', b: 'MARBLE', chance: 0.05, aTo: 'EMPTY', bTo: 'CARBON_DIOXIDE' },

  // Lab bench classics.
  { a: 'WATER', b: 'OZONE', chance: 0.02, aTo: 'HYDROGEN_PEROXIDE', bTo: 'EMPTY' },
  {
    a: 'HYDROGEN_PEROXIDE', b: 'PYROLUSITE', chance: 0.3,
    aTo: 'WATER', aAlt: 'OXYGEN', aAltChance: 0.5, bTo: null, heat: 40,
  },
  {
    a: 'HYDROGEN_PEROXIDE', b: 'YEAST', chance: 0.3, aTo: 'ELEPHANT_TOOTHPASTE', bTo: null,
    spawn: 'ELEPHANT_TOOTHPASTE', heat: 30,
  },
  { a: 'HYDROGEN_PEROXIDE', b: 'BLOOD', chance: 0.2, aTo: 'BUBBLES', bTo: null },
  { a: 'LYE', b: 'CHLORINE', chance: 0.05, aTo: 'BLEACH', bTo: 'EMPTY' },
  { a: 'BLEACH', b: 'ACID', chance: 0.05, aTo: 'CHLORINE', bTo: 'SALT_WATER' },
  { a: 'BLEACH', b: 'INK', chance: 0.1, aTo: 'SALT_WATER', bTo: 'WATER' },
  { a: 'ALCOHOL', b: 'OXYGEN', chance: 0.005, aTo: 'VINEGAR', bTo: 'EMPTY' },
  { a: 'SALT_WATER', b: 'CARBON_DIOXIDE', chance: 0.01, aTo: 'BAKING_SODA', bTo: 'EMPTY' },
  { a: 'BAKING_SODA', b: 'VINEGAR', chance: 0.3, aTo: 'CARBON_DIOXIDE', bTo: 'SODIUM_ACETATE' },
  { a: 'TARNISH', b: 'BAKING_SODA', chance: 0.05, aTo: 'SILVER', bTo: null },
  { a: 'SODIUM_ACETATE', b: 'HOT_ICE', chance: 0.4, aTo: 'HOT_ICE', bTo: null },
  { a: 'QUICKLIME', b: 'WATER', chance: 0.1, aTo: 'SLAKED_LIME', bTo: 'STEAM', heat: 150 },
  { a: 'SLAKED_LIME', b: 'CARBON_DIOXIDE', chance: 0.02, aTo: 'LIMESTONE', bTo: 'EMPTY' },
  { a: 'SLAKED_LIME', b: 'WATER', chance: 0.02, aTo: 'EMPTY', bTo: 'LIMEWATER' },
  { a: 'LIMEWATER', b: 'CARBON_DIOXIDE', chance: 0.05, aTo: 'CHALK', bTo: 'EMPTY' },
  { a: 'PLASTER_OF_PARIS', b: 'WATER', chance: 0.05, aTo: 'WET_PLASTER', bTo: 'EMPTY' },
  { a: 'BORON', b: 'SALT_WATER', chance: 0.01, aTo: 'BORAX', bTo: null },
  { a: 'BORAX', b: 'GLUE', chance: 0.05, aTo: 'EMPTY', bTo: 'SLIME' },
  { a: 'POTATO', b: 'WATER', chance: 0.01, aTo: 'STARCH', bTo: null },
  { a: 'STARCH', b: 'WATER', chance: 0.05, aTo: 'OOBLECK', bTo: 'EMPTY' },
  { a: 'PLASTIC', b: 'LYE', chance: 0.02, aTo: 'SUPER_ABSORBENT', bTo: 'EMPTY' },
  { a: 'SUPER_ABSORBENT', b: 'WATER', chance: 0.2, aTo: 'INSTANT_SNOW', bTo: 'INSTANT_SNOW' },
  { a: 'AMMONIA', b: 'COAL', chance: 0.02, minTemp: 300, aTo: 'EMPTY', bTo: 'LUMINOL' },
  { a: 'LUMINOL', b: 'HYDROGEN_PEROXIDE', chance: 0.2, aTo: 'COLD_LIGHT', bTo: 'COLD_LIGHT' },
  { a: 'LUMINOL', b: 'BLOOD', chance: 0.2, aTo: 'COLD_LIGHT', bTo: null },
  { a: 'ZINC', b: 'SULFUR', chance: 0.02, aTo: 'PHOSPHOR', bTo: 'EMPTY' },
  { a: 'RADIUM', b: 'PHOSPHOR', chance: 0.05, aTo: 'RADIUM_PAINT', bTo: 'EMPTY' },
  { a: 'METAL', b: 'COPPER_SULFATE', chance: 0.02, aTo: 'COPPER', bTo: 'RUST' },
  { a: 'SILVER', b: 'CHLORINE', chance: 0.02, aTo: 'SILVER_CHLORIDE', bTo: 'EMPTY' },
  { a: 'CARBON_DIOXIDE', b: 'COAL', chance: 0.02, minTemp: 700, aTo: 'CARBON_MONOXIDE', bTo: null },
  { a: 'SILVER', b: 'HYDROGEN_SULFIDE', chance: 0.05, aTo: 'TARNISH', bTo: 'EMPTY' },
  { a: 'QUICKLIME', b: 'VINEGAR', chance: 0.02, minTemp: 300, aTo: 'EMPTY', bTo: 'ACETONE' },
  { a: 'ACETONE', b: 'STYROFOAM', chance: 0.2, aTo: null, bTo: 'GOO' },
  { a: 'ALCOHOL', b: 'WATER', chance: 0.01, aTo: 'ANTIFREEZE', bTo: 'EMPTY' },
  { a: 'ANTIFREEZE', b: 'ICE', chance: 0.05, aTo: null, bTo: 'WATER' },
  { a: 'OIL', b: 'CLAY', chance: 0.01, minTemp: 200, aTo: 'KEROSENE', bTo: null },
  { a: 'OIL', b: 'OXYGEN', chance: 0.005, aTo: 'TAR', bTo: 'EMPTY' },
  { a: 'TAR', b: 'GRAVEL', chance: 0.02, aTo: 'ASPHALT', bTo: 'EMPTY' },
  { a: 'SMOKE', b: 'METAL', chance: 0.05, aTo: 'SOOT', bTo: null },
  { a: 'SOOT', b: 'GLUE', chance: 0.05, aTo: 'INK', bTo: 'INK' },
  { a: 'QUICKLIME', b: 'GRAPHITE', chance: 0.03, minTemp: 2000, aTo: 'CALCIUM_CARBIDE', bTo: 'EMPTY' },
  { a: 'CALCIUM_CARBIDE', b: 'WATER', chance: 0.1, aTo: 'SLAKED_LIME', bTo: 'ACETYLENE' },
  { a: 'NITROGEN', b: 'WOOD', chance: 0.2, minTemp: 400, aTo: null, bTo: 'CHARCOAL' },
  { a: 'STEAM', b: 'CHARCOAL', chance: 0.02, aTo: null, bTo: 'ACTIVATED_CHARCOAL' },
  { a: 'ACTIVATED_CHARCOAL', b: 'SMOKE', chance: 0.3, aTo: null, bTo: 'EMPTY' },
  { a: 'ACTIVATED_CHARCOAL', b: 'HYDROGEN_SULFIDE', chance: 0.3, aTo: null, bTo: 'EMPTY' },
  { a: 'ACTIVATED_CHARCOAL', b: 'INK', chance: 0.3, aTo: null, bTo: 'WATER' },
  { a: 'NITROGEN', b: 'COAL', chance: 0.2, minTemp: 600, aTo: null, bTo: 'COKE' },
  { a: 'COKE', b: 'RUST', chance: 0.05, minTemp: 1000, aTo: 'EMPTY', bTo: 'METAL' },
  { a: 'SODIUM', b: 'NEON', chance: 0.05, aTo: 'SODIUM_VAPOR', bTo: null },
  { a: 'NITROGEN_DIOXIDE', b: 'SMOKE', chance: 0.05, aTo: 'SMOG', bTo: 'SMOG' },
  { a: 'FLUORINE', b: 'METHANE', chance: 0.05, aTo: 'FREON', bTo: 'EMPTY' },
  { a: 'FREON', b: 'OZONE', chance: 0.1, aTo: null, bTo: 'OXYGEN' },
  { a: 'SAND', b: 'LYE', chance: 0.02, minTemp: 150, aTo: 'EMPTY', bTo: 'WATERGLASS' },
  { a: 'WATERGLASS', b: 'COPPER_SULFATE', chance: 0.05, aTo: 'CRYSTAL_GARDEN', bTo: null },
  { a: 'LEAD', b: 'IODINE', chance: 0.03, aTo: null, bTo: 'GOLDEN_RAIN' },
  { a: 'WATERGLASS', b: 'ACID', chance: 0.03, aTo: 'SILICA_GEL', bTo: 'EMPTY' },
  { a: 'SILICA_GEL', b: 'WATER', chance: 0.05, aTo: null, bTo: 'EMPTY' },
  { a: 'SILICA_GEL', b: 'STEAM', chance: 0.2, aTo: null, bTo: 'EMPTY' },
  { a: 'MAGNESIUM', b: 'SULFURIC_ACID', chance: 0.03, aTo: 'EPSOM_SALT', bTo: 'EMPTY', heat: 100 },

  // Pigments.
  { a: 'RUST', b: 'BLOOD', chance: 0.02, aTo: 'PRUSSIAN_BLUE', bTo: 'EMPTY' },
  { a: 'PRUSSIAN_BLUE', b: 'CESIUM', chance: 0.05, aTo: null, bTo: 'EMPTY' },
  { a: 'PRUSSIAN_BLUE', b: 'THALLIUM', chance: 0.05, aTo: null, bTo: 'EMPTY' },
  { a: 'CLAY', b: 'RUST', chance: 0.02, aTo: 'OCHRE', bTo: 'EMPTY' },
  { a: 'FLOWER', b: 'BACTERIA', chance: 0.02, aTo: 'INDIGO', bTo: null },
  { a: 'SEASHELL', b: 'SALT_WATER', chance: 0.01, aTo: 'TYRIAN_PURPLE', bTo: null },
  { a: 'PLANT', b: 'ALCOHOL', chance: 0.02, aTo: 'EMPTY', bTo: 'CHLOROPHYLL' },
  { a: 'FLOWER', b: 'ALCOHOL', chance: 0.02, aTo: 'PERFUME', bTo: 'EMPTY' },
  { a: 'TITANIUM', b: 'OIL', chance: 0.02, aTo: null, bTo: 'SUNSCREEN' },

  // Gems.
  { a: 'RUBY', b: 'TITANIUM', chance: 0.005, aTo: 'SAPPHIRE', bTo: null },
  { a: 'GRANITE', b: 'FLUORINE', chance: 0.02, aTo: 'TOPAZ', bTo: 'EMPTY' },
  { a: 'QUARTZ', b: 'WATER', chance: 0.002, aTo: 'OPAL', bTo: null },
  { a: 'PERIDOT', b: 'WATER', chance: 0.003, aTo: 'JADE', bTo: null },
  { a: 'VERDIGRIS', b: 'CLAY', chance: 0.01, aTo: 'TURQUOISE', bTo: 'EMPTY' },
  { a: 'MARBLE', b: 'SULFUR', chance: 0.01, aTo: 'LAPIS_LAZULI', bTo: 'EMPTY' },
  { a: 'VERDIGRIS', b: 'LIMESTONE', chance: 0.01, aTo: 'MALACHITE', bTo: null },
  { a: 'COPPER', b: 'CARBON_DIOXIDE', chance: 0.005, aTo: 'AZURITE', bTo: 'EMPTY' },
  { a: 'QUARTZ', b: 'MANGANESE', chance: 0.01, aTo: 'ROSE_QUARTZ', bTo: null },
  { a: 'MAGNESIUM', b: 'RUBY', chance: 0.01, aTo: null, bTo: 'SPINEL' },
  { a: 'BERYLLIUM', b: 'CHROMIUM', chance: 0.01, aTo: 'ALEXANDRITE', bTo: null },
  { a: 'GRANITE', b: 'BORON', chance: 0.01, aTo: null, bTo: 'TOURMALINE' },
  { a: 'SILICON', b: 'GRAPHITE', chance: 0.02, minTemp: 1800, aTo: 'MOISSANITE', bTo: 'EMPTY' },
  { a: 'SEASHELL', b: 'SAND', chance: 0.005, aTo: 'PEARL', bTo: 'EMPTY' },

  // Rocks.
  { a: 'HEMATITE', b: 'LIGHTNING', chance: 0.5, aTo: 'LODESTONE', bTo: null },
  { a: 'SAND', b: 'LIMESTONE', chance: 0.005, aTo: 'SANDSTONE', bTo: null },
  { a: 'CHALK', b: 'QUARTZ', chance: 0.01, aTo: 'FLINT', bTo: null },
  { a: 'FLINT', b: 'STEEL', chance: 0.01, aTo: null, bTo: 'FIRE' },
  { a: 'LAVA', b: 'CARBON_DIOXIDE', chance: 0.05, aTo: 'PUMICE', bTo: 'EMPTY' },
  { a: 'LAVA', b: 'SALT_WATER', chance: 0.2, aTo: 'BASALT', bTo: 'STEAM', keepA: true },
  { a: 'BASALT', b: 'AMETHYST', chance: 0.01, aTo: 'GEODE', bTo: null },
  { a: 'GYPSUM', b: 'SAND', chance: 0.01, aTo: 'DESERT_ROSE', bTo: null },
  { a: 'KIMBERLITE', b: 'ACID', chance: 0.02, aTo: 'DIAMOND', bTo: 'EMPTY' },
  { a: 'GRANITE', b: 'POTASSIUM', chance: 0.01, aTo: 'MICA', bTo: 'EMPTY' },
  { a: 'PERIDOT', b: 'STEAM', chance: 0.01, aTo: 'TALC', bTo: null },
  { a: 'CLAY', b: 'ACID', chance: 0.02, aTo: 'KAOLIN', bTo: 'EMPTY' },
  { a: 'WOOD', b: 'WATERGLASS', chance: 0.01, aTo: 'PETRIFIED_WOOD', bTo: 'EMPTY' },
  { a: 'WOOD', b: 'FUNGUS', chance: 0.01, aTo: 'RESIN', bTo: null },
  { a: 'MOSS', b: 'WATER', chance: 0.002, aTo: 'PEAT', bTo: null },
];

export const CHEMISTRY_HITS = [
  { p: 'PHOTON', t: 'SILVER_CHLORIDE', chance: 0.2, tTo: 'SILVER' },
  { p: 'PHOTON', t: 'PHOSPHOR', chance: 0.6, action: 'excite' },
  { p: 'UV_LIGHT', t: 'PHOSPHOR', chance: 0.9, action: 'excite', emit: ['PHOTON'] },
  { p: 'UV_LIGHT', t: 'CHLOROPHYLL', chance: 0.8, action: 'excite', emit: ['PHOTON'] },
  { p: 'ELECTRON', t: 'MERCURY_VAPOR', chance: 0.9, action: 'excite', emit: ['UV_LIGHT'] },
  { p: 'GAMMA', t: 'QUARTZ', chance: 0.05, tTo: 'SMOKY_QUARTZ' },
];
