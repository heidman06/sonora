#!/usr/bin/env node
// Sonora - API and player smoke test. Exit code 0 if everything passes.
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const BASE = process.env.SONORA_BASE || 'http://127.0.0.1:3011';
const DATA = process.env.SONORA_DATA || './data';
const results = [];
let token = '';
let recosFrais = false;

function record(name, ok, extra, err) {
  results.push(Object.assign({ name, ok }, extra || {}, err ? { error: String(err.message || err) } : {}));
}

async function check(name, fn) {
  const t0 = Date.now();
  try {
    const extra = await fn();
    record(name, true, Object.assign({ ms: Date.now() - t0 }, extra || {}));
  } catch (e) {
    record(name, false, { ms: Date.now() - t0 }, e);
  }
}

async function req(path, opts) {
  const r = await fetch(BASE + path, Object.assign({ headers: token ? { Authorization: 'Bearer ' + token } : {} }, opts || {}));
  const buf = Buffer.from(await r.arrayBuffer());
  let json = null;
  try { json = JSON.parse(buf.toString('utf8')); } catch (e) {}
  return { status: r.status, headers: r.headers, buf, json };
}
function assert(c, msg) { if (!c) throw new Error(msg || 'assert'); }
function isVid(v) { return typeof v === 'string' && /^[A-Za-z0-9_-]{11}$/.test(v); }

const users = readFileSync(DATA + '/musique-users.txt', 'utf8').split('\n').map((l) => l.split('/').map((s) => s.trim())).filter((x) => x.length >= 2);
const heid = users.find((x) => x[0] === 'heid');
assert(heid, 'compte heid introuvable');

await check('page /musique/ 200', async () => {
  const r = await req('/musique/');
  assert(r.status === 200, 'status ' + r.status);
  const html = r.buf.toString('utf8');
  assert(html.indexOf('assets/index-') > 0, 'bundle React absent');
  assert(html.indexOf('id="root"') > 0, 'root absent');
  return { bytes: r.buf.length };
});

await check('page legacy /musique-legacy/ 200', async () => {
  const r = await req('/musique-legacy/');
  assert(r.status === 200, 'status ' + r.status);
  const html = r.buf.toString('utf8');
  assert(html.indexOf('app.js') > 0, 'app.js absent');
  assert(html.indexOf('engine.js') > 0, 'engine.js absent');
  return { bytes: r.buf.length };
});

await check('GET /api/mus/health 200 public', async () => {
  const r = await req('/api/mus/health');
  assert(r.status === 200, 'status ' + r.status);
  assert(r.json && r.json.ok === true, 'ok false');
  assert(r.json.users >= 1 && r.json.likes >= 1, 'compteurs invalides');
  return { version: r.json.version, likes: r.json.likes, recos_cached: r.json.recos_cached };
});

await check('POST /api/mus/login', async () => {
  const r = await req('/api/mus/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: heid[0], password: heid[1] }) });
  assert(r.status === 200 && r.json.token, 'login refusé');
  token = r.json.token;
  assert(r.json.user && r.json.user.username === 'heid', 'mauvais utilisateur');
  return { user: r.json.user.username };
});

await check('GET /api/mus/me', async () => {
  const r = await req('/api/mus/me');
  assert(r.status === 200 && r.json.user.username === 'heid', 'me invalide');
});

await check('GET /api/mus/mixes2 forme v2', async () => {
  const r = await req('/api/mus/mixes2');
  assert(r.status === 200, 'status ' + r.status);
  assert(r.json && r.json.v === 1 && Array.isArray(r.json.mixes), 'forme v2 absente');
  assert(r.json.mixes.length <= 12, 'trop de mixes');
  for (const m of r.json.mixes) {
    assert(m.count === m.tracks.length, 'count != tracks');
    assert(m.cover.length === Math.min(4, m.tracks.length), 'cover');
    assert(!(m.subtitleKey && m.seeds && m.seeds.length), 'XOR subtitle/seeds');
  }
  return { mixes: r.json.mixes.length, cold: r.json.cold };
});

await check('GET /api/mus/me sans token = 401', async () => {
  const r = await fetch(BASE + '/api/mus/me');
  assert(r.status === 401, 'status ' + r.status);
});

let firstPlaylist = null;
await check('GET /api/mus/playlists', async () => {
  const r = await req('/api/mus/playlists');
  assert(r.status === 200 && Array.isArray(r.json), 'réponse invalide');
  assert(r.json.length >= 1, 'aucune playlist');
  firstPlaylist = r.json[0];
  return { count: r.json.length, first: firstPlaylist.name };
});

await check('GET /api/mus/playlists/:id', async () => {
  const r = await req('/api/mus/playlists/' + firstPlaylist.id);
  assert(r.status === 200 && Array.isArray(r.json.tracks), 'tracks invalides');
  return { tracks: r.json.tracks.length };
});

await check('GET /api/mus/likes', async () => {
  const r = await req('/api/mus/likes');
  assert(r.status === 200 && Array.isArray(r.json), 'réponse invalide');
  assert(r.json.every((x) => isVid(x.videoId)), 'videoId invalide');
  return { likes: r.json.length };
});

await check('GET /api/mus/history', async () => {
  const r = await req('/api/mus/history?n=20');
  assert(r.status === 200 && Array.isArray(r.json), 'réponse invalide');
  return { history: r.json.length };
});

await check('GET /api/mus/recos frais et uniques', async () => {
  const t0 = Date.now();
  const r = await req('/api/mus/recos?n=10');
  const ms = Date.now() - t0;
  assert(r.status === 200 && Array.isArray(r.json), 'réponse invalide');
  assert(r.json.length >= 6, 'trop peu de recos: ' + r.json.length);
  assert(r.json.every((x) => isVid(x.videoId)), 'videoId invalide');
  assert(new Set(r.json.map((x) => x.videoId)).size === r.json.length, 'doublons');
  assert(ms < 2000, 'trop lent: ' + ms + 'ms');
  recosFrais = r.json.some((x) => x.source === 'reco' || x.source === 'related');
  return { n: r.json.length, ms, frais: recosFrais };
});

await check('GET /api/mus/mix équilibré et unique', async () => {
  const r = await req('/api/mus/mix?n=24');
  assert(r.status === 200 && Array.isArray(r.json), 'réponse invalide');
  assert(r.json.length === 24, 'taille ' + r.json.length);
  assert(new Set(r.json.map((x) => x.videoId)).size === 24, 'doublons');
  const src = {};
  for (const x of r.json) src[x.source || '?'] = (src[x.source || '?'] || 0) + 1;
  if (recosFrais) assert((src.reco || 0) + (src.related || 0) >= 5, 'pas assez de découvertes: ' + JSON.stringify(src));
  return { sources: src };
});

await check('audio cache + Range 206', async () => {
  const dir = DATA + '/musique';
  const files = readdirSync(dir).filter((n) => n.endsWith('.m4a'));
  assert(files.length > 0, 'cache vide');
  const id = files[0].replace(/\.m4a$/, '');
  const r = await req('/musique/dl/' + id, { headers: { Range: 'bytes=0-1023' } });
  assert(r.status === 206, 'status ' + r.status);
  assert(/audio\//.test(r.headers.get('content-type') || ''), 'content-type ' + r.headers.get('content-type'));
  assert(r.buf.length === 1024, 'taille range ' + r.buf.length);
  assert(/^bytes 0-/.test(r.headers.get('content-range') || ''), 'content-range');
  const h = await req('/musique/dl/' + id, { method: 'HEAD' });
  assert(h.status === 200, 'HEAD status ' + h.status);
  return { id, cached: files.length };
});

await check('base SQLite cohérente', async () => {
  const d = new DatabaseSync(DATA + '/musique.db', { readOnly: true });
  const c = (s) => d.prepare(s).get().n;
  const counts = { users: c('SELECT COUNT(*) AS n FROM users'), likes: c('SELECT COUNT(*) AS n FROM likes'), tracks: c('SELECT COUNT(*) AS n FROM playlist_tracks') };
  assert(counts.users >= 1 && counts.likes >= 1 && counts.tracks >= 1, JSON.stringify(counts));
  const cache = d.prepare('SELECT COUNT(*) AS n FROM reco_cache').get().n;
  const integ = d.prepare('PRAGMA integrity_check').get();
  const val = integ && (integ.integrity_check || integ['integrity_check']);
  assert(val === 'ok', 'integrity_check: ' + JSON.stringify(integ));
  return Object.assign(counts, { reco_cache: cache, integrity: val });
});

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ ok: failed.length === 0, total: results.length, failed: failed.length, results }, null, 1));
process.exit(failed.length === 0 ? 0 : 1);
