// ============================================================
// musique.mjs — base musique multi-comptes (playlists, likes, historique, recos)
// ============================================================
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dureesConnues, dureesManquantes } from './durees.mjs';

const NL = String.fromCharCode(10);
const TAB = String.fromCharCode(9);
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = process.env.SONORA_DATA || join(__dirname, 'data');
const DBF = process.env.SONORA_DB || join(DATA, 'musique.db');
const COOKIES = process.env.SONORA_COOKIES || join(DATA, 'yt-cookies.txt');
const YTDLP = process.env.YTDLP_PATH || '/usr/bin/yt-dlp';
const NODE_BIN = process.env.SONORA_NODE_BIN || '/usr/local/bin/heid-node';
const EJS_COMPONENTS = process.env.SONORA_EJS || 'ejs:github';

let db = null;
const recosCache = new Map();

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, display TEXT, pass TEXT NOT NULL, created_at TEXT DEFAULT (datetime(\'now\')))',
  'CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at TEXT DEFAULT (datetime(\'now\')))',
  'CREATE TABLE IF NOT EXISTS playlists (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime(\'now\')))',
  'CREATE TABLE IF NOT EXISTS playlist_tracks (playlist_id INTEGER NOT NULL, video_id TEXT NOT NULL, title TEXT, artist TEXT, added_at TEXT DEFAULT (datetime(\'now\')), PRIMARY KEY (playlist_id, video_id))',
  'CREATE TABLE IF NOT EXISTS likes (user_id INTEGER NOT NULL, video_id TEXT NOT NULL, title TEXT, artist TEXT, added_at TEXT DEFAULT (datetime(\'now\')), PRIMARY KEY (user_id, video_id))',
  'CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, video_id TEXT NOT NULL, title TEXT, artist TEXT, at TEXT DEFAULT (datetime(\'now\')))',
  'CREATE TABLE IF NOT EXISTS pending (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, playlist_id INTEGER, title TEXT, artist TEXT, created_at TEXT DEFAULT (datetime(\'now\')))',
  'CREATE TABLE IF NOT EXISTS resolve_cache (q TEXT PRIMARY KEY, video_id TEXT, title TEXT, artist TEXT, at TEXT DEFAULT (datetime(\'now\')))',
  'CREATE INDEX IF NOT EXISTS idx_hist_user ON history(user_id, at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_pending ON pending(id)',
  'CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_hist_user_id ON history(user_id, id)',
  'CREATE INDEX IF NOT EXISTS idx_pt_playlist ON playlist_tracks(playlist_id)',
  'CREATE TABLE IF NOT EXISTS reco_cache (user_id INTEGER PRIMARY KEY, json TEXT NOT NULL, at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS track_meta (video_id TEXT PRIMARY KEY, duration INTEGER NOT NULL DEFAULT 0, at TEXT DEFAULT (datetime(\'now\')))',
  'CREATE TABLE IF NOT EXISTS reco_feedback (user_id INTEGER NOT NULL, video_id TEXT NOT NULL, action TEXT NOT NULL, at TEXT DEFAULT (datetime(\'now\')), PRIMARY KEY (user_id, video_id))',
].join('; ');

export function ouvrirBase() {
  if (db) return db;
  mkdirSync(DATA, { recursive: true });
  db = new DatabaseSync(DBF);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 8000');
  db.exec(SCHEMA);
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) {}
  if (!globalThis.__walTimer) {
    globalThis.__walTimer = setInterval(function () {
      try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) {}
    }, 3600000);
    try { globalThis.__walTimer.unref(); } catch (e) {}
  }
  seed();
  return db;
}

function hacher(mot, sel) { return scryptSync(mot, sel, 64).toString('hex'); }

export function creerUtilisateur(username, password, display) {
  const d = ouvrirBase();
  const sel = randomBytes(16).toString('hex');
  d.prepare('INSERT INTO users (username, display, pass) VALUES (?, ?, ?)')
    .run(username, display || username, sel + ':' + hacher(password, sel));
  return d.prepare('SELECT id FROM users WHERE username = ?').get(username).id;
}

function seed() {
  const d = db;
  if (d.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return;
  const alpha = 'abcdefghijkmnpqrstuvwxyz23456789';
  const mot = () => Array.from(randomBytes(10)).map((b) => alpha[b % alpha.length]).join('');
  const pM = mot(), pH = mot();
  creerUtilisateur('maria', pM, 'Maria');
  creerUtilisateur('heid', pH, 'Heid');
  const f = join(DATA, 'musique-users.txt');
  writeFileSync(f, ['maria / ' + pM, 'heid / ' + pH].join(NL) + NL);
  try { chmodSync(f, 0o600); } catch {}
  console.log('[musique] comptes crees');
}

function verifier(username, password) {
  const d = ouvrirBase();
  const u = d.prepare('SELECT id, username, display, pass FROM users WHERE username = ?').get(String(username || ''));
  if (!u) return null;
  const parts = String(u.pass).split(':');
  const sel = parts[0], ref = parts[1];
  if (!sel || !ref) return null;
  const calc = hacher(String(password || ''), sel);
  if (calc.length !== ref.length) return null;
  if (!timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(ref, 'hex'))) return null;
  return { id: u.id, username: u.username, display: u.display };
}

const SESSION_TTL_DAYS = Number(process.env.SONORA_SESSION_DAYS || 30);

function tokenPour(userId) {
  const d = ouvrirBase();
  try {
    d.prepare("DELETE FROM sessions WHERE created_at < datetime('now', ?)").run('-' + SESSION_TTL_DAYS + ' day');
    d.prepare('DELETE FROM sessions WHERE user_id = ? AND token NOT IN (SELECT token FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20)').run(userId, userId);
  } catch (e) {}
  const t = randomBytes(24).toString('hex');
  d.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(t, userId);
  return t;
}

function jeton(req) {
  const m = /^Bearer\s+([a-f0-9]{32,})$/.exec(String(req.headers.authorization || ''));
  return m ? m[1] : '';
}

function userDuToken(req) {
  const t = jeton(req);
  if (!t) return null;
  const d = ouvrirBase();
  return d.prepare("SELECT u.id, u.username, u.display FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.created_at >= datetime('now', ?)").get(t, '-' + SESSION_TTL_DAYS + ' day') || null;
}

function entier(v, def, min, max) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}
function texte(v, max) {
  return String(v == null ? '' : v).slice(0, max || 300);
}

function corps(req) {
  return new Promise((res) => {
    let c = '';
    req.on('data', (x) => { c += x; if (c.length > 200000) req.destroy(); });
    req.on('end', () => { try { res(JSON.parse(c || '{}')); } catch { res({}); } });
  });
}

export function identifiants(username, password) {
  return verifier(username, password);
}

export function lancerYtdlp(args, ms) {
  return new Promise((res) => {
    const p = spawn(YTDLP, ['--cookies', COOKIES, '--js-runtimes', 'node:' + NODE_BIN,
      '--remote-components', EJS_COMPONENTS, '--no-warnings'].concat(args), { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.stdout.on('data', (c) => { out += c.toString('utf8'); });
    const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch (e) {} }, ms || 25000);
    p.on('close', () => { clearTimeout(t); res(out); });
    p.on('error', () => { clearTimeout(t); res(''); });
  });
}

const PRINT = '%(id)s' + TAB + '%(title)s' + TAB + '%(channel)s' + TAB + '%(duration)s';

export async function resoudre(titre, artiste) {
  const d = ouvrirBase();
  const q = (String(artiste || '').trim() + ' ' + String(titre || '').trim()).trim().toLowerCase();
  if (!q) return null;
  const c = d.prepare('SELECT * FROM resolve_cache WHERE q = ?').get(q);
  if (c && c.video_id) return { video_id: c.video_id, title: c.title, artist: c.artist };
  const out = await lancerYtdlp(['--flat-playlist', '--print', PRINT, 'ytsearch1:' + q]);
  const ligne = out.split(NL).filter(Boolean)[0] || '';
  const morceaux = ligne.split(TAB);
  const vid = morceaux[0], t = morceaux[1], ch = morceaux[2];
  if (!vid || !/^[A-Za-z0-9_-]{11}$/.test(vid)) return null;
  d.prepare('INSERT OR REPLACE INTO resolve_cache (q, video_id, title, artist) VALUES (?, ?, ?, ?)')
    .run(q, vid, t || titre || '', ch || artiste || '');
  return { video_id: vid, title: t || titre, artist: (ch && ch !== 'NA' && ch !== 'N/A') ? ch : (artiste || '') };
}


const LISTE_AIMES = 'Títulos que te gustan';
function listeAimes(d, userId) {
  const row = d.prepare('SELECT id FROM playlists WHERE user_id = ? AND name = ?').get(userId, LISTE_AIMES);
  if (row) return row.id;
  d.prepare("INSERT INTO playlists (user_id, name, created_at) VALUES (?, ?, datetime('now'))").run(userId, LISTE_AIMES);
  return d.prepare('SELECT id FROM playlists WHERE user_id = ? AND name = ?').get(userId, LISTE_AIMES).id;
}

const RECOS_TTL = 3 * 60 * 60 * 1000;
const RECOS_VERSION = 4;
const RECOS_MAX = 40;
const MIX_TTL = 45 * 60 * 1000;
const recosEnCours = new Map();
const mixCache = new Map();
const mixesCache = new Map();
let ytActifs = 0;
const ytFile = [];
function ytPrendre() {
  return new Promise((res) => { if (ytActifs < 2) { ytActifs++; res(); } else ytFile.push(res); });
}
function ytRendre() { const n = ytFile.shift(); if (n) n(); else ytActifs--; }

const FILTRE_MIXTE = /mix|playlist|compilation|mega ?mix|best of|greatest hits|1 hour|full album|top [0-9]+|non ?stop|sesi[oó]n|radio|acoustic session|live session|reaction|lyrics video|slowed|reverb|sped ?up|nightcore|8d audio|bass ?boosted|1 ?hour|loop/i;

const PIPED_URL = (process.env.PIPED_URL || 'http://127.0.0.1:8081').replace(/\/$/, '');

async function reliePiped(videoId) {
  try {
    const r = await fetch(PIPED_URL + '/streams/' + encodeURIComponent(videoId), { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.relatedStreams || []).map((x) => {
      const id = (String(x.url || '').match(/v=([A-Za-z0-9_-]{11})/) || [])[1] || '';
      return { videoId: id, title: x.title || '', artist: x.uploaderName || '', duration: Number(x.duration || 0) };
    }).filter((x) => x.videoId);
  } catch (e) { return []; }
}

function melanger(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function uniques(list) {
  const vus = new Set(); const out = [];
  for (const it of list) { if (!it || !it.videoId || vus.has(it.videoId)) continue; vus.add(it.videoId); out.push(it); }
  return out;
}

function affinites(d, userId) {
  return d.prepare(
    'SELECT artiste, SUM(p) AS p FROM (' +
    ' SELECT artist AS artiste, 2.0 AS p FROM likes WHERE user_id = ? AND length(trim(artist)) > 0' +
    ' UNION ALL SELECT artist AS artiste, CASE WHEN at >= datetime(\'now\', \'-14 day\') THEN 1.6 WHEN at >= datetime(\'now\', \'-60 day\') THEN 1.0 ELSE 0.5 END AS p FROM history WHERE user_id = ? AND length(trim(artist)) > 0' +
    ' UNION ALL SELECT pt.artist AS artiste, 0.4 AS p FROM playlist_tracks pt JOIN playlists p ON p.id = pt.playlist_id WHERE p.user_id = ? AND length(trim(pt.artist)) > 0' +
    ') GROUP BY artiste ORDER BY p DESC LIMIT 10').all(userId, userId, userId);
}

function connus(d, userId) {
  const s = new Set();
  for (const id of rejetes(d, userId)) s.add(id);
  for (const r of d.prepare('SELECT video_id FROM likes WHERE user_id = ?').all(userId)) s.add(r.video_id);
  for (const r of d.prepare('SELECT pt.video_id FROM playlist_tracks pt JOIN playlists p ON p.id = pt.playlist_id WHERE p.user_id = ?').all(userId)) s.add(r.video_id);
  for (const r of d.prepare('SELECT video_id FROM history WHERE user_id = ? ORDER BY id DESC LIMIT 60').all(userId)) s.add(r.video_id);
  return s;
}

function rejetes(d, userId) {
  const s = new Set();
  try { for (const r of d.prepare("SELECT video_id FROM reco_feedback WHERE user_id = ? AND action = 'dismiss'").all(userId)) s.add(r.video_id); } catch (e) {}
  return s;
}

function secours(d, userId, n) {
  const likes = d.prepare('SELECT video_id, title, artist FROM likes WHERE user_id = ? ORDER BY added_at DESC LIMIT 120').all(userId)
    .map((x) => ({ videoId: x.video_id, title: x.title, artist: x.artist, seed: 'tes favoris', source: 'like' }));
  const hist = d.prepare('SELECT video_id, title, artist, COUNT(*) AS c FROM history WHERE user_id = ? GROUP BY video_id ORDER BY c DESC LIMIT 60').all(userId)
    .map((x) => ({ videoId: x.video_id, title: x.title, artist: x.artist, seed: 'ton historique', source: 'history' }));
  const pls = d.prepare('SELECT pt.video_id, pt.title, pt.artist FROM playlist_tracks pt JOIN playlists p ON p.id = pt.playlist_id WHERE p.user_id = ? ORDER BY RANDOM() LIMIT 60').all(userId)
    .map((x) => ({ videoId: x.video_id, title: x.title, artist: x.artist, seed: 'tes playlists', source: 'playlist' }));
  const rej = rejetes(d, userId);
  return melanger(uniques(likes.concat(hist, pls))).filter((x) => !rej.has(x.videoId)).slice(0, n);
}

function lireRecos(d, userId) {
  const row = d.prepare('SELECT json, at FROM reco_cache WHERE user_id = ?').get(userId);
  if (!row) return null;
  try {
    const data = JSON.parse(row.json);
    if (!data || Array.isArray(data) || data.v !== RECOS_VERSION || !Array.isArray(data.items)) return null;
    return { at: Number(row.at) || 0, items: data.items };
  } catch (e) { return null; }
}
function ecrireRecos(d, userId, items) {
  try {
    d.prepare('INSERT INTO reco_cache (user_id, json, at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, at = excluded.at')
      .run(userId, JSON.stringify({ v: RECOS_VERSION, items }), Date.now());
  } catch (e) { console.error('[recos] cache', e.message); }
  for (const k of Array.from(mixCache.keys())) { if (k.indexOf(userId + ':') === 0) mixCache.delete(k); }
  try { mixesCache.delete(userId); } catch (e) {}
}

async function calculerRecos(userId) {
  const d = ouvrirBase();
  const artistes = affinites(d, userId);
  const vus = connus(d, userId);
  const items = [];
  try {
    const seeds = d.prepare('SELECT video_id, title, artist FROM history WHERE user_id = ? ORDER BY id DESC LIMIT 12').all(userId)
      .concat(d.prepare('SELECT video_id, title, artist FROM likes WHERE user_id = ? ORDER BY RANDOM() LIMIT 6').all(userId));
    const vusSeed = new Set();
    const choisis = [];
    for (const s of seeds) {
      if (vusSeed.has(s.video_id)) continue;
      vusSeed.add(s.video_id);
      choisis.push(s);
      if (choisis.length >= 3) break;
    }
    const listes = await Promise.all(choisis.map(async (s) => ({ s, rel: await reliePiped(s.video_id) })));
    for (const { s, rel } of listes) {
      let pris = 0;
      for (const x of rel) {
        if (pris >= 5 || items.length >= 40) break;
        if (vus.has(x.videoId) || FILTRE_MIXTE.test(x.title)) continue;
        if (x.duration && (x.duration < 60 || x.duration > 600)) continue;
        vus.add(x.videoId);
        items.push({ videoId: x.videoId, title: x.title, artist: x.artist, seed: (s.artist || s.title || 'proche'), duration: x.duration, source: 'related' });
        pris++;
      }
    }
  } catch (e) { console.error('[recos] related', e.message); }
  for (const a of artistes.slice(0, 8)) {
    let out = '';
    try {
      await ytPrendre();
      try { out = await lancerYtdlp(['--flat-playlist', '--print', PRINT, 'ytsearch10:' + a.artiste], 30000); }
      finally { ytRendre(); }
    } catch (e) { out = ''; }
    let pris = 0;
    for (const ligne of out.split(NL).filter(Boolean)) {
      const m = ligne.split(TAB);
      const vid = m[0], t = m[1] || '', ch = m[2] || '', dur = Number(m[3] || 0);
      if (!vid || !/^[A-Za-z0-9_-]{11}$/.test(vid)) continue;
      if (vus.has(vid) || FILTRE_MIXTE.test(t)) continue;
      if (dur && (dur < 60 || dur > 600)) continue;
      vus.add(vid);
      items.push({ videoId: vid, title: t, artist: (ch && ch !== 'NA' && ch !== 'N/A') ? ch : a.artiste, seed: a.artiste, duration: dur || 0, source: 'reco' });
      if (++pris >= 3) break;
    }
    if (items.length >= 36) break;
  }
  if (items.length < 8) items.push(...secours(d, userId, 20));
  const parSeed = new Map();
  for (const it of uniques(items)) { if (!parSeed.has(it.seed)) parSeed.set(it.seed, []); parSeed.get(it.seed).push(it); }
  const melange = [];
  let encore = true;
  while (encore) {
    encore = false;
    for (const liste of parSeed.values()) { if (liste.length) { melange.push(liste.shift()); encore = true; } }
  }
  const final = melange.slice(0, RECOS_MAX);
  if (final.length) ecrireRecos(d, userId, final);
  return final;
}

function lancerRecos(userId) {
  if (recosEnCours.has(userId)) return recosEnCours.get(userId);
  const p = calculerRecos(userId)
    .catch((e) => { console.error('[recos] calcul', e.message); return []; })
    .finally(() => { recosEnCours.delete(userId); });
  recosEnCours.set(userId, p);
  return p;
}

async function recos(userId, n) {
  const d = ouvrirBase();
  const cache = lireRecos(d, userId);
  const frais = cache && Date.now() - cache.at < RECOS_TTL;
  if (!frais) lancerRecos(userId);
  const base = cache && cache.items.length ? cache.items : secours(d, userId, 30);
  if (!cache && base.length < 6) {
    const calc = await lancerRecos(userId);
    return calc.slice(0, n);
  }
  return base.slice(0, n);
}

async function mix(userId, n) {
  const cle = userId + ':' + n;
  const c = mixCache.get(cle);
  if (c && Date.now() - c.at < MIX_TTL) return c.items;
  const d = ouvrirBase();
  const rec = await recos(userId, 24);
  const recent = new Set(d.prepare('SELECT video_id FROM history WHERE user_id = ? ORDER BY id DESC LIMIT 40').all(userId).map((x) => x.video_id));
  const rej = rejetes(d, userId);
  const likes = melanger(d.prepare('SELECT video_id, title, artist FROM likes WHERE user_id = ? ORDER BY RANDOM() LIMIT 30').all(userId)
    .map((x) => ({ videoId: x.video_id, title: x.title, artist: x.artist, seed: 'tes favoris', source: 'like' })).filter((x) => !recent.has(x.videoId) && !rej.has(x.videoId)));
  const hist = d.prepare('SELECT video_id, title, artist, COUNT(*) AS c FROM history WHERE user_id = ? GROUP BY video_id ORDER BY c DESC LIMIT 20').all(userId)
    .map((x) => ({ videoId: x.video_id, title: x.title, artist: x.artist, seed: 'ton historique', source: 'history' }));
  const pls = d.prepare('SELECT pt.video_id, pt.title, pt.artist FROM playlist_tracks pt JOIN playlists p ON p.id = pt.playlist_id WHERE p.user_id = ? ORDER BY RANDOM() LIMIT 20').all(userId)
    .map((x) => ({ videoId: x.video_id, title: x.title, artist: x.artist, seed: 'tes playlists', source: 'playlist' })).filter((x) => !recent.has(x.videoId) && !rej.has(x.videoId));
  const quotas = [
    [likes, Math.ceil(n * 0.25)],
    [hist, Math.ceil(n * 0.15)],
    [pls, Math.ceil(n * 0.1)],
  ];
  const pris = new Set();
  const out = [];
  const ajouter = (arr, max) => { let i = 0; for (const it of arr) { if (i >= max) break; if (pris.has(it.videoId)) continue; pris.add(it.videoId); out.push(it); i++; } };
  ajouter(rec, Math.ceil(n * 0.5));
  for (const [arr, max] of quotas) ajouter(arr, max);
  if (out.length < n) ajouter(secours(d, userId, n), n - out.length);
  const final = melanger(out).slice(0, n);
  mixCache.set(cle, { at: Date.now(), items: final });
  if (mixCache.size > 50) mixCache.delete(mixCache.keys().next().value);
  return final;
}

const MIXES_TTL = 45 * 60 * 1000;

async function mixes(userId) {
  const c = mixesCache.get(userId);
  if (c && Date.now() - c.at < MIXES_TTL) return c.items;
  const d = ouvrirBase();
  const rec = await recos(userId, 20);
  const boucle = d.prepare('SELECT video_id, title, artist, COUNT(*) AS c FROM history WHERE user_id = ? GROUP BY video_id ORDER BY c DESC LIMIT 25').all(userId)
    .map((x) => ({ videoId: x.video_id, title: x.title, artist: x.artist, seed: 'ton historique', source: 'history' }));
  const favoris = melanger(d.prepare('SELECT video_id, title, artist FROM likes WHERE user_id = ? ORDER BY RANDOM() LIMIT 30').all(userId)
    .map((x) => ({ videoId: x.video_id, title: x.title, artist: x.artist, seed: 'tes favoris', source: 'like' })));
  const sec = secours(d, userId, 20);
  const remplir = (arr) => uniques(arr).slice(0, 20);
  const deco = remplir(rec.length ? rec : sec);
  const boucleFinal = remplir(boucle.length >= 5 ? boucle : boucle.concat(favoris, sec));
  const favFinal = remplir(favoris.length ? favoris : sec);
  const items = [
    { key: 'deco', name: 'Découvertes', subtitle: 'Nouveaux titres selon tes goûts', tracks: deco },
    { key: 'boucle', name: 'En boucle', subtitle: 'Ce que tu réécoutes le plus', tracks: boucleFinal },
    { key: 'favoris', name: 'Tes favoris', subtitle: 'Tes titres likés, en aléatoire', tracks: favFinal },
  ].map((m) => Object.assign({}, m, { count: m.tracks.length, cover: m.tracks.slice(0, 4).map((x) => x.videoId) }));
  mixesCache.set(userId, { at: Date.now(), items });
  if (mixesCache.size > 50) mixesCache.delete(mixesCache.keys().next().value);
  return items;
}

export function handleMusique(req, res, path, url) {
  if (!path.startsWith('/api/mus/')) return false;
  const d = ouvrirBase();
  const json = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(obj));
  };
  const route = path.slice('/api/mus'.length);

  (async () => {
    try {
      if (route === '/login' && req.method === 'POST') {
        const b = await corps(req);
        const u = verifier(b.username, b.password);
        if (!u) return json(401, { error: 'identifiants' });
        return json(200, { token: tokenPour(u.id), user: u });
      }
      if (route === '/register' && req.method === 'POST') {
        const b = await corps(req);
        const nom = String(b.username || '').trim().toLowerCase();
        const mdp = String(b.password || '');
        if (!/^[a-z0-9._-]{3,24}$/.test(nom)) return json(400, { error: 'nom invalide (3-24, a-z 0-9 . _ -)' });
        if (mdp.length < 8) return json(400, { error: 'mot de passe trop court (8 caracteres min)' });
        if (d.prepare('SELECT id FROM users WHERE username = ?').get(nom)) return json(409, { error: 'nom deja pris' });
        const sel = randomBytes(16).toString('hex');
        d.prepare('INSERT INTO users (username, display, pass) VALUES (?, ?, ?)').run(nom, nom, sel + ':' + hacher(mdp, sel));
        const cree = d.prepare('SELECT id, username, display FROM users WHERE username = ?').get(nom);
        return json(200, { token: tokenPour(cree.id), user: cree });
      }
      if (route === '/health') {
        const c = (sql) => { try { return d.prepare(sql).get().n; } catch (e) { return -1; } };
        const reco = (() => { try { return d.prepare('SELECT MAX(at) AS at FROM reco_cache').get().at || 0; } catch (e) { return 0; } })();
        return json(200, {
          ok: true, at: new Date().toISOString(), version: '1.1.0',
          users: c('SELECT COUNT(*) AS n FROM users'),
          playlists: c('SELECT COUNT(*) AS n FROM playlists'),
          tracks: c('SELECT COUNT(*) AS n FROM playlist_tracks'),
          likes: c('SELECT COUNT(*) AS n FROM likes'),
          history: c('SELECT COUNT(*) AS n FROM history'),
          pending: c('SELECT COUNT(*) AS n FROM pending'),
          recos_cached: reco > 0,
          recos_age_s: reco ? Math.round((Date.now() - reco) / 1000) : null,
        });
      }
      const u = userDuToken(req);
      if (!u) return json(401, { error: 'token' });

      if (route === '/logout' && req.method === 'POST') {
        try { d.prepare('DELETE FROM sessions WHERE token = ?').run(jeton(req)); } catch (e) {}
        return json(200, { ok: true });
      }
      if (route === '/me') return json(200, { user: u });

      if (route === '/playlists' && req.method === 'GET') {
        const ps = d.prepare('SELECT id, name FROM playlists WHERE user_id = ? ORDER BY name').all(u.id);
        const out = [];
        for (const p of ps) {
          const tr = d.prepare('SELECT video_id FROM playlist_tracks WHERE playlist_id = ?').all(p.id);
          out.push({ id: p.id, name: p.name, count: tr.length, cover: tr.slice(0, 4).map((x) => x.video_id) });
        }
        return json(200, out);
      }
      if (route === '/playlists' && req.method === 'POST') {
        const b = await corps(req);
        const nom = String(b.name || '').trim().slice(0, 80);
        if (!nom) return json(400, { error: 'nom' });
        const r = d.prepare('INSERT INTO playlists (user_id, name) VALUES (?, ?)').run(u.id, nom);
        return json(200, { id: Number(r.lastInsertRowid), name: nom, count: 0, cover: [] });
      }

      let m = /^\/playlists\/(\d+)$/.exec(route);
      if (m) {
        const pid = Number(m[1]);
        const p = d.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(pid, u.id);
        if (!p) return json(404, { error: 'playlist' });
        if (req.method === 'DELETE') {
          d.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(pid);
          d.prepare('DELETE FROM playlists WHERE id = ?').run(pid);
          return json(200, { ok: true });
        }
        if (req.method === 'GET') {
          const tr = d.prepare('SELECT pt.video_id, pt.title, pt.artist, COALESCE(tm.duration, 0) AS duration FROM playlist_tracks pt LEFT JOIN track_meta tm ON tm.video_id = pt.video_id WHERE pt.playlist_id = ? ORDER BY pt.added_at DESC').all(pid);
          const ids = tr.map((t) => t.video_id);
          const connues = dureesConnues(d, ids);
          if (ids.slice(0, 10).some((id) => !connues.has(id))) dureesManquantes(d, ids).catch(() => {});
          return json(200, { id: p.id, name: p.name, tracks: tr.map((t) => ({ videoId: t.video_id, title: t.title, artist: t.artist, duration: Number(t.duration) || connues.get(t.video_id) || 0 })) });
        }
        if (req.method === 'PATCH') {
          const b = await corps(req);
          const nom = String(b.name || '').trim().slice(0, 80);
          if (nom) d.prepare('UPDATE playlists SET name = ? WHERE id = ?').run(nom, pid);
          return json(200, { ok: true, name: nom });
        }
      }

      m = /^\/playlists\/(\d+)\/tracks$/.exec(route);
      if (m && req.method === 'POST') {
        const pid = Number(m[1]);
        if (!d.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').get(pid, u.id)) return json(404, { error: 'playlist' });
        const b = await corps(req);
        let vid = String(b.videoId || '');
        let titre = texte(b.title, 300), artiste = texte(b.artist, 300);
        if (!/^[A-Za-z0-9_-]{11}$/.test(vid)) {
          const r = await resoudre(b.title, b.artist);
          if (!r) return json(502, { error: 'introuvable' });
          vid = r.video_id; titre = texte(r.title, 300); artiste = texte(r.artist, 300);
        }
        d.prepare('INSERT OR IGNORE INTO playlist_tracks (playlist_id, video_id, title, artist) VALUES (?, ?, ?, ?)').run(pid, vid, titre, artiste);
        return json(200, { ok: true, videoId: vid, title: titre, artist: artiste });
      }

      m = /^\/playlists\/(\d+)\/tracks\/([A-Za-z0-9_-]{11})$/.exec(route);
      if (m && req.method === 'DELETE') {
        const pid = Number(m[1]);
        if (!d.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').get(pid, u.id)) return json(404, { error: 'playlist' });
        d.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND video_id = ?').run(pid, m[2]);
        return json(200, { ok: true });
      }

      if (route === '/likes' && req.method === 'GET') {
        const ls = d.prepare('SELECT l.video_id, l.title, l.artist, COALESCE(tm.duration, 0) AS duration FROM likes l LEFT JOIN track_meta tm ON tm.video_id = l.video_id WHERE l.user_id = ? ORDER BY l.added_at DESC').all(u.id);
        const idsL = ls.map((l) => l.video_id);
        const connuesL = dureesConnues(d, idsL);
        if (idsL.slice(0, 10).some((id) => !connuesL.has(id) && !Number(ls.find((x) => x.video_id === id).duration))) dureesManquantes(d, idsL).catch(() => {});
        return json(200, ls.map((l) => ({ videoId: l.video_id, title: l.title, artist: l.artist, duration: Number(l.duration) || connuesL.get(l.video_id) || 0 })));
      }
      if (route === '/likes' && req.method === 'POST') {
        const b = await corps(req);
        let vid = String(b.videoId || '');
        b.title = texte(b.title, 300); b.artist = texte(b.artist, 300);
        if (!/^[A-Za-z0-9_-]{11}$/.test(vid)) {
          const r = await resoudre(b.title, b.artist);
          if (!r) return json(502, { error: 'introuvable' });
          vid = r.video_id; b.title = texte(r.title, 300); b.artist = texte(r.artist, 300);
        }
        d.prepare('INSERT OR IGNORE INTO likes (user_id, video_id, title, artist) VALUES (?, ?, ?, ?)').run(u.id, vid, b.title || '', b.artist || '');
        try {
          const pid = listeAimes(d, u.id);
          d.prepare('INSERT OR IGNORE INTO playlist_tracks (playlist_id, video_id, title, artist) VALUES (?, ?, ?, ?)').run(pid, vid, b.title || '', b.artist || '');
        } catch (e) {}
        return json(200, { ok: true, videoId: vid });
      }
      m = /^\/likes\/([A-Za-z0-9_-]{11})$/.exec(route);
      if (m && req.method === 'DELETE') {
        d.prepare('DELETE FROM likes WHERE user_id = ? AND video_id = ?').run(u.id, m[1]);
        try {
          const pid = listeAimes(d, u.id);
          d.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND video_id = ?').run(pid, m[1]);
        } catch (e) {}
        return json(200, { ok: true });
      }

      if (route === '/feedback' && req.method === 'POST') {
        const b = await corps(req);
        const vid = String(b.videoId || '');
        const action = String(b.action || 'dismiss');
        if (!/^[A-Za-z0-9_-]{11}$/.test(vid) || (action !== 'dismiss' && action !== 'like')) return json(400, { error: 'parametres' });
        d.prepare('INSERT INTO reco_feedback (user_id, video_id, action) VALUES (?, ?, ?) ON CONFLICT(user_id, video_id) DO UPDATE SET action = excluded.action, at = datetime(\'now\')').run(u.id, vid, action);
        if (action === 'like') d.prepare('INSERT OR IGNORE INTO likes (user_id, video_id, title, artist) VALUES (?, ?, ?, ?)').run(u.id, vid, '', '');
        d.prepare('DELETE FROM reco_cache WHERE user_id = ?').run(u.id);
        mixCache.delete(u.id + ':' + 30);
        for (const k of Array.from(mixCache.keys())) { if (k.indexOf(u.id + ':') === 0) mixCache.delete(k); }
        mixesCache.delete(u.id);
        lancerRecos(u.id);
        return json(200, { ok: true, action });
      }
      if (route === '/feedback' && req.method === 'GET') {
        return json(200, d.prepare('SELECT video_id, action, at FROM reco_feedback WHERE user_id = ? ORDER BY at DESC').all(u.id));
      }

      if (route === '/history' && req.method === 'GET') {
        const n = entier(url.searchParams.get('n'), 50, 1, 200);
        const h = d.prepare('SELECT h.video_id, h.title, h.artist, h.at, COALESCE(tm.duration, 0) AS duration FROM history h LEFT JOIN track_meta tm ON tm.video_id = h.video_id WHERE h.user_id = ? ORDER BY h.at DESC LIMIT ?').all(u.id, n);
        return json(200, h.map((x) => ({ videoId: x.video_id, title: x.title, artist: x.artist, at: x.at, duration: Number(x.duration) || 0 })));
      }
      if (route === '/history' && req.method === 'POST') {
        const b = await corps(req);
        const vid = String(b.videoId || '');
        if (!/^[A-Za-z0-9_-]{11}$/.test(vid)) return json(400, { error: 'videoId' });
        d.prepare('INSERT INTO history (user_id, video_id, title, artist) VALUES (?, ?, ?, ?)').run(u.id, vid, texte(b.title, 300), texte(b.artist, 300));
        return json(200, { ok: true });
      }

      if (route === '/recos') {
        const n = entier(url.searchParams.get('n'), 20, 1, 50);
        return json(200, await recos(u.id, n));
      }
      if (route === '/mix') {
        const n = entier(url.searchParams.get('n'), 30, 1, 60);
        return json(200, await mix(u.id, n));
      }
      if (route === '/mixes') {
        return json(200, await mixes(u.id));
      }
      if (route === '/resolve') {
        const r = await resoudre(url.searchParams.get('title'), url.searchParams.get('artist'));
        return r ? json(200, r) : json(502, { error: 'introuvable' });
      }
      if (route === '/pending') {
        return json(200, { reste: d.prepare('SELECT COUNT(*) AS n FROM pending WHERE user_id = ?').get(u.id).n });
      }
      return json(404, { error: 'route' });
    } catch (e) {
      return json(500, { error: String((e && e.message) || e).slice(0, 200) });
    }
  })();

  return true;
}

// Export réservé aux tests unitaires (fonctions pures).
export const internals = { melanger, uniques, FILTRE_MIXTE, RECOS_VERSION };
