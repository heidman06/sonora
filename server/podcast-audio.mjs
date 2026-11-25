// Audio podcasts : proxy Range + cache disque séparé + tee in-flight. audio.mjs intact.
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, renameSync, writeFileSync, utimesSync } from 'node:fs';
import { join, extname } from 'node:path';
import { ouvrirBase } from './musique.mjs';
import { verifierSrc } from './podcasts.mjs';
import { guardUrl, pinnedRequest, pinnedFollow } from './netguard.mjs';

const DATA = process.env.SONORA_DATA || join(process.cwd(), 'data');
const DIR = process.env.SONORA_PODCAST_CACHE_DIR || join(DATA, 'podcasts');
const MAX = Number(process.env.SONORA_PODCAST_CACHE_MAX_BYTES || 1024 * 1024 * 1024);
const CAP = Number(process.env.SONORA_POD_CAP_BYTES || 500 * 1024 * 1024);
const INACT = Number(process.env.SONORA_POD_INACTIVITY_MS || 30000);
const enCours = new Map();
let dernierElagage = 0;
export function nettoyerPart(dir) {
  try { for (const n of readdirSync(dir)) { if (!n.endsWith('.part')) continue; const p = join(dir, n); try { if (Date.now() - statSync(p).mtimeMs > 3600000) unlinkSync(p); } catch (e) {} } } catch (e) {}
}
function elaguer(dir) {
  if (Date.now() - dernierElagage < 5 * 60 * 1000) return;
  dernierElagage = Date.now();
  nettoyerPart(dir);
  try {
    const infos = []; let total = 0;
    for (const n of readdirSync(dir)) { if (!n.endsWith('.bin')) continue; const st = statSync(join(dir, n)); total += st.size; infos.push({ n, t: st.mtimeMs, s: st.size }); }
    if (total <= MAX) return;
    infos.sort((a, b) => a.t - b.t);
    for (const f of infos) { if (total <= MAX * 0.85) break; try { unlinkSync(join(dir, f.n)); unlinkSync(join(dir, f.n + '.ok')); total -= f.s; } catch (e) {} }
  } catch (e) {}
}
function typeDe(encType, url, amont) {
  if (encType && /^audio\//i.test(encType)) return encType;
  const e = extname(new URL(url).pathname).toLowerCase();
  if (e === '.m4a' || e === '.mp4' || e === '.aac') return 'audio/mp4';
  if (e === '.ogg' || e === '.opus') return 'audio/ogg';
  if (e === '.mp3') return 'audio/mpeg';
  if (amont && /^audio\//i.test(amont)) return amont;
  return 'audio/mpeg';
}
function servirLocal(req, res, fichier, type) {
  const taille = statSync(fichier).size;
  try { utimesSync(fichier, new Date(), new Date()); } catch (e) {}
  if (req.method === 'HEAD') { res.writeHead(200, { 'Content-Type': type, 'Content-Length': taille, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' }).end(); return; }
  const portee = req.headers.range;
  if (portee && /^bytes=\d*-\d*$/.test(portee)) {
    const [a, b] = portee.replace('bytes=', '').split('-');
    const suffix = a === '';
    const debut = suffix ? Math.max(0, taille - (parseInt(b, 10) || 0)) : parseInt(a, 10);
    const fin = suffix ? taille - 1 : (b ? Math.min(parseInt(b, 10), taille - 1) : taille - 1);
    if (!Number.isFinite(debut) || !Number.isFinite(fin) || debut < 0 || fin < debut || debut >= taille) { res.writeHead(416, { 'Content-Range': 'bytes */' + taille }).end(); return; }
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': 'bytes ' + debut + '-' + fin + '/' + taille, 'Accept-Ranges': 'bytes', 'Content-Length': fin - debut + 1 });
    createReadStream(fichier, { start: debut, end: fin }).pipe(res); return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': taille, 'Accept-Ranges': 'bytes' });
  createReadStream(fichier).pipe(res);
}
export async function handlePodcastAudio(req, res, path, url) {
  if (!path.startsWith('/podcast/ep/')) return false;
  const id = Number(path.slice('/podcast/ep/'.length));
  const sig = url.searchParams.get('sig'), exp = url.searchParams.get('exp');
  if (!Number.isFinite(id) || !verifierSrc(id, exp, sig)) { res.writeHead(403, { 'Content-Type': 'application/json' }).end('{"error":"sig"}'); return true; }
  const d = ouvrirBase();
  const ep = d.prepare('SELECT enclosure_url, enclosure_type, unavailable FROM podcast_episodes WHERE id = ?').get(id);
  if (!ep || ep.unavailable || !/^https:/.test(ep.enclosure_url || '')) {
    if (process.env.SONORA_POD_ALLOW_INSECURE_UPSTREAM !== '1' || !ep) { res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"episode"}'); return true; }
  }
  mkdirSync(DIR, { recursive: true });
  const fichier = join(DIR, id + '.bin');
  const type = typeDe(ep.enclosure_type, ep.enclosure_url, '');
  if (existsSync(fichier) && existsSync(fichier + '.ok') && statSync(fichier).size > 0) { servirLocal(req, res, fichier, type); return true; }
  if (existsSync(fichier) && statSync(fichier).size === 0) { try { unlinkSync(fichier); unlinkSync(fichier + '.ok'); } catch (e) {} }
  if (req.method === 'HEAD') { res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(); void demarrer(id, ep, type); return true; }
  if (req.headers.range) { await proxyRange(req, res, ep, type); return true; }
  rejoindre(req, res, id, ep, type);
  return true;
}
async function proxyRange(req, res, ep, type) {
  try {
    let g;
    if (process.env.SONORA_POD_ALLOW_INSECURE_UPSTREAM === '1') g = { url: new URL(ep.enclosure_url), ip: null };
    else g = await guardUrl(ep.enclosure_url);
    const headers = { Range: req.headers.range };
    const up = g.ip ? await pinnedFollow(ep.enclosure_url, headers, INACT) : await requeteHttp(g.url, headers);
    res.writeHead(up.statusCode, { 'Content-Type': type, 'Content-Range': up.headers['content-range'] || '', 'Accept-Ranges': 'bytes', 'Content-Length': up.headers['content-length'] || '' });
    up.pipe(res);
  } catch (e) { if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' }).end('{"error":"upstream"}'); else res.destroy(); }
}
function requeteHttp(u, headers) {
  return new Promise((resolve, reject) => {
    import('node:http').then((http) => {
      const r = http.request({ hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, headers, timeout: INACT }, resolve);
      r.on('timeout', () => r.destroy(new Error('inactivity')));
      r.on('error', reject); r.end();
    });
  });
}
function demarrer(id, ep, type) {
  if (enCours.has(id)) return enCours.get(id);
  const state = { clients: new Set(), type, bytes: 0, sent: false };
  const part = join(DIR, id + '.bin.part');
  const ws = createWriteStream(part);
  state.ws = ws;
  const fin = (err) => {
    clearTimeout(state.timer);
    enCours.delete(id);
    if (err) { try { ws.destroy(); } catch (e) {} try { unlinkSync(part); } catch (e) {} for (const c of state.clients) { if (!c.headersSent) c.writeHead(502, { 'Content-Type': 'application/json' }).end('{"error":"upstream"}'); else c.destroy(); } return; }
    ws.end(() => {
      try { renameSync(part, join(DIR, id + '.bin')); writeFileSync(join(DIR, id + '.bin.ok'), ''); } catch (e) {}
      elaguer(DIR);
      for (const c of state.clients) c.end();
    });
  };
  const arm = () => { clearTimeout(state.timer); state.timer = setTimeout(() => { try { state.up && state.up.destroy(); } catch (e) {} fin(new Error('inactivity')); }, INACT); };
  const promesse = (async () => {
    arm();
    let g;
    if (process.env.SONORA_POD_ALLOW_INSECURE_UPSTREAM === '1') g = { url: new URL(ep.enclosure_url), ip: null };
    else g = await guardUrl(ep.enclosure_url);
    const up = g.ip ? await pinnedFollow(ep.enclosure_url, {}, INACT) : await requeteHttp(g.url, {});
    state.up = up;
    if (up.statusCode !== 200) { fin(new Error('status')); return; }
    const longueur = Number(up.headers['content-length'] || 0);
    if (longueur > CAP) { try { up.destroy(); } catch (e) {} fin(new Error('cap')); return; }
    state.type = typeDe(ep.enclosure_type, ep.enclosure_url, up.headers['content-type']);
    arm();
    up.on('data', (c) => {
      arm();
      state.bytes += c.length;
      if (state.bytes > CAP) { try { up.destroy(); } catch (e) {} fin(new Error('cap')); return; }
      ws.write(c);
      for (const c2 of state.clients) { if (!c2.headersSent) c2.writeHead(200, { 'Content-Type': state.type, 'Accept-Ranges': 'bytes' }); c2.write(c); }
    });
    up.on('end', () => fin(null));
    up.on('error', (e) => fin(e));
  })().catch((e) => fin(e));
  state.promise = promesse;
  enCours.set(id, state);
  return state;
}
function rejoindre(req, res, id, ep, type) {
  const state = demarrer(id, ep, type);
  state.clients.add(res);
  req.on('close', () => { state.clients.delete(res); });
}
