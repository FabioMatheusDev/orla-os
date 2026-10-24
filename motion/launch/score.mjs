// Score for the orla launch film, synthesized in code (motion/RULES.md). 100 BPM, 17 bars.
// Writes out/launch.raw.wav and beats.json (grid, scene cues, measured hits). Seeded noise only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000, BPM = 100, BEAT = 60 / BPM, BAR = BEAT * 4, DUR = 17 * BAR, N = Math.round(SR * DUR);
const grid = Array.from({ length: Math.round(DUR / BEAT) + 1 }, (_, i) => +(i * BEAT).toFixed(3));
const at = (bar, beat = 0) => +(bar * BAR + beat * BEAT).toFixed(3);
// scene cues (the film reads these): impacts on bars 2, 12 and 15
const cues = { open: 0, logo: at(2), product: at(4), details: at(8), looks: at(10), anyTv: at(12), agent: at(13), end: at(15) };
const IMPACTS = [cues.logo, cues.anyTv, cues.end];

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(0x0B1A), noise = () => rnd() * 2 - 1;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), TAU = Math.PI * 2;
const L = new Float32Array(N), R = new Float32Array(N), wet = new Float32Array(N);
function put(i, v, pan = 0, send = 0) { const a = (clamp(pan, -1, 1) + 1) * Math.PI / 4; L[i] += v * Math.cos(a); R[i] += v * Math.sin(a); if (send) wet[i] += v * send; }
const span = (t0, t1, fn) => { for (let i = Math.max(0, Math.round(t0 * SR)); i < Math.min(N, Math.round(t1 * SR)); i++) fn(i, i / SR); };
function biquad(type) {
  let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return { set(f, q) { const w = TAU * f / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q); let n0, n1, n2;
      if (type === 'lp') { n0 = (1 - c) / 2; n1 = 1 - c; n2 = n0; } else if (type === 'hp') { n0 = (1 + c) / 2; n1 = -(1 + c); n2 = n0; } else { n0 = al; n1 = 0; n2 = -al; }
      const d0 = 1 + al; b0 = n0 / d0; b1 = n1 / d0; b2 = n2 / d0; a1 = -2 * c / d0; a2 = (1 - al) / d0; },
    run(x) { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; } };
}
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// --- 1. cold open (bars 0–1): glitchy ad blips and a tension riser ---
for (let k = 0; k < 28; k++) {
  const t0 = 0.15 + k * (at(2) - 0.5) / 28 + (rnd() - 0.5) * 0.05, f = 600 + rnd() * 2400, pan = rnd() * 1.6 - 0.8;
  span(t0, t0 + 0.06, (i, t) => { const d = t - t0; put(i, Math.sign(Math.sin(TAU * f * d)) * 0.05 * Math.exp(-d * 60), pan, 0.1); });
}
{ const bp = biquad('bp'); span(0.3, at(2), (i, t) => { const p = (t - 0.3) / (at(2) - 0.3); if (i % 32 === 0) bp.set(300 * Math.pow(20, p), 1.2); put(i, bp.run(noise()) * 0.35 * p * p, 0, 0.2); }); }
{ let ph = 0; span(1.2, at(2), (i, t) => { const p = (t - 1.2) / (at(2) - 1.2); ph += TAU * (38 + 18 * p) / SR; put(i, Math.tanh(1.8 * Math.sin(ph)) * 0.35 * p * p * clamp((at(2) - t) / 0.005)); }); }

// --- 2. impacts: the low hit (as in the intro), a click and a glass-bell chord ---
function impact(t0, chord) {
  let ph = 0;
  span(t0, t0 + 2.2, (i, t) => { const d = t - t0; ph += TAU * (38 + 72 * Math.exp(-d * 18)) / SR;
    put(i, (Math.tanh(2.4 * Math.sin(ph)) * 0.95 * Math.exp(-d * 3) + Math.sin(TAU * 36 * d) * 0.5 * Math.exp(-d * 1.6)) * clamp(d / 0.002), 0, 0.05); });
  const lp = biquad('lp'); lp.set(1800, 0.7); span(t0, t0 + 0.05, (i, t) => put(i, lp.run(noise()) * 0.8 * Math.exp(-(t - t0) * 90), 0, 0.2));
  chord.forEach((n, k) => { const f = NOTE(n), pan = (k / (chord.length - 1)) * 1.2 - 0.6;
    span(t0 + k * 0.006, t0 + 3, (i, t) => { const d = t - t0 - k * 0.006; put(i, Math.sin(TAU * f * d + 1.2 * Math.exp(-d * 9) * Math.sin(TAU * f * 3.5 * d)) * 0.06 * Math.exp(-d * 1.5), pan, 0.45); }); });
}
impact(cues.logo, [50, 62, 66, 69, 74]); impact(cues.anyTv, [55, 62, 67, 71, 74]); impact(cues.end, [50, 62, 66, 69, 74, 78]);

// --- 3. the groove (bars 4–14): kick on every beat, offbeat hats, a bass on the root ---
const prog = [[50, 54, 57], [47, 50, 54], [43, 47, 50], [45, 49, 52]];   // D · Bm · G · A
for (let b = 4; b < 15; b++) for (let q = 0; q < 4; q++) {
  if (b === 12 && q === 0) continue;                                       // the impact takes this beat
  const t0 = at(b, q); let ph = 0;
  span(t0, t0 + 0.35, (i, t) => { const d = t - t0; ph += TAU * (45 + 90 * Math.exp(-d * 30)) / SR; put(i, Math.sin(ph) * 0.55 * Math.exp(-d * 9)); });
  const hp = biquad('hp'); hp.set(7000, 0.7); const h0 = t0 + BEAT / 2;
  span(h0, h0 + 0.05, (i, t) => put(i, hp.run(noise()) * 0.09 * Math.exp(-(t - h0) * 70), 0.3, 0.1));
  const root = NOTE(prog[b % 4][0] - 12), b0 = t0 + BEAT * 0.5;
  span(b0, b0 + BEAT * 0.45, (i, t) => { const d = t - b0; put(i, Math.tanh(1.5 * Math.sin(TAU * root * d)) * 0.16 * Math.exp(-d * 4)); });
}
// --- 4. pad (bars 2–17), one chord per bar, wide and warm ---
for (let b = 2; b < 17; b++) {
  const ch = prog[b % 4], t0 = at(b), t1 = b === 16 ? DUR : at(b + 1) + 0.15;
  span(t0, t1, (i, t) => { const d = t - t0, env = clamp(d / 0.25) * clamp((t1 - t) / 0.25) * (b === 16 ? clamp((DUR - t) / 2.2) : 1);
    let l = 0, r = 0; for (const n of ch) { const f = NOTE(n); l += Math.sin(TAU * f * 0.997 * t); r += Math.sin(TAU * f * 1.003 * t); }
    const a = 0.032 * env; L[i] += l * a; R[i] += r * a; wet[i] += (l + r) * a * 0.25; });
}
// --- 5. scene whooshes, typing ticks and check chimes ---
function whoosh(tc, len = 0.5) { const bp = biquad('bp'); span(tc - len, tc, (i, t) => { const p = (t - tc + len) / len; if (i % 32 === 0) bp.set(500 * Math.pow(8, p), 1); put(i, bp.run(noise()) * 0.28 * Math.sin(Math.PI * p), -0.6 + 1.2 * p, 0.2); }); }
[cues.product, at(5), at(6), at(7), cues.details, at(9), cues.looks, at(11), cues.agent].forEach(t => whoosh(t));
for (let k = 0; k < 46; k++) { const t0 = cues.agent + 0.1 + k * 0.042; span(t0, t0 + 0.02, (i, t) => put(i, noise() * 0.05 * Math.exp(-(t - t0) * 200), 0.4, 0.05)); }
[at(14, 0), at(14, 1), at(14, 2)].forEach((t0, k) => span(t0, t0 + 0.6, (i, t) => { const d = t - t0; put(i, (Math.sin(TAU * NOTE(74 + [0, 4, 7][k]) * d) + 0.3 * Math.sin(TAU * NOTE(86 + [0, 4, 7][k]) * d)) * 0.07 * Math.exp(-d * 6), 0.3, 0.4); }));

// --- reverb, gentle high roll-off after each impact, soft clip ---
function freeverb(input, spread) {
  const s = SR / 44100, combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map(n => Math.round((n + spread) * s)), alls = [556, 441, 341, 225].map(n => Math.round((n + spread) * s)), out = new Float32Array(N);
  const cb = combs.map(n => ({ buf: new Float32Array(n), i: 0, z: 0 })), ab = alls.map(n => ({ buf: new Float32Array(n), i: 0 }));
  for (let n = 0; n < N; n++) { const x = input[n] * 0.015; let y = 0;
    for (const c of cb) { const o = c.buf[c.i]; c.z = o * 0.75 + c.z * 0.25; c.buf[c.i] = x + c.z * 0.85; c.i = (c.i + 1) % c.buf.length; y += o; }
    for (const a of ab) { const o = a.buf[a.i]; a.buf[a.i] = y + o * 0.5; a.i = (a.i + 1) % a.buf.length; y = o - y; } out[n] = y; }
  return out;
}
const wL = freeverb(wet, 0), wR = freeverb(wet, 23), lpL = biquad('lp'), lpR = biquad('lp'), hpL = biquad('hp'), hpR = biquad('hp');
hpL.set(24, 0.7); hpR.set(24, 0.7);
let peak = 0;
const outL = new Float32Array(N), outR = new Float32Array(N);
for (let n = 0; n < N; n++) {
  if (n % 64 === 0) { const t = n / SR; lpL.set(13000, 0.6); lpR.set(13000, 0.6); }
  const fade = clamp((DUR - n / SR) / 0.1);
  outL[n] = lpL.run(hpL.run(L[n] + wL[n] * 0.8)) * fade; outR[n] = lpR.run(hpR.run(R[n] + wR[n] * 0.8)) * fade;
  peak = Math.max(peak, Math.abs(outL[n]), Math.abs(outR[n]));
}
for (let n = 0; n < N; n++) { outL[n] = Math.tanh(outL[n] / peak * 1.2) * 0.89; outR[n] = Math.tanh(outR[n] / peak * 1.2) * 0.89; }

const out = path.join(here, 'out'); fs.mkdirSync(out, { recursive: true });
const data = Buffer.alloc(N * 8); for (let n = 0; n < N; n++) { data.writeFloatLE(outL[n], n * 8); data.writeFloatLE(outR[n], n * 8 + 4); }
const hdr = Buffer.alloc(44); hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(3, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 8, 28); hdr.writeUInt16LE(8, 32); hdr.writeUInt16LE(32, 34);
hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
fs.writeFileSync(path.join(out, 'launch.raw.wav'), Buffer.concat([hdr, data]));

// measure onsets on the mix and check every impact landed on its cue
const hop = Math.round(SR * 0.005), win = hop * 4, env = [];
for (let s = 0; s + win < N; s += hop) { let e = 0; for (let n = s; n < s + win; n++) e += outL[n] * outL[n] + outR[n] * outR[n]; env.push(Math.log10(e / win + 1e-9)); }
const flux = env.map((e, k) => k ? Math.max(0, e - env[k - 1]) : 0);
const near = (t) => { let best = t, bv = -1; for (let k = Math.round((t - 0.05) * SR / hop); k <= Math.round((t + 0.05) * SR / hop); k++) if (flux[k] > bv) { bv = flux[k]; best = +(k * hop / SR + win / SR / 2).toFixed(3); } return best; };
const measured = Object.fromEntries(IMPACTS.map(t => [t, near(t)]));
fs.writeFileSync(path.join(here, 'beats.json'), JSON.stringify({ bpm: BPM, beat: BEAT, bar: BAR, duration: +DUR.toFixed(3), grid, cues, impacts: IMPACTS, measured }, null, 2) + '\n');
console.log('launch score', DUR.toFixed(2), 's · impacts', JSON.stringify(measured));
if (Object.entries(measured).some(([c, m]) => Math.abs(m - c) > 0.02)) { console.error('an impact is off its cue by more than 20 ms'); process.exitCode = 1; }
