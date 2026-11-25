import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = mkdtempSync(join(tmpdir(), 'sonora-sec-'));
async function portLibre() {
  return await new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
}
let BASE = ''; let proc = null;
async function attendre() {
  for (let i = 0; i < 80; i++) { try { const r = await fetch(BASE + '/api/mus/health'); if (r.ok) return; } catch (e) {} await new Promise((r) => setTimeout(r, 100)); }
  throw new Error('server not ready');
}
async function api(path, opts) {
  const o = Object.assign({}, opts || {});
  o.headers = Object.assign({}, o.headers || {});
  if (o.body && typeof o.body !== 'string') { o.body = JSON.stringify(o.body); o.headers['Content-Type'] = 'application/json'; }
  return fetch(BASE + path, o).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
}
test.before(async () => {
  const port = await portLibre();
  BASE = 'http://127.0.0.1:' + port;
  proc = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: Object.assign({}, process.env, { SONORA_HOST: '127.0.0.1', SONORA_PORT: String(port), SONORA_DATA: DATA, YTDLP_PATH: '/bin/false', PIPED_URL: '', SONORA_SIGNUP_CODE: 's3cret' }), stdio: 'ignore' });
  await attendre();
});
test.after(() => { if (proc) try { proc.kill('SIGKILL'); } catch (e) {} try { rmSync(DATA, { recursive: true, force: true }); } catch (e) {} });

test('register exige le code invitation', async () => {
  const sans = await api('/api/mus/register', { method: 'POST', body: { username: 'secuser', password: 'motdepasse123' } });
  assert.equal(sans.status, 403);
  const faux = await api('/api/mus/register', { method: 'POST', body: { username: 'secuser', password: 'motdepasse123', code: 'nope' } });
  assert.equal(faux.status, 403);
  const bon = await api('/api/mus/register', { method: 'POST', body: { username: 'secuser', password: 'motdepasse123', code: 's3cret' } });
  assert.equal(bon.status, 200);
  assert.ok(bon.body.token);
});

test('piped exige une session', async () => {
  const sans = await api('/api/piped/search?q=test');
  assert.equal(sans.status, 401);
  const login = await api('/api/mus/login', { method: 'POST', body: { username: 'secuser', password: 'motdepasse123' } });
  assert.equal(login.status, 200);
  const avec = await fetch(BASE + '/api/piped/search?q=test', { headers: { Authorization: 'Bearer ' + login.body.token } });
  assert.ok([200, 502, 503].includes(avec.status), 'status=' + avec.status);
});

test('health reste public et headers de securite', async () => {
  const r = await fetch(BASE + '/api/mus/health');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
});
