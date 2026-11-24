/* Sonora - full interface: routes, i18n, favorites, queues, artists. */
'use strict';

var X = window.Sonora;
var S = X.S;
var $ = X.$, $$ = X.$$, esc = X.esc, fmt = X.fmt, ico = X.ico, api = X.api;
var SEARCH = [];
var NEXT = '';
var PLVIEW = { tracks: [], id: '' };
var queued = false;

function L(fr, es) { return S.lang === 'es' ? es : fr; }
function route() {
  var h = location.hash.replace(/^#\/?/, '');
  var parts = h.split('/');
  var name = parts[0] || 'listen';
  S.tab = name === 'playlist' || name === 'artist' ? 'library' : name;
  $$('.tab').forEach(function (t) {
    var tab = t.getAttribute('data-tab');
    t.classList.toggle('on', tab === (name === 'playlist' || name === 'artist' ? 'library' : name));
  });
  if (name === 'search') return viewSearch(parts[1] ? decodeURIComponent(parts[1]) : '');
  if (name === 'library') return viewLibrary();
  if (name === 'playlist') return viewPlaylist(parts[1]);
  if (name === 'artist') return viewArtist(parts[1]);
  return viewListen();
}
function headings(html) { $('#headings').innerHTML = html; window.scrollTo(0, 0); translateSoon(); }
function view(html) {
  var v = $('#view');
  v.innerHTML = html;
  v.style.animation = 'none'; void v.offsetWidth; v.style.animation = '';
  translateSoon();
}
function shuffleArr(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } }

/* ---------- i18n ---------- */
var ES = {
  'Écouter': 'Escuchar', 'Rechercher': 'Buscar', 'Bibliothèque': 'Biblioteca',
  'Ta musique, sans pub, sans compte à créer.': 'Tu música, sin anuncios, sin crear cuenta.',
  'Ta musique.': 'Tu música.', 'Sans compromis.': 'Sin compromisos.',
  'Le catalogue YouTube Music, une interface qui respire.': 'El catálogo de YouTube Music, una interfaz que respira.',
  'Lecture aléatoire': 'Reproducción aleatoria',
  'Récemment écouté': 'Escuchado hace poco', 'Tes playlists': 'Tus listas', 'Tout voir': 'Ver todo',
  'Explorer par envie': 'Explora por gusto', 'Pour toi': 'Para ti', 'Tes playlists, ici': 'Tus listas, aquí',
  'Connecte-toi avec ton compte Sonora pour retrouver les playlists importées de YouTube Music.': 'Inicia sesión con tu cuenta Sonora para recuperar las listas importadas de YouTube Music.',
  'Se connecter': 'Iniciar sesión', 'Connexion': 'Iniciar sesión', 'Déconnexion': 'Cerrar sesión',
  'Nom d’utilisateur': 'Usuario', 'Mot de passe': 'Contraseña',
  'Favoris': 'Favoritos', 'Téléchargements': 'Descargas',
  'Charger plus': 'Cargar más', 'Aucun résultat.': 'Sin resultados.',
  'Titres': 'Canciones', 'Vidéos': 'Vídeos', 'Albums': 'Álbumes', 'Artistes': 'Artistas',
  'Tout YouTube Music, en un geste.': 'Todo YouTube Music, en un gesto.',
  'Artistes, titres, albums…': 'Artistas, canciones, álbumes…',
  'Lire': 'Reproducir', 'Aléatoire': 'Aleatorio', 'File d\'attente': 'Cola',
  'Ajouter à une playlist': 'Añadir a una lista', 'Télécharger': 'Descargar',
  'Artiste': 'Artista', 'Aucune playlist.': 'Ninguna lista.',
  'File vide': 'Cola vacía', 'Langue': 'Idioma',
  'Nouvelle playlist…': 'Nueva lista…', 'Créer': 'Crear',
  'Impossible de lire ce titre': 'No se puede reproducir esta canción',
  'Aucun favori pour l\'instant.': 'Aún no hay favoritos.',
  'Aucun téléchargement.': 'Ninguna descarga.',
  'Accueil': 'Inicio', 'Découvrir': 'Descubrir',
  'Changer de thème': 'Cambiar tema', 'Fermer': 'Cerrar',
  'Mon compte': 'Mi cuenta', 'Lecture': 'Reproducción'
};
var PATTERNS = [
  [/\b(\d+)\s+titres\b/g, '$1 canciones'],
  [/\b(\d+)\s+playlists\b/g, '$1 listas'],
  [/\bArtistes\b/g, 'Artistas']
];
function translateText(s) {
  if (S.lang !== 'es') return s;
  var trimmed = s.trim();
  if (!trimmed) return s;
  var out = ES[trimmed];
  if (out) return s.replace(trimmed, out);
  var r = s;
  r = r.replace(/\b(\d+)\s+titres\b/g, function (m, n) { return Number(n) === 1 ? '1 canción' : n + ' canciones'; });
  r = r.replace(/\b(\d+)\s+playlists\b/g, function (m, n) { return Number(n) === 1 ? '1 lista' : n + ' listas'; });
  return r;
}
function translateNode(root) {
  if (S.lang !== 'es') return;
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  var n, nodes = [];
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach(function (node) { var t = translateText(node.nodeValue); if (t !== node.nodeValue) node.nodeValue = t; });
  $$('input[placeholder]', root).forEach(function (i) {
    var p = i.getAttribute('placeholder');
    if (ES[p]) i.setAttribute('placeholder', ES[p]);
  });
}
var translateTimer = null;
function translateSoon() {
  if (S.lang !== 'es') return;
  clearTimeout(translateTimer);
  translateTimer = setTimeout(function () {
    var app = $('#app'); if (app) translateNode(app);
  }, 30);
}
var observer = new MutationObserver(function () { translateSoon(); });

/* ---------- home ---------- */
var MOODS = [
  { q: 'phonk', fr: 'Phonk', es: 'Phonk' }, { q: 'chill lofi', fr: 'Chill', es: 'Relax' },
  { q: 'rap français', fr: 'Rap FR', es: 'Rap FR' }, { q: 'afrobeats 2026', fr: 'Afrobeats', es: 'Afrobeats' },
  { q: 'french touch', fr: 'French Touch', es: 'French Touch' }, { q: 'r&b smooth', fr: 'R&B', es: 'R&B' },
  { q: 'jazz lounge', fr: 'Jazz', es: 'Jazz' }, { q: 'electro house', fr: 'Électro', es: 'Electro' }
];
function hello() {
  var h = new Date().getHours();
  if (S.lang === 'es') return h < 6 ? 'Buenas noches' : h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
  return h < 6 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bel après-midi' : 'Bonsoir';
}
function dateLbl() {
  var j = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  var jes = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var m = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var mes = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var n = new Date();
  return (S.lang === 'es' ? jes[n.getDay()] : j[n.getDay()]) + ' ' + n.getDate() + ' ' + (S.lang === 'es' ? mes[n.getMonth()] : m[n.getMonth()]);
}
function viewListen() {
  headings('');
  var recent = S.recent || [];
  var recentHtml = recent.length
    ? '<section class="section"><div class="section-head"><h2 class="section-title">Récemment écouté</h2></div><div class="row-scroll">' +
      recent.slice(0, 14).map(function (t) {
        return '<button class="card" data-play-id="' + esc(t.id) + '"><div class="card-art-wrap"><img class="card-art" src="' + esc(t.thumb) + '" alt="" loading="lazy" /><span class="card-play">' + ico('play', 15) + '</span></div><div class="card-title">' + esc(t.title) + '</div><div class="card-sub">' + esc(t.artist || '') + '</div></button>';
      }).join('') + '</div></section>' : '';
  var pls = S.playlists || [];
  var plHtml = pls.length
    ? '<section class="section"><div class="section-head"><h2 class="section-title">Tes playlists</h2><a class="section-link" href="#/library">Tout voir</a></div><div class="pl-grid">' +
      pls.slice(0, 6).map(function (p) {
        return '<button class="pl-card" data-pl="' + esc(p.id) + '"><img src="' + esc(p.thumbnail || '') + '" alt="" loading="lazy" /><span class="pl-card-shade"></span><span class="pl-card-txt"><span class="pl-card-name">' + esc(p.name) + '</span><span class="pl-card-count">' + (p.videos || 0) + ' titres</span></span></button>';
      }).join('') + '</div></section>'
    : '<section class="section"><div class="login-card"><h3>Tes playlists, ici</h3><p>' + L('Connecte-toi avec ton compte Sonora pour retrouver les playlists importées de YouTube Music.', 'Inicia sesión con tu cuenta Sonora para recuperar las listas importadas de YouTube Music.') + '</p><a class="btn-primary" href="#/library">' + L('Se connecter', 'Iniciar sesión') + ' ' + ico('back', 14) + '</a></div></section>';
  view(
    '<div class="chips" style="margin-top:18px">' + MOODS.map(function (m) { return '<button class="chip" data-mood="' + esc(m.q) + '">' + esc(S.lang === 'es' ? m.es : m.fr) + '</button>'; }).join('') + '</div>' +
    '<section class="section" id="mixes"><div class="section-head"><h2 class="section-title">' + L('Tes Mix', 'Tus Mix') + '</h2></div><div id="mixes-row" class="row-scroll"><div class="skel" style="width:152px;height:152px;border-radius:18px"></div><div class="skel" style="width:152px;height:152px;border-radius:18px"></div><div class="skel" style="width:152px;height:152px;border-radius:18px"></div></div></section>' +
    '<section class="section" id="for-you"><div class="section-head"><h2 class="section-title">' + L('Pour toi', 'Para ti') + '</h2><button class="section-link" id="mix-btn">✨ Mix</button></div><div id="foryou-row" class="row-scroll"><div class="skel" style="width:152px;height:152px;border-radius:18px"></div><div class="skel" style="width:152px;height:152px;border-radius:18px"></div><div class="skel" style="width:152px;height:152px;border-radius:18px"></div></div></section>' +
    recentHtml +
    '<section class="section"><div class="section-head"><h2 class="section-title">' + L('Explorer par envie', 'Explora por gusto') + '</h2></div><div class="chips">' +
      ['nouveautés 2026', 'top hits france', 'workout', 'voiture', 'soirée', 'concentration'].map(function (q) {
        return '<button class="chip" data-mood="' + esc(q) + '">' + esc(q.charAt(0).toUpperCase() + q.slice(1)) + '</button>';
      }).join('') + '</div></section>' +
    plHtml
  );
  if (S.token && !S.playlists.length && !S._plTente) { S._plTente = true; X.loadPlaylists().then(function () { if (S.tab === 'listen' && S.playlists.length) viewListen(); }).catch(function () {}); }
  loadMixes();
  loadForYou();
  var mb = $('#mix-btn');
  if (mb) mb.addEventListener('click', function (e) { e.preventDefault(); playMix(); });
}
function loadMixes() {
  var row = $('#mixes-row'); if (!row) return;
  if (!X.mixes) return;
  X.mixes().then(function (list) {
    if (!list || !list.length) { row.innerHTML = '<div class="empty" style="padding:18px 0;opacity:.6;font-size:13px">' + L('Écoute quelques titres pour créer tes Mix.', 'Escucha algunos títulos para crear tus Mix.') + '</div>'; return; }
    S._mixes = list;
    row.innerHTML = list.map(function (m) {
      var cover = (m.cover && m.cover[0]) ? 'https://i.ytimg.com/vi/' + m.cover[0] + '/mqdefault.jpg' : '';
      return '<button class="card mix-card" data-mix="' + esc(m.key) + '"><div class="card-art-wrap"><img class="card-art" src="' + esc(cover) + '" alt="" loading="lazy" /><span class="card-play">' + ico('play', 15) + '</span></div><div class="card-title">' + esc(m.name) + '</div><div class="card-sub">' + (m.count || 0) + ' titres</div></button>';
    }).join('');
  }).catch(function () { row.innerHTML = ''; });
}
function playDailyMix(mkey) {
  var m = (S._mixes || []).filter(function (x) { return x.key === mkey; })[0];
  if (!m || !m.tracks || !m.tracks.length) { X.toast('Mix vide'); return; }
  var tracks = m.tracks.map(function (t) { return { id: t.videoId || t.id, title: t.title || '', artist: t.artist || '', thumb: 'https://i.ytimg.com/vi/' + (t.videoId || t.id) + '/mqdefault.jpg', duration: t.duration || 0 }; }).filter(function (t) { return t.id; });
  if (!tracks.length) return;
  X.playTrack(tracks[0], tracks, 0);
}
function playMix() {
  if (!S.token || !X.mix) { X.toast(L('Connecte-toi pour ton Mix', 'Inicia sesión para tu Mix')); return; }
  X.toast('Mix…');
  X.mix(30).then(function (items) {
    var tracks = (items || []).map(function (t) { return { id: t.videoId || t.id, title: t.title || '', artist: t.artist || '', thumb: 'https://i.ytimg.com/vi/' + (t.videoId || t.id) + '/mqdefault.jpg', duration: t.duration || 0 }; }).filter(function (t) { return t.id; });
    if (!tracks.length) { X.toast('Mix indisponible'); return; }
    X.playTrack(tracks[0], tracks, 0);
  }).catch(function () { X.toast('Mix indisponible'); });
}
function heroPlay() {
  var pool = (S.favs || []).concat(S.recent || []);
  if (pool.length) { shuffleArr(pool); X.playTrack(pool[0], pool, 0); return; }
  if (S.playlists.length) {
    api('/playlists/' + S.playlists[0].id).then(function (d) {
      var tracks = (d.relatedStreams || []).map(X.trackOf).filter(function (t) { return t.id; });
      if (!tracks.length) { X.toast(L('Rien à lire pour le moment', 'Nada que reproducir')); return; }
      shuffleArr(tracks); X.playTrack(tracks[0], tracks, 0);
    }).catch(function () { X.toast('—'); });
    return;
  }
  api('/search?q=' + encodeURIComponent('mix musique 2026') + '&filter=music_songs').then(function (d) {
    var tracks = (d.items || []).map(X.trackOf).filter(function (t) { return t.id; });
    if (tracks.length) X.playTrack(tracks[0], tracks, 0);
  });
}
function loadForYou() {
  var row = $('#foryou-row'); if (!row) return;
  function net(id) { return 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg'; }
  function peindre(items) {
    if (!items || !items.length) {
      row.innerHTML = '<div class="empty" style="padding:18px 0;opacity:.6;font-size:13px">' + L('Écoute quelques titres, cette rangée suivra tes goûts.', 'Escucha algunos títulos y esta fila se adaptará a tus gustos.') + '</div>';
      return;
    }
    row.innerHTML = items.map(function (t) {
      var id = t.videoId || t.id;
      return '<div class="fy-item"><button class="card" data-track-card="' + esc(id) + '"><div class="card-art-wrap"><img class="card-art" src="' + esc(t.thumb || net(id)) + '" alt="" loading="lazy" /><span class="card-play">' + ico('play', 15) + '</span></div><div class="card-title">' + esc(t.title || '') + '</div><div class="card-sub">' + esc(t.artist || '') + '</div></button><button class="fy-hide" data-dismiss="' + esc(id) + '" aria-label="Pas intéressé" title="Pas intéressé">✕</button></div>';
    }).join('');
    X.S._foryou = items.map(function (t) { var id = t.videoId || t.id; return { id: id, title: t.title || '', artist: t.artist || '', thumb: t.thumb || net(id), duration: 0 }; });
  }
  if (X.recos) {
    X.recos(16).then(function (l) {
      peindre(l);
      var seeds = [];
      (l || []).forEach(function (x) { if (x.seed && seeds.indexOf(x.seed) < 0) seeds.push(x.seed); });
      var head = row.parentNode && row.parentNode.querySelector('.section-head');
      if (head && seeds.length) {
        var old = head.querySelector('.for-you-basis');
        if (old) old.remove();
        var sp = document.createElement('span');
        sp.className = 'for-you-basis';
        sp.style.cssText = 'font-size:11px;opacity:.55;margin-left:8px';
        sp.textContent = L('d’après ', 'según ') + seeds.slice(0, 3).join(' · ');
        head.appendChild(sp);
      }
    }).catch(function () { peindre([]); });
    return;
  }
  row.innerHTML = '';
}

/* ---------- search ---------- */
var FILTERS = [
  { k: 'music_songs', fr: 'Titres', es: 'Canciones' },
  { k: 'music_videos', fr: 'Vidéos', es: 'Vídeos' },
  { k: 'music_albums', fr: 'Albums', es: 'Álbumes' },
  { k: 'music_artists', fr: 'Artistes', es: 'Artistas' }
];
function viewSearch(q) {
  q = q || S.query || '';
  headings('<h1 class="h1">' + L('Rechercher', 'Buscar') + '</h1><p class="sub">' + L('Tout YouTube Music, en un geste.', 'Todo YouTube Music, en un gesto.') + '</p>');
  view('<div class="searchbar"><span class="s-ico">' + ico('search', 19) + '</span><input id="q" type="search" placeholder="' + L('Artistes, titres, albums…', 'Artistas, canciones, álbumes…') + '" value="' + esc(q) + '" autocomplete="off" autocapitalize="off" spellcheck="false" /><div id="suggest" class="suggest" hidden></div></div>' +
    '<div class="segmented" id="filters">' + FILTERS.map(function (f) { return '<button data-f="' + f.k + '" class="' + (S.searchFilter === f.k ? 'on' : '') + '">' + (S.lang === 'es' ? f.es : f.fr) + '</button>'; }).join('') + '</div>' +
    '<div id="results" class="list"></div>');
  var input = $('#q');
  var timer;
  var liveTimer;
  input.addEventListener('input', function () {
    clearTimeout(timer);
    var v = input.value.trim();
    clearTimeout(liveTimer);
    if (!v) { $('#suggest').hidden = true; return; }
    liveTimer = setTimeout(function () { $('#suggest').hidden = true; doSearch(v); }, 520);
    timer = setTimeout(function () {
      X.suggest(v).then(function (list) {
        var box = $('#suggest'); if (!box) return;
        if (!list || !list.length) { box.hidden = true; return; }
        box.innerHTML = list.slice(0, 7).map(function (s) { return '<button data-sugg="' + esc(s) + '">' + ico('search', 15) + esc(s) + '</button>'; }).join('');
        box.hidden = false;
      });
    }, 220);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { clearTimeout(timer); clearTimeout(liveTimer); $('#suggest').hidden = true; doSearch(input.value.trim()); }
  });
  $('#filters').addEventListener('click', function (e) {
    var b = e.target.closest('[data-f]'); if (!b) return;
    S.searchFilter = b.getAttribute('data-f');
    $$('#filters button').forEach(function (x) { x.classList.toggle('on', x === b); });
    doSearch($('#q').value.trim());
  });
  if (q) doSearch(q); else $('#results').innerHTML = '<div class="empty">' + ico('search', 34) + '<div>' + L('Cherche un artiste, un titre, une ambiance.', 'Busca un artista, una canción, un ambiente.') + '</div></div>';
}
function doSearch(q) {
  S.query = q;
  var box = $('#results'); if (!box) return;
  if (!q) { box.innerHTML = ''; return; }
  box.innerHTML = new Array(6).join('<div class="skel" style="height:64px;margin:8px 0"></div>');
  X.searchPage(q, S.searchFilter).then(function (d) {
    var items = d.items || []; SEARCH = items; NEXT = d.nextpage || '';
    if (!items.length) { box.innerHTML = '<div class="empty">' + L('Aucun résultat.', 'Sin resultados.') + '</div>'; return; }
    if (S.searchFilter === 'music_albums' || S.searchFilter === 'music_playlists') {
      box.innerHTML = '<div class="pl-grid" style="margin-top:8px">' + items.map(function (it) {
        return '<button class="pl-card" data-pl="' + esc(X.listId(it.url) || it.id) + '"><img src="' + esc(X.art(it)) + '" alt="" loading="lazy" /><span class="pl-card-shade"></span><span class="pl-card-txt"><span class="pl-card-name">' + esc(it.name || it.title) + '</span><span class="pl-card-count">' + esc(it.uploaderName || '') + '</span></span></button>';
      }).join('') + '</div>';
      return;
    }
    if (S.searchFilter === 'music_artists') {
      box.innerHTML = items.map(function (it) {
        var cid = (it.url || '').split('/channel/')[1] || '';
        return '<button class="track" data-artist-id="' + esc(cid) + '"><img class="track-art" src="' + esc(X.art(it)) + '" alt="" loading="lazy" /><div class="track-txt"><div class="track-title">' + esc(it.name || it.title) + '</div><div class="track-sub">' + L('Artiste', 'Artista') + '</div></div></button>';
      }).join('');
      return;
    }
    renderTracks(box, items);
    if (NEXT) box.insertAdjacentHTML('beforeend', '<button class="load-more" id="more">' + L('Charger plus', 'Cargar más') + '</button>');
    if (NEXT) $('#more').addEventListener('click', loadMore);
  }).catch(function () { box.innerHTML = '<div class="empty">Erreur.</div>'; });
}
function loadMore() {
  var box = $('#results'); if (!box || !NEXT) return;
  var btn = $('#more'); if (btn) btn.textContent = '…';
  X.searchPage(S.query, S.searchFilter, NEXT).then(function (d) {
    NEXT = d.nextpage || '';
    var items = (d.items || []).filter(function (i) { return i.type === 'stream'; });
    var tracks = items.map(X.trackOf).filter(function (t) { return t.id; });
    if (btn) btn.remove();
    box._tracks = (box._tracks || []).concat(tracks);
    var start = (box._tracks.length - tracks.length);
    box.insertAdjacentHTML('beforeend', tracks.map(function (t, i) {
      return '<button class="track" data-track="' + (start + i) + '"><img class="track-art" src="' + esc(t.thumb) + '" alt="" loading="lazy" /><div class="track-txt"><div class="track-title">' + esc(t.title) + '</div><div class="track-sub">' + esc(t.artist || '') + '</div></div><span class="track-dur">' + fmt(t.duration) + '</span></button>';
    }).join(''));
    if (NEXT) box.insertAdjacentHTML('beforeend', '<button class="load-more" id="more">' + L('Charger plus', 'Cargar más') + '</button>');
    if (NEXT) $('#more').addEventListener('click', loadMore);
  });
}
function renderTracks(box, items) {
  var tracks = items.map(function (x) { return x && x.thumb !== undefined && x.id !== undefined ? x : X.trackOf(x); }).filter(function (t) { return t.id; });
  box._tracks = tracks;
  tracks.slice(0, 3).forEach(function (t) { if (t && t.id) X.prefetch(t.id); });
  box.innerHTML = tracks.map(function (t, i) {
    return '<div class="track" role="button" data-track="' + i + '">' +
      '<img class="track-art" src="' + esc(t.thumb) + '" alt="" loading="lazy" />' +
      '<div class="track-txt"><div class="track-title">' + esc(t.title) + '</div><div class="track-sub">' + esc(t.artist || '') + '</div></div>' +
      '<button class="tlike" type="button" data-tlike="' + esc(t.id) + '" data-title="' + esc(t.title) + '" data-artist="' + esc(t.artist || '') + '" aria-label="Me gusta">♥</button>' +
      '<span class="track-dur">' + fmt(t.duration) + '</span></div>';
  }).join('');
}

/* ---------- library ---------- */
function langRowHtml() {
  return '<div class="setting-row"><b>' + L('Langue', 'Idioma') + '</b><div class="seg-lang"><button data-lang="fr" class="' + (S.lang === 'fr' ? 'on' : '') + '">FR</button><button data-lang="es" class="' + (S.lang === 'es' ? 'on' : '') + '">ES</button></div></div>';
}
function accountsBar() {
  var list = X.accounts();
  if (!list.length) return '';
  var chips = list.map(function (a) {
    return '<button class="acc-chip ' + (a.user === S.user ? 'on' : '') + '" data-account="' + esc(a.user) + '">' + ico('note', 14) + esc(a.user) + '</button>';
  }).join('');
  return '<div class="accounts">' + chips + (S.token ? '<button class="acc-add" id="acc-add">' + ico('plus', 15) + ' ' + L('Ajouter un compte', 'Añadir cuenta') + '</button>' : '') + '</div>';
}
function loginFormHtml(prefix) {
  return '<form id="' + prefix + '-form"><div class="field"><input id="' + prefix + '-user" placeholder="' + L('Nom d’utilisateur', 'Usuario') + '" autocapitalize="none" autocomplete="username" /></div>' +
    '<div class="field"><input id="' + prefix + '-pass" type="password" placeholder="' + L('Mot de passe', 'Contraseña') + '" autocomplete="current-password" /></div>' +
    '<button class="btn-wide" type="submit">' + L('Se connecter', 'Iniciar sesión') + '</button>' +
    '<button type="button" class="reg-link" id="' + prefix + '-reg">' + L('Créer un compte', 'Crear una cuenta') + '</button>' +
    '<div class="form-err" id="' + prefix + '-err"></div></form>';
}
function viewLibrary() {
  headings('<h1 class="h1">' + L('Bibliothèque', 'Biblioteca') + '</h1><p class="sub">' + L('Tes playlists, sur tous tes appareils.', 'Tus listas, en todos tus dispositivos.') + '</p>');
  var bar = accountsBar();
  if (!S.token) {
    view('<div class="login-card"><h3>' + L('Connexion', 'Iniciar sesión') + '</h3><p>' + L('Connecte-toi, ou crée un compte pour ta copine : chacun garde ses playlists et son historique.', 'Inicia sesión o crea una cuenta: cada uno conserva sus listas y su historial.') + '</p>' + loginFormHtml('l') + '</div>' + bar + langRowHtml());
    bindLogin('l'); bindLang(); bindAccounts();
    return;
  }
  view('<div class="account"><div><b>' + esc(S.user) + '</b><br/><span>' + (S.playlists.length ? S.playlists.length + ' listes' : '—') + '</span></div><button class="logout" id="logout">' + L('Déconnexion', 'Cerrar sesión') + '</button></div>' +
    bar +
    '<div id="addacc" hidden><div class="login-card" style="margin-top:14px"><h3>' + L('Ajouter un compte', 'Añadir cuenta') + '</h3><p>' + L('Un compte par personne, chacun ses playlists et son historique.', 'Una cuenta por persona, cada uno con sus listas e historial.') + '</p>' + loginFormHtml('a') + '</div></div>' +
    langRowHtml() +
    '<section class="lib-sec"><div class="lib-sec-head"><h2 class="lib-sec-title">' + L('Favoris', 'Favoritos') + '</h2><span class="section-link" id="fav-n"></span></div><div id="fav-list" class="list"></div></section>' +
    '<section class="lib-sec"><div class="lib-sec-head"><h2 class="lib-sec-title">' + L('Téléchargements', 'Descargas') + '</h2></div><div id="dl-list" class="list"></div></section>' +
    '<section class="lib-sec"><div class="lib-sec-head"><h2 class="lib-sec-title">' + L('Mes playlists', 'Mis listas') + '</h2></div><div id="lib-pl" class="pl-grid"></div></section>');
  bindLang(); bindAccounts(); bindLogin('a');
  var addBtn = $('#acc-add');
  if (addBtn) addBtn.addEventListener('click', function () { var w = $('#addacc'); if (w) w.hidden = !w.hidden; });
  var lg = $('#logout');
  if (lg) lg.addEventListener('click', function () { X.logout(); S.playlists = []; X.toast('Déconnecté'); viewLibrary(); });
  renderFavs(); renderDownloads();
  var box = $('#lib-pl');
  box.innerHTML = new Array(4).join('<div class="skel" style="aspect-ratio:1.35;border-radius:20px"></div>');
  X.loadPlaylists().then(function () { renderPlaylistGrid(box, S.playlists); }).catch(function () { box.innerHTML = '<div class="empty">—</div>'; });
}
function bindLogin(prefix) {
  bindLang();
  var form = $('#' + prefix + '-form');
  if (!form) return;
  var action = function (create) {
    var u = $('#' + prefix + '-user').value.trim(), p = $('#' + prefix + '-pass').value;
    var err = $('#' + prefix + '-err');
    if (!u || !p) { err.textContent = L('Remplis les deux champs.', 'Rellena los dos campos.'); return; }
    err.textContent = L('Connexion…', 'Conectando…');
    var fn = create ? X.register : X.login;
    fn(u, p).then(function () {
      S.playlists = [];
      return X.loadPlaylists().catch(function () {});
    }).then(function () { viewLibrary(); }).catch(function () {
      err.textContent = create ? L('Nom déjà pris ou invalide.', 'Nombre ya usado o inválido.') : L('Identifiants refusés.', 'Credenciales incorrectas.');
    });
  };
  form.addEventListener('submit', function (e) { e.preventDefault(); action(false); });
  var reg = $('#' + prefix + '-reg');
  if (reg) reg.addEventListener('click', function () { action(true); });
}
function bindAccounts() {
  $$('[data-account]').forEach(function (b) {
    b.addEventListener('click', function () {
      var name = b.getAttribute('data-account');
      if (name === S.user) return;
      X.setActiveUser(name);
      S.playlists = [];
      viewLibrary();
      X.loadPlaylists().then(function () { if (S.tab === 'library') viewLibrary(); }).catch(function () {});
    });
  });
}
function bindLang() {
  $$('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
  });
}
function setLang(l) {
  S.lang = l; X.STORE.set('lang', l);
  $('#lang-btn').textContent = l === 'fr' ? 'ES' : 'FR';
  route();
}
function renderFavs() {
  var box = $('#fav-list'); if (!box) return;
  var favs = S.favs || [];
  if ($('#fav-n')) $('#fav-n').textContent = favs.length ? (favs.length === 1 ? '1 titre' : favs.length + ' titres') : '';
  if (!favs.length) { box.innerHTML = '<div class="empty">' + L('Aucun favori pour l\'instant.', 'Aún no hay favoritos.') + '</div>'; return; }
  box.innerHTML = favs.map(function (t, i) {
    return '<button class="track" data-fav-play="' + i + '"><img class="track-art" src="' + esc(t.thumb) + '" alt="" loading="lazy" /><div class="track-txt"><div class="track-title">' + esc(t.title) + '</div><div class="track-sub">' + esc(t.artist || '') + '</div></div><span class="track-dur">' + fmt(t.duration) + '</span></button>';
  }).join('');
}
function renderDownloads() {
  var box = $('#dl-list'); if (!box) return;
  X.dlAll().then(function (list) {
    S.downloads = list || [];
    if (!list || !list.length) { box.innerHTML = '<div class="empty">' + L('Aucun téléchargement.', 'Ninguna descarga.') + '</div>'; return; }
    box.innerHTML = list.map(function (t, i) {
      return '<div class="dl-row"><button class="track" style="flex:1;padding:6px 0" data-dl-play="' + i + '"><img class="track-art" src="' + esc(t.thumb) + '" alt="" loading="lazy" /><div class="track-txt"><div class="track-title">' + esc(t.title) + '</div><div class="track-sub">' + esc(t.artist || '') + ' · ' + (t.blob.size / 1048576).toFixed(1) + ' Mo</div></div></button><button class="dl-del" data-dl-del="' + esc(t.id) + '" aria-label="Supprimer">' + ico('trash', 16) + '</button></div>';
    }).join('');
  });
}
function renderPlaylistGrid(box, list) {
  if (!list || !list.length) { box.innerHTML = '<div class="empty">' + L('Aucune playlist.', 'Ninguna lista.') + '</div>'; return; }
  box.className = 'lib-rows';
  box.innerHTML = list.map(function (p) {
    return '<div class="lib-row" role="button" data-pl="' + esc(p.id) + '">' +
      '<img class="lib-cover" src="' + esc(p.thumbnail || '') + '" alt="" loading="lazy">' +
      '<span class="lib-txt"><span class="lib-name">' + esc(p.name) + '</span>' +
      '<span class="lib-sub">' + L('Liste', 'Lista') + ' · ' + (p.videos || 0) + ' ' + L('titres', 'títulos') + '</span></span>' +
      '<span class="lib-more" data-pldel="' + esc(p.id) + '" role="button" aria-label="Eliminar">✕</span>' +
      '</div>';
  }).join('');
}

/* ---------- playlist / album ---------- */
function viewPlaylist(id) {
  if (!id) { location.hash = '#/library'; return; }
  headings('<button class="icon-btn" id="back" style="margin-bottom:14px" aria-label="Retour">' + ico('back', 18) + '</button>');
  $('#back').addEventListener('click', function () { history.length > 1 ? history.back() : (location.hash = '#/library'); });
  view('<div class="pl-hero"><div class="skel pl-art"></div></div>');
  api('/playlists/' + id).then(function (d) {
    var nom = (d.name || 'Playlist').replace(/^Album – /, '');
    var tracks = (d.relatedStreams || []).map(X.trackOf).filter(function (t) { return t.id; });
    if (nom && tracks.length === 0) {
      return X.searchPage(nom + ' ' + (d.uploader || ''), 'music_songs').then(function (s) {
        var alt = (s.items || []).map(X.trackOf).filter(function (t) { return t.id; }).slice(0, 40);
        return { d: d, tracks: alt };
      });
    }
    return { d: d, tracks: tracks };
  }).then(function (res) {
    var d = res.d, tracks = res.tracks;
    var nom = (d.name || 'Playlist').replace(/^Album – /, '');
    var art = d.thumbnailUrl || (tracks[0] && tracks[0].thumb) || '';
    headings('<button class="icon-btn" id="back" style="margin-bottom:14px" aria-label="Retour">' + ico('back', 18) + '</button>');
    $('#back').addEventListener('click', function () { history.length > 1 ? history.back() : (location.hash = '#/library'); });
    view('<div class="pl-hero"><div class="pl-hero-bg" style="background-image:url(&quot;' + esc(art) + '&quot;)"></div><img class="pl-art" src="' + esc(art) + '" alt="" /><h1 class="pl-name">' + esc(nom) + '</h1><div class="pl-meta">' + tracks.length + ' titres</div>' +
      '<div class="pl-actions"><button class="btn-primary" id="pl-play">' + ico('play', 16) + ' ' + L('Lire', 'Reproducir') + '</button><button class="btn-ghost" id="pl-shuffle">' + ico('shuffle', 16) + ' ' + L('Aléatoire', 'Aleatorio') + '</button></div></div><div class="list" id="pl-list"></div>');
    renderTracks($('#pl-list'), tracks);
    if (!tracks.length) $('#pl-list').innerHTML = '<div class="empty">' + L('Aucune piste disponible.', 'Ninguna pista disponible.') + '</div>';
    $('#pl-play').addEventListener('click', function () { if (tracks.length) X.playTrack(tracks[0], tracks, 0); });
    $('#pl-shuffle').addEventListener('click', function () { if (!tracks.length) return; var c = tracks.slice(); shuffleArr(c); X.playTrack(c[0], c, 0); });
  }).catch(function () { view('<div class="empty">' + L('Impossible de charger cette playlist.', 'No se puede cargar esta lista.') + '</div>'); });
}

/* ---------- artist ---------- */
function viewArtist(id) {
  if (!id) { location.hash = '#/library'; return; }
  headings('<button class="icon-btn" id="back" style="margin-bottom:14px" aria-label="Retour">' + ico('back', 18) + '</button>');
  $('#back').addEventListener('click', function () { history.length > 1 ? history.back() : (location.hash = '#/search'); });
  view('<div class="artist-hero"><div class="skel artist-avatar"></div></div>');
  X.channel(id).then(function (d) {
    var nom = d.name || 'Artiste';
    view('<div class="artist-hero"><img class="artist-avatar" src="' + esc(d.avatarUrl || '') + '" alt="" /><h1 class="artist-name">' + esc(nom) + '</h1><div class="artist-sub">' + esc((d.description || '').slice(0, 90)) + '</div></div><div class="section" style="margin-top:18px"><div class="section-head"><h2 class="section-title">' + L('Titres populaires', 'Canciones populares') + '</h2></div><div class="list" id="artist-list"></div></div>');
    return api('/search?q=' + encodeURIComponent(nom) + '&filter=music_songs').then(function (s) {
      var tracks = (s.items || []).map(X.trackOf).filter(function (t) { return t.id; }).slice(0, 25);
      renderTracks($('#artist-list'), tracks);
      if (!tracks.length) $('#artist-list').innerHTML = '<div class="empty">—</div>';
    });
  }).catch(function () { view('<div class="empty">Artiste introuvable.</div>'); });
}

/* ---------- interactions ---------- */
document.addEventListener('click', function (e) {
  var t;
  if ((t = e.target.closest('[data-play-id]'))) { var id = t.getAttribute('data-play-id'); var tr = (S.recent || []).find(function (x) { return x.id === id; }); if (tr) X.playTrack(tr); return; }
  if ((t = e.target.closest('[data-dismiss]'))) { e.preventDefault(); e.stopPropagation(); var did = t.getAttribute('data-dismiss'); if (X.feedback) X.feedback(did, 'dismiss').catch(function () {}); var item = t.closest('.fy-item'); if (item) item.remove(); X.toast('Moins de ce style'); return; }
  if ((t = e.target.closest('[data-mix]'))) { e.preventDefault(); playDailyMix(t.getAttribute('data-mix')); return; }
  if ((t = e.target.closest('[data-track-card]'))) { var id2 = t.getAttribute('data-track-card'); var fy = (X.S._foryou || []).find(function (x) { return x.id === id2; }); if (fy) X.playTrack(fy, X.S._foryou, X.S._foryou.indexOf(fy)); return; }
  if ((t = e.target.closest('[data-mood]'))) { location.hash = '#/search/' + encodeURIComponent(t.getAttribute('data-mood')); return; }
  if ((t = e.target.closest('[data-pl]'))) { location.hash = '#/playlist/' + t.getAttribute('data-pl'); return; }
  if ((t = e.target.closest('[data-artist-id]'))) { var cid = t.getAttribute('data-artist-id'); if (cid) location.hash = '#/artist/' + cid; return; }
  if ((t = e.target.closest('[data-sugg]'))) { var q = t.getAttribute('data-sugg'); var inp = $('#q'); if (inp) inp.value = q; var sg = $('#suggest'); if (sg) sg.hidden = true; doSearch(q); return; }
  if ((t = e.target.closest('[data-track]'))) {
    var box = t.parentElement; var tracks = box._tracks || []; var i = Number(t.getAttribute('data-track'));
    if (tracks[i]) X.playTrack(tracks[i], tracks, i); return;
  }
  if ((t = e.target.closest('[data-fav-play]'))) { var fi = Number(t.getAttribute('data-fav-play')); if (S.favs[fi]) X.playTrack(S.favs[fi], S.favs, fi); return; }
  if ((t = e.target.closest('[data-dl-play]'))) { var di = Number(t.getAttribute('data-dl-play')); var rec = S.downloads[di]; if (rec) { X.playTrack({ id: rec.id, title: rec.title, artist: rec.artist, thumb: rec.thumb, duration: rec.duration }); } return; }
  if ((t = e.target.closest('[data-dl-del]'))) { X.removeDownload(t.getAttribute('data-dl-del')).then(renderDownloads); return; }
  if ((t = e.target.closest('[data-qmove]'))) {
    var mv = t.getAttribute('data-qmove').split('|'); X.moveQueue(Number(mv[0]), Number(mv[0]) + Number(mv[1]));
    var nd = document.querySelector('[data-qmove="' + mv[0] + '|' + mv[1] + '"]'); return;
  }
  if ((t = e.target.closest('[data-qdel]'))) { X.removeQueue(Number(t.getAttribute('data-qdel'))); return; }
  if ((t = e.target.closest('.q-row'))) { var qi = Number(t.getAttribute('data-qi')); if (S.queue[qi]) X.playTrack(S.queue[qi]); return; }
  if (e.target.closest('#btn-fav')) { if (window.curTrackForFav) X.toggleFav(window.curTrackForFav); return; }
});
function paintFavBtn() {
  var c = X.S; // current track exposed via engine? use window
}
window.addEventListener('hashchange', route);

/* ---------- init ---------- */
function initTheme() {
  var t = X.STORE.get('theme', '');
  if (t) document.documentElement.setAttribute('data-theme', t);
  paintThemeBtn();
  $('#theme-btn').addEventListener('click', function () {
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    if (light) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', 'light');
    X.STORE.set('theme', light ? 'dark' : 'light');
    paintThemeBtn();
  });
}
function paintThemeBtn() {
  var light = document.documentElement.getAttribute('data-theme') === 'light';
  $('#theme-btn').innerHTML = ico(light ? 'moon' : 'sun', 18);
}
function openAddSheet() {
  if (!S.token) { X.toast(L('Connecte-toi d\'abord', 'Inicia sesión primero')); return; }
  var box = $('#addlist');
  box.innerHTML = '<div class="empty">…</div>';
  $('#addsheet').hidden = false;
  X.loadPlaylists().then(function () {
    box.innerHTML = S.playlists.map(function (p) {
      return '<button class="track" data-addpl="' + esc(p.id) + '"><div class="track-txt"><div class="track-title">' + esc(p.name) + '</div><div class="track-sub">' + (p.videos || 0) + ' titres</div></div>' + ico('plus', 16) + '</button>';
    }).join('') || '<div class="empty">Aucune playlist.</div>';
  });
}
function initPlayerUi() {
  X.initMedia();
  var vol = $('#vol');
  if (vol) {
    vol.value = String(Math.round((S.volume || 0.9) * 100));
    vol.addEventListener('input', function () { X.setVolume(Number(vol.value) / 100); });
  }
  X.setVolume(S.volume || 0.9);
  if ($('#vol-ico')) $('#vol-ico').innerHTML = ico('listen', 19);
  $('#btn-prev').innerHTML = ico('prev', 32);
  $('#btn-next').innerHTML = ico('next', 32);
  $('#mini-next').innerHTML = ico('next', 18);
  $('#player-close').innerHTML = ico('close', 16);
  $('#queue-close').innerHTML = ico('close', 16);
  $('#addsheet-close').innerHTML = ico('close', 16);
  $('#btn-fav').innerHTML = ico('heart', 19);
  $('#btn-addpl').innerHTML = ico('plus', 19);
  $('#btn-dl').innerHTML = ico('download', 19);
  $('#mini').addEventListener('click', function (e) { if (e.target.closest('button')) return; $('#player').hidden = false; });
  $('#player-close').addEventListener('click', function () { $('#player').hidden = true; });
  $('#mini-play').addEventListener('click', X.togglePlay);
  $('#mini-next').addEventListener('click', function () { X.playNext(false); });
  $('#btn-play').addEventListener('click', X.togglePlay);
  $('#btn-next').addEventListener('click', function () { X.playNext(false); });
  $('#btn-prev').addEventListener('click', X.playPrev);
  $('#btn-shuffle').addEventListener('click', X.shuffleQueue);
  $('#btn-repeat').addEventListener('click', X.cycleRepeat);
  $('#btn-fav').addEventListener('click', function () {
    var cur = X.getCur();
    if (cur) X.toggleFav(cur);
  });
  $('#btn-addpl').addEventListener('click', openAddSheet);
  if ($('#addsheet-close')) $('#addsheet-close').addEventListener('click', function () { $('#addsheet').hidden = true; });
  if ($('#new-pl-btn')) $('#new-pl-btn').addEventListener('click', function () {
    var name = $('#new-pl').value.trim(); if (!name) return;
    X.createPlaylist(name).then(function (pid) {
      var cur = X.getCur(); if (cur && pid) return X.addToPlaylist(pid, [cur.id]);
    }).then(function () { X.toast('Playlist créée'); $('#addsheet').hidden = true; $('#new-pl').value = ''; }).catch(function () { X.toast('Erreur'); });
  });
  $('#addlist').addEventListener('click', function (e) {
    var b = e.target.closest('[data-addpl]'); if (!b) return;
    var cur = X.getCur(); if (!cur) return;
    X.addToPlaylist(b.getAttribute('data-addpl'), [cur.id]).then(function () { X.toast(L('Ajouté ✓', 'Añadido ✓')); $('#addsheet').hidden = true; }).catch(function () { X.toast('Erreur'); });
  });
  $('#btn-dl').addEventListener('click', function () {
    var cur = X.getCur(); if (!cur) return;
    X.downloadTrack(cur).then(function () { if (S.tab === 'library') renderDownloads(); }).catch(function () {});
  });
  var seek = $('#seek');
  seek.addEventListener('input', function () { seekDragging = true; $('#t-cur').textContent = fmt((seek.value / 1000) * (X.getCur() ? X.getCur().duration : 0)); });
  seek.addEventListener('change', function () { seekDragging = false; X.seekTo(Number(seek.value)); });
  $('#queue-btn').addEventListener('click', function () { $('#queue').hidden = false; });
  $('#queue-close').addEventListener('click', function () { $('#queue').hidden = true; });
  document.addEventListener('keydown', function (e) {
    if (e.target.matches('input,textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); X.togglePlay(); }
    if (e.code === 'ArrowRight') X.playNext(false);
    if (e.code === 'ArrowLeft') X.playPrev();
  });
}
var seekDragging = false;
function boot() {
  var topEl = $('#top');
  if (topEl) {
    var onScroll = function () { topEl.classList.toggle('scrolled', window.scrollY > 10); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  $$('.tab-ico').forEach(function (s) { s.innerHTML = ico(s.getAttribute('data-ico'), 21); });
  initTheme();
  try { initPlayerUi(); } catch (e) { /* old cached version: continue */ }
  if ($('#lang-btn')) $('#lang-btn').textContent = S.lang === 'fr' ? 'ES' : 'FR';
  if ($('#lang-btn')) $('#lang-btn').addEventListener('click', function () { setLang(S.lang === 'fr' ? 'es' : 'fr'); });
  X.restoreQueue();
  if (X.S.queue && X.S.queue.length) { X.paintNow(); }
  X.dlAll().then(function (d) { S.downloads = d || []; });
  observer.observe($('#app'), { childList: true, subtree: true, characterData: true });
  if (S.token && !S.playlists.length) X.loadPlaylists().then(function () { if (S.tab === 'listen') viewListen(); }).catch(function () {});
  route();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
