import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FFT } from '../src/sim/fft.js';

// A slow discrete Fourier transform to check against.
function dft(re, im, inverse) {
  const n = re.length;
  const or = new Float64Array(n), oi = new Float64Array(n);
  const s = inverse ? 1 : -1;
  for (let k = 0; k < n; k++) {
    for (let t = 0; t < n; t++) {
      const a = (s * 2 * Math.PI * k * t) / n;
      or[k] += re[t] * Math.cos(a) - im[t] * Math.sin(a);
      oi[k] += re[t] * Math.sin(a) + im[t] * Math.cos(a);
    }
  }
  return [or, oi];
}

const close = (a, b) => Math.abs(a - b) < 1e-9;

test('the FFT matches a slow DFT, and the inverse brings the input back', () => {
  const n = 16;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) { re[i] = Math.sin(i * 1.3) + i * 0.1; im[i] = Math.cos(i * 0.7); }
  const [er, ei] = dft(re, im, false);
  const r = re.slice(), m = im.slice();
  const fft = new FFT(n);
  fft.run(r, m);
  for (let i = 0; i < n; i++) assert.ok(close(r[i], er[i]) && close(m[i], ei[i]), `bin ${i}`);
  fft.run(r, m, 0, 1, true);
  for (let i = 0; i < n; i++) assert.ok(close(r[i] / n, re[i]) && close(m[i] / n, im[i]), `sample ${i}`);
});

test('a strided transform works on one column of a grid', () => {
  const w = 4, h = 8;
  const re = new Float64Array(w * h), im = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) re[i] = (i * 37) % 11;
  const col = 2;
  const cr = new Float64Array(h), ci = new Float64Array(h);
  for (let y = 0; y < h; y++) cr[y] = re[y * w + col];
  new FFT(h).run(cr, ci);
  new FFT(h).run(re, im, col, w);
  for (let y = 0; y < h; y++) assert.ok(close(re[y * w + col], cr[y]) && close(im[y * w + col], ci[y]));
  assert.equal(re[1], (1 * 37) % 11, 'other columns are left alone');
});

test('a length that is not a power of two is refused', () => {
  assert.throws(() => new FFT(12), /power of two/);
});
