// Podcasts : découverte gpodder, import RSS, abonnements/progression per-compte, src signée.
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ouvrirBase, utilisateurDuToken } from './musique.mjs';
import { parseRss } from './rss.mjs';
import { safeFetchBuffer, guardUrl } from './netguard.mjs';

const DATA = process.env.SONORA_DATA || join(process.cwd(), 'data');
const TTL_SRC = 6 * 3600 * 1000;
let secret = null;
function podSecret() {
  if (secret) return secret;
  if (process.env.SONORA_POD_SECRET) { secret = process.env.SONORA_POD_SECRET; return secret; }
  const f = join(DATA, 'pod-secret');
  try { if (existsSync(f)) { secret = readFileSync(f, 'utf8').trim(); return secret; } } catch (e) {}
  secret = randomBytes(32).toString('hex');
  try { mkdirSync(DATA, { recursive: true }); writeFileSync(f, secret); } catch (e) {}
  return secret;
}
export function signerSrc(id) {
  const exp = Date.now() + TTL_SRC;
  const sig = createHmac('sha256', podSecret()).update(id + ':' + exp).digest('hex');
  return '/podcast/ep/' + id + '?exp=' + exp + '&sig=' + sig;
}
export function verifierSrc(id, exp, sig) {
  const e = Number(exp);
  if (!Number.isFinite(e) || e < Date.now()) return false;
  const attendu = createHmac('sha256', podSecret()).update(id + ':' + e).digest('hex');
  return String(sig || '') === attendu;
}
export function estEpisode(id) { return /^ep/.test(String(id || '')); }

export function initPodcasts(d) {
  d.exec("CREATE TABLE IF NOT EXISTS podcast_shows (id INTEGER PRIMARY KEY, feed_url TEXT UNIQUE, itunes_id TEXT, title TEXT, author TEXT, description TEXT, image TEXT, fetched_at INTEGER)");
  d.exec("CREATE TABLE IF NOT EXISTS podcast_episodes (id INTEGER PRIMARY KEY, show_id INTEGER, guid TEXT, title TEXT, description TEXT, pub_date TEXT, duration INTEGER, enclosure_url TEXT, enclosure_type TEXT, unavailable INTEGER DEFAULT 0, added_at INTEGER, UNIQUE(show_id, guid))");
  d.exec("CREATE INDEX IF NOT EXISTS idx_pod_ep_show ON podcast_episodes (show_id, pub_date DESC)");
  d.exec("CREATE TABLE IF NOT EXISTS podcast_subs (user_id INTEGER, show_id INTEGER, added_at INTEGER, PRIMARY KEY (user_id, show_id))");
  d.exec("CREATE TABLE IF NOT EXISTS podcast_progress (user_id INTEGER, episode_id INTEGER, position REAL, duration REAL, completed INTEGER, updated_at INTEGER, PRIMARY KEY (user_id, episode_id))");
}
function decodeFeed(buf) {
  const head = buf.slice(0, 200).toString('latin1');
  const m = head.match(/encoding="([^"]+)"/i);
  const enc = (m ? m[1] : 'utf-8').toLowerCase();
  try { return new TextDecoder(enc === 'iso-8859-1' ? 'windows-1252' : enc).decode(buf); }
  catch (e) { return new TextDecoder('windows-1252').decode(buf); }
}
const gpCache = new Map();
async function gpodder(q) {
  const key = q.toLowerCase();
  const c = gpCache.get(key);
  if (c && Date.now() - c.at < 5 * 60 * 1000) return c.rows;
  const r = await safeFetchBuffer('https://gpodder.net/search.json?q=' + encodeURIComponent(q), { maxBytes: 2 * 1024 * 1024, timeoutMs: 10000 });
  if (r.status !== 200) throw Object.assign(new Error('gpodder'), { code: 'fetch' });
  const rows = (JSON.parse(r.buffer.toString('utf8')) || []).slice(0, 24).map((x) => ({ feedUrl: x.url, title: x.title, author: x.author, description: x.description, logo: x.scaled_logo_url || x.logo_url }));
  gpCache.set(key, { at: Date.now(), rows });
  if (gpCache.size > 50) gpCache.delete(gpCache.keys().next().value);
  return rows;
}
const CURATED = {
  fr: [
    { feedUrl: 'https://radiofrance-podcast.net/podcast09/rss_10027.xml', title: 'France Inter — Grand bien vous fasse', author: 'Radio France' },
    { feedUrl: 'https://feeds.simplecast.com/54nAGcIl', title: 'The Daily (FR discover)', author: 'The New York Times' },
  ],
  en: [
    { feedUrl: 'https://feeds.simplecast.com/54nAGcIl', title: 'The Daily', author: 'The New York Times' },
    { feedUrl: 'https://feeds.megaphone.fm/vergecast', title: 'The Vergecast', author: 'The Verge' },
  ],
  es: [
    { feedUrl: 'https://feeds.simplecast.com/54nAGcIl', title: 'The Daily (ES discover)', author: 'The New York Times' },
  ],
};
function epRow(d, r, showTitle, userId) {
  const p = d.prepare('SELECT position, duration, completed FROM podcast_progress WHERE user_id = ? AND episode_id = ?').get(userId, r.id);
  return { id: r.id, showId: r.show_id, showTitle, guid: r.guid, title: r.title, description: r.description, pubDate: r.pub_date, duration: r.duration, enclosureType: r.enclosure_type, unavailable: !!r.unavailable, src: signerSrc(r.id), progress: p || null };
}
function showRow(d, r) { return { id: r.id, feedUrl: r.feed_url, itunesId: r.itunes_id, title: r.title, author: r.author, description: r.description, image: r.image, fetchedAt: r.fetched_at }; }
async function refreshShow(d, show) {
  const r = await safeFetchBuffer(show.feed_url, { maxBytes: 20 * 1024 * 1024, timeoutMs: 20000 });
  if (r.status !== 200) throw Object.assign(new Error('feed'), { code: 'fetch' });
  const parsed = parseRss(decodeFeed(r.buffer));
  return syncEpisodes(d, show, parsed);
}
export function syncEpisodes(d, show, parsed) {
  const items = parsed.items.slice().sort((a, b) => (b.pubDate || '').localeCompare(a.pubDate || '')).slice(0, 300);
  const keep = new Set(items.map((i) => i.guid));
  const old = d.prepare('SELECT id, guid FROM podcast_episodes WHERE show_id = ?').all(show.id);
  for (const o of old) {
    if (keep.has(o.guid)) continue;
    const prog = d.prepare('SELECT 1 FROM podcast_progress WHERE episode_id = ? AND completed = 0').get(o.id);
    if (prog) continue;
    d.prepare('DELETE FROM podcast_progress WHERE episode_id = ?').run(o.id);
    d.prepare('DELETE FROM podcast_episodes WHERE id = ?').run(o.id);
  }
  const now = Date.now();
  for (const it of items) {
    const unav = /^http:/.test(it.enclosureUrl) ? 1 : 0;
    d.prepare('INSERT INTO podcast_episodes (show_id, guid, title, description, pub_date, duration, enclosure_url, enclosure_type, unavailable, added_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(show_id, guid) DO UPDATE SET title=excluded.title, description=excluded.description, pub_date=excluded.pub_date, duration=excluded.duration, enclosure_url=excluded.enclosure_url, enclosure_type=excluded.enclosure_type, unavailable=excluded.unavailable')
      .run(show.id, it.guid, it.title, it.description, it.pubDate, it.duration, it.enclosureUrl, it.enclosureType, unav, now);
  }
  d.prepare('UPDATE podcast_shows SET title=?, author=?, description=?, image=?, fetched_at=? WHERE id=?')
    .run(parsed.title || show.title, parsed.author || show.author, parsed.description || show.description, parsed.image || show.image, now, show.id);
  return d.prepare('SELECT * FROM podcast_shows WHERE id = ?').get(show.id);
}
export async function handlePodcasts(req, res, path, url) {
  if (!path.startsWith('/api/pod/')) return false;
  const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(obj)); };
  const user = utilisateurDuToken(req);
  if (!user) { json(401, { error: 'token' }); return true; }
  const d = ouvrirBase(); initPodcasts(d);
  const route = path.slice('/api/pod/'.length);
  const corps = async () => { let s = ''; for await (const c of req) s += c; try { return JSON.parse(s || '{}'); } catch (e) { return {}; } };
  try {
    if (route === 'search' && req.method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) { json(200, { results: [] }); return true; }
      try { json(200, { results: await gpodder(q) }); } catch (e) { json(502, { error: 'fetch', code: e.code }); }
      return true;
    }
    if (route === 'curated' && req.method === 'GET') { json(200, { results: CURATED[url.searchParams.get('lang')] || CURATED.en }); return true; }
    if (route === 'shows' && req.method === 'POST') {
      const b = await corps();
      const feedUrl = String(b.feedUrl || '').trim();
      try { await guardUrl(feedUrl); } catch (e) { json(400, { error: 'invalid_url', code: e.code }); return true; }
      let show = d.prepare('SELECT * FROM podcast_shows WHERE feed_url = ?').get(feedUrl);
      if (!show) {
        d.prepare('INSERT INTO podcast_shows (feed_url, itunes_id, title, author, description, image, fetched_at) VALUES (?,?,?,?,?,?,?)').run(feedUrl, b.itunesId || null, '', '', '', '', 0);
        show = d.prepare('SELECT * FROM podcast_shows WHERE feed_url = ?').get(feedUrl);
      }
      try { show = await refreshShow(d, show); } catch (e) {
        if (e.code === 'unsupported_feed') { json(415, { error: 'unsupported_feed' }); return true; }
        if (!show.fetched_at) { json(502, { error: 'fetch', code: e.code }); return true; }
      }
      d.prepare('INSERT OR IGNORE INTO podcast_subs (user_id, show_id, added_at) VALUES (?,?,?)').run(user.id, show.id, Date.now());
      const eps = d.prepare('SELECT * FROM podcast_episodes WHERE show_id = ? ORDER BY pub_date DESC, added_at DESC').all(show.id);
      json(200, { show: showRow(d, show), episodes: eps.map((r) => epRow(d, r, show.title, user.id)) });
      return true;
    }
    const showM = route.match(/^shows\/(\d+)$/);
    if (showM && req.method === 'GET') {
      const show = d.prepare('SELECT * FROM podcast_shows WHERE id = ?').get(Number(showM[1]));
      if (!show) { json(404, { error: 'not_found' }); return true; }
      let stale = false;
      if (url.searchParams.get('refresh') === '1' && Date.now() - show.fetched_at > 15 * 60 * 1000) {
        try { show = await refreshShow(d, show); } catch (e) { stale = true; }
      }
      const eps = d.prepare('SELECT * FROM podcast_episodes WHERE show_id = ? ORDER BY pub_date DESC, added_at DESC').all(show.id);
      json(200, { show: showRow(d, show), stale, episodes: eps.map((r) => epRow(d, r, show.title, user.id)) });
      return true;
    }
    if (route === 'subs' && req.method === 'GET') {
      const rows = d.prepare('SELECT s.* FROM podcast_subs u JOIN podcast_shows s ON s.id = u.show_id WHERE u.user_id = ? ORDER BY u.added_at DESC').all(user.id);
      json(200, { shows: rows.map((r) => showRow(d, r)) }); return true;
    }
    if (route === 'subs' && req.method === 'POST') {
      const b = await corps();
      d.prepare('INSERT OR IGNORE INTO podcast_subs (user_id, show_id, added_at) VALUES (?,?,?)').run(user.id, Number(b.showId), Date.now());
      json(200, { ok: true }); return true;
    }
    const subM = route.match(/^subs\/(\d+)$/);
    if (subM && req.method === 'DELETE') { d.prepare('DELETE FROM podcast_subs WHERE user_id = ? AND show_id = ?').run(user.id, Number(subM[1])); json(200, { ok: true }); return true; }
    if (route === 'new' && req.method === 'GET') {
      const rows = d.prepare("SELECT e.*, s.title AS show_title FROM podcast_episodes e JOIN podcast_subs u ON u.show_id = e.show_id JOIN podcast_shows s ON s.id = e.show_id LEFT JOIN podcast_progress p ON p.episode_id = e.id AND p.user_id = ? WHERE u.user_id = ? AND (p.completed IS NULL OR p.completed = 0) ORDER BY e.pub_date DESC, e.added_at DESC LIMIT 50").all(user.id, user.id);
      json(200, { episodes: rows.map((r) => epRow(d, r, r.show_title, user.id)) }); return true;
    }
    const progM = route.match(/^progress\/(\d+)$/);
    if (progM && req.method === 'GET') {
      const p = d.prepare('SELECT * FROM podcast_progress WHERE user_id = ? AND episode_id = ?').get(user.id, Number(progM[1]));
      json(200, { progress: p || null }); return true;
    }
    if (route === 'progress' && req.method === 'POST') {
      const b = await corps();
      d.prepare('INSERT INTO podcast_progress (user_id, episode_id, position, duration, completed, updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id, episode_id) DO UPDATE SET position=excluded.position, duration=excluded.duration, completed=excluded.completed, updated_at=excluded.updated_at')
        .run(user.id, Number(b.episodeId), Number(b.position) || 0, Number(b.duration) || 0, b.completed ? 1 : 0, Date.now());
      json(200, { ok: true }); return true;
    }
    json(404, { error: 'not_found' }); return true;
  } catch (e) { json(500, { error: String(e.message || e) }); return true; }
}
