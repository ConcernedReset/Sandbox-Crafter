// Shared by the element tables and the simulation.

export const State = { EMPTY: 0, SOLID: 1, POWDER: 2, LIQUID: 3, GAS: 4, ENERGY: 5 };

export const AMBIENT = 22; // °C, room temperature

// There is no highest temperature: a star is millions of degrees, and quark-
// gluon plasma trillions. There is a lowest, absolute zero.
export const MIN_TEMP = -273;
// What a plutonium split heats its cell to, at least (the heart of a nuclear
// fireball is millions of degrees).
export const FISSION_HOT = 1e6;
export const GRAVITY = 0.12;

// Radioactive elements (the Radioactive category) are stable until something
// disturbs them. In still air they throw nothing off, and only warm and
// decay at REST times their listed rates. Pressure past PRESSURE_WAKE stirs
// them up: their activity rises by 1 for every PRESSURE_FULL, up to
// MAX_ACTIVITY times the listed rates. A hard particle passing through has
// KICK_CHANCE per cell of being absorbed and kicking the atom: it throws off
// particles and warms as if KICK_EMIT frames had passed at full activity, and
// decays as if KICK_DECAY had.
export const REST = 0.001;
export const PRESSURE_WAKE = 3;
export const PRESSURE_FULL = 20;
export const MAX_ACTIVITY = 4;
export const KICK_CHANCE = 0.3;
export const KICK_EMIT = 50;
export const KICK_DECAY = 300;
