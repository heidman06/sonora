#!/usr/bin/env node
// Sonora - alertes ntfy (timer 5 min). Dédup 6 h/clé + « rétabli » unique.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const DATA = process.env.SONORA_DATA || join(process.env.HOME || '/tmp', 'sonora', 'data');
const CACHE = process.env.SONORA_CACHE_DIR || join(DATA, 'musique');
const MAX = Number(process.env.SONORA_CACHE_MAX_BYTES || 2 * 1024 * 1024 * 1024);
const NTFY = process.env.SONORA_NTFY || 'http://127.0.0.1:2586/sonora';
const ETAT = join(DATA, 'alertes-etat.json');
const COOLDOWN = 6 * 3600 * 1000;

function lireEtat() { try { return JSON.parse(readFileSync(ETAT, 'utf8')); } catch { return {}; } }
function ecrireEtat(e) { try { writeFileSync(ETAT, JSON.stringify(e)); } catch (err) { console.log('[alertes] etat', err.message); } }
async function poster(cle, titre, corps, priority) {
  const e = lireEtat();
  const now = Date.now();
  const dernier = e[cle] || 0;
  if (dernier && now - dernier < COOLDOWN) return false;
  try {
    await fetch(NTFY, { method: 'POST', headers: { Title: titre.replace(/[^\x20-\x7E]/g, '-'), Priority: priority || 'default', Tags: 'musical_note' }, body: corps, signal: AbortSignal.timeout(8000) });
    e[cle] = now; ecrireEtat(e); return true;
  } catch (err) { console.log('[alertes] ntfy injoignable', err.message); return false; }
}
async function retabli(cle, titre) {
  const e = lireEtat();
  if (!e[cle]) return;
  delete e[cle]; ecrireEtat(e);
  try { await fetch(NTFY, { method: 'POST', headers: { Title: (titre + ' - retabli').replace(/[^\x20-\x7E]/g, '-'), Tags: 'white_check_mark' }, body: 'Retour a la normale.', signal: AbortSignal.timeout(8000) }); } catch {}
}

function smokeEtat() {
  try {
    const out = execFileSync('systemctl', ['show', '-p', 'ExecMainStatus', '-p', 'Result', 'heid-sonora-smoke.service'], { encoding: 'utf8' }).split(String.fromCharCode(10));
    const trig = execFileSync('systemctl', ['show', '-p', 'LastTriggerUSec', 'heid-sonora-smoke.timer'], { encoding: 'utf8' });
    const get = (k) => { const line = out.find((l) => l.indexOf(k + '=') === 0); return line ? line.slice(k.length + 1) : ''; };
    const status = get('ExecMainStatus'), result = get('Result'), started = trig;
    const m = started.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
    const ts = m ? Date.parse(m[1]) : NaN;
    const perime = !Number.isFinite(ts) || Date.now() - ts > 30 * 60 * 1000;
    return { ko: result !== 'success' || status !== '0' || perime, detail: 'result=' + result + ' status=' + status + ' age=' + (Number.isFinite(ts) ? Math.round((Date.now() - ts) / 60000) + 'min' : 'jamais') };
  } catch (e) { return { ko: true, detail: 'systemctl indisponible' }; }
}
async function sondeHttp() {
  try {
    const a = await fetch('http://127.0.0.1:3011/api/mus/health', { signal: AbortSignal.timeout(5000) });
    const b = await fetch('http://127.0.0.1:3011/musique/', { signal: AbortSignal.timeout(5000) });
    const html = await b.text();
    return a.ok && b.ok && html.includes('assets/index-');
  } catch { return false; }
}
function cachePct() {
  try {
    let total = 0;
    for (const n of readdirSync(CACHE)) { if (n.endsWith('.m4a')) { try { total += statSync(join(CACHE, n)).size; } catch {} } }
    return total / MAX;
  } catch { return 0; }
}
function echecsRecents() {
  try {
    const db = new DatabaseSync(join(DATA, 'musique.db'), { readOnly: true });
    const rows = db.prepare("SELECT video_id FROM history WHERE at >= datetime('now', '-30 minutes') ORDER BY id DESC LIMIT 12").all();
    db.close();
    let manque = 0;
    for (const r of rows) { if (!existsSync(join(CACHE, r.video_id + '.m4a'))) manque++; }
    return manque;
  } catch { return 0; }
}
function sondeCookies() {
  return new Promise((res) => {
    let id = '';
    try { id = readdirSync(CACHE).find((n) => n.endsWith('.ok'))?.replace(/\.ok$/, '') || ''; } catch {}
    if (!id) return res(true);
    const p = spawn('/usr/bin/yt-dlp', ['--cookies', join(DATA, 'yt-cookies.txt'), '--js-runtimes', 'node:/usr/local/bin/heid-node', '--remote-components', 'ejs:github', '--simulate', '-f', '140', '--no-warnings', 'https://www.youtube.com/watch?v=' + id], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (c) => { err += c.toString(); });
    const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch {} res(false); }, 20000);
    p.on('close', (code) => { clearTimeout(t); res(code === 0 && !/Sign in|403|cookies/i.test(err)); });
    p.on('error', () => { clearTimeout(t); res(false); });
  });
}

const smoke = smokeEtat();
const httpOk = await sondeHttp();
const pct = cachePct();
const manque = echecsRecents();
if (smoke.ko || !httpOk) {
  await poster('smoke', 'Sonora — smoke/HTTP en échec', smoke.detail + ' ; http=' + httpOk, 'high');
} else {
  await retabli('smoke', 'Sonora — smoke/HTTP');
}
if (pct > 0.9) {
  await poster('cache', 'Sonora — cache audio saturé', 'cache ' + (pct * MAX / 1e9).toFixed(2) + '/' + (MAX / 1e9).toFixed(2) + ' Go (' + Math.round(pct * 100) + ' %) — vérifier l’élagage', 'default');
} else {
  await retabli('cache', 'Sonora — cache audio');
}
if (smoke.ko || manque >= 3) {
  const cookiesOk = await sondeCookies();
  if (!cookiesOk) await poster('cookies', 'Sonora — cookies YouTube expirés', 'yt-dlp échoue (403/Sign in). Rafraîchir data/yt-cookies.txt (export navigateur Netscape).', 'high');
  else await retabli('cookies', 'Sonora — cookies YouTube');
} else {
  await retabli('cookies', 'Sonora — cookies YouTube');
}
console.log('[alertes] smoke=' + !smoke.ko + ' http=' + httpOk + ' cache=' + Math.round(pct * 100) + '% manques=' + manque);