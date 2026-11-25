import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = mkdtempSync(join(tmpdir(), 'sonora-gw-'));
async function portLibre() {
  return await new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
}
let HUB = ''; let GW = ''; let hub = null; let gwp = null;
async function ready(u) { for (let i = 0; i < 80; i++) { try { const r = await fetch(u + '/api/mus/health'); if (r.ok) return; } catch (e) {} await new Promise((r) => setTimeout(r, 100)); } throw new Error('not ready ' + u); }
test.before(async () => {
  const p1 = await portLibre(); const p2 = await portLibre();
  HUB = 'http://127.0.0.1:' + p1; GW = 'http://127.0.0.1:' + p2;
  hub = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: Object.assign({}, process.env, { SONORA_HOST: '127.0.0.1', SONORA_PORT: String(p1), SONORA_DATA: DATA, YTDLP_PATH: '/bin/false', PIPED_URL: '' }), stdio: 'ignore' });
  await ready(HUB);
  gwp = spawn(process.execPath, ['server/public-gateway.mjs'], { cwd: ROOT, env: Object.assign({}, process.env, { GATEWAY_PORT: String(p2), GATEWAY_TARGET: HUB }), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 500));
});
test.after(() => { for (const p of [hub, gwp]) if (p) try { p.kill('SIGKILL'); } catch (e) {} try { rmSync(DATA, { recursive: true, force: true }); } catch (e) {} });

test('allowlist : Sonora oui, le reste non', async () => {
  const root = await fetch(GW + '/', { redirect: 'manual' });
  assert.equal(root.status, 302);
  assert.equal(root.headers.get('location'), '/musique/');
  assert.equal((await fetch(GW + '/musique/')).status, 200);
  assert.equal((await fetch(GW + '/api/mus/health')).status, 200);
  assert.equal((await fetch(GW + '/libros')).status, 404);
  assert.equal((await fetch(GW + '/mavie/')).status, 404);
  assert.equal((await fetch(GW + '/package.json')).status, 404);
  assert.equal((await fetch(GW + '/api/mus/likes')).status, 401);
});

test('rate-limit login : 429 apres 10 essais par minute', async () => {
  let vus429 = false;
  for (let i = 0; i < 13; i++) {
    const r = await fetch(GW + '/api/mus/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"username":"x","password":"yyyyyyyy"}' });
    if (r.status === 429) vus429 = true;
  }
  assert.ok(vus429, 'aucun 429');
});
