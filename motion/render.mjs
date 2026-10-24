// Renders the orla intro (motion/RULES.md).
//   node render.mjs --sheet   one frame per beat, tiled into out/contact-sheet.png (look before rendering)
//   node render.mjs           full film: 3840×2160, 60 fps, H.264 yuv420p CRF 16, audio at -14 LUFS
// Needs the score first: node sound.mjs (writes out/score.raw.wav and beats.json).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..'), out = path.join(here, 'out');
const { chromium } = createRequire(path.join(root, 'tests', 'package.json'))('playwright');   // the repo's test browser
const beats = JSON.parse(fs.readFileSync(path.join(here, 'beats.json'), 'utf8'));
const FPS = 60, SCALE = 2, sheet = process.argv.includes('--sheet');
fs.mkdirSync(out, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({ channel: process.env.TEST_BROWSER_CHANNEL || 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: sheet ? 1 : SCALE });
  await page.addInitScript(b => { window.BEATS = b; }, beats);
  await page.goto('http://127.0.0.1:' + server.address().port + '/motion/intro.html');
  await page.evaluate(() => window.ready);
  const stage = page.locator('#stage');
  const frame = async (t) => { await page.evaluate(x => window.seek(x), t); return stage.screenshot({ type: 'png', animations: 'disabled' }); };

  if (sheet) {
    // one frame per beat, plus the first and last frame
    const times = [0, ...beats.grid, beats.duration];
    const dir = path.join(out, 'sheet'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
    for (const [i, t] of times.entries()) fs.writeFileSync(path.join(dir, String(i).padStart(2, '0') + '.png'), await frame(t));
    const cols = 4, rows = Math.ceil(times.length / cols);
    const label = times.map((t, i) => `[${i}:v]scale=640:360,drawtext=fontfile='${path.join(root, 'app/src/main/assets/www/fonts/InterVariable.ttf').replace(/\\/g, '/').replace(':', '\\:')}':text='${t.toFixed(2)} s':x=14:y=12:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.6[v${i}]`).join(';');
    const inputs = times.flatMap((_, i) => ['-i', path.join(dir, String(i).padStart(2, '0') + '.png')]);
    const stack = times.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${times.length}:layout=` +
      times.map((_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join('|') + `:fill=0x202020[o]`;
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', label + ';' + stack, '-map', '[o]', '-frames:v', '1', path.join(out, 'contact-sheet.png')], { stdio: 'inherit' });
    if (r.status) throw new Error('contact sheet failed');
    console.log('contact sheet: out/contact-sheet.png (' + times.length + ' frames, ' + cols + '×' + rows + ')');
  } else {
    // loudness to -14 LUFS / -1 dBTP (two-pass loudnorm), 48 kHz
    const raw = path.join(out, 'score.raw.wav'), wav = path.join(out, 'score.wav');
    const probe = spawnSync('ffmpeg', ['-hide_banner', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
    const m = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf('{'), probe.stderr.lastIndexOf('}') + 1));
    const ln = `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
    if (spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', ln, '-ar', '48000', '-c:a', 'pcm_s24le', wav], { stdio: 'inherit' }).status) throw new Error('loudnorm failed');

    const total = Math.round(beats.duration * FPS), mp4 = path.join(out, 'orla-intro-4k.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-i', wav,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '5.2',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', '256k', '-shortest', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
    const t0 = Date.now();
    for (let f = 0; f < total; f++) {
      const png = await frame(f / FPS);
      if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 30 === 0) process.stdout.write(`frame ${f}/${total} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
    }
    ff.stdin.end(); await done;
    console.log('film: out/orla-intro-4k.mp4 · ' + (fs.statSync(mp4).size / 1048576).toFixed(1) + ' MB · ' + total + ' frames');
  }
} finally { await browser.close(); server.close(); }
