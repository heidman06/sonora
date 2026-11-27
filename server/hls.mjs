// Sonora - HLS queue for background playback on iOS.
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, renameSync, utimesSync } from 'node:fs';
import { ouvrirBase } from './musique.mjs';
import { dureesConnues } from './durees.mjs';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';

const TS_CACHE_MAX = Number(process.env.SONORA_TS_CACHE_MAX_BYTES || 2 * 1024 * 1024 * 1024);
const enCours = new Map();
let dernierElagage = 0;
const VID = /^[A-Za-z0-9_-]{11}$/;

function dossierTs(dataDir) {
  const d = join(dataDir, 'hls');
  mkdirSync(d, { recursive: true });
  return d;
}

function elaguer(d) {
  if (Date.now() - dernierElagage < 5 * 60 * 1000) return;
  dernierElagage = Date.now();
  try {
    const infos = [];
    let total = 0;
    for (const n of readdirSync(d)) {
      if (!n.endsWith('.ts')) continue;
      const st = statSync(join(d, n));
      total += st.size;
      infos.push({ n, t: st.mtimeMs, s: st.size });
    }
    if (total <= TS_CACHE_MAX) return;
    infos.sort((a, b) => a.t - b.t);
    for (const f of infos) {
      if (total <= TS_CACHE_MAX * 0.85) break;
      try { unlinkSync(join(d, f.n)); total -= f.s; } catch (e) {}
    }
  } catch (e) {}
}

function genererTs(id, d, port, ffmpeg) {
  if (enCours.has(id)) return enCours.get(id);
  const dest = join(d, id + '.ts');
  if (existsSync(dest) && statSync(dest).size > 1000) return Promise.resolve(dest);
  const tmp = dest + '.part';
  const p = new Promise((resolve, reject) => {
    const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-probesize', '32768', '-analyzeduration', '0', '-i', 'http://127.0.0.1:' + port + '/musique/dl/' + id, '-vn', '-c:a', 'copy', '-f', 'mpegts', tmp], { stdio: 'ignore' });
    const minuteur = setTimeout(() => { try { ff.kill('SIGKILL'); } catch (e) {} }, 120000);
    ff.on('close', (code) => {
      clearTimeout(minuteur);
      try {
        if (code === 0 && statSync(tmp).size > 1000) {
          renameSync(tmp, dest);
          elaguer(d);
          resolve(dest);
        } else {
          try { unlinkSync(tmp); } catch (e) {}
          reject(new Error('ffmpeg HLS'));
        }
      } catch (e) { reject(e); }
    });
    ff.on('error', (e) => { clearTimeout(minuteur); reject(e); });
  }).finally(() => enCours.delete(id));
  enCours.set(id, p);
  return p;
}


// Streaming progressif : on envoie le .ts dès les premiers octets produits par ffmpeg,
// tout en écrivant le fichier en cache pour les lectures suivantes.
function genererTsProgressif(req, res, id, d, port, ffmpeg) {
  const dest = join(d, id + '.ts');
  if (existsSync(dest) && statSync(dest).size > 1000) { servirFichier(req, res, dest); return Promise.resolve(true); }
  if (enCours.has(id)) {
    return enCours.get(id).then((f) => { if (f) servirFichier(req, res, f); return true; }).catch(() => false);
  }
  const tmp = dest + '.part';
  const p = new Promise((resolve) => {
    const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-probesize', '32768', '-analyzeduration', '0', '-i', 'http://127.0.0.1:' + port + '/musique/dl/' + id, '-vn', '-c:a', 'copy', '-f', 'mpegts', 'pipe:1'], { stdio: ['ignore', 'pipe', 'ignore'] });
    const disque = createWriteStream(tmp);
    const minuteur = setTimeout(() => { try { ff.kill('SIGKILL'); } catch (e) {} }, 120000);
    let entete = false, octets = 0, fini = false, clientParti = false;
    const finir = (ok) => {
      if (fini) return;
      fini = true;
      clearTimeout(minuteur);
      disque.end(() => {
        try {
          if (ok && statSync(tmp).size > 1000) { renameSync(tmp, dest); elaguer(d); }
          else unlinkSync(tmp);
        } catch (e) {}
      });
      resolve(entete);
    };
    ff.stdout.on('data', (c) => {
      octets += c.length;
      if (!entete) {
        try { res.writeHead(200, { 'Content-Type': 'video/mp2t', 'Cache-Control': 'public, max-age=86400' }); entete = true; } catch (e) { entete = false; }
      }
      if (!clientParti && !res.writableEnded) { try { res.write(c); } catch (e) { clientParti = true; } }
      if (!disque.writableEnded) disque.write(c);
    });
    ff.on('close', (code) => {
      const ok = code === 0 && octets > 1000;
      if (entete && !clientParti && !res.writableEnded) { try { res.end(); } catch (e) {} }
      finir(ok);
    });
    ff.on('error', () => { if (!entete) { try { res.writeHead(502).end(); } catch (e) {} } finir(false); });
    res.on('close', () => { clientParti = true; });
  }).finally(() => enCours.delete(id));
  enCours.set(id, p);
  return p;
}

function genererSilence(id, d, ffmpeg, duree) {
  // Separate name + short TTL: a transient failure must not silence a track forever.
  const dest = join(d, id + '.silence.ts');
  if (existsSync(dest)) {
    const st = statSync(dest);
    if (st.size > 1000 && Date.now() - st.mtimeMs < 60 * 1000) return Promise.resolve(dest);
    try { unlinkSync(dest); } catch (e) {}
  }
  const tmp = dest + '.part';
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', String(duree), '-c:a', 'aac', '-b:a', '48k', '-f', 'mpegts', tmp], { stdio: 'ignore' });
    const minuteur = setTimeout(() => { try { ff.kill('SIGKILL'); } catch (e) {} }, 30000);
    ff.on('close', (code) => {
      clearTimeout(minuteur);
      try {
        if (code === 0 && statSync(tmp).size > 1000) { renameSync(tmp, dest); resolve(dest); }
        else { try { unlinkSync(tmp); } catch (e) {} reject(new Error('silence')); }
      } catch (e) { reject(e); }
    });
    ff.on('error', (e) => { clearTimeout(minuteur); reject(e); });
  });
}

function servirFichier(req, res, fichier) {
  const taille = statSync(fichier).size;
  try { utimesSync(fichier, new Date(), new Date()); } catch (e) {} // keep eviction LRU honest
  const portee = req.headers.range;
  if (portee && /^bytes=\d*-\d*$/.test(portee)) {
    const [a, b] = portee.replace('bytes=', '').split('-');
    const debut = a ? parseInt(a, 10) : Math.max(0, taille - (parseInt(b, 10) || 0));
    const fin = b ? Math.min(parseInt(b, 10), taille - 1) : taille - 1;
    if (!Number.isFinite(debut) || !Number.isFinite(fin) || debut < 0 || fin < debut || debut >= taille) {
      res.writeHead(416, { 'Content-Range': 'bytes */' + taille }).end();
      return;
    }
    res.writeHead(206, { 'Content-Type': 'video/mp2t', 'Content-Range': 'bytes ' + debut + '-' + fin + '/' + taille, 'Content-Length': fin - debut + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400' });
    createReadStream(fichier, { start: debut, end: fin }).pipe(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'video/mp2t', 'Content-Length': taille, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400' });
  createReadStream(fichier).pipe(res);
}

export async function handleHls(req, res, path, url, opts) {
  if (!path.startsWith('/musique/hls/')) return false;
  const port = opts && opts.port;
  const dataDir = opts && opts.dataDir;
  const ffmpeg = (opts && opts.ffmpeg) || 'ffmpeg';
  if (!port || !dataDir) { res.writeHead(500).end('hls config'); return true; }
  const rel = path.slice('/musique/hls/'.length);

  if (rel === 'index.m3u8') {
    const ids = String(url.searchParams.get('ids') || '').split(',').filter((x) => VID.test(x)).slice(0, 60);
    if (!ids.length) { res.writeHead(400, { 'Content-Type': 'text/plain' }).end('ids'); return true; }
    const dursBrutes = String(url.searchParams.get('durs') || '').split(',');
    // Server-side real durations win over client estimates (track_meta cache).
    let connus = new Map();
    try { connus = dureesConnues(ouvrirBase(), ids); } catch (e) {}
    const durs = ids.map((x, i) => {
      const reel = connus.get(x);
      if (reel && reel >= 5) return Math.min(3600, Math.round(reel));
      const n = Number(dursBrutes[i]);
      return Number.isFinite(n) && n >= 5 ? Math.min(3600, Math.round(n)) : 240;
    });
    const cible = Math.max.apply(null, durs);
    const lignes = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-TARGETDURATION:' + cible, '#EXT-X-MEDIA-SEQUENCE:0', '#EXT-X-PLAYLIST-TYPE:VOD'];
    ids.forEach((id, i) => { lignes.push('#EXTINF:' + durs[i] + '.000,'); lignes.push('/musique/hls/seg/' + id + '.ts?d=' + durs[i]); });
    lignes.push('#EXT-X-ENDLIST');
    res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(lignes.join('\n') + '\n');
    return true;
  }

  const m = /^seg\/([A-Za-z0-9_-]{11})\.ts$/.exec(rel);
  if (m) {
    const id = m[1];
    const d = dossierTs(dataDir);
    const n = Number(url.searchParams.get('d'));
    const duree = Number.isFinite(n) && n >= 5 ? Math.min(3600, Math.round(n)) : 240;
    try {
      const ok = await genererTsProgressif(req, res, id, d, port, ffmpeg);
      if (ok) return true;
      const f = await genererSilence(id, d, ffmpeg, duree);
      servirFichier(req, res, f);
    } catch (e) {
      // L'audio peut être encore en cours de téléchargement : on retente une fois avant de silencer.
      try {
        await new Promise((r) => setTimeout(r, 3000));
        const f = await genererTs(id, d, port, ffmpeg);
        servirFichier(req, res, f);
      } catch (e1) {
        try {
          const f = await genererSilence(id, d, ffmpeg, duree);
          servirFichier(req, res, f);
        } catch (e2) {
          res.writeHead(502, { 'Content-Type': 'text/plain' }).end('segment indisponible');
        }
      }
    }
    return true;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' }).end('hls');
  return true;
}
