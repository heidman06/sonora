'use strict';
/* Sonora ↔ /api/mus backend + UX tweaks (Spotify-like library) */
(function () {
  var PIPED = '/api/piped';
  var MUS = '/api/mus';

  function S() { return window.S || {}; }
  function tok() { return S().token || ''; }
  function hdrs(json) {
    var h = {};
    if (json) h['Content-Type'] = 'application/json';
    if (tok()) h['Authorization'] = 'Bearer ' + tok();
    return h;
  }
  function jfetch(url, method, body) {
    return fetch(url, { method: method || 'GET', headers: hdrs(true), cache: 'no-store', body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        if (r.status === 401) {
          try { if (window.Sonora && window.Sonora.logout) window.Sonora.logout(); } catch (e) {}
          try { localStorage.removeItem('active'); } catch (e) {}
          if (location.hash.indexOf('#/library') !== 0) location.hash = '#/library';
        }
        return r.text().then(function (t) {
          var d = {};
          try { d = JSON.parse(t); } catch (e) { d = { raw: t }; }
          if (!r.ok) throw new Error((d && d.error) || ('HTTP ' + r.status));
          return d;
        });
      });
  }
  function yimg(id) { return id ? 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg' : ''; }
  function trackDe(it) { return { id: it.videoId, title: it.title || '', artist: it.artist || '', thumb: yimg(it.videoId), duration: it.duration || 0 }; }

  function piped(path, opts) {
    opts = opts || {};
    var h = {}; /* never our token: Piped does not need it */
    return fetch(PIPED + path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : h,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  function api(path, opts) {
    opts = opts || {};
    if (path === '/login') return jfetch(MUS + '/login', 'POST', opts.body).then(function (d) { return { token: d.token, user: d.user }; });
    if (path === '/register') return jfetch(MUS + '/register', 'POST', opts.body).then(function (d) { return { token: d.token, user: d.user }; });
    if (path === '/user/playlists') {
      return jfetch(MUS + '/playlists').then(function (l) {
        return (l || []).map(function (p) { return { id: p.id, name: p.name, videos: p.count, thumbnail: yimg(p.cover && p.cover[0]) }; });
      });
    }
    if (path === '/user/playlists/create') return jfetch(MUS + '/playlists', 'POST', opts.body).then(function (d) { return { playlistId: d.id }; });
    if (path === '/user/playlists/add') {
      var pid = opts.body && opts.body.playlistId;
      var ids = (opts.body && opts.body.videoIds) || [];
      return Promise.all(ids.map(function (v) { return jfetch(MUS + '/playlists/' + pid + '/tracks', 'POST', { videoId: v }); })).then(function () { return { ok: true }; });
    }
    var m = /^\/playlists\/(\d+)$/.exec(path);
    if (m) {
      return jfetch(MUS + '/playlists/' + m[1]).then(function (d) {
        return {
          name: d.name,
          thumbnailUrl: yimg(d.tracks[0] && d.tracks[0].videoId),
          relatedStreams: (d.tracks || []).map(function (t) {
            return { url: '/watch?v=' + t.videoId, title: t.title, uploaderName: t.artist, thumbnail: yimg(t.videoId), duration: t.duration || 0 };
          })
        };
      });
    }
    return piped(path, opts);
  }
  window.api = api;
  if (window.Sonora) window.Sonora.api = api;

  /* ---------- styles ---------- */
  var CSS = [
    '.lib-rows{display:flex;flex-direction:column;gap:2px;margin-top:8px}',
    '.lib-row{display:flex;align-items:center;gap:13px;padding:8px;border-radius:12px;cursor:pointer;text-align:left}',
    '.lib-row:active{background:rgba(255,255,255,.07)}',
    '.lib-cover{width:54px;height:54px;border-radius:9px;object-fit:cover;background:#1b1e27;flex:none}',
    '.lib-txt{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}',
    '.lib-name{font-size:14.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.lib-sub{font-size:11.5px;opacity:.62;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.lib-more{flex:none;width:32px;height:32px;display:grid;place-items:center;border-radius:9px;font-size:13px;opacity:.5}',
    '.lib-more:active{background:rgba(255,255,255,.12);opacity:1}',
    '.track{cursor:pointer}',
    '.tlike{flex:none;width:32px;height:32px;border-radius:9px;border:none;background:transparent;color:inherit;opacity:.3;font-size:15px;cursor:pointer;line-height:1}',
    '.tlike.liked{opacity:1;color:#ff4d6d}',
    '.tlike:active{background:rgba(255,255,255,.12)}',
    '.pl-danger{margin-left:8px;padding:9px 14px;border-radius:999px;border:1px solid rgba(255,120,140,.5);background:rgba(255,77,109,.12);color:#ff8fa3;font:600 13px/1 inherit;cursor:pointer}'
  ].join('');
  function styles() {
    if (document.getElementById('mus-ux')) return;
    var st = document.createElement('style');
    st.id = 'mus-ux';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ---------- account synchronization ---------- */
  var syncFait = '';
  function synchroniser(force) {
    var u = S().user, t = tok();
    if (!t || !u) return Promise.resolve();
    if (!force && syncFait === u) return Promise.resolve();
    syncFait = u;
    return Promise.all([
      jfetch(MUS + '/likes').catch(function () { return []; }),
      jfetch(MUS + '/history?n=30').catch(function () { return []; }),
    ]).then(function (res) {
      var s = S();
      var likes = (res[0] || []).map(trackDe);
      var hist = (res[1] || []).map(trackDe);
      if (likes.length) {
        s.favs = likes;
        try { STORE.set(ukey('favs'), likes); } catch (e) {}
      }
      if (hist.length) {
        var vus = {};
        var fusion = hist.concat(s.recent || []).filter(function (x) {
          if (!x || !x.id || vus[x.id]) return false;
          vus[x.id] = 1; return true;
        }).slice(0, 30);
        s.recent = fusion;
        try { STORE.set(ukey('recent'), fusion); } catch (e) {}
      }
      marquerLikes();
      // single view refresh, and only if the "For You" row is empty
      var fy = document.getElementById('foryou-row');
      var vide = fy && fy.children.length === 0;
      if (vide && !window._fyRafraichi) {
        window._fyRafraichi = true;
        setTimeout(function () { window.dispatchEvent(new HashChangeEvent('hashchange')); }, 60);
      }
    });
  }

  function like(t) { return jfetch(MUS + '/likes', 'POST', { videoId: t.id, title: t.title, artist: t.artist }); }
  function unlike(id) { return jfetch(MUS + '/likes/' + id, 'DELETE'); }
  function delPlaylist(id) { return jfetch(MUS + '/playlists/' + id, 'DELETE'); }
  function pushHistory(t) {
    if (!t || !t.id || !tok()) return;
    jfetch(MUS + '/history', 'POST', { videoId: t.id, title: t.title, artist: t.artist }).catch(function () {});
  }
  function estLike(id) { return (S().favs || []).some(function (x) { return x.id === id; }); }

  function marquerLikes() {
    document.querySelectorAll('[data-tlike]').forEach(function (b) {
      b.classList.toggle('liked', estLike(b.getAttribute('data-tlike')));
    });
  }

  /* ---------- engine overrides ---------- */
  function brancher() {
    var X = window.Sonora;
    if (!X || X._musBranche) return;
    X._musBranche = true;

    var vraiToggle = X.toggleFav;
    X.toggleFav = function (track) {
      if (!track || !track.id) return false;
      (estLike(track.id) ? unlike(track.id) : like(track)).catch(function () {});
      var r = vraiToggle ? vraiToggle.call(X, track) : false;
      setTimeout(marquerLikes, 30);
      return r;
    };

    var vraiPlay = X.playTrack;
    X.playTrack = function (track, queue, index) {
      pushHistory(track);
      return vraiPlay ? vraiPlay.call(X, track, queue, index) : undefined;
    };

    var vraiLogin = X.login;
    if (vraiLogin) X.login = function (u, p) { return vraiLogin.call(X, u, p).then(function (d) { syncFait = ''; return synchroniser(true).then(function () { return d; }); }); };
    var vraiSet = X.setActiveUser;
    if (vraiSet) X.setActiveUser = function (n) { vraiSet.call(X, n); syncFait = ''; synchroniser(true); };
    var vraiLoad = X.loadPlaylists;
    if (vraiLoad) {
      X.loadPlaylists = function () {
        var r = vraiLoad.apply(X, arguments);
        if (r && r.then) r.then(function (l) { setTimeout(rafraichir, 80); return l; });
        return r;
      };
    }
    X.recos = function (n) { if (!(window.S && window.S.token)) return Promise.resolve([]); return jfetch(MUS + '/recos?n=' + (n || 16)); };
    X.mix = function (n) { if (!(window.S && window.S.token)) return Promise.resolve([]); return jfetch(MUS + '/mix?n=' + (n || 30)); };
    X.feedback = function (videoId, action) { if (!(window.S && window.S.token)) return Promise.resolve(null); return jfetch(MUS + '/feedback', 'POST', { videoId: videoId, action: action || 'dismiss' }); };
    X.mixes = function () { if (!(window.S && window.S.token)) return Promise.resolve([]); return jfetch(MUS + '/mixes'); };
    X.deletePlaylist = delPlaylist;
  }

  /* ---------- interactions ---------- */
  document.addEventListener('click', function (e) {
    var like0 = e.target.closest('[data-tlike]');
    if (like0) {
      e.stopPropagation();
      e.preventDefault();
      var id = like0.getAttribute('data-tlike');
      var tr = { id: id, title: like0.getAttribute('data-title') || '', artist: like0.getAttribute('data-artist') || '', thumb: yimg(id) };
      var favs = S().favs || [];
      if (estLike(id)) {
        unlike(id).catch(function () {});
        S().favs = favs.filter(function (x) { return x.id !== id; });
      } else {
        like(tr).catch(function () {});
        S().favs = [tr].concat(favs);
      }
      try { STORE.set(ukey('favs'), S().favs); } catch (err) {}
      marquerLikes();
      if (window.Sonora && window.Sonora.toast) window.Sonora.toast(estLike(id) ? 'En favoritos' : 'Retirado');
      return;
    }
    var lrow = e.target.closest('.lib-row[data-pl]');
    if (lrow) { noterOuverture(lrow.getAttribute('data-pl')); }
    var del = e.target.closest('[data-pldel]');
    if (del) {
      e.stopPropagation();
      e.preventDefault();
      if (!confirm('¿Eliminar esta lista?')) return;
      var pid = del.getAttribute('data-pldel');
      delPlaylist(pid).then(function () {
        var row = del.closest('.lib-row');
        if (row) row.remove();
        if (window.Sonora && window.Sonora.toast) window.Sonora.toast('Lista eliminada');
        var s = S();
        if (s.playlists) s.playlists = s.playlists.filter(function (p) { return String(p.id) !== String(pid); });
      });
      return;
    }
  }, true);


  /* ---------- favorites: single row + dedicated view ---------- */
  function masquerFavsNatif() {
    var natif = document.getElementById('fav-list');
    if (!natif) return;
    var sec = natif.closest('section');
    if (sec && sec.style.display !== 'none') sec.style.display = 'none';
  }

  function ligneFavoris() {
    var lib = document.getElementById('lib-pl');
    if (!lib) return;
    var zone = lib.parentNode;
    if (!zone || document.getElementById('likes-row')) return;
    var n = (S().favs || []).length;
    var row = document.createElement('div');
    row.id = 'likes-row';
    row.className = 'lib-row';
    row.style.marginBottom = '4px';
    row.innerHTML =
      '<span class="lib-cover" style="display:grid;place-items:center;background:linear-gradient(135deg,#4b3bff,#ff4d6d);color:#fff;font-size:22px">♥</span>' +
      '<span class="lib-txt"><span class="lib-name">Títulos que te gustan</span>' +
      '<span class="lib-sub">Playlist · ' + n + ' títulos</span></span>' +
      '<span class="lib-more" role="button" aria-label="Abrir">›</span>';
    row.addEventListener('click', function (e) {
      if (e.target.closest('.lib-more') || true) ouvrirFavoris();
    });
    zone.insertBefore(row, zone.firstChild);
  }

  function ouvrirFavoris() {
    var t = S().token;
    var panel = document.createElement('div');
    panel.id = 'likes-view';
    panel.style.cssText = 'position:fixed;inset:0;z-index:2147482500;background:#0b0b10;overflow:auto;' +
      'padding:calc(14px + env(safe-area-inset-top,0px)) 14px calc(90px + env(safe-area-inset-bottom,0px));' +
      'font:15px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text",Roboto,sans-serif;color:#f2f3f7';
    panel.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">' +
      '<button id="likes-back" type="button" style="width:38px;height:38px;border-radius:50%;border:none;background:rgba(255,255,255,.08);color:#fff;font-size:17px;cursor:pointer">‹</button>' +
      '<div><div style="font-size:19px;font-weight:700;letter-spacing:-.02em">Títulos que te gustan</div>' +
      '<div id="likes-count" style="font-size:12px;opacity:.6">—</div></div></div>' +
      '<div id="likes-body" style="margin-top:10px"></div>';
    document.body.appendChild(panel);
    panel.querySelector('#likes-back').onclick = function () { panel.remove(); };

    function peindre() {
      var favs = S().favs || [];
      var c = panel.querySelector('#likes-count');
      if (c) c.textContent = favs.length + ' títulos';
      var body = panel.querySelector('#likes-body');
      if (!favs.length) { body.innerHTML = '<div style="padding:30px 0;text-align:center;opacity:.55">Sin títulos todavía</div>'; return; }
      body.innerHTML = favs.map(function (x, i) {
        return '<div class="track" role="button" data-lkplay="' + i + '" style="display:flex;align-items:center;gap:12px;padding:8px;border-radius:10px;cursor:pointer">' +
          '<img src="' + (x.thumb || '') + '" alt="" loading="lazy" style="width:46px;height:46px;border-radius:7px;object-fit:cover;background:#1b1e27;flex:none">' +
          '<div style="min-width:0;flex:1"><div style="font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + String(x.title || '').replace(/[<>&]/g, '') + '</div>' +
          '<div style="font-size:11.5px;opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + String(x.artist || '').replace(/[<>&]/g, '') + '</div></div>' +
          '<button type="button" data-lkheart="' + i + '" style="flex:none;width:32px;height:32px;border-radius:9px;border:none;background:transparent;color:#ff4d6d;font-size:15px;cursor:pointer">♥</button>' +
          '</div>';
      }).join('');
      body.querySelectorAll('[data-lkplay]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          if (e.target.closest('[data-lkheart]')) return;
          var i = Number(b.getAttribute('data-lkplay'));
          window.Sonora.playTrack(favs[i], favs, i);
        });
      });
      body.querySelectorAll('[data-lkheart]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          var i = Number(b.getAttribute('data-lkheart'));
          var x = favs[i];
          if (!x) return;
          unlike(x.id).catch(function () {});
          S().favs = favs.filter(function (y) { return y.id !== x.id; });
          try { STORE.set(ukey('favs'), S().favs); } catch (err) {}
          peindre();
          var row = document.getElementById('likes-row');
          if (row) { row.remove(); ligneFavoris(); }
        });
      });
    }
    peindre();
    if (t) {
      jfetch(MUS + '/likes').then(function (l) {
        S().favs = (l || []).map(trackDe);
        try { STORE.set(ukey('favs'), S().favs); } catch (e) {}
        peindre();
      }).catch(function () {});
    }
  }


  /* ---------- library sorting (Recent / A-Z) ---------- */
  var TRI_KEY = 'mus.sort';
  function triMode() { try { return localStorage.getItem(TRI_KEY) || 'recent'; } catch (e) { return 'recent'; } }
  function setTriMode(m) { try { localStorage.setItem(TRI_KEY, m); } catch (e) {} }

  function derniers() {
    try { return JSON.parse(localStorage.getItem('mus.lastopen') || '{}'); } catch (e) { return {}; }
  }
  function noterOuverture(id) {
    try {
      var d = derniers();
      d[String(id)] = Date.now();
      localStorage.setItem('mus.lastopen', JSON.stringify(d));
    } catch (e) {}
  }

  function trier() {
    var grille = document.getElementById('lib-pl');
    if (!grille) return;
    var lignes = Array.prototype.slice.call(grille.querySelectorAll('.lib-row'));
    if (lignes.length < 2) return;
    var mode = triMode();
    var when = derniers();
    lignes.sort(function (a, b) {
      if (mode === 'az') {
        var na = (a.querySelector('.lib-name') || {}).textContent || '';
        var nb = (b.querySelector('.lib-name') || {}).textContent || '';
        return na.localeCompare(nb, 'es', { sensitivity: 'base' });
      }
      var ia = when[a.getAttribute('data-pl')] || 0;
      var ib = when[b.getAttribute('data-pl')] || 0;
      if (ia === ib) {
        var xa = (a.querySelector('.lib-name') || {}).textContent || '';
        var xb = (b.querySelector('.lib-name') || {}).textContent || '';
        return xa.localeCompare(xb, 'es', { sensitivity: 'base' });
      }
      return ib - ia;
    });
    var actuel = Array.prototype.slice.call(grille.querySelectorAll('.lib-row'));
    var change = lignes.some(function (l, i) { return l !== actuel[i]; });
    if (!change) return;
    lignes.forEach(function (l) { grille.appendChild(l); });
  }

  function barreTri() {
    var grille = document.getElementById('lib-pl');
    if (!grille || document.getElementById('lib-sort')) return;
    var zone = grille.parentNode;
    var bar = document.createElement('div');
    bar.id = 'lib-sort';
    bar.style.cssText = 'display:flex;gap:7px;margin:10px 0 2px';
    bar.innerHTML = '<button type="button" data-sort="recent" class="lib-sort-btn">Recientes</button>' +
      '<button type="button" data-sort="az" class="lib-sort-btn">A–Z</button>';
    zone.insertBefore(bar, grille);
    bar.querySelectorAll('[data-sort]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        setTriMode(b.getAttribute('data-sort'));
        peindreTri();
        trier();
      });
    });
    peindreTri();
  }

  function peindreTri() {
    var mode = triMode();
    document.querySelectorAll('[data-sort]').forEach(function (b) {
      var on = b.getAttribute('data-sort') === mode;
      b.style.cssText = 'font:inherit;font-size:12.5px;font-weight:600;padding:7px 13px;border-radius:999px;cursor:pointer;' +
        'border:1px solid ' + (on ? 'transparent' : 'rgba(255,255,255,.14)') + ';' +
        'background:' + (on ? '#f2f3f7' : 'rgba(255,255,255,.05)') + ';' +
        'color:' + (on ? '#0a0a0f' : '#c9cfe0');
    });
  }

  /* ---------- + button in player ---------- */
  function boutonAjout() {
    var barre = document.querySelector('.player-foot') || document.querySelector('.foot');
    if (!barre || document.getElementById('btn-addpl')) return;
    var btn = document.createElement('button');
    btn.id = 'btn-addpl';
    btn.className = 'foot-btn';
    btn.type = 'button';
    btn.textContent = '+';
    btn.setAttribute('aria-label', 'Añadir a una lista');
    btn.onclick = function () {
      var cur = window.curTrackForFav;
      if (!cur || !cur.id) { if (window.Sonora.toast) window.Sonora.toast('Nada sonando'); return; }
      api('/user/playlists').then(function (l) {
        if (!l.length) { alert('Crea primero una lista'); return; }
        var txt = l.map(function (p, i) { return (i + 1) + ') ' + p.name; }).join('\n');
        var r = prompt('Añadir «' + cur.title + '» a:\n' + txt + '\n\nNúmero:');
        var i = parseInt(r, 10) - 1;
        if (isNaN(i) || !l[i]) return;
        jfetch(MUS + '/playlists/' + l[i].id + '/tracks', 'POST', { videoId: cur.id, title: cur.title, artist: cur.artist })
          .then(function () { if (window.Sonora.toast) window.Sonora.toast('Añadido a ' + l[i].name); })
          .catch(function () {});
      });
    };
    barre.appendChild(btn);
  }

  /* ---------- delete playlist from its page ---------- */
  function boutonSupprHero() {
    var actions = document.querySelector('.pl-actions');
    if (!actions || actions.querySelector('.pl-danger')) return;
    var hash = location.hash || '';
    var m = /#\/playlist\/(\d+)/.exec(hash);
    if (!m) return;
    var b = document.createElement('button');
    b.className = 'pl-danger';
    b.type = 'button';
    b.textContent = 'Eliminar';
    b.onclick = function () {
      if (!confirm('¿Eliminar esta lista?')) return;
      delPlaylist(m[1]).then(function () {
        if (window.Sonora && window.Sonora.toast) window.Sonora.toast('Lista eliminada');
        location.hash = '#/library';
      });
    };
    actions.appendChild(b);
  }

  var rafT = null, rafBusy = false;
  function masquerDescargasVide() {
    var dl = document.getElementById('dl-list');
    if (!dl) return;
    var sec = dl.closest('section');
    if (!sec) return;
    var vide = dl.children.length === 0 || (dl.children.length === 1 && /Ninguna|Aucun/.test(dl.textContent || ''));
    sec.style.display = vide ? 'none' : '';
  }

  function rafraichir() {
    if (rafT || rafBusy) return;
    rafT = setTimeout(function () {
      rafT = null; rafBusy = true;
      try {
        styles();
        var h = location.hash || '';
        if (h.indexOf('#/library') === 0 || h === '' || h === '#/') { masquerFavsNatif(); ligneFavoris(); barreTri(); trier(); }
        masquerDescargasVide(); boutonAjout(); boutonSupprHero();
      }
      catch (e) {}
      finally { setTimeout(function () { rafBusy = false; }, 60); }
    }, 140);
  }

  function demarrer() { styles(); brancher(); synchroniser(false); setTimeout(rafraichir, 250); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();

  window.addEventListener('hashchange', function () { setTimeout(rafraichir, 220); });
  setTimeout(rafraichir, 400);
  setTimeout(rafraichir, 1500);
})();
