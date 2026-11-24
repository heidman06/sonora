'use strict';
/* Couche minimale : coquille fixe, barres, logo, langue, traductions. Aucune retouche du lecteur. */
(function () {
  var CSS = [
    /* --- coquille : seul le contenu défile, barres fixes --- */
    'html,body{height:100%;width:100%;overflow:hidden;position:fixed;inset:0}',
    '#app{height:100dvh;min-height:0!important;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;',
      'overscroll-behavior:contain;padding-bottom:calc(150px + env(safe-area-inset-bottom,0px))!important}',
    'body.has-player #app{padding-bottom:calc(180px + env(safe-area-inset-bottom,0px))!important}',
    '#app{padding-left:20px!important;padding-right:20px!important}',
    '#view{padding-left:0!important;padding-right:0!important}',
    '.top{position:sticky!important;top:0;z-index:80!important;margin-left:-20px!important;margin-right:-20px!important;width:calc(100% + 40px)!important;',
      'padding-left:20px!important;padding-right:20px!important;border-radius:0!important;border-left:0!important;border-right:0!important;',
      'background:linear-gradient(180deg,rgba(7,7,10,.94),rgba(7,7,10,.6) 78%,transparent)!important;',
      'backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}',
    '.top-row{display:flex!important;align-items:center!important;gap:8px!important;width:100%!important}',
    '.top-row .brand{margin-right:auto!important;min-width:0!important}',

    /* --- barres détachées : fixed = viewport --- */
    'body>.tabs{position:fixed!important;left:50%!important;right:auto!important;',
      'bottom:calc(4px + env(safe-area-inset-bottom,0px))!important;transform:translateX(-50%)!important;',
      'z-index:90!important;display:flex!important;opacity:1!important;visibility:visible!important}',
    'body>.mini{position:fixed!important;left:14px!important;right:14px!important;margin:0 auto!important;',
      'bottom:calc(78px + env(safe-area-inset-bottom,0px))!important;z-index:85!important}',

    /* --- feuilles : opaques et bien empilées --- */
    '.sheet{background:#0b0b10!important;z-index:120!important}',
    'body>.tabs{z-index:90!important}',
    '#queue{z-index:140!important}',
    '#addsheet{z-index:150!important}',

    /* --- logo + bouton langue --- */
    '.brand-dot{width:30px!important;height:30px!important;border-radius:10px!important;background:none!important;display:grid!important;place-items:center!important;box-shadow:0 8px 20px -6px rgba(255,45,85,.6)!important}',
    '.brand-dot svg{width:100%;height:100%;display:block}',
    '#lang-btn{width:auto!important;height:38px!important;padding:0 13px!important;border-radius:999px!important;',
      'display:inline-flex!important;align-items:center!important;gap:6px!important;font-size:12.5px!important;font-weight:750!important;',
      'background:rgba(255,255,255,.09)!important;border:1px solid rgba(255,255,255,.16)!important}',
    '#lang-btn svg{width:15px;height:15px;opacity:.9}',
    '#theme-btn{width:38px!important;height:38px!important;border-radius:999px!important;display:grid!important;place-items:center!important;background:rgba(255,255,255,.09)!important;border:1px solid rgba(255,255,255,.16)!important}',

    /* --- divers sûrs --- */
    '[hidden]{display:none!important}',
    'img{max-width:100%}',
    '.vol{display:none!important}'
  ].join('');

  function styles() {
    if (document.getElementById('mus-polish')) return;
    var st = document.createElement('style');
    st.id = 'mus-polish';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* logo + globe */
  var LOGO = '<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset=".55" stop-color="#ff2d55"/><stop offset="1" stop-color="#ff8a3d"/></linearGradient></defs><rect width="40" height="40" rx="12" fill="url(#sg)"/><g fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"><path d="M13 24v-8"/><path d="M20 28V12"/><path d="M27 22v-4"/></g></svg>';
  var GLOBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8"/><path d="M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"/></svg>';

  function marque() {
    var d = document.querySelector('.brand-dot');
    if (d && d.dataset.logo !== '1') { d.innerHTML = LOGO; d.dataset.logo = '1'; }
    var lb = document.getElementById('lang-btn');
    if (lb && lb.dataset.globe !== '1') {
      var txt = (lb.textContent || 'ES').trim();
      lb.innerHTML = GLOBE + '<span>' + txt + '</span>';
      lb.dataset.globe = '1';
    }
  }

  /* détacher les barres pour qu'elles restent fixes */
  function detacher() {
    ['tabs', 'mini', 'player', 'addsheet', 'queue'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e && e.parentNode !== document.body) document.body.appendChild(e);
    });
  }

  /* traductions */
  function lang() { return (window.S && window.S.lang) || 'es'; }
  function traduire() {
    var es = lang() === 'es';
    var set = function (sel, txt) { var e = document.querySelector(sel); if (e && txt && e.textContent !== txt) e.textContent = txt; };
    set('.tab[data-tab="listen"] span:last-child', es ? 'Escuchar' : 'Écouter');
    set('.tab[data-tab="search"] span:last-child', es ? 'Buscar' : 'Rechercher');
    set('.tab[data-tab="library"] span:last-child', es ? 'Biblioteca' : 'Bibliothèque');
    set('#queue .queue-title', es ? 'Cola' : 'File d’attente');
    set('#addsheet .queue-title', es ? 'Añadir a una lista' : 'Ajouter à une playlist');
    set('#new-pl-btn', es ? 'Crear' : 'Créer');
    var np = document.querySelector('#new-pl');
    if (np) np.placeholder = es ? 'Nueva lista…' : 'Nouvelle playlist…';
  }

  function tous() { styles(); detacher(); marque(); traduire(); }
  tous();
  setTimeout(tous, 400);
  setTimeout(tous, 1500);
  setInterval(tous, 3000);
  window.addEventListener('hashchange', function () { setTimeout(tous, 80); });
})();
