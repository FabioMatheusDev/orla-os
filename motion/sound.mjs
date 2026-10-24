// Score and SFX for the orla intro, synthesized in code (motion/RULES.md).
// Deterministic: seeded noise (mulberry32), no Math.random. Writes out/score.raw.wav
// (float, unnormalized) and beats.json (the grid plus the onsets measured on the result).
// Loudness (-14 LUFS) is applied by render.mjs with ffmpeg loudnorm.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000, DUR = 5.0, N = Math.round(SR * DUR);
const BPM = 120, OFFSET = 0.2, BEAT = 60 / BPM;
const grid = Array.from({ length: 10 }, (_, i) => +(OFFSET + i * BEAT).toFixed(3));
// Cues on the grid: horizon draw, letters, IMPACT, light sweep, exit.
const CUE = { start: grid[0], letters: grid[2], impact: grid[3], sweep: grid[5], exit: grid[8] };

function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const rnd = mulberry32(0x0721A);
const noise = () => rnd() * 2 - 1;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const TAU = Math.PI * 2;

const dryL = new Float32Array(N), dryR = new Float32Array(N), wetIn = new Float32Array(N);
function put(i, v, pan, send) {
  // equal-power pan, pan in [-1, 1]
  const a = (clamp(pan, -1, 1) + 1) * Math.PI / 4;
  dryL[i] += v * Math.cos(a); dryR[i] += v * Math.sin(a);
  if (send) wetIn[i] += v * send;
}

// RBJ biquad with coefficients refreshed as the frequency moves.
function biquad(type) {
  let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return {
    set(f, q) {
      const w = TAU * f / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q);
      let n0, n1, n2;
      if (type === 'lp') { n0 = (1 - c) / 2; n1 = 1 - c; n2 = (1 - c) / 2; }
      else if (type === 'hp') { n0 = (1 + c) / 2; n1 = -(1 + c); n2 = (1 + c) / 2; }
      else { n0 = al; n1 = 0; n2 = -al; }
      const d0 = 1 + al; b0 = n0 / d0; b1 = n1 / d0; b2 = n2 / d0; a1 = -2 * c / d0; a2 = (1 - al) / d0;
    },
    run(x) { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; }
  };
}
const span = (t0, t1, fn) => { for (let i = Math.max(0, Math.round(t0 * SR)); i < Math.min(N, Math.round(t1 * SR)); i++) fn(i, i / SR); };

// 1. Sub riser 0.2 → 1.7: 40 → 55 Hz, saturated so TV speakers still hear it.
{ let ph = 0;
  span(CUE.start, CUE.impact, (i, t) => {
    const p = (t - CUE.start) / (CUE.impact - CUE.start);
    ph += TAU * (40 + 15 * p) / SR;
    const cut = clamp((CUE.impact - t) / 0.005);
    put(i, Math.tanh(1.8 * Math.sin(ph)) * 0.42 * p * p * cut, 0, 0);
  }); }

// 2. Air whoosh with the horizon draw: band-passed noise 400 → 4000 Hz, panned left → right.
{ const bp = biquad('bp');
  span(CUE.start, CUE.letters + 0.1, (i, t) => {
    const p = (t - CUE.start) / (CUE.letters + 0.1 - CUE.start);
    if (i % 32 === 0) bp.set(400 * Math.pow(10, p), 1.1);
    put(i, bp.run(noise()) * Math.pow(Math.sin(Math.PI * p), 1.5) * 0.55, -0.7 + 1.4 * p, 0.25);
  }); }

// 3. A glass tick for each letter rising (1.2, 1.29, 1.38, 1.47), panned by letter.
for (let k = 0; k < 4; k++) {
  const t0 = CUE.letters + k * 0.09;
  span(t0, t0 + 0.25, (i, t) => {
    const d = t - t0, e = Math.exp(-d * 40);
    put(i, (Math.sin(TAU * 2349.3 * d) + 0.45 * Math.sin(TAU * 3523.9 * d)) * 0.07 * e, -0.36 + k * 0.24, 0.5);
  });
}

// 4. Glass harmonics rising into the impact: D6, A6, D7, gliding up a semitone, with tremolo.
{ const f = [1174.66, 1760, 2349.3], ph = [0, 0, 0];
  span(CUE.letters, CUE.impact, (i, t) => {
    const p = (t - CUE.letters) / (CUE.impact - CUE.letters), bend = Math.pow(2, p / 12);
    let v = 0; for (let k = 0; k < 3; k++) { ph[k] += TAU * f[k] * bend / SR; v += Math.sin(ph[k]) / (k + 1); }
    put(i, v * 0.06 * p * p * (0.75 + 0.25 * Math.sin(TAU * 7 * t)) * clamp((CUE.impact - t) / 0.004), 0, 0.6);
  }); }

// 5. IMPACT at 1.7: the low hit the brief asks for, a click, and a Dadd9 glass-bell chord.
{ let ph = 0;
  span(CUE.impact, CUE.impact + 2.4, (i, t) => {
    const d = t - CUE.impact;
    ph += TAU * (38 + 72 * Math.exp(-d * 18)) / SR;            // 110 → 38 Hz drop
    const thump = Math.tanh(2.4 * Math.sin(ph)) * Math.exp(-d * 3.0);
    const sub = Math.sin(TAU * 36 * d) * 0.55 * Math.exp(-d * 1.5);
    put(i, (thump * 0.95 + sub) * clamp(d / 0.002), 0, 0.05);
  });
  const lp = biquad('lp'); lp.set(1800, 0.7);
  span(CUE.impact, CUE.impact + 0.06, (i, t) => put(i, lp.run(noise()) * 0.9 * Math.exp(-(t - CUE.impact) * 90), 0, 0.2));
  const bells = [[293.66, -0.3], [587.33, -0.5], [739.99, 0.4], [880, -0.2], [1174.66, 0.25]];
  bells.forEach(([fc, pan], k) => {
    const t0 = CUE.impact + k * 0.006;
    span(t0, t0 + 3.2, (i, t) => {
      const d = t - t0, idx = 1.2 * Math.exp(-d * 9);
      put(i, Math.sin(TAU * fc * d + idx * Math.sin(TAU * fc * 3.5 * d)) * 0.07 * Math.exp(-d * 1.6), pan, 0.45);
    });
  });
}

// 6. Warm pad (D major) after the hit, fading by 4.8 s.
{ const f = [146.83, 220, 293.66, 369.99, 440];
  span(CUE.impact + 0.05, 4.8, (i, t) => {
    const d = t - CUE.impact - 0.05, env = clamp(d / 0.45) * (t > 3.8 ? 0.5 + 0.5 * Math.cos(Math.PI * (t - 3.8)) : 1);
    let l = 0, r = 0;
    for (const fr of f) { l += Math.sin(TAU * fr * 0.9977 * t); r += Math.sin(TAU * fr * 1.0023 * t); }
    const a = 0.045 * env; dryL[i] += l * a; dryR[i] += r * a; wetIn[i] += (l + r) * a * 0.3;
  }); }

// 7. Shimmer that walks with the light sweep (2.7 → 3.6), left → right.
{ const notes = [1174.66, 1318.51, 1480.0, 1760.0, 1975.5], G = 18, len = 0.9;
  for (let g = 0; g < G; g++) {
    const t0 = CUE.sweep + g * len / G + (rnd() - 0.5) * 0.02, fr = notes[Math.floor(rnd() * notes.length)], pan = -0.8 + 1.6 * g / (G - 1);
    span(t0, t0 + 0.3, (i, t) => { const d = t - t0; put(i, Math.sin(TAU * fr * d) * 0.022 * Math.exp(-d * 14) * clamp(d / 0.004), pan, 0.6); });
  } }

// 8. Exit: a falling breath as the word lifts away (4.2 → 4.9).
{ const bp = biquad('bp');
  span(CUE.exit, CUE.exit + 0.7, (i, t) => {
    const p = (t - CUE.exit) / 0.7;
    if (i % 32 === 0) bp.set(1200 * Math.pow(250 / 1200, p), 0.8);
    put(i, bp.run(noise()) * Math.sin(Math.PI * p) * 0.22, 0.6 - 1.2 * p, 0.25);
  }); }

// Freeverb-style room on the send bus (bells, glass, pad, shimmer).
function freeverb(input, spread) {
  const s = SR / 44100, combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map(n => Math.round((n + spread) * s));
  const alls = [556, 441, 341, 225].map(n => Math.round((n + spread) * s)), out = new Float32Array(N);
  const cb = combs.map(n => ({ buf: new Float32Array(n), i: 0, z: 0 })), ab = alls.map(n => ({ buf: new Float32Array(n), i: 0 }));
  for (let n = 0; n < N; n++) {
    const x = input[n] * 0.015; let y = 0;
    for (const c of cb) { const o = c.buf[c.i]; c.z = o * 0.75 + c.z * 0.25; c.buf[c.i] = x + c.z * 0.86; c.i = (c.i + 1) % c.buf.length; y += o; }
    for (const a of ab) { const o = a.buf[a.i]; a.buf[a.i] = y + o * 0.5; a.i = (a.i + 1) % a.buf.length; y = o - y; }
    out[n] = y;
  }
  return out;
}
const wetL = freeverb(wetIn, 0), wetR = freeverb(wetIn, 23);
const L = new Float32Array(N), R = new Float32Array(N);
const hpL = biquad('hp'), hpR = biquad('hp'); hpL.set(24, 0.7); hpR.set(24, 0.7);
const lpL = biquad('lp'), lpR = biquad('lp');
let peak = 0;
for (let n = 0; n < N; n++) {
  const fade = clamp((DUR - n / SR) / 0.08);                     // silence on the last frame
  if (n % 64 === 0) { const tt = n / SR, f = tt < CUE.impact + 0.25 ? 14000 : 14000 * Math.pow(3500 / 14000, clamp((tt - CUE.impact - 0.25) / 1.6)); lpL.set(f, 0.6); lpR.set(f, 0.6); }
  L[n] = lpL.run(hpL.run(dryL[n] + wetL[n] * 0.8)) * fade; R[n] = lpR.run(hpR.run(dryR[n] + wetR[n] * 0.8)) * fade;
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
for (let n = 0; n < N; n++) { L[n] = Math.tanh(L[n] / peak * 1.1) * 0.89; R[n] = Math.tanh(R[n] / peak * 1.1) * 0.89; }

// float32 stereo WAV
const out = path.join(here, 'out'); fs.mkdirSync(out, { recursive: true });
const data = Buffer.alloc(N * 8); for (let n = 0; n < N; n++) { data.writeFloatLE(L[n], n * 8); data.writeFloatLE(R[n], n * 8 + 4); }
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(3, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24);
hdr.writeUInt32LE(SR * 8, 28); hdr.writeUInt16LE(8, 32); hdr.writeUInt16LE(32, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
fs.writeFileSync(path.join(out, 'score.raw.wav'), Buffer.concat([hdr, data]));

// Measure the onsets on the mix (log-energy flux, 5 ms hop) so the picture follows the real sound.
const hop = Math.round(SR * 0.005), win = hop * 4, env = [];
for (let s = 0; s + win < N; s += hop) { let e = 0; for (let n = s; n < s + win; n++) e += L[n] * L[n] + R[n] * R[n]; env.push(Math.log10(e / win + 1e-9)); }
const flux = env.map((e, k) => k ? Math.max(0, e - env[k - 1]) : 0);
const mean = flux.reduce((a, b) => a + b, 0) / flux.length, sd = Math.sqrt(flux.reduce((a, b) => a + (b - mean) ** 2, 0) / flux.length);
const onsets = [];
flux.forEach((f, k) => {
  if (f > mean + 3 * sd && f >= (flux[k - 1] || 0) && f >= (flux[k + 1] || 0)) {
    const t = +(k * hop / SR + win / SR / 2).toFixed(3);
    if (!onsets.length || t - onsets[onsets.length - 1] > 0.06) onsets.push(t);
  }
});
const near = (t) => onsets.reduce((b, o) => Math.abs(o - t) < Math.abs(b - t) ? o : b, Infinity);
const impactMeasured = near(CUE.impact);
const beats = { bpm: BPM, offset: OFFSET, duration: DUR, grid, cues: CUE, measured: { onsets, impact: impactMeasured } };
fs.writeFileSync(path.join(here, 'beats.json'), JSON.stringify(beats, null, 2) + '\n');
console.log('score.raw.wav written · impact cue', CUE.impact, 's · measured', impactMeasured, 's · onsets', onsets.join(', '));
if (Math.abs(impactMeasured - CUE.impact) > 0.02) { console.error('Impact is off the grid by more than 20 ms'); process.exitCode = 1; }
