// The Performance setting: Auto, High, Medium or Low (World.setQuality),
// saved in localStorage. Auto watches how long each drawn frame takes
// (simulation steps and drawing) and drops a level when frames run over
// their time for AUTO_DOWN frames in a row, or climbs back when they take
// under half of it for AUTO_UP frames in a row.

const KEY = 'sandbox-crafter:performance';
export const LEVELS = ['high', 'medium', 'low'];
export const CHOICES = ['auto', ...LEVELS];
export const AUTO_DOWN = 60;
export const AUTO_UP = 180;

export class AutoQuality {
  constructor() {
    this.level = 'high';
    this.slow = 0; // frames in a row over their time
    this.quick = 0; // frames in a row under half of it
  }

  // A drawn frame took `ms`; `budget` is the time it has. Returns the level.
  feed(ms, budget = 1000 / 60) {
    if (ms > budget) { this.slow++; this.quick = 0; }
    else if (ms < budget / 2) { this.quick++; this.slow = 0; }
    else { this.slow = 0; this.quick = 0; }
    const k = LEVELS.indexOf(this.level);
    if (this.slow >= AUTO_DOWN && k < LEVELS.length - 1) { this.level = LEVELS[k + 1]; this.slow = 0; }
    else if (this.quick >= AUTO_UP && k > 0) { this.level = LEVELS[k - 1]; this.quick = 0; }
    return this.level;
  }
}

export function loadPerformance(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(KEY));
    return CHOICES.includes(v) ? v : 'auto';
  } catch {
    return 'auto'; // unreadable or unavailable storage
  }
}

export function savePerformance(choice, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(choice));
  } catch {
    // Nothing to do; the choice just won't be remembered.
  }
}
