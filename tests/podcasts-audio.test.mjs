import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = mkdtempSync(join(tmpdir(), 'sonora-poda-'));
process.env.SONORA_DATA = DATA;
const { signerSrc } = await import('../server/podcasts.mjs');
const SMALL = Buffer.alloc(2048, 7); const BIG = Buffer.alloc(200000, 9);
let upPort = 0; let up = null;
async function portLibre() { return await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); }); }
let BASE = ''; let proc = null;
test.before(async () => {
  upPort = await portLibre();
  up = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/stall') { return; }
    const buf = u.pathname === '/big' ? BIG : SMALL;
    const r = req.headers.range;
    if (r) {
      const m = r.match(/bytes=(\d*)-(\d*)/);
      let a = m[1] ? parseInt(m[1], 10) : buf.length - parseInt(m[2], 10);
      let b = m[2] ? parseInt(m[2], 10) : buf.length - 1;
      if (a >= buf.length) { res.writeHead(416, { 'Content-Range': 'bytes */' + buf.length }).end(); return; }
      res.writeHead(206, { 'Content-Type': 'audio/mpeg', 'Content-Range': 'bytes ' + a + '-' + b + '/' + buf.length, 'Content-Length': b - a + 1 });
      res.end(buf.slice(a, b + 1)); return;
    }
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': buf.length });
    res.end(buf);
  });
  await new Promise((r) => up.listen(upPort, '127.0.0.1', r));
  const port = await portLibre(); BASE = 'http://127.0.0.1:' + port;
  proc = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: Object.assign({}, process.env, { SONORA_HOST: '127.0.0.1', SONORA_PORT: String(port), SONORA_DATA: DATA, YTDLP_PATH: '/bin/false', PIPED_URL: '', SONORA_POD_ALLOW_INSECURE_UPSTREAM: '1', SONORA_POD_INACTIVITY_MS: '400', SONORA_POD_CAP_BYTES: '100000' }), stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { try { const r = await fetch(BASE + '/api/mus/health'); if (r.ok) break; } catch (e) {} await new Promise((r) => setTimeout(r, 100)); }
  const d = new DatabaseSync(join(DATA, 'musique.db'));
  d.exec("CREATE TABLE IF NOT EXISTS podcast_episodes (id INTEGER PRIMARY KEY, show_id INTEGER, guid TEXT, title TEXT, description TEXT, pub_date TEXT, duration INTEGER, enclosure_url TEXT, enclosure_type TEXT, unavailable INTEGER DEFAULT 0, added_at INTEGER, UNIQUE(show_id, guid))");
  d.prepare('INSERT INTO podcast_episodes (id, show_id, guid, title, enclosure_url, enclosure_type, added_at) VALUES (1,1,?, ?, ?, ?, 0)').run('g1', 'Small', 'http://127.0.0.1:' + upPort + '/small', 'audio/mpeg');
  d.prepare('INSERT INTO podcast_episodes (id, show_id, guid, title, enclosure_url, enclosure_type, added_at) VALUES (2,1,?, ?, ?, ?, 0)').run('g2', 'Big', 'http://127.0.0.1:' + upPort + '/big', 'audio/mpeg');
  d.prepare('INSERT INTO podcast_episodes (id, show_id, guid, title, enclosure_url, enclosure_type, added_at) VALUES (3,1,?, ?, ?, ?, 0)').run('g3', 'Stall', 'http://127.0.0.1:' + upPort + '/stall', 'audio/mpeg');
  d.close();
});
test.after(() => { if (proc) try { proc.kill('SIGKILL'); } catch (e) {} if (up) up.close(); try { rmSync(DATA, { recursive: true, force: true }); } catch (e) {} });
const src = (id) => BASE + signerSrc(id);
test('403 sig invalide / expiree', async () => {
  assert.equal((await fetch(BASE + '/podcast/ep/1?exp=9999999999999&sig=deadbeef')).status, 403);
  assert.equal((await fetch(BASE + '/podcast/ep/1?exp=1&sig=x')).status, 403);
});
test('200 complet puis cache local + Range/416/suffix/HEAD', async () => {
  const r1 = await fetch(src(1)); assert.equal(r1.status, 200);
  const b1 = Buffer.from(await r1.arrayBuffer()); assert.equal(b1.length, SMALL.length);
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(existsSync(join(DATA, 'podcasts', '1.bin.ok')));
  const r2 = await fetch(src(1), { headers: { Range: 'bytes=0-3' } }); assert.equal(r2.status, 206);
  assert.equal((Buffer.from(await r2.arrayBuffer())).length, 4);
  const r3 = await fetch(src(1), { headers: { Range: 'bytes=-4' } }); assert.equal(r3.status, 206);
  const r4 = await fetch(src(1), { headers: { Range: 'bytes=99999-' } }); assert.equal(r4.status, 416);
  const r5 = await fetch(src(1), { method: 'HEAD' }); assert.equal(r5.status, 200);
});
test('cap depasse -> 502', async () => {
  const r = await fetch(src(2)); assert.equal(r.status, 502);
});
test('inactivite amont -> 502', async () => {
  const r = await fetch(src(3)); assert.equal(r.status, 502);
});
