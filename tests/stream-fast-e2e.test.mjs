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
let pipedHits = 0;

const port = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

test('fast-start e2e : 206 sans yt-dlp, HEAD ne touche pas Piped', async () => {
  const audio = http.createServer((req, res) => {
    const r = req.headers.range;
    if (r) {
      const m = r.match(/bytes=(\d*)-(\d*)/);
      let a = m[1] ? parseInt(m[1], 10) : 0;
      let b = m[2] ? parseInt(m[2], 10) : BUF.length - 1;
      res.writeHead(206, { 'Content-Type': 'audio/mp4', 'Content-Range': 'bytes ' + a + '-' + b + '/' + BUF.length, 'Content-Length': b - a + 1 });
      res.end(BUF.slice(a, b + 1));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'audio/mp4', 'Content-Length': BUF.length });
    res.end(BUF);
  });
  await new Promise((r) => audio.listen(0, '127.0.0.1', r));
  const ap = audio.address().port;
  const piped = http.createServer((req, res) => {
    pipedHits += 1;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ audioStreams: [{ url: 'http://127.0.0.1:' + ap + '/audio', mimeType: 'audio/mp4', bitrate: 128000, itag: 140 }] }));
  });
  await new Promise((r) => piped.listen(0, '127.0.0.1', r));
  const pp = piped.address().port;
  const data = mkdtempSync(join(tmpdir(), 'sonora-fast-'));
  const sp = await port();
  const proc = spawn(process.execPath, [join(ROOT, 'server', 'index.mjs')], {
    env: Object.assign({}, process.env, {
      SONORA_PORT: String(sp), SONORA_HOST: '127.0.0.1', SONORA_DATA: data,
      SONORA_CACHE_DIR: join(data, 'musique'), SONORA_WEB: join(ROOT, 'web'),
      YTDLP_PATH: '/bin/false', PIPED_INTERNAL_URL: 'http://127.0.0.1:' + pp,
      SONORA_FAST_ALLOW_INSECURE_UPSTREAM: '1', SONORA_FAST: '1',
    }), stdio: 'ignore',
  });
  try {
    for (let i = 0; i < 60; i++) {
      try { const r = await fetch('http://127.0.0.1:' + sp + '/api/health').catch(() => null); if (r) break; } catch (e) {}
      await new Promise((r) => setTimeout(r, 100));
    }
    const attendre = async () => { for (let i = 0; i < 50; i++) { try { const r = await fetch('http://127.0.0.1:' + sp + '/musique/dl/abcdefghijk', { method: 'HEAD' }); if (r) return r; } catch (e) {} await new Promise((r) => setTimeout(r, 100)); } return null; };
    await attendre();
    const t0 = Date.now();
    const r1 = await fetch('http://127.0.0.1:' + sp + '/musique/dl/abcdefghijk', { headers: { range: 'bytes=0-99' } });
    const b1 = Buffer.from(await r1.arrayBuffer());
    const ms = Date.now() - t0;
    assert.equal(r1.status, 206);
    assert.equal(r1.headers.get('x-sonora-fast'), '1');
    assert.equal(b1.length, 100);
    assert.deepEqual(b1, BUF.slice(0, 100));
    assert.ok(ms < 3000, 'démarrage rapide, mesuré ' + ms + 'ms');

    const avant = pipedHits;
    const r2 = await fetch('http://127.0.0.1:' + sp + '/musique/dl/abcdefghijk', { method: 'HEAD' });
    assert.equal(r2.status, 200);
    assert.equal(pipedHits, avant, 'HEAD ne doit pas appeler Piped');
  } finally {
    proc.kill();
    audio.close(); piped.close();
    rmSync(data, { recursive: true, force: true });
  }
});