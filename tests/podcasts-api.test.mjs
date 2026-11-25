import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { syncEpisodes, signerSrc, verifierSrc, estEpisode } from '../server/podcasts.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = mkdtempSync(join(tmpdir(), 'sonora-pod-'));
process.env.SONORA_DATA = DATA;
async function portLibre() { return await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); }); }
let BASE = ''; let proc = null;
async function attendre() { for (let i = 0; i < 80; i++) { try { const r = await fetch(BASE + '/api/mus/health'); if (r.ok) return; } catch (e) {} await new Promise((r) => setTimeout(r, 100)); } throw new Error('not ready'); }
async function api(path, opts, tok) {
  const o = Object.assign({}, opts || {}); o.headers = Object.assign({}, o.headers || {});
  if (tok) o.headers.Authorization = 'Bearer ' + tok;
  if (o.body && typeof o.body !== 'string') { o.body = JSON.stringify(o.body); o.headers['Content-Type'] = 'application/json'; }
  const r = await fetch(BASE + path, o); return { status: r.status, body: await r.json().catch(() => null) };
}
let tokA = '', tokB = '';
test.before(async () => {
  const port = await portLibre(); BASE = 'http://127.0.0.1:' + port;
  proc = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: Object.assign({}, process.env, { SONORA_HOST: '127.0.0.1', SONORA_PORT: String(port), SONORA_DATA: DATA, YTDLP_PATH: '/bin/false', PIPED_URL: '' }), stdio: 'ignore' });
  await attendre();
  tokA = (await api('/api/mus/register', { method: 'POST', body: { username: 'podA', password: 'motdepasse123' } })).body.token;
  tokB = (await api('/api/mus/register', { method: 'POST', body: { username: 'podB', password: 'motdepasse123' } })).body.token;
});
test.after(() => { if (proc) try { proc.kill('SIGKILL'); } catch (e) {} try { rmSync(DATA, { recursive: true, force: true }); } catch (e) {} });
test('401 sans token', async () => { assert.equal((await api('/api/pod/subs')).status, 401); });
test('curated par langue', async () => { const r = await api('/api/pod/curated?lang=fr', null, tokA); assert.equal(r.status, 200); assert.ok(r.body.results.length); });
test('POST shows url invalide rejetee', async () => {
  assert.equal((await api('/api/pod/shows', { method: 'POST', body: { feedUrl: 'http://127.0.0.1/x' } }, tokA)).status, 400);
  assert.equal((await api('/api/pod/shows', { method: 'POST', body: { feedUrl: 'https://10.0.0.1/x' } }, tokA)).status, 400);
});
test('subs idempotent + isolation comptes', async () => {
  const d = new DatabaseSync(join(DATA, 'musique.db'));
  d.exec("CREATE TABLE IF NOT EXISTS podcast_shows (id INTEGER PRIMARY KEY, feed_url TEXT UNIQUE, itunes_id TEXT, title TEXT, author TEXT, description TEXT, image TEXT, fetched_at INTEGER)");
  d.prepare('INSERT OR IGNORE INTO podcast_shows (id, feed_url, title, fetched_at) VALUES (1, ?, ?, 0)').run('https://x/f.xml', 'Show X');
  d.close();
  await api('/api/pod/subs', { method: 'POST', body: { showId: 1 } }, tokA);
  await api('/api/pod/subs', { method: 'POST', body: { showId: 1 } }, tokA);
  const a = await api('/api/pod/subs', null, tokA); const b = await api('/api/pod/subs', null, tokB);
  assert.equal(a.body.shows.length, 1); assert.equal(b.body.shows.length, 0);
});
test('progress upsert + new exclut completed + tri', async () => {
  const d = new DatabaseSync(join(DATA, 'musique.db'));
  d.exec("CREATE TABLE IF NOT EXISTS podcast_episodes (id INTEGER PRIMARY KEY, show_id INTEGER, guid TEXT, title TEXT, description TEXT, pub_date TEXT, duration INTEGER, enclosure_url TEXT, enclosure_type TEXT, unavailable INTEGER DEFAULT 0, added_at INTEGER, UNIQUE(show_id, guid))");
  d.exec("CREATE TABLE IF NOT EXISTS podcast_subs (user_id INTEGER, show_id INTEGER, added_at INTEGER, PRIMARY KEY (user_id, show_id))");
  d.exec("CREATE TABLE IF NOT EXISTS podcast_progress (user_id INTEGER, episode_id INTEGER, position REAL, duration REAL, completed INTEGER, updated_at INTEGER, PRIMARY KEY (user_id, episode_id))");
  const uid = d.prepare('SELECT id FROM users WHERE username = ?').get('poda').id;
  d.prepare('INSERT OR IGNORE INTO podcast_subs (user_id, show_id, added_at) VALUES (?,1,0)').run(uid);
  d.prepare('INSERT INTO podcast_episodes (id, show_id, guid, title, pub_date, duration, enclosure_url, added_at) VALUES (10,1,?, ?, ?, 100, ?, 0)').run('g10', 'Ep old', '2026-01-01T00:00:00Z', 'https://x/10.mp3');
  d.prepare('INSERT INTO podcast_episodes (id, show_id, guid, title, pub_date, duration, enclosure_url, added_at) VALUES (11,1,?, ?, ?, 100, ?, 0)').run('g11', 'Ep new', '2026-02-01T00:00:00Z', 'https://x/11.mp3');
  d.close();
  await api('/api/pod/progress', { method: 'POST', body: { episodeId: 10, position: 95, duration: 100, completed: true } }, tokA);
  const nw = await api('/api/pod/new', null, tokA);
  assert.equal(nw.status, 200);
  assert.equal(nw.body.episodes.length, 1);
  assert.equal(nw.body.episodes[0].id, 11);
  assert.ok(nw.body.episodes[0].src.includes('sig='));
  const pr = await api('/api/pod/progress/10', null, tokA);
  assert.equal(pr.body.progress.completed, 1);
});
test('gardes ep -> 400 sur likes/history/playlists/feedback', async () => {
  assert.equal((await api('/api/mus/likes', { method: 'POST', body: { videoId: 'ep123456789', title: 't', artist: 'a' } }, tokA)).status, 400);
  assert.equal((await api('/api/mus/history', { method: 'POST', body: { videoId: 'ep123456789' } }, tokA)).status, 400);
  assert.equal((await api('/api/mus/feedback', { method: 'POST', body: { videoId: 'ep123456789', action: 'like' } }, tokA)).status, 400);
});
test('src signee verifiable + expiree refusee', () => {
  const src = signerSrc(42);
  const m = src.match(/ep\/(\d+)\?exp=(\d+)&sig=([0-9a-f]+)/);
  assert.ok(m);
  assert.equal(verifierSrc(m[1], m[2], m[3]), true);
  assert.equal(verifierSrc(m[1], m[2], 'deadbeef'), false);
  assert.equal(verifierSrc(m[1], String(Date.now() - 1000), m[3]), false);
  assert.equal(estEpisode('ep123'), true); assert.equal(estEpisode('abcdefghijk'), false);
});
test('syncEpisodes purge sauf progress non completed + orphelins', () => {
  const d = new DatabaseSync(':memory:');
  d.exec("CREATE TABLE podcast_shows (id INTEGER PRIMARY KEY, feed_url TEXT UNIQUE, itunes_id TEXT, title TEXT, author TEXT, description TEXT, image TEXT, fetched_at INTEGER)");
  d.exec("CREATE TABLE podcast_episodes (id INTEGER PRIMARY KEY, show_id INTEGER, guid TEXT, title TEXT, description TEXT, pub_date TEXT, duration INTEGER, enclosure_url TEXT, enclosure_type TEXT, unavailable INTEGER DEFAULT 0, added_at INTEGER, UNIQUE(show_id, guid))");
  d.exec("CREATE TABLE podcast_progress (user_id INTEGER, episode_id INTEGER, position REAL, duration REAL, completed INTEGER, updated_at INTEGER, PRIMARY KEY (user_id, episode_id))");
  d.prepare('INSERT INTO podcast_shows (id, feed_url, title, fetched_at) VALUES (1, ?, ?, 0)').run('https://x/f', 'S');
  d.prepare('INSERT INTO podcast_episodes (id, show_id, guid, title, added_at) VALUES (1,1,?, ?, 0)').run('keep', 'Avec progress');
  d.prepare('INSERT INTO podcast_episodes (id, show_id, guid, title, added_at) VALUES (2,1,?, ?, 0)').run('drop', 'Sans progress');
  d.prepare('INSERT INTO podcast_progress (user_id, episode_id, position, duration, completed, updated_at) VALUES (1,1,10,100,0,0)').run();
  d.prepare('INSERT INTO podcast_progress (user_id, episode_id, position, duration, completed, updated_at) VALUES (1,2,10,100,1,0)').run();
  const parsed = { title: 'S2', author: 'A', description: 'D', image: 'I', items: [{ guid: 'keep', title: 'Avec progress', description: '', pubDate: '2026-02-01T00:00:00Z', duration: 100, enclosureUrl: 'https://x/k.mp3', enclosureType: 'audio/mpeg' }, { guid: 'new', title: 'Nouveau', description: '', pubDate: '2026-03-01T00:00:00Z', duration: 100, enclosureUrl: 'https://x/n.mp3', enclosureType: 'audio/mpeg' }] };
  const show = syncEpisodes(d, d.prepare('SELECT * FROM podcast_shows WHERE id=1').get(), parsed);
  const guids = d.prepare('SELECT guid FROM podcast_episodes ORDER BY guid').all().map(r => r.guid);
  assert.deepEqual(guids, ['keep', 'new']);
  assert.equal(d.prepare('SELECT COUNT(*) n FROM podcast_progress WHERE episode_id=2').get().n, 0);
  assert.equal(d.prepare('SELECT COUNT(*) n FROM podcast_progress WHERE episode_id=1').get().n, 1);
  assert.equal(show.title, 'S2');
  d.close();
});
