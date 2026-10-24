'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { canonical, ratings, listPage, defaultSections, createCatalog, nativeTransport } = require('../app/src/main/assets/www/catalog.js');

test('canonical IDs separate movies and shows; titles never identify works', () => {
  assert.deepEqual(canonical({ ids: { tmdb: 550 }, mediatype: 'movie' }), { id: 550, type: 'movie', key: 'movie:550' });
  assert.equal(canonical({ id: 550, media_type: 'show' }).key, 'tv:550');
  assert.throws(() => canonical({ title: 'Only a title' }, 'movie'));
  assert.throws(() => canonical({ id: -1 }, 'tv'));
});
test('ratings retain original source scales, zero and unavailable values', () => {
  assert.deepEqual(ratings([{ source: 'imdb', value: 8.8, score: 88 }, { source: 'tomatoes', value: 81 }, { source: 'unknown', value: 0 }, { source: 'imdb', value: null }])
    .map(x => [x.source, x.value, x.scale, x.score100]), [['imdb', 8.8, 10, 88], ['tomatoes', 81, 100, null], ['unknown', 0, null, null]]);
});
test('MDBList pagination obeys X-Has-More and retains opaque cursor, filtering duplicates and missing IDs', () => {
  const result = listPage({ data: { movies: [{ id: 1 }, { id: 1 }, { title: 'Unknown' }, { id: 2, mediatype: 'show' }], pagination: { has_more: false, next_cursor: 'opaque+cursor' } }, headers: { 'x-has-more': 'true' } }, 'movie', 12, 12);
  assert.equal(result.items.length, 1); assert.equal(result.pagination.hasMore, true); assert.equal(result.pagination.offset, 12); assert.equal(result.pagination.nextCursor, 'opaque+cursor');
});
test('requests deduplicate and forward safe status errors without revealing URLs', async () => {
  let count = 0;
  const transport = { status: () => ({ tmdb: true }), request: async () => { count++; await new Promise(r => setTimeout(r, 10)); return { ok: true, data: { id: 550 } }; } };
  const api = createCatalog(transport, {});
  await Promise.all([api.tmdb('/movie/550'), api.tmdb('/movie/550')]);
  assert.equal(count, 1);
  for (const status of [202, 401, 403, 429, 500, 504]) {
    const broken = createCatalog({ status: () => ({ tmdb: true }), request: async () => ({ ok: false, status, retryAfter: 120, code: status === 202 ? 'PENDING' : 'HTTP_' + status }) }, {});
    await assert.rejects(broken.tmdb('/movie/550'), e => e.status === status && e.retryAfter === 120 && !/https|api_key|apikey/.test(e.message));
  }
});
test('public configuration has 3 configurable ordered sections and no invented list IDs', () => {
  assert.equal(defaultSections().length, 3);
  assert(defaultSections().every(x => x.sourceListId === null));
  const api = createCatalog({}, { catalogSections: [{ id: 'b', enabled: true, displayOrder: 2 }, { id: 'a', displayOrder: 1 }, { id: 'hidden', enabled: false }] });
  assert.deepEqual(api.sections.map(x => x.id), ['a', 'b']);
});
test('home rows are only the three TMDB rows and spend no MDBList quota; language and region are explicit', async () => {
  const seen = [];
  const transport = { status: () => ({ tmdb: true, mdblist: true }), request: async (provider, path, params) => {
    seen.push({ provider, path, params });
    return { ok: true, data: { results: [{ id: 550, title: 'Clube da Luta' }], page: 1, total_pages: 3 } };
  } };
  const api = createCatalog(transport, {});
  assert.deepEqual(api.sections.map(s => s.id), ['trending-movies', 'trending-shows', 'new']);
  const result = await api.section('trending-movies', { limit: 8 });
  await api.section('trending-shows', { limit: 8 }); await api.section('new', { limit: 8 });
  assert.equal(result.source, 'tmdb'); assert.equal(result.items[0].title, 'Clube da Luta');
  assert(seen.every(call => call.provider === 'tmdb'));
  assert.equal(seen[0].params.language, 'pt-BR'); assert.equal(seen[0].params.region, 'BR');
});
test('Lançamentos mixes movies and series, half each, without skipping titles; tabs can limit it to one type', async () => {
  const calls = [];
  const api = createCatalog({ status: () => ({ tmdb: true }), request: async (_, path, params) => {
    calls.push({ path, params });
    const tv = path === '/discover/tv';
    return { ok: true, data: { total_pages: 2, results: Array.from({ length: 20 }, (_, i) => ({ id: (params.page - 1) * 20 + i + 1, [tv ? 'name' : 'title']: tv ? 'Série' : 'Filme' })) } };
  } }, {});
  const today = new Date().toISOString().slice(0, 10);
  const seen = { movie: [], tv: [] };
  for (let page = 1; page <= 3; page++) {
    const result = await api.section('new', { page, offset: (page - 1) * 12, limit: 12 });
    assert.equal(result.items.length, 12);
    assert.deepEqual(result.items.slice(0, 2).map(x => x.media_type), ['movie', 'tv']);
    result.items.forEach(x => seen[x.media_type].push(x.id));
  }
  assert.deepEqual(seen.movie, Array.from({ length: 18 }, (_, i) => i + 1));
  assert.deepEqual(seen.tv, Array.from({ length: 18 }, (_, i) => i + 1));
  assert(calls.some(c => c.path === '/discover/movie' && c.params['primary_release_date.lte'] === today));
  assert(calls.some(c => c.path === '/discover/tv' && c.params['first_air_date.lte'] === today));
  const movies = await api.section('new', { limit: 8, only: 'movie' });
  assert(movies.items.length === 8 && movies.items.every(x => x.media_type === 'movie'));
});
test('beta pagination uses cursor only; disabled beta makes no API calls; incremental since/cursor are exclusive', async () => {
  let calls = 0;
  const transport = { status: () => ({}), request: async (_, path, params) => { calls++; assert(!('offset' in params)); return { ok: true, data: { shows: [{ id: 1396 }], pagination: { has_more: true, next_cursor: 'next' } } }; } };
  const disabled = createCatalog(transport, {});
  await assert.rejects(disabled.beta('tv', {})); assert.equal(calls, 0);
  const api = createCatalog(transport, { enableBetaCatalog: true });
  await assert.rejects(api.beta('tv', { offset: 2 }));
  const page = await api.beta('tv', { cursor: 'previous' }); assert.equal(page.pagination.nextCursor, 'next');
  await assert.rejects(api.updates('movie', { since: '2026-10-01', cursor: 'x' }));
});
test('Portuguese search, filters, status and years are forwarded without rewriting text', async () => {
  const calls = [];
  const api = createCatalog({ status: () => ({ tmdb: true }), request: async (_, path, params) => { calls.push({ path, params }); return { ok: true, data: { results: [] } }; } }, {});
  await api.browse('tv', { query: 'ação e coração', page: 2 });
  assert.equal(calls[0].params.query, 'ação e coração'); assert.equal(calls[0].path, '/search/tv');
  await api.browse('tv', { genre: '18', yearMin: '2010', yearMax: '2020', status: '3', sort: 'rating' });
  assert.equal(calls[1].params['first_air_date.gte'], '2010-01-01'); assert.equal(calls[1].params.with_status, '3');
});
test('native adapter exposes status, not keys; resolves cache envelopes without external HTTP', async () => {
  const root = { Android: { catalogStatus: () => '{"tmdb":true,"mdblist":true}', catalogRequest: (id, provider, path, params) => {
    assert(!/key|token/i.test(params)); setTimeout(() => root.CatalogNative.receive(id, { ok: true, cached: true, stale: true, data: { id: 550 } }), 1);
  } } };
  const transport = nativeTransport(root); const response = await transport.request('tmdb', '/movie/550', {});
  assert(response.cached && response.stale); assert.equal(response.data.id, 550); assert(!('tmdbKey' in transport.status()));
});

test('TMDB fixed pages do not skip titles when the UI requests 12 records per page', async () => {
  const api = createCatalog({ status: () => ({ tmdb: true }), request: async (_, path, params) => ({ ok: true,
    data: { total_pages: 3, results: Array.from({ length: Number(params.page) === 3 ? 15 : 20 }, (_, i) => ({ id: (params.page - 1) * 20 + i + 1, title: 'Title' })) }
  }) }, {});
  const ids = [];
  for (let page = 1; page <= 5; page++) {
    const result = await api.section('trending-movies', { page, offset: (page - 1) * 12, limit: 12 });
    ids.push(...result.items.map(item => item.id));
    assert.equal(result.pagination.hasMore, page < 5);
  }
  assert.deepEqual(ids, Array.from({ length: 55 }, (_, i) => i + 1));
});

test('mixed discovery maps genre taxonomies, preserves media types and applies quality/date filters', async () => {
  const calls = [];
  const api = createCatalog({ status: () => ({ tmdb: true }), request: async (_, path, params) => {
    calls.push({ path, params });
    if (path.startsWith('/genre/')) return { ok: true, data: { genres: path.includes('/movie/') ? [{ id: 28, name: 'Ação' }, { id: 12, name: 'Aventura' }, { id: 27, name: 'Terror' }, { id: 9648, name: 'Mistério' }] : [{ id: 10759, name: 'Action & Adventure' }, { id: 9648, name: 'Mistério' }] } };
    return { ok: true, data: { results: [{ id: 1, title: 'Title', vote_average: 8, popularity: 100 }], total_pages: 2 } };
  } }, {});
  const genres = await api.genres('all'), action = genres.find(g => g.value === 'action'), horror = genres.find(g => g.value === '27');
  assert.equal(action.movie, '28|12'); assert.equal(action.tv, '10759');
  const mixed = await api.browse('all', { genre: action, sort: 'recommended' });
  assert.deepEqual(new Set(mixed.items.map(x => x.media_type)), new Set(['movie', 'tv']));
  assert.equal(calls.find(x => x.path === '/discover/tv').params.with_genres, '10759');
  assert.equal(calls.find(x => x.path === '/discover/movie').params['vote_average.gte'], '7');
  calls.length = 0;
  const onlySupported = await api.browse('all', { genre: horror, collection: 'releases', sort: 'newest' });
  assert(onlySupported.items.every(x => x.media_type === 'movie')); assert.equal(calls.length, 1);
  assert(calls[0].params['primary_release_date.gte']); assert(calls[0].params['primary_release_date.lte']);
});

test('most watched uses the official weekly list and transparently falls back on quota failure', async () => {
  const calls = [];
  const api = createCatalog({ status: () => ({ tmdb: true, mdblist: true }), request: async (provider, path, params) => {
    calls.push({ provider, path, params });
    if (provider === 'mdblist') return { ok: false, status: 429, code: 'QUOTA' };
    return { ok: true, data: { results: [{ id: 550 }], total_pages: 2 } };
  } }, {});
  const result = await api.browse('movie', { collection: 'watched', page: 2, sort: 'rating', genre: { movie: '27', tv: '', slug: 'horror' } });
  assert.equal(calls[0].path, '/lists/official/most-watched-week/items'); assert.equal(calls[0].params.offset, '20');
  assert.equal(calls[0].params.sort, 'imdbrating'); assert.equal(calls[0].params.filter_genre, 'horror');
  assert.equal(result.source, 'tmdb'); assert(result.notice.includes('indisponível')); assert.equal(calls[1].params.with_genres, '27');
});
