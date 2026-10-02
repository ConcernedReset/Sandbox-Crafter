// The player's discoveries, saved in localStorage. Storage can be missing or
// blocked (private windows, embedded previews), so every access is guarded
// and the game simply starts fresh when it is unavailable.

import { COLLECTIBLE, STARTERS, DEFS } from '../sim/elements.js';

const KEY = 'sandbox-crafter:v1';

export class Progress {
  constructor() {
    this.discovered = new Set(STARTERS);
    this.revealed = new Set(); // hints the player chose to reveal
    this.freePlay = false;
    this.hard = false; // hard mode: fewer tools, a tree of targets (see tree.js)
    this.tipDismissed = false;
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const valid = new Set(COLLECTIBLE.map((d) => d.key));
      for (const k of data.discovered ?? []) if (valid.has(k)) this.discovered.add(k);
      for (const k of data.revealed ?? []) if (valid.has(k)) this.revealed.add(k);
      this.freePlay = !!data.freePlay;
      this.hard = !!data.hard;
      this.tipDismissed = !!data.tipDismissed;
    } catch {
      // Unreadable or unavailable storage: keep the defaults.
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        discovered: [...this.discovered],
        revealed: [...this.revealed],
        freePlay: this.freePlay,
        hard: this.hard,
        tipDismissed: this.tipDismissed,
      }));
    } catch {
      // Nothing to do; progress just won't persist.
    }
  }

  // Found it (or never needed to: Wall and Spark are always to hand).
  has(id) {
    const d = DEFS[id];
    return d.always || this.discovered.has(d.key);
  }

  // Hard mode hands out every machine, in place of the tools it takes away.
  given(id) {
    return this.hard && DEFS[id].cat === 'machine';
  }

  // Can the player paint with this element right now?
  usable(id) {
    return this.freePlay || this.given(id) || this.has(id);
  }

  // Does the recipe tree count it as found? The same as usable.
  known(id) {
    return this.usable(id);
  }

  // Returns true if this was a new discovery.
  discover(id) {
    const key = DEFS[id].key;
    if (this.discovered.has(key) || DEFS[id].always) return false;
    this.discovered.add(key);
    this.save();
    return true;
  }

  reveal(id) {
    this.revealed.add(DEFS[id].key);
    this.save();
  }

  // Hard mode is a choice of how to play, so it stays on.
  reset() {
    this.discovered = new Set(STARTERS);
    this.revealed.clear();
    this.freePlay = false;
    this.save();
  }

  get count() {
    return COLLECTIBLE.filter((d) => this.discovered.has(d.key)).length;
  }
}
