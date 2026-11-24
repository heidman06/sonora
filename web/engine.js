/* Sonora — moteur : API Piped, lecteur, favoris, téléchargements, files. */
'use strict';

var API = location.protocol + '//' + location.hostname + ':8480';
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

var ICONS = {
  listen: '<path d="M4 14a8 8 0 0 1 16 0"/><path d="M4 14v3a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2z"/><path d="M20 14v3a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  library: '<rect x="4" y="4" width="4" height="16" rx="1.2"/><rect x="10" y="4" width="4" height="16" rx="1.2"/><path d="m16.5 6 3.4 12.6a1.2 1.2 0 0 0 1.5.8l.1 0"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="7" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  next: '<path d="M6 5.5 15 12l-9 6.5z" fill="currentColor" stroke="none"/><rect x="16.5" y="5" width="2.4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  prev: '<path d="M18 5.5 9 12l9 6.5z" fill="currentColor" stroke="none"/><rect x="5.1" y="5" width="2.4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  shuffle: '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  repeat1: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  heartFill: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" fill="currentColor" stroke="none"/>',
  queue: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  spark: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  note: '<path d="M9 18V5l11-2v11"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="14" r="3"/>',
  check: '<path d="m4 12 5 5L20 6"/>'
};

function ico(name, size) {
  var sz = size || 22;
  return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
}

var STORE = {
  get: function (k, d) { try { var v = localStorage.getItem('sonora.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('sonora.' + k, JSON.stringify(v)); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem('sonora.' + k); } catch (e) {} }
};

var S = {
  token: STORE.get('token', ''),
  user: STORE.get('user', ''),
  lang: STORE.get('lang', 'fr'),
  playlists: [],
  queue: [],
  qi: -1,
  shuffle: false,
  repeat: 'off',
  playing: false,
  recent: STORE.get('recent', []),
  favs: STORE.get('favs', []),
  volume: STORE.get('volume', 0.9),
  downloads: [],
  tab: 'listen',
  searchFilter: 'music_songs',
  query: ''
};

function ukey(k) { return 'u.' + (S.user || 'guest') + '.' + k; }
var accountsInit = STORE.get('accounts', []);
var activeInit = STORE.get('active', '');
if (activeInit) {
  var acc = accountsInit.filter(function (x) { return x.user === activeInit; })[0];
  if (acc) { S.user = acc.user; S.token = acc.token || ''; }
}
function accounts() { return STORE.get('accounts', []); }
function saveAccounts(list) { STORE.set('accounts', list); }
function loadUserData() {
  S.recent = STORE.get(ukey('recent'), []);
  S.favs = STORE.get(ukey('favs'), []);
  S.queue = STORE.get(ukey('queue'), []);
  S.qi = STORE.get(ukey('qi'), -1);
  cur = S.queue[S.qi] || null;
  favPlaylistId = STORE.get(ukey('favPlaylist'), '');
}
function setActiveUser(name) {
  var a = accounts().filter(function (x) { return x.user === name; })[0];
  if (!a) return;
  S.user = a.user;
  S.token = a.token || '';
  STORE.set('active', a.user);
  loadUserData();
  if (window.Sonora && window.Sonora.paintNow) { /* no-op */ }
}
function signOut() {
  var list = accounts().filter(function (x) { return x.user !== S.user; });
  saveAccounts(list);
  STORE.del('active');
  S.user = ''; S.token = ''; S.recent = []; S.favs = []; S.queue = []; S.qi = -1; cur = null;
  loadUserData();
}

var media = null;
var cur = null;
var seekDragging = false;
var blobUrl = null;
var streamCache = {};
var unlocked = false;
var intentPlay = false;
var IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function streamEl() { return IS_IOS ? mediaVideo : mediaAudio; }
function fallbackAudio(id) {
  if (!id) return;
  setBlob('');
  useMedia(mediaAudio);
  media.src = location.origin + '/musique/dl/' + encodeURIComponent(id);
  media.play().catch(function () {});
  paintPlayState();
}
var favPlaylistId = '';

/* ---------- IndexedDB téléchargements ---------- */
var DB = null;
function dbOpen() {
  if (DB) return DB;
  DB = new Promise(function (res, rej) {
    var r = indexedDB.open('sonora', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('downloads', { keyPath: 'id' }); };
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  });
  return DB;
}
function dlAll() {
  return dbOpen().then(function (db) {
    return new Promise(function (res) {
      var req = db.transaction('downloads', 'readonly').objectStore('downloads').getAll();
      req.onsuccess = function () { res(req.result || []); };
      req.onerror = function () { res([]); };
    });
  }).then(function (list) {
    var migrate = list.filter(function (r) { return !r.account; }).map(function (r) {
      r.account = S.user || '';
      return dlPut(r).catch(function () {});
    });
    return Promise.all(migrate).then(function () {
      return list.filter(function (r) { return r.account === (S.user || '') || !r.account; });
    });
  });
}
function dlGet(id) {
  return dbOpen().then(function (db) {
    return new Promise(function (res) {
      var req = db.transaction('downloads', 'readonly').objectStore('downloads').get(id);
      req.onsuccess = function () { res(req.result || null); };
      req.onerror = function () { res(null); };
    });
  });
}
function dlPut(rec) {
  return dbOpen().then(function (db) {
    return new Promise(function (res, rej) {
      var req = db.transaction('downloads', 'readwrite').objectStore('downloads').put(rec);
      req.onsuccess = function () { res(true); };
      req.onerror = function () { rej(req.error); };
    });
  });
}
function dlDel(id) {
  return dbOpen().then(function (db) {
    return new Promise(function (res) {
      db.transaction('downloads', 'readwrite').objectStore('downloads').delete(id);
      res(true);
    });
  });
}

function api(path, opts) {
  opts = opts || {};
  var headers = { 'Content-Type': 'application/json' };
  if (S.token) headers['Authorization'] = S.token;
  return fetch(API + path, {
    method: opts.method || 'GET', headers: headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  }).then(function (r) {
    if (!r.ok) return r.text().then(function (t) { throw new Error(t || ('HTTP ' + r.status)); });
    return r.json();
  });
}

function login(username, password) {
  return api('/login', { method: 'POST', body: { username: username, password: password } }).then(function (d) {
    if (!d.token) throw new Error('refusé');
    var list = accounts().filter(function (x) { return x.user !== username; });
    list.push({ user: username, token: d.token });
    saveAccounts(list);
    STORE.set('active', username);
    S.user = username; S.token = d.token; S.playlists = [];
    loadUserData();
    return d;
  });
}
function register(username, password) {
  return api('/register', { method: 'POST', body: { username: username, password: password } }).then(function () {
    return login(username, password);
  });
}
function logout() {
  if (S.token) {
    try {
      fetch('/api/mus/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + S.token } }).catch(function () {});
    } catch (e) {}
  }
  signOut(); S.playlists = [];
}

function vid(url) { if (!url) return ''; var q = url.split('v=')[1]; return q ? q.split('&')[0] : ''; }
function listId(url) { if (!url) return ''; var q = url.split('list=')[1]; return q ? q.split('&')[0] : ''; }
function fmt(sec) { if (!sec || sec < 0) return '0:00'; var m = Math.floor(sec / 60), s = Math.floor(sec % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function art(item) { return item.thumbnail || item.thumbnailUrl || ''; }
function trackOf(item) {
  return { id: vid(item.url || ''), title: item.title || item.name || 'Sans titre', artist: item.uploaderName || item.uploader || '', thumb: art(item), duration: item.duration || 0, url: item.url || '' };
}
function pushRecent(t) {
  if (!t.id) return;
  S.recent = [t].concat(S.recent.filter(function (x) { return x.id !== t.id; })).slice(0, 24);
  STORE.set(ukey('recent'), S.recent);
}

/* ---------- favoris ---------- */
function isFav(id) { return S.favs.some(function (x) { return x.id === id; }); }
function toggleFav(track) {
  if (!track || !track.id) return false;
  if (isFav(track.id)) {
    S.favs = S.favs.filter(function (x) { return x.id !== track.id; });
    toast('Retiré des favoris');
  } else {
    S.favs = [track].concat(S.favs);
    toast('Ajouté aux favoris');
    mirrorFav(track);
  }
  STORE.set(ukey('favs'), S.favs);
  paintFav();
  return isFav(track.id);
}
function mirrorFav(track) {
  if (!S.token) return;
  var p = Promise.resolve(favPlaylistId);
  if (!favPlaylistId) {
    p = loadPlaylists().then(function () {
      var f = (S.playlists || []).filter(function (x) { return x.name === 'Favoris Sonora'; })[0];
      if (f) return f.id;
      return createPlaylist('Favoris Sonora');
    }).then(function (id) {
      favPlaylistId = id; STORE.set('favPlaylist', id); return id;
    }).catch(function () { return ''; });
  }
  p.then(function (pid) { if (pid) return addToPlaylist(pid, [track.id]); }).catch(function () {});
}
function paintFav() {
  var on = cur && isFav(cur.id);
  var btn = $('#btn-fav');
  if (btn) { btn.innerHTML = ico(on ? 'heartFill' : 'heart', 20); btn.classList.toggle('on', !!on); }
}

/* ---------- playlists ---------- */
function createPlaylist(name) {
  return api('/user/playlists/create', { method: 'POST', body: { name: name } }).then(function (d) {
    return d.playlistId || d.id;
  });
}
function addToPlaylist(pid, ids) {
  return api('/user/playlists/add', { method: 'POST', body: { playlistId: pid, videoIds: ids } });
}
function loadPlaylists() {
  return api('/user/playlists').then(function (l) { S.playlists = l || []; return S.playlists; });
}

/* ---------- lecteur ---------- */
var mediaVideo = null, mediaAudio = null;
function bindMedia(el) {
  el.addEventListener('timeupdate', function () {
    if (media !== el || seekDragging) return;
    var d = el.duration || (cur && cur.duration) || 0;
    var p = d ? (el.currentTime / d) * 1000 : 0;
    $('#seek').value = String(p);
    $('#mini-progress').style.width = (d ? (el.currentTime / d) * 100 : 0) + '%';
    $('#t-cur').textContent = fmt(el.currentTime);
    $('#t-dur').textContent = fmt(d);
  });
  el.addEventListener('play', function () { if (media === el) { S.playing = true; paintPlayState(); } });
  el.addEventListener('pause', function () { if (media === el) { S.playing = false; paintPlayState(); } });
  el.addEventListener('ended', function () {
    if (media !== el) return;
    if (S.repeat === 'one') { el.currentTime = 0; el.play(); return; }
    playNext(true);
  });
  el.addEventListener('error', function () {
    if (media !== el) return;
    if (cur && !el._fallbackTried) { el._fallbackTried = true; fallbackAudio(cur.id); return; }
    toast('Lecture impossible pour ce titre');
  });
}
function useMedia(el) {
  if (media && media !== el) { try { media.pause(); } catch (e) {} }
  media = el;
  try { media.volume = S.volume; } catch (e) {}
}
function setVolume(v) {
  S.volume = Math.max(0, Math.min(1, v));
  STORE.set('volume', S.volume);
  try { if (mediaVideo) mediaVideo.volume = S.volume; } catch (e) {}
  try { if (mediaAudio) mediaAudio.volume = S.volume; } catch (e) {}
}
function initMedia() {
  mediaVideo = $('#media') || document.createElement('video');
  mediaAudio = $('#audio') || document.createElement('audio');
  if (!mediaVideo.parentNode) document.body.appendChild(mediaVideo);
  if (!mediaAudio.parentNode) document.body.appendChild(mediaAudio);
  media = mediaAudio;
  [mediaVideo, mediaAudio].forEach(function (el) {
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.playsInline = true;
    if (el.tagName === 'AUDIO') el.preload = 'auto';
    try { el.disablePictureInPicture = true; } catch (e) {}
    bindMedia(el);
  });
  try { if ('audioSession' in navigator) navigator.audioSession.type = 'playback'; } catch (e) {}
  // aucune lecture automatique au démarrage
  S.playing = false; intentPlay = false;
  [mediaVideo, mediaAudio].forEach(function (el) {
    if (!el) return;
    try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e) {}
  });
  document.addEventListener('pointerdown', unlockMedia, { capture: true });
  document.addEventListener('touchstart', unlockMedia, { capture: true, passive: true });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && S.playing && intentPlay && media.paused) media.play().catch(function () {});
  });
}

function resolveStream(id) {
  return api('/streams/' + id).then(function (d) {
    var vs = (d.videoStreams || []).filter(function (v) { return !v.videoOnly; });
    if (!vs.length) vs = d.videoStreams || [];
    if (!vs.length) throw new Error('Aucun flux');
    vs.sort(function (a, b) { return (a.contentLength || 1e12) - (b.contentLength || 1e12); });
    streamCache[id] = vs[0].url;
    return { url: vs[0].url, title: d.title || '', artist: d.uploader || '', thumb: d.thumbnailUrl || '', duration: d.duration || 0 };
  });
}

function prefetch(id) {
  if (!id || streamCache[id]) return;
  fetch(location.origin + '/musique/dl/' + encodeURIComponent(id), { method: 'HEAD' }).catch(function () {});
}
function unlockMedia() {
  if (unlocked) return;
  unlocked = true;
  var wav = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=';
  [mediaVideo, mediaAudio].forEach(function (el) {
    if (!el) return;
    try {
      el.src = wav;
      var pr = el.play();
      if (pr && pr.then) pr.then(function () {
        if (String(el.src || '').indexOf('data:audio/wav') === 0) {
          try { el.pause(); el.removeAttribute('src'); el.load(); } catch (err) {}
        }
      }).catch(function () {});
    } catch (e) {}
  });
}

function setBlob(u) {
  if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch (e) {} }
  blobUrl = u;
}

function estTelecharge(id) {
  return (S.downloads || []).some(function (x) { return x && x.id === id; });
}
function playTrack(track, queue, index) {
  intentPlay = true;
  if (!track || !track.id) { toast('Titre introuvable'); return; }
  if (queue) { S.queue = queue.slice(); S.qi = index || 0; }
  else {
    var i = S.queue.findIndex(function (x) { return x.id === track.id; });
    if (i >= 0) S.qi = i; else { S.queue = [track].concat(S.queue); S.qi = 0; }
  }
  cur = track;
  mediaVideo._fallbackTried = false;
  mediaAudio._fallbackTried = false;
  paintNow();
  persistQueue();
  if (!IS_IOS && !estTelecharge(track.id) && streamCache[track.id]) {
    setBlob('');
    useMedia(streamEl());
    media.src = streamCache[track.id];
    media.play().catch(function () {});
    paintNow(); paintPlayState(); setMediaSession(); pushRecent(track);
    return;
  }
  dlGet(track.id).then(function (rec) {
    if (rec && rec.blob) {
      setBlob(URL.createObjectURL(rec.blob));
      useMedia(mediaAudio);
      media.src = blobUrl;
      cur.duration = rec.duration || track.duration;
      media.play().catch(function () {});
      paintNow(); setMediaSession(); pushRecent(track);
      return;
    }
    if (IS_IOS) {
      setBlob('');
      useMedia(mediaAudio);
      media.src = location.origin + '/musique/dl/' + encodeURIComponent(track.id);
      cur.duration = track.duration || 0;
      media.play().catch(function () {});
      for (var k = 1; k <= 3; k++) { var nx = S.queue[S.qi + k]; if (nx && nx.id) { fetch(location.origin + '/musique/dl/' + encodeURIComponent(nx.id), { method: 'HEAD' }).catch(function () {}); } }
      paintNow(); paintPlayState(); setMediaSession(); pushRecent(track);
      return;
    }
    setBlob('');
    useMedia(mediaAudio);
    media.src = location.origin + '/musique/dl/' + encodeURIComponent(track.id);
    cur.duration = track.duration || 0;
    media.play().catch(function () {});
    for (var k2 = 1; k2 <= 3; k2++) { var nx2 = S.queue[S.qi + k2]; if (nx2 && nx2.id) { fetch(location.origin + '/musique/dl/' + encodeURIComponent(nx2.id), { method: 'HEAD' }).catch(function () {}); } }
    paintNow(); paintPlayState(); setMediaSession(); pushRecent(track);
    return;
  }).catch(function () { fallbackAudio(track.id); paintNow(); });
}

function playNext(auto) {
  if (!S.queue.length) return;
  var n = S.qi + 1;
  if (S.repeat === 'all' && n >= S.queue.length) n = 0;
  if (n >= S.queue.length) { if (!auto) return; n = 0; }
  S.qi = n; playTrack(S.queue[S.qi]); persistQueue();
}
function playPrev() {
  if (!S.queue.length) return;
  if (media && media.currentTime > 4) { media.currentTime = 0; return; }
  S.qi = S.qi <= 0 ? S.queue.length - 1 : S.qi - 1;
  playTrack(S.queue[S.qi]); persistQueue();
}
function togglePlay() {
  if (!media.src) { if (S.queue.length) playTrack(S.queue[S.qi < 0 ? 0 : S.qi]); return; }
  intentPlay = true;
  if (media.paused) media.play().catch(function () {}); else media.pause();
}
function shuffleQueue() {
  S.shuffle = !S.shuffle; paintControls();
  if (S.shuffle) {
    for (var i = S.queue.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = S.queue[i]; S.queue[i] = S.queue[j]; S.queue[j] = t; }
    S.qi = 0; toast('Aléatoire activé'); persistQueue();
  }
}
function cycleRepeat() { S.repeat = S.repeat === 'off' ? 'all' : S.repeat === 'all' ? 'one' : 'off'; paintControls(); }
function seekTo(v) { if (!media || !media.duration) return; media.currentTime = (v / 1000) * media.duration; }

function moveQueue(from, to) {
  if (from === to || from < 0 || to < 0 || from >= S.queue.length || to >= S.queue.length) return;
  var t = S.queue.splice(from, 1)[0];
  S.queue.splice(to, 0, t);
  if (from === S.qi) S.qi = to;
  else if (from < S.qi && to >= S.qi) S.qi--;
  else if (from > S.qi && to <= S.qi) S.qi++;
  paintQueue(); paintNow(); persistQueue();
}
function removeQueue(i) {
  if (i < 0 || i >= S.queue.length) return;
  S.queue.splice(i, 1);
  if (i < S.qi) S.qi--;
  else if (i === S.qi) { S.qi = Math.min(S.qi, S.queue.length - 1); if (S.queue[S.qi]) playTrack(S.queue[S.qi]); }
  paintQueue(); paintNow(); persistQueue();
}
function persistQueue() { STORE.set(ukey('queue'), S.queue); STORE.set(ukey('qi'), S.qi); }
function restoreQueue() {
  var q = STORE.get(ukey('queue'), []);
  var i = STORE.get(ukey('qi'), -1);
  if (q && q.length) { S.queue = q; S.qi = i >= 0 && i < q.length ? i : 0; cur = S.queue[S.qi]; }
}

function setMediaSession() {
  if (!('mediaSession' in navigator) || !cur) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: cur.title, artist: cur.artist, artwork: cur.thumb ? [{ src: cur.thumb, sizes: '512x512', type: 'image/jpeg' }] : [] });
    navigator.mediaSession.setActionHandler('play', function () { media.play(); });
    navigator.mediaSession.setActionHandler('pause', function () { media.pause(); });
    navigator.mediaSession.setActionHandler('previoustrack', playPrev);
    navigator.mediaSession.setActionHandler('nexttrack', function () { playNext(false); });
  } catch (e) {}
}

/* ---------- téléchargement ---------- */
function downloadTrack(track) {
  if (!track || !track.id) return Promise.reject(new Error('titre'));
  toast('Téléchargement en cours…');
  return fetch(location.origin + '/musique/dl/' + encodeURIComponent(track.id)).then(function (r) {
    if (!r.ok) throw new Error('dl');
    return r.blob();
  }).then(function (blob) {
    return dlPut({ id: track.id, account: S.user || '', title: track.title, artist: track.artist, thumb: track.thumb, duration: track.duration, blob: blob, mime: blob.type, date: Date.now() });
  }).then(function () { return dlAll(); }).then(function (all) {
    S.downloads = all;
    toast('Téléchargé ✓');
    return true;
  }).catch(function () { toast('Téléchargement impossible'); throw new Error('dl'); });
}
function removeDownload(id) {
  return dlDel(id).then(function () { return dlAll(); }).then(function (all) { S.downloads = all; toast('Supprimé'); });
}

/* ---------- recherche / découverte ---------- */
function suggest(q) { return api('/suggestions?query=' + encodeURIComponent(q)).catch(function () { return []; }); }
function searchPage(q, filter, nextpage) {
  var u = '/search?q=' + encodeURIComponent(q) + '&filter=' + (filter || 'music_songs');
  if (nextpage) u += '&nextpage=' + encodeURIComponent(nextpage);
  return api(u);
}
function channel(id) { return api('/channel/' + id); }

/* ---------- ui primitives ---------- */
function toast(msg) {
  var t = $('#toast'); if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._t);
  t._t = setTimeout(function () { t.hidden = true; }, 2300);
}
function paintPlayState() {
  var a = $('#mini-play'), b = $('#btn-play');
  if (a) a.innerHTML = ico(S.playing ? 'pause' : 'play', 18);
  if (b) b.innerHTML = ico(S.playing ? 'pause' : 'play', 30);
}
function paintControls() {
  var sh = $('#btn-shuffle'), rp = $('#btn-repeat');
  if (sh) { sh.classList.toggle('on', S.shuffle); sh.innerHTML = ico('shuffle', 18); }
  if (rp) { rp.classList.toggle('on', S.repeat !== 'off'); rp.innerHTML = ico(S.repeat === 'one' ? 'repeat1' : 'repeat', 18); }
}
function paintNow() {
  var mini = $('#mini');
  if (!cur) { if (mini) mini.hidden = true; document.body.classList.remove('has-player'); return; }
  if (mini) mini.hidden = false;
  document.body.classList.add('has-player');
  if ($('#mini-art')) $('#mini-art').src = cur.thumb || '';
  if ($('#mini-title')) $('#mini-title').textContent = cur.title;
  if ($('#mini-sub')) $('#mini-sub').textContent = cur.artist || '';
  if ($('#player-art')) $('#player-art').src = cur.thumb || '';
  if ($('#sheet-bg')) $('#sheet-bg').style.backgroundImage = cur.thumb ? 'url("' + cur.thumb + '")' : 'none';
  if ($('#player-title')) $('#player-title').textContent = cur.title;
  if ($('#player-artist')) $('#player-artist').textContent = cur.artist || '';
  if ($('#t-dur')) $('#t-dur').textContent = fmt(cur.duration || 0);
  paintPlayState(); paintControls(); paintQueue(); paintFav();
}
function paintQueue() {
  var list = $('#queue-list'); if (!list) return;
  if ($('#queue-n')) $('#queue-n').textContent = S.queue.length ? '(' + S.queue.length + ')' : '';
  list.innerHTML = S.queue.map(function (t, i) {
    return '<div class="q-row ' + (i === S.qi ? 'playing' : '') + '" data-qi="' + i + '">' +
      '<button class="q-play" data-qi="' + i + '"><img class="track-art" src="' + esc(t.thumb) + '" alt="" loading="lazy" /></button>' +
      '<div class="track-txt" data-qi="' + i + '"><div class="track-title">' + esc(t.title) + '</div><div class="track-sub">' + esc(t.artist || '') + '</div></div>' +
      '<div class="q-tools"><button class="q-btn" data-qmove="' + i + '|-1" aria-label="Monter">' + ico('up', 15) + '</button>' +
      '<button class="q-btn" data-qmove="' + i + '|1" aria-label="Descendre">' + ico('down', 15) + '</button>' +
      '<button class="q-btn" data-qdel="' + i + '" aria-label="Retirer">' + ico('close', 14) + '</button></div></div>';
  }).join('') || '<div class="empty">File vide</div>';
}

loadUserData();

window.Sonora = {
  API: API, S: S, api: api, ico: ico, $: $, $$: $$, esc: esc, fmt: fmt, vid: vid, listId: listId,
  art: art, trackOf: trackOf, login: login, logout: logout,
  playTrack: playTrack, playNext: playNext, playPrev: playPrev, togglePlay: togglePlay,
  shuffleQueue: shuffleQueue, cycleRepeat: cycleRepeat, seekTo: seekTo,
  toast: toast, STORE: STORE, paintNow: paintNow, paintPlayState: paintPlayState,
  paintQueue: paintQueue, paintFav: paintFav, initMedia: initMedia,
  isFav: isFav, toggleFav: toggleFav, favs: function () { return S.favs; },
  createPlaylist: createPlaylist, addToPlaylist: addToPlaylist, loadPlaylists: loadPlaylists,
  moveQueue: moveQueue, removeQueue: removeQueue, persistQueue: persistQueue, restoreQueue: restoreQueue,
  downloadTrack: downloadTrack, removeDownload: removeDownload, dlAll: dlAll,
  suggest: suggest, searchPage: searchPage, channel: channel,
  getCur: function () { return cur; }, prefetch: prefetch, unlockMedia: unlockMedia,
  accounts: accounts, setActiveUser: setActiveUser, signOut: signOut, register: register,
  loadUserData: loadUserData, setVolume: setVolume
};
