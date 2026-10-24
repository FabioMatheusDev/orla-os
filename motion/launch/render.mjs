// Renders the orla launch film (motion/RULES.md).
//   node render.mjs --sheet [--v]   one frame per bar (plus the hits), tiled: out/sheet-16x9.png / out/sheet-9x16.png
//   node render.mjs [--v]           film: 16:9 3840×2160 or 9:16 2160×3840, 30 fps, H.264 yuv420p CRF 16, -14 LUFS
// Needs: node score.mjs (out/launch.raw.wav, beats.json) and node capture.mjs (plates/).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), out = path.join(here, 'out');
const { chromium } = createRequire(path.join(root, 'tests', 'package.json'))('playwright');
const beats = JSON.parse(fs.readFileSync(path.join(here, 'beats.json'), 'utf8'));
const V = process.argv.includes('--v'), sheet = process.argv.includes('--sheet'), FPS = 30;
const W = V ? 1080 : 1920, H = V ? 1920 : 1080, tag = V ? '9x16' : '16x9';
fs.mkdirSync(out, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ channel: process.env.TEST_BROWSER_CHANNEL || 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: sheet ? 1 : 2 });
  await page.addInitScript(b => { window.BEATS = b; }, beats);
  await page.goto('http://127.0.0.1:' + server.address().port + '/motion/launch/launch.html' + (V ? '?v=1' : ''));
  await page.evaluate(() => window.ready);
  const stage = page.locator('#stage');
  const frame = async (t) => {
    // seek, then wait until every visible image is decoded so no frame shows a half-loaded plate
    await page.evaluate(async x => { window.seek(x); await Promise.all([...document.images].filter(i => i.getAttribute('src')).map(i => i.decode().catch(() => {}))); }, t);
    return stage.screenshot({ type: 'png', animations: 'disabled' });
  };
  if (sheet) {
    const times = [...new Set([0.9, 2.6, ...Array.from({ length: 17 }, (_, i) => +(i * beats.bar + beats.bar * 0.75).toFixed(2)), ...beats.impacts.map(x => x + 0.25), beats.duration - 0.05])].sort((a, b) => a - b);
    const dir = path.join(out, 'sheet-' + tag); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
    for (const [i, t] of times.entries()) fs.writeFileSync(path.join(dir, String(i).padStart(2, '0') + '.png'), await frame(t));
    const tw = V ? 270 : 480, th = V ? 480 : 270, cols = V ? 8 : 6;
    const fontf = path.join(root, 'app/src/main/assets/www/fonts/InterVariable.ttf').replace(/\\/g, '/').replace(':', '\\:');
    const inputs = times.flatMap((_, i) => ['-i', path.join(dir, String(i).padStart(2, '0') + '.png')]);
    const lab = times.map((t, i) => `[${i}:v]scale=${tw}:${th},drawtext=fontfile='${fontf}':text='${t.toFixed(2)}':x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6[v${i}]`).join(';');
    const stack = times.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${times.length}:layout=` + times.map((_, i) => `${(i % cols) * tw}_${Math.floor(i / cols) * th}`).join('|') + ':fill=0x202020[o]';
    if (spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', lab + ';' + stack, '-map', '[o]', '-frames:v', '1', path.join(out, 'sheet-' + tag + '.png')], { stdio: 'inherit' }).status) throw new Error('sheet failed');
    console.log('sheet: out/sheet-' + tag + '.png (' + times.length + ' frames)');
  } else {
    const raw = path.join(out, 'launch.raw.wav'), wav = path.join(out, 'launch.wav');
    const probe = spawnSync('ffmpeg', ['-hide_banner', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
    const m = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf('{'), probe.stderr.lastIndexOf('}') + 1));
    const ln = `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
    if (spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', ln, '-ar', '48000', '-c:a', 'pcm_s24le', wav], { stdio: 'inherit' }).status) throw new Error('loudnorm failed');
    const total = Math.round(beats.duration * FPS), mp4 = path.join(out, 'orla-launch-' + tag + '.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-i', wav,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '5.1',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '256k', '-shortest', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
    const t0 = Date.now();
    for (let f = 0; f < total; f++) {
      const png = await frame(f / FPS);
      if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 150 === 0) console.log(`frame ${f}/${total} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    ff.stdin.end(); await done;
    console.log('film: out/orla-launch-' + tag + '.mp4 · ' + (fs.statSync(mp4).size / 1048576).toFixed(1) + ' MB');
  }
} finally { await browser.close(); server.close(); }
