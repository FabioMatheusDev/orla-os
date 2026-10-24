/* BYOK catalog: provider-independent data layer. Secrets exist only in Android Keystore. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.CatalogCore = api; root.Catalog = api.createCatalog(api.nativeTransport(root), root.HOME_CONFIG || {}); }
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const IMG = 'https://image.tmdb.org/t/p/';
  function type(value) {
    if (value === 'movie') return 'movie';
    if (value === 'tv' || value === 'show') return 'tv';
    throw new Error('Tipo de mídia inválido');
  }
  function canonical(item, fallback) {
    const mediaType = type(item.media_type || item.mediatype || item.type || fallback);
    const id = Number((item.ids || {}).tmdb || item.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Título sem identificação TMDB');
    return { id, type: mediaType, key: mediaType + ':' + id };
  }
  function ratings(values) {
    const scales = { imdb: 10, tomatoes: 100, popcorn: 100, tmdb: 100, metacritic: 100, metacriticuser: 10, letterboxd: 5, trakt: 100 };
    return (values || []).filter(x => x && typeof x.source === 'string' && typeof x.value === 'number' && Number.isFinite(x.value))
      .map(x => ({ source: x.source, value: x.value, scale: scales[x.source] || null, score100: typeof x.score === 'number' ? x.score : null, votes: x.votes == null ? null : x.votes }));
  }
  function listPage(response, mediaType, offset, limit) {
    const body = response.data || {}, pagination = body.pagination || {};
    const rows = Array.isArray(body) ? body : body.items || body[mediaType === 'movie' ? 'movies' : 'shows'] || [];
    const seen = new Set(), items = [];
    for (const row of rows) {
      try {
        const id = canonical(row, mediaType);
        if (id.type !== mediaType || seen.has(id.key)) continue;
        seen.add(id.key); items.push(Object.assign({}, row, { id: id.id, media_type: id.type }));
      } catch (_) { /* An unidentified work must not be guessed from its title. */ }
    }
    const header = (response.headers || {})['x-has-more'];
    return { items, pagination: { offset, limit, hasMore: header == null ? !!pagination.has_more : String(header).toLowerCase() === 'true', nextCursor: pagination.next_cursor || null },
      cached: !!response.cached, stale: !!response.stale };
  }
  function nativeTransport(root) {
    let serial = 0;
    const waiting = new Map();
    root.CatalogNative = {
      receive(id, response) { const pending = waiting.get(id); if (pending) { waiting.delete(id); clearTimeout(pending.timer); pending.resolve(response); } }
    };
    return {
      status() {
        try { return JSON.parse(root.Android.catalogStatus()); } catch (_) { return { tmdb: false, mdblist: false, transport: 'unavailable' }; }
      },
      settings() { if (root.Android && root.Android.openCatalogSettings) root.Android.openCatalogSettings(); },
      request(provider, path, params) {
        if (!root.Android || !root.Android.catalogRequest) return Promise.reject(new Error('Configure as chaves no APK, em Catálogo e chaves.'));
        return new Promise((resolve, reject) => {
          const id = 'catalog_' + (++serial);
          const timer = setTimeout(() => { waiting.delete(id); reject(new Error('O catálogo demorou a responder. Tente novamente.')); }, 30000);
          waiting.set(id, { resolve, timer });
          try { root.Android.catalogRequest(id, provider, path, JSON.stringify(params || {})); }
          catch (_) { waiting.delete(id); clearTimeout(timer); reject(new Error('Não foi possível acessar o catálogo neste aparelho.')); }
        });
      }
    };
  }
  async function mapLimit(items, limit, work) {
    const result = new Array(items.length); let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) { const i = next++; if (i >= items.length) break; result[i] = await work(items[i], i); }
    }));
    return result;
  }
  // Só três fileiras, todas pelo TMDB: uma consulta por página, já com capa e sinopse, e sem cota
  // diária. O MDBList (cota diária) fica só para as notas da tela de Detalhes.
  function defaultSections() {
    const base = { source: 'tmdb', sourceListId: null, sourceOfficialSlug: null, enabled: true, maxItems: 12, cacheTtl: 21600, fallbackStrategy: 'tmdb' };
    return [
      Object.assign({}, base, { id: 'trending-movies', title: 'Em alta nos filmes', mediaType: 'movie', displayOrder: 0, tmdbPath: '/trending/movie/day', filters: {} }),
      Object.assign({}, base, { id: 'trending-shows', title: 'Em alta nas séries', mediaType: 'tv', displayOrder: 1, tmdbPath: '/trending/tv/day', filters: {} }),
      // Lançamentos mistura filmes e séries: cada página traz metade de cada um, sem pular títulos.
      Object.assign({}, base, { id: 'new', title: 'Lançamentos', mediaType: 'all', displayOrder: 2, parts: [
        { mediaType: 'movie', tmdbPath: '/discover/movie', releasedTodayKey: 'primary_release_date.lte', filters: { sort_by: 'primary_release_date.desc', 'vote_count.gte': '30' } },
        { mediaType: 'tv', tmdbPath: '/discover/tv', releasedTodayKey: 'first_air_date.lte', filters: { sort_by: 'first_air_date.desc', 'vote_count.gte': '20' } }
      ] })
    ];
  }
  function createCatalog(transport, config) {
    const pending = new Map();
    const language = config.language || 'pt-BR', region = config.region || 'BR';
    const baseSections = config.catalogSections || defaultSections(), allSections = [], sections = [];
    function refreshSections() {
      const overrides = transport.status ? transport.status().sectionOverrides || {} : {};
      allSections.splice(0, allSections.length, ...baseSections.map(s => Object.assign({}, s, overrides[s.id] || {})));
      sections.splice(0, sections.length, ...allSections.filter(x => x.enabled !== false).sort((a, b) => a.displayOrder - b.displayOrder));
    }
    refreshSections();
    async function request(provider, path, params) {
      const stringParams = {}; for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== '') stringParams[k] = String(v);
      const key = provider + path + JSON.stringify(Object.keys(stringParams).sort().map(k => [k, stringParams[k]]));
      if (!pending.has(key)) pending.set(key, transport.request(provider, path, stringParams).then(response => {
        if (!response.ok) {
          const messages = { NO_KEY: 'Configure sua chave em Catálogo e chaves.', KEYSTORE: 'Não foi possível ler a chave protegida. Configure-a novamente.', DAILY_QUOTA: 'Limite diário do MDBList atingido. A cota renova na próxima virada do dia UTC. Usando dados salvos quando disponíveis.', RATE_WINDOW: 'Muitas consultas em poucos minutos. Aguarde para tentar novamente.', QUOTA: 'Limite de segurança do MDBList atingido. Usando os dados salvos quando disponíveis.', PENDING: 'O catálogo está sendo preparado. Aguarde para tentar novamente.' };
          const error = new Error(messages[response.code] || (response.status === 401 || response.status === 403 ? 'O provedor recusou a chave. Confira as configurações.' : response.status === 429 ? 'O provedor pediu uma pausa. Tente novamente mais tarde.' : 'Catálogo temporariamente indisponível.'));
          error.status = response.status; error.code = response.code; error.retryAfter = response.retryAfter || 0; throw error;
        }
        return response;
      }).finally(() => pending.delete(key)));
      return pending.get(key);
    }
    async function tmdb(path, supplied) {
      const at = path.indexOf('?'), clean = at === -1 ? path : path.slice(0, at), params = Object.assign({ language, region }, supplied || {});
      if (at !== -1) for (const [k, v] of new URLSearchParams(path.slice(at + 1))) params[k] = v;
      return (await request('tmdb', clean, params)).data;
    }
    async function enrich(rows, mediaType) {
      return (await mapLimit(rows, 2, async item => {
        try {
          const id = canonical(item, mediaType), data = await tmdb('/' + id.type + '/' + id.id);
          return Object.assign({}, data, { media_type: id.type, identifiers: item.ids || { tmdb: id.id } });
        } catch (_) {
          try {
            const id = canonical(item, mediaType);
            const poster = typeof item.poster === 'string' ? item.poster.match(/\/([A-Za-z0-9_-]+\.(?:jpg|png))$/) : null;
            return { id: id.id, media_type: id.type, title: item.title || '', name: item.title || '', overview: item.description || '',
              poster_path: poster ? '/' + poster[1] : null, release_date: item.release_date || '', first_air_date: item.release_date || '' };
          } catch (_) { return null; }
        }
      })).filter(x => x && (x.title || x.name));
    }
    async function section(id, options) {
      const cfg = allSections.find(x => x.id === id); if (!cfg) throw new Error('Categoria indisponível');
      options = options || {};
      const limit = Math.min(20, Math.max(1, Number(options.limit) || cfg.maxItems || 12));
      const offset = Math.max(0, Number(options.offset) || 0), page = Math.max(1, Number(options.page) || Math.floor(offset / limit) + 1);
      if (cfg.source === 'mdblist' && transport.status().mdblist && (cfg.sourceListId || cfg.sourceOfficialSlug)) {
        try {
          const path = cfg.sourceListId ? '/lists/' + Number(cfg.sourceListId) + '/items' : '/lists/official/' + cfg.sourceOfficialSlug + '/items';
          const genres = { action: 'action', thriller: 'thriller', science: 'science-fiction', animation: 'animation' };
          const params = { limit, offset: options.cursor ? undefined : offset, cursor: options.cursor, mediatype: cfg.mediaType === 'tv' ? 'show' : 'movie',
            append_to_response: 'genres,poster,description,ratings', lang: language, filter_genre: genres[id],
            sort: id.startsWith('top-') ? 'imdbrating' : id === 'new' ? 'released' : undefined, order: id.startsWith('top-') || id === 'new' ? 'desc' : undefined,
            released_to: id === 'new' ? new Date().toISOString().slice(0, 10) : undefined };
          const raw = listPage(await request('mdblist', path, params), cfg.mediaType, offset, limit);
          if (raw.items.length) return { items: await enrich(raw.items, cfg.mediaType), pagination: raw.pagination, source: 'mdblist', stale: raw.stale };
        } catch (error) { if (cfg.fallbackStrategy !== 'tmdb') throw error; }
      }
      if (options.cursor) throw new Error('A fonte mudou. Volte à primeira página para continuar.');
      const start = options.offset === undefined ? (page - 1) * limit : offset;
      if (cfg.parts) {
        // Fileira mista: options.only ('movie'|'tv') limita a um tipo (abas Filmes/Séries).
        const parts = options.only ? cfg.parts.filter(p => p.mediaType === options.only) : cfg.parts;
        if (parts.length === 1) return tmdbPage(parts[0], limit, start, page);
        const half = Math.ceil(limit / 2), partStart = Math.floor(start / 2);
        const pages = await Promise.all(parts.map(p => tmdbPage(p, half, partStart, page)));
        const items = [];
        for (let i = 0; i < half; i++) pages.forEach(r => { if (r.items[i]) items.push(r.items[i]); });
        return { items: items.slice(0, limit), pagination: { page, limit, offset: start, hasMore: pages.some(r => r.pagination.hasMore), nextCursor: null }, source: 'tmdb' };
      }
      return tmdbPage(cfg, limit, start, page);
    }
    // TMDB always returns 20 records per page. Preserve our logical page size
    // without silently dropping the remaining records between UI pages.
    async function tmdbPage(cfg, limit, start, page) {
      const firstPage = Math.floor(start / 20) + 1;
      const params = Object.assign({ page: firstPage, include_adult: 'false', watch_region: region }, cfg.filters || {});
      if (cfg.releasedTodayKey) params[cfg.releasedTodayKey] = new Date().toISOString().slice(0, 10);
      const data = await tmdb(cfg.tmdbPath, params);
      const totalPages = Math.min(500, data.total_pages || 1);
      let rows = data.results || [], lastPage = firstPage, lastLength = rows.length;
      if (start % 20 + limit > rows.length && firstPage < totalPages) {
        const next = await tmdb(cfg.tmdbPath, Object.assign({}, params, { page: firstPage + 1 }));
        lastPage++; lastLength = (next.results || []).length; rows = rows.concat(next.results || []);
      }
      // Listas que mudam entre uma página e outra (Em alta) podem repetir um título na junção.
      const seen = new Set();
      const items = rows.slice(start % 20, start % 20 + limit)
        .filter(x => !seen.has(x.id) && seen.add(x.id))
        .map(x => Object.assign({}, x, { media_type: x.media_type || cfg.mediaType }));
      return { items, pagination: { page, limit, offset: start, hasMore: items.length > 0 && (start + items.length < (lastPage - 1) * 20 + lastLength || lastPage < totalPages), nextCursor: null }, source: 'tmdb' };
    }
    async function featured(tab) {
      if (tab === 'all') {
        const pages = await Promise.allSettled([section('trending-movies', { limit: 7 }), section('trending-shows', { limit: 7 })]);
        const movies = pages[0].status === 'fulfilled' ? pages[0].value.items : [], shows = pages[1].status === 'fulfilled' ? pages[1].value.items : [];
        const items = []; for (let i = 0; i < Math.max(movies.length, shows.length); i++) { if (movies[i]) items.push(movies[i]); if (shows[i]) items.push(shows[i]); }
        if (!items.length) throw new Error('Configure as chaves ou tente novamente quando a conexão voltar.');
        return items;
      }
      return (await section(tab === 'movie' ? 'trending-movies' : 'trending-shows', { limit: 14 })).items;
    }
    async function details(mediaType, id) {
      mediaType = type(mediaType); canonical({ id }, mediaType);
      const extra = mediaType === 'tv' ? 'content_ratings' : 'release_dates';
      const data = await tmdb('/' + mediaType + '/' + id, { append_to_response: 'credits,watch/providers,' + extra + ',external_ids,videos,recommendations,similar', include_video_language: 'pt,en,null' });
      if (!data.overview || !(data.title || data.name)) {
        try {
          const fallback = await tmdb('/' + mediaType + '/' + id, { language: 'en-US' });
          if (!data.overview) data.overview = fallback.overview || '';
          if (!(data.title || data.name)) { data.title = fallback.title; data.name = fallback.name; }
        } catch (_) { }
      }
      return data;
    }
    async function mediaRatings(mediaType, id) {
      mediaType = type(mediaType); canonical({ id }, mediaType);
      if (!transport.status().mdblist) return [];
      const response = await request('mdblist', '/tmdb/' + (mediaType === 'tv' ? 'show' : 'movie') + '/' + id + '/', { lang: language });
      return ratings(response.data.ratings);
    }
    async function genres(mediaType) {
      const types = mediaType === 'all' ? ['movie', 'tv'] : [type(mediaType)];
      const results = await Promise.all(types.map(async t => ({ type: t, data: await tmdb('/genre/' + t + '/list') })));
      const choices = new Map();
      const groups = { 28: 'action', 12: 'action', 10759: 'action', 14: 'fantasy', 878: 'fantasy', 10765: 'fantasy' };
      const slugs = { 16: 'animation', 35: 'comedy', 80: 'crime', 99: 'documentary', 18: 'drama', 10751: 'family', 36: 'history', 27: 'horror', 10402: 'music', 9648: 'mystery', 10749: 'romance', 53: 'thriller', 10752: 'war', 37: 'western' };
      for (const result of results) for (const g of result.data.genres || []) {
        const key = groups[g.id] || String(g.id);
        if (!choices.has(key)) choices.set(key, { value: key, label: key === 'action' ? 'Ação e aventura' : key === 'fantasy' ? 'Ficção científica e fantasia' : g.name, movie: '', tv: '', slug: groups[g.id] || slugs[g.id] || '' });
        const choice = choices.get(key); choice[result.type] = [choice[result.type], String(g.id)].filter(Boolean).join('|');
      }
      return Array.from(choices.values()).sort((a, b) => a.label.localeCompare(b.label, language));
    }
    async function browseSingle(mediaType, options) {
      mediaType = type(mediaType); options = options || {};
      const page = Math.max(1, Math.min(500, Number(options.page) || 1));
      const genre = typeof options.genre === 'object' && options.genre ? options.genre[mediaType] : options.genre;
      if (options.genre && typeof options.genre === 'object' && !genre) return { items: [], pagination: { page, hasMore: false }, source: 'tmdb' };
      let notice = '';
      if (options.collection === 'watched' && !options.query) {
        if (transport.status().mdblist && (!options.genre || options.genre.slug)) try {
          const raw = listPage(await request('mdblist', '/lists/official/most-watched-week/items', {
            mediatype: mediaType === 'tv' ? 'show' : 'movie', limit: 20, offset: (page - 1) * 20,
            lang: language, append_to_response: 'poster,description', filter_genre: options.genre && options.genre.slug || undefined,
            released_from: /^\d{4}$/.test(options.yearMin || '') ? options.yearMin + '-01-01' : undefined,
            released_to: /^\d{4}$/.test(options.yearMax || '') ? options.yearMax + '-12-31' : options.sort === 'newest' ? new Date().toISOString().slice(0, 10) : undefined,
            sort: options.sort === 'newest' ? 'released' : options.sort === 'rating' ? 'imdbrating' : options.sort === 'recommended' ? 'score' : 'rank',
            order: !options.sort || options.sort === 'popular' ? 'asc' : 'desc'
          }), mediaType, (page - 1) * 20, 20);
          return { items: await enrich(raw.items, mediaType), pagination: raw.pagination, source: 'mdblist' };
        } catch (_) { notice = 'Mais assistidos indisponível; exibindo popularidade.'; }
        else notice = transport.status().mdblist ? 'Este gênero usa a descoberta por popularidade.' : 'Mais assistidos requer MDBList; exibindo popularidade.';
      }
      const params = { page, include_adult: 'false', watch_region: region };
      const sort = { popular: 'popularity.desc', recommended: 'popularity.desc', rating: 'vote_average.desc', newest: mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc' };
      params.sort_by = sort[options.sort] || sort.popular;
      if (genre && /^\d+(\|\d+)*$/.test(genre)) params.with_genres = genre;
      const dateKey = mediaType === 'movie' ? 'primary_release_date' : 'first_air_date';
      const today = new Date().toISOString().slice(0, 10);
      if (options.sort === 'newest' || options.collection === 'releases') params[dateKey + '.lte'] = today;
      if (options.collection === 'releases') params[dateKey + '.gte'] = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
      if (/^\d{4}$/.test(options.yearMin || '')) params[dateKey + '.gte'] = options.yearMin + '-01-01';
      if (/^\d{4}$/.test(options.yearMax || '')) params[dateKey + '.lte'] = options.yearMax + '-12-31';
      if (options.sort === 'rating') params['vote_count.gte'] = '500';
      if (options.sort === 'recommended') { params['vote_count.gte'] = '100'; params['vote_average.gte'] = '7'; }
      if (options.status && mediaType === 'tv' && ['0', '3', '4'].includes(options.status)) params.with_status = options.status;
      const query = String(options.query || '').trim().slice(0, 160);
      const data = await tmdb(query ? '/search/' + mediaType : '/discover/' + mediaType, query ? { query, page, include_adult: 'false' } : params);
      return { items: (data.results || []).map(x => Object.assign({}, x, { media_type: mediaType })), pagination: { page, limit: 20, hasMore: page < Math.min(500, data.total_pages || 1), nextCursor: null }, source: 'tmdb', notice };
    }
    async function browse(mediaType, options) {
      if (mediaType !== 'all') return browseSingle(mediaType, options);
      options = options || {};
      const results = await Promise.allSettled(['movie', 'tv'].map(t => browseSingle(t, options)));
      const pages = results.filter(r => r.status === 'fulfilled').map(r => r.value);
      if (!pages.length) throw results[0].reason;
      const items = [];
      for (let i = 0; i < Math.max(...pages.map(p => p.items.length)); i++) for (const p of pages) if (p.items[i]) items.push(p.items[i]);
      const score = item => options.sort === 'newest' ? Date.parse(item.release_date || item.first_air_date || '') || 0 : options.sort === 'rating' ? item.vote_average || 0 : item.popularity || 0;
      if (options.sort === 'newest' || options.sort === 'rating') items.sort((a, b) => score(b) - score(a));
      return { items, pagination: { page: options.page || 1, limit: 40, hasMore: pages.some(p => p.pagination.hasMore) },
        source: pages.map(p => p.source).join('+'), notice: pages.find(p => p.notice)?.notice || (pages.length < 2 ? 'Uma das fontes está indisponível. Exibindo os títulos disponíveis.' : '') };
    }
    async function season(id, number) {
      canonical({ id }, 'tv'); if (!Number.isInteger(Number(number)) || Number(number) < 0) throw new Error('Temporada inválida');
      const data = await tmdb('/tv/' + id + '/season/' + number);
      if ((data.episodes || []).some(e => !e.overview)) {
        try {
          const english = await tmdb('/tv/' + id + '/season/' + number, { language: 'en-US' });
          const byNumber = new Map((english.episodes || []).map(e => [e.episode_number, e]));
          for (const episode of data.episodes || []) if (!episode.overview && byNumber.has(episode.episode_number)) episode.overview = byNumber.get(episode.episode_number).overview || '';
        } catch (_) { }
      }
      return data;
    }
    async function beta(mediaType, options) {
      if (!config.enableBetaCatalog) throw new Error('Catálogos beta não estão habilitados.');
      mediaType = type(mediaType); options = options || {};
      if (options.offset !== undefined) throw new Error('O catálogo beta usa cursor, não offset.');
      const params = { limit: Math.min(20, Number(options.limit) || 12), cursor: options.cursor, lang: language, sort: 'tmdbpopular', sort_order: 'desc' };
      const response = await request('mdblist', '/catalog/' + (mediaType === 'tv' ? 'show' : 'movie'), params);
      return listPage(response, mediaType, 0, params.limit);
    }
    async function updates(mediaType, options) {
      mediaType = type(mediaType); options = options || {};
      if (options.since && options.cursor) throw new Error('Use since ou cursor, nunca os dois.');
      return (await request('mdblist', '/' + (mediaType === 'tv' ? 'shows' : 'movies') + '/updates', { since: options.since, cursor: options.cursor, limit: 20 })).data;
    }
    return { status: () => transport.status(), settings: () => transport.settings(), request, tmdb, featured, details, ratings: mediaRatings, allSections, sections, refreshSections, section, browse, genres, season, beta, updates, image: (path, size) => path ? IMG + (size || 'w342') + path : '' };
  }
  return { canonical, ratings, listPage, defaultSections, createCatalog, nativeTransport };
});
