#!/usr/bin/env node
// Sonora - standalone server (API + audio + static PWA)
// Variables: SONORA_PORT, SONORA_HOST, SONORA_DATA, SONORA_COOKIES, YTDLP_PATH,
//             SONORA_NODE_BIN, SONORA_EJS, SONORA_CACHE_MAX_BYTES, PIPED_URL
import http from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleMusique } from './musique.mjs';
import { handleAudio } from './audio.mjs';
import { handleSubsonic } from './subsonic.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.SONORA_PORT || process.env.PORT || 3011);
const HOST = process.env.SONORA_HOST || '127.0.0.1';
const WEB = process.env.SONORA_WEB || join(__dirname, '..', 'web');
const PIPED = (process.env.PIPED_URL || '').replace(/\/$/, '');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.m4a': 'audio/mp4', '.webm': 'audio/webm',
};
const pipedCache = new Map();

function injecter(html) {
  if (!html.includes('mus-header.css')) html = html.replace('</head>', '<link rel="stylesheet" href="mus-header.css?v=3">' + String.fromCharCode(10) + '</head>');
  if (!html.includes('mus-queue.css')) html = html.replace('</head>', '<link rel="stylesheet" href="mus-queue.css?v=1">' + String.fromCharCode(10) + '</head>');
  if (!html.includes('mus-i18n.js')) html = html.replace('</body>', '<script src="mus-i18n.js?v=2" defer></script>' + String.fromCharCode(10) + '</body>');
  if (!html.includes('mus-integration.js')) html = html.replace('</body>', '<script src="mus-integration.js?v=6" defer></script>' + String.fromCharCode(10) + '</body>');
  return html;
}

function servirStatique(res, rel) {
  const clean = normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const f = join(WEB, clean);
  if (!f.startsWith(WEB)) { res.writeHead(403).end('forbidden'); return true; }
  if (!existsSync(f) || !statSync(f).isFile()) return false;
  const type = MIME[extname(f).toLowerCase()] || 'application/octet-stream';
  const data = readFileSync(f);
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Length': data.length });
  res.end(data);
  return true;
}

async function proxyPiped(req, res, path, search) {
  if (!PIPED) { res.writeHead(503, { 'Content-Type': 'application/json' }).end('{"error":"PIPED_URL non configure"}'); return; }
  const cle = path + search;
  const c = pipedCache.get(cle);
  if (c && Date.now() - c.at < 5 * 60 * 1000) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }).end(c.body);
    return;
  }
  try {
    const r = await fetch(PIPED + path + search, { timeout: 15000 });
    const body = Buffer.from(await r.arrayBuffer());
    if (r.ok) pipedCache.set(cle, { at: Date.now(), body });
    res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/json', 'Cache-Control': 'public, max-age=300' }).end(body);
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: String(e.message || e) }));
  }
}

const server = http.createServer(async (req, res) => {
  try {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch (e) { res.writeHead(400).end('bad request'); return; }
    const path = url.pathname;

    if (path.startsWith('/api/mus/')) { handleMusique(req, res, path, url); return; }
    if (path === '/subsonic' || path === '/subsonic/') {
      if (path === '/subsonic') { res.writeHead(302, { Location: '/subsonic/' }).end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<h1>Sonora · Subsonic</h1><p>Base API : <code>/subsonic/rest</code></p>');
      return;
    }
    if (path.startsWith('/subsonic/rest')) { await handleSubsonic(req, res, path, url); return; }
    if (await handleAudio(req, res, path)) return;
    if (path.startsWith('/api/piped/')) { await proxyPiped(req, res, path.slice('/api/piped'.length), url.search); return; }

    if (path === '/musique') { res.writeHead(302, { Location: '/musique/' }).end(); return; }
    if (path === '/musique/' || path === '/musique/index.html') {
      const html = injecter(readFileSync(join(WEB, 'index.html'), 'utf8'));
      const corps = Buffer.from(html, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': corps.length }).end(corps);
      return;
    }
    if (path.startsWith('/musique/')) { if (servirStatique(res, path.slice('/musique/'.length))) return; res.writeHead(404).end('not found'); return; }
    if (path === '/health') { res.writeHead(302, { Location: '/api/mus/health' }).end(); return; }
    if (path === '/' || path === '/index.html') { res.writeHead(302, { Location: '/musique/' }).end(); return; }
    if (servirStatique(res, path.slice(1))) return;
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
  } catch (e) {
    try { res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: String(e.message || e) })); } catch (e2) {}
  }
});
server.listen(PORT, HOST, () => console.log('[sonora] http://' + HOST + ':' + PORT + '/musique/ — data=' + (process.env.SONORA_DATA || join(__dirname, '..', 'data')) + (PIPED ? ' piped=' + PIPED : ' piped=off')));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); });
