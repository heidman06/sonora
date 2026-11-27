// Pré-résolution des URLs googlevideo via yt-dlp (cookies), cache court, sans fichier téléchargé.
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const YTDLP = process.env.YTDLP_PATH || '/usr/bin/yt-dlp';
const COOKIES = process.env.SONORA_COOKIES || join(__dirname, 'data', 'yt-cookies.txt');
const NODE = process.env.SONORA_NODE_BIN || '/usr/local/bin/heid-node';
const EJS = process.env.SONORA_EJS || 'ejs:github';
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

export function prefetcher(ids) {
  const list = [...new Set(ids)].filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id) && !urlCachee(id) && !enCours.has(id)).slice(0, 3);
  for (const id of list) {
    const p = resoudre(id).catch(() => null).finally(() => enCours.delete(id));
    enCours.set(id, p);
  }
  return list.length;
}

export function resoudre(id) {
  if (urlCachee(id)) return Promise.resolve(urlCachee(id));
  if (enCours.has(id)) return enCours.get(id);
  const p = new Promise((resolve) => {
    const args = ['--cookies', COOKIES, '--js-runtimes', 'node:' + NODE, '--remote-components', EJS,
      '--no-warnings', '--extractor-args', 'youtube:player_skip=configs', '-f', '140/bestaudio[ext=m4a]', '-g', 'https://www.youtube.com/watch?v=' + id];
    const proc = spawn(YTDLP, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    const minuteur = setTimeout(() => { try { proc.kill('SIGKILL'); } catch (e) {} }, 20000);
    proc.stdout.on('data', (c) => { out += c; });
    proc.on('close', (code) => {
      clearTimeout(minuteur);
      const ligne = out.split('\n').map((x) => x.trim()).filter((x) => /^https:\/\//.test(x)).pop() || '';
      let ok = false;
      try { ok = !!ligne && /(^|\.)googlevideo\.com$/i.test(new URL(ligne).hostname); } catch (e) { ok = false; }
      if (code === 0 && ok) {
        const v = { url: ligne, at: Date.now() };
        cache.set(id, v);
        if (cache.size > MAX) cache.delete(cache.keys().next().value);
        resolve(v);
      } else resolve(null);
    });
    proc.on('error', () => { clearTimeout(minuteur); resolve(null); });
  }).finally(() => enCours.delete(id));
  enCours.set(id, p);
  return p;
}
