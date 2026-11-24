'use strict';
/* Traductions seules — aucun style, aucune mise en page. */
(function () {
  function lang() { return (window.S && window.S.lang) || 'en'; }
  function set(sel, txt) { var e = document.querySelector(sel); if (e && txt && e.textContent !== txt) e.textContent = txt; }
  function traduire() {
    var es = lang() === 'es';
    var en = lang() === 'en';
    set('.tab[data-tab="listen"] span:last-child', en ? 'Listen' : es ? 'Escuchar' : 'Écouter');
    set('.tab[data-tab="search"] span:last-child', en ? 'Search' : es ? 'Buscar' : 'Rechercher');
    set('.tab[data-tab="library"] span:last-child', en ? 'Library' : es ? 'Biblioteca' : 'Bibliothèque');
    set('#queue .queue-title', en ? 'Queue' : es ? 'Cola' : 'File d’attente');
    set('#addsheet .queue-title', en ? 'Add to playlist' : es ? 'Añadir a una lista' : 'Ajouter à une playlist');
    set('#new-pl-btn', en ? 'Create' : es ? 'Crear' : 'Créer');
    var np = document.querySelector('#new-pl');
    if (np) np.placeholder = en ? 'New playlist...' : es ? 'Nueva lista…' : 'Nouvelle playlist…';
  }

  var LOGO = '<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset=".55" stop-color="#ff2d55"/><stop offset="1" stop-color="#ff8a3d"/></linearGradient></defs><rect width="40" height="40" rx="12" fill="url(#sg)"/><g fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"><path d="M13 24v-8"/><path d="M20 28V12"/><path d="M27 22v-4"/></g></svg>';
  function logo() {
    var d = document.querySelector('.brand-dot');
    if (d && d.dataset.logo !== '1') { d.innerHTML = LOGO; d.dataset.logo = '1'; }
    var lb = document.getElementById('lang-btn');
    if (lb) {
      if (!lb.querySelector('svg')) {
        var txt = (lb.textContent || 'ES').trim();
        lb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:15px;height:15px;opacity:.9"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8"/><path d="M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"/></svg><span>' + txt + '</span>';
      } else {
        var sp = lb.querySelector('span');
        var actuel = ((lb.textContent || '').replace(/[^A-Za-z]/g, '')).trim();
        if (sp && actuel && sp.textContent !== actuel) sp.textContent = actuel;
      }
    }
  }
  logo();
  traduire();
  setInterval(function () { logo(); traduire(); }, 2000);
  window.addEventListener('hashchange', function () { setTimeout(traduire, 80); });
  document.addEventListener('click', function (e) {
    if (e.target.closest('#lang-btn')) setTimeout(traduire, 90);
  }, true);
})();
