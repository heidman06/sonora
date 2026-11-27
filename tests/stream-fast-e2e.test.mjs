import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import net from 'node:net';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUF = Buffer.alloc(4096, 3);
let sidecarHits = 0;
const port = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

test('fast-start e2e : 206 via sidecar sans yt-dlp, HEAD ne résout pas', async () => {
  const audio = http.createServer((req, res) => {
    const r = req.headers.range;
    if (r) {
      const m = r.match(/bytes=(\d*)-(\d*)/);
      const a = m[1] ? parseInt(m[1], 10) : 0;
      const b = m[2] ? parseInt(m[2], 10) : BUF.length - 1;
      res.writeHead(206, { 'Content-Type': 'audio/mp4', 'Content-Range': 'bytes ' + a + '-' + b + '/' + BUF.length, 'Content-Length': b - a + 1 });
      res.end(BUF.slice(a, b + 1));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'audio/mp4', 'Content-Length': BUF.length });
    res.end(BUF);
  });
  await new Promise((r) => audio.listen(0, '127.0.0.1', r));
  const ap = audio.address().port;
  const sidecar = http.createServer((req, res) => {
    sidecarHits += 1;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ url: 'http://127.0.0.1:' + ap + '/audio', mime: 'audio/mp4' }));
  });
  await new Promise((r) => sidecar.listen(0, '127.0.0.1', r));
  const sp2 = sidecar.address().port;
  const data = mkdtempSync(join(tmpdir(), 'sonora-fast-'));
  const sp = await port();
  const proc = spawn(process.execPath, [join(ROOT, 'server', 'index.mjs')], {
    env: Object.assign({}, process.env, {
      SONORA_PORT: String(sp), SONORA_HOST: '127.0.0.1', SONORA_DATA: data,
      SONORA_CACHE_DIR: join(data, 'musique'), SONORA_WEB: join(ROOT, 'web'),
      YTDLP_PATH: '/bin/false', SONORA_RESOLVER_URL: 'http://127.0.0.1:' + sp2,
      SONORA_RESOLVER_ALLOW_INSECURE: '1', SONORA_FAST_ALLOW_INSECURE_UPSTREAM: '1',
    }), stdio: 'ignore',
  });
  try {
    for (let i = 0; i < 60; i++) {
      try { const r = await fetch('http://127.0.0.1:' + sp + '/api/health').catch(() => null); if (r) break; } catch (e) {}
      await new Promise((r) => setTimeout(r, 100));
    }
    const t0 = Date.now();
    const r1 = await fetch('http://127.0.0.1:' + sp + '/musique/dl/abcdefghijk', { headers: { range: 'bytes=0-99' } });
    const b1 = Buffer.from(await r1.arrayBuffer());
    const ms = Date.now() - t0;
    assert.equal(r1.status, 206);
    assert.equal(r1.headers.get('x-sonora-fast'), '1');
    assert.equal(b1.length, 100);
    assert.deepEqual(b1, BUF.slice(0, 100));
    assert.ok(ms < 3000, 'démarrage rapide, mesuré ' + ms + 'ms');
    const avant = sidecarHits;
    const r2 = await fetch('http://127.0.0.1:' + sp + '/musique/dl/abcdefghijk', { method: 'HEAD' });
    assert.equal(r2.status, 200);
    assert.equal(sidecarHits, avant, 'HEAD ne doit pas appeler le sidecar');
  } finally {
    proc.kill(); audio.close(); sidecar.close();
    rmSync(data, { recursive: true, force: true });
  }
});
