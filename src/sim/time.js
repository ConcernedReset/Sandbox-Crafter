// Time zones: the Time brush paints areas that run slower or faster than
// the rest of the world. World.speed holds a code per cell: 0 normal, then
// ¼×, ½×, 2× and 4×. The speed belongs to the place, not to what's in it:
// sand that falls out of a slow area speeds back up. Mixed into
// World.prototype.

export const SPEEDS = [1, 0.25, 0.5, 2, 4];
// A slow cell's particle is updated only on every SLOW_EVERY-th frame; a
// fast one gets EXTRA_PASSES more updates after the frame's normal pass.
export const SLOW_EVERY = [1, 4, 2, 1, 1];
export const EXTRA_PASSES = [0, 0, 0, 1, 3];

export const TimeZones = {
  // Set every cell in `area` to speed `code` (0 puts it back to normal).
  paintSpeed(area, code) {
    const { speed } = this;
    area((i) => {
      const was = speed[i];
      if (was === code) return;
      if (was === 0) this.zoneCount++;
      if (code === 0) this.zoneCount--;
      speed[i] = code;
    });
    this.findFastBox();
    this.wakeAll(); // what's in the area now runs at another speed
  },

  // The box round every fast cell, so the extra passes only visit that.
  findFastBox() {
    const { w, h, speed } = this;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    if (this.zoneCount > 0) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (EXTRA_PASSES[speed[y * w + x]] === 0) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    this.zoneBox = x1 < 0 ? null : [x0, y0, x1, y1];
  },

  clearZones() {
    this.speed.fill(0);
    this.zoneCount = 0;
    this.zoneBox = null;
  },

  // After the frame's normal pass: extra passes over the fast area, one
  // for 2× cells and three for 4×, in the same order as the normal pass.
  // Each updates the particles that are (still) in a cell that fast.
  fastPasses(fromBottom) {
    const box = this.zoneBox;
    if (box === null) return;
    const [x0, y0, x1, y1] = box;
    const { w, type, clock, speed } = this;
    const wallId = this.WALL_ID;
    for (let p = 1; p <= 3; p++) {
      const pass = ++this.pass;
      for (let n = 0; n <= y1 - y0; n++) {
        const y = fromBottom ? y1 - n : y0 + n;
        const leftToRight = ((this.tick + y + p) & 1) === 0;
        for (let k = 0; k <= x1 - x0; k++) {
          const x = leftToRight ? x0 + k : x1 - k;
          const i = y * w + x;
          if (EXTRA_PASSES[speed[i]] < p) continue;
          const t = type[i];
          if (t === 0 || t === wallId || clock[i] === pass) continue;
          clock[i] = pass;
          this.update(i, x, y, t);
        }
      }
    }
  },
};
