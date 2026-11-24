import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = mkdtempSync(join(tmpdir(), 'sonora-test-'));
const VID = 'dQw4w9WgXcQ';

async function portLibre() {
  return await new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => resolve(p)); });
  });
}

let BASE = '';
let proc = null;

async function attendre() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(BASE + '/api/mus/health'); if (r.ok) return; } catch (e) {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server not ready');
}
function api(path, opts) {
  const o = Object.assign({}, opts || {});
  o.headers = Object.assign({}, o.headers || {});
  if (o.body && typeof o.body !== 'string') { o.body = JSON.stringify(o.body); o.headers['Content-Type'] = 'application/json'; }
  if (token) o.headers.Authorization = 'Bearer ' + token;
  return fetch(BASE + path, o).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
}
let token = '';

test.before(async () => {
  const port = await portLibre();
  BASE = 'http://127.0.0.1:' + port;
  proc = spawn(process.execPath, ['server/index.mjs'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      SONORA_HOST: '127.0.0.1', SONORA_PORT: String(port), SONORA_DATA: DATA,
      YTDLP_PATH: '/bin/false', PIPED_URL: '',
    }),
    stdio: 'ignore',
  });
  await attendre();
});

test.after(() => {
  if (proc) try { proc.kill('SIGKILL'); } catch (e) {}
  try { rmSync(DATA, { recursive: true, force: true }); } catch (e) {}
});

test('health public', async () => {
  const r = await api('/api/mus/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.users, 2);
});

test('page PWA', async () => {
  const r = await fetch(BASE + '/musique/');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.ok(html.includes('app.js'));
  assert.ok(html.includes('engine.js'));
});

test('registration, login and per-account isolation', async () => {
  const reg = await api('/api/mus/register', { method: 'POST', body: { username: 'tester', password: 'motdepasse123' } });
  assert.equal(reg.status, 200);
  token = reg.body.token;
  const me = await api('/api/mus/me');
  assert.equal(me.body.user.username, 'tester');
  const sans = await fetch(BASE + '/api/mus/me');
  assert.equal(sans.status, 401);
});

test('logout revokes the token', async () => {
  const r = await api('/api/mus/logout', { method: 'POST' });
  assert.equal(r.status, 200);
  const me = await api('/api/mus/me');
  assert.equal(me.status, 401);
  const l = await api('/api/mus/login', { method: 'POST', body: { username: 'tester', password: 'motdepasse123' } });
  assert.equal(l.status, 200);
  token = l.body.token;
});

test('CRUD playlist', async () => {
  const c = await api('/api/mus/playlists', { method: 'POST', body: { name: 'Test OSS' } });
  assert.equal(c.status, 200);
  const id = c.body.id;
  const add = await api('/api/mus/playlists/' + id + '/tracks', { method: 'POST', body: { videoId: VID, title: 'T', artist: 'A' } });
  assert.equal(add.status, 200);
  const g = await api('/api/mus/playlists/' + id);
  assert.equal(g.body.tracks.length, 1);
  assert.equal(g.body.tracks[0].videoId, VID);
  assert.equal(typeof g.body.tracks[0].duration, 'number');
  const d = await api('/api/mus/playlists/' + id, { method: 'DELETE' });
  assert.equal(d.status, 200);
  const g2 = await api('/api/mus/playlists/' + id);
  assert.equal(g2.status, 404);
});

test('likes and history', async () => {
  const l = await api('/api/mus/likes', { method: 'POST', body: { videoId: VID, title: 'T', artist: 'A' } });
  assert.equal(l.status, 200);
  const likes = await api('/api/mus/likes');
  assert.ok(likes.body.some((x) => x.videoId === VID));
  assert.ok(likes.body.every((x) => typeof x.duration === 'number'));
  const h = await api('/api/mus/history', { method: 'POST', body: { videoId: VID, title: 'T', artist: 'A' } });
  assert.equal(h.status, 200);
  const hist = await api('/api/mus/history');
  assert.ok(hist.body.some((x) => x.videoId === VID));
});

test('mix and recos respond without errors', async () => {
  const m = await api('/api/mus/mix?n=5');
  assert.equal(m.status, 200);
  assert.ok(Array.isArray(m.body));
  assert.equal(new Set(m.body.map((x) => x.videoId)).size, m.body.length);
  const r = await api('/api/mus/recos?n=5');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body));
});

test('invalid n parameters do not break the API', async () => {
  for (const path of ['/api/mus/history?n=abc', '/api/mus/history?n=-5', '/api/mus/recos?n=abc', '/api/mus/mix?n=abc']) {
    const r = await api(path);
    assert.equal(r.status, 200, path + ' -> ' + r.status);
    assert.ok(Array.isArray(r.body), path + ' non tableau');
  }
});

test('titles and artists truncated to 300 characters', async () => {
  const r = await api('/api/mus/likes', { method: 'POST', body: { videoId: 'aaaaaaaaaaa', title: 'T'.repeat(5000), artist: 'A'.repeat(5000) } });
  assert.equal(r.status, 200);
  const likes = await api('/api/mus/likes');
  const item = likes.body.find((x) => x.videoId === 'aaaaaaaaaaa');
  assert.ok(item);
  assert.ok(item.title.length <= 300);
  assert.ok(item.artist.length <= 300);
});

test('daily mixes: 3 coherent mixes', async () => {
  const r = await api('/api/mus/mixes');
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 3);
  const keys = r.body.map((m) => m.key);
  assert.deepEqual(keys.sort(), ['boucle', 'deco', 'favoris']);
  for (const m of r.body) {
    assert.equal(typeof m.name, 'string');
    assert.ok(Array.isArray(m.tracks));
    assert.equal(m.count, m.tracks.length);
    assert.equal(new Set(m.tracks.map((x) => x.videoId)).size, m.tracks.length);
  }
});

test('Subsonic gateway: ping, auth, playlists, stream', async () => {
  const q = 'u=tester&p=motdepasse123&v=1.16.1&c=test&f=json';
  const ping = await fetch(BASE + '/subsonic/rest/ping.view?' + q).then((r) => r.json());
  assert.equal(ping['subsonic-response'].status, 'ok');
  const bad = await fetch(BASE + '/subsonic/rest/ping.view?u=tester&p=wrong&v=1.16.1&c=test&f=json').then((r) => r.json());
  assert.equal(bad['subsonic-response'].status, 'failed');
  assert.equal(bad['subsonic-response'].error.code, 40);
  const pls = await fetch(BASE + '/subsonic/rest/getPlaylists.view?' + q).then((r) => r.json());
  assert.ok(Array.isArray(pls['subsonic-response'].playlists.playlist));
  const folders = await fetch(BASE + '/subsonic/rest/getMusicFolders.view?' + q).then((r) => r.json());
  assert.equal(folders['subsonic-response'].musicFolders.musicFolder[0].name, 'Sonora');
  const ext = await fetch(BASE + '/subsonic/rest/getOpenSubsonicExtensions.view?' + q).then((r) => r.json());
  assert.ok(ext['subsonic-response'].openSubsonicExtensions);
  const albums = await fetch(BASE + '/subsonic/rest/getAlbumList2.view?' + q + '&type=newest&size=5').then((r) => r.json());
  assert.ok(Array.isArray(albums['subsonic-response'].albumList2.album));
  const artists = await fetch(BASE + '/subsonic/rest/getArtists.view?' + q).then((r) => r.json());
  assert.ok(artists['subsonic-response'].artists.index.length >= 1);
  const st = await fetch(BASE + '/subsonic/rest/stream.view?' + q + '&id=dQw4w9WgXcQ', { redirect: 'manual' });
  assert.equal(st.status, 302);
  assert.ok(String(st.headers.get('location')).includes('/musique/dl/dQw4w9WgXcQ'));
});

test('reco feedback: dismiss and validation', async () => {
  const ok = await api('/api/mus/feedback', { method: 'POST', body: { videoId: 'aaaaaaaaaab', action: 'dismiss' } });
  assert.equal(ok.status, 200);
  const list = await api('/api/mus/feedback');
  assert.ok(list.body.some((x) => x.video_id === 'aaaaaaaaaab' && x.action === 'dismiss'));
  const bad = await api('/api/mus/feedback', { method: 'POST', body: { videoId: 'court', action: 'dismiss' } });
  assert.equal(bad.status, 400);
});

test('invalid videoId rejected', async () => {
  const r = await api('/api/mus/likes', { method: 'POST', body: { videoId: 'court', title: 'X', artist: 'Y' } });
  assert.equal(r.status, 502);
});
