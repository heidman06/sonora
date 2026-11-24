// Sonora - Subsonic gateway (CarPlay via Amperfy / Subsonic clients)
// Legacy auth: u + p (p=enc:hex accepted). Token auth: u + t + s if the dedicated
// password is provided in SONORA_SONIC_USERS="user:pass,user2:pass2".
import { createHash } from 'node:crypto';
import { ouvrirBase, identifiants, lancerYtdlp } from './musique.mjs';
import { dureesConnues, dureesManquantes } from './durees.mjs';

const VERSION = '1.16.1';
const PIPED = (process.env.PIPED_URL || 'http://127.0.0.1:8081').replace(/\/$/, '');
const SONIC_USERS = new Map(
  String(process.env.SONORA_SONIC_USERS || process.env.SUBSONIC_USERS || '')
    .split(',').map((x) => x.trim()).filter(Boolean)
    .map((x) => { const i = x.indexOf(':'); return i > 0 ? [x.slice(0, i), x.slice(i + 1)] : null; })
    .filter(Boolean)
);

function md5(s) { return createHash('md5').update(s, 'utf8').digest('hex'); }
function entier(v, def, min, max) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

// Auth cache (scrypt costs ~50 ms) - short TTL, key = credentials hash.
const authCache = new Map();
const AUTH_TTL = 10 * 60 * 1000;
function cacheAuth(cle, row) {
  authCache.set(cle, { at: Date.now(), row });
  if (authCache.size > 300) authCache.delete(authCache.keys().next().value);
  return row;
}
function cacheLire(cle) {
  const c = authCache.get(cle);
  if (!c) return null;
  if (Date.now() - c.at > AUTH_TTL) { authCache.delete(cle); return null; }
  return c.row;
}

function json(res, data, code) {
  res.writeHead(code || 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ 'subsonic-response': Object.assign({ status: 'ok', version: VERSION }, data) }));
}
function echec(res, code, message, httpCode) {
  res.writeHead(httpCode || 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ 'subsonic-response': { status: 'failed', version: VERSION, error: { code, message } } }));
}
function ecrireXml(v, nom) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map((x) => ecrireXml(x, nom)).join('');
  if (typeof v === 'object') {
    return '<' + nom + '>' + Object.keys(v).map((k) => ecrireXml(v[k], k)).join('') + '</' + nom + '>';
  }
  const s = String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return '<' + nom + '>' + s + '</' + nom + '>';
}
function repondre(req, res, data) {
  const url = new URL(req.url, 'http://x');
  if (url.searchParams.get('f') === 'json' || /application\/json/.test(req.headers.accept || '')) return json(res, data);
  const xml = '<?xml version="1.0" encoding="UTF-8"?>' + ecrireXml(Object.assign({ status: 'ok', version: VERSION }, data), 'subsonic-response');
  res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(xml);
}
function auth(req, url) {
  const u = url.searchParams.get('u') || '';
  if (!u) return null;
  const d = ouvrirBase();
  const row = d.prepare('SELECT id, username, display FROM users WHERE username = ?').get(u);
  if (!row) return null;
  let p = url.searchParams.get('p') || '';
  if (p.startsWith('enc:')) { try { p = Buffer.from(p.slice(4), 'hex').toString('utf8'); } catch (e) { return null; } }
  const cleClair = 'p:' + md5(u + ':' + p);
  const cache = p ? cacheLire(cleClair) : null;
  if (cache) return cache;
  if (p) return identifiants(u, p) ? cacheAuth(cleClair, row) : null;
  const t = url.searchParams.get('t') || '';
  const s = url.searchParams.get('s') || '';
  const clair = SONIC_USERS.get(u);
  if (t && s && clair) {
    const cleToken = 't:' + md5(u + ':' + t + ':' + s);
    const c2 = cacheLire(cleToken);
    if (c2) return c2;
    if (md5(clair + s).toLowerCase() === t.toLowerCase()) return cacheAuth(cleToken, row);
  }
  return null;
}
function chanson(videoId, titre, artiste, opts) {
  const o = opts || {};
  return {
    id: videoId, parent: '1', isDir: false, title: titre || '', album: o.album || 'Sonora',
    artist: artiste || '', track: o.track || 0, year: 0, genre: o.genre || '', coverArt: videoId,
    size: 0, contentType: 'audio/mp4', suffix: 'm4a', duration: o.duration || 0, bitRate: 0,
    path: 'sonora/' + videoId, isVideo: false, type: 'music', starred: o.starred ? true : undefined,
  };
}
function listePlaylists(d, userId) {
  const ps = d.prepare('SELECT id, name, created_at FROM playlists WHERE user_id = ? ORDER BY name').all(userId);
  return ps.map((p) => {
    const tr = d.prepare('SELECT video_id FROM playlist_tracks WHERE playlist_id = ?').all(p.id);
    return { id: 'pl-' + p.id, name: p.name, comment: '', owner: '', public: false, songCount: tr.length, duration: 0, created: p.created_at || '', changed: '', coverArt: tr[0] ? tr[0].video_id : '' };
  });
}
function albumsPlaylists(d, userId) {
  const ps = d.prepare('SELECT id, name, created_at FROM playlists WHERE user_id = ? ORDER BY name').all(userId);
  return ps.map((p) => {
    const tr = d.prepare('SELECT video_id FROM playlist_tracks WHERE playlist_id = ?').all(p.id);
    let duration = 0;
    try {
      const ids = tr.map((x) => x.video_id);
      if (ids.length) {
        const marques = ids.map(() => '?').join(',');
        duration = d.prepare('SELECT COALESCE(SUM(duration),0) AS s FROM track_meta WHERE video_id IN (' + marques + ')').get(...ids).s || 0;
      }
    } catch (e) {}
    return {
      id: 'al-pl-' + p.id, name: p.name, artist: 'Sonora', artistId: 'ar-sonora',
      coverArt: tr[0] ? tr[0].video_id : '', songCount: tr.length, duration: duration,
      playCount: 0, created: p.created_at || '',
    };
  });
}

async function playlistComplete(d, userId, pid) {
  const p = d.prepare('SELECT id, name FROM playlists WHERE id = ? AND user_id = ?').get(pid, userId);
  if (!p) return null;
  const tr = d.prepare('SELECT video_id, title, artist FROM playlist_tracks WHERE playlist_id = ? ORDER BY added_at DESC').all(pid);
  const ids = tr.map((x) => x.video_id);
  const durees = dureesConnues(d, ids);
  if (ids.slice(0, 10).some((id) => !durees.has(id))) dureesManquantes(d, ids).catch(() => {});
  const total = tr.reduce((s, x) => s + (durees.get(x.video_id) || 0), 0);
  return {
    id: 'pl-' + p.id, name: p.name, comment: '', owner: '', public: false, songCount: tr.length, duration: total,
    created: '', changed: '',
    entry: tr.map((x, i) => chanson(x.video_id, x.title, x.artist, { album: p.name, track: i + 1, duration: durees.get(x.video_id) || 0 })),
  };
}
async function recherche(q) {
  if (!q) return [];
  try {
    const out = await lancerYtdlp(['--flat-playlist', '--print', '%(id)s\t%(title)s\t%(channel)s\t%(duration)s', 'ytsearch10:' + q], 20000);
    return out.split(String.fromCharCode(10)).filter(Boolean).map((l) => l.split(String.fromCharCode(9))).filter((m) => /^[A-Za-z0-9_-]{11}$/.test(m[0] || '')).map((m) => chanson(m[0], m[1], m[2], { duration: Number(m[3] || 0) }));
  } catch (e) { return []; }
}
function requetePiped(path) {
  if (!PIPED) return Promise.resolve(null);
  return fetch(PIPED + path, { timeout: 8000 }).then((r) => r.ok ? r.json() : null).catch(() => null);
}

export async function handleSubsonic(req, res, path, urlRecue) {
  if (!path.startsWith('/subsonic/rest')) return false;
  const url = new URL(req.url, 'http://x');
  const methode = path.slice('/subsonic/rest/'.length).replace(/\.view$/, '');
  const d = ouvrirBase();
  const u = auth(req, url);
  if (!u) { echec(res, 40, 'Wrong username or password'); return true; }
  try {
    if (methode === 'ping') return repondre(req, res, { type: 'sonora', serverVersion: '1.8.0', openSubsonic: true }), true;
    if (methode === 'getLicense') return repondre(req, res, { license: { valid: true } }), true;
    if (methode === 'getMusicFolders') return repondre(req, res, { musicFolders: { musicFolder: [{ id: 1, name: 'Sonora' }] } }), true;
    if (methode === 'getPlaylists') return repondre(req, res, { playlists: { playlist: listePlaylists(d, u.id) } }), true;
    if (methode === 'getPlaylist') {
      const id = String(url.searchParams.get('id') || '').replace(/^pl-/, '');
      const p = await playlistComplete(d, u.id, Number(id));
      if (!p) return echec(res, 70, 'Playlist introuvable'), true;
      return repondre(req, res, { playlist: p }), true;
    }
    if (methode === 'search3' || methode === 'search2') {
      const q = url.searchParams.get('query') || '';
      const chansons = await recherche(q);
      return repondre(req, res, { searchResult3: { artist: [], album: [], song: chansons } }), true;
    }
    if (methode === 'getCoverArt') {
      const id = String(url.searchParams.get('id') || '');
      const vid = (id.match(/[A-Za-z0-9_-]{11}/) || [id])[0];
      try {
        const r = await fetch('https://i.ytimg.com/vi/' + vid + '/mqdefault.jpg', { timeout: 10000 });
        if (!r.ok) return echec(res, 70, 'Cover introuvable'), true;
        const buf = Buffer.from(await r.arrayBuffer());
        res.writeHead(200, { 'Content-Type': r.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'public, max-age=86400', 'Content-Length': buf.length });
        res.end(buf);
      } catch (e) { echec(res, 70, 'Cover indisponible'); }
      return true;
    }
    if (methode === 'stream' || methode === 'download') {
      const id = String(url.searchParams.get('id') || '');
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return echec(res, 70, 'id invalide'), true;
      res.writeHead(302, { Location: '/musique/dl/' + id, 'Cache-Control': 'no-store' });
      res.end();
      return true;
    }
    if (methode === 'getAlbumList2' || methode === 'getAlbumList') {
      const type = String(url.searchParams.get('type') || 'alphabetical');
      const size = entier(url.searchParams.get('size'), 50, 1, 200);
      const offset = entier(url.searchParams.get('offset'), 0, 0, 100000);
      let albums = albumsPlaylists(d, u.id);
      if (type === 'newest') albums = albums.slice().sort((a, b) => String(b.created).localeCompare(String(a.created)));
      else if (type === 'random') albums = albums.sort(() => Math.random() - 0.5);
      albums = albums.slice(offset, offset + size);
      return repondre(req, res, { albumList2: { album: albums } }), true;
    }
    if (methode === 'getArtists' || methode === 'getIndexes') {
      const albums = albumsPlaylists(d, u.id);
      const artist = [{ id: 'ar-sonora', name: 'Sonora', albumCount: albums.length, coverArt: albums[0] ? albums[0].coverArt : '' }];
      const index = [{ name: 'S', artist: artist }];
      return repondre(req, res, methode === 'getArtists' ? { artists: { ignoredArticles: '', index: index } } : { indexes: { ignoredArticles: '', index: index } }), true;
    }
    if (methode === 'getArtist') {
      const albums = albumsPlaylists(d, u.id);
      return repondre(req, res, { artist: { id: 'ar-sonora', name: 'Sonora', albumCount: albums.length, album: albums } }), true;
    }
    if (methode === 'getAlbum') {
      const id = String(url.searchParams.get('id') || '');
      const pid = Number(id.replace(/^al-pl-/, '').replace(/^pl-/, ''));
      const p = await playlistComplete(d, u.id, pid);
      if (!p) return echec(res, 70, 'Album introuvable'), true;
      return repondre(req, res, { album: { id: 'al-pl-' + pid, name: p.name, artist: 'Sonora', artistId: 'ar-sonora', songCount: p.songCount, duration: p.duration, coverArt: p.entry[0] ? p.entry[0].id : '', song: p.entry } }), true;
    }
    if (methode === 'getStarred2' || methode === 'getStarred') {
      const likes = d.prepare('SELECT video_id, title, artist FROM likes WHERE user_id = ? ORDER BY added_at DESC').all(u.id);
      const durs = dureesConnues(d, likes.map((x) => x.video_id));
      return repondre(req, res, { starred2: { artist: [], album: [], song: likes.map((x) => chanson(x.video_id, x.title, x.artist, { starred: true, duration: durs.get(x.video_id) || 0 })) } }), true;
    }
    if (methode === 'star' || methode === 'unstar') {
      const id = String(url.searchParams.get('id') || '');
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) {
        if (methode === 'star') d.prepare('INSERT OR IGNORE INTO likes (user_id, video_id, title, artist) VALUES (?, ?, ?, ?)').run(u.id, id, '', '');
        else d.prepare('DELETE FROM likes WHERE user_id = ? AND video_id = ?').run(u.id, id);
      }
      return repondre(req, res, {}), true;
    }
    if (methode === 'scrobble') {
      const id = String(url.searchParams.get('id') || '');
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) d.prepare('INSERT INTO history (user_id, video_id, title, artist) VALUES (?, ?, ?, ?)').run(u.id, id, '', '');
      return repondre(req, res, {}), true;
    }
    if (methode === 'getUser') return repondre(req, res, { user: { username: u.username, email: '', scrobblingEnabled: false, adminRole: false, settingsRole: false, downloadRole: true, uploadRole: false, playlistRole: true, coverArtRole: false, commentRole: false, podcastRole: false, shareRole: false, videoConversionRole: false } }), true;
    if (methode === 'getScanStatus') return repondre(req, res, { scanStatus: { scanning: false, count: 0 } }), true;
    if (methode === 'getRandomSongs') {
      const rows = d.prepare('SELECT video_id, title, artist FROM likes WHERE user_id = ? ORDER BY RANDOM() LIMIT 20').all(u.id);
      const durs = dureesConnues(d, rows.map((x) => x.video_id));
      return repondre(req, res, { randomSongs: { song: rows.map((x) => chanson(x.video_id, x.title, x.artist, { duration: durs.get(x.video_id) || 0 })) } }), true;
    }
    if (methode === 'getSong') {
      const id = String(url.searchParams.get('id') || '');
      const like = d.prepare('SELECT title, artist FROM likes WHERE user_id = ? AND video_id = ?').get(u.id, id);
      const pt = d.prepare('SELECT title, artist FROM playlist_tracks WHERE video_id = ? LIMIT 1').get(id);
      const rc = d.prepare('SELECT title, artist FROM resolve_cache WHERE video_id = ? LIMIT 1').get(id);
      const meta = like || pt || rc || { title: '', artist: '' };
      const durs = await dureesManquantes(d, [id]);
      return repondre(req, res, { song: chanson(id, meta.title, meta.artist, { duration: durs.get(id) || 0 }) }), true;
    }
    if (methode === 'getOpenSubsonicExtensions') return repondre(req, res, { openSubsonicExtensions: { openSubsonicExtension: [] } }), true;
    if (methode === 'getGenres') return repondre(req, res, { genres: { genre: [] } }), true;
    if (methode === 'getSimilarSongs2' || methode === 'getSimilarSongs') return repondre(req, res, { similarSongs2: { song: [] } }), true;
    if (methode === 'getLyricsBySongId' || methode === 'getLyrics') return repondre(req, res, methode === 'getLyrics' ? { lyrics: { artist: '', title: '', value: '' } } : { lyricsList: { structuredLyrics: [] } }), true;
    if (methode === 'getPodcasts') return repondre(req, res, { podcasts: { channel: [] } }), true;
    if (methode === 'getNewestPodcasts') return repondre(req, res, { newestPodcasts: { episode: [] } }), true;
    if (methode === 'getInternetRadioStations') return repondre(req, res, { internetRadioStations: { internetRadioStation: [] } }), true;
    if (methode === 'setRating') return repondre(req, res, {}), true;
    if (methode === 'getMusicDirectory') {
      const id = String(url.searchParams.get('id') || '1');
      const albums = albumsPlaylists(d, u.id).map((a) => ({ id: a.id, parent: id, isDir: true, title: a.name, album: a.name, artist: 'Sonora', coverArt: a.coverArt, songCount: a.songCount }));
      return repondre(req, res, { directory: { id: id, parent: '0', name: 'Sonora', playCount: 0, child: albums } }), true;
    }
    return echec(res, 0, 'Méthode inconnue: ' + methode), true;
  } catch (e) {
    return echec(res, 0, String(e.message || e).slice(0, 160)), true;
  }
}
