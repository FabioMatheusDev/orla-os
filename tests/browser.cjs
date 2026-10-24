'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../app/build/generated/publicAssets/www');
const output = path.resolve(__dirname, '../.local/home-tv-byok-tests');
fs.mkdirSync(output, { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + (new URL(req.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.env.TEST_BROWSER_CHANNEL || 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const failures = []; page.on('pageerror', e => failures.push(e.message));
    await page.route('https://**/*', route => route.fulfill({ status: 200, contentType: route.request().resourceType() === 'image' ? 'image/png' : 'application/json', body: route.request().resourceType() === 'image' ? Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64') : route.request().url().includes('binance') ? '[]' : '{}' }));
    await page.addInitScript(() => {
      localStorage.setItem('visual', 'solid');
      const movie = { id: 550, title: 'Clube da Luta', original_title: 'Fight Club', overview: 'Uma sinopse longa para verificar a área de leitura sem sobrepor as ações. '.repeat(12), release_date: '1999-10-15', poster_path: '/poster.jpg', backdrop_path: '/backdrop.jpg', vote_average: 8.4, vote_count: 1000 };
      const show = { id: 1396, name: 'Breaking Bad', original_name: 'Breaking Bad', overview: 'Sinopse de teste de série', first_air_date: '2008-01-20', poster_path: '/show.jpg', backdrop_path: '/show-backdrop.jpg', vote_average: 8.9, vote_count: 1000 };
      window.Android = {
        uiSoundsEnabled: () => true,
        setUiSoundsEnabled: enabled => { window.soundPreference = enabled; },
        playUiSound: effect => { (window.soundEvents || (window.soundEvents = [])).push(effect); },
        getApps: () => JSON.stringify([{ pkg: 'com.netflix.ninja', label: 'Netflix' }, { pkg: 'com.amazon.firebat', label: 'Prime Video' }, { pkg: 'com.google.android.tv', label: 'Live Channels' }]),
        liveTvPackage: () => 'com.google.android.tv',
        openLiveTv: () => { window.liveTvOpened = true; return true; },
        getArt: () => '', homeStatus: () => '{"redirect":true,"service":true}', launch: () => true,
        openCatalogSettings: () => { window.settingsOpened = true; },
        catalogStatus: () => '{"tmdb":true,"mdblist":true}',
        catalogRequest(id, provider, requestPath, raw) {
          const params = JSON.parse(raw); let data;
          if (provider === 'mdblist' && requestPath.startsWith('/lists/')) {
            const tv = params.mediatype === 'show'; data = { movies: tv ? [] : [{ id: 550, ids: { tmdb: 550 }, title: 'Clube da Luta' }], shows: tv ? [{ id: 1396, ids: { tmdb: 1396 }, title: 'Breaking Bad' }] : [], pagination: { has_more: true, next_cursor: 'opaque' } };
          } else if (provider === 'mdblist') data = { ratings: [{ source: 'imdb', value: 8.8, score: 88 }, { source: 'tomatoes', value: 81, score: 81 }] };
          else if (requestPath.endsWith('/watch/providers')) data = { results: { BR: { flatrate: [{ provider_id: 8, provider_name: 'Netflix' }] } } };
          else if (requestPath.includes('/season/')) data = { name: 'Temporada 1', episodes: [{ id: 1, episode_number: 1, name: 'Piloto', overview: 'Sinopse do episódio', air_date: '2008-01-20', runtime: 58 }] };
          else if (requestPath.startsWith('/genre/')) data = { genres: requestPath.includes('/movie/') ? [{ id: 18, name: 'Drama' }, { id: 27, name: 'Terror' }, { id: 28, name: 'Ação' }, { id: 9648, name: 'Mistério' }] : [{ id: 18, name: 'Drama' }, { id: 10759, name: 'Ação e aventura' }, { id: 9648, name: 'Mistério' }] };
          else if (/^\/(movie|tv)\/\d+$/.test(requestPath)) {
            const tv = requestPath.startsWith('/tv/'); data = Object.assign({}, tv ? show : movie, { genres: [{ id: 18, name: 'Drama' }], runtime: 139, number_of_seasons: tv ? 1 : undefined, number_of_episodes: tv ? 1 : undefined, seasons: tv ? [{ season_number: 1, name: 'Temporada 1' }] : [], credits: { cast: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: 'Pessoa do elenco ' + (i + 1), character: 'Personagem ' + (i + 1) })), crew: [] }, 'watch/providers': { results: { BR: { flatrate: ['Netflix', 'Prime Video', 'Apple TV', 'Disney Plus', 'HBO Max', 'Crunchyroll'].map((name, i) => ({ provider_id: i + 1, provider_name: name })) } } }, recommendations: { results: [] }, videos: { results: [{ site: 'YouTube', type: 'Trailer', key: 'fixture' }] } });
          } else data = { results: [Object.assign({}, requestPath.includes('tv') ? show : movie, { media_type: requestPath.includes('tv') ? 'tv' : 'movie' })], total_pages: 2 };
          setTimeout(() => window.CatalogNative.receive(id, { ok: true, data, headers: { 'x-has-more': 'true' }, cached: false, stale: false }), 15);
        }
      };
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => document.querySelector('#hTitle').textContent === 'Clube da Luta');
    await page.waitForFunction(() => document.activeElement.id === 'hInfo');
    assert.equal(await page.locator('#hero .acts button').count(), 1);
    assert.equal(await page.locator('#home #updated').count(), 0);
    await page.waitForFunction(() => { const logo = document.querySelector('#dock img[alt="Netflix"]'); return logo && logo.complete && logo.naturalWidth === 1600; });
    const colors = await page.locator('#hInfo').evaluate(el => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
    assert.equal(colors.background, 'rgb(242, 244, 246)'); assert.equal(colors.color, 'rgb(7, 9, 12)');
    await page.keyboard.press('Enter'); await page.waitForFunction(() => document.body.classList.contains('det-open'));
    await page.waitForFunction(() => document.querySelector('#dRates').textContent.includes('IMDb'));
    assert((await page.locator('#dRates').textContent()).includes('8,8/10'));
    await page.waitForSelector('#dCast .person');
    const layout = await page.evaluate(() => {
      const content = document.querySelector('.d-content'), actions = document.querySelector('.d-acts');
      return { contentBottom: content.getBoundingClientRect().bottom, actionsTop: actions.getBoundingClientRect().top,
        favoriteBottom: document.querySelector('#dFav').getBoundingClientRect().bottom, mainBottom: document.querySelector('.d-main').getBoundingClientRect().bottom };
    });
    assert(layout.contentBottom + 12 <= layout.actionsTop);
    assert(layout.favoriteBottom < layout.mainBottom);
    const synopsis = await page.locator('#dOv').evaluate(el => ({ height: el.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(el).lineHeight), clamp: getComputedStyle(el).webkitLineClamp }));
    assert.equal(synopsis.clamp, 'none'); assert(synopsis.height > synopsis.lineHeight * 3);
    assert.equal(await page.locator('#dCast .person').count(), 6);
    assert(await page.locator('#dOpen').isVisible()); assert(await page.locator('#dTrailer').isVisible());
    await page.locator('#dFav').click(); assert.equal(await page.locator('#dFavTxt').textContent(), 'Favoritado');
    assert.equal(await page.locator('#dFav svg').evaluate(el => getComputedStyle(el).fill), 'rgb(229, 9, 20)');
    await page.keyboard.press('ArrowUp'); await page.waitForFunction(() => document.activeElement.hasAttribute('data-scroll'));
    await page.keyboard.press('ArrowDown'); assert((await page.locator('.d-content').evaluate(el => el.scrollTop)) > 0);
    await page.screenshot({ path: path.join(output, 'solid-details.png') });
    await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => document.activeElement.id), 'hInfo');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement.id === 'browseAll');
    const appShadows = await page.locator('#dock .app').evaluateAll(elements => elements.map(el => getComputedStyle(el).boxShadow));
    assert(appShadows.every(shadow => shadow !== 'none'));
    await page.keyboard.press('Enter'); await page.waitForSelector('#catalogGrid .catalog-card');
    await page.keyboard.press('Enter'); await page.waitForFunction(() => document.body.classList.contains('det-open'));
    await page.keyboard.press('Escape'); assert(await page.evaluate(() => document.activeElement.classList.contains('catalog-card')));
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelector('#browseShows').click()); await page.waitForSelector('#catalogGrid .catalog-card');
    await page.keyboard.press('Enter'); await page.waitForFunction(() => document.querySelector('#dSeasons').style.display !== 'none');
    await page.locator('#dSeasons').click(); await page.waitForSelector('#episodeList .episode');
    assert((await page.locator('#episodeList').textContent()).includes('Piloto'));
    await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => document.activeElement.id), 'dSeasons');
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.evaluate(() => window.tvKey('home'));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('catalogquota', { detail: { resetAt: Date.now() + 3600000 } })));
    await page.waitForSelector('#toast.quota.show');
    assert((await page.locator('#toastTxt').textContent()).includes('Limite diário do MDBList atingido'));
    await page.evaluate(() => document.querySelector('#toast').classList.remove('show'));
    const headerFits = await page.evaluate(() => document.querySelector('.tabs').getBoundingClientRect().right < document.querySelector('#btnFavorites').getBoundingClientRect().left && document.querySelector('#btnFavorites').getBoundingClientRect().right < document.querySelector('.top-right .pill').getBoundingClientRect().left);
    assert(headerFits);
    await page.locator('#btnFavorites').click(); await page.waitForSelector('#catalogGrid .catalog-card');
    assert.equal(await page.locator('#catalogTitle').textContent(), 'Minha lista');
    await page.keyboard.press('Enter'); await page.waitForFunction(() => document.body.classList.contains('det-open'));
    assert.equal(await page.locator('#dFav').getAttribute('aria-pressed'), 'true');
    await page.locator('#dFav').click(); assert.equal(await page.locator('#dFav svg').evaluate(el => getComputedStyle(el).fill), 'none');
    await page.keyboard.press('Escape'); await page.waitForFunction(() => document.querySelectorAll('#catalogGrid .catalog-card').length === 0);
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.tvKey('home'));
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('#hInfoTxt').textContent === 'Explorar mais');
    await page.keyboard.press('Enter'); await page.waitForFunction(() => document.querySelectorAll('#catalogGrid .catalog-card').length === 2);
    assert.equal(await page.locator('#catalogType').textContent(), 'Tipo: ambos');
    await page.evaluate(() => {
      const grid = document.querySelector('#catalogGrid');
      window.originalCatalogCards = Array.from(grid.children);
      for (let i = 2; i < 40; i++) { const clone = window.originalCatalogCards[i % 2].cloneNode(true); clone.classList.remove('focus'); clone.dataset.ci = i; grid.appendChild(clone); }
    });
    const selectedCard = () => page.evaluate(() => Array.from(document.querySelectorAll('#catalogGrid .catalog-card')).indexOf(document.activeElement));
    for (const theme of ['solid', 'glass']) {
      await page.evaluate(theme => document.body.classList.toggle('solid', theme === 'solid'), theme);
      if ((await selectedCard()) < 0) await page.keyboard.press('ArrowDown');
      assert.equal(await selectedCard(), 0);
      for (let row = 1; row <= 6; row++) { await page.keyboard.press('ArrowDown'); assert.equal(await selectedCard(), row * 6); }
      assert((await page.locator('#catalogGrid').evaluate(el => el.scrollTop)) > 0);
      await page.keyboard.press('ArrowDown'); assert.equal(await page.evaluate(() => document.activeElement.id), 'catalogNext');
      await page.keyboard.press('ArrowUp'); assert.equal(await selectedCard(), 36);
      for (let row = 5; row >= 0; row--) { await page.keyboard.press('ArrowUp'); assert.equal(await selectedCard(), row * 6); }
      await page.keyboard.press('ArrowUp'); assert.equal(await page.evaluate(() => document.activeElement.id), 'catalogType');
    }
    await page.keyboard.press('ArrowDown');
    for (let col = 0; col < 5; col++) await page.keyboard.press('ArrowRight');
    for (let row = 0; row < 6; row++) await page.keyboard.press('ArrowDown');
    assert.equal(await selectedCard(), 39);
    await page.keyboard.press('ArrowRight'); assert.equal(await selectedCard(), 39);
    for (const index of [33, 27, 21, 15, 9, 3]) { await page.keyboard.press('ArrowUp'); assert.equal(await selectedCard(), index); }
    await page.keyboard.press('ArrowUp'); assert.equal(await page.evaluate(() => document.activeElement.id), 'catalogType');
    await page.screenshot({ path: path.join(output, 'explore-glass-grid.png') });
    await page.evaluate(() => { document.body.classList.add('solid'); document.querySelector('#catalogGrid').replaceChildren(...window.originalCatalogCards); delete window.originalCatalogCards; });
    const gridFits = await page.evaluate(() => {
      document.querySelector('#catalogGrid .title').textContent = 'Um título muito longo '.repeat(12);
      const grid = document.querySelector('#catalogGrid').getBoundingClientRect();
      return Array.from(document.querySelectorAll('#catalogGrid .catalog-card')).every(card => card.getBoundingClientRect().right <= grid.right + 1);
    });
    assert(gridFits);
    for (const theme of ['glass', 'solid']) {
      await page.evaluate(theme => document.body.classList.toggle('solid', theme === 'solid'), theme);
      for (const filter of ['catalogType', 'catalogGenre', 'catalogSort', 'catalogCollection', 'catalogYear']) {
        await page.locator('#' + filter).click();
        await page.waitForSelector('#catalogChooser [data-choice].focus');
        await page.waitForTimeout(230);
        const fits = () => page.evaluate(() => {
          const list = document.querySelector('.catalog-options').getBoundingClientRect();
          const item = document.querySelector('#catalogChooser [data-choice].focus').getBoundingClientRect();
          return item.left >= list.left + 2 && item.right <= list.right - 2 && item.top >= list.top + 2 && item.bottom <= list.bottom - 2;
        });
        await page.screenshot({ path: path.join(output, 'picker-' + filter + '-' + theme + '.png') });
        assert(await fits(), filter + ': focused option must fit inside its scroll viewport');
        if (filter === 'catalogYear') {
          const count = await page.locator('#catalogChooser [data-choice]').count();
          for (let index = 1; index < count; index++) {
            await page.keyboard.press('ArrowDown');
            assert.equal(await page.evaluate(() => Number(document.activeElement.dataset.choice)), index, 'year list must not skip offscreen options');
            assert(await fits(), 'scrolled year focus must remain fully visible');
          }
          await page.screenshot({ path: path.join(output, 'picker-year-bottom-' + theme + '.png') });
          await page.keyboard.press('ArrowDown');
          assert.equal(await page.evaluate(() => document.activeElement.id), 'choiceBack');
          await page.keyboard.press('ArrowUp');
          assert.equal(await page.evaluate(() => Number(document.activeElement.dataset.choice)), count - 1);
          for (let index = count - 2; index >= 0; index--) {
            await page.keyboard.press('ArrowUp');
            assert.equal(await page.evaluate(() => Number(document.activeElement.dataset.choice)), index);
            assert(await fits(), 'upward scrolling must keep the whole focus visible');
          }
          await page.keyboard.press('ArrowUp');
          assert.equal(await page.evaluate(() => Number(document.activeElement.dataset.choice)), 0);
        }
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => document.activeElement.id), filter);
      }
    }
    await page.locator('#catalogGenre').click(); await page.getByRole('button', { name: 'Terror', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('#catalogGrid .catalog-card').length === 1);
    await page.locator('#catalogType').click(); await page.locator('#catalogChooser').getByRole('button', { name: 'Séries', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#catalogType').textContent === 'Tipo: Séries' && document.querySelectorAll('#catalogGrid .catalog-card').length === 1);
    await page.locator('#catalogType').click();
    assert.equal(await page.evaluate(() => window.soundEvents.at(-1)), 'click');
    assert.equal(await page.locator('#catalogChooser [aria-pressed="true"]').innerText(), 'Séries');
    await page.evaluate(() => { window.soundEvents = []; });
    await page.keyboard.press('ArrowUp');
    assert.deepEqual(await page.evaluate(() => window.soundEvents), ['move']);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.soundEvents.at(-1)), 'select');
    await page.locator('#catalogType').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.soundEvents.at(-1)), 'cancel');
    await page.locator('#catalogStatus').click();
    assert.equal(await page.locator('#catalogChooser [data-choice]').count(), 4);
    await page.keyboard.press('Escape');
    await page.locator('#catalogCollection').click(); await page.getByRole('button', { name: 'Mais assistidos na semana', exact: true }).click();
    await page.waitForSelector('#catalogGrid .catalog-card');
    await page.locator('#catalogSort').click(); await page.getByRole('button', { name: 'Mais bem avaliados', exact: true }).click();
    await page.waitForSelector('#catalogGrid .catalog-card');
    await page.locator('#catalogCollection').click(); await page.getByRole('button', { name: 'Lançamentos dos últimos 6 meses', exact: true }).click();
    await page.waitForSelector('#catalogGrid .catalog-card');
    await page.locator('#catalogNext').click(); await page.waitForFunction(() => document.querySelector('#catalogPage').textContent === 'Página 2' && document.querySelector('#catalogGrid .catalog-card'));
    await page.screenshot({ path: path.join(output, 'explore-more.png') });
    await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => document.activeElement.id), 'hInfo');
    await page.evaluate(() => window.tvKey('home'));
    await page.locator('#btnPanel').click();
    await page.locator('#btnSounds').click();
    assert.equal(await page.locator('#btnSounds').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.evaluate(() => window.soundPreference), false);
    await page.evaluate(() => { window.soundEvents = []; });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => window.soundEvents), []);
    await page.locator('#btnPanel').click();
    await page.locator('#btnSounds').click();
    assert.equal(await page.locator('#btnSounds').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await page.evaluate(() => window.soundEvents), ['select']);
    await page.keyboard.press('Escape');
    await page.screenshot({ path: path.join(output, 'solid-home.png') });
    // TV ao vivo: primeiro card de "Todos os apps", sem repetir o app de TV ao vivo na lista
    await page.evaluate(() => document.querySelector('#btnAll').click());
    await page.waitForFunction(() => document.body.classList.contains('all-open'));
    assert.equal(await page.locator('#allGrid .acard').first().getAttribute('aria-label'), 'TV ao vivo');
    assert.equal(await page.locator('#allGrid .acard[data-pkg="com.google.android.tv"]').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'TV ao vivo');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.liveTvOpened), true);
    await page.screenshot({ path: path.join(output, 'all-apps-live-tv.png') });
    await page.keyboard.press('Escape');
    assert.deepEqual(failures, []);
    console.log('Browser: solid focus contrast, Detalhes via D-pad, ratings, discovery, detail return focus, season/episode navigation and live TV card passed. Fixtures only; no provider quota consumed.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error.message); server.close(); process.exitCode = 1; });
