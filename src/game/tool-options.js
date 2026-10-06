// The options strip under the tools: the Wall checklist (a PASS mask, see
// walls.js) and the Time brush's speed (1-4: ¼× ½× 2× 4×). Kept in
// localStorage, guarded like the other saved settings.

const KEY = 'sandbox-crafter:tool-options';
export const TOOL_OPTION_DEFAULTS = Object.freeze({ wallMask: 0, timeSpeed: 1 });

export function loadToolOptions(storage = globalThis.localStorage) {
  try {
    const data = JSON.parse(storage.getItem(KEY));
    if (!data || typeof data !== 'object') return { ...TOOL_OPTION_DEFAULTS };
    const m = Number(data.wallMask), s = Number(data.timeSpeed);
    return {
      wallMask: Number.isInteger(m) && m >= 0 && m <= 255 ? m : TOOL_OPTION_DEFAULTS.wallMask,
      timeSpeed: Number.isInteger(s) && s >= 1 && s <= 4 ? s : TOOL_OPTION_DEFAULTS.timeSpeed,
    };
  } catch {
    return { ...TOOL_OPTION_DEFAULTS }; // unreadable or unavailable storage
  }
}

export function saveToolOptions(options, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(options));
  } catch {
    // Nothing to do; the options just won't be remembered.
  }
}
