// Démarrage rapide : résolution Piped locale + proxy Range direct (sans attendre yt-dlp).
// Sécurité : https *.googlevideo.com, allowlist réappliquée à CHAQUE redirection ; 127.0.0.1 seulement
// sous SONORA_FAST_ALLOW_INSECURE_UPSTREAM=1 (harnais de test).
import http from 'node:http';
import https from 'node:https';
import { guardUrl, pinnedRequest } from './netguard.mjs';

const PIPED = (process.env.PIPED_INTERNAL_URL || 'http://127.0.0.1:8081').replace(/\/$/, '');
const ACTIF = process.env.SONORA_FAST === '1'; // opt-in : Piped local ne fournit pas d'audioStreams sur cette instance
const INSECURE = process.env.SONORA_FAST_ALLOW_INSECURE_UPSTREAM === '1';
const TTL = 30 * 60 * 1000;
const MAX_FLUX = 6;
const cache = new Map();
let flux = 0;

export function rapideActif() { return ACTIF; }

function loopback(h) { return h === '127.0.0.1' || h === '::1' || h === '[::1]'; }
function hoteAutorise(u) {
  if (INSECURE && u.protocol === 'http:' && loopback(u.hostname)) return true;
  return u.protocol === 'https:' && /(^|\.)googlevideo\.com$/i.test(u.hostname);
}

export async function resoudreRapide(id) {
  if (!ACTIF) return null;
  const c = cache.get(id);
  if (c && Date.now() - c.at < TTL) return c;
  try {
    const j = await lireJson(PIPED + '/streams/' + encodeURIComponent(id), 3500);
    const m4a = (j.audioStreams || []).filter((s) => {
      if (!s || !s.url || !/^audio\/mp4/i.test(s.mimeType || '')) return false;
      try { return hoteAutorise(new URL(s.url)); } catch (e) { return false; }
    });
    if (!m4a.length) return null;
    m4a.sort((a, b) => ((b.itag === 140 ? 1 : 0) - (a.itag === 140 ? 1 : 0)) || (b.bitrate || 0) - (a.bitrate || 0));
    const out = { id, url: m4a[0].url, mime: 'audio/mp4', at: Date.now() };
    cache.set(id, out);
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return out;
  } catch (e) { return null; }
}

function lireJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    let u; try { u = new URL(url); } catch (e) { return reject(e); }
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.get(u, { timeout: timeoutMs }, (res) => {
      let s = ''; res.setEncoding('utf8');
      res.on('data', (c) => { s += c; });
      res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

// Ouvre l'upstream en ré-appliquant l'allowlist à chaque saut (redirects inclus).
async function ouvrir(raw, headers, timeoutMs, redirects = 6) {
  let current = raw;
  for (let i = 0; i <= redirects; i++) {
    const u = new URL(current);
    if (!hoteAutorise(u)) throw Object.assign(new Error('host'), { code: 'host' });
    let res;
    if (INSECURE && u.protocol === 'http:') res = await brut(u, headers, timeoutMs);
    else { const g = await guardUrl(current); res = await pinnedRequest(g.url, g.ip, timeoutMs, headers); }
    if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
      const loc = res.headers.location; res.resume();
      if (!loc) throw Object.assign(new Error('bad_redirect'), { code: 'bad_redirect' });
      current = new URL(loc, u).href; continue;
    }
    return res;
  }
  throw Object.assign(new Error('too_many_redirects'), { code: 'redirects' });
}

function brut(u, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const r = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET', headers, timeout: timeoutMs }, resolve);
    r.on('timeout', () => r.destroy(new Error('timeout')));
    r.on('error', reject);
    r.end();
  });
}

// true = en-têtes envoyés (corps en streaming) ; false = rien écrit, l'appelant doit fallback.
export async function proxyRapide(req, res, src, id) {
  if (flux >= MAX_FLUX) return false;
  const range = req.headers.range;
  const headers = { 'user-agent': req.headers['user-agent'] || 'Sonora/1.0' };
  if (range) headers.range = range;
  const essai = async (s) => {
    const up = await ouvrir(s.url, headers, 20000);
    const st = up.statusCode || 0;
    if (st === 416) {
      try { res.writeHead(416, { 'Content-Range': up.headers['content-range'] || 'bytes */*', 'Content-Length': '0' }); res.end(); } catch (e) {}
      return { ok: true };
    }
    if (st !== 200 && st !== 206) { up.resume(); return { ko: st }; }
    if (range && st === 200) { up.resume(); return { ko: 200 }; }
    if (st === 206 && !up.headers['content-range']) { up.resume(); return { ko: 'no-range' }; }
    if (!up.headers['content-length'] && !up.headers['content-range']) { up.resume(); return { ko: 'no-length' }; }
    try {
      res.writeHead(st, Object.assign({
        'Content-Type': s.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Sonora-Fast': '1',
      }, up.headers['content-range'] ? { 'Content-Range': up.headers['content-range'] } : {},
         up.headers['content-length'] ? { 'Content-Length': up.headers['content-length'] } : {}));
    } catch (e) { try { up.destroy(); } catch (e2) {} return { ko: 'write' }; }
    up.pipe(res);
    up.on('error', () => { try { res.destroy(); } catch (e) {} });
    return { ok: true, up };
  };
  flux += 1;
  try {
    let r = await essai(src);
    if (r && (r.ko === 403 || r.ko === 410) && id) {
      cache.delete(id);
      const autre = await resoudreRapide(id);
      if (autre) r = await essai(autre);
    }
    if (r && r.up) {
      const up = r.up;
      req.on('close', () => { try { up.destroy(); } catch (e) {} });
      return true;
    }
    return false;
  } catch (e) { return false; } finally { flux -= 1; }
}
