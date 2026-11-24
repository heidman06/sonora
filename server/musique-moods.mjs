// Moods d'exploration personnalisés par compte (langue x gouts). Module PUR :
// zero import node:sqlite/reseau ; importe par musique.mjs et node:test.
// Design : docs/DESIGN-moods-personnalises.md (rev. 2).

export const MOODS_VERSION = 1;

const T = {
  phonk: ['phonk', 'montagem', 'funk br', 'brazilian phonk'],
  chill: ['lofi', 'lo fi', 'chillhop', 'chill mix'],
  afro: ['afrobeats', 'afrobeat', 'amapiano', 'afro house'],
  rnb: ['r&b', 'rnb', 'r and b', 'soul', 'neo soul'],
  electro: ['electro', 'house', 'techno', 'edm', 'tech house'],
  workout: ['workout', 'gym', 'fitness', 'training'],
  drive: ['night drive', 'drive', 'driving'],
  party: ['party', 'soiree', 'club', 'fiesta', 'reggaeton', 'regueton', 'perreo', 'latin', 'pop latino', 'cumbia', 'bachata', 'salsa'],
  focus: ['focus', 'study', 'concentration', 'piano', 'relaxing'],
};

const m = (id, q, tags) => ({ id, labelKey: id, q, tags: tags || [] });

export const CATALOGUE = {
  fr: [
    m('moodPhonk', 'phonk', T.phonk),
    m('moodChill', 'chill lofi', T.chill),
    m('moodRapFr', 'rap français', ['rap français', 'rap fr', 'french rap', 'drill fr']),
    m('moodAfro', 'afrobeats 2026', T.afro),
    m('moodFrenchTouch', 'french touch', ['french touch', 'french house']),
    m('moodRnb', 'r&b smooth', T.rnb),
    m('moodJazz', 'jazz lounge', ['jazz', 'bossa nova', 'lounge', 'swing']),
    m('moodElectro', 'electro house', T.electro),
    m('moodNew', 'nouveautés 2026'),
    m('moodHitsFr', 'top hits france', ['top hits france', 'hits france', 'nrj']),
    m('moodWorkout', 'workout', T.workout),
    m('moodDrive', 'voiture', T.drive),
    m('moodParty', 'soirée', T.party),
    m('moodFocus', 'concentration', T.focus),
  ],
  en: [
    m('moodPhonk', 'phonk', T.phonk),
    m('moodChill', 'chill lofi', T.chill),
    m('moodRapUs', 'hip hop rap', ['hip hop', 'rap', 'trap', 'drill']),
    m('moodAfro', 'afrobeats 2026', T.afro),
    m('moodIndie', 'indie alternative', ['indie', 'alternative rock', 'indie rock']),
    m('moodRnb', 'r&b smooth', T.rnb),
    m('moodJazz', 'jazz lounge', ['jazz', 'bossa nova', 'lounge', 'swing']),
    m('moodElectro', 'edm house', T.electro),
    m('moodNew', 'new music 2026'),
    m('moodHitsUs', 'top hits usa', ['top hits', 'billboard', 'hot 100']),
    m('moodWorkout', 'workout mix', T.workout),
    m('moodDrive', 'night drive', T.drive),
    m('moodParty', 'party hits', T.party),
    m('moodFocus', 'focus study', T.focus),
  ],
  es: [
    m('moodPhonk', 'phonk', T.phonk),
    m('moodChill', 'chill lofi', T.chill),
    m('moodReggaeton', 'reggaeton 2026', ['reggaeton', 'regueton', 'perreo']),
    m('moodAfro', 'afrobeats 2026', T.afro),
    m('moodLatinPop', 'pop latino', ['pop latino', 'latin pop', 'cumbia', 'bachata', 'salsa']),
    m('moodRnb', 'r&b smooth', T.rnb),
    m('moodRockEs', 'rock en español', ['rock en español', 'rock español', 'rock argentino']),
    m('moodElectro', 'electro house', T.electro),
    m('moodNew', 'novedades 2026'),
    m('moodHitsEs', 'top éxitos latinos', ['éxitos', 'exitos', 'top latino']),
    m('moodWorkout', 'música para entrenar', ['workout', 'gym', 'fitness', 'training', 'entrenar']),
    m('moodDrive', 'música para conducir', ['night drive', 'drive', 'driving', 'conducir']),
    m('moodParty', 'fiesta 2026', T.party),
    m('moodFocus', 'música para concentrarse', ['focus', 'study', 'concentration', 'piano', 'concentrarse']),
  ],
};

const A = (names, ids) => names.map((n) => [n, ids]);
export const ARTIST_MAP = new Map([
  ...A(['jul', 'ninho', 'plk', 'sdm', 'tiakola', 'gazo', 'freeze corleone', 'booba', 'orelsan', 'nekfeu', 'damso', 'hamza'], ['moodRapFr']),
  ...A(['stromae', 'angele', 'clara luciani', 'julien dore', 'vianney'], ['moodHitsFr']),
  ...A(['daft punk', 'justice', 'cassius', 'kavinsky', 'madeon'], ['moodFrenchTouch']),
  ...A(['drake', 'travis scott', 'kendrick lamar', '21 savage', 'future', 'metro boomin', 'central cee', 'dave'], ['moodRapUs']),
  ...A(['taylor swift', 'the weeknd', 'billie eilish', 'dua lipa', 'ariana grande'], ['moodHitsUs']),
  ...A(['arctic monkeys', 'tame impala', 'mac demarco', 'phoebe bridgers', 'radiohead'], ['moodIndie']),
  ...A(['bad bunny', 'karol g', 'feid', 'rauw alejandro', 'j balvin', 'daddy yankee', 'ozuna'], ['moodReggaeton', 'moodParty']),
  ...A(['shakira', 'rosalia', 'camilo', 'sebastian yatra', 'morat'], ['moodLatinPop', 'moodParty']),
  ...A(['soda stereo', 'mana', 'caifanes', 'zoe', 'enanitos verdes'], ['moodRockEs']),
  ...A(['kordhell', 'dvrst', 'moondeity', 'interworld', 'hensonn'], ['moodPhonk']),
  ...A(['lofi girl', 'idealism', 'jinsang', 'nujabes'], ['moodChill']),
  ...A(['burna boy', 'wizkid', 'davido', 'rema', 'tems', 'asake'], ['moodAfro']),
  ...A(['sza', 'frank ocean', 'daniel caesar', 'h.e.r.', 'bryson tiller'], ['moodRnb']),
  ...A(['miles davis', 'john coltrane', 'norah jones', 'gregory porter'], ['moodJazz']),
  ...A(['fred again..', 'bicep', 'four tet', 'peggy gou', 'charlotte de witte'], ['moodElectro']),
]);

export function normaliser(texte) {
  return String(texte || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function normaliserArtiste(nom) {
  let s = normaliser(nom);
  s = s.replace(/\s+topic$/, '').trim();
  s = s.split(/\s+(feat|ft)\s+/)[0].split(',')[0].trim();
  return s;
}

export function catalogueStatique(lang) {
  const pool = CATALOGUE[lang] || CATALOGUE.en;
  return pool.map((x) => ({ id: x.id, labelKey: x.labelKey, q: x.q, score: 0 }));
}

export function selectionArtistes(affinites) {
  const vus = new Set();
  const out = [];
  for (const a of (affinites || []).slice().sort((x, y) => y.p - x.p)) {
    const norm = normaliserArtiste(a.artiste);
    if (!norm || norm.length < 2 || norm === 'na' || vus.has(norm)) continue;
    vus.add(norm);
    if (a.p < 4.0) continue;
    const name = String(a.artiste || '').trim();
    out.push({ name, q: name });
    if (out.length >= 2) break;
  }
  return out;
}

const ARTIST_CAP = 24;
const TOKEN_CAP = 12;

export const POOL_NEUTRE = (() => {
  const parId = new Map();
  for (const lang of ['fr', 'en', 'es']) {
    for (const m of CATALOGUE[lang]) {
      const cur = parId.get(m.id);
      if (!cur) parId.set(m.id, { id: m.id, labelKey: m.id, q: m.q, tags: m.tags.slice() });
      else for (const t of m.tags) if (!cur.tags.includes(t)) cur.tags.push(t);
    }
  }
  return Array.from(parId.values());
})();

// Algorithme de touching partage (composerMoods + composerMixes) : <=2 moods/ligne,
// tags les plus longs d'abord, plafond 12/mood. Pur.
export function toucherMoods(lignes, pool) {
  const tokenScore = new Map();
  const tagsOrdonnes = pool.map((x) => ({ id: x.id, tags: x.tags.slice().sort((a, b) => b.length - a.length) })).filter((x) => x.tags.length);
  for (const ligne of lignes) {
    if (!ligne.txt) continue;
    const touches = [];
    for (const mood of tagsOrdonnes) {
      for (const tag of mood.tags) {
        const t = normaliser(tag);
        if (!t) continue;
        if ((' ' + ligne.txt + ' ').includes(' ' + t + ' ')) { touches.push(mood.id); break; }
      }
      if (touches.length >= 2) break;
    }
    for (const id of touches) tokenScore.set(id, Math.min(12, (tokenScore.get(id) || 0) + ligne.p));
  }
  return tokenScore;
}

export function composerMoods({ likes, history, affinites, lang, cold, pool: poolParam }) {
  const pool = poolParam || CATALOGUE[lang] || CATALOGUE.en;
  if (cold) return { cold: true, moods: catalogueStatique(lang), artists: [] };
  const index = new Map(pool.map((x, i) => [x.id, i]));
  const artistScore = new Map();
  const vus = new Set();
  for (const a of (affinites || []).slice().sort((x, y) => y.p - x.p)) {
    const norm = normaliserArtiste(a.artiste);
    if (!norm || vus.has(norm)) continue;
    vus.add(norm);
    const ids = ARTIST_MAP.get(norm);
    if (!ids) continue;
    const cible = ids.find((id) => index.has(id));
    if (!cible) continue;
    artistScore.set(cible, Math.min(ARTIST_CAP, (artistScore.get(cible) || 0) + a.p));
  }
  const lignes = [];
  for (const l of (likes || [])) lignes.push({ txt: normaliser((l.title || '') + ' ' + (l.artist || '')), p: 2.0 });
  const now = Date.now();
  for (const h of (history || [])) {
    const iso = String(h.at || '').replace(' ', 'T');
    const age = (now - Date.parse(iso.endsWith('Z') ? iso : iso + 'Z')) / 86400000;
    const p = age <= 14 ? 1.6 : age <= 60 ? 1.0 : 0.5;
    lignes.push({ txt: normaliser((h.title || '') + ' ' + (h.artist || '')), p });
  }
  const tokenScore = toucherMoods(lignes, pool);
  const scores = pool.map((x) => Math.min(ARTIST_CAP, artistScore.get(x.id) || 0) + Math.min(TOKEN_CAP, tokenScore.get(x.id) || 0));
  const ordre = pool.map((x, i) => i).sort((a, b) => (scores[b] - scores[a]) || (a - b));
  const moods = ordre.map((i) => ({ id: pool[i].id, labelKey: pool[i].labelKey, q: pool[i].q, score: scores[i] }));
  return { cold: false, moods, artists: selectionArtistes(affinites) };
}

export function splitRepartition(moods, artists) {
  const scored = moods.filter((x) => (x.score || 0) > 0).sort((a, b) => (b.score - a.score) || 0);
  const zero = moods.filter((x) => !(x.score > 0));
  const teteMoods = scored.concat(zero).slice(0, Math.max(0, 8 - artists.length));
  const reste = moods.filter((x) => !teteMoods.includes(x));
  const explore = reste.filter((x) => !(x.score > 0)).concat(reste.filter((x) => x.score > 0).sort((a, b) => b.score - a.score));
  return { headMoods: teteMoods, headArtists: artists, explore };
}