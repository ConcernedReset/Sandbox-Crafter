// Machines: controls you switch on (switches, buttons, clocks and sensors)
// and the blocks they drive (doors, lamps, laser emitters, heaters and more).
// A control that is on sends current into wires touching it and powers any
// machine touching it directly; a machine stays powered for a moment after
// the current stops. Power fills a whole connected block of the same
// machine, so a big door or a wall of lamps works as one. See machines.js.
// Crush a machine under enough pressure and it breaks back into the parts
// it was built from. Field meanings are documented at the top of elements.js;
// `machine` names the kind and `light` is the colour it shines.

import { State } from './constants.js';

const { SOLID } = State;

const machine = (key, name, sym, kind, colors, extra) => ({
  key, name, sym, cat: 'machine', state: SOLID, machine: kind, colors,
  density: 3, conduct: 0.3, strength: 80, acidProof: true, ...extra,
});

export const MACHINE_ELEMENTS = [
  // ---- controls ----------------------------------------------------------------
  machine('SWITCH', 'Switch', 'Swi', 'switch', ['#6a3434', '#5e2e2e', '#743c3c'], {
    light: '#46e87a',
    desc: 'Paint Spark on it to flip it on, and again to flip it off. While it\'s on it powers the wires and machines touching it.',
    hint: 'Brass contacts in a Plastic case.',
  }),
  machine('BUTTON', 'Button', 'Btn', 'button', ['#8a2f2f', '#7e2929', '#963535'], {
    light: '#ff6a5a',
    desc: 'Paint Spark on it to press it. It powers whatever it touches for a second and a half, then lets go.',
    hint: 'A Switch on a Rubber spring.',
  }),
  machine('CLOCK', 'Clock', 'Clk', 'clock', ['#34485a', '#2e4254', '#3a4e60'], {
    light: '#9fd8ff', pressure: { above: 60, to: 'QUARTZ', chance: 0.02 },
    desc: 'Ticks once a second, sending a pulse down its wires each time. Use it to blink lamps or open a door on a timer.',
    hint: 'A Quartz crystal driven by a Battery keeps time.',
  }),
  machine('PRESSURE_PLATE', 'Pressure Plate', 'PPl', 'plate', ['#6e6a60', '#666258', '#767268'], {
    light: '#ffd76a', pressure: { above: 80, to: 'STEEL', chance: 0.02 },
    desc: 'Switches on while anything rests on top of it: sand, water, a creature, a block.',
    hint: 'A Button set into Steel.',
  }),
  machine('PHOTOCELL', 'Photocell', 'PhC', 'photocell', ['#2a3550', '#243048', '#303a58'], {
    light: '#ffe08a', pressure: { above: 50, to: 'SELENIUM', alt: 'COPPER', altChance: 0.5, chance: 0.02 },
    desc: 'Switches on while light shines on it, soaking up the light without warming. Aim a laser at one for a tripwire.',
    hint: 'Selenium on Copper: the first light meters worked this way.',
  }),
  machine('THERMOSTAT', 'Thermostat', 'Thm', 'thermostat', ['#5a5f66', '#52575e', '#62676e'], {
    light: '#ff8a4a', conduct: 0.7, pressure: { above: 50, to: 'MERCURY', chance: 0.02 },
    desc: 'Switches on while it is hotter than 60 °C. A fire alarm, or the brains of a heater.',
    hint: 'Old thermostats tipped a bead of Mercury across a Switch.',
  }),

  // ---- machines -------------------------------------------------------------------
  machine('DOOR', 'Door', 'Dr', 'door', ['#6b7280', '#737a88', '#646b78', '#5e6572'], {
    strength: 200, conduct: 0.5, pressure: { above: 200, to: 'STEEL', chance: 0.01 },
    desc: 'A solid, airtight block that opens (vanishes) while it\'s powered and shuts again when the power stops. A whole connected door opens together.',
    hint: 'Steel held by an Electromagnet.',
  }),
  machine('LAMP', 'Lamp', 'Lmp', 'lamp', ['#3a3830', '#34322b', '#403e35'], {
    light: '#fff3d0', render: 'lamp', strength: 40,
    desc: 'A pixel that lights up while it\'s powered. A connected block of lamps lights together, so leave gaps between pixels you want to control separately.',
    hint: 'Put an LED behind Plastic.',
  }),
  machine('RED_LAMP', 'Red Lamp', 'RLp', 'lamp', ['#3a1a1c', '#341618', '#401e20'], {
    light: '#ff3b3b', render: 'lamp', strength: 40, pressure: { above: 60, to: 'RUBY', chance: 0.02 },
    desc: 'A lamp that glows red while it\'s powered.',
    hint: 'A Lamp behind Ruby.',
  }),
  machine('GREEN_LAMP', 'Green Lamp', 'GLp', 'lamp', ['#16301e', '#122a1a', '#1a3622'], {
    light: '#3bff6a', render: 'lamp', strength: 40, pressure: { above: 60, to: 'EMERALD', chance: 0.02 },
    desc: 'A lamp that glows green while it\'s powered.',
    hint: 'A Lamp behind Emerald.',
  }),
  machine('BLUE_LAMP', 'Blue Lamp', 'BLp', 'lamp', ['#161e3a', '#121a34', '#1a2240'], {
    light: '#3b7bff', render: 'lamp', strength: 40, pressure: { above: 60, to: 'SAPPHIRE', chance: 0.02 },
    desc: 'A lamp that glows blue while it\'s powered.',
    hint: 'A Lamp behind Sapphire.',
  }),
  machine('LASER_EMITTER', 'Laser Emitter', 'LzE', 'laser', ['#3a3e46', '#44484f', '#5a2020'], {
    light: '#ff2a2a', strength: 100, pressure: { above: 60, to: 'LASER', chance: 0.02 },
    desc: 'Fires a red laser beam out of every open face while it\'s powered. The beam heats what it hits, bounces off mirrors and trips photocells.',
    hint: 'Put a Laser on a Switch.',
  }),
  machine('HEATER', 'Heater', 'Htr', 'heater', ['#5a4a44', '#52423c', '#62524c'], {
    light: '#ff7a3a', conduct: 0.6, strength: 100,
    pressure: { above: 60, to: 'NICHROME', alt: 'PORCELAIN', altChance: 0.5, chance: 0.02 },
    desc: 'Heats up (to 1200 °C at most) while it\'s powered, warming everything touching it.',
    hint: 'Nichrome wire wound on Porcelain.',
  }),
  machine('COOLER', 'Cooler', 'Clr', 'cooler', ['#44525e', '#3e4c58', '#4a5864'], {
    light: '#7ad8ff', conduct: 0.6, strength: 100,
    pressure: { above: 60, to: 'BISMUTH', alt: 'TELLURIUM', altChance: 0.5, chance: 0.02 },
    desc: 'Chills itself (down to −150 °C) while it\'s powered, cooling everything touching it. It works like a Peltier cooler: current pumps heat from one side to the other.',
    hint: 'Bismuth and Tellurium make the Peltier coolers in car fridges.',
  }),
  machine('FAN', 'Fan', 'Fan', 'fan', ['#4a5058', '#42484f', '#525860'], {
    light: '#cfe8ff', pressure: { above: 60, to: 'MAGNET', alt: 'ELECTROMAGNET', altChance: 0.5, chance: 0.02 },
    desc: 'Blows air out of every open face while it\'s powered. Mount it against a wall to aim it.',
    hint: 'An Electromagnet spinning next to a Magnet is a motor.',
  }),
  machine('DISPENSER', 'Dispenser', 'Dsp', 'dispenser', ['#6a6040', '#62583a', '#726846'], {
    light: '#ffe07a', pressure: { above: 60, to: 'CLONE', chance: 0.02 },
    desc: 'Remembers the first powder, liquid, gas or creature that touches it, and pours out more of it while it\'s powered.',
    hint: 'A Clone with a Switch.',
  }),
  machine('DRAIN', 'Drain', 'Drn', 'drain', ['#2a2a30', '#24242a', '#303036'], {
    light: '#b07aff', pressure: { above: 60, to: 'VOID', chance: 0.02 },
    desc: 'Swallows the powders, liquids and gases touching it while it\'s powered. Solids are safe.',
    hint: 'Put a Void on a Switch.',
  }),
  {
    key: 'BEAM_SPLITTER', name: 'Beam Splitter', sym: 'BSp', cat: 'machine', state: SOLID,
    colors: ['#a8cfe0', '#b4d8e8', '#9cc6d8'], density: 2.6, conduct: 0.1, strength: 40, acidProof: true,
    transparent: true, reflect: 0.5, colorless: true,
    pressure: { above: 30, to: 'GLASS', alt: 'SILVER', altChance: 0.3, chance: 0.02 },
    desc: 'A half-silvered mirror: it reflects half the light that reaches it and lets the rest through, splitting a beam in two.',
    hint: 'Rub a Mirror against Quartz to leave a thin coat of silver.',
  },
];

export const MACHINE_REACTIONS = [
  { a: 'BRASS', b: 'PLASTIC', chance: 0.03, aTo: null, bTo: 'SWITCH' },
  { a: 'SWITCH', b: 'RUBBER', chance: 0.03, aTo: 'BUTTON', bTo: null },
  { a: 'QUARTZ', b: 'BATTERY', chance: 0.03, aTo: 'CLOCK', bTo: null },
  { a: 'BUTTON', b: 'STEEL', chance: 0.03, aTo: 'PRESSURE_PLATE', bTo: null },
  { a: 'SELENIUM', b: 'COPPER', chance: 0.03, aTo: 'PHOTOCELL', bTo: null },
  { a: 'SWITCH', b: 'MERCURY', chance: 0.03, aTo: 'THERMOSTAT', bTo: null },
  { a: 'STEEL', b: 'ELECTROMAGNET', chance: 0.03, aTo: 'DOOR', bTo: null },
  { a: 'LED', b: 'PLASTIC', chance: 0.03, aTo: 'LAMP', bTo: null },
  { a: 'LAMP', b: 'RUBY', chance: 0.03, aTo: 'RED_LAMP', bTo: null },
  { a: 'LAMP', b: 'EMERALD', chance: 0.03, aTo: 'GREEN_LAMP', bTo: null },
  { a: 'LAMP', b: 'SAPPHIRE', chance: 0.03, aTo: 'BLUE_LAMP', bTo: null },
  { a: 'LASER', b: 'SWITCH', chance: 0.03, aTo: 'LASER_EMITTER', bTo: null },
  { a: 'NICHROME', b: 'PORCELAIN', chance: 0.03, aTo: 'HEATER', bTo: null },
  { a: 'BISMUTH', b: 'TELLURIUM', chance: 0.03, aTo: 'COOLER', bTo: null },
  { a: 'ELECTROMAGNET', b: 'MAGNET', chance: 0.03, aTo: 'FAN', bTo: null },
  { a: 'CLONE', b: 'SWITCH', chance: 0.03, aTo: 'DISPENSER', bTo: null },
  { a: 'VOID', b: 'SWITCH', chance: 0.03, aTo: 'DRAIN', bTo: null },
  { a: 'MIRROR', b: 'QUARTZ', chance: 0.03, aTo: null, bTo: 'BEAM_SPLITTER' },
];
