import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
process.env.SONORA_DATA = mkdtempSync(join(tmpdir(), 'sonora-mixwarm-'));
process.env.YTDLP_PATH = '/bin/false';
process.env.PIPED_URL = '';
process.env.SONORA_MIX_WARM = '1';
const mus = await import('../server/musique.mjs');
const d = mus.ouvrirBase();
function req(method, route, body, token) { const r = Readable.from([JSON.stringify(body || {})]); r.method = method; r.headers = token ? { authorization: 'Bearer ' + token } : {}; return r; }
function res() { return { code: 0, body: null, writeHead(c) { this.code = c; }, end(s) { this.body = JSON.parse(s); } }; }
async function call(method, route, body, token) { const r = res(); mus.handleMusique(req(method, route, body, token), r, '/api/mus' + route.split('?')[0], new URL('http://x/api/mus' + route)); for (let i = 0; i < 80 && r.body === null; i++) await new Promise((x) => setTimeout(x, 10)); return r; }
const reg = await call('POST', '/register', { username: 'warm', password: 'motdepasse123' });
const u = mus.identifiants('warm', 'motdepasse123').id;
for (let i = 0; i < 12; i++) d.prepare('INSERT OR IGNORE INTO likes (user_id, video_id, title, artist) VALUES (?, ?, ?, ?)').run(u, ('WK' + String(i).padStart(9, '0')).slice(0, 11), 'montagem phonk ' + i, 'Kordhell');
test('warm: anti-rebond 2 GET => 1 job, cooldown', async () => {
  const a = await call('GET', '/mixes2', null, reg.body.token);
  assert.equal(a.code, 200);
  await new Promise((x) => setTimeout(x, 300));
  const b = await call('GET', '/mixes2', null, reg.body.token);
  assert.equal(b.code, 200);
  await new Promise((x) => setTimeout(x, 300));
  assert.equal(mus.internals.warmLances, 1, 'warmLances=' + mus.internals.warmLances);
  assert.ok(mus.internals.ytActifs <= 2);
});
test('nettoyage', () => mus.fermerBase());