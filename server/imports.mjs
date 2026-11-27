// Import de playlists externes : YouTube, Spotify (embed), Apple Music (page), Deezer, CSV.
import { spawn } from 'node:child_process';

const YTDLP = process.env.YTDLP_PATH || '/usr/bin/yt-dlp';
const COOKIES = process.env.SONORA_COOKIES || '/home/heidman/dashboard/data/yt-cookies.txt';
const NODE = process.env.SONORA_NODE_BIN || '/usr/local/bin/heid-node';
const EJS = process.env.SONORA_EJS || 'ejs:github';

const HOSTS = ['open.spotify.com', 'music.apple.com', 'api.deezer.com', 'www.deezer.com', 'deezer.com', 'www.youtube.com', 'youtube.com', 'youtu.be', 'music.youtube.com'];

function hoteOk(u) { return u.protocol === 'https:' && HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h)); }

async function texte(url, maxBytes = 4 * 1024 * 1024) {
  const u = new URL(url);
  if (!hoteOk(u)) throw Object.assign(new Error('host'), { code: 'host' });
  const ctrl = new AbortController();
  const t = setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, 15000);
  try {
    const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 'accept-language': 'en-US,en;q=0.9' }, signal: ctrl.signal, redirect: 'follow' });
    if (!r.ok) throw Object.assign(new Error('http'), { code: 'http' });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > maxBytes) throw Object.assign(new Error('too_large'), { code: 'too_large' });
    return buf.toString('utf8');
  } finally { clearTimeout(t); }
}

function* objects(o) { if (!o || typeof o !== 'object') return; yield o; for (const k of Object.keys(o)) yield* objects(o[k]); }

function premiereListe(root, test) {
  let best = [];
  for (const o of objects(root)) {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (Array.isArray(v) && v.length > best.length && v.every((x) => x && typeof x === 'object') && test(v[0])) best = v;
    }
  }
  return best;
}

export function sourceDeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (/open\.spotify\.com$/.test(u.hostname)) {
      const m = /\/playlist\/([A-Za-z0-9]+)/.exec(u.pathname);
      return m ? { kind: 'spotify', id: m[1] } : null;
    }
    if (/music\.apple\.com$/.test(u.hostname)) return { kind: 'apple', url: u.href };
    if (/deezer\.com$/.test(u.hostname) || /api\.deezer\.com$/.test(u.hostname)) {
      const m = /\/playlist\/(\d+)/.exec(u.pathname);
      return m ? { kind: 'deezer', id: m[1] } : null;
    }
    if (/youtu\.be$/.test(u.hostname) || /youtube\.com$/.test(u.hostname)) {
      const list = u.searchParams.get('list');
      if (list && /^[A-Za-z0-9_-]{10,80}$/.test(list)) return { kind: 'youtube', id: list };
    }
  } catch (e) { /* CSV ou texte */ }
  if (/^[A-Za-z0-9_-]{10,80}$/.test(s)) return { kind: 'youtube', id: s };
  return null;
}

function nombre(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : 0; }

export async function apercuSpotify(id) {
  const html = await texte('https://open.spotify.com/embed/playlist/' + encodeURIComponent(id));
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)</);
  if (!m) throw Object.assign(new Error('format'), { code: 'format' });
  const j = JSON.parse(m[1]);
  const list = premiereListe(j, (x) => typeof x.title === 'string' && (typeof x.subtitle === 'string' || typeof x.artistName === 'string'));
  if (!list.length) throw Object.assign(new Error('empty'), { code: 'empty' });
  let name = 'Spotify';
  for (const o of objects(j)) { if (typeof o.name === 'string' && o.name.length > 1 && o.name.length < 120 && o.type === 'playlist') { name = o.name; break; } }
  const tracks = list.filter((x) => x.title && (x.entityType === undefined || x.entityType === 'track') && !x.isEpisode).slice(0, 200).map((x) => ({ title: String(x.title).slice(0, 300), artist: String(x.subtitle || x.artistName || '').slice(0, 300), duration: nombre(x.duration ? x.duration / 1000 : 0) }));
  return { source: 'spotify', name, tracks, truncated: list.length > 200 };
}

export async function apercuApple(url) {
  const html = await texte(url);
  const m = html.match(/<script[^>]*id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw Object.assign(new Error('format'), { code: 'format' });
  const j = JSON.parse(m[1]);
  const songs = premiereListe(j, (x) => typeof x.title === 'string' && (x.subtitleLinks || x.artistName || x.subtitle));
  if (!songs.length) throw Object.assign(new Error('empty'), { code: 'empty' });
  const tracks = songs.slice(0, 200).map((x) => {
    const artistes = Array.isArray(x.subtitleLinks) ? x.subtitleLinks.map((l) => l.title || l.name).filter(Boolean).join(', ') : String(x.artistName || x.subtitle || '');
    return { title: String(x.title).slice(0, 300), artist: artistes.slice(0, 300), duration: nombre(x.duration ? x.duration / 1000 : 0) };
  });
  return { source: 'apple', name: 'Apple Music', tracks, truncated: songs.length > 200 };
}

export async function apercuDeezer(id) {
  const j = JSON.parse(await texte('https://api.deezer.com/playlist/' + encodeURIComponent(id)));
  const data = (j.tracks && j.tracks.data) || [];
  if (!data.length) throw Object.assign(new Error('empty'), { code: 'empty' });
  return { source: 'deezer', name: String(j.title || 'Deezer').slice(0, 120), tracks: data.slice(0, 200).map((t) => ({ title: String(t.title || '').slice(0, 300), artist: String((t.artist && t.artist.name) || '').slice(0, 300), duration: nombre(t.duration) })), truncated: data.length > 200 };
}

function ytDlp(args, ms) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP, ['--cookies', COOKIES, '--js-runtimes', 'node:' + NODE, '--remote-components', EJS, '--no-warnings'].concat(args), { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    const minuteur = setTimeout(() => { try { proc.kill('SIGKILL'); } catch (e) {} }, ms);
    proc.stdout.on('data', (c) => { out += c; });
    proc.on('close', (code) => { clearTimeout(minuteur); code === 0 ? resolve(out) : reject(Object.assign(new Error('ytdlp'), { code: 'ytdlp' })); });
    proc.on('error', (e) => { clearTimeout(minuteur); reject(e); });
  });
}

export async function apercuYouTube(id) {
  const print = '%(id)s\t%(title)s\t%(channel)s\t%(duration)s';
  const out = await ytDlp(['--flat-playlist', '--print', print, 'https://www.youtube.com/playlist?list=' + id], 45000);
  const lignes = String(out || '').split('\n').map((l) => l.split('\t')).filter((p) => p.length >= 3 && /^[A-Za-z0-9_-]{11}$/.test(p[0]));
  if (!lignes.length) throw Object.assign(new Error('empty'), { code: 'empty' });
  return { source: 'youtube', name: 'YouTube Music', tracks: lignes.slice(0, 200).map((p) => ({ videoId: p[0], title: String(p[1] || '').slice(0, 300), artist: String(p[2] || '').slice(0, 300), duration: nombre(p[3]) })), truncated: lignes.length > 200 };
}

export function parseCsv(txt) {
  const lignes = String(txt || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lignes.length) return { source: 'csv', name: 'CSV', tracks: [], truncated: false };
  const cellules = (ligne) => { const out = []; let cur = ''; let q = false; for (let i = 0; i < ligne.length; i++) { const c = ligne[i]; if (q) { if (c === '"' && ligne[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ',' || c === ';') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out.map((x) => x.trim()); };
  const head = cellules(lignes[0]).map((x) => x.toLowerCase());
  const idx = (noms) => head.findIndex((h) => noms.some((n) => h === n || h.includes(n)));
  const iT = idx(['track name', 'title', 'titre', 'song']);
  const iA = idx(['artist name', 'artist', 'artiste']);
  const iP = idx(['playlist name', 'playlist']);
  if (iT < 0) return { source: 'csv', name: 'CSV', tracks: [], truncated: false };
  const vus = new Set();
  const tracks = [];
  for (const l of lignes.slice(1)) {
    const r = cellules(l);
    const titre = String(r[iT] || '').slice(0, 300);
    if (!titre) continue;
    const artiste = String(iA >= 0 ? r[iA] || '' : '').slice(0, 300);
    const cle = (titre + '|' + artiste).toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    tracks.push({ title: titre, artist: artiste, playlist: iP >= 0 ? String(r[iP] || '').slice(0, 120) : '' });
    if (tracks.length >= 500) break;
  }
  return { source: 'csv', name: 'CSV', tracks, truncated: false };
}

export async function apercuImport(rawUrl, rawCsv) {
  if (rawCsv && String(rawCsv).trim()) return parseCsv(rawCsv);
  const src = sourceDeUrl(rawUrl);
  if (!src) throw Object.assign(new Error('url'), { code: 'url' });
  if (src.kind === 'spotify') return apercuSpotify(src.id);
  if (src.kind === 'apple') return apercuApple(src.url);
  if (src.kind === 'deezer') return apercuDeezer(src.id);
  return apercuYouTube(src.id);
}
