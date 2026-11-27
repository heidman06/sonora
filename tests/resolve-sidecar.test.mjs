import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

let srv, hits = 0, mode = 'ok';
test.before(async () => {
  srv = http.createServer((req, res) => {
    hits += 1;
    if (mode === 'down') { res.writeHead(502).end('{}'); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ url: 'https://rr1---sn-test.googlevideo.com/videoplayback?x=1', mime: 'audio/mp4' }));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  process.env.SONORA_RESOLVER_URL = 'http://127.0.0.1:' + srv.address().port;
  process.env.YTDLP_PATH = '/bin/false';
});
test.after(() => { try { srv.close(); } catch (e) {} });

test('resoudreRapide utilise le sidecar puis cache', async () => {
  const mod = await import('../server/resolve-url.mjs?t=' + Date.now());
  const a = await mod.resoudreRapide('abcdefghijk');
  assert.match(a.url, /googlevideo/);
  const avant = hits;
  const b = await mod.resoudreRapide('abcdefghijk');
  assert.equal(b.url, a.url);
  assert.equal(hits, avant);
});

test('sidecar HS -> null (repli)', async () => {
  mode = 'down';
  const mod = await import('../server/resolve-url.mjs?d=' + Date.now());
  assert.equal(await mod.resoudreRapide('zyxwvutsrqp'), null);
});
