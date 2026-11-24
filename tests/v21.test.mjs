import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { DatabaseSync } from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = mkdtempSync(join(tmpdir(), 'sonora-v21-'));
let BASE = '', proc = null, tokA = '', tokB = '', uidA = 0;
const V = (i) => 'vid' + String(i).padStart(8, '0');

async function portLibre() { return await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); }); }
function api(path, opts, tok) {
  const o = Object.assign({}, opts || {});
  o.headers = Object.assign({}, o.headers || {});
  if (o.body && typeof o.body !== 'string') { o.body = JSON.stringify(o.body); o.headers['Content-Type'] = 'application/json'; }
  if (tok) o.headers.Authorization = 'Bearer ' + tok;
  return fetch(BASE + path, o).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
}
test.before(async () => {
  const port = await portLibre();
  BASE = 'http://127.0.0.1:' + port;
  proc = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: Object.assign({}, process.env, { SONORA_HOST: '127.0.0.1', SONORA_PORT: String(port), SONORA_DATA: DATA, YTDLP_PATH: '/bin/false', PIPED_URL: '' }), stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { try { const r = await fetch(BASE + '/api/mus/health'); if (r.ok) break; } catch (e) {} await new Promise((r) => setTimeout(r, 100)); }
  tokA = (await api('/api/mus/register', { method: 'POST', body: { username: 'alice', password: 'alice-pass-1' } })).body.token;
  tokB = (await api('/api/mus/register', { method: 'POST', body: { username: 'bob', password: 'bob-pass-12' } })).body.token;
});
test.after(() => { try { proc.kill(); } catch (e) {} });

test('position: 3 API sites + bulk write non-null position; NULL-last ordering', async () => {
  const pid = (await api('/api/mus/playlists', { method: 'POST', body: { name: 'P1' } }, tokA)).body.id;
  assert.equal((await api('/api/mus/playlists/' + pid + '/tracks', { method: 'POST', body: { videoId: V(1), title: 't1', artist: 'Art' } }, tokA)).status, 200);
  assert.equal((await api('/api/mus/likes', { method: 'POST', body: { videoId: V(2), title: 't2', artist: 'Art' } }, tokA)).status, 200);
  assert.equal((await api('/api/mus/feedback', { method: 'POST', body: { videoId: V(3), action: 'like' } }, tokA)).status, 200);
  assert.equal((await api('/api/mus/playlists/' + pid + '/tracks/bulk', { method: 'POST', body: { tracks: [{ videoId: V(4), title: 't4', artist: 'Art', duration: 200 }, { videoId: V(5), title: 't5', artist: 'Art', duration: 210 }] } }, tokA)).status, 200);
  const db = new DatabaseSync(join(DATA, 'musique.db'));
  const nulls = db.prepare('SELECT COUNT(*) AS n FROM playlist_tracks WHERE position IS NULL').get().n;
  assert.equal(nulls, 0, 'tous les sites doivent ecrire position');
  const meta = db.prepare('SELECT duration FROM track_meta WHERE video_id = ?').get(V(4));
  assert.equal(meta.duration, 200, 'bulk doit ecrire track_meta');
  db.close();
  const list = (await api('/api/mus/playlists/' + pid, {}, tokA)).body.tracks.map((t) => t.videoId);
  assert.deepEqual(list, [V(1), V(4), V(5)], 'ordre source append');
});

test('reorder: valide, 400 ensemble different, 404 cross-compte', async () => {
  const pid = (await api('/api/mus/playlists', { method: 'POST', body: { name: 'P2' } }, tokA)).body.id;
  for (const i of [1, 2, 3]) await api('/api/mus/playlists/' + pid + '/tracks', { method: 'POST', body: { videoId: V(i), title: 't', artist: 'a' } }, tokA);
  assert.equal((await api('/api/mus/playlists/' + pid + '/reorder', { method: 'POST', body: { videoIds: [V(3), V(1), V(2)] } }, tokA)).status, 200);
  const list = (await api('/api/mus/playlists/' + pid, {}, tokA)).body.tracks.map((t) => t.videoId);
  assert.deepEqual(list, [V(3), V(1), V(2)]);
  assert.equal((await api('/api/mus/playlists/' + pid + '/reorder', { method: 'POST', body: { videoIds: [V(3), V(1)] } }, tokA)).status, 400);
  assert.equal((await api('/api/mus/playlists/' + pid + '/reorder', { method: 'POST', body: { videoIds: [V(3), V(1), V(2)] } }, tokB)).status, 404);
  assert.equal((await api('/api/mus/playlists/' + pid, {}, tokB)).status, 404);
});

test('bulk: cap 100, doublons gardent position, parite ordre Subsonic', async () => {
  const pid = (await api('/api/mus/playlists', { method: 'POST', body: { name: 'P3' } }, tokA)).body.id;
  const cent = Array.from({ length: 101 }, (_, i) => ({ videoId: V(100 + i), title: 't', artist: 'a' }));
  assert.equal((await api('/api/mus/playlists/' + pid + '/tracks/bulk', { method: 'POST', body: { tracks: cent } }, tokA)).status, 400);
  const dix = cent.slice(0, 10);
  assert.equal((await api('/api/mus/playlists/' + pid + '/tracks/bulk', { method: 'POST', body: { tracks: dix } }, tokA)).body.added, 10);
  const again = (await api('/api/mus/playlists/' + pid + '/tracks/bulk', { method: 'POST', body: { tracks: dix } }, tokA)).body;
  assert.equal(again.added, 0, 'doublons ignores');
  const mus = (await api('/api/mus/playlists/' + pid, {}, tokA)).body.tracks.map((t) => t.videoId);
  const sub = await fetch(BASE + '/subsonic/rest/getPlaylist.view?u=alice&p=alice-pass-1&f=json&id=pl-' + pid).then((r) => r.json());
  const sonic = sub['subsonic-response'].playlist.entry.map((e) => e.id);
  assert.deepEqual(sonic, mus, 'parite ordre mus/Subsonic');
});

test('stats: totaux, isolation, migration duration presente', async () => {
  for (let i = 0; i < 5; i++) await api('/api/mus/history', { method: 'POST', body: { videoId: V(200 + i), title: 'h', artist: 'ArtH', duration: 180 } }, tokA);
  const s = (await api('/api/mus/stats?months=6', {}, tokA)).body;
  assert.ok(s.totals.plays >= 5);
  assert.ok(s.totals.minutes >= 15, 'minutes = somme durees');
  assert.ok(s.topTracks.length >= 5);
  const sb = (await api('/api/mus/stats', {}, tokB)).body;
  assert.equal(sb.totals.plays, 0, 'isolation');
  const db = new DatabaseSync(join(DATA, 'musique.db'));
  assert.ok(db.prepare('PRAGMA table_info(history)').all().some((c) => c.name === 'duration'));
  db.close();
});

test('smart: top/recent/never, 404 cle inconnue, non modifiable', async () => {
  const top = (await api('/api/mus/smart/top', {}, tokA)).body;
  assert.ok(top.tracks.length >= 1);
  const never = (await api('/api/mus/smart/never', {}, tokA)).body;
  assert.ok(Array.isArray(never.tracks));
  assert.ok(!never.tracks.some((t) => t.videoId === V(200)), 'titre ecoute absent de never');
  assert.equal((await api('/api/mus/smart/zzz', {}, tokA)).status, 404);
  assert.equal((await api('/api/mus/smart/top', { method: 'POST', body: {} }, tokA)).status, 404);
});

test('radio: secours sans yt-dlp ni Piped, non vide, rapide; CarPlay getSimilarSongs2', async () => {
  await api('/api/mus/likes', { method: 'POST', body: { videoId: V(300), title: 'r1', artist: 'RadioArt' } }, tokA);
  await api('/api/mus/likes', { method: 'POST', body: { videoId: V(301), title: 'r2', artist: 'RadioArt' } }, tokA);
  const t0 = Date.now();
  const r = await api('/api/mus/radio?seed=RadioArt&n=10', {}, tokA);
  assert.equal(r.status, 200);
  assert.ok(r.body.length >= 2, 'secours artiste non vide');
  assert.ok(Date.now() - t0 < 10000);
  const t1 = Date.now();
  const sub = await fetch(BASE + '/subsonic/rest/getSimilarSongs2.view?u=alice&p=alice-pass-1&f=json&id=' + V(300)).then((x) => x.json());
  const songs = sub['subsonic-response'].similarSongs2.song;
  assert.ok(songs.length >= 1, 'CarPlay radio non vide');
  assert.ok(Date.now() - t1 < 500, 'CarPlay froid < 500 ms');
});