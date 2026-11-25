import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = mkdtempSync(join(tmpdir(), 'sonora-podgw-'));
async function portLibre() { return await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); }); }
let HUB = ''; let GW = ''; let hub = null; let gwp = null;
test.before(async () => {
  const p1 = await portLibre(); const p2 = await portLibre();
  HUB = 'http://127.0.0.1:' + p1; GW = 'http://127.0.0.1:' + p2;
  hub = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: Object.assign({}, process.env, { SONORA_HOST: '127.0.0.1', SONORA_PORT: String(p1), SONORA_DATA: DATA, YTDLP_PATH: '/bin/false', PIPED_URL: '' }), stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { try { const r = await fetch(HUB + '/api/mus/health'); if (r.ok) break; } catch (e) {} await new Promise((r) => setTimeout(r, 100)); }
  gwp = spawn(process.execPath, ['server/public-gateway.mjs'], { cwd: ROOT, env: Object.assign({}, process.env, { GATEWAY_PORT: String(p2), GATEWAY_TARGET: HUB }), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 500));
});
test.after(() => { for (const p of [hub, gwp]) if (p) try { p.kill('SIGKILL'); } catch (e) {} try { rmSync(DATA, { recursive: true, force: true }); } catch (e) {} });
test('allowlist pod : 401 sans token, 403 sig, 404 hors allowlist', async () => {
  assert.equal((await fetch(GW + '/api/pod/subs')).status, 401);
  assert.equal((await fetch(GW + '/podcast/ep/1?exp=9999999999999&sig=x')).status, 403);
  assert.equal((await fetch(GW + '/api/podx/subs')).status, 404);
});
test('rate-limit /podcast/ep/ -> 429', async () => {
  let vus = false;
  for (let i = 0; i < 125; i++) { const r = await fetch(GW + '/podcast/ep/1?exp=9999999999999&sig=x'); if (r.status === 429) vus = true; }
  assert.ok(vus);
});
