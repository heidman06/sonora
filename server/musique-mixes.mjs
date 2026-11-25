// Builder pur des mixes personnalises (design mixes rev.2). Zero sqlite/reseau.
// Determinisme : tri stable + troncature AVANT tirage seedé (userId, seedJour UTC, mixKey).
import { CATALOGUE, ARTIST_MAP, POOL_NEUTRE, composerMoods, toucherMoods, normaliser, normaliserArtiste } from './musique-moods.mjs';

export const MIXES_VERSION = 2;
export const COQUILLES = ['moodNew', 'moodChill', 'moodPhonk'];

function hashGraine(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function melangerSeede(liste, graine) {
  const rnd = mulberry32(hashGraine(graine));
  const a = liste.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function uniques(tracks) {
  const vus = new Set(); const out = [];
  for (const t of tracks) { if (!t || !t.videoId || vus.has(t.videoId)) continue; vus.add(t.videoId); out.push(t); }
  return out;
}
function jaccard(a, b) {
  const sa = new Set(a.map((t) => t.videoId)); const sb = new Set(b.map((t) => t.videoId));
  let inter = 0; for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union ? inter / union : 0;
}
const nt = (row, source, seed) => ({ videoId: row.video_id || row.videoId || '', title: row.title || '', artist: row.artist || '', duration: Number(row.duration) || 0, seed: seed || row.artist || '', source });

export function composerMixes({ userId, seedJour, affinites, likes, history90, playlists, boucle, archives, rejetes, recos, corpusDistincts }) {
  if (corpusDistincts < 10) {
    return { v: MIXES_VERSION, cold: true, seed: seedJour, mixes: COQUILLES.map((moodId, i) => ({ key: 'cold' + (i + 1), labelKey: moodId, moodId, n: undefined, subtitleKey: 'mixColdSub', seeds: [], count: 0, cover: [], tracks: [] })) };
  }
  const rej = rejetes instanceof Set ? rejetes : new Set(rejetes || []);
  const corpus = new Map();
  const add = (rows, source) => { for (const r of rows || []) { const t = nt(r, source); if (t.videoId && !rej.has(t.videoId) && !corpus.has(t.videoId)) corpus.set(t.videoId, t); } };
  add(likes, 'like'); add(history90, 'history'); add(playlists, 'playlist'); add(boucle, 'history'); add(archives, 'archive');
  const all = Array.from(corpus.values());
  const parArtiste = new Map();
  for (const t of all) { const n = normaliserArtiste(t.artist); if (!n) continue; if (!parArtiste.has(n)) parArtiste.set(n, []); parArtiste.get(n).push(t); }
  const graine = (key) => userId + ':' + seedJour + ':' + key;
  const mixes = [];
  const emit = (m) => { if (m.tracks.length) mixes.push(m); };
  const mk = (key, labelKey, extra, tracks, permuter) => {
    let list = uniques(tracks).slice(0, 50);
    if (permuter) list = melangerSeede(list, graine(key));
    return Object.assign({ key, labelKey, count: list.length, cover: list.slice(0, 4).map((t) => t.videoId), tracks: list }, extra);
  };
  // deco : recos entrelacées + complément corpus seedé (jamais secours()/RANDOM)
  const base = uniques((recos || []).filter((r) => r && r.videoId && !rej.has(r.videoId)));
  const complement = melangerSeede(all, graine('deco-complement'));
  emit(mk('deco', 'mixDeco', { subtitleKey: 'mixDecoSub', seeds: [] }, base.concat(complement), false));
  // boucle : classement COUNT desc déterministe
  const boucleRows = (boucle || []).filter((r) => Number(r.c) >= 2);
  if (new Set(boucleRows.map((r) => r.video_id)).size >= 5) {
    const trs = boucleRows.map((r) => corpus.get(r.video_id) || nt(r, 'history'));
    emit(mk('boucle', 'mixBoucle', { subtitleKey: 'mixBoucleSub', seeds: [] }, trs.concat(likes.slice(0, 20).map((r) => nt(r, 'like'))), false));
  }
  // favoris : troncature 50 puis permutation seedée
  if ((likes || []).length >= 3) {
    const trs = likes.slice(0, 50).map((r) => nt(r, 'like'));
    const comp = history90.slice(0, 20).map((r) => nt(r, 'history'));
    emit(mk('favoris', 'mixFavoris', { subtitleKey: 'mixFavorisSub', seeds: [] }, trs.concat(comp), true));
  }
  // daily : ancres affinites, groupage JS normalisé, voisins ARTIST_MAP
  const ancres = [];
  const vusA = new Set();
  for (const seuil of [6.0, 4.0]) {
    for (const a of affinites || []) {
      if (ancres.length >= 4) break;
      if (a.p < seuil) continue;
      const n = normaliserArtiste(a.artiste);
      if (!n || vusA.has(n)) continue;
      vusA.add(n); ancres.push({ norm: n, brute: a.artiste, p: a.p });
    }
    if (ancres.length >= 3 || mixes.length >= 8) break;
  }
  ancres.forEach((ancre, i) => {
    let trs = (parArtiste.get(ancre.norm) || []).slice();
    trs = trs.concat((recos || []).filter((r) => r && r.seed === ancre.brute));
    if (trs.length >= 10) emit(mk('daily' + (i + 1), 'mixDailyName', { n: i + 1, subtitleKey: null, seeds: [{ t: 'artist', v: ancre.brute }] }, trs, true));
  });
  // mood : score neutre (POOL_NEUTRE), touching partagé
  const scored = composerMoods({ likes: (likes || []).map((l) => ({ title: l.title, artist: l.artist })), history: (history90 || []).map((h) => ({ title: h.title, artist: h.artist, at: h.at })), affinites, lang: 'fr', cold: false, pool: POOL_NEUTRE }).moods;
  const touchedParLigne = all.map((t) => ({ t, ids: toucherMoods([{ txt: normaliser((t.title || '') + ' ' + (t.artist || '')), p: 1 }], POOL_NEUTRE) }));
  const moodsPris = [];
  for (const seuil of [8, 4]) {
    for (const m of scored) {
      if (moodsPris.length >= 4) break;
      if (m.id === 'moodNew' || m.score < seuil || moodsPris.includes(m.id)) continue;
      moodsPris.push(m.id);
    }
    if (moodsPris.length >= 3 || mixes.length >= 8) break;
  }
  moodsPris.forEach((moodId, i) => {
    const trs = touchedParLigne.filter((x) => x.ids.has(moodId)).map((x) => x.t);
    for (const [n, ids] of ARTIST_MAP.entries()) if (ids.includes(moodId)) trs.push(...(parArtiste.get(n) || []));
    if (trs.length < 15) return;
    const compte = new Map();
    for (const t of trs) { const n = normaliserArtiste(t.artist); if (n) compte.set(n, (compte.get(n) || 0) + 1); }
    const top = Array.from(compte.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2);
    const brut = (n) => { const hit = trs.find((t) => normaliserArtiste(t.artist) === n); return hit ? hit.artist : n; };
    emit(mk('mood' + (i + 1), 'mixMoodName', { moodId, subtitleKey: null, seeds: top.map(([n]) => ({ t: 'artist', v: brut(n) })) }, trs, true));
  });
  // archives
  if (new Set((archives || []).map((r) => r.video_id)).size >= 30) {
    emit(mk('archives', 'mixArchives', { subtitleKey: 'mixArchivesSub', seeds: [] }, (archives || []).slice(0, 50).map((r) => corpus.get(r.video_id) || nt(r, 'archive')), true));
  }
  // escalier vers >= 8
  if (mixes.length < 8 && new Set(history90.map((r) => r.video_id)).size >= 10) {
    emit(mk('rotation', 'mixRotation', { subtitleKey: null, seeds: [{ t: 'key', v: 'history' }] }, history90.slice(0, 50).map((r) => nt(r, 'history')), true));
  }
  if (mixes.length < 8 && (playlists || []).length >= 10) {
    emit(mk('vrac', 'mixVrac', { subtitleKey: null, seeds: [{ t: 'key', v: 'playlists' }] }, playlists.slice(0, 50).map((r) => nt(r, 'playlist')), true));
  }
  // anti-doublon Jaccard > 0.8 : suppression du moindre prioritaire
  const prio = (k) => k === 'deco' ? 0 : k === 'favoris' ? 1 : k === 'boucle' ? 2 : k.startsWith('daily') ? 3 : k.startsWith('mood') ? 4 : k === 'archives' ? 5 : k === 'rotation' ? 6 : 7;
  const garde = [];
  for (const m of mixes.slice().sort((a, b) => prio(a.key) - prio(b.key))) {
    // deco = mix découverte : recouvrement assummé, exempté de la suppression
    if (m.key !== 'deco' && garde.some((g) => g.key !== 'deco' && jaccard(g.tracks, m.tracks) > 0.8)) continue;
    garde.push(m);
  }
  return { v: MIXES_VERSION, cold: false, seed: seedJour, mixes: garde.slice(0, 12) };
}