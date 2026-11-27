import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, chmodSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'sonora-resolve-'));
const bon = join(dir, 'yt-good.sh');
writeFileSync(bon, '#!/bin/sh\necho "https://rr1---sn-abc.googlevideo.com/videoplayback?x=1"\n');
chmodSync(bon, 0o755);
const mauvais = join(dir, 'yt-bad.sh');
writeFileSync(mauvais, '#!/bin/sh\necho "https://evil.example/x"\n');
chmodSync(mauvais, 0o755);
process.env.SONORA_COOKIES = join(dir, 'cookies.txt');

test('resoudre accepte googlevideo et met en cache', { skip: process.platform === 'win32' }, async () => {
  process.env.YTDLP_PATH = bon;
  const mod = await import('../server/resolve-url.mjs?g=' + Date.now());
  const a = await mod.resoudre('abcdefghijk');
  assert.match(a.url, /googlevideo\.com/);
  const b = await mod.resoudre('abcdefghijk');
  assert.equal(b.url, a.url);
  assert.ok(mod.urlCachee('abcdefghijk'));
});

test('resoudre rejette un hôte non googlevideo', { skip: process.platform === 'win32' }, async () => {
  process.env.YTDLP_PATH = mauvais;
  const mod = await import('../server/resolve-url.mjs?b=' + Date.now());
  assert.equal(await mod.resoudre('abcdefghijk'), null);
  assert.equal(mod.urlCachee('abcdefghijk'), null);
});