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

  machine('INVERTER', 'Inverter', 'NOT', 'inverter', ['#3a3a52', '#34344a', '#40405a'], {
    light: '#c08aff', pressure: { above: 60, to: 'SILICON', alt: 'SWITCH', altChance: 0.5, chance: 0.02 },
    desc: 'A NOT gate. It powers what\'s on its far side unless something powers it, so a lamp wired through it is lit while its switch is off. Feed it from one side; it answers on the opposite side.',
    hint: 'Silicon and a Switch make a transistor.',
  }),
  machine('DELAY', 'Delay Line', 'Dly', 'delay', ['#3a4a3a', '#344434', '#405040'], {
    light: '#8aff9a', pressure: { above: 60, to: 'CLOCK', alt: 'COPPER', altChance: 0.5, chance: 0.02 },
    desc: 'A slow wire: current creeps along it one cell every 4 frames, and only forwards. A longer line waits longer.',
    hint: 'A Clock wound with Copper.',
  }),
  machine('BAROMETER', 'Barometer', 'Bar', 'barometer', ['#4a5560', '#424d58', '#525d68'], {
    light: '#ff9a7a', pressure: { above: 60, to: 'MERCURY', alt: 'GLASS', altChance: 0.5, chance: 0.02 },
    desc: 'Switches on while the air pressure beside it is above +5. Wire it to a fan or a valve to keep a chamber in check.',
    hint: 'Torricelli\'s barometer: a column of Mercury in a Glass tube.',
  }),
  machine('SMOKE_DETECTOR', 'Smoke Detector', 'SmD', 'smoke', ['#d8d8d0', '#ccccc4', '#e0e0d8'], {
    light: '#ff4a4a', pressure: { above: 60, to: 'AMERICIUM', alt: 'PLASTIC', altChance: 0.7, chance: 0.02 },
    desc: 'Switches on while smoke, or any other gas, touches it. A fire alarm.',
    hint: 'Most smoke detectors hold a speck of Americium in a Plastic case.',
  }),
  machine('WIND_TURBINE', 'Wind Turbine', 'WTb', 'turbine', ['#c8ccd0', '#bcc0c4', '#d4d8dc'], {
    light: '#9affc8', pressure: { above: 60, to: 'FAN', alt: 'ALUMINUM', altChance: 0.5, chance: 0.02 },
    desc: 'Makes power while the wind blows past it.',
    hint: 'Aluminum blades on a Fan, run backwards.',
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
    desc: 'Heats up while it\'s powered, faster and faster the longer it stays on, with no limit, warming everything touching it.',
    hint: 'Nichrome wire wound on Porcelain.',
  }),
  machine('COOLER', 'Cooler', 'Clr', 'cooler', ['#44525e', '#3e4c58', '#4a5864'], {
    light: '#7ad8ff', conduct: 0.6, strength: 100,
    pressure: { above: 60, to: 'BISMUTH', alt: 'TELLURIUM', altChance: 0.5, chance: 0.02 },
    desc: 'Chills itself while it\'s powered, all the way down to absolute zero, cooling everything touching it. It works like a Peltier cooler: current pumps heat from one side to the other.',
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
  machine('IGNITER', 'Igniter', 'Ign', 'igniter', ['#b8b0a0', '#aca494', '#c4bcac'], {
    light: '#ff9a3a', strength: 120, pressure: { above: 100, to: 'IRIDIUM', alt: 'PORCELAIN', altChance: 0.5, chance: 0.02 },
    desc: 'While it\'s powered it sets anything flammable touching it alight, and throws little flames into the air beside it.',
    hint: 'A spark plug: an Iridium tip in Porcelain.',
  }),
  machine('NEUTRON_SOURCE', 'Neutron Source', 'NSc', 'neutron', ['#5a6a5a', '#526252', '#627262'], {
    light: '#b8ffb0', strength: 150, pressure: { above: 150, to: 'RADIUM', alt: 'BERYLLIUM', altChance: 0.5, chance: 0.01 },
    desc: 'Fires neutrons out of its open faces while it\'s powered. Start a reactor with a switch.',
    hint: 'Radium mixed with Beryllium: the source the neutron was discovered with.',
  }),
  machine('PIPE', 'Pipe', 'Pip', 'pipe', ['#8a5a3c', '#7e5034', '#966444'], {
    strength: 150, conduct: 0.6, pressure: { above: 220, to: 'COPPER', alt: 'SOLDER', altChance: 0.3, chance: 0.02 },
    desc: 'An airtight tube, one cell wide. Air goes in at one open end and comes out at the others, even through a wall, so the pressure at its ends evens out.',
    hint: 'Copper plumbing, joined with Solder.',
  }),
  machine('PUMP', 'Pump', 'Pmp', 'pump', ['#4a5a6e', '#425266', '#526276'], {
    light: '#7ad8ff', strength: 150, pressure: { above: 220, to: 'PIPE', alt: 'ELECTROMAGNET', altChance: 0.5, chance: 0.02 },
    desc: 'Put it at the end of a Pipe. While it\'s powered it sucks in the air beside it and blows it out of the pipe\'s other ends, building up pressure there. Switched off, it\'s shut.',
    hint: 'A Pipe driven by an Electromagnet motor.',
  }),
  machine('VALVE', 'Safety Valve', 'SVl', 'valve', ['#8a7a3a', '#7e6e34', '#968644'], {
    // Pressure opens it long before it could crush it, so it has no crush rule.
    strength: 200, conduct: 0.4,
    desc: 'An airtight plug that opens by itself when the pressure beside it passes +30, letting the air out, and shuts again once it has dropped below +10. Fit one to anything you pressurise.',
    hint: 'A Brass fitting on a Pipe.',
  }),
  machine('CONVEYOR', 'Conveyor', 'Cnv', 'conveyor', ['#2e2e2e', '#363636', '#262626', '#3a3a3a'], {
    light: '#ffd76a', strength: 100, pressure: { above: 120, to: 'RUBBER', alt: 'FAN', altChance: 0.3, chance: 0.02 },
    desc: 'A belt. While it\'s powered, sand, water, debris and creatures resting on it ride along, away from the end the power comes in at.',
    hint: 'A Rubber belt run by a Fan motor.',
  }),
  machine('PISTON', 'Piston', 'Pst', 'piston', ['#5c6470', '#545c68', '#646c78'], {
    light: '#9fd8ff', strength: 200, pressure: { above: 240, to: 'PUMP', alt: 'STEEL', altChance: 0.5, chance: 0.01 },
    desc: 'While it\'s powered it pushes out an arm up to 8 cells long, away from the side the power comes in, shoving whatever is in front of it. It pulls the arm back when the power stops.',
    hint: 'A Pump driving a Steel ram.',
  }),
  {
    // A piston's arm: not a discovery, and not in the palette.
    key: 'PISTON_ARM', name: 'Piston Arm', sym: 'Arm', cat: null, state: SOLID, always: true,
    colors: ['#9aa3b0', '#a4adba', '#909aa6'], density: 7.8, conduct: 0.3, strength: 200, acidProof: true,
    desc: 'The arm of a piston.',
  },
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
  { a: 'COPPER', b: 'SOLDER', chance: 0.03, aTo: 'PIPE', bTo: null },
  { a: 'PIPE', b: 'ELECTROMAGNET', chance: 0.03, aTo: 'PUMP', bTo: null },
  { a: 'PIPE', b: 'BRASS', chance: 0.03, aTo: 'VALVE', bTo: null },
  { a: 'RUBBER', b: 'FAN', chance: 0.03, aTo: 'CONVEYOR', bTo: null },
  { a: 'PUMP', b: 'STEEL', chance: 0.03, aTo: 'PISTON', bTo: null },
  { a: 'SILICON', b: 'SWITCH', chance: 0.03, aTo: 'INVERTER', bTo: null },
  { a: 'CLOCK', b: 'COPPER', chance: 0.03, aTo: 'DELAY', bTo: null },
  { a: 'MERCURY', b: 'GLASS', chance: 0.03, aTo: null, bTo: 'BAROMETER' },
  { a: 'AMERICIUM', b: 'PLASTIC', chance: 0.03, aTo: null, bTo: 'SMOKE_DETECTOR' },
  { a: 'FAN', b: 'ALUMINUM', chance: 0.03, aTo: 'WIND_TURBINE', bTo: null },
  { a: 'IRIDIUM', b: 'PORCELAIN', chance: 0.03, aTo: 'IGNITER', bTo: null },
  { a: 'RADIUM', b: 'BERYLLIUM', chance: 0.03, aTo: 'NEUTRON_SOURCE', bTo: null },
];
