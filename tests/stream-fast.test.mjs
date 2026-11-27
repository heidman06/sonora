import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const BUF = Buffer.alloc(2048, 7);
let audioSrv, pipedSrv, ap, pp, pipedHits = 0;

function ecoute(server) { return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server.address().port))); }

test.before(async () => {
  audioSrv = http.createServer((req, res) => {
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
  ap = await ecoute(audioSrv);
  pipedSrv = http.createServer((req, res) => {
    pipedHits += 1;
    if (req.url.includes('fail')) { res.writeHead(500).end('nope'); return; }
    if (req.url.includes('evil')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ audioStreams: [{ url: 'http://evil.example/x', mimeType: 'audio/mp4', bitrate: 128000 }] }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ audioStreams: [
      { url: 'http://127.0.0.1:' + ap + '/opus', mimeType: 'audio/webm', bitrate: 160000, itag: 251 },
      { url: 'http://127.0.0.1:' + ap + '/audio', mimeType: 'audio/mp4', bitrate: 128000, itag: 140 },
    ] }));
  });
  pp = await ecoute(pipedSrv);
  process.env.PIPED_INTERNAL_URL = 'http://127.0.0.1:' + pp;
  process.env.SONORA_FAST_ALLOW_INSECURE_UPSTREAM = '1';
  process.env.SONORA_FAST = '1';
});

test.after(() => { try { audioSrv.close(); } catch (e) {} try { pipedSrv.close(); } catch (e) {} });

test('résolution : m4a choisi (pas opus), puis cache', async () => {
  const { resoudreRapide } = await import('../server/stream-fast.mjs?t=' + Date.now());
  const a = await resoudreRapide('abcdefghijk');
  assert.equal(a.mime, 'audio/mp4');
  assert.match(a.url, /\/audio$/);
  const avant = pipedHits;
  const b = await resoudreRapide('abcdefghijk');
  assert.equal(b.url, a.url);
  assert.equal(pipedHits, avant);
});

test('proxy : 206 + Range exact', async () => {
  const mod = await import('../server/stream-fast.mjs?p=' + Date.now());
  const src = await mod.resoudreRapide('abcdefghijk');
  const proxy = http.createServer((req, res) => { mod.proxyRapide(req, res, src, 'abcdefghijk'); });
  const p = await ecoute(proxy);
  try {
    const out = await new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: p, path: '/f', headers: { range: 'bytes=10-19' } }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), cr: res.headers['content-range'] }));
      }).on('error', reject);
    });
    assert.equal(out.status, 206);
    assert.equal(out.body.length, 10);
    assert.match(out.cr, /bytes 10-19\/2048/);
    assert.deepEqual(out.body, BUF.slice(10, 20));
  } finally { proxy.close(); }
});

test('piped en échec → null (fallback)', async () => {
  process.env.PIPED_INTERNAL_URL = 'http://127.0.0.1:' + pp;
  const mod = await import('../server/stream-fast.mjs?f=' + Date.now());
  assert.equal(await mod.resoudreRapide('failabcdef'), null);
});

test('SSRF : URL non-googlevideo rejetée', async () => {
  process.env.PIPED_INTERNAL_URL = 'http://127.0.0.1:' + pp;
  const mod = await import('../server/stream-fast.mjs?s=' + Date.now());
  assert.equal(await mod.resoudreRapide('evilabcdef'), null);
});
