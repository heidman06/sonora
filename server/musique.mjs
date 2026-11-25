// ============================================================
// musique.mjs - multi-account music database (playlists, likes, history, recos)
// ============================================================
import { DatabaseSync } from 'node:sqlite';
import { composerMoods, catalogueStatique, MOODS_VERSION } from './musique-moods.mjs';
import { composerMixes, MIXES_VERSION, melangerSeede } from './musique-mixes.mjs';
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
  'CREATE TABLE IF NOT EXISTS mix_cache (user_id INTEGER PRIMARY KEY, json TEXT NOT NULL, at INTEGER NOT NULL, seed TEXT NOT NULL)',
].join('; ');

export function fermerBase() {
  try { if (db) db.close(); } catch (e) {}
  db = null;
}

export function ouvrirBase() {
  if (db) return db;
  mkdirSync(DATA, { recursive: true });
  db = new DatabaseSync(DBF);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 8000');
  db.exec(SCHEMA);
  // P1: soft migration, single backfill (column-absent guard makes it once-only).
  try {
    const cols = db.prepare('PRAGMA table_info(playlist_tracks)').all();
    if (!cols.some((c) => c.name === 'position')) {
      db.exec('ALTER TABLE playlist_tracks ADD COLUMN position INTEGER');
      const pls = db.prepare('SELECT DISTINCT playlist_id FROM playlist_tracks').all();
      const up = db.prepare('UPDATE playlist_tracks SET position = ? WHERE rowid = ?');
      for (const p of pls) {
        const rows = db.prepare('SELECT rowid AS rid FROM playlist_tracks WHERE playlist_id = ? ORDER BY added_at ASC, rowid ASC').all(p.playlist_id);
        rows.forEach((r, i) => up.run(i, r.rid));
      }
    }
  } catch (e) {}
  // S5: soft migration history.duration + one-shot backfill from track_meta.
  try {
    const hc = db.prepare('PRAGMA table_info(history)').all();
    if (!hc.some((c) => c.name === 'duration')) {
      db.exec('ALTER TABLE history ADD COLUMN duration INTEGER');
      db.exec('UPDATE history SET duration = (SELECT tm.duration FROM track_meta tm WHERE tm.video_id = history.video_id) WHERE duration IS NULL');
    }
  } catch (e) {}
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

export async function lancerYtdlp(args, ms) {
  await ytPrendre();
  try {
    return await new Promise((res) => {
    const p = spawn(YTDLP, ['--cookies', COOKIES, '--js-runtimes', 'node:' + NODE_BIN,
      '--remote-components', EJS_COMPONENTS, '--no-warnings'].concat(args), { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.stdout.on('data', (c) => { out += c.toString('utf8'); });
    const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch (e) {} }, ms || 25000);
    p.on('close', () => { clearTimeout(t); res(out); });
    p.on('error', () => { clearTimeout(t); res(''); });
    });
  } finally { ytRendre(); }
}

const PRINT = '%(id)s' + TAB + '%(title)s' + TAB + '%(channel)s' + TAB + '%(duration)s';

async function ytPlaylist(list) {
  await ytPrendre();
  try {
    return await new Promise((resolve, reject) => {
    const proc = spawn(YTDLP, ['--cookies', COOKIES, '--js-runtimes', 'node:' + NODE_BIN, '--remote-components', EJS_COMPONENTS, '--flat-playlist', '--playlist-end', '100', '--no-warnings', '-J', 'https://www.youtube.com/playlist?list=' + list], { stdio: ['ignore', 'pipe', 'ignore'] });
    let sortie = '';
    proc.stdout.on('data', (c) => { sortie += c.toString('utf8'); });
    const minuteur = setTimeout(() => { try { proc.kill('SIGKILL'); } catch (e) {} reject(new Error('timeout')); }, 30000);
    proc.on('close', (code) => {
      clearTimeout(minuteur);
      if (code !== 0) return reject(new Error('yt-dlp'));
      try {
        const info = JSON.parse(sortie);
        const tracks = (info.entries || []).filter((e) => e && e.id).map((e) => ({
          videoId: e.id,
          title: e.title || '',
          artist: e.channel || e.uploader || '',
          duration: Number(e.duration) || 0,
          thumb: (e.thumbnails && e.thumbnails[0] && e.thumbnails[0].url) || ('https://i.ytimg.com/vi/' + e.id + '/mqdefault.jpg'),
        }));
        resolve({ name: info.title || '', tracks, truncated: (info.entries || []).length >= 100 });
      } catch (e) { reject(e); }
    });
    proc.on('error', reject);
    });
  } finally { ytRendre(); }
}

export function metaConnue(d, vid) {
  const l = d.prepare('SELECT title, artist FROM likes WHERE video_id = ? AND length(trim(title)) > 0 LIMIT 1').get(vid);
  if (l) return l;
  const p = d.prepare('SELECT title, artist FROM playlist_tracks WHERE video_id = ? AND length(trim(title)) > 0 LIMIT 1').get(vid);
  if (p) return p;
  const r = d.prepare('SELECT title, artist FROM resolve_cache WHERE video_id = ? LIMIT 1').get(vid);
  if (r && r.title) return { title: r.title, artist: r.artist };
  return null;
}

// Fill blank metadata rows (CarPlay star/scrobble, feedback like) without blocking the request.
export function majMetaAsync(vid) {
  void (async () => {
    try {
      const out = await lancerYtdlp(['--no-playlist', '--print', PRINT, 'https://www.youtube.com/watch?v=' + vid], 20000);
      const m = (out.split(NL).filter(Boolean)[0] || '').split(TAB);
      const t = m[1] || '', ch = m[2] || '';
      if (!t) return;
      const artist = (ch && ch !== 'NA' && ch !== 'N/A') ? ch : '';
      const d = ouvrirBase();
      d.prepare('UPDATE likes SET title = ?, artist = ? WHERE video_id = ? AND length(trim(title)) = 0').run(t, artist, vid);
      d.prepare('UPDATE playlist_tracks SET title = ?, artist = ? WHERE video_id = ? AND length(trim(title)) = 0').run(t, artist, vid);
      d.prepare('UPDATE history SET title = ?, artist = ? WHERE video_id = ? AND length(trim(title)) = 0').run(t, artist, vid);
    } catch (e) {}
  })();
}

export function pousseHistory(d, userId, vid, titre, artiste, duree) {
  const dernier = d.prepare('SELECT video_id, at FROM history WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);
  if (dernier && dernier.video_id === vid && (Date.now() - Date.parse(dernier.at + 'Z')) < 60000) return;
  const dur = Number.isFinite(Number(duree)) && Number(duree) > 0 ? Math.min(36000, Math.round(Number(duree))) : null;
  d.prepare('INSERT INTO history (user_id, video_id, title, artist, duration) VALUES (?, ?, ?, ?, ?)').run(userId, vid, texte(titre, 300), texte(artiste, 300), dur);
  for (const k of Array.from(statsCache.keys())) { if (k.indexOf(userId + ':') === 0) statsCache.delete(k); }
}

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
const moodsCache = new Map();
const MOODS_TTL = 30 * 60 * 1000;
function purgeMoods(userId) { for (const k of Array.from(moodsCache.keys())) { if (k.indexOf(userId + ':') === 0) moodsCache.delete(k); } }
const mixEpoch = new Map();
const lastWarm = new Map();
let warmActif = false;
let warmLances = 0;
let compteSqlMixes = 0;
const warmFile = [];
function purgeMixes(userId) {
  mixesCache.delete(userId);
  try { ouvrirBase().prepare('DELETE FROM mix_cache WHERE user_id = ?').run(userId); } catch (e) {}
  mixEpoch.set(userId, (mixEpoch.get(userId) || 0) + 1);
}
function ecrireWarm(userId, epoch, seed, resp) {
  if ((mixEpoch.get(userId) || 0) !== epoch) return false;
  const r = ouvrirBase().prepare('UPDATE mix_cache SET json = ?, at = ? WHERE user_id = ? AND seed = ?').run(JSON.stringify(resp), Date.now(), userId, seed);
  if (r.changes) mixesCache.set(userId, { at: Date.now(), seed, resp });
  return r.changes > 0;
}
let ytActifs = 0;
const ytFile = [];
function ytPrendre() {
  return new Promise((res) => { if (ytActifs < 2) { ytActifs++; res(); } else ytFile.push(res); });
}
function ytRendre() { const n = ytFile.shift(); if (n) n(); else ytActifs--; }

const FILTRE_MIXTE = /\b(?:mega ?mix|megamix|non ?stop|1 ?hour|one hour|full album|best of|greatest hits|top [0-9]+|slowed|reverb|sped ?up|nightcore|8d audio|bass ?boosted|lyrics? video|reaction|live session|acoustic session|sesi[oó]n|radio (?:edit|session|mix|version)|playlist|compilation|mix|loop (?:version|edit))\b/i;

const PIPED_URL = (process.env.PIPED_URL ?? 'http://127.0.0.1:8081').replace(/\/$/, '');

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

export function moodsPour(d, userId, lang) {
  const cle = userId + ':' + lang;
  const c = moodsCache.get(cle);
  if (c && Date.now() - c.at < MOODS_TTL) return c.val;
  const nLikes = d.prepare('SELECT COUNT(*) AS n FROM likes WHERE user_id = ?').get(userId).n;
  const nHist = d.prepare("SELECT COUNT(*) AS n FROM history WHERE user_id = ? AND at >= datetime('now','-90 day')").get(userId).n;
  const cold = nLikes < 3 && nHist < 10;
  let val;
  if (cold) {
    val = { cold: true, moods: catalogueStatique(lang), artists: [] };
  } else {
    const aff = affinites(d, userId);
    const likes = d.prepare('SELECT title, artist FROM likes WHERE user_id = ? ORDER BY added_at DESC LIMIT 200').all(userId);
    const history = d.prepare("SELECT title, artist, at FROM history WHERE user_id = ? AND at >= datetime('now','-90 day') ORDER BY at DESC LIMIT 400").all(userId);
    val = composerMoods({ likes, history, affinites: aff, lang, cold: false });
  }
  moodsCache.set(cle, { at: Date.now(), val });
  if (moodsCache.size > 60) moodsCache.delete(moodsCache.keys().next().value);
  return val;
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
  purgeMixes(userId);
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
      out = await lancerYtdlp(['--flat-playlist', '--print', PRINT, 'ytsearch10:' + a.artiste], 30000);
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
const statsCache = new Map();
const radioCache = new Map();
const RADIO_TTL = 30 * 60 * 1000;

export function statsPour(d, userId, mois) {
  const cle = userId + ':' + mois;
  const c = statsCache.get(cle);
  if (c && Date.now() - c.at < 60000) return c.items;
  const since = '-' + mois + ' month';
  const jo = "FROM history h LEFT JOIN track_meta tm ON tm.video_id = h.video_id WHERE h.user_id = ? AND h.at >= datetime('now', ?)";
  const totals = d.prepare('SELECT COUNT(*) AS plays, COALESCE(SUM(COALESCE(NULLIF(h.duration, 0), NULLIF(tm.duration, 0), 0)), 0) / 60.0 AS minutes, COUNT(DISTINCT h.video_id) AS tracks ' + jo).get(userId, since);
  const topTracks = d.prepare('SELECT h.video_id AS videoId, MAX(h.title) AS title, MAX(h.artist) AS artist, COUNT(*) AS plays, COALESCE(MAX(tm.duration), 0) AS duration ' + jo + ' GROUP BY h.video_id ORDER BY plays DESC LIMIT 20').all(userId, since);
  const topArtists = d.prepare("SELECT h.artist AS artist, COUNT(*) AS plays, COALESCE(SUM(COALESCE(NULLIF(h.duration, 0), NULLIF(tm.duration, 0), 0)), 0) / 60.0 AS minutes " + jo + " AND length(trim(h.artist)) > 0 GROUP BY h.artist ORDER BY plays DESC LIMIT 12").all(userId, since);
  const perMonth = d.prepare("SELECT strftime('%Y-%m', h.at) AS month, COUNT(*) AS plays, COALESCE(SUM(COALESCE(NULLIF(h.duration, 0), NULLIF(tm.duration, 0), 0)), 0) / 60.0 AS minutes " + jo + ' GROUP BY month ORDER BY month').all(userId, since);
  const items = { totals: { plays: totals.plays, minutes: Math.round(totals.minutes), tracks: totals.tracks }, topTracks, topArtists, perMonth };
  statsCache.set(cle, { at: Date.now(), items });
  if (statsCache.size > 60) statsCache.delete(statsCache.keys().next().value);
  return items;
}

function smartPour(d, userId, key) {
  const map = (x) => ({ videoId: x.video_id, title: x.title || '', artist: x.artist || '', duration: Number(x.duration) || 0 });
  if (key === 'top') {
    return d.prepare('SELECT h.video_id, MAX(h.title) AS title, MAX(h.artist) AS artist, COUNT(*) AS c, COALESCE(MAX(tm.duration), 0) AS duration FROM history h LEFT JOIN track_meta tm ON tm.video_id = h.video_id WHERE h.user_id = ? GROUP BY h.video_id ORDER BY c DESC LIMIT 50').all(userId).map(map);
  }
  if (key === 'recent') {
    const rows = d.prepare('SELECT video_id, title, artist, added_at, 0 AS duration FROM likes WHERE user_id = ? UNION ALL SELECT pt.video_id, pt.title, pt.artist, pt.added_at, 0 FROM playlist_tracks pt JOIN playlists p ON p.id = pt.playlist_id WHERE p.user_id = ? ORDER BY added_at DESC LIMIT 80').all(userId, userId);
    return uniques(rows.map((x) => ({ videoId: x.video_id, title: x.title, artist: x.artist, duration: 0 }))).slice(0, 50);
  }
  if (key === 'never') {
    return d.prepare('SELECT l.video_id, l.title, l.artist, COALESCE(tm.duration, 0) AS duration FROM likes l LEFT JOIN track_meta tm ON tm.video_id = l.video_id WHERE l.user_id = ? AND l.video_id NOT IN (SELECT video_id FROM history WHERE user_id = ?) UNION SELECT pt.video_id, pt.title, pt.artist, COALESCE(tm.duration, 0) FROM playlist_tracks pt JOIN playlists p ON p.id = pt.playlist_id LEFT JOIN track_meta tm ON tm.video_id = pt.video_id WHERE p.user_id = ? AND pt.video_id NOT IN (SELECT video_id FROM history WHERE user_id = ?) LIMIT 50').all(userId, userId, userId, userId).map(map);
  }
  return null;
}

// Immediate, yt-dlp-free fallback for radio / CarPlay (same-artist library + secours).
export function radioSync(d, userId, seed, n) {
  const rej = rejetes(d, userId);
  let artiste = '';
  if (/^[A-Za-z0-9_-]{11}$/.test(seed)) {
    const src = d.prepare('SELECT artist FROM likes WHERE video_id = ? AND length(trim(artist)) > 0 LIMIT 1').get(seed)
      || d.prepare('SELECT artist FROM playlist_tracks WHERE video_id = ? AND length(trim(artist)) > 0 LIMIT 1').get(seed)
      || d.prepare('SELECT artist FROM history WHERE video_id = ? AND length(trim(artist)) > 0 LIMIT 1').get(seed)
      || d.prepare('SELECT artist FROM resolve_cache WHERE video_id = ? LIMIT 1').get(seed);
    artiste = (src && src.artist) || '';
  } else artiste = String(seed || '').slice(0, 100);
  const rows = artiste
    ? d.prepare('SELECT video_id, title, artist FROM likes WHERE user_id = ? AND artist = ? UNION ALL SELECT h.video_id, h.title, h.artist FROM history h WHERE h.user_id = ? AND h.artist = ? UNION ALL SELECT pt.video_id, pt.title, pt.artist FROM playlist_tracks pt JOIN playlists p ON p.id = pt.playlist_id WHERE p.user_id = ? AND pt.artist = ?').all(userId, artiste, userId, artiste, userId, artiste)
    : [];
  let out = melanger(uniques(rows.map((x) => ({ videoId: x.video_id, title: x.title, artist: x.artist, duration: 0, seed: artiste, source: 'radio' })))).filter((x) => x.videoId !== seed && !rej.has(x.videoId));
  if (out.length < 6) out = out.concat(secours(d, userId, n).filter((x) => !rej.has(x.videoId)));
  return uniques(out).slice(0, n);
}

const radioEnCours = new Map();
export async function radio(userId, seed, n) {
  const cle = userId + ':' + seed;
  const c = radioCache.get(cle);
  if (c && Date.now() - c.at < RADIO_TTL) return c.items;
  if (radioEnCours.has(cle)) return radioEnCours.get(cle);
  const p = radioCalcul(userId, seed, n).finally(() => radioEnCours.delete(cle));
  radioEnCours.set(cle, p);
  return p;
}

async function radioCalcul(userId, seed, n) {
  const cle = userId + ':' + seed;
  const d = ouvrirBase();
  const rej = rejetes(d, userId);
  let items = [];
  if (/^[A-Za-z0-9_-]{11}$/.test(seed)) {
    const rel = await reliePiped(seed);
    items = rel.filter((x) => !rej.has(x.videoId) && !FILTRE_MIXTE.test(x.title) && (!x.duration || (x.duration >= 60 && x.duration <= 600)))
      .map((x) => ({ videoId: x.videoId, title: x.title, artist: x.artist, duration: x.duration, seed: seed, source: 'radio' }));
  } else {
    const out = await lancerYtdlp(['--flat-playlist', '--print', PRINT, 'ytsearch10:' + String(seed).slice(0, 100)], 8000);
    for (const ligne of out.split(NL).filter(Boolean)) {
      const m = ligne.split(TAB);
      const vid = m[0], t = m[1] || '', ch = m[2] || '', dur = Number(m[3] || 0);
      if (!vid || !/^[A-Za-z0-9_-]{11}$/.test(vid) || rej.has(vid) || FILTRE_MIXTE.test(t)) continue;
      if (dur && (dur < 60 || dur > 600)) continue;
      items.push({ videoId: vid, title: t, artist: ch || String(seed), duration: dur, seed: String(seed), source: 'radio' });
    }
  }
  if (items.length < 6) items = radioSync(d, userId, seed, n);
  items = uniques(items).slice(0, n);
  radioCache.set(cle, { at: Date.now(), items });
  if (radioCache.size > 80) radioCache.delete(radioCache.keys().next().value);
  return items;
}

// Cache-or-sync immediately, warm async (CarPlay must never block).
export function radioImmediate(d, userId, seed, n) {
  const c = radioCache.get(userId + ':' + seed);
  if (c && Date.now() - c.at < RADIO_TTL) return c.items;
  const items = radioSync(d, userId, seed, n);
  // Ne pas écrire le cache ici : radio() doit pouvoir enrichir (warm async) sans court-circuit.
  void radio(userId, seed, n).catch(() => {});
  return items;
}

function mixes2sync(userId) {
  const d = ouvrirBase();
  const seedJour = new Date().toISOString().slice(0, 10);
  const c = mixesCache.get(userId);
  if (c && c.seed === seedJour && Date.now() - c.at < MIXES_TTL) return c.resp;
  const row = d.prepare('SELECT json, at, seed FROM mix_cache WHERE user_id = ?').get(userId);
  if (row && row.seed === seedJour && Date.now() - row.at < MIXES_TTL) {
    try { const p = JSON.parse(row.json); if (p && p.v === MIXES_VERSION) { mixesCache.set(userId, { at: row.at, seed: row.seed, resp: p }); return p; } } catch (e) {}
  }
  compteSqlMixes = 0;
  const q = (sql, ...a) => { compteSqlMixes++; return d.prepare(sql).all(...a); };
  compteSqlMixes++;
  const aff = affinites(d, userId);
  const likes = q('SELECT l.video_id, l.title, l.artist, COALESCE(tm.duration, 0) AS duration FROM likes l LEFT JOIN track_meta tm ON tm.video_id = l.video_id WHERE l.user_id = ? ORDER BY l.added_at DESC, l.video_id ASC LIMIT 200', userId);
  const history90 = q("SELECT h.video_id, h.title, h.artist, COALESCE(h.duration, tm.duration, 0) AS duration, h.at FROM history h LEFT JOIN track_meta tm ON tm.video_id = h.video_id WHERE h.user_id = ? AND h.at >= datetime('now','-90 day') ORDER BY h.at DESC, h.id DESC LIMIT 600", userId);
  const playlists = q('SELECT pt.video_id, pt.title, pt.artist, COALESCE(tm.duration, 0) AS duration FROM playlist_tracks pt JOIN playlists p ON p.id = pt.playlist_id LEFT JOIN track_meta tm ON tm.video_id = pt.video_id WHERE p.user_id = ? ORDER BY (pt.position IS NULL), pt.position, pt.video_id ASC LIMIT 400', userId);
  const boucle = q('SELECT video_id, title, artist, COUNT(*) AS c FROM history WHERE user_id = ? GROUP BY video_id ORDER BY c DESC, video_id ASC LIMIT 60', userId);
  const archives = q("SELECT video_id, title, artist, COUNT(*) AS c FROM history WHERE user_id = ? AND at < datetime('now','-90 day') GROUP BY video_id ORDER BY c DESC, video_id ASC LIMIT 120", userId);
  const rejSet = rejetes(d, userId);
  const recRaw = lireRecos(d, userId);
  const rec = Array.isArray(recRaw) ? recRaw : (recRaw && Array.isArray(recRaw.items) ? recRaw.items : []);
  const corpusDistincts = new Set([].concat(likes, history90, playlists, boucle, archives).map((r) => r.video_id)).size;
  const resp = composerMixes({ userId, seedJour, affinites: aff, likes, history90, playlists, boucle, archives, rejetes: rejSet, recos: rec, corpusDistincts });
  if (resp && resp.cold) {
    try {
      const pool = q('SELECT DISTINCT video_id, title, artist FROM resolve_cache WHERE video_id IS NOT NULL AND length(video_id) = 11 LIMIT 240');
      if (pool.length) {
        resp.mixes = resp.mixes.map((mix, i) => {
          const shuffled = melangerSeede(pool, userId + ':' + seedJour + ':' + mix.key);
          const list = shuffled.slice(i * 18, i * 18 + 18).map((r) => ({ videoId: r.video_id, title: r.title || '', artist: r.artist || '', duration: 0, seed: r.artist || '', source: 'cold' }));
          return Object.assign({}, mix, { tracks: list, count: list.length, cover: list.slice(0, 4).map((t) => t.videoId) });
        });
      }
    } catch (e) { /* noop */ }
  }
  try { d.prepare('INSERT INTO mix_cache (user_id, json, at, seed) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, at = excluded.at, seed = excluded.seed').run(userId, JSON.stringify(resp), Date.now(), seedJour); } catch (e) {}
  mixesCache.set(userId, { at: Date.now(), seed: seedJour, resp });
  if (mixesCache.size > 50) mixesCache.delete(mixesCache.keys().next().value);
  return resp;
}

async function warmMixes(userId) {
  if (process.env.SONORA_MIX_WARM === '0') return;
  if (Date.now() - (lastWarm.get(userId) || 0) < 6 * 3600 * 1000) return;
  if (warmActif) { warmFile.push(userId); if (warmFile.length > 2) warmFile.shift(); return; }
  warmActif = true; warmLances++;
  try {
    const epoch = mixEpoch.get(userId) || 0;
    const resp = mixes2sync(userId);
    const dailies = resp.mixes.filter((m) => m.key.indexOf('daily') === 0 && m.count < 50).slice(0, 4);
    const d = ouvrirBase();
    const rejSet = rejetes(d, userId);
    for (const m of dailies) {
      const ancre = m.seeds && m.seeds[0] ? m.seeds[0].v : '';
      if (!ancre) continue;
      try {
        const out = await lancerYtdlp(['--flat-playlist', '--print', PRINT, 'ytsearch40:' + ancre], 30000);
        const vus = new Set(m.tracks.map((t) => t.videoId));
        const ajouts = [];
        for (const ligne of String(out || '').split('\n')) {
          const parts = ligne.split('\t');
          if (parts.length < 3) continue;
          const vid = parts[0], titre = parts[1], artiste = parts[2], duree = Number(parts[3]) || 0;
          if (!/^[A-Za-z0-9_-]{11}$/.test(vid) || vus.has(vid) || rejSet.has(vid)) continue;
          if (FILTRE_MIXTE.test(titre) || duree < 60 || duree > 600) continue;
          vus.add(vid); ajouts.push({ videoId: vid, title: titre, artist: artiste, duration: duree, seed: ancre, source: 'warm' });
          if (m.tracks.length + ajouts.length >= 50) break;
        }
        if (ajouts.length) {
          m.tracks = melangerSeede(m.tracks.concat(ajouts).slice(0, 60), userId + ':' + resp.seed + ':' + m.key);
          m.count = m.tracks.length;
          m.cover = m.tracks.slice(0, 4).map((t) => t.videoId);
        }
      } catch (e) {}
    }
    ecrireWarm(userId, epoch, resp.seed, resp);
  } finally {
    lastWarm.set(userId, Date.now());
    warmActif = false;
    const nxt = warmFile.shift();
    if (nxt !== undefined) void warmMixes(nxt);
  }
}

async function mixes(userId) {
  const resp = mixes2sync(userId);
  const noms = { deco: ['Découvertes', 'Nouveaux titres selon tes goûts'], boucle: ['En boucle', 'Ce que tu réécoutes le plus'], favoris: ['Tes favoris', 'Tes titres likés, en aléatoire'] };
  const cles = ['deco', 'boucle', 'favoris'];
  return cles.map((k) => {
    const m = resp.mixes.find((x) => x.key === k);
    const tracks = (m ? m.tracks : []).slice(0, 20);
    return { key: k, name: noms[k][0], subtitle: noms[k][1], tracks, count: tracks.length, cover: tracks.slice(0, 4).map((t) => t.videoId) };
  });
}

async function mixesLegacy(userId) {
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
        if (process.env.SONORA_SIGNUP === 'closed') return json(403, { error: 'inscriptions fermees' });
        const signupCode = process.env.SONORA_SIGNUP_CODE || '';
        if (signupCode && String(b.code || '') !== signupCode) return json(403, { error: 'code invitation requis' });
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
          const tr = d.prepare('SELECT video_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY (position IS NULL), position').all(p.id);
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
          purgeMoods(u.id);
          purgeMixes(u.id);
        purgeMixes(u.id);
          return json(200, { ok: true });
        }
        if (req.method === 'GET') {
          const tr = d.prepare('SELECT pt.video_id, pt.title, pt.artist, COALESCE(tm.duration, 0) AS duration FROM playlist_tracks pt LEFT JOIN track_meta tm ON tm.video_id = pt.video_id WHERE pt.playlist_id = ? ORDER BY (pt.position IS NULL), pt.position').all(pid);
          const ids = tr.map((t) => t.video_id);
          const connues = dureesConnues(d, ids);
          const manquants = ids.filter((id) => !connues.has(id)).slice(0, 60);
          if (manquants.length) dureesManquantes(d, manquants).catch(() => {});
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
        if (/^ep/.test(vid)) return json(400, { error: 'episode' });
        let titre = texte(b.title, 300), artiste = texte(b.artist, 300);
        if (!/^[A-Za-z0-9_-]{11}$/.test(vid)) {
          const r = await resoudre(b.title, b.artist);
          if (!r) return json(502, { error: 'introuvable' });
          vid = r.video_id; titre = texte(r.title, 300); artiste = texte(r.artist, 300);
        }
        d.prepare('INSERT OR IGNORE INTO playlist_tracks (playlist_id, video_id, title, artist, position) VALUES (?, ?, ?, ?, COALESCE((SELECT MAX(position)+1 FROM playlist_tracks WHERE playlist_id = ?), 0))').run(pid, vid, titre, artiste, pid);
        purgeMoods(u.id);
        purgeMixes(u.id);
        return json(200, { ok: true, videoId: vid, title: titre, artist: artiste });
      }

      m = /^\/playlists\/(\d+)\/tracks\/bulk$/.exec(route);
      if (m && req.method === 'POST') {
        const pid = Number(m[1]);
        if (!d.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').get(pid, u.id)) return json(404, { error: 'playlist' });
        const b = await corps(req);
        const tracks = Array.isArray(b.tracks) ? b.tracks : [];
        if (!tracks.length || tracks.length > 100) return json(400, { error: 'bulk 1..100' });
        const inser = d.prepare('INSERT OR IGNORE INTO playlist_tracks (playlist_id, video_id, title, artist, position) VALUES (?, ?, ?, ?, COALESCE((SELECT MAX(position)+1 FROM playlist_tracks WHERE playlist_id = ?), 0))');
        const meta = d.prepare('INSERT INTO track_meta (video_id, duration) VALUES (?, ?) ON CONFLICT(video_id) DO UPDATE SET duration = CASE WHEN track_meta.duration = 0 THEN excluded.duration ELSE track_meta.duration END');
        let added = 0;
        d.exec('BEGIN');
        try {
          for (const t of tracks) {
            const vid = String(t.videoId || t.id || '');
            if (/^ep/.test(vid)) continue;
            if (!/^[A-Za-z0-9_-]{11}$/.test(vid)) continue;
            const r = inser.run(pid, vid, texte(t.title, 300), texte(t.artist, 300), pid);
            if (r.changes) added++;
            const dur = Number(t.duration) || 0;
            if (dur > 0 && dur <= 36000) meta.run(vid, Math.round(dur));
          }
          d.exec('COMMIT');
        } catch (e) { try { d.exec('ROLLBACK'); } catch (e2) {} return json(500, { error: 'bulk' }); }
        purgeMoods(u.id);
        purgeMixes(u.id);
        return json(200, { ok: true, added });
      }
      m = /^\/playlists\/(\d+)\/reorder$/.exec(route);
      if (m && req.method === 'POST') {
        const pid = Number(m[1]);
        if (!d.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').get(pid, u.id)) return json(404, { error: 'playlist' });
        const b = await corps(req);
        const ids = Array.isArray(b.videoIds) ? b.videoIds.map(String) : [];
        const exist = d.prepare('SELECT video_id FROM playlist_tracks WHERE playlist_id = ?').all(pid).map((x) => x.video_id);
        if (ids.length !== exist.length || new Set(ids).size !== ids.length || !ids.every((x) => exist.includes(x))) return json(400, { error: 'ensemble' });
        const up = d.prepare('UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND video_id = ?');
        d.exec('BEGIN');
        try { ids.forEach((x, i) => up.run(i, pid, x)); d.exec('COMMIT'); } catch (e) { try { d.exec('ROLLBACK'); } catch (e2) {} return json(500, { error: 'reorder' }); }
        return json(200, { ok: true });
      }
      m = /^\/playlists\/(\d+)\/tracks\/([A-Za-z0-9_-]{11})$/.exec(route);
      if (m && req.method === 'DELETE') {
        const pid = Number(m[1]);
        if (!d.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').get(pid, u.id)) return json(404, { error: 'playlist' });
        d.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND video_id = ?').run(pid, m[2]);
        purgeMoods(u.id);
        purgeMixes(u.id);
        return json(200, { ok: true });
      }

      if (route === '/moods' && req.method === 'GET') {
        const lb = url.searchParams.get('lang');
        const lang = lb === 'fr' || lb === 'en' || lb === 'es' ? lb : 'en';
        const r = moodsPour(d, u.id, lang);
        return json(200, { v: MOODS_VERSION, lang, cold: r.cold, moods: r.moods, artists: r.artists });
      }
      if (route === '/likes' && req.method === 'GET') {
        const ls = d.prepare('SELECT l.video_id, l.title, l.artist, COALESCE(tm.duration, 0) AS duration FROM likes l LEFT JOIN track_meta tm ON tm.video_id = l.video_id WHERE l.user_id = ? ORDER BY l.added_at DESC').all(u.id);
        const idsL = ls.map((l) => l.video_id);
        const connuesL = dureesConnues(d, idsL);
        const manquantsL = idsL.filter((id) => !connuesL.has(id)).slice(0, 60);
        if (manquantsL.length) dureesManquantes(d, manquantsL).catch(() => {});
        return json(200, ls.map((l) => ({ videoId: l.video_id, title: l.title, artist: l.artist, duration: Number(l.duration) || connuesL.get(l.video_id) || 0 })));
      }
      if (route === '/likes' && req.method === 'POST') {
        const b = await corps(req);
        let vid = String(b.videoId || '');
        if (/^ep/.test(vid)) return json(400, { error: 'episode' });
        b.title = texte(b.title, 300); b.artist = texte(b.artist, 300);
        if (!/^[A-Za-z0-9_-]{11}$/.test(vid)) {
          const r = await resoudre(b.title, b.artist);
          if (!r) return json(502, { error: 'introuvable' });
          vid = r.video_id; b.title = texte(r.title, 300); b.artist = texte(r.artist, 300);
        }
        d.prepare('INSERT OR IGNORE INTO likes (user_id, video_id, title, artist) VALUES (?, ?, ?, ?)').run(u.id, vid, b.title || '', b.artist || '');
        try {
          const pid = listeAimes(d, u.id);
          d.prepare('INSERT OR IGNORE INTO playlist_tracks (playlist_id, video_id, title, artist, position) VALUES (?, ?, ?, ?, COALESCE((SELECT MAX(position)+1 FROM playlist_tracks WHERE playlist_id = ?), 0))').run(pid, vid, b.title || '', b.artist || '', pid);
        } catch (e) {}
        purgeMoods(u.id);
        purgeMixes(u.id);
        return json(200, { ok: true, videoId: vid });
      }
      m = /^\/likes\/([A-Za-z0-9_-]{11})$/.exec(route);
      if (m && req.method === 'DELETE') {
        d.prepare('DELETE FROM likes WHERE user_id = ? AND video_id = ?').run(u.id, m[1]);
        try {
          const pid = listeAimes(d, u.id);
          d.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND video_id = ?').run(pid, m[1]);
        } catch (e) {}
        purgeMoods(u.id);
        purgeMixes(u.id);
        return json(200, { ok: true });
      }

      if (route === '/feedback' && req.method === 'POST') {
        const b = await corps(req);
        const vid = String(b.videoId || '');
        const action = String(b.action || 'dismiss');
        if (!/^[A-Za-z0-9_-]{11}$/.test(vid) || /^ep/.test(vid) || (action !== 'dismiss' && action !== 'like')) return json(400, { error: 'parametres' });
        d.prepare('INSERT INTO reco_feedback (user_id, video_id, action) VALUES (?, ?, ?) ON CONFLICT(user_id, video_id) DO UPDATE SET action = excluded.action, at = datetime(\'now\')').run(u.id, vid, action);
        if (action === 'like') {
          const meta = metaConnue(d, vid);
          d.prepare('INSERT OR IGNORE INTO likes (user_id, video_id, title, artist) VALUES (?, ?, ?, ?)').run(u.id, vid, (meta && meta.title) || '', (meta && meta.artist) || '');
          if (!meta) majMetaAsync(vid);
          try {
            const pid = listeAimes(d, u.id);
            d.prepare('INSERT OR IGNORE INTO playlist_tracks (playlist_id, video_id, title, artist, position) VALUES (?, ?, ?, ?, COALESCE((SELECT MAX(position)+1 FROM playlist_tracks WHERE playlist_id = ?), 0))').run(pid, vid, (meta && meta.title) || '', (meta && meta.artist) || '', pid);
          } catch (e) {}
        }
        d.prepare('DELETE FROM reco_cache WHERE user_id = ?').run(u.id);
        mixCache.delete(u.id + ':' + 30);
        for (const k of Array.from(mixCache.keys())) { if (k.indexOf(u.id + ':') === 0) mixCache.delete(k); }
        mixesCache.delete(u.id);
        purgeMoods(u.id);
        purgeMixes(u.id);
        lancerRecos(u.id);
        return json(200, { ok: true, action });
      }
      if (route === '/feedback' && req.method === 'GET') {
        return json(200, d.prepare('SELECT video_id, action, at FROM reco_feedback WHERE user_id = ? ORDER BY at DESC').all(u.id));
      }

      if (route === '/history' && req.method === 'GET') {
        const n = entier(url.searchParams.get('n'), 50, 1, 200);
        const h = d.prepare('SELECT video_id, title, artist, at, duration FROM (SELECT h.video_id, h.title, h.artist, h.at, COALESCE(tm.duration, 0) AS duration, ROW_NUMBER() OVER (PARTITION BY h.video_id ORDER BY h.at DESC, h.id DESC) AS rn FROM history h LEFT JOIN track_meta tm ON tm.video_id = h.video_id WHERE h.user_id = ?) WHERE rn = 1 ORDER BY at DESC LIMIT ?').all(u.id, n);
        return json(200, h.map((x) => ({ videoId: x.video_id, title: x.title, artist: x.artist, at: x.at, duration: Number(x.duration) || 0 })));
      }
      if (route === '/history' && req.method === 'POST') {
        const b = await corps(req);
        const vid = String(b.videoId || '');
        if (!/^[A-Za-z0-9_-]{11}$/.test(vid) || /^ep/.test(vid)) return json(400, { error: 'videoId' });
        pousseHistory(d, u.id, vid, b.title, b.artist, b.duration);
        return json(200, { ok: true });
      }

      if (route === '/ytplaylist' && req.method === 'GET') {
        const list = String(url.searchParams.get('list') || '').trim();
        if (!/^[A-Za-z0-9_-]{10,80}$/.test(list)) return json(400, { error: 'list' });
        try { return json(200, await ytPlaylist(list)); } catch (e) { return json(502, { error: 'playlist introuvable' }); }
      }
      if (route === '/stats' && req.method === 'GET') {
        const mois = entier(url.searchParams.get('months'), 6, 1, 24);
        return json(200, statsPour(d, u.id, mois));
      }
      m = /^\/smart\/(top|recent|never)$/.exec(route);
      if (m && req.method === 'GET') {
        const tracks = smartPour(d, u.id, m[1]);
        if (!tracks) return json(404, { error: 'smart' });
        return json(200, { key: m[1], tracks });
      }
      if (route === '/radio') {
        const seed = String(url.searchParams.get('seed') || '').trim();
        if (!seed || seed.length > 100) return json(400, { error: 'seed' });
        const n = entier(url.searchParams.get('n'), 30, 1, 60);
        return json(200, await radio(u.id, seed, n));
      }
      if (route === '/recos') {
        const n = entier(url.searchParams.get('n'), 20, 1, 50);
        return json(200, await recos(u.id, n));
      }
      if (route === '/mix') {
        const n = entier(url.searchParams.get('n'), 30, 1, 60);
        return json(200, await mix(u.id, n));
      }
      if (route === '/mixes2' && req.method === 'GET') {
        const resp = mixes2sync(u.id);
        void warmMixes(u.id);
        return json(200, resp);
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

// Export reserved for unit tests (pure functions).
export function utilisateurDuToken(req) { return userDuToken(req) }

export const internals = { melanger, uniques, FILTRE_MIXTE, RECOS_VERSION, moodsCache, purgeMixes, ecrireWarm, composerMixes, get ytActifs() { return ytActifs; }, get warmLances() { return warmLances; }, get compteSqlMixes() { return compteSqlMixes; }, get mixEpoch() { return mixEpoch; } };
