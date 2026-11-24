import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
process.env.SONORA_DATA = mkdtempSync(join(tmpdir(), 'sonora-moods-'));
process.env.YTDLP_PATH = '/bin/false';
process.env.PIPED_URL = '';
const M = await import('../server/musique-moods.mjs');
const mus = await import('../server/musique.mjs');

const iso = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
const like = (title, artist) => ({ title, artist: artist || '' });
const hist = (title, artist, days) => ({ title, artist: artist || '', at: iso(days === undefined ? 5 : days) });

test('pur: determinisme + tie ordre catalogue', () => {
  const args = { likes: [like('jazz lounge session')], history: [hist('jazz lounge')], affinites: [], lang: 'fr', cold: false };
  const a = M.composerMoods(args);
  const b = M.composerMoods(args);
  assert.deepEqual(a, b);
  const zero = M.composerMoods({ likes: [], history: [], affinites: [], lang: 'fr', cold: false });
  assert.deepEqual(zero.moods.map((m) => m.id), M.catalogueStatique('fr').map((m) => m.id));
});

test('pur: froid court-circuite quelles que soient les lignes', () => {
  const r = M.composerMoods({ likes: [like('phonk montagem')], history: [hist('phonk')], affinites: [{ artiste: 'Jul', p: 9 }], lang: 'fr', cold: true });
  assert.equal(r.cold, true);
  assert.deepEqual(r.artists, []);
  assert.deepEqual(r.moods.map((m) => m.id), M.catalogueStatique('fr').map((m) => m.id));
  assert.ok(r.moods.every((m) => m.score === 0));
});

test('pur: localisation x3, 14 ids/pool, ES avec electro sans jazz', () => {
  for (const lang of ['fr', 'en', 'es']) assert.equal(M.CATALOGUE[lang].length, 14);
  const ids = (l) => M.CATALOGUE[l].map((m) => m.id);
  assert.ok(ids('es').includes('moodElectro'));
  assert.ok(!ids('es').includes('moodJazz'));
  const args = { likes: [like('top hits')], history: [], affinites: [], cold: false };
  const q = (l) => M.composerMoods(Object.assign({}, args, { lang: l })).moods.find((m) => m.id.startsWith('moodHits')).q;
  assert.equal(q('fr'), 'top hits france');
  assert.equal(q('en'), 'top hits usa');
  assert.equal(q('es'), 'top éxitos latinos');
});

test('pur: gouts opposes calibres (focus idx13 vs party idx12, hors tete catalogue)', () => {
  const A = M.composerMoods({ likes: [like('focus study piano'), like('focus study piano'), like('focus study piano'), like('focus study piano')], history: Array.from({ length: 12 }, () => hist('focus study')), affinites: [], lang: 'fr', cold: false });
  const B = M.composerMoods({ likes: [like('party club soiree'), like('party club soiree'), like('party club soiree'), like('party club soiree')], history: Array.from({ length: 12 }, () => hist('party club')), affinites: [], lang: 'fr', cold: false });
  assert.equal(A.moods[0].id, 'moodFocus');
  assert.equal(B.moods[0].id, 'moodParty');
  assert.notEqual(A.moods[0].id, B.moods[0].id);
});

test('pur: caps 24/12, deux regimes, total <= 36', () => {
  const sat = M.composerMoods({ likes: Array.from({ length: 200 }, () => like('x', 'Jul')), history: [], affinites: [{ artiste: 'Jul', p: 400 }], lang: 'fr', cold: false });
  const rap = sat.moods.find((m) => m.id === 'moodRapFr');
  assert.equal(rap.score, 24);
  const sat2 = M.composerMoods({ likes: Array.from({ length: 200 }, () => like('x', 'Jul')).concat([like('rap français'), like('rap français'), like('rap français')]), history: [], affinites: [{ artiste: 'Jul', p: 400 }], lang: 'fr', cold: false });
  assert.ok(sat2.moods.find((m) => m.id === 'moodRapFr').score > 24);
  const hors = M.composerMoods({ likes: Array.from({ length: 50 }, () => like('jazz lounge')), history: [], affinites: [], lang: 'fr', cold: false });
  assert.ok(hors.moods.find((m) => m.id === 'moodJazz').score <= 12);
  assert.ok(hors.moods.every((m) => m.score <= 36));
});

test('pur: dedup artiste normalisee, name brut, seuil 4.0', () => {
  const r = M.selectionArtistes([{ artiste: 'Jul', p: 5 }, { artiste: 'Jul feat. Ninho', p: 4.5 }, { artiste: 'Jul - Topic', p: 4.2 }, { artiste: 'Ninho', p: 4.1 }]);
  assert.deepEqual(r, [{ name: 'Jul', q: 'Jul' }, { name: 'Ninho', q: 'Ninho' }]);
  assert.deepEqual(M.selectionArtistes([{ artiste: 'Jul', p: 3.9 }]), []);
});

test('pur: cross-marche FR Bad Bunny -> moodParty, pas moodReggaeton', () => {
  const r = M.composerMoods({ likes: [like('reggaeton perreo', 'Bad Bunny'), like('reggaeton perreo', 'Bad Bunny'), like('reggaeton perreo', 'Bad Bunny'), like('reggaeton perreo', 'Bad Bunny')], history: Array.from({ length: 12 }, () => hist('reggaeton perreo', 'Bad Bunny')), affinites: [{ artiste: 'Bad Bunny', p: 20 }], lang: 'fr', cold: false });
  assert.equal(r.moods[0].id, 'moodParty');
  assert.ok(!r.moods.some((m) => m.id === 'moodReggaeton'));
});

test('pur: divergence corpus (history -120j compte via affinites, pas via tokens)', () => {
  const r = M.composerMoods({ likes: [like('x'), like('x'), like('x')], history: [], affinites: [{ artiste: 'Jul', p: 6 }], lang: 'fr', cold: false });
  assert.equal(r.moods.find((m) => m.id === 'moodRapFr').score, 6);
});

test('pur: evergreen moodNew toujours exploration ; exploration zero-first', () => {
  const moods = M.CATALOGUE.fr.map((m, i) => ({ id: m.id, labelKey: m.labelKey, q: m.q, score: i < 8 ? 10 - i : 0 }));
  const r = M.splitRepartition(moods, []);
  assert.ok(!r.headMoods.some((m) => m.id === 'moodNew'));
  assert.ok(r.explore.some((m) => m.id === 'moodNew'));
  assert.equal(r.headMoods.length, 8);
  const chaud = M.splitRepartition(moods, [{ name: 'Jul', q: 'Jul' }, { name: 'Ninho', q: 'Ninho' }]);
  assert.equal(chaud.headMoods.length, 6);
  assert.equal(chaud.headArtists.length, 2);
  assert.equal(chaud.explore.length, 8);
});

// ---- endpoint in-process (hermetique : YTDLP=false, PIPED='') ----
const d = mus.ouvrirBase();
function req(method, path, body, token) {
  const r = Readable.from([JSON.stringify(body || {})]);
  r.method = method;
  r.headers = token ? { authorization: 'Bearer ' + token } : {};
  return r;
}
function res() { return { code: 0, body: null, writeHead(c) { this.code = c; }, end(s) { this.body = JSON.parse(s); } }; }
async function call(method, route, body, token) {
  const r = res();
  const url = new URL('http://x/api/mus' + route);
  mus.handleMusique(req(method, route, body, token), r, '/api/mus' + route.split('?')[0], url);
  for (let i = 0; i < 50 && r.body === null; i++) await new Promise((x) => setTimeout(x, 10));
  return r;
}
const regA = await call('POST', '/register', { username: 'usera', password: 'motdepasse123' });
const regB = await call('POST', '/register', { username: 'userb', password: 'motdepasse123' });
const tokA = regA.body.token, tokB = regB.body.token;
const uidA = mus.identifiants('usera', 'motdepasse123').id;
const uidB = mus.identifiants('userb', 'motdepasse123').id;

test('endpoint: 401 sans token, lang invalide -> en', async () => {
  const r = await call('GET', '/moods');
  assert.equal(r.code, 401);
  const r2 = await call('GET', '/moods?lang=zz', null, tokA);
  assert.equal(r2.body.lang, 'en');
});

test('endpoint: compte froid -> cold true, ordre catalogue, artists vides', async () => {
  const r = await call('GET', '/moods?lang=fr', null, tokB);
  assert.equal(r.body.cold, true);
  assert.deepEqual(r.body.artists, []);
  assert.deepEqual(r.body.moods.map((m) => m.q), M.catalogueStatique('fr').map((m) => m.q));
});

test('endpoint: isolation + cache hit structurel + hermétique', async () => {
  d.prepare('INSERT INTO likes (user_id, video_id, title, artist) VALUES (?, ?, ?, ?)').run(uidA, 'AAAAAAAAAAA', 'jazz lounge session', '');
  d.prepare('INSERT INTO likes (user_id, video_id, title, artist) VALUES (?, ?, ?, ?)').run(uidA, 'BBBBBBBBBBB', 'jazz lounge session', '');
  d.prepare('INSERT INTO likes (user_id, video_id, title, artist) VALUES (?, ?, ?, ?)').run(uidA, 'CCCCCCCCCCC', 'MONTAGEM phonk', '');
  const r1 = await call('GET', '/moods?lang=fr', null, tokA);
  assert.equal(r1.body.cold, false);
  assert.equal(r1.body.moods[0].id, 'moodJazz');
  assert.equal(r1.body.moods[1].id, 'moodPhonk');
  assert.ok(mus.internals.moodsCache.has(uidA + ':fr'));
  const r2 = await call('GET', '/moods?lang=fr', null, tokA);
  assert.deepEqual(r2.body, r1.body);
  const rB = await call('GET', '/moods?lang=fr', null, tokB);
  assert.equal(rB.body.cold, true);
});

test('endpoint: invalidation calibree like Kordhell -> swap phonk/jazz (marge 0.4)', async () => {
  const r = await call('POST', '/likes', { videoId: 'DDDDDDDDDDD', title: 'X', artist: 'Kordhell' }, tokA);
  assert.equal(r.code, 200);
  assert.ok(!Array.from(mus.internals.moodsCache.keys()).some((k) => k.indexOf(uidA + ':') === 0));
  const r2 = await call('GET', '/moods?lang=fr', null, tokA);
  assert.equal(r2.body.moods[0].id, 'moodPhonk');
  assert.equal(r2.body.moods[1].id, 'moodJazz');
  assert.deepEqual(r2.body.artists, []);
});

test('endpoint: 7 sites purgent, reorder ne purge pas', async () => {
  const pid = d.prepare('INSERT INTO playlists (user_id, name) VALUES (?, ?)').run(uidA, 'P').lastInsertRowid;
  const sites = [
    ['POST', '/likes', { videoId: 'EEEEEEEEEEE', title: 't', artist: 'a' }],
    ['DELETE', '/likes/EEEEEEEEEEE', null],
    ['POST', '/feedback', { videoId: 'EEEEEEEEEEE', action: 'dismiss' }],
    ['POST', '/playlists/' + pid + '/tracks', { videoId: 'FFFFFFFFFFF', title: 't', artist: 'a' }],
    ['POST', '/playlists/' + pid + '/tracks/bulk', { tracks: [{ videoId: 'GGGGGGGGGGG', title: 't', artist: 'a' }] }],
    ['DELETE', '/playlists/' + pid + '/tracks/GGGGGGGGGGG', null],
    ['DELETE', '/playlists/' + pid, null],
  ];
  for (const [method, route, body] of sites) {
    mus.moodsPour(d, uidA, 'fr');
    assert.ok(mus.internals.moodsCache.has(uidA + ':fr'));
    const r = await call(method, route, body, tokA);
    assert.ok(r.code === 200, method + ' ' + route + ' -> ' + r.code);
    assert.ok(!Array.from(mus.internals.moodsCache.keys()).some((k) => k.indexOf(uidA + ':') === 0), 'purge attendue: ' + route);
  }
  const pid2 = d.prepare('INSERT INTO playlists (user_id, name) VALUES (?, ?)').run(uidA, 'P2').lastInsertRowid;
  d.prepare('INSERT INTO playlist_tracks (playlist_id, video_id, title, artist, position) VALUES (?, ?, ?, ?, 0)').run(pid2, 'HHHHHHHHHHH', 't', 'a');
  mus.moodsPour(d, uidA, 'fr');
  const r = await call('POST', '/playlists/' + pid2 + '/reorder', { videoIds: ['HHHHHHHHHHH'] }, tokA);
  assert.equal(r.code, 200);
  assert.ok(mus.internals.moodsCache.has(uidA + ':fr'), 'reorder ne purge pas');
});

test('parite catalogue serveur <-> client (extraction JSON marqueurs)', () => {
  const src = readFileSync(join(ROOT, 'frontend/src/lib/moods.ts'), 'utf8');
  const beg = src.indexOf('// MOODS_CATALOGUE_BEGIN');
  const end = src.indexOf('// MOODS_CATALOGUE_END');
  assert.ok(beg >= 0 && end > beg);
  const seg = src.slice(beg, end);
  const m = /'([^']+)'/.exec(seg);
  assert.ok(m, 'litteral JSON introuvable');
  const client = JSON.parse(m[1]);
  for (const lang of ['fr', 'en', 'es']) {
    const srv = M.CATALOGUE[lang].map((x) => ({ id: x.id, labelKey: x.labelKey, q: x.q }));
    assert.deepEqual(client[lang], srv, 'parite ' + lang);
  }
});

test('nettoyage', () => { mus.fermerBase(); });