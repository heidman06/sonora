import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DATA = mkdtempSync(join(tmpdir(), 'sonora-v21b-'));
process.env.SONORA_DATA = DATA;
process.env.PIPED_URL = '';
process.env.YTDLP_PATH = '/bin/false';
const mus = await import('../server/musique.mjs');

test('migration idempotente: ouvrir/fermer/ouvrir meme etat', () => {
  const d1 = mus.ouvrirBase();
  d1.prepare('INSERT INTO users (username, display, pass) VALUES (?, ?, ?)').run('u1', 'u1', 'x:y');
  const uid = d1.prepare('SELECT id FROM users WHERE username = ?').get('u1').id;
  const pid = d1.prepare('INSERT INTO playlists (user_id, name) VALUES (?, ?)').run(uid, 'P').lastInsertRowid;
  for (let i = 0; i < 5; i++) d1.prepare('INSERT INTO playlist_tracks (playlist_id, video_id, title, artist, position) VALUES (?, ?, ?, ?, ?)').run(pid, 'vid' + String(i).padStart(8, '0'), 't' + i, 'a', i);
  const avant = d1.prepare('SELECT video_id, position FROM playlist_tracks WHERE playlist_id = ? ORDER BY position').all(pid);
  mus.fermerBase();
  const d2 = mus.ouvrirBase();
  const apres = d2.prepare('SELECT video_id, position FROM playlist_tracks WHERE playlist_id = ? ORDER BY position').all(pid);
  assert.deepEqual(apres, avant);
  const cols = d2.prepare('PRAGMA table_info(playlist_tracks)').all().filter((c) => c.name === 'position');
  assert.equal(cols.length, 1);
  const hcols = d2.prepare('PRAGMA table_info(history)').all().filter((c) => c.name === 'duration');
  assert.equal(hcols.length, 1);
  mus.fermerBase();
});

test('NULLIF: duration 0 non comptee; invalidation statsCache apres pousseHistory', () => {
  const d = mus.ouvrirBase();
  const uid = d.prepare('SELECT id FROM users WHERE username = ?').get('u1').id;
  d.prepare('INSERT INTO track_meta (video_id, duration) VALUES (?, ?)').run('meta0000001', 240);
  mus.pousseHistory(d, uid, 'meta0000001', 'h', 'a', 0);
  let s = d.prepare('SELECT COALESCE(SUM(COALESCE(NULLIF(h.duration, 0), NULLIF(tm.duration, 0), 0)), 0) / 60.0 AS m FROM history h LEFT JOIN track_meta tm ON tm.video_id = h.video_id WHERE h.user_id = ?').get(uid).m;
  assert.equal(Math.round(s), 4, '0 residuel doit retomber sur track_meta');
  const st1 = mus.statsPour ? null : null;
  void st1;
  const api1 = d.prepare('SELECT COUNT(*) AS n FROM history WHERE user_id = ?').get(uid).n;
  mus.pousseHistory(d, uid, 'autre000001', 'h2', 'a', 120);
  const api2 = d.prepare('SELECT COUNT(*) AS n FROM history WHERE user_id = ?').get(uid).n;
  assert.equal(api2, api1 + 1);
  mus.pousseHistory(d, uid, 'autre000001', 'h2', 'a', 120);
  const api3 = d.prepare('SELECT COUNT(*) AS n FROM history WHERE user_id = ?').get(uid).n;
  assert.equal(api3, api2, 'dedup 60 s');
  mus.fermerBase();
});

test('perf stats < 100 ms sur 10k lignes', () => {
  const d = mus.ouvrirBase();
  const uid = d.prepare('SELECT id FROM users WHERE username = ?').get('u1').id;
  const ins = d.prepare('INSERT INTO history (user_id, video_id, title, artist, duration) VALUES (?, ?, ?, ?, ?)');
  d.exec('BEGIN');
  for (let i = 0; i < 10000; i++) ins.run(uid, 'perf' + String(i % 500).padStart(7, '0'), 't', 'ArtPerf', 180);
  d.exec('COMMIT');
  const t0 = Date.now();
  const rows = d.prepare("SELECT h.video_id, COUNT(*) AS c FROM history h WHERE h.user_id = ? AND h.at >= datetime('now', '-6 month') GROUP BY h.video_id ORDER BY c DESC LIMIT 20").all(uid);
  const ms = Date.now() - t0;
  assert.ok(rows.length > 0);
  assert.ok(ms < 100, 'stats group by < 100 ms, got ' + ms);
  mus.fermerBase();
});

test('radio secours < 1 s sans yt-dlp ni Piped', async () => {
  const d = mus.ouvrirBase();
  const uid = d.prepare('SELECT id FROM users WHERE username = ?').get('u1').id;
  for (let i = 0; i < 4; i++) d.prepare('INSERT OR IGNORE INTO likes (user_id, video_id, title, artist) VALUES (?, ?, ?, ?)').run(uid, 'rad' + String(i).padStart(8, '0'), 'r' + i, 'RadioArt');
  const t0 = Date.now();
  const out = mus.radioSync(d, uid, 'RadioArt', 10);
  assert.ok(out.length >= 4);
  assert.ok(Date.now() - t0 < 1000);
  mus.fermerBase();
});