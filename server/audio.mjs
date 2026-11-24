// Sonora — serveur audio autonome : yt-dlp + cache m4a + Range 206
// Extrait de dashboard/server.mjs, configurable par variables d'environnement.
import {
  createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync,
  statSync, unlinkSync, writeFileSync, openSync, readSync, closeSync, renameSync,
} from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const config = {
  dataDir: process.env.SONORA_DATA || join(__dirname, '..', 'data'),
  cacheDir: process.env.SONORA_CACHE_DIR || '',
  cookies: process.env.SONORA_COOKIES || '',
  ytdlp: process.env.YTDLP_PATH || '/usr/bin/yt-dlp',
  ffmpeg: process.env.FFMPEG_PATH || 'ffmpeg',
  nodeBin: process.env.SONORA_NODE_BIN || '/usr/local/bin/heid-node',
  ejs: process.env.SONORA_EJS || 'ejs:github',
  cacheMax: Number(process.env.SONORA_CACHE_MAX_BYTES || 2 * 1024 * 1024 * 1024),
};
config.cacheDir = config.cacheDir || join(config.dataDir, 'musique');
config.cookies = config.cookies || join(config.dataDir, 'yt-cookies.txt');

const telechargementsEnCours = new Map();
const CACHE_MAX = config.cacheMax;
let dernierElagage = 0;

function ytdlpArgs(extra) {
  return ['--cookies', config.cookies, '--js-runtimes', 'node:' + config.nodeBin,
    '--remote-components', config.ejs, '--no-warnings'].concat(extra);
}

function finaliser(src, dest, apres) {
  const renommer = () => { try { renameSync(src, dest); } catch (e) {} apres(); };
  try {
    const fd = openSync(src, 'r');
    const buf = Buffer.alloc(2048);
    readSync(fd, buf, 0, 2048, 0);
    closeSync(fd);
    if (buf.includes(Buffer.from('moov'))) { renommer(); return; }
  } catch (e) { renommer(); return; }
  const ff = spawn(config.ffmpeg, ['-y', '-loglevel', 'error', '-i', src, '-c', 'copy', '-movflags', '+faststart', dest], { stdio: 'ignore' });
  ff.on('error', renommer);
  ff.on('close', (code) => {
    if (code !== 0) { try { renameSync(src, dest); } catch (e) {} }
    try { unlinkSync(src); } catch (e) {}
    apres();
  });
}

function elaguerCache(dossier) {
  if (Date.now() - dernierElagage < 5 * 60 * 1000) return;
  dernierElagage = Date.now();
  try {
    const infos = [];
    let total = 0;
    for (const n of readdirSync(dossier)) {
      if (!n.endsWith('.m4a')) continue;
      try {
        const st = statSync(join(dossier, n));
        total += st.size;
        infos.push({ n, t: st.mtimeMs, s: st.size });
      } catch (e) {}
    }
    if (total <= CACHE_MAX) return;
    infos.sort((a, b) => a.t - b.t);
    for (const f of infos) {
      if (total <= CACHE_MAX * 0.9) break;
      try {
        unlinkSync(join(dossier, f.n));
        try { unlinkSync(join(dossier, f.n.replace(/\.m4a$/, '.ok'))); } catch (e) {}
        total -= f.s;
      } catch (e) {}
    }
  } catch (e) {}
}

function lancerTelechargement(id, dossier) {
  if (telechargementsEnCours.has(id)) return telechargementsEnCours.get(id);
  const dest = join(dossier, id + '.m4a');
  const part = dest + '.part';
  const url = 'https://www.youtube.com/watch?v=' + id;
  const commun = ['--cookies', config.cookies, '-f', '140/bestaudio[ext=m4a]', '--no-playlist', '--concurrent-fragments', '4', '--no-warnings'];
  const args = commun.concat(['-o', part, url]);
  const complet = ytdlpArgs(['-f', '140/bestaudio[ext=m4a]', '--no-playlist', '--concurrent-fragments', '4', '-o', part, url]);
  const promesse = new Promise((res) => {
    const lancer = (a) => {
      const proc = spawn(config.ytdlp, a, { stdio: 'ignore' });
      const minuteur = setTimeout(() => { try { proc.kill('SIGKILL'); } catch (e) {} }, 120000);
      proc.on('close', (code) => {
        clearTimeout(minuteur);
        try {
          if (code !== 0) {
            try { unlinkSync(part); } catch (e) {}
            if (a === args) { lancer(complet); return; }
          }
          const t = statSync(part).size;
          if (code === 0 && t > 200000) {
            finaliser(part, dest, () => {
              try { writeFileSync(join(dossier, id + '.ok'), String(statSync(dest).size)); } catch (e) {}
              elaguerCache(dossier);
              telechargementsEnCours.delete(id);
              res(dest);
            });
            return;
          }
          try { unlinkSync(part); } catch (e) {}
        } catch (e) {}
        telechargementsEnCours.delete(id);
        res(null);
      });
      proc.on('error', () => { clearTimeout(minuteur); telechargementsEnCours.delete(id); res(null); });
    };
    lancer(args);
  });
  telechargementsEnCours.set(id, promesse);
  return promesse;
}

function cacheValide(dossier, id) {
  const marque = join(dossier, id + '.ok');
  const liste = readdirSync(dossier).filter((n) => n.startsWith(id + '.') && !n.endsWith('.part') && !n.endsWith('.ok'));
  if (!existsSync(marque)) { for (const n of liste) { try { unlinkSync(join(dossier, n)); } catch (e) {} } return []; }
  return liste;
}

function servirFichier(req, res, fichier) {
  const taille = statSync(fichier).size;
  const type = extname(fichier) === '.webm' ? 'audio/webm' : 'audio/mp4';
  const portee = req.headers.range;
  if (portee && /^bytes=\d*-\d*$/.test(portee)) {
    const [a, b] = portee.replace('bytes=', '').split('-');
    const debut = a ? parseInt(a, 10) : Math.max(0, taille - (parseInt(b, 10) || 0));
    const fin = b ? Math.min(parseInt(b, 10), taille - 1) : taille - 1;
    if (!Number.isFinite(debut) || !Number.isFinite(fin) || debut < 0 || fin < debut || debut >= taille) {
      res.writeHead(416, { 'Content-Range': 'bytes */' + taille, 'Accept-Ranges': 'bytes' }).end();
      return;
    }
    res.writeHead(206, {
      'Content-Type': type, 'Content-Range': 'bytes ' + debut + '-' + fin + '/' + taille,
      'Accept-Ranges': 'bytes', 'Content-Length': fin - debut + 1, 'Cache-Control': 'public, max-age=86400',
    });
    createReadStream(fichier, { start: debut, end: fin }).on('error', () => { try { res.destroy(); } catch (e) {} }).pipe(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': taille, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400' });
  createReadStream(fichier).on('error', () => { try { res.destroy(); } catch (e) {} }).pipe(res);
}

// Retourne true si la requête a été traitée.
export async function handleAudio(req, res, path) {
  if (!path.startsWith('/musique/dl/')) return false;
  const id = path.slice('/musique/dl/'.length).split('/')[0];
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' }).end('id invalide');
    return true;
  }
  const dossier = config.cacheDir;
  mkdirSync(dossier, { recursive: true });
  let fichiers = cacheValide(dossier, id);

  if (!fichiers.length && req.method !== 'HEAD') {
    await Promise.race([lancerTelechargement(id, dossier), new Promise((r) => setTimeout(r, 75000))]);
    fichiers = cacheValide(dossier, id);
  }
  if (fichiers.length) { servirFichier(req, res, join(dossier, fichiers[0])); return true; }
  if (req.method === 'HEAD') {
    // préchauffage silencieux
    const dest = join(dossier, id + '.m4a');
    const proc = spawn(config.ytdlp, ytdlpArgs(['-f', '140/bestaudio[ext=m4a]', '--no-playlist', '-o', dest + '.part', 'https://www.youtube.com/watch?v=' + id]), { stdio: 'ignore', detached: true });
    proc.on('close', () => {
      try {
        const t = statSync(dest + '.part').size;
        if (t > 200000 && proc.exitCode === 0) {
          finaliser(dest + '.part', dest, () => {
            try { writeFileSync(join(dossier, id + '.ok'), String(statSync(dest).size)); } catch (e) {}
            elaguerCache(dossier);
          });
        } else { try { unlinkSync(dest + '.part'); } catch (e) {} }
      } catch (e) {}
    });
    proc.on('error', () => {});
    proc.unref();
    res.writeHead(200, { 'Content-Type': 'audio/mp4', 'Cache-Control': 'no-store' }).end();
    return true;
  }

  // attente d'un téléchargement déjà en cours
  const attente = telechargementsEnCours.get(id);
  if (attente) {
    await Promise.race([attente, new Promise((r) => setTimeout(r, 90000))]);
    fichiers = cacheValide(dossier, id);
    if (fichiers.length) { servirFichier(req, res, join(dossier, fichiers[0])); return true; }
  }

  // streaming progressif : on relaie les octets pendant le téléchargement
  const tmp = join(dossier, id + '.m4a.part');
  const args = ['--cookies', config.cookies, '--js-runtimes', 'node:' + config.nodeBin, '--remote-components', config.ejs, '-f', '140/bestaudio[ext=m4a]', '--no-playlist'];
  const proc = spawn(config.ytdlp, args.concat(['-o', '-', 'https://www.youtube.com/watch?v=' + id]), { stdio: ['ignore', 'pipe', 'ignore'] });
  const disque = createWriteStream(tmp);
  let entete = false, octets = 0, coupe = false;
  const minuteur = setTimeout(() => { try { proc.kill('SIGKILL'); } catch (e) {} }, 180000);
  let resoudreDl;
  telechargementsEnCours.set(id, new Promise((r) => { resoudreDl = r; }));
  const terminer = () => {
    try { telechargementsEnCours.delete(id); } catch (e) {}
    if (resoudreDl) { try { resoudreDl(); } catch (e) {} }
    clearTimeout(minuteur);
    const complet = !coupe && proc.exitCode === 0;
    disque.end(() => {
      try {
        if (complet && octets > 200000) {
          finaliser(tmp, join(dossier, id + '.m4a'), () => {
            try { writeFileSync(join(dossier, id + '.ok'), String(statSync(join(dossier, id + '.m4a')).size)); } catch (e) {}
            elaguerCache(dossier);
          });
        } else { try { unlinkSync(tmp); } catch (e) {} }
      } catch (e) {}
    });
    if (!entete) { try { res.writeHead(502, { 'Content-Type': 'text/plain' }).end('audio indisponible'); } catch (e) {} }
    else if (!res.writableEnded) { try { res.end(); } catch (e) {} }
  };
  res.on('close', () => { coupe = true; try { proc.kill('SIGKILL'); } catch (e) {} });
  proc.stdout.on('data', (c) => {
    if (!entete) { res.writeHead(200, { 'Content-Type': 'audio/mp4', 'Cache-Control': 'no-store' }); entete = true; }
    if (!coupe) res.write(c);
    octets += c.length;
    if (!disque.writableEnded) disque.write(c);
  });
  proc.on('close', terminer);
  proc.on('error', terminer);
  return true;
}
