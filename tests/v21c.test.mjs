import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DATA = mkdtempSync(join(tmpdir(), 'sonora-v21c-'));
process.env.SONORA_DATA = DATA;
process.env.PIPED_URL = '';
process.env.YTDLP_PATH = '/bin/false';
const mus = await import('../server/musique.mjs');
const res = await import('../server/musique-resolve.mjs');

test('resolver: insertion dans l ordre des pending.id malgré achèvements désordonnés', async () => {
  const inserted = [];
  const rows = [{ id: 1, playlist_id: 7, title: 'a', artist: 'A' }, { id: 2, playlist_id: 7, title: 'b', artist: 'B' }, { id: 3, playlist_id: 7, title: 'c', artist: 'C' }];
  const delays = { a: 30, b: 5, c: 15 };
  const deps = {
    resoudre: (title) => new Promise((r) => setTimeout(() => r({ video_id: 'vid' + title.padStart(8, '0'), title, artist: 'X' }), delays[title])),
    insPiste: { run: (pid, vid) => inserted.push(vid) },
    insLike: { run: () => {} },
    del: { run: () => {} },
  };
  const r = await res.resoudreTranche(rows, deps);
  assert.equal(r.ok, 3);
  assert.deepEqual(inserted, ['vidaaaaaaa', 'vidbbbbbbb', 'vidccccccc'].map((s, i) => 'vid' + ['a', 'b', 'c'][i].padStart(8, '0')));
});

test('statsPour: NULLIF + invalidation du cache après pousseHistory', () => {
  const d = mus.ouvrirBase();
  d.prepare('INSERT INTO users (username, display, pass) VALUES (?, ?, ?)').run('u1', 'u1', 'x:y');
  const uid = d.prepare('SELECT id FROM users WHERE username = ?').get('u1').id;
  d.prepare('INSERT INTO track_meta (video_id, duration) VALUES (?, ?)').run('meta0000001', 240);
  mus.pousseHistory(d, uid, 'meta0000001', 'h', 'a', 0);
  const s1 = mus.statsPour(d, uid, 6);
  assert.equal(Math.round(s1.totals.minutes), 4, '0 résiduel retombe sur track_meta via statsPour');
  assert.equal(s1.totals.plays, 1);
  mus.pousseHistory(d, uid, 'autre000001', 'h2', 'a', 120);
  const s2 = mus.statsPour(d, uid, 6);
  assert.equal(s2.totals.plays, 2, 'cache invalidé par pousseHistory');
  assert.equal(Math.round(s2.totals.minutes), 6);
  mus.fermerBase();
});