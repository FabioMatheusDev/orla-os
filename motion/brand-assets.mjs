// App icon and TV banner for orla, drawn from the brand canvas (Inter 800, light from above,
// ice glow at the top left) and saved straight into the app's drawables.
//   node brand-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..');
const { chromium } = createRequire(path.join(root, 'tests', 'package.json'))('playwright');
const font = pathToFileURL(path.join(root, 'app/src/main/assets/www/fonts/InterVariable.ttf')).href;
const res = path.join(root, 'app/src/main/res');

// w, h, word size, glow; file under res/
const assets = [
  { file: 'drawable-xhdpi/banner.png', w: 640, h: 360, size: 168, glow: 'radial-gradient(60% 90% at 20% 15%, rgba(143,199,255,0.30) 0%, rgba(143,199,255,0) 65%)' },
  { file: 'drawable-xxxhdpi/ic_launcher.png', w: 192, h: 192, size: 56, radius: 44, glow: 'radial-gradient(70% 70% at 22% 18%, rgba(143,199,255,0.28) 0%, rgba(143,199,255,0) 60%)' }
];
const html = (a) => `<!doctype html><html><head><style>
@font-face { font-family: Inter; src: url(${font}); font-weight: 100 900; }
html, body { margin: 0; background: transparent; }
#a { position: relative; width: ${a.w}px; height: ${a.h}px; overflow: hidden; background: ${a.glow}, #07090C;
  border-radius: ${a.radius || 0}px; display: flex; align-items: center; justify-content: center; }
#a::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(0deg, rgba(0,0,0,0.3), rgba(0,0,0,0) 50%); }
span { position: relative; z-index: 1; font: 800 ${a.size}px/1 Inter; letter-spacing: -0.05em;
  background: linear-gradient(180deg, #FFFFFF 0%, #F2F4F6 45%, #BFDDFF 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
</style></head><body><div id="a"><span>orla</span></div></body></html>`;

const browser = await chromium.launch({ channel: process.env.TEST_BROWSER_CHANNEL || 'chrome', headless: true });
try {
  for (const a of assets) {
    const page = await browser.newPage({ viewport: { width: a.w, height: a.h }, deviceScaleFactor: 1 });
    await page.setContent(html(a));
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(res, a.file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.locator('#a').screenshot({ path: out, omitBackground: true });
    console.log(a.file, a.w + '×' + a.h);
    await page.close();
  }
} finally { await browser.close(); }
