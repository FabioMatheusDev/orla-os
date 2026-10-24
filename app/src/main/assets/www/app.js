/* Home TV — lógica da tela inicial (sem bibliotecas) */
(function () {
  'use strict';
  const CFG = window.HOME_CONFIG || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const NATIVE = typeof window.Android !== 'undefined';
  let soundsEnabled = true;
  try { if (NATIVE && window.Android.uiSoundsEnabled) soundsEnabled = window.Android.uiSoundsEnabled(); } catch (_) { }
  function uiSound(effect) {
    if (!soundsEnabled || !NATIVE || !window.Android.playUiSound) return;
    try { window.Android.playUiSound(effect); } catch (_) { /* Audio never blocks navigation. */ }
  }
  function renderSounds() {
    $('#soundsTxt').textContent = soundsEnabled ? 'Ligados' : 'Desligados';
    $('#btnSounds').setAttribute('aria-pressed', String(soundsEnabled));
  }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = {
    tab: 'all', picks: [], hero: 0, mode: 'ok', apps: [], dockItems: [], otherItems: [], df: 0, ds: 0, sf: 0, ss: 0,
    move: null, sheet: false,
    drawer: false, all: false, sets: false, details: null, catalog: false, seasons: false, sunrise: null, sunset: null, lastData: 0
  };

  /* ---------------- palco escalado ---------------- */
  function fit() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    const st = $('#stage');
    // Na TV o viewport já tem 1920 px (index.html): sem transform, sem camada extra.
    st.style.transform = Math.abs(s - 1) < 0.01 ? '' : 'scale(' + s + ')';
    st.style.left = (window.innerWidth - 1920 * s) / 2 + 'px';
    st.style.top = (window.innerHeight - 1080 * s) / 2 + 'px';
  }
  window.addEventListener('resize', fit);

  /* ---------------- ícones ---------------- */
  const ICON = {
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" style="stroke:#A3ABB5"><path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z"/></svg>',
    rain: '<svg viewBox="0 0 24 24" style="stroke:#8FC7FF"><path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/></svg>',
    storm: '<svg viewBox="0 0 24 24"><path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M12 15l-2 4h4l-2 4"/></svg>',
    fog: '<svg viewBox="0 0 24 24" style="stroke:#A3ABB5"><path d="M4 10h16M6 14h12M8 18h8"/></svg>',
    rise: '<svg viewBox="0 0 24 24"><path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 4v4M9 7l3-3 3 3"/></svg>',
    set: '<svg viewBox="0 0 24 24"><path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 8V4M9 5l3 3 3-3"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>'
  };

  // códigos WMO do Open-Meteo
  function wx(code, night) {
    if (code === 0) return { i: night ? 'moon' : 'sun', d: 'Céu limpo' };
    if (code <= 2) return { i: night ? 'moon' : 'sun', d: 'Poucas nuvens' };
    if (code === 3) return { i: 'cloud', d: 'Nublado' };
    if (code <= 48) return { i: 'fog', d: 'Neblina' };
    if (code <= 67) return { i: 'rain', d: 'Chuva' };
    if (code <= 77) return { i: 'cloud', d: 'Neve' };
    if (code <= 82) return { i: 'rain', d: 'Pancadas de chuva' };
    return { i: 'storm', d: 'Tempestade' };
  }

  /* ---------------- cores ---------------- */
  const TONES = ['#3E4A56', '#9C7A44', '#4F5B48', '#7A5A3E', '#4A4F6B', '#6B4A4F'];
  function rgba(hex, a) {
    const n = parseInt(String(hex || '#2A3140').slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function inkFor(hex) {
    const n = parseInt(String(hex || '#000000').slice(1), 16);
    const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return l > 0.6 ? '#0B0D10' : '#FFFFFF';
  }
  function toneGlow(tone) {
    return 'radial-gradient(80% 90% at 26% 32%, ' + rgba(tone, 0.85) + ' 0%, ' + rgba(tone, 0.32) + ' 42%, rgba(7,9,12,0) 78%), ' +
      'radial-gradient(45% 55% at 86% 30%, ' + rgba(tone, 0.4) + ' 0%, rgba(7,9,12,0) 72%)';
  }

  /* ---------------- fundo ambiente ---------------- */
  // A capa é desenhada com desfoque real num canvas fora da tela (480×270, uma vez por troca, sem
  // blocos de JPEG ampliado), junto com o escurecimento, e vira a imagem de fundo de uma div comum.
  // Assim o fundo fica na camada principal da página: nenhuma camada extra de tela cheia por quadro.
  // O TMDB libera CORS, então o canvas não fica "contaminado" e pode virar imagem.
  const ambImgs = {};
  function loadImg(url) {
    if (!ambImgs[url]) ambImgs[url] = new Promise((res) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = url;
    });
    return ambImgs[url];
  }
  function paintAmb(ctx, w, h, im, tone) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#07090C';
    ctx.fillRect(0, 0, w, h);
    if (im) {
      const k = Math.max(w / im.width, h / im.height) * 1.1;
      const dw = im.width * k, dh = im.height * k;
      ctx.filter = 'blur(5px)';
      ctx.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
      ctx.filter = 'none';
    } else {
      const g = ctx.createRadialGradient(w * 0.26, h * 0.32, 0, w * 0.26, h * 0.32, w * 0.62);
      g.addColorStop(0, rgba(tone, 0.85)); g.addColorStop(0.42, rgba(tone, 0.32)); g.addColorStop(1, 'rgba(7,9,12,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    const lin = (x0, y0, x1, y1, a, stop) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(7,9,12,' + a + ')'); g.addColorStop(stop, 'rgba(7,9,12,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    };
    ctx.fillStyle = 'rgba(7,9,12,0.3)'; ctx.fillRect(0, 0, w, h);
    lin(0, h, 0, 0, 0.94, 0.42);
    lin(0, 0, 0, h, 0.55, 0.26);
    lin(0, 0, w, 0, 0.45, 0.6);
  }
  const ambCanvas = document.createElement('canvas');
  ambCanvas.width = 480; ambCanvas.height = 270;
  // Fundos prontos (blob da imagem desfocada) guardados por título: os vizinhos são preparados
  // com antecedência (prepAmb), então trocar de título mostra o fundo na hora.
  const ambReady = {}, ambOrder = [];
  function buildAmb(img, tone) {
    const key = img || 'tone:' + tone;
    if (!ambReady[key]) {
      ambReady[key] = (img ? loadImg(img) : Promise.resolve(null)).then((im) => new Promise((res) => {
        paintAmb(ambCanvas.getContext('2d'), ambCanvas.width, ambCanvas.height, im, tone);
        try {
          ambCanvas.toBlob((b) => res(b ? URL.createObjectURL(b) : ''), 'image/jpeg', 0.92);
        } catch (e) {
          res(img || ''); // sem CORS: a capa pequena direto (mais suave do que nítida, mas funciona)
        }
      }));
      ambOrder.push(key);
      if (ambOrder.length > 10) {
        const old = ambOrder.shift();
        ambReady[old].then((u) => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); });
        delete ambReady[old];
      }
    }
    return ambReady[key];
  }
  // Visual "Sólido" (opaco, sem fundo de imagem) ou "Vidro"; escolhido no painel e salvo no aparelho.
  const isSolid = () => document.body.classList.contains('solid');
  function applyVisual(v) {
    document.body.classList.toggle('solid', v === 'solid');
    $('#visualTxt').textContent = v === 'solid' ? 'Sólido' : 'Vidro';
  }
  function drawAmb(el, img, tone) {
    if (isSolid()) return;
    const token = (el._tok = (el._tok || 0) + 1);
    buildAmb(img, tone).then((u) => {
      if (el._tok === token) el.style.backgroundImage = u ? 'url("' + u + '")' : 'none';
    });
  }
  function prepAmb(img, tone) { if (!isSolid()) buildAmb(img, tone); }
  let ambKey = '';
  function setAmb(key, img, tone) {
    if (isSolid() || key === ambKey) return;
    ambKey = key;
    drawAmb($('#amb'), img, tone);
  }

  /* ---------------- relógio ---------------- */
  const pad = (n) => String(n).padStart(2, '0');
  function tick() {
    const d = new Date();
    const hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    ['#clockTop', '#clockBig', '#clockAll', '#clockSets'].forEach((s) => { $(s).textContent = hm; });
    const date = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#dateBig').textContent = date.charAt(0).toUpperCase() + date.slice(1);
  }

  /* ---------------- rede ---------------- */
  async function getJSON(url, headers) {
    const r = await fetch(url, { headers: headers || {} });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  /* ---------------- clima ---------------- */
  async function loadWeather() {
    if (CFG.latitude == null) return;
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + CFG.latitude + '&longitude=' + CFG.longitude +
      '&current=temperature_2m,weather_code,is_day&hourly=temperature_2m,weather_code,is_day' +
      '&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=2';
    try {
      const j = await getJSON(url);
      const cur = j.current;
      state.sunrise = j.daily.sunrise[0];
      state.sunset = j.daily.sunset[0];
      const w = wx(cur.weather_code, !cur.is_day);
      const t = Math.round(cur.temperature_2m) + '°';
      $('#wxIcoTop').innerHTML = ICON[w.i];
      $('#wxTop').textContent = t + ' ' + (CFG.city || '');
      $('#wxIcoBig').innerHTML = ICON[w.i];
      $('#wxTemp').textContent = t;
      $('#wxCity').textContent = CFG.city || '';
      $('#wxDesc').textContent = w.d + ' · ' + Math.round(j.daily.temperature_2m_min[0]) + '° / ' + Math.round(j.daily.temperature_2m_max[0]) + '°';

      const hourKey = cur.time.slice(0, 13) + ':00';
      let i0 = j.hourly.time.indexOf(hourKey);
      if (i0 < 0) i0 = 0;
      let html = '';
      for (let i = i0; i < i0 + 6 && i < j.hourly.time.length; i++) {
        const hw = wx(j.hourly.weather_code[i], !j.hourly.is_day[i]);
        const label = i === i0 ? 'Agora' : j.hourly.time[i].slice(11, 13) + 'h';
        html += '<div class="hour' + (i === i0 ? ' now' : '') + '"><span class="h">' + label + '</span>' + ICON[hw.i] +
          '<span class="v">' + Math.round(j.hourly.temperature_2m[i]) + '°</span></div>';
      }
      $('#hours').innerHTML = html;
      $('#sunRow').innerHTML = '<span>' + ICON.rise + 'Nascer ' + state.sunrise.slice(11, 16) + '</span>' +
        '<span>' + ICON.set + 'Pôr do sol ' + state.sunset.slice(11, 16) + '</span>';
    } catch (e) {
      $('#wxTop').textContent = 'Clima indisponível';
      $('#wxDesc').textContent = 'Sem conexão com o serviço de clima';
    }
  }

  /* ---------------- moedas ---------------- */
  async function loadCoins() {
    const coins = CFG.coins || [];
    if (!coins.length) { $('#coinsBox').style.display = 'none'; return; }
    const syms = encodeURIComponent(JSON.stringify(coins.map((c) => c.symbol)));
    let data = [];
    try { data = await getJSON('https://api.binance.com/api/v3/ticker/24hr?symbols=' + syms); } catch (e) { data = []; }
    const by = {};
    data.forEach((d) => { by[d.symbol] = d; });
    $('#coinsBox').innerHTML = coins.map((c) => {
      const d = by[c.symbol];
      let right = '<span class="r">indisponível</span>';
      if (d) {
        const price = Number(d.lastPrice).toLocaleString('pt-BR', { style: 'currency', currency: c.symbol.endsWith('BRL') ? 'BRL' : 'USD', maximumFractionDigits: 0 });
        const ch = Number(d.priceChangePercent);
        right = '<span class="r">' + price + ' · <span class="' + (ch >= 0 ? 'up' : 'down') + '">' + (ch >= 0 ? '+' : '') + ch.toFixed(1).replace('.', ',') + '%</span></span>';
      }
      return '<div class="coin"><span class="l"><span class="s">' + esc(c.short) + '</span>' + esc(c.name) + '</span>' + right + '</div>';
    }).join('');
  }

  /* ---------------- apps ---------------- */
  function loadApps() {
    if (NATIVE) {
      try { state.apps = JSON.parse(window.Android.getApps()); } catch (e) { state.apps = []; }
    } else {
      // pré-visualização no navegador
      state.apps = (CFG.dock || []).map((d) => ({ pkg: 'demo.' + d.name.toLowerCase().replace(/\W/g, ''), label: d.name }));
    }
    state.apps.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }
  function findApp(keywords) {
    const ks = (keywords || []).map((k) => k.toLowerCase());
    for (const k of ks) {
      const hit = state.apps.find((a) => a.label.toLowerCase() === k);
      if (hit) return hit;
    }
    for (const k of ks) {
      const hit = state.apps.find((a) => a.label.toLowerCase().includes(k) || a.pkg.toLowerCase().includes(k));
      if (hit) return hit;
    }
    return null;
  }
  function appColor(app) {
    const d = (CFG.dock || []).find((x) => findApp(x.match) === app);
    if (d) return d.color;
    let h = 0;
    for (const ch of app.pkg) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return TONES[h % TONES.length];
  }
  const artCache = {};
  function art(pkg) {
    if (!NATIVE) return '';
    if (!(pkg in artCache)) {
      try { artCache[pkg] = window.Android.getArt(pkg) || ''; } catch (e) { artCache[pkg] = ''; }
    }
    return artCache[pkg];
  }
  function tileHTML(app, color) {
    if (app.pkg === 'com.netflix.ninja' || app.pkg === 'com.netflix.mediaclient') return '<img class="bn" alt="Netflix" src="icons/netflix-banner.svg">';
    const a = art(app.pkg);
    if (a.startsWith('banner:')) return '<img class="bn" alt="" src="' + a.slice(7) + '">';
    const icon = a.startsWith('icon:') ? '<img alt="" src="' + a.slice(5) + '">' : '';
    return '<span class="plain" style="background:' + esc(color) + ';color:' + inkFor(color) + '">' + icon + esc(app.label) + '</span>';
  }
  function launch(app) {
    if (!app) return;
    if (NATIVE) {
      if (!window.Android.launch(app.pkg)) toast('Não consegui abrir ' + app.label);
    } else toast('Abriria: ' + app.label);
  }

  // Barra: 7 apps + "Todos" (do 7º, → traz o "Todos"). A ordem e os apps que ficam de fora
  // ("Outros apps") são escolhidos segurando OK num card, e ficam salvos no aparelho.
  const DOCK_SKIP = ['com.amazon.tv.launcher', 'com.amazon.tv.settings.v2', 'com.amazon.ftv.profilepicker',
    'com.amazon.ftv.screensaver', 'com.amazon.hedwig', 'com.amazon.ssm', 'com.amazon.whasettings',
    'com.amazon.firetv.troubleshooting', 'com.amazon.tv.earlyaccess'];
  const DOCK_APPS = 7, DOCK_VISIBLE = 7, DOCK_STEP = 226 + 24;
  function loadList(k) {
    try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return Array.isArray(v) ? v : null; } catch (e) { return null; }
  }
  function saveOrder() {
    try {
      localStorage.setItem('dockOrder', JSON.stringify(state.dockItems.map((x) => x.app.pkg)));
      localStorage.setItem('otherOrder', JSON.stringify(state.otherItems.map((x) => x.app.pkg)));
    } catch (e) { /* sem armazenamento: a ordem vale até reiniciar */ }
  }
  function computeDock() {
    const cand = [];
    const add = (app, color, name) => {
      if (app && !DOCK_SKIP.includes(app.pkg) && !cand.some((c) => c.app.pkg === app.pkg)) cand.push({ app: app, color: color || appColor(app), name: name || app.label });
    };
    (CFG.dock || []).forEach((d) => add(findApp(d.match), d.color, d.name));
    state.apps.forEach((a) => add(a));
    const savedDock = loadList('dockOrder'), savedOther = loadList('otherOrder') || [];
    const dock = [];
    (savedDock || []).forEach((pkg) => {
      const c = cand.find((x) => x.app.pkg === pkg);
      if (c && dock.length < DOCK_APPS && !dock.includes(c)) dock.push(c);
    });
    // os que o usuário guardou em "Outros apps" vão por último, na ordem dele
    const rank = (c) => { const k = savedOther.indexOf(c.app.pkg); return k < 0 ? cand.indexOf(c) : 1000 + k; };
    const rest = cand.filter((c) => !dock.includes(c)).sort((a, b) => rank(a) - rank(b));
    while (dock.length < DOCK_APPS && rest.length) dock.push(rest.shift());
    state.dockItems = dock;
    state.otherItems = rest;
  }
  const tileCache = {};
  function tileFor(x) {
    let b = tileCache[x.app.pkg];
    if (!b) {
      b = document.createElement('button');
      b.className = 'app';
      b.dataset.pkg = x.app.pkg;
      b.setAttribute('aria-label', x.name);
      b.innerHTML = tileHTML(x.app, x.color);
      b.addEventListener('click', () => launch(x.app));
      tileCache[x.app.pkg] = b;
    }
    return b;
  }
  function renderDock() {
    computeDock();
    layoutRows();
  }
  // Põe os cards (sempre os mesmos elementos, só mudando de lugar) na barra e na gaveta.
  function layoutRows() {
    const dock = $('#dock'), sheet = $('#sheetTrack');
    state.dockItems.forEach((x, i) => { const b = tileFor(x); b.dataset.i = i; dock.appendChild(b); });
    let all = $('#btnAll');
    if (!all) {
      all = document.createElement('button');
      all.className = 'app all glass';
      all.id = 'btnAll';
      all.setAttribute('aria-label', 'Todos os apps');
      all.innerHTML = ICON.grid + 'Todos';
      all.addEventListener('click', openAll);
    }
    all.dataset.i = state.dockItems.length;
    dock.appendChild(all);
    state.otherItems.forEach((x, i) => { const b = tileFor(x); b.dataset.i = i; sheet.appendChild(b); });
    const keep = (el, list) => el === all || list.some((x) => x.app.pkg === el.dataset.pkg);
    Array.from(dock.children).forEach((el) => { if (!keep(el, state.dockItems)) el.remove(); });
    Array.from(sheet.children).forEach((el) => { if (!keep(el, state.otherItems)) el.remove(); });
    state.df = Math.min(state.df, state.dockItems.length);
    layoutDock();
    layoutSheet();
  }
  function layoutTrack(track, n, f, sKey, fl, fr) {
    if (f < state[sKey]) state[sKey] = f;
    if (f > state[sKey] + DOCK_VISIBLE - 1) state[sKey] = f - DOCK_VISIBLE + 1;
    state[sKey] = Math.max(0, Math.min(state[sKey], Math.max(0, n - DOCK_VISIBLE)));
    track.style.transform = 'translateX(' + (-state[sKey] * DOCK_STEP) + 'px)';
    fl.classList.toggle('on', state[sKey] > 0);
    fr.classList.toggle('on', state[sKey] + DOCK_VISIBLE < n);
  }
  function layoutDock() { layoutTrack($('#dock'), state.dockItems.length + 1, state.df, 'ds', $('#dfadeL'), $('#dfadeR')); }
  function layoutSheet() { layoutTrack($('#sheetTrack'), state.otherItems.length, state.sf, 'ss', $('#sfadeL'), $('#sfadeR')); }

  const HINT = {
    home: '☰ abre o painel · segure OK num app para mudar a ordem',
    move: 'Movendo · ← → escolhe o lugar · OK confirma · Voltar cancela',
    sheet: 'Segure OK num app para levá-lo à barra · Voltar fecha'
  };
  function footHint() {
    $('#footHint').textContent = state.move ? HINT.move : state.sheet ? HINT.sheet : HINT.home;
    $('#sheetHint').textContent = state.move ? 'Passe pelo "Todos" para guardar um app aqui; o primeiro daqui entra na barra' : 'Apps que não estão na barra';
  }
  function openSheet(fromMove) {
    if (!fromMove && !state.otherItems.length) return toast('Todos os seus apps já estão na barra');
    state.sheet = true;
    document.body.classList.add('sheet-open');
    footHint();
    if (!fromMove) { state.sf = 0; layoutSheet(); setFocus($('#sheetTrack .app')); }
  }
  function closeSheet() {
    state.sheet = false;
    document.body.classList.remove('sheet-open');
    footHint();
  }
  // Segurar OK: num app da barra ou da gaveta, entra no modo mover; no "Todos", abre a gaveta.
  function longPress() {
    if (!cur || state.move) return;
    if (cur.id === 'btnAll') return openSheet(false);
    if (cur.classList.contains('app') && cur.dataset.pkg && (cur.closest('#dock') || cur.closest('#sheetTrack'))) {
      state.move = { pkg: cur.dataset.pkg, where: cur.closest('#dock') ? 'dock' : 'sheet', fromSheet: state.sheet,
        snap: { d: state.dockItems.slice(), o: state.otherItems.slice() } };
      cur.classList.add('moving');
      document.body.classList.add('moving');
      footHint();
    }
  }
  // Animação da troca de lugar (FLIP, só transform): antes de reordenar, guarda onde cada card
  // estava; depois, cada um volta visualmente ao lugar antigo e anima até o novo.
  function tilePositions() {
    const before = new Map();
    $$('#dock .app, #sheetTrack .app').forEach((el) => before.set(el, { parent: el.parentElement, x: el.offsetLeft }));
    return before;
  }
  const LIFT = 'translateY(-10px) scale(1.1)';
  function animateTiles(before, moving) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    $$('#dock .app, #sheetTrack .app').forEach((el) => {
      if (!el.animate) return;
      const b = before.get(el), rest = el === moving && state.move ? LIFT : 'none';
      el.getAnimations().forEach((a) => a.cancel());
      if (!b || b.parent !== el.parentElement) {
        // entrou na barra ou na gaveta: sobe e assenta com um quique
        el.animate([{ opacity: 0, transform: 'translateY(28px) scale(0.85)' }, { opacity: 1, transform: rest }],
          { duration: 340, easing: 'cubic-bezier(.34,1.45,.64,1)' });
        return;
      }
      const dx = b.x - el.offsetLeft;
      if (!dx) return;
      if (el === moving) {
        // o card movido desliza levantado e assenta como uma mola (gravidade)
        el.animate([{ transform: 'translateX(' + dx + 'px) ' + rest }, { transform: rest }],
          { duration: 360, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      } else {
        // o card que dá lugar desce, encolhe e passa por baixo do movido
        el.animate([
          { transform: 'translateX(' + dx + 'px)', opacity: 1 },
          { transform: 'translateX(' + dx / 2 + 'px) translateY(18px) scale(0.86)', opacity: 0.7, offset: 0.5 },
          { transform: 'none', opacity: 1 }
        ], { duration: 340, easing: 'cubic-bezier(.4,0,.2,1)' });
      }
    });
  }
  function moveStep(dir) {
    const m = state.move;
    const before = tilePositions();
    const list = m.where === 'dock' ? state.dockItems : state.otherItems;
    const i = list.findIndex((x) => x.app.pkg === m.pkg);
    const swap = (a, b) => { const t = list[a]; list[a] = list[b]; list[b] = t; };
    if (dir === 'left') {
      if (i > 0) swap(i, i - 1);
      else if (m.where === 'sheet') {
        // sai da gaveta: entra na barra ao lado do "Todos" e o último da barra vai para a gaveta
        const x = state.otherItems.shift();
        const last = state.dockItems.length >= DOCK_APPS ? state.dockItems.pop() : null;
        if (last) state.otherItems.unshift(last);
        state.dockItems.push(x);
        m.where = 'dock';
        if (!m.fromSheet) closeSheet();
      } else return;
    } else if (dir === 'right') {
      if (i < list.length - 1) swap(i, i + 1);
      else if (m.where === 'dock') {
        // passa pelo "Todos": vai para a gaveta e o primeiro de lá entra na barra
        const x = state.dockItems.pop();
        const first = state.otherItems.shift();
        if (first) state.dockItems.push(first);
        state.otherItems.unshift(x);
        m.where = 'sheet';
        openSheet(true);
      } else return;
    } else return;
    layoutRows();
    setFocus(tileCache[m.pkg]);
    animateTiles(before, tileCache[m.pkg]);
  }
  function endMove(save) {
    const m = state.move;
    if (!m) return;
    const before = tilePositions();
    if (!save) { state.dockItems = m.snap.d; state.otherItems = m.snap.o; }
    else saveOrder();
    state.move = null;
    const el = tileCache[m.pkg];
    if (el) el.classList.remove('moving');
    document.body.classList.remove('moving');
    layoutRows();
    if (state.sheet && !m.fromSheet) closeSheet();
    footHint();
    if (!save) animateTiles(before, null); // cancelar: os cards voltam aos lugares animando
    const back = el && document.body.contains(el) && (el.closest('#dock') || (state.sheet && el.closest('#sheetTrack'))) ? el : $('#btnAll');
    setFocus(back);
    if (save) toast('Ordem da barra salva');
  }
  function moveSheet(dir) {
    const tiles = $$('#sheetTrack .app');
    const i = tiles.indexOf(cur);
    if (dir === 'left' && i > 0) return setFocus(tiles[i - 1]);
    if (dir === 'right' && i >= 0 && i < tiles.length - 1) return setFocus(tiles[i + 1]);
    if (dir === 'up' || dir === 'down') { closeSheet(); setFocus($('#btnAll')); }
  }

  /* ---------------- destaques (TMDB) ---------------- */
  function tmdb(path) {
    return window.Catalog.tmdb(path);
  }
  const IMG = 'https://image.tmdb.org/t/p/';
  function pickFrom(r, type) {
    const year = (r.release_date || r.first_air_date || '').slice(0, 4);
    return {
      id: r.id, type: type,
      title: r.title || r.name,
      overview: r.overview || '',
      meta: [type === 'movie' ? 'Filme' : 'Série', year, r.vote_average ? '★ ' + r.vote_average.toFixed(1).replace('.', ',') : ''].filter(Boolean).join(' · '),
      backdrop: r.backdrop_path ? IMG + 'w780' + r.backdrop_path : '',
      amb: r.backdrop_path ? IMG + 'w300' + r.backdrop_path : '',
      poster: r.poster_path ? IMG + 'w342' + r.poster_path : ''
    };
  }
  let picksRequest = 0;
  async function loadPicks() {
    const request = ++picksRequest;
    const credentials = window.Catalog.status();
    if (!credentials.tmdb && !credentials.mdblist) {
      state.mode = 'notmdb';
      state.picks = [
        { id: 0, title: 'Seu catálogo, suas chaves', meta: 'Configuração neste aparelho', overview: 'Abra Catálogo e chaves pelo painel. Suas chaves ficam protegidas no Android, sem servidor ou PC ligado. Seus apps continuam disponíveis.', demo: true }
      ];
      return renderPicks();
    }
    try {
      const items = await window.Catalog.featured(state.tab);
      if (request !== picksRequest) return;
      state.picks = items
        .filter((r) => (r.media_type || state.tab) !== 'person' && (r.backdrop_path || r.poster_path))
        .slice(0, 14)
        .map((r) => pickFrom(r, r.media_type || state.tab));
      state.picks.push({ explore: true, title: 'Explorar mais', meta: 'Encontre seu próximo favorito', overview: 'Filmes e séries para descobrir. Escolha o tipo, o gênero e a ordem, ou explore os mais assistidos e os lançamentos.' });
      state.mode = 'ok';
      state.lastData = Date.now();
    } catch (e) {
      if (request !== picksRequest) return;
      if (state.picks.some(p => p.id && !p.demo)) return;
      state.mode = 'offline';
      state.picks = [{ id: 0, title: 'Destaques indisponíveis', meta: 'Tentando reconectar…', demo: true }, { demo: true }, { demo: true }, { demo: true }];
    }
    renderPicks();
  }
  // Destaques: o card grande (state.hero) fica fixo e só troca o conteúdo; os pôsteres seguintes
  // deslizam com transform. A capa é baixada e decodificada antes (preload), então a troca não
  // engasga. ←/→ nas pontas dos botões passam para o título vizinho.
  const PICK_STEP = 347 + 28;
  const imgCache = {};
  function preload(url) {
    if (!url) return null;
    if (!imgCache[url]) {
      const im = new Image();
      im.decoding = 'async';
      im.src = url;
      const c = { ok: false, im: im };
      c.p = (im.decode ? im.decode() : Promise.resolve()).then(() => { c.ok = true; }, () => { c.ok = true; });
      imgCache[url] = c;
    }
    return imgCache[url];
  }
  function renderPicks() {
    const hadFocus = cur && cur.closest && cur.closest('.picks');
    const off = state.mode === 'offline';
    $('#hero').classList.toggle('off', off);
    const glassBg = 'background:linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06)), rgba(120,150,190,0.10)';
    $('#ptrack').innerHTML = state.picks.map((p, i) => {
      const tone = TONES[i % TONES.length];
      const bg = off ? glassBg : 'background:linear-gradient(155deg, ' + tone + ' 0%, ' + rgba(tone, 0.6) + ' 55%, #0B0E13 100%)';
      const inner = off ? '' : p.explore ? '<span class="explore-poster"><span class="explore-symbol">＋</span>Explorar mais<span class="explore-sub">Novas histórias para você</span></span>' : p.poster ? '<img alt="" decoding="async" src="' + esc(p.poster) + '">' : esc(p.demo ? 'Exemplo' : p.title || '');
      return '<div class="poster' + (off ? ' empty' : '') + '"><div class="pimg" style="' + bg + '">' + inner + '</div>' +
        '<div class="t">' + esc(off ? ' ' : p.title || '') + '</div><div class="m">' + esc(off ? ' ' : p.meta || '') + '</div></div>';
    }).join('');
    setHero(off ? 0 : state.hero, hadFocus || !cur);
  }
  function setHero(i, focus) {
    i = Math.max(0, Math.min(i, state.picks.length - 1));
    state.hero = i;
    const p = state.picks[i] || {};
    const off = state.mode === 'offline';
    const tone = TONES[i % TONES.length];
    $('#ptrack').style.transform = 'translateX(' + -((i + 1) * PICK_STEP) + 'px)';
    if (!off) {
      $('#hero').style.background = 'linear-gradient(155deg, ' + tone + ' 0%, ' + rgba(tone, 0.6) + ' 55%, #0B0E13 100%)';
      const img = $('#hImg');
      const c = preload(p.backdrop);
      if (!c) img.removeAttribute('src');
      else if (c.ok) img.src = p.backdrop;
      else {
        img.removeAttribute('src');
        c.p.then(() => { if (state.hero === i && state.picks[i] === p) img.src = p.backdrop; });
      }
      $('#hBadge').textContent = p.explore ? 'Descobrir' : state.mode === 'notmdb' ? 'Configuração' : 'Em alta';
      $('#hOv').textContent = p.overview || '';
      $('#hInfoTxt').textContent = p.explore ? 'Explorar mais' : state.mode === 'notmdb' ? 'Configurar catálogo' : 'Detalhes';
      $('#hInfo').style.display = p.demo && state.mode !== 'notmdb' ? 'none' : '';
      [i + 1, i + 2, i - 1].forEach((k) => { const q = state.picks[k]; if (q) preload(q.backdrop); });
      // fundos dos vizinhos já desfocados, logo depois da troca (sem disputar o quadro atual)
      setTimeout(() => [i + 1, i - 1, i + 2].forEach((k) => {
        const q = state.picks[k];
        if (q && state.mode === 'ok') prepAmb(q.amb, TONES[k % TONES.length]);
      }), 120);
    }
    $('#hTitle').textContent = off ? 'Destaques indisponíveis' : p.title || '';
    $('#hMeta').textContent = off ? 'Tentando reconectar…' : p.meta || '';
    if (off) setAmb('off', '', '#2A3140');
    else setAmb('p' + p.id, p.amb, tone);
    if (focus) setFocus(homeRow('picks')[0]);
  }
  function providerList(results) {
    const reg = (results || {})[CFG.region || 'BR'] || {};
    return [].concat(reg.flatrate || [], reg.free || [], reg.ads || []);
  }
  function appForProvider(name) {
    const n = String(name || '').toLowerCase();
    const rule = (CFG.providers || []).find((r) => n.includes(r.provider));
    return (rule && findApp(rule.app)) || null;
  }
  function appForProviders(results) {
    for (const x of providerList(results)) {
      const app = appForProvider(x.provider_name);
      if (app) return app;
    }
    return null;
  }

  /* ---------------- detalhes do título ---------------- */
  const detCache = {};
  const STATUS = { 'Returning Series': 'Em produção', 'Ended': 'Finalizada', 'Canceled': 'Cancelada', 'In Production': 'Em produção',
    'Planned': 'Planejada', 'Pilot': 'Piloto', 'Released': 'Lançado', 'Post Production': 'Pós-produção', 'Rumored': 'Rumor' };
  function langName(code) {
    try { return new Intl.DisplayNames(['pt-BR'], { type: 'language' }).of(code); } catch (e) { return code; }
  }
  function regionName(code) {
    try { return new Intl.DisplayNames(['pt-BR'], { type: 'region' }).of(code); } catch (e) { return code; }
  }
  function favs() {
    try { return JSON.parse(localStorage.getItem('favs') || '[]'); } catch (e) { return []; }
  }
  let beforeDetails = null;
  function renderFavorite(saved) {
    $('#dFavTxt').textContent = saved ? 'Favoritado' : 'Favoritar';
    $('#dFav').classList.toggle('is-favorite', saved);
    $('#dFav').setAttribute('aria-pressed', String(saved));
  }
  async function openDetails(p) {
    if (!p || p.demo) return;
    if (!state.details) beforeDetails = cur;
    state.details = p;
    $('.d-content').scrollTop = 0;
    document.body.classList.add('det-open');
    drawAmb($('#dAmb'), p.amb, '#3A4558');
    $('#dBand').src = p.backdrop || '';
    $('#dTitle').textContent = p.title;
    $('#dOrig').textContent = '';
    $('#dMeta').innerHTML = esc(p.meta || '');
    $('#dRates').innerHTML = '';
    $('#dOv').textContent = p.overview || 'Carregando…';
    $('#dInfo').innerHTML = '';
    $('#dProv').innerHTML = '';
    $('#dCast').innerHTML = '';
    $('#dSim').innerHTML = '';
    $('#dOpenTxt').textContent = p.app ? 'Abrir no ' + p.app.label : 'Procurando onde assistir…';
    $('#dTrailer').style.display = 'none';
    $('#dSeasons').style.display = 'none';
    renderFavorite(favs().includes(p.type + ':' + p.id));
    setFocus($('#dOpen'));
    const key = p.type + ':' + p.id;
    try {
      const d = detCache[key] || await window.Catalog.details(p.type, p.id);
      if (Object.keys(detCache).length > 40) delete detCache[Object.keys(detCache)[0]];
      detCache[key] = d;
      if (state.details === p) fillDetails(p, d);
    } catch (e) {
      if (state.details === p) $('#dOv').textContent = 'Não foi possível carregar os detalhes agora.';
    }
    loadRatings(p);
  }
  function fillDetails(p, d) {
    const tv = p.type === 'tv';
    const orig = d.original_title || d.original_name || '';
    $('#dOrig').textContent = orig && orig !== p.title ? orig : '';
    const year = (d.release_date || d.first_air_date || '').slice(0, 4);
    let cert = '';
    if (tv) cert = (((d.content_ratings || {}).results || []).find((r) => r.iso_3166_1 === 'BR') || {}).rating || '';
    else {
      const br = ((d.release_dates || {}).results || []).find((r) => r.iso_3166_1 === 'BR');
      cert = ((br && br.release_dates) || []).map((x) => x.certification).find(Boolean) || '';
    }
    const parts = [tv ? 'Série' : 'Filme', (d.genres || []).slice(0, 2).map((g) => g.name).join(', '), year].filter(Boolean);
    $('#dMeta').innerHTML = parts.map(esc).join('<span class="dot">·</span>') + (cert ? '<span class="dot">·</span><span class="cert">' + esc(cert) + '</span>' : '');
    if (d.overview) $('#dOv').textContent = d.overview;
    else if (!p.overview) $('#dOv').textContent = 'Sem sinopse em português.';

    const rows = [];
    if (tv) {
      if ((d.created_by || []).length) rows.push(['Criada por', d.created_by.slice(0, 2).map((c) => c.name).join(', ')]);
    } else {
      const dir = ((d.credits || {}).crew || []).filter((c) => c.job === 'Director').slice(0, 2).map((c) => c.name);
      if (dir.length) rows.push(['Direção', dir.join(', ')]);
    }
    const country = (d.origin_country || [])[0] || ((d.production_countries || [])[0] || {}).iso_3166_1;
    rows.push(['Estreia', [year, country ? regionName(country) : ''].filter(Boolean).join(' · ')]);
    if (STATUS[d.status]) rows.push(['Status', STATUS[d.status]]);
    if (tv && d.number_of_seasons) rows.push(['Temporadas', d.number_of_seasons + (d.number_of_seasons === 1 ? ' temporada' : ' temporadas') + (d.number_of_episodes ? ' · ' + d.number_of_episodes + ' episódios' : '')]);
    const run = tv ? (d.episode_run_time || [])[0] : d.runtime;
    if (run) rows.push(['Duração', tv ? run + ' min por episódio' : Math.floor(run / 60) + 'h' + pad(run % 60)]);
    if (d.original_language) rows.push(['Idioma', langName(d.original_language)]);
    $('#dInfo').innerHTML = rows.filter((r) => r[1]).map((r) => '<span class="lbl">' + esc(r[0]) + '</span><span class="val">' + esc(r[1]) + '</span>').join('');

    const provs = providerList((d['watch/providers'] || {}).results);
    p.app = appForProviders((d['watch/providers'] || {}).results);
    $('#dOpenTxt').textContent = p.app ? 'Abrir no ' + p.app.label : 'Não está nos seus apps';
    const seen = {};
    $('#dProv').innerHTML = provs.filter((x) => !seen[x.provider_id] && (seen[x.provider_id] = true)).slice(0, 5).map((x) =>
      '<span class="prov glass">' + (x.logo_path ? '<img alt="" src="' + IMG + 'w92' + esc(x.logo_path) + '">' : '') + esc(x.provider_name) +
      (appForProvider(x.provider_name) ? ' <span class="tag">Instalado</span>' : '') + '</span>').join('') ||
      '<span class="val" style="color:#A3ABB5">Sem streaming no Brasil agora</span>';

    $('#dCast').innerHTML = ((d.credits || {}).cast || []).slice(0, 6).map((c) => {
      const ini = String(c.name || '').split(' ').map((w) => w[0]).slice(0, 2).join('');
      return '<div class="person"><span class="av">' + esc(ini) + (c.profile_path ? '<img alt="" src="' + IMG + 'w185' + esc(c.profile_path) + '">' : '') + '</span>' +
        '<span class="nm"><span class="n">' + esc(c.name) + '</span><span class="r">' + esc(c.character || '') + '</span></span></div>';
    }).join('');

    const vids = ((d.videos || {}).results || []).filter((v) => v.site === 'YouTube' && /^[A-Za-z0-9_-]{6,20}$/.test(v.key));
    const trailer = vids.find((v) => v.type === 'Trailer') || vids.find((v) => v.type === 'Teaser');
    p.trailer = trailer ? trailer.key : '';
    $('#dTrailer').style.display = p.trailer ? '' : 'none';
    p.seasonsText = tv && d.number_of_seasons ? (d.number_of_seasons + (d.number_of_seasons === 1 ? ' temporada' : ' temporadas') + (d.number_of_episodes ? ' · ' + d.number_of_episodes + ' episódios' : '')) : '';
    $('#dSeasons').style.display = p.seasonsText ? '' : 'none';

    // Recomendações do TMDB acertam mais que "similar"; este fica de reserva.
    const recs = ((d.recommendations || {}).results || []).concat((d.similar || {}).results || []);
    state.similar = recs.filter((r) => r.backdrop_path || r.poster_path).slice(0, 4).map((r) => pickFrom(r, r.media_type || p.type));
    $('#dSim').innerHTML = state.similar.map((s, i) =>
      '<button class="sim" data-si="' + i + '"><span class="th">' + (s.amb ? '<img alt="" src="' + esc(s.amb) + '">' : '') + '</span>' +
      '<span class="tx"><span class="t">' + esc(s.title) + '</span><span class="m">' + esc(s.meta) + '</span></span></button>').join('');
    $$('.sim').forEach((b) => b.addEventListener('click', () => openDetails(state.similar[+b.dataset.si])));
  }
  // Notas externas: MDBList (IMDb, Rotten Tomatoes). Só ao abrir Detalhes, com cache de 24 h.
  async function mdbRatings(p) {
    const rows = await window.Catalog.ratings(p.type, p.id);
    const r = {};
    rows.forEach((x) => {
      if (x.source === 'imdb') r.imdb = x.value;
      if (x.source === 'tomatoes') r.rt = x.value;
    });
    return r;
  }
  async function loadRatings(p) {
    if (state.details !== p) return;
    const d = detCache[p.type + ':' + p.id];
    const chip = (k, bg, fg, v) => '<div class="rate glass"><span class="k" style="background:' + bg + ';color:' + fg + '">' + k + '</span><span class="v">' + esc(v) + '</span></div>';
    let html = d && d.vote_count ? chip('TMDB', '#01B4E4', '#04121A', d.vote_average.toFixed(1).replace('.', ',')) : '';
    $('#dRates').innerHTML = html;
    let r = null;
    try { r = await mdbRatings(p); } catch (e) { r = null; }
    if (!r || state.details !== p) return;
    if (r.imdb != null) html += chip('IMDb', '#F5C518', '#000000', String(r.imdb).replace('.', ',') + '/10');
    if (r.rt != null) html += chip('Rotten', '#FA320A', '#FFFFFF', r.rt + '%');
    $('#dRates').innerHTML = html;
  }
  function closeDetails() {
    state.details = null;
    document.body.classList.remove('det-open');
    if (state.catalog && browser.favorites) {
      const selected = beforeDetails && Number(beforeDetails.dataset.ci) || 0;
      beforeDetails = null; openFavorites(true, selected); return;
    }
    if (beforeDetails && document.body.contains(beforeDetails)) { setFocus(beforeDetails); beforeDetails = null; return; }
    const items = homeRow('picks');
    setFocus(items[items.length - 1]);
  }

  /* ---------------- painel / todos os apps / configurações ---------------- */
  function scopeEl() {
    if (state.chooser) return $('#catalogChooser');
    if (state.seasons) return $('#seasonBrowser');
    if (state.details) return $('#details');
    if (state.catalog) return $('#catalogBrowser');
    if (state.drawer) return $('#drawer');
    if (state.sets) return $('#setsPanel');
    if (state.all) return $('#allApps');
    return $('#home');
  }
  /* ---------------- discovery, search and seasons: same provider layer and D-pad ---------------- */
  const browser = { type: 'movie', category: null, page: 1, cursor: null, history: [], options: {}, before: null, epoch: 0, pagination: null, favorites: false, lastFilter: null, gridIndex: 0 };
  let seasonEpoch = 0, chooserBefore = null, discoveryObserver = null, discoveryEpoch = 0;
  function cardHTML(p, index) {
    return '<button class="catalog-card glass" data-ci="' + index + '" aria-label="' + esc(p.title || '') + '">' +
      (p.poster ? '<img loading="lazy" decoding="async" alt="" src="' + esc(p.poster) + '">' : '<span class="missing-poster">Sem imagem disponível</span>') +
      '<span class="title">' + esc(p.title || '') + '</span><span class="catalog-meta">' + esc(p.meta || '') + '</span></button>';
  }
  // Esmaecer das fileiras: cada lado só quando há cards escondidos daquele lado.
  function updateFades(track) {
    const max = track.scrollWidth - track.clientWidth;
    // a folga interna (28 px) não conta: só esmaece quando um card está escondido de verdade
    track.classList.toggle('fade-l', track.scrollLeft > 32);
    track.classList.toggle('fade-r', track.scrollLeft < max - 32);
  }
  function wireCards(container, picks) {
    container.innerHTML = picks.map(cardHTML).join('');
    container._picks = picks;
    $$('button', container).forEach(b => b.addEventListener('click', () => openDetails(picks[+b.dataset.ci])));
    if (container.classList.contains('catalog-track')) {
      if (!container._fades) { container._fades = true; container.addEventListener('scroll', () => updateFades(container), { passive: true }); }
      requestAnimationFrame(() => updateFades(container));
    }
  }
  function choose(title, choices, selected, done) {
    chooserBefore = document.activeElement && document.activeElement.closest('#catalogFilters') ? document.activeElement : cur; state.chooser = true;
    let panel = $('#catalogChooser');
    if (!panel) { panel = document.createElement('section'); panel.id = 'catalogChooser'; panel.className = 'screen'; $('#stage').appendChild(panel); }
    const active = Math.max(0, Math.min(selected, choices.length - 1));
    panel.innerHTML = '<div class="catalog-picker glass" role="dialog" aria-modal="true" aria-labelledby="choiceTitle"><header class="picker-header"><h3 id="choiceTitle">' + esc(title) + '</h3><p>Escolha uma opção para aplicar ao catálogo</p></header><div class="catalog-options">' + choices.map((v, i) => '<button class="gbtn glass catalog-option" data-choice="' + i + '" aria-pressed="' + (i === active) + '"><span class="choice-label">' + esc(v.label) + '</span><span class="choice-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-8"/></svg></span></button>').join('') + '</div><footer class="picker-footer"><span class="picker-position" aria-live="polite"></span><button class="gbtn glass" id="choiceBack">Cancelar</button></footer></div>';
    panel.style.display = 'block';
    $$('[data-choice]', panel).forEach(b => b.addEventListener('click', () => { closeChoice(); done(choices[+b.dataset.choice]); }));
    $('#choiceBack').addEventListener('click', closeChoice);
    setFocus($$('[data-choice]', panel)[active]);
  }
  function closeChoice() { state.chooser = false; $('#catalogChooser').style.display = 'none'; setFocus(chooserBefore); }
  window.addEventListener('catalogabout', () => {
    choose('Sobre o catálogo', [{ label: 'Fechar' }], 0, () => {});
    const body = document.createElement('div');
    body.innerHTML = '<img src="credits/tmdb.svg" alt="TMDB" style="width:220px;margin:16px 0"><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p><p>Metadados e imagens: TMDB. Disponibilidade: JustWatch via TMDB. Listas e avaliações: MDBList e fontes identificadas.</p><p>Cada fonte mantém sua escala de notas. Suas chaves ficam protegidas pelo Android Keystore neste aparelho. As consultas são diretas, sem servidor intermediário.</p>';
    $('#catalogChooser .catalog-options').before(body);
  });
  function initDiscovery() {
    if (discoveryObserver) discoveryObserver.disconnect();
    const root = $('#catalogRows');
    // Fileiras mistas (mediaType 'all') aparecem em todas as abas; nas abas Filmes/Séries só com o tipo da aba.
    const only = state.tab === 'all' ? undefined : state.tab;
    const sections = window.Catalog.sections.filter(s => !only || s.mediaType === only || s.mediaType === 'all');
    root.innerHTML = '<div class="catalog-toolbar"><button class="gbtn glass" id="browseAll">Explorar mais</button><button class="gbtn glass" id="browseMovies">Filmes</button><button class="gbtn glass" id="browseShows">Séries</button><button class="gbtn glass" id="browseFavorites">Minha lista</button><button class="gbtn glass" id="manageSections">Organizar fileiras</button></div>' + sections.map((s, i) =>
      '<section class="catalog-row" data-section="' + esc(s.id) + '" data-row="' + i + '"><div class="catalog-row-head"><h3>' + esc(s.title) + '</h3><button class="gbtn glass catalog-more">Ver todos</button></div><div class="catalog-track"><span class="catalog-loading">Carregando…</span></div></section>').join('');
    $('#browseMovies').addEventListener('click', () => openCatalog('movie'));
    $('#browseAll').addEventListener('click', () => openCatalog('all'));
    $('#browseShows').addEventListener('click', () => openCatalog('tv'));
    $('#browseFavorites').addEventListener('click', () => openFavorites());
    $('#manageSections').addEventListener('click', () => {
      if (NATIVE && window.Android.configureCatalogSections) window.Android.configureCatalogSections(JSON.stringify(window.Catalog.allSections));
      else toast('As fileiras são configuradas pelo controle no APK.');
    });
    $$('.catalog-row', root).forEach(row => $('.catalog-more', row).addEventListener('click', () => openCatalog(only || window.Catalog.sections.find(s => s.id === row.dataset.section).mediaType, row.dataset.section)));
    const epoch = ++discoveryEpoch;
    async function load(row) {
      if (row.dataset.loaded) return;
      row.dataset.loaded = '1';
      try {
        const result = await window.Catalog.section(row.dataset.section, { limit: 8, only });
        if (!document.body.contains(row) || epoch !== discoveryEpoch) return;
        const picks = result.items.map(r => pickFrom(r, r.media_type));
        if (!picks.length) { row.hidden = true; return; }
        wireCards($('.catalog-track', row), picks);
      } catch (_) { if (document.body.contains(row)) row.hidden = true; }
    }
    discoveryObserver = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { discoveryObserver.unobserve(entry.target); load(entry.target); } }), { root: $('#home'), rootMargin: '0px' });
    $$('.catalog-row', root).forEach(row => discoveryObserver.observe(row));
  }
  function openCatalog(type, category) {
    browser.favorites = false;
    browser.lastFilter = null; browser.gridIndex = 0;
    browser.before = cur; browser.type = type; browser.category = category || null; browser.page = 1; browser.cursor = null; browser.history = []; browser.options = { sort: 'recommended' };
    state.catalog = true; document.body.classList.add('catalog-open');
    $('#catAmb').style.backgroundImage = 'none';
    $('.catalog-pages').hidden = false;
    $('#catalogFilters').hidden = !!category;
    $('#catalogSearch').value = '';
    $('#catalogStatus').style.display = type === 'tv' ? '' : 'none';
    $('#catalogType').textContent = 'Tipo: ' + (type === 'all' ? 'ambos' : type === 'tv' ? 'séries' : 'filmes');
    $('#catalogCollection').textContent = 'Lista: descobrir';
    $('#catalogGenre').textContent = 'Gênero: todos'; $('#catalogYear').textContent = 'Ano: todos'; $('#catalogSort').textContent = 'Ordem: mais recomendados'; $('#catalogStatus').textContent = 'Situação: todas';
    loadCatalogPage(true);
  }
  async function loadCatalogPage(focus) {
    const epoch = ++browser.epoch;
    decorateCatalogFilters(); $('#catalogPosition').textContent = '';
    const cfg = window.Catalog.sections.find(s => s.id === browser.category);
    $('#catalogTitle').textContent = cfg ? cfg.title : browser.type === 'all' ? 'Explorar mais' : browser.type === 'tv' ? 'Explorar séries' : 'Explorar filmes';
    $('#catalogMessage').textContent = 'Carregando…'; $('#catalogGrid').innerHTML = '';
    setFocus($('#catalogBack'));
    try {
      const result = browser.category ? await window.Catalog.section(browser.category, { page: browser.page, offset: (browser.page - 1) * 12, cursor: browser.cursor, limit: 12, only: browser.type === 'all' ? undefined : browser.type }) : await window.Catalog.browse(browser.type, Object.assign({}, browser.options, { page: browser.page }));
      if (!state.catalog || epoch !== browser.epoch) return;
      browser.pagination = result.pagination;
      const picks = result.items.map(r => pickFrom(r, r.media_type || browser.type));
      wireCards($('#catalogGrid'), picks); $('#catalogGrid').scrollTop = 0;
      $('#catalogMessage').textContent = result.notice || (picks.length ? picks.length + ' títulos · OK abre os detalhes · Use ↑ para filtrar' : 'Nenhum título encontrado com estes filtros.');
      $('#catalogPage').textContent = 'Página ' + browser.page;
      $('#catalogPrevious').disabled = browser.page === 1;
      $('#catalogNext').disabled = !result.pagination.hasMore;
      if (focus && picks.length) setFocus($('.catalog-card', $('#catalogGrid')));
    } catch (error) { if (state.catalog && epoch === browser.epoch) { $('#catalogMessage').textContent = error.message; $('#catalogNext').disabled = true; setFocus($('#catalogBack')); } }
  }
  function decorateCatalogFilters() {
    ['catalogType', 'catalogGenre', 'catalogSort', 'catalogCollection', 'catalogYear', 'catalogStatus'].forEach(id => {
      const button = $('#' + id), text = button.textContent, colon = text.indexOf(':');
      if (colon < 0) return;
      button.classList.add('filter-chip');
      button.innerHTML = '<span class="filter-label">' + esc(text.slice(0, colon)) + '<span class="sr-only">: </span></span><span class="filter-value">' + esc(text.slice(colon + 1).trim()) + '</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>';
    });
  }
  function closeCatalog() { state.catalog = false; browser.epoch++; document.body.classList.remove('catalog-open'); setFocus(browser.before || homeRow('picks')[0]); }
  async function openFavorites(refresh = false, selected = 0) {
    if (refresh !== true) browser.before = cur;
    browser.favorites = true; state.catalog = true; document.body.classList.add('catalog-open'); browser.epoch++;
    const epoch = browser.epoch;
    $('#catalogPosition').textContent = '';
    $('#catalogTitle').textContent = 'Minha lista'; $('#catalogFilters').hidden = true; $('.catalog-pages').hidden = true;
    $('#catalogGrid').innerHTML = ''; $('#catalogMessage').textContent = 'Carregando sua lista…'; setFocus($('#catalogBack'));
    let saved = {}; try { saved = JSON.parse(localStorage.getItem('favTitles') || '{}'); } catch (_) { }
    const ids = favs().filter(v => /^(movie|tv):[1-9][0-9]*$/.test(v));
    const rows = [];
    for (const key of ids) {
      if (!state.catalog || epoch !== browser.epoch) return;
      if (saved[key]) rows.push(saved[key]);
      else { try { const parts = key.split(':'); rows.push(pickFrom(await tmdb('/' + parts[0] + '/' + parts[1]), parts[0])); } catch (_) { } }
    }
    if (!state.catalog || epoch !== browser.epoch) return;
    wireCards($('#catalogGrid'), rows);
    $('#catalogMessage').textContent = rows.length ? 'Sua lista, salva neste aparelho.' : 'Abra um título e escolha Favoritar para adicioná-lo aqui.';
    if (rows.length) setFocus($$('.catalog-card', $('#catalogGrid'))[Math.min(selected, rows.length - 1)]);
  }
  async function openSeasons() {
    const p = state.details, d = p && detCache[p.type + ':' + p.id];
    if (!p || p.type !== 'tv' || !d) return;
    state.seasons = true; document.body.classList.add('seasons-open'); $('#seasonTitle').textContent = p.title;
    const seasons = (d.seasons || []).filter(s => s.season_number >= 0);
    $('#seasonTabs').innerHTML = seasons.map(s => '<button class="gbtn glass" data-season="' + s.season_number + '">' + esc(s.name || 'Temporada ' + s.season_number) + '</button>').join('');
    $$('[data-season]').forEach(b => b.addEventListener('click', () => showSeason(p.id, +b.dataset.season)));
    setFocus($('[data-season]') || $('#seasonBack'));
    if (seasons.length) showSeason(p.id, seasons[0].season_number); else $('#seasonMessage').textContent = 'Sem temporadas disponíveis.';
  }
  async function showSeason(id, number) {
    const epoch = ++seasonEpoch; $('#seasonMessage').textContent = 'Carregando episódios…'; $('#episodeList').innerHTML = '';
    try {
      const season = await window.Catalog.season(id, number);
      if (!state.seasons || epoch !== seasonEpoch) return;
      $('#seasonMessage').textContent = (season.name || 'Temporada ' + number) + ' · Numeração TMDB';
      $('#episodeList').innerHTML = (season.episodes || []).map(e => '<button class="episode glass"><strong>' + esc(e.episode_number + '. ' + (e.name || '')) + '</strong><span class="meta">' +
        esc([e.air_date || '', e.runtime ? e.runtime + ' min' : ''].filter(Boolean).join(' · ')) + '</span><span class="overview">' + esc(e.overview || 'Sinopse não disponível.') + '</span></button>').join('');
    } catch (error) { if (state.seasons && epoch === seasonEpoch) $('#seasonMessage').textContent = error.message; }
  }
  function closeSeasons() { state.seasons = false; seasonEpoch++; document.body.classList.remove('seasons-open'); setFocus($('#dSeasons')); }
  function bindCatalog() {
    $('#catalogBack').addEventListener('click', closeCatalog); $('#seasonBack').addEventListener('click', closeSeasons);
    $('#catalogFind').addEventListener('click', () => { browser.options.query = $('#catalogSearch').value; browser.page = 1; loadCatalogPage(true); });
    $('#catalogNext').addEventListener('click', () => { if (!browser.pagination || !browser.pagination.hasMore) return; browser.history.push(browser.cursor); browser.cursor = browser.pagination.nextCursor; browser.page++; loadCatalogPage(true); });
    $('#catalogPrevious').addEventListener('click', () => { if (browser.page <= 1) return; browser.page--; browser.cursor = browser.history.pop() || null; loadCatalogPage(true); });
    $('#catalogType').addEventListener('click', () => {
      const choices = [{ label: 'Ambos', value: 'all' }, { label: 'Filmes', value: 'movie' }, { label: 'Séries', value: 'tv' }];
      choose('Tipo de título', choices, choices.findIndex(v => v.value === browser.type), v => {
        browser.type = v.value; browser.options.genre = ''; browser.options.status = '';
        $('#catalogType').textContent = 'Tipo: ' + v.label; $('#catalogGenre').textContent = 'Gênero: todos';
        $('#catalogStatus').style.display = v.value === 'tv' ? '' : 'none'; $('#catalogStatus').textContent = 'Situação: todas';
        browser.page = 1; browser.cursor = null; browser.history = []; loadCatalogPage(true);
      });
    });
    $('#catalogCollection').addEventListener('click', () => choose('O que você quer descobrir?', [{ label: 'Descobrir', value: '' }, { label: 'Mais assistidos na semana', value: 'watched' }, { label: 'Lançamentos dos últimos 6 meses', value: 'releases' }], browser.options.collection === 'watched' ? 1 : browser.options.collection === 'releases' ? 2 : 0, v => {
      browser.options.collection = v.value; browser.options.sort = v.value === 'releases' ? 'newest' : v.value === 'watched' ? 'popular' : 'recommended';
      $('#catalogCollection').textContent = 'Lista: ' + (v.value === 'watched' ? 'mais assistidos' : v.value === 'releases' ? 'lançamentos' : 'descobrir');
      $('#catalogSort').textContent = 'Ordem: ' + (v.value === 'releases' ? 'mais recentes' : v.value === 'watched' ? 'mais populares' : 'mais recomendados');
      browser.page = 1; loadCatalogPage(true);
    }));
    $('#catalogSort').addEventListener('click', () => {
      const choices = [{ label: 'Mais recomendados', value: 'recommended' }, { label: 'Mais recentes', value: 'newest' }, { label: 'Mais bem avaliados', value: 'rating' }, { label: 'Mais populares', value: 'popular' }];
      choose('Ordenar títulos', choices, choices.findIndex(v => v.value === browser.options.sort), v => { browser.options.sort = v.value; $('#catalogSort').textContent = 'Ordem: ' + v.label; browser.page = 1; loadCatalogPage(true); });
    });
    $('#catalogStatus').addEventListener('click', () => choose('Situação da série', [{ label: 'Todas', value: '' }, { label: 'Em andamento', value: '0' }, { label: 'Concluídas', value: '3' }, { label: 'Canceladas', value: '4' }], 0, v => { browser.options.status = v.value; $('#catalogStatus').textContent = 'Situação: ' + v.label; browser.page = 1; loadCatalogPage(true); }));
    $('#catalogGenre').addEventListener('click', async () => {
      try {
        const selectedType = browser.type, data = await window.Catalog.genres(selectedType);
        if (!state.catalog || browser.type !== selectedType) return;
        const choices = [{ label: 'Todos', value: '' }].concat(data);
        choose('Gênero', choices, choices.findIndex(v => v.value === (browser.options.genre && browser.options.genre.value || '')), v => { browser.options.genre = v.value ? v : ''; $('#catalogGenre').textContent = 'Gênero: ' + v.label; browser.page = 1; loadCatalogPage(true); });
      } catch (error) { toast(error.message); }
    });
    $('#catalogYear').addEventListener('click', () => {
      const choices = [{ label: 'Todos', min: '', max: '' }, { label: '2020–2029', min: '2020', max: '2029' }, { label: '2010–2019', min: '2010', max: '2019' }, { label: '2000–2009', min: '2000', max: '2009' }];
      for (let year = new Date().getFullYear(); year >= 1950; year--) choices.push({ label: String(year), min: String(year), max: String(year) });
      choose('Ano ou intervalo', choices, 0, v => { browser.options.yearMin = v.min; browser.options.yearMax = v.max; $('#catalogYear').textContent = 'Ano: ' + v.label; browser.page = 1; loadCatalogPage(true); });
    });
  }
  let beforeDrawer = null;
  function openDrawer() {
    beforeDrawer = cur;
    state.drawer = true; document.body.classList.add('drawer-open');
    refreshHomeStatus(); loadCoins();
    setFocus($('#btnRedirect'));
  }
  function closeDrawer() {
    state.drawer = false; document.body.classList.remove('drawer-open');
    setFocus(beforeDrawer && document.body.contains(beforeDrawer) && beforeDrawer.closest('#home') ? beforeDrawer : homeRow('picks')[0]);
  }
  // TV ao vivo: só quando a plataforma tem (a ponte devolve o pacote do app de TV ao vivo, ou "").
  function liveTvPackage() {
    if (!NATIVE || !window.Android.liveTvPackage || !window.Android.openLiveTv) return '';
    try { return window.Android.liveTvPackage() || ''; } catch (e) { return ''; }
  }
  const ICO_LIVE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 7.5a6.4 6.4 0 0 1 9 0M5 5a10 10 0 0 1 14 0M12 11l-3.5 9M12 11l3.5 9M9.4 17.5h5.2"/><circle cx="12" cy="10.5" r="1.2"/></svg>';
  function openAll() {
    const g = $('#allGrid');
    const livePkg = liveTvPackage();
    // o app de TV ao vivo do fabricante não se repete na lista: ele é o card "TV ao vivo"
    const apps = state.apps.filter((a) => a.pkg !== livePkg);
    g.innerHTML = (livePkg ? '<button class="acard glass live" data-color="#5140C2" aria-label="TV ao vivo"><span class="in">' + ICO_LIVE + 'TV ao vivo</span></button>' : '') +
      apps.map((a) => {
        const color = appColor(a);
        return '<button class="acard glass" data-pkg="' + esc(a.pkg) + '" data-color="' + esc(color) + '" aria-label="' + esc(a.label) + '"><span class="in">' + tileHTML(a, color) + '</span></button>';
      }).join('');
    $$('.acard[data-pkg]', g).forEach((b) => b.addEventListener('click', () => launch(state.apps.find((a) => a.pkg === b.dataset.pkg))));
    const live = $('.acard.live', g);
    if (live) live.addEventListener('click', () => { if (!window.Android.openLiveTv()) toast('Não consegui abrir a TV ao vivo'); });
    $('#allCount').textContent = apps.length + ' apps instalados' + (livePkg ? ' · TV ao vivo' : '');
    state.all = true; document.body.classList.add('all-open');
    g.scrollTop = 0;
    setFocus($('.acard', g));
  }
  function closeAll() {
    state.all = false; document.body.classList.remove('all-open');
    setFocus($('#btnAll'));
  }
  const SETS = [
    { key: 'all', t: 'Todas as configurações', s: 'Tela e sons, preferências, acessibilidade, conta e Alexa', ico: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M16 4v4M10 10v4M18 16v4' },
    { key: 'network', t: 'Rede', s: 'Wi-Fi e conexão com a internet', ico: 'M2 8.5a15 15 0 0 1 20 0M5 12a10.5 10.5 0 0 1 14 0M8.5 15.5a5.5 5.5 0 0 1 7 0M12 19h.01' },
    { key: 'apps', t: 'Aplicativos', s: 'Gerenciar, forçar parada, limpar cache', ico: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
    { key: 'bluetooth', t: 'Controles e Bluetooth', s: 'Controle remoto, fones e gamepads', ico: 'M7 7l10 10-5 4V3l5 4L7 17' },
    { key: 'device', t: 'Meu Fire TV', s: 'Reiniciar, suspensão, opções do desenvolvedor', ico: 'M3 5h18v12H3zM8 21h8M12 17v4' },
    { key: 'about', t: 'Sobre e armazenamento', s: 'Espaço livre, rede e buscar atualizações', ico: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 11v6M12 7.5v.01' }
  ];
  function openSets() {
    if (state.drawer) { state.drawer = false; document.body.classList.remove('drawer-open'); }
    $('#setsGrid').innerHTML = SETS.map((x) => '<button class="set glass" data-key="' + x.key + '">' +
      '<span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + x.ico + '"/></svg></span>' +
      '<span><span class="st">' + esc(x.t) + '</span><span class="ss">' + esc(x.s) + '</span></span></button>').join('');
    $$('.set').forEach((b) => b.addEventListener('click', () => {
      if (!NATIVE) return toast('Abriria: ' + b.querySelector('.st').textContent);
      if (!window.Android.openSetting(b.dataset.key)) toast('Esta seção não abre neste Fire TV');
    }));
    state.sets = true; document.body.classList.add('sets-open');
    setFocus($('.set'));
  }
  function closeSets() {
    state.sets = false; document.body.classList.remove('sets-open');
    setFocus($('#btnSettings'));
  }
  function refreshHomeStatus() {
    if (!NATIVE) { $('#swRedirect').classList.add('on'); return; }
    let s = {};
    try { s = JSON.parse(window.Android.homeStatus()); } catch (e) { s = {}; }
    state.amazonDisabled = !!s.amazonDisabled;
    $('#swRedirect').classList.toggle('on', !!(s.redirect || s.amazonDisabled));
    $('#redirectTxt').textContent = s.amazonDisabled ? 'Modo desempenho ativo' : 'Botão Home abre esta tela';
    $('#homeStatus').textContent = s.amazonDisabled ? 'Para voltar à tela da Amazon, rode scripts/restore pelo computador'
      : (s.service ? '' : 'Serviço do botão Home desligado · rode scripts/setup-home pelo ADB');
  }

  /* ---------------- navegação D-pad ---------------- */
  let cur = null;
  const lastHome = { top: null, picks: null, dock: null };
  function rowOf(el) {
    if (el.closest('.top')) return 'top';
    if (el.closest('.shelf')) return 'dock';
    return 'picks';
  }
  function setFocus(el) {
    if (!el) return;
    if (cur) cur.classList.remove('focus');
    cur = el;
    el.classList.add('focus');
    if (state.catalog && el.closest('#catalogFilters')) browser.lastFilter = el;
    if (state.catalog && el.closest('#catalogGrid')) {
      const cards = $$('.catalog-card', $('#catalogGrid'));
      browser.gridIndex = cards.indexOf(el);
      $('#catalogPosition').textContent = (browser.gridIndex + 1) + ' de ' + cards.length;
    }
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    $('#hero').classList.toggle('on', !!el.closest('#hero'));
    if (el.closest('#home')) {
      if (!el.closest('#catalogRows')) $('#home').scrollTop = 0;
      lastHome[rowOf(el)] = el;
      if (el.closest('#dock')) { state.df = +el.dataset.i; layoutDock(); }
      if (el.closest('#sheetTrack')) { state.sf = +el.dataset.i; layoutSheet(); }
    }
    if (el.closest('#catalogChooser') && el.hasAttribute('data-choice')) {
      const list = el.parentElement, inset = 12;
      if (el.offsetTop < list.scrollTop + inset) list.scrollTop = el.offsetTop - inset;
      else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight - inset) list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight + inset;
      $('#catalogChooser .picker-position').textContent = (+el.dataset.choice + 1) + ' de ' + list.children.length;
    } else if (el.closest('#catalogRows, #catalogBrowser, #seasonBrowser, #drawer')) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // "Explorar mais" no Vidro: o fundo segue o título em foco, com os vizinhos já preparados.
    if (el.classList.contains('catalog-card') && el.closest('#catalogBrowser') && !isSolid()) {
      const picks = el.parentElement._picks || [], ci = +el.dataset.ci, p = picks[ci];
      if (p && p.amb) drawAmb($('#catAmb'), p.amb, TONES[ci % TONES.length]);
      [ci + 1, ci - 1, ci + 6].forEach(k => { if (picks[k] && picks[k].amb) prepAmb(picks[k].amb, TONES[k % TONES.length]); });
    }
    if (el.classList.contains('acard')) {
      $('#allAmb').style.background = 'radial-gradient(70% 80% at 30% 35%, ' + rgba(el.dataset.color, 0.7) + ' 0%, ' + rgba(el.dataset.color, 0.25) + ' 45%, rgba(7,9,12,0) 78%)';
      $('#allFocus').textContent = 'Em foco: ' + el.getAttribute('aria-label');
      el.scrollIntoView({ block: 'nearest' });
    }
  }
  function homeRow(row) {
    if (row === 'top') return $$('.tab').concat([$('#btnFavorites'), $('#btnPanel'), $('#btnSettings')]);
    if (row === 'dock') return $$('#dock .app');
    if (state.mode === 'offline') return [$('#hRetry')];
    return $('#hInfo').style.display === 'none' ? [] : [$('#hInfo')];
  }
  // Home em 3 fileiras fixas (topo, destaques, apps): ←/→ andam na fileira, ↑/↓ trocam de fileira
  // e voltam ao último item focado nela.
  function moveHome(dir) {
    const row = rowOf(cur);
    if (row === 'dock' && dir === 'down') return setFocus($('#browseAll'));
    if (dir === 'left' || dir === 'right') {
      const items = homeRow(row);
      const j = items.indexOf(cur) + (dir === 'right' ? 1 : -1);
      if (j >= 0 && j < items.length) setFocus(items[j]);
      // nos destaques, sair do card pela lateral abre o vizinho
      else if (row === 'picks' && state.mode !== 'offline') {
        if (j >= items.length && state.hero < state.picks.length - 1) setHero(state.hero + 1, true);
        if (j < 0 && state.hero > 0) setHero(state.hero - 1, true);
      }
      return;
    }
    const order = ['top', 'picks', 'dock'];
    const r = order.indexOf(row) + (dir === 'down' ? 1 : -1);
    if (r < 0 || r >= order.length) return;
    const next = order[r];
    let target = lastHome[next];
    if (!target || !document.body.contains(target) || !homeRow(next).includes(target)) {
      target = next === 'top' ? $('.tab.on') : next === 'dock' ? $$('#dock .app')[state.df] : homeRow('picks')[0];
    }
    setFocus(target);
  }
  function visible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.offsetParent !== null;
  }
  function moveCatalogGrid(dir) {
    const grid = $('#catalogGrid'), cards = $$('.catalog-card', grid);
    if (!cards.length) return false;
    const index = cards.indexOf(cur);
    const firstTop = cards[0].offsetTop;
    const nextRow = cards.findIndex(card => card.offsetTop > firstTop + 1);
    const columns = nextRow > 0 ? nextRow : cards.length;
    if (index < 0) {
      if (dir === 'up' && cur.closest('.catalog-pages')) {
        const lastRow = Math.floor((cards.length - 1) / columns) * columns;
        setFocus(cards[Math.max(lastRow, Math.min(browser.gridIndex, cards.length - 1))]); return true;
      }
      return false;
    }
    const column = index % columns;
    if (dir === 'up') {
      if (index >= columns) setFocus(cards[index - columns]);
      else if (!$('#catalogFilters').hidden) setFocus(browser.lastFilter && visible(browser.lastFilter) ? browser.lastFilter : $('#catalogType'));
      else setFocus($('#catalogBack'));
    } else if (dir === 'down') {
      const rowStart = (Math.floor(index / columns) + 1) * columns;
      if (rowStart < cards.length) setFocus(cards[Math.min(rowStart + column, cards.length - 1)]);
      else if (!$('.catalog-pages').hidden) {
        const target = !$('#catalogNext').disabled ? $('#catalogNext') : !$('#catalogPrevious').disabled ? $('#catalogPrevious') : null;
        if (target) setFocus(target);
      }
    } else if (dir === 'left' && column > 0) setFocus(cards[index - 1]);
    else if (dir === 'right' && column < columns - 1 && index + 1 < cards.length) setFocus(cards[index + 1]);
    return true;
  }
  function move(dir) {
    const before = cur;
    const beforeHero = state.hero;
    moveFocus(dir);
    if (cur !== before || state.hero !== beforeHero) uiSound('move');
  }
  function moveFocus(dir) {
    if (state.move) return moveStep(dir);
    if (state.sheet) return moveSheet(dir);
    if (!cur || !document.body.contains(cur)) return setFocus(homeRow('picks')[0]);
    if (scopeEl().id === 'home' && !cur.closest('#catalogRows')) return moveHome(dir);
    if (scopeEl().id === 'catalogBrowser' && moveCatalogGrid(dir)) return;
    if (state.chooser) {
      const options = $$('[data-choice]', $('#catalogChooser')), index = options.indexOf(cur);
      if (dir === 'down' && index >= 0) setFocus(options[index + 1] || $('#choiceBack'));
      else if (dir === 'up') setFocus(cur.id === 'choiceBack' ? options[options.length - 1] : options[Math.max(0, index - 1)]);
      return;
    }
    if (cur.hasAttribute('data-scroll') && (dir === 'up' || dir === 'down')) {
      const before = cur.scrollTop;
      cur.scrollTop += dir === 'down' ? 160 : -160;
      if (cur.scrollTop !== before) return;
    }
    const list = $$('button,input,[data-scroll]', scopeEl()).filter(el => !el.disabled && visible(el));
    if (!list.length) return;
    if (!list.includes(cur)) return setFocus(list[0]);
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bestScore = Infinity;
    list.forEach((el) => {
      if (el === cur) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = cx - ax, dy = cy - ay;
      let main, cross;
      if (dir === 'left')  { if (r.right > a.left + 2 && dx >= -2) return; main = -dx; cross = Math.abs(dy); }
      if (dir === 'right') { if (r.left < a.right - 2 && dx <= 2) return; main = dx; cross = Math.abs(dy); }
      if (dir === 'up')    { if (r.bottom > a.top + 2) return; main = -dy; cross = Math.abs(dx); }
      if (dir === 'down')  { if (r.top < a.bottom - 2) return; main = dy; cross = Math.abs(dx); }
      if (main <= 0) return;
      const score = (dir === 'left' || dir === 'right') ? main + cross * 4 : main + cross * 0.6;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) setFocus(best);
  }
  document.addEventListener('keydown', (e) => {
    const k = e.key;
    if (e.target.tagName === 'INPUT') {
      if (k === 'ArrowDown') { e.preventDefault(); setFocus($('#catalogFind')); }
      if (k === 'ArrowUp') { e.preventDefault(); setFocus($('#catalogBack')); }
      return;
    }
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (map[k]) { e.preventDefault(); move(map[k]); return; }
    if (k === 'Enter' || e.keyCode === 23 || k === ' ') {
      e.preventDefault();
      if (!e.repeat || !okDown) { okDown = Date.now(); okLong = false; }
      else if (!okLong && Date.now() - okDown > 420) { okLong = true; longPress(); }
      return;
    }
    if (k === 'Escape' || k === 'Backspace') { e.preventDefault(); window.tvKey('back'); return; }
    if (k === 'ContextMenu' || k === 'm') { e.preventDefault(); window.tvKey('menu'); }
  });

  // OK age ao soltar: assim segurar (≥0,4 s) não abre o app antes de entrar no modo mover.
  let okDown = 0, okLong = false;
  document.addEventListener('keyup', (e) => {
    if (!(e.key === 'Enter' || e.keyCode === 23 || e.key === ' ')) return;
    e.preventDefault();
    if (e.target.tagName === 'INPUT') { $('#catalogFind').click(); return; }
    const wasLong = okLong;
    okDown = 0; okLong = false;
    if (wasLong) return;
    if (state.move) { uiSound('select'); return endMove(true); }
    if (cur) cur.click();
  });

  // chamado pelo Android (MainActivity)
  window.tvKey = function (key) {
    if (key === 'longok') { okLong = true; longPress(); return; }
    if (key === 'menu') {
      if (state.details || state.all || state.sets || state.move || state.sheet || state.catalog || state.seasons || state.chooser) return;
      uiSound(state.drawer ? 'cancel' : 'click');
      state.drawer ? closeDrawer() : openDrawer();
      return;
    }
    if (key === 'back') {
      if (state.chooser || state.seasons || state.move || state.sheet || state.details || state.catalog || state.drawer || state.sets || state.all) uiSound('cancel');
      if (state.chooser) closeChoice();
      else if (state.seasons) closeSeasons();
      else if (state.move) endMove(false);
      else if (state.sheet) { closeSheet(); setFocus($('#btnAll')); }
      else if (state.details) closeDetails();
      else if (state.catalog) closeCatalog();
      else if (state.drawer) closeDrawer();
      else if (state.sets) closeSets();
      else if (state.all) closeAll();
      else setFocus(homeRow('picks')[0]);
      return;
    }
    if (key === 'home') {
      if (state.chooser) closeChoice();
      if (state.seasons) closeSeasons();
      if (state.catalog) closeCatalog();
      if (state.move) endMove(false);
      if (state.sheet) closeSheet();
      if (state.details) { state.details = null; document.body.classList.remove('det-open'); }
      if (state.drawer) closeDrawer();
      if (state.sets) closeSets();
      if (state.all) closeAll();
      state.df = 0; layoutDock();
      setFocus(homeRow('picks')[0]);
      return;
    }
    if (key === 'resume') {
      clearTimeout(resumeRefresh);
      resumeRefresh = setTimeout(() => {
        const before = state.apps.length;
        loadApps();
        if (state.apps.length !== before) renderDock();
        if (Date.now() - state.lastData > 60 * 60 * 1000) { loadPicks(); loadWeather(); }
        if (state.drawer) refreshHomeStatus();
      }, 250);
    }
  };

  /* ---------------- toast ---------------- */
  let toastT = null;
  let resumeRefresh = null;
  function toast(msg, duration = 2600, quota = false) {
    $('#toast').classList.toggle('quota', quota);
    $('#toastTxt').textContent = msg;
    $('#toast').classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => $('#toast').classList.remove('show'), duration);
  }
  window.addEventListener('catalogquota', event => {
    const at = new Date(event.detail.resetAt);
    const renewal = at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    toast('Limite diário do MDBList atingido. A cota renova às ' + renewal + ' (00:00 UTC). Os dados salvos continuam disponíveis.', 10000, true);
  });

  /* ---------------- ligações ---------------- */
  function bind() {
    document.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || button.disabled || button.id === 'btnSounds') return;
      const cancel = button.matches('#choiceBack, #catalogBack, #seasonBack');
      const select = button.matches('[data-choice], .tab, #dFav, #btnVisual, #btnRedirect, #btnIntro');
      uiSound(cancel ? 'cancel' : select ? 'select' : 'click');
    }, true);
    // Abertura (vídeo da orla ao ligar a TV): só aparece se a plataforma tiver
    if (NATIVE && window.Android.introEnabled) {
      const renderIntro = (on) => { $('#introTxt').textContent = on ? 'Ligada' : 'Desligada'; $('#btnIntro').setAttribute('aria-pressed', String(on)); };
      renderIntro(window.Android.introEnabled());
      $('#btnIntro').addEventListener('click', () => { const on = !window.Android.introEnabled(); window.Android.setIntroEnabled(on); renderIntro(on); });
    } else $('#btnIntro').hidden = true;
    $('#btnSounds').addEventListener('click', () => {
      soundsEnabled = !soundsEnabled;
      try { if (NATIVE && window.Android.setUiSoundsEnabled) window.Android.setUiSoundsEnabled(soundsEnabled); } catch (_) { }
      renderSounds();
      uiSound('select');
    });
    $('#hInfo').addEventListener('click', () => state.mode === 'notmdb' ? window.Catalog.settings() : state.picks[state.hero]?.explore ? openCatalog(state.tab) : openDetails(state.picks[state.hero]));
    $('#hRetry').addEventListener('click', loadPicks);
    $$('.tab').forEach((b) => b.addEventListener('click', () => {
      $$('.tab').forEach((x) => x.classList.toggle('on', x === b));
      state.tab = b.dataset.tab;
      state.hero = 0;
      loadPicks();
      initDiscovery();
    }));
    $('#btnPanel').addEventListener('click', openDrawer);
    $('#btnFavorites').addEventListener('click', () => openFavorites());
    $('#btnSettings').addEventListener('click', openSets);
    $('#scrim').addEventListener('click', closeDrawer);
    $('#btnSys').addEventListener('click', openSets);
    $('#btnCatalog').addEventListener('click', () => window.Catalog.settings());
    $('#btnVisual').addEventListener('click', () => {
      const v = isSolid() ? 'glass' : 'solid';
      applyVisual(v);
      try { localStorage.setItem('visual', v); } catch (e) { /* vale até reiniciar */ }
      if (v === 'glass') {
        ambKey = '';
        const p = state.picks[state.hero];
        if (p && state.mode === 'ok') setAmb('p' + p.id, p.amb, TONES[state.hero % TONES.length]);
      }
      toast(v === 'solid' ? 'Visual sólido: mais leve' : 'Visual vidro');
    });
    $('#dOpen').addEventListener('click', () => {
      const p = state.details;
      if (p && p.app) launch(p.app); else toast('Não encontrei esse título nos seus apps');
    });
    $('#dTrailer').addEventListener('click', () => {
      const p = state.details;
      if (!p || !p.trailer) return;
      if (!NATIVE) return toast('Abriria o trailer no YouTube');
      if (!window.Android.openTrailer(p.trailer)) toast('Não consegui abrir o YouTube');
    });
    $('#dSeasons').addEventListener('click', openSeasons);
    $('#dFav').addEventListener('click', () => {
      const p = state.details;
      if (!p) return;
      const id = p.type + ':' + p.id;
      let f = favs();
      f = f.includes(id) ? f.filter((x) => x !== id) : f.concat([id]);
      try { localStorage.setItem('favs', JSON.stringify(f)); } catch (e) { /* sem armazenamento */ }
      try {
        const titles = JSON.parse(localStorage.getItem('favTitles') || '{}');
        if (f.includes(id)) titles[id] = { id: p.id, type: p.type, title: p.title, overview: p.overview, meta: p.meta, poster: p.poster, backdrop: p.backdrop, amb: p.amb };
        else delete titles[id];
        for (const key of Object.keys(titles)) if (!f.includes(key)) delete titles[key];
        localStorage.setItem('favTitles', JSON.stringify(titles));
      } catch (_) { }
      renderFavorite(f.includes(id));
      toast(f.includes(id) ? 'Adicionado aos favoritos' : 'Removido dos favoritos');
    });
    $('#btnRedirect').addEventListener('click', () => {
      if (!NATIVE) return toast('Só funciona na TV');
      const s = JSON.parse(window.Android.homeStatus());
      if (s.amazonDisabled) return toast('A Home TV já é a única tela inicial');
      window.Android.setRedirect(!s.redirect);
      refreshHomeStatus();
      toast(!s.redirect ? 'O botão Home voltará para esta tela' : 'O botão Home voltará para a tela da Amazon');
    });
    $('#btnRestore').addEventListener('click', () => {
      if (!NATIVE) return toast('Só funciona na TV');
      if (state.amazonDisabled) return toast('Rode scripts/restore no computador para reativar a tela da Amazon');
      const ok = window.Android.restoreOriginalHome();
      toast(ok ? 'Tela original restaurada' : 'Redirecionamento desligado · rode scripts/restore para remover tudo');
    });
  }

  /* ---------------- início ---------------- */
  fit();
  let savedVisual = null;
  try { savedVisual = localStorage.getItem('visual'); } catch (e) { /* sem armazenamento */ }
  applyVisual(savedVisual || CFG.visual || 'glass');
  footHint();
  bind();
  renderSounds();
  bindCatalog();
  tick();
  setInterval(tick, 15000);
  loadApps();
  renderDock();
  loadPicks();
  initDiscovery();
  window.addEventListener('catalogcredentialschange', () => {
    for (const key of Object.keys(detCache)) delete detCache[key];
    state.hero = 0; loadPicks(); initDiscovery();
  });
  window.addEventListener('catalogoptionschange', () => { window.Catalog.refreshSections(); initDiscovery(); });
  loadWeather();
  loadCoins();
  setInterval(loadWeather, 15 * 60 * 1000);
  setInterval(loadCoins, 5 * 60 * 1000);
  setInterval(() => { if (!state.details) loadPicks(); }, 60 * 60 * 1000);
})();
