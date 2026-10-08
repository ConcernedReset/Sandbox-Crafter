// Trees: a Sapling that lands on soil takes root and grows into a tree. Its
// trunk climbs a cell at a time (the sapling moves up, leaving wood behind)
// to a height of its own, with a few side branches tufted with leaves, then
// it puts out its crown. Each tree picks its shape (a round oak, a pointed
// pine or a wide flat acacia), its leaves' colours, how thick its crown is,
// and, if it's tall, a trunk two cells wide. Trees grow up against the
// gravity arrow. Mixed into World.prototype.

import { DEFS, ID, State, SPECIAL } from './elements.js';

const { GAS } = State;
const { SAPLING, WOOD, LEAVES, DIRT, MUD, GRASS, SAND } = ID;
const SOIL = new Set([DIRT, MUD, GRASS, SAND]);
const GROW_CHANCE = 0.08; // chance per step of another cell of trunk
// A rooted sapling's ctype: ROOTED, the shape (bits 0-1), the leaf colour
// scheme (2-4), the crown's thickness (5-6), a thick trunk (7) and the
// height (8-13). Its life counts the trunk still to grow.
const ROOTED = 0x8000;
const OAK = 0, PINE = 1, ACACIA = 2;
// Leaf colour schemes: which of Leaves' eight colours each uses (summer
// green, dark pine, autumn, blossom, and green turning to autumn).
const SCHEMES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 1, 4, 5]];
const THICKNESS = [0.7, 0.82, 0.94]; // the chance each crown cell grows a leaf

export const Trees = {
  updateSapling(i, x, y) {
    const c = this.ctype[i];
    const { downX: gx, downY: gy } = this.gravity;
    if ((c & ROOTED) === 0) {
      // Falls like a seed until it lands on soil.
      const bx = x + gx, by = y + gy;
      if (!this.inBounds(bx, by) || !SOIL.has(this.type[by * this.w + bx])) return false;
      this.ctype[i] = this.pickTree();
      this.life[i] = (this.ctype[i] >> 8) & 63;
      return true;
    }
    if (this.rand() >= GROW_CHANCE) return true;
    const height = (c >> 8) & 63, left = this.life[i];
    const ax = x - gx, ay = y - gy;
    // The trunk grows through its own branches' leaves.
    if (left > 0 && this.inBounds(ax, ay) && (this.airAt(ay * this.w + ax) || this.type[ay * this.w + ax] === LEAVES)) {
      const j = ay * this.w + ax;
      this.plantCell(j, SAPLING, c);
      this.ctype[j] = c;
      this.life[j] = left - 1;
      this.convert(i, WOOD, false, -1);
      // A tall tree's trunk is two cells wide.
      if (c & 0x80) {
        const sx = x + gy, sy = y - gx;
        if (this.inBounds(sx, sy) && this.airAt(sy * this.w + sx)) this.plantCell(sy * this.w + sx, WOOD, c);
      }
      if (height - left > height * 0.35 && left > 3 && this.rand() < 0.25) this.branch(x, y, c, this.rand() < 0.5 ? 1 : -1, 2 + ((this.rand() * 4) | 0));
      return true;
    }
    this.crown(x, y, c);
    this.convert(i, WOOD, false, -1);
    return true;
  },

  // A new tree's looks: its shape, colours, crown and height (15 to 45).
  pickTree() {
    const shape = (this.rand() * 3) | 0;
    let scheme = (this.rand() * SCHEMES.length) | 0;
    if (shape === PINE && this.rand() < 0.7) scheme = 1; // pines are mostly dark
    const thickness = (this.rand() * THICKNESS.length) | 0;
    const height = 15 + ((this.rand() * 31) | 0);
    return ROOTED | shape | (scheme << 2) | (thickness << 5) | ((height >= 30 ? 1 : 0) << 7) | (height << 8);
  },

  // Is cell j free to grow into: empty, or a gas?
  airAt(j) {
    const t = this.type[j];
    return t === 0 || (DEFS[t].state === GAS && DEFS[t].displaceable);
  },

  // Grow element t into free cell j; leaves take the tree's colours.
  plantCell(j, t, c) {
    if (this.type[j] !== 0) this.clearCell(j);
    this.spawn(j, t);
    if (t === LEAVES) {
      const s = SCHEMES[(c >> 2) & 7];
      this.shade[j] = s[(this.rand() * s.length) | 0];
      this.record(LEAVES, SPECIAL['sapling-leaves']);
    }
  },

  // A leaf, at (x, y) if it's free, as often as the crown's thickness says.
  leafAt(x, y, c) {
    if (!this.inBounds(x, y)) return;
    const j = y * this.w + x;
    if (this.airAt(j) && this.rand() < THICKNESS[(c >> 5) & 3]) this.plantCell(j, LEAVES, c);
  },

  // A side branch from (x, y) towards side s (1 or -1): `len` cells of wood
  // climbing diagonally away from the trunk, with a tuft of leaves at the end.
  branch(x, y, c, s, len) {
    const { downX: gx, downY: gy } = this.gravity;
    let ex = x, ey = y;
    for (let k = 1; k <= len; k++) {
      const up = (k + 1) >> 1;
      const nx = x + s * k * gy - up * gx, ny = y - s * k * gx - up * gy;
      if (!this.inBounds(nx, ny) || !this.airAt(ny * this.w + nx)) break;
      this.plantCell(ny * this.w + nx, WOOD, c);
      ex = nx;
      ey = ny;
    }
    if (ex !== x || ey !== y) this.leafBlob(ex, ey, 2, 2, c);
  },

  // An oval of leaves round (x, y): `ra` cells across, `rb` along the arrow.
  leafBlob(x, y, ra, rb, c) {
    const { downX: gx, downY: gy } = this.gravity;
    for (let a = -rb; a <= rb; a++) {
      for (let b = -ra; b <= ra; b++) {
        if ((b * b) / (ra * ra + 0.5) + (a * a) / (rb * rb + 0.5) > 1) continue;
        this.leafAt(x + b * gy + a * gx, y - b * gx + a * gy, c);
      }
    }
  },

  // The crown, round the top of the trunk at (x, y).
  crown(x, y, c) {
    const { downX: gx, downY: gy } = this.gravity;
    const height = (c >> 8) & 63;
    const at = (b, a) => [x + b * gy + a * gx, y - b * gx + a * gy]; // b across, a down
    switch (c & 3) {
      case OAK: {
        const r = 4 + ((height / 9) | 0);
        const [cx, cy] = at(0, -1);
        this.leafBlob(cx, cy, r, Math.max(3, Math.round(r * 0.75)), c);
        break;
      }
      case PINE: {
        // Layered tiers from just over the top down most of the trunk.
        const reach = Math.round(height * 0.6);
        for (let a = -2; a <= reach; a++) {
          const half = Math.max(0, Math.floor((a + 3) * 0.4) - ((a + 3) % 3 === 0 ? 1 : 0));
          for (let b = -half; b <= half; b++) this.leafAt(...at(b, a), c);
        }
        break;
      }
      default: { // ACACIA: arms out to both sides, and a wide flat top
        const r = 6 + ((height / 6) | 0);
        const arm = 2 + (r >> 2);
        this.branch(x, y, c, 1, arm);
        this.branch(x, y, c, -1, arm);
        for (let a = -3; a <= -1; a++) {
          const half = r - (a === -3 ? 3 : a === -1 ? 1 : 0);
          for (let b = -half; b <= half; b++) this.leafAt(...at(b, a - ((arm + 1) >> 1)), c);
        }
      }
    }
  },
};
