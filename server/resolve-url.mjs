// Pré-résolution des URLs googlevideo : sidecar InnerTube (youtubei.js, ~1 s) puis yt-dlp en secours.
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const YTDLP = process.env.YTDLP_PATH || '/usr/bin/yt-dlp';
const COOKIES = process.env.SONORA_COOKIES || join(__dirname, 'data', 'yt-cookies.txt');
const NODE = process.env.SONORA_NODE_BIN || '/usr/local/bin/heid-node';
const EJS = process.env.SONORA_EJS || 'ejs:github';
const SIDECAR = (process.env.SONORA_RESOLVER_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const INSECURE = process.env.SONORA_RESOLVER_ALLOW_INSECURE === '1'; // harnais de test uniquement
const TTL = 5 * 3600 * 1000;
const MAX = 200;
const cache = new Map();
const enCours = new Map();

export function urlCachee(id) {
  const c = cache.get(id);
  if (c && Date.now() - c.at < TTL) return c;
  cache.delete(id);
  return null;
}

function memoriser(id, url, mime) {
  const v = { id, url, mime: mime || 'audio/mp4', at: Date.now() };
  cache.set(id, v);
  if (cache.size > MAX) cache.delete(cache.keys().next().value);
  return v;
}

// Sidecar seul, borné : utilisé pour décider vite si on peut proxifier.
export async function resoudreRapide(id) {
  const c = urlCachee(id);
  if (c) return c;
  try {
    const r = await fetch(SIDECAR + '/resolve?id=' + encodeURIComponent(id), { signal: AbortSignal.timeout(1800) });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || typeof j.url !== 'string') return null;
    const u = new URL(j.url);
    const loop = INSECURE && u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === '::1');
    if (!loop && (u.protocol !== 'https:' || !/(^|\.)googlevideo\.com$/i.test(u.hostname))) return null;
    return memoriser(id, j.url, j.mime);
  } catch { return null; }
}

export function resoudre(id) {
  const c = urlCachee(id);
  if (c) return Promise.resolve(c);
  if (enCours.has(id)) return enCours.get(id);
  const p = (async () => {
    const rapide = await resoudreRapide(id);
    if (rapide) return rapide;
    return parYtdlp(id);
  })().finally(() => enCours.delete(id));
  enCours.set(id, p);
  return p;
}

function parYtdlp(id) {
  return new Promise((resolve) => {
    const args = ['--cookies', COOKIES, '--js-runtimes', 'node:' + NODE, '--remote-components', EJS,
      '--no-warnings', '--extractor-args', 'youtube:player_skip=configs', '-f', '140/bestaudio[ext=m4a]', '-g', 'https://www.youtube.com/watch?v=' + id];
    const proc = spawn(YTDLP, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    const minuteur = setTimeout(() => { try { proc.kill('SIGKILL'); } catch (e) {} }, 20000);
    proc.stdout.on('data', (c) => { out += c; });
    proc.on('close', (code) => {
      clearTimeout(minuteur);
      const ligne = out.split('\n').map((x) => x.trim()).filter((x) => /^https:\/\//.test(x)).pop() || '';
      try {
        if (code === 0 && ligne && /(^|\.)googlevideo\.com$/i.test(new URL(ligne).hostname)) return resolve(memoriser(id, ligne));
      } catch (e) { /* ignore */ }
      resolve(null);
    });
    proc.on('error', () => { clearTimeout(minuteur); resolve(null); });
  });
}

export function prefetcher(ids) {
  const list = [...new Set(ids)].filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id) && !urlCachee(id) && !enCours.has(id)).slice(0, 3);
  for (const id of list) void resoudre(id).catch(() => {});
  return list.length;
}
