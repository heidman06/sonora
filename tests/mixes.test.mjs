import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
process.env.SONORA_DATA = mkdtempSync(join(tmpdir(), 'sonora-mixes-'));
process.env.YTDLP_PATH = '/bin/false';
process.env.PIPED_URL = '';
process.env.SONORA_MIX_WARM = '0';
const MX = await import('../server/musique-mixes.mjs');
const mus = await import('../server/musique.mjs');

const vid = (p, i) => (p + String(i).padStart(9, '0')).slice(0, 11);
test('pur: melangerSeede deterministe et permutant', () => {
  const l = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual(MX.melangerSeede(l, 'g'), MX.melangerSeede(l, 'g'));
  assert.notDeepEqual(MX.melangerSeede(l, 'g'), MX.melangerSeede(l, 'g2'));
  assert.deepEqual(MX.melangerSeede(l, 'g').slice().sort(), l);
});
test('pur: cold < 10 distincts, coquilles', () => {
  const r = MX.composerMixes({ userId: 1, seedJour: '2026-11-24', affinites: [], likes: [], history90: [], playlists: [], boucle: [], archives: [], rejetes: new Set(), recos: [], corpusDistincts: 9 });
  assert.equal(r.cold, true);
  assert.equal(r.mixes.length, 3);
  assert.ok(r.mixes.every((m) => m.tracks.length === 0));
});
test('pur: troncature avant tirage (seed+1 memes ensembles)', () => {
  const likes = Array.from({ length: 60 }, (_, i) => ({ video_id: vid('LK', i), title: 't' + i, artist: 'Kordhell', duration: 200 }));
  const args = { userId: 1, affinites: [{ artiste: 'Kordhell', p: 90 }], likes, history90: [], playlists: [], boucle: [], archives: [], rejetes: new Set(), recos: [], corpusDistincts: 60 };
  const a = MX.composerMixes(Object.assign({}, args, { seedJour: '2026-11-24' }));
  const b = MX.composerMixes(Object.assign({}, args, { seedJour: '2026-11-25' }));
  const fa = a.mixes.find((m) => m.key === 'favoris');
  const fb = b.mixes.find((m) => m.key === 'favoris');
  assert.deepEqual(fa.tracks.map((t) => t.videoId).sort(), fb.tracks.map((t) => t.videoId).sort());
  assert.notDeepEqual(fa.tracks.map((t) => t.videoId), fb.tracks.map((t) => t.videoId));
});
test('pur: planchers daily 10/9, cover min(4,n), XOR subtitle/seeds, vocabulaire', () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ video_id: vid('DA', i), title: 'phonk t' + i, artist: 'Kordhell', duration: 200 }));
  const base = { userId: 1, seedJour: '2026-11-24', affinites: [{ artiste: 'Kordhell', p: 90 }], history90: [], playlists: [], boucle: [], archives: [], rejetes: new Set(), recos: [], corpusDistincts: 60 };
  const autres = Array.from({ length: 30 }, (_, i) => ({ video_id: vid('LO', i), title: 'lofi chill ' + i, artist: 'Lofi Girl', duration: 200 }));
  const r10 = MX.composerMixes(Object.assign({}, base, { likes: mk(10).concat(autres), corpusDistincts: 40 }));
  assert.ok(r10.mixes.some((m) => m.key === 'daily1'));
  const r9 = MX.composerMixes(Object.assign({}, base, { likes: mk(9), corpusDistincts: 9 }));
  assert.equal(r9.cold, true);
  const r = MX.composerMixes(Object.assign({}, base, { likes: mk(40) }));
  for (const m of r.mixes) {
    assert.equal(m.cover.length, Math.min(4, m.tracks.length));
    assert.equal(m.count, m.tracks.length);
    assert.ok(!(m.subtitleKey && m.seeds.length), 'XOR subtitle/seeds');
    for (const s of m.seeds) if (s.t === 'key') assert.ok(['favorites', 'history', 'playlists', 'rotation', 'bulk'].includes(s.v));
  }
});
test('pur: mono-artiste => pas de doublon Jaccard > 0.8', () => {
  const likes = Array.from({ length: 40 }, (_, i) => ({ video_id: vid('MO', i), title: 'montagem phonk ' + i, artist: 'Kordhell', duration: 200 }));
  const r = MX.composerMixes({ userId: 1, seedJour: '2026-11-24', affinites: [{ artiste: 'Kordhell', p: 90 }], likes, history90: likes.map((l) => Object.assign({}, l, { at: '2026-11-20 10:00:00', c: 2 })), playlists: [], boucle: likes.map((l) => Object.assign({}, l, { c: 2 })), archives: [], rejetes: new Set(), recos: [], corpusDistincts: 40 });
  const sets = r.mixes.filter((m) => m.key !== 'deco').map((m) => new Set(m.tracks.map((t) => t.videoId)));
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
    let inter = 0; for (const x of sets[i]) if (sets[j].has(x)) inter++;
    const union = sets[i].size + sets[j].size - inter;
    assert.ok(union ? inter / union <= 0.8 : true, 'doublon ' + i + '/' + j);
  }
});

const d = mus.ouvrirBase();
function req(method, route, body, token) { const r = Readable.from([JSON.stringify(body || {})]); r.method = method; r.headers = token ? { authorization: 'Bearer ' + token } : {}; return r; }
function res() { return { code: 0, body: null, writeHead(c) { this.code = c; }, end(s) { this.body = JSON.parse(s); } }; }
async function call(method, route, body, token) { const r = res(); mus.handleMusique(req(method, route, body, token), r, '/api/mus' + route.split('?')[0], new URL('http://x/api/mus' + route)); for (let i = 0; i < 80 && r.body === null; i++) await new Promise((x) => setTimeout(x, 10)); return r; }
const regA = await call('POST', '/register', { username: 'phonk', password: 'motdepasse123' });
const regB = await call('POST', '/register', { username: 'jazz', password: 'motdepasse123' });
const regC = await call('POST', '/register', { username: 'neuf', password: 'motdepasse123' });
const regD = await call('POST', '/register', { username: 'petit', password: 'motdepasse123' });
const uid = (n) => mus.identifiants(n, 'motdepasse123').id;
function seed(userId, prefix, artists, titles, old) {
  for (let i = 0; i < 40; i++) {
    const a = artists[i % artists.length];
    d.prepare('INSERT OR IGNORE INTO likes (user_id, video_id, title, artist) VALUES (?, ?, ?, ?)').run(userId, vid(prefix, i), titles[i % titles.length] + ' ' + i, a);
    d.prepare('INSERT INTO history (user_id, video_id, title, artist, at) VALUES (?, ?, ?, ?, datetime(\'now\', ?))').run(userId, vid(prefix, i), titles[i % titles.length] + ' ' + i, a, old ? '-120 day' : '-2 day');
    d.prepare('INSERT INTO history (user_id, video_id, title, artist, at) VALUES (?, ?, ?, ?, datetime(\'now\', ?))').run(userId, vid(prefix, i), titles[i % titles.length] + ' ' + i, a, old ? '-121 day' : '-3 day');
  }
}
seed(uid('phonk'), 'PH', ['Kordhell', 'DVRST', 'Fred again..', 'Lofi Girl'], ['montagem phonk', 'phonk drift', 'electro house', 'lofi chill']);
for (let i = 0; i < 30; i++) d.prepare('INSERT INTO history (user_id, video_id, title, artist, at) VALUES (?, ?, ?, ?, datetime(\'now\',\'-120 day\'))').run(uid('phonk'), vid('AR', i), 'archive t' + i, ['Kordhell', 'Miles Davis'][i % 2]);
const plA = d.prepare('INSERT INTO playlists (user_id, name) VALUES (?, ?)').run(uid('phonk'), 'PL').lastInsertRowid;
for (let i = 0; i < 10; i++) d.prepare('INSERT INTO playlist_tracks (playlist_id, video_id, title, artist, position) VALUES (?, ?, ?, ?, ?)').run(plA, vid('PL', i), 'playlist t' + i, 'SZA', i);
seed(uid('jazz'), 'JZ', ['Miles Davis', 'John Coltrane', 'SZA', 'Lofi Girl'], ['jazz lounge session', 'blue in green', 'r&b smooth', 'lofi chill']);
for (let i = 0; i < 30; i++) d.prepare('INSERT INTO history (user_id, video_id, title, artist, at) VALUES (?, ?, ?, ?, datetime(\'now\',\'-120 day\'))').run(uid('jazz'), vid('BR', i), 'archive t' + i, ['Miles Davis', 'Norah Jones'][i % 2]);
const plB = d.prepare('INSERT INTO playlists (user_id, name) VALUES (?, ?)').run(uid('jazz'), 'PL').lastInsertRowid;
for (let i = 0; i < 10; i++) d.prepare('INSERT INTO playlist_tracks (playlist_id, video_id, title, artist, position) VALUES (?, ?, ?, ?, ?)').run(plB, vid('PM', i), 'playlist t' + i, 'Burna Boy', i);
for (let i = 0; i < 12; i++) d.prepare('INSERT INTO history (user_id, video_id, title, artist, at) VALUES (?, ?, ?, ?, datetime(\'now\',\'-2 day\'))').run(uid('petit'), vid('PT', i % 10), 'petit t' + i, 'Artiste Inconnu');

test('endpoint: 0 spawn, >= 8 mixes, ancres et moods corrects, isolation', async () => {
  const a = await call('GET', '/mixes2', null, regA.body.token);
  const b = await call('GET', '/mixes2', null, regB.body.token);
  assert.equal(a.code, 200);
  assert.equal(mus.internals.warmLances, 0);
  assert.ok(a.body.mixes.length >= 8, 'mixes A=' + a.body.mixes.length);
  assert.ok(b.body.mixes.length >= 8, 'mixes B=' + b.body.mixes.length);
  assert.equal(a.body.mixes.find((m) => m.key === 'daily1').seeds[0].v, 'Kordhell');
  assert.equal(b.body.mixes.find((m) => m.key === 'daily1').seeds[0].v, 'Miles Davis');
  assert.ok(a.body.mixes.some((m) => m.moodId === 'moodPhonk'));
  assert.ok(b.body.mixes.some((m) => m.moodId === 'moodJazz'));
  const idsA = new Set(a.body.mixes.flatMap((m) => m.tracks.map((t) => t.videoId)));
  const idsB = new Set(b.body.mixes.flatMap((m) => m.tracks.map((t) => t.videoId)));
  for (const x of idsB) assert.ok(!idsA.has(x), 'isolation');
  assert.ok(mus.internals.compteSqlMixes <= 12, 'sql=' + mus.internals.compteSqlMixes);
});
test('endpoint: cold neuf, petit compte reel', async () => {
  const c = await call('GET', '/mixes2', null, regC.body.token);
  assert.equal(c.body.cold, true);
  assert.equal(c.body.mixes.length, 3);
  const p = await call('GET', '/mixes2', null, regD.body.token);
  assert.equal(p.body.cold, false);
  assert.ok(p.body.mixes.length >= 1);
  assert.ok(p.body.mixes.some((m) => m.tracks.length > 0));
});
test('endpoint: determinisme via hook purge', async () => {
  const a1 = await call('GET', '/mixes2', null, regA.body.token);
  mus.internals.purgeMixes(uid('phonk'));
  const a2 = await call('GET', '/mixes2', null, regA.body.token);
  assert.deepEqual(a2.body, a1.body);
});
test('endpoint: 7 purges + epoch, pousseHistory intact', async () => {
  const u = uid('phonk');
  const pid = d.prepare('INSERT INTO playlists (user_id, name) VALUES (?, ?)').run(u, 'P').lastInsertRowid;
  const sites = [
    ['POST', '/likes', { videoId: vid('XX', 1), title: 't', artist: 'a' }],
    ['DELETE', '/likes/' + vid('XX', 1), null],
    ['POST', '/feedback', { videoId: vid('XX', 2), action: 'dismiss' }],
    ['POST', '/playlists/' + pid + '/tracks', { videoId: vid('XX', 3), title: 't', artist: 'a' }],
    ['POST', '/playlists/' + pid + '/tracks/bulk', { tracks: [{ videoId: vid('XX', 4), title: 't', artist: 'a' }] }],
    ['DELETE', '/playlists/' + pid + '/tracks/' + vid('XX', 4), null],
    ['DELETE', '/playlists/' + pid, null],
  ];
  for (const [method, route, body] of sites) {
    await call('GET', '/mixes2', null, regA.body.token);
    const e0 = mus.internals.mixEpoch.get(u) || 0;
    const r = await call(method, route, body, regA.body.token);
    assert.equal(r.code, 200, method + ' ' + route);
    assert.ok((mus.internals.mixEpoch.get(u) || 0) > e0, 'epoch ' + route);
    assert.equal(d.prepare('SELECT COUNT(*) AS n FROM mix_cache WHERE user_id = ?').get(u).n, 0, 'table ' + route);
  }
  await call('GET', '/mixes2', null, regA.body.token);
  mus.pousseHistory(d, u, vid('HI', 1), 'h', 'a', 200);
  assert.equal(d.prepare('SELECT COUNT(*) AS n FROM mix_cache WHERE user_id = ?').get(u).n, 1);
});
test('endpoint: anti-resurrection ecrireWarm', async () => {
  const u = uid('jazz');
  await call('GET', '/mixes2', null, regB.body.token);
  const epoch = mus.internals.mixEpoch.get(u) || 0;
  const resp = { v: 1, cold: false, seed: '2026-11-24', mixes: [] };
  mus.internals.purgeMixes(u);
  assert.equal(mus.internals.ecrireWarm(u, epoch, '2026-11-24', resp), false);
  assert.equal(d.prepare('SELECT COUNT(*) AS n FROM mix_cache WHERE user_id = ?').get(u).n, 0);
  await call('GET', '/mixes2', null, regB.body.token);
  const e2 = mus.internals.mixEpoch.get(u) || 0;
  assert.equal(mus.internals.ecrireWarm(u, e2, new Date().toISOString().slice(0, 10), resp), true);
});
test('endpoint: contrat v1 legacy inchange', async () => {
  const r = await call('GET', '/mixes', null, regA.body.token);
  assert.equal(r.code, 200);
  assert.equal(r.body.length, 3);
  assert.deepEqual(r.body.map((m) => m.key).sort(), ['boucle', 'deco', 'favoris']);
  assert.ok(r.body.every((m) => typeof m.name === 'string' && m.count === m.tracks.length));
});
test('nettoyage', () => mus.fermerBase());