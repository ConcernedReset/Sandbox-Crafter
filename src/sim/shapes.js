// Bodies for the bigger creatures (creatures.js). A shape is a few frames
// of small pictures, each a list of rows, top row first:
//
//   shape: {
//     frames: [['a.a', '.b.'], ['...', 'aba']], // wings up, wings down
//     palette: { a: ['#5a4a3a', '#8a6a4a'], b: ['#e8e0d0'] },
//   }
//
// '.' is no pixel; any other letter is a pixel coloured from that letter's
// palette entry. A letter with several colours gives each creature one of
// them, picked when it's born (so humans wear different shirts). Every
// frame has the same number of pixels, numbered in reading order. The
// anchor, where the creature stands, is the middle of the bottom row: a
// pixel's offset is (column - floor(width / 2), row - (height - 1)).
// `pulse: true` switches frames on a timer instead of as the creature moves.

export const SHAPE_COLORS = 32; // palette slots per shape (a cell's shade & 31)

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

export function compileShape(src, key) {
  const letters = Object.keys(src.palette);
  const base = [], options = [], colors = [];
  for (const l of letters) {
    base.push(colors.length);
    options.push(src.palette[l].length);
    for (const c of src.palette[l]) colors.push(hex(c));
  }
  if (colors.length > SHAPE_COLORS) throw new Error(`${key}: more than ${SHAPE_COLORS} colours`);
  const h = src.frames[0].length, w = src.frames[0][0].length;
  const frames = src.frames.map((rows) => {
    if (rows.length !== h || rows.some((r) => r.length !== w)) throw new Error(`${key}: frames differ in size`);
    const dx = [], dy = [], letter = [];
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const l = letters.indexOf(ch);
      if (l < 0) throw new Error(`${key}: no colour for '${ch}'`);
      dx.push(x - (w >> 1));
      dy.push(y - (h - 1));
      letter.push(l);
    }));
    return { dx: Int8Array.from(dx), dy: Int8Array.from(dy), letter: Uint8Array.from(letter) };
  });
  const n = frames[0].dx.length;
  if (frames.some((f) => f.dx.length !== n)) throw new Error(`${key}: frames have different numbers of pixels`);
  // A seed grows from the pixel nearest the middle of the shape outwards.
  const f = frames[0], my = -(h - 1) / 2;
  const far = (p) => f.dx[p] * f.dx[p] + (f.dy[p] - my) ** 2;
  const order = [...Array(n).keys()].sort((a, b) => far(a) - far(b));
  return {
    w, h, n, frames, letters, base, options, order,
    colors: Array.from({ length: SHAPE_COLORS }, (_, k) => colors[k % colors.length]),
    pulse: !!src.pulse,
  };
}
