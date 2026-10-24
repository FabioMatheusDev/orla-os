// Captures real orla UI screens ("plates") for the launch film, with an invented catalog:
// fictitious titles and posters drawn in code, so no studio artwork is used. The film then
// animates these still plates as a pure function of time (motion/RULES.md).
//   node motion/launch/capture.mjs        (build the app first: gradlew assembleDebug)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const www = path.join(root, 'app/build/generated/publicAssets/www'), out = path.join(here, 'plates');
const { chromium } = createRequire(path.join(root, 'tests', 'package.json'))('playwright');
const font = pathToFileURL(path.join(root, 'app/src/main/assets/www/fonts/InterVariable.ttf')).href;
fs.mkdirSync(out, { recursive: true });
// Real catalogue: TMDB with the key kept in .local/launch.env (git-ignored, never printed).
// Without it, the invented catalogue below is used.
const envFile = path.join(root, '.local/launch.env');
const TMDB_KEY = fs.existsSync(envFile) ? (fs.readFileSync(envFile, 'utf8').match(/TMDB_KEY=(\S+)/) || [])[1] : null;
const REAL = !!TMDB_KEY && process.env.FICTIONAL !== '1';
// Real app banners, read from the TV by Bridge.getArt (motion/launch/art/app-art.json); empty = plain tile.
const artFile = path.join(here, 'art/app-art.json');
const APP_ART = REAL && fs.existsSync(artFile) ? JSON.parse(fs.readFileSync(artFile, 'utf8')) : {};

// ---- the invented catalog ----
const M = (id, title, year, vote, genre, tone, motif, overview) => ({ id, title, year, vote, genre, tone, motif, overview });
const MOVIES = [
  M(9101, 'Maré Alta', 2026, 8.1, 'Drama', ['#0E3B5C', '#F2A65A'], 'sun', 'Numa cidade do litoral engolida pelo mar, uma salva-vidas tem uma última noite para tirar a família da ilha antes da maior maré do século.'),
  M(9102, 'O Último Farol', 2026, 7.6, 'Suspense', ['#101820', '#E8D9A8'], 'beam', 'O faroleiro de uma ilha isolada começa a receber sinais de luz vindos de um navio que afundou há quarenta anos.'),
  M(9103, 'Cidade de Vidro', 2025, 7.9, 'Ficção científica', ['#0B2230', '#7FE3F0'], 'towers', 'Em 2091, uma engenheira descobre que os prédios transparentes da capital escondem o que a cidade mais quer esquecer.'),
  M(9104, 'Brasa', 2026, 7.2, 'Ação', ['#2A0B08', '#FF6A2B'], 'fire', 'Uma brigadista e um piloto de helicóptero enfrentam o maior incêndio da história do cerrado.'),
  M(9105, 'Noite Polar', 2025, 8.3, 'Mistério', ['#06121F', '#9BC7FF'], 'aurora', 'Seis meses sem sol numa estação científica, e um dos pesquisadores desaparece sem deixar pegadas na neve.'),
  M(9106, 'Linha de Fuga', 2026, 7.0, 'Ação', ['#14161C', '#D7263D'], 'rails', 'Um maquinista tem duas horas para atravessar o país num trem que não pode parar.'),
  M(9107, 'Órbita', 2026, 7.8, 'Ficção científica', ['#05070D', '#C9E4FF'], 'planet', 'Presa sozinha numa estação em órbita, uma astronauta precisa decidir quem da tripulação ainda pode voltar.'),
  M(9108, 'Sal e Pedra', 2025, 7.4, 'Drama', ['#3A2E25', '#EDE3D1'], 'dunes', 'Duas irmãs voltam às salinas da infância para vender a terra da família e reencontram o que deixaram para trás.')
];
const SHOWS = [
  M(9201, 'Horizonte Zero', 2026, 8.4, 'Ficção científica', ['#071A2B', '#5FA8F5'], 'horizon', 'A primeira colônia humana fora da Terra perde o contato com o planeta, e ninguém sabe quem cortou o sinal.'),
  M(9202, 'Os Herdeiros do Porto', 2025, 7.7, 'Drama', ['#1B2A24', '#D9B26A'], 'ship', 'Três gerações de uma família disputam o controle do maior porto do país.'),
  M(9203, 'Fronteira Norte', 2026, 8.0, 'Policial', ['#0F1A12', '#8FD694'], 'forest', 'Uma delegada recém-chegada à Amazônia investiga um desaparecimento que ninguém na cidade quer resolver.'),
  M(9204, 'A Casa das Ondas', 2026, 7.5, 'Comédia', ['#0A3D5C', '#FFD27A'], 'waves', 'Cinco amigos herdam uma pousada caindo aos pedaços na praia mais bonita do sul.'),
  M(9205, 'Ecos', 2025, 8.2, 'Suspense', ['#120E1E', '#B48CFF'], 'rings', 'Um técnico de som começa a ouvir, nas gravações antigas de uma rádio, vozes que ainda não falaram.'),
  M(9206, 'Vento Sul', 2026, 7.3, 'Drama', ['#1E2630', '#A3C4DC'], 'wind', 'No extremo sul, uma família de pescadores enfrenta o inverno mais longo em décadas.'),
  M(9207, 'Constelação', 2026, 7.9, 'Romance', ['#090B1A', '#F5D0FE'], 'stars', 'Dois astrônomos rivais disputam a mesma descoberta, e o mesmo céu.')
];
const ALL = [...MOVIES, ...SHOWS];
const byId = Object.fromEntries(ALL.map(x => [x.id, x]));
const CAST = ['Helena Duarte', 'Rafael Moura', 'Iara Campos', 'Bruno Teles', 'Lívia Sampaio', 'Caio Rangel', 'Marta Quintela', 'Otávio Lins'];
const ROLES = ['Lúcia', 'Tomás', 'Nara', 'Elias', 'Vera', 'Joaquim', 'Dona Célia', 'Artur'];

// ---- poster / backdrop art, drawn on a canvas page and served for image.tmdb.org paths ----
const artPage = `<!doctype html><html><head><style>@font-face{font-family:Inter;src:url(/fonts/InterVariable.ttf);font-weight:100 900}</style></head><body><canvas id=c></canvas><script>
function rnd(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
window.draw=async function(o){await document.fonts.load('800 80px Inter');const c=document.getElementById('c');c.width=o.w;c.height=o.h;const x=c.getContext('2d'),W=o.w,H=o.h,r=rnd(o.id),[a,b]=o.tone;
const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,a);g.addColorStop(1,'#05070A');x.fillStyle=g;x.fillRect(0,0,W,H);
const cx=W*(0.35+r()*0.3),cy=H*(o.poster?0.42:0.5);x.save();
const glow=(R,al)=>{const rg=x.createRadialGradient(cx,cy,0,cx,cy,R);rg.addColorStop(0,b);rg.addColorStop(1,'transparent');x.globalAlpha=al;x.fillStyle=rg;x.fillRect(0,0,W,H);x.globalAlpha=1};
const m=o.motif;glow(Math.max(W,H)*0.55,0.55);
x.fillStyle=b;x.strokeStyle=b;
if(m==='sun'||m==='planet'){x.beginPath();x.arc(cx,cy,W*0.18,0,7);x.fill();x.fillStyle='#05070A';x.fillRect(0,cy+W*0.02,W,H)}
if(m==='beam'){x.globalAlpha=.5;x.beginPath();x.moveTo(cx,cy);x.lineTo(W,cy-H*.25);x.lineTo(W,cy+H*.05);x.fill();x.globalAlpha=1;x.fillStyle='#0A0D12';x.fillRect(cx-W*.03,cy,W*.06,H)}
if(m==='towers'){for(let i=0;i<9;i++){const w=W*(.06+r()*.07),h=H*(.25+r()*.45),px=r()*W;x.globalAlpha=.35+r()*.4;x.fillRect(px,H-h,w,h)}x.globalAlpha=1}
if(m==='fire'){for(let i=0;i<40;i++){x.globalAlpha=r()*.5;x.beginPath();x.arc(r()*W,H*(.55+r()*.45),W*(.02+r()*.1),0,7);x.fill()}x.globalAlpha=1}
if(m==='aurora'||m==='wind'){x.lineWidth=W*.012;for(let i=0;i<6;i++){x.globalAlpha=.25+r()*.4;x.beginPath();for(let t=0;t<=1.01;t+=.02){const px=t*W,py=H*(.2+i*.06)+Math.sin(t*6+i)*H*.05;t?x.lineTo(px,py):x.moveTo(px,py)}x.stroke()}x.globalAlpha=1}
if(m==='rails'){x.lineWidth=W*.01;x.beginPath();x.moveTo(W*.1,H);x.lineTo(cx,cy);x.lineTo(W*.9,H);x.stroke()}
if(m==='dunes'||m==='horizon'||m==='waves'){for(let i=0;i<4;i++){x.globalAlpha=.2+i*.2;x.beginPath();x.moveTo(0,H);for(let t=0;t<=1.01;t+=.02)x.lineTo(t*W,H*(.62+i*.09)+Math.sin(t*(m==='waves'?14:4)+i*2)*H*.03);x.lineTo(W,H);x.fill()}x.globalAlpha=1}
if(m==='ship'){x.fillStyle='#0A0D12';x.beginPath();x.moveTo(W*.2,H*.62);x.lineTo(W*.8,H*.62);x.lineTo(W*.7,H*.7);x.lineTo(W*.3,H*.7);x.fill();x.fillRect(W*.45,H*.4,W*.03,H*.22)}
if(m==='forest'){x.fillStyle='#050A07';for(let i=0;i<22;i++){const px=r()*W,h=H*(.25+r()*.3);x.beginPath();x.moveTo(px,H-h);x.lineTo(px-W*.06,H);x.lineTo(px+W*.06,H);x.fill()}}
if(m==='rings'){x.lineWidth=W*.006;for(let i=1;i<8;i++){x.globalAlpha=1-i/8;x.beginPath();x.arc(cx,cy,W*.05*i,0,7);x.stroke()}x.globalAlpha=1}
if(m==='stars'){for(let i=0;i<160;i++){x.globalAlpha=r();x.fillRect(r()*W,r()*H*.8,W*.004,W*.004)}x.globalAlpha=1}
x.restore();
const v=x.createLinearGradient(0,H*.5,0,H);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.75)');x.fillStyle=v;x.fillRect(0,0,W,H);
if(o.poster){x.fillStyle='#F2F4F6';x.textAlign='center';let fs=W*.13;x.font='800 '+fs+'px Inter';const t=o.title.toUpperCase();while(x.measureText(t).width>W*.86&&fs>10){fs-=2;x.font='800 '+fs+'px Inter'}
x.fillText(t,W/2,H*.86);x.font='600 '+W*.04+'px Inter';x.globalAlpha=.75;x.fillText('EM BREVE',W/2,H*.93);x.globalAlpha=1}
return c.toDataURL('image/jpeg',.9).split(',')[1]}
</script></body></html>`;

const art = {};
async function makeArt(browser) {
  const p = await browser.newPage();
  const url = 'http://127.0.0.1:' + server.address().port + '/__art.html';
  await p.route(url, r => r.fulfill({ status: 200, contentType: 'text/html', body: artPage }));
  await p.goto(url);
  for (const t of ALL) {
    art['/p' + t.id + '.jpg'] = Buffer.from(await p.evaluate(o => window.draw(o), { ...t, w: 500, h: 750, poster: true }), 'base64');
    art['/b' + t.id + '.jpg'] = Buffer.from(await p.evaluate(o => window.draw(o), { ...t, w: 1280, h: 720, poster: false }), 'base64');
  }
  for (let i = 0; i < CAST.length; i++) art['/c' + i + '.jpg'] = Buffer.from(await p.evaluate(o => window.draw(o), { id: 50 + i, tone: ['#2A3140', '#A3ABB5'], motif: 'sun', w: 185, h: 278, poster: false }), 'base64');
  await p.close();
}

// ---- TMDB-shaped fixtures ----
const tmdb = (t, type) => ({ id: t.id, [type === 'tv' ? 'name' : 'title']: t.title, [type === 'tv' ? 'original_name' : 'original_title']: t.title,
  overview: t.overview, [type === 'tv' ? 'first_air_date' : 'release_date']: t.year + '-03-14', poster_path: '/p' + t.id + '.jpg',
  backdrop_path: '/b' + t.id + '.jpg', vote_average: t.vote, vote_count: 900, media_type: type, genre_ids: [18] });
async function real(provider, p, params) {
  if (provider !== 'tmdb') return { ratings: [] };                      // no MDBList key: no invented ratings
  const q = new URLSearchParams(Object.assign({ language: 'pt-BR', region: 'BR' }, params, { api_key: TMDB_KEY }));
  const r = await fetch('https://api.themoviedb.org/3' + p + '?' + q);
  return r.json();
}
function respond(provider, p, params) {
  if (provider === 'mdblist') return { ratings: [{ source: 'imdb', value: 8.2, score: 82 }, { source: 'tomatoes', value: 91, score: 91 }] };
  if (p.startsWith('/genre/')) return { genres: [{ id: 18, name: 'Drama' }, { id: 28, name: 'Ação' }, { id: 878, name: 'Ficção científica' }] };
  if (p.endsWith('/watch/providers')) return { results: { BR: { flatrate: [{ provider_id: 8, provider_name: 'Netflix' }] } } };
  const d = p.match(/^\/(movie|tv)\/(\d+)$/);
  if (d) {
    const type = d[1], t = byId[+d[2]] || ALL[0];
    return Object.assign(tmdb(t, type), { genres: [{ id: 1, name: t.genre }], runtime: 118, number_of_seasons: type === 'tv' ? 2 : undefined, number_of_episodes: type === 'tv' ? 16 : undefined,
      status: 'Released', original_language: 'pt', origin_country: ['BR'],
      credits: { cast: CAST.slice(0, 6).map((n, i) => ({ id: i + 1, name: n, character: ROLES[i], profile_path: '/c' + i + '.jpg' })), crew: [{ job: 'Director', name: 'Ana Prado' }] },
      'watch/providers': { results: { BR: { flatrate: [{ provider_id: 8, provider_name: 'Netflix' }, { provider_id: 9, provider_name: 'Prime Video' }] } } },
      recommendations: { results: ALL.filter(x => x.id !== t.id).slice(0, 4).map(x => tmdb(x, x.id > 9200 ? 'tv' : 'movie')) },
      videos: { results: [{ site: 'YouTube', type: 'Trailer', key: 'fixture1' }] }, content_ratings: { results: [{ iso_3166_1: 'BR', rating: '14' }] },
      release_dates: { results: [{ iso_3166_1: 'BR', release_dates: [{ certification: '14' }] }] } });
  }
  const tv = p.includes('/tv');
  const list = tv ? SHOWS : MOVIES, shift = p.includes('discover') ? 3 : 0;
  return { results: [...list.slice(shift), ...list.slice(0, shift)].map(x => tmdb(x, tv ? 'tv' : 'movie')), total_pages: 1, page: 1 };
}

// ---- weather and coins fixtures ----
const hours = Array.from({ length: 48 }, (_, i) => '2026-10-24T' + String(i % 24).padStart(2, '0') + ':00');
const weather = { current: { time: '2026-10-24T20:00', temperature_2m: 31, weather_code: 1, is_day: 0 },
  hourly: { time: hours, temperature_2m: hours.map((_, i) => 31 - (i % 24 > 20 ? 1 : 0)), weather_code: hours.map(() => 1), is_day: hours.map((_, i) => (i % 24 >= 6 && i % 24 < 18) ? 1 : 0) },
  daily: { time: ['2026-10-24', '2026-10-25'], temperature_2m_max: [37, 36], temperature_2m_min: [24, 23], sunrise: ['2026-10-24T05:20', '2026-10-25T05:19'], sunset: ['2026-10-24T18:01', '2026-10-25T18:02'] } };
const coins = [{ symbol: 'BTCBRL', lastPrice: '402150', priceChangePercent: '1.8' }, { symbol: 'ETHBRL', lastPrice: '11870', priceChangePercent: '2.4' }];

const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.resolve(www, '.' + (new URL(req.url, 'http://x').pathname === '/' ? '/index.html' : new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(www + path.sep) || !fs.existsSync(f)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({ channel: process.env.TEST_BROWSER_CHANNEL || 'chrome', headless: true });
try {
  if (!REAL) await makeArt(browser);
  console.log(REAL ? 'catalogue: TMDB (real)' : 'catalogue: invented');
  async function session(visual) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
    await page.clock.install({ time: new Date('2026-10-24T20:30:00-04:00') });
    await page.route('https://**/*', route => {
      const u = new URL(route.request().url());
      const cors = { 'Access-Control-Allow-Origin': '*' };
      if (u.hostname === 'image.tmdb.org' && REAL) return route.continue();
      if (u.hostname === 'image.tmdb.org') { const k = '/' + u.pathname.split('/').pop(); return route.fulfill({ status: 200, contentType: 'image/jpeg', headers: cors, body: art[k] || art['/b9101.jpg'] }); }
      if (u.hostname.includes('open-meteo')) return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(weather) });
      if (u.hostname.includes('binance')) return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(coins) });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: '{}' });
    });
    await page.exposeFunction('__fixture', (provider, p, raw) => (REAL ? real : respond)(provider, p, JSON.parse(raw || '{}')));
    await page.addInitScript(({ v, appArt }) => {
      localStorage.setItem('visual', v);
      window.Android = {
        uiSoundsEnabled: () => false, setUiSoundsEnabled() {}, playUiSound() {}, introEnabled: () => true, setIntroEnabled() {},
        getApps: () => JSON.stringify([['com.netflix.ninja', 'Netflix'], ['com.amazon.firetv.youtube', 'YouTube'], ['com.amazon.firebat', 'Prime Video'],
          ['com.hbo.hbonow', 'Max'], ['com.spotify.tv.android', 'Spotify'], ['com.crunchyroll.crunchyroid', 'Crunchyroll'], ['com.apple.atve.amazon.appletv', 'Apple TV'],
          ['com.amazon.venezia', 'Appstore'], ['com.google.android.tv', 'Live Channels']].map(([pkg, label]) => ({ pkg, label }))),
        getArt: (pkg) => appArt[pkg] || '', launch: () => true, homeStatus: () => '{"redirect":true,"service":true}', setRedirect() {},
        liveTvPackage: () => 'com.google.android.tv', openLiveTv: () => true, openSetting: () => true,
        catalogStatus: () => '{"tmdb":true,"mdblist":true}', openCatalogSettings() {},
        catalogRequest(id, provider, p, raw) { window.__fixture(provider, p, raw).then(data => setTimeout(() => window.CatalogNative.receive(id, { ok: true, data, headers: {}, cached: false, stale: false }), 10)); }
      };
    }, { v: visual, appArt: APP_ART });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => document.querySelector('#hTitle') && document.querySelector('#hTitle').textContent.length > 0);
    await page.waitForTimeout(1500);
    return page;
  }
  const shot = async (page, name) => { await page.waitForTimeout(900); await page.locator('#stage').screenshot({ path: path.join(out, name + '.png') }); console.log('plate', name); };
  const key = async (page, k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(260); } };

  const g = await session('glass');
  await shot(g, 'home');                                   // hero focused (Detalhes)
  await key(g, 'ArrowRight'); await shot(g, 'home2');       // next title becomes the hero
  await key(g, 'ArrowRight'); await shot(g, 'home3');
  await key(g, 'ArrowLeft', 2); await key(g, 'ArrowDown'); await key(g, 'ArrowRight', 2); await shot(g, 'dock');
  await g.evaluate(() => window.tvKey('longok')); await shot(g, 'move');
  await key(g, 'ArrowRight'); await shot(g, 'move2');
  await key(g, 'Escape'); await key(g, 'ArrowLeft', 2);
  await g.evaluate(() => window.tvKey('menu')); await shot(g, 'drawer');
  await g.evaluate(() => window.tvKey('back'));
  await g.evaluate(() => window.tvKey('home')); await key(g, 'ArrowRight'); await key(g, 'Enter'); await g.waitForSelector('#dCast .person'); await g.waitForTimeout(2500); await shot(g, 'details');   // a title on a streaming service
  await key(g, 'Escape'); await g.evaluate(() => window.tvKey('home'));
  await g.evaluate(() => document.querySelector('#btnAll').click()); await shot(g, 'allapps');
  await g.evaluate(() => window.tvKey('back'));
  await g.evaluate(() => document.querySelector('#btnSettings').click()); await shot(g, 'settings');
  await g.evaluate(() => window.tvKey('back')); await g.evaluate(() => window.tvKey('home'));
  await key(g, 'ArrowDown', 3); await key(g, 'ArrowDown'); await key(g, 'ArrowRight', 2); await shot(g, 'rows');
  await g.evaluate(() => window.tvKey('home'));
  await g.evaluate(() => document.querySelector('#browseAll') && document.querySelector('#browseAll').click()); await g.waitForSelector('#catalogGrid .catalog-card'); await key(g, 'ArrowDown'); await key(g, 'ArrowRight'); await shot(g, 'explore');
  await g.close();
  const s = await session('solid');
  await key(s, 'ArrowRight'); await shot(s, 'home-solid');
  await s.close();
} finally { await browser.close(); server.close(); }
