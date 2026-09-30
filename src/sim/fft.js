// Radix-2 fast Fourier transforms, in place, on separate real and imaginary
// arrays. The Newtonian gravity field (gravity.js) uses them to add up the
// pull of every air block on every other in O(n log n) instead of O(n²).

export class FFT {
  // A transform for one power-of-two length: the bit-reversed order and the
  // twiddle factors are worked out once.
  constructor(n) {
    if (n < 1 || (n & (n - 1)) !== 0) throw new Error(`FFT length ${n} is not a power of two`);
    this.n = n;
    let bits = 0;
    while ((1 << bits) < n) bits++;
    this.rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.cos = new Float64Array(n >> 1);
    this.sin = new Float64Array(n >> 1);
    for (let i = 0; i < n >> 1; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / n);
      this.sin[i] = Math.sin((2 * Math.PI * i) / n);
    }
  }

  // Transform n values of re/im in place, starting at `offset` and `stride`
  // apart (so a grid's columns can be done where they are). The inverse is
  // not divided by n.
  run(re, im, offset = 0, stride = 1, inverse = false) {
    const { n, rev, cos, sin } = this;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        const a = offset + i * stride, b = offset + j * stride;
        let t = re[a]; re[a] = re[b]; re[b] = t;
        t = im[a]; im[a] = im[b]; im[b] = t;
      }
    }
    const sign = inverse ? 1 : -1;
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let start = 0; start < n; start += size) {
        for (let k = 0; k < half; k++) {
          const wr = cos[k * step], wi = sign * sin[k * step];
          const a = offset + (start + k) * stride;
          const b = a + half * stride;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
  }
}
