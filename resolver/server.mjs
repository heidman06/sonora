// Sonora resolver : résout des URLs audio m4a via InnerTube (youtubei.js) en ~1 s.
// Écoute uniquement sur 127.0.0.1. Cookie YouTube requis (même fichier que le hub).
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { Innertube } from 'youtubei.js';

const PORT = Number(process.env.RESOLVER_PORT || 8099);
const COOKIES = process.env.SONORA_COOKIES || '/home/heidman/dashboard/data/yt-cookies.txt';
const TTL = 5 * 3600 * 1000;
const cache = new Map();

function enteteCookie() {
  try {
    return readFileSync(COOKIES, 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t')).filter((p) => p.length >= 7).map((p) => p[5] + '=' + p[6]).join('; ');
  } catch { return ''; }
}

const yt = await Innertube.create({ cookie: enteteCookie(), retrieve_player: true });

async function resoudre(id) {
  const c = cache.get(id);
  if (c && Date.now() - c.at < TTL) return c;
  for (const client of ['IOS', 'ANDROID']) {
    try {
      const info = await yt.getInfo(id, client);
      const fm = (info.streaming_data && info.streaming_data.adaptive_formats) || [];
      const m4a = fm.filter((f) => /audio\/mp4/i.test(f.mime_type || ''));
      for (const f of m4a) {
        let url = f.url;
        if (!url && f.decipher) url = await f.decipher(yt.session.player);
        if (url && /^https:\/\/.*googlevideo\.com/.test(url)) {
          const v = { url, mime: 'audio/mp4', at: Date.now(), client };
          cache.set(id, v);
          if (cache.size > 200) cache.delete(cache.keys().next().value);
          return v;
        }
      }
    } catch (e) { console.error('[resolver] ' + client + ' ' + (e && e.message)); }
  }
  return null;
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, cache: cache.size })); return; }
  if (u.pathname !== '/resolve') { res.writeHead(404).end('resolver'); return; }
  const id = String(u.searchParams.get('id') || '');
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) { res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'id' })); return; }
  const r = await resoudre(id);
  if (!r) { res.writeHead(502, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'no_stream' })); return; }
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({ url: r.url, mime: r.mime }));
}).listen(PORT, '127.0.0.1', () => console.log('[resolver] http://127.0.0.1:' + PORT));