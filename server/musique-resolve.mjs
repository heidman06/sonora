#!/usr/bin/env node
// Résout les titres en attente (Spotify → YouTube) par petits lots
import { ouvrirBase, resoudre } from './musique.mjs';
import { dureesManquantes } from './durees.mjs';

const db = ouvrirBase();
const LOT = Number(process.argv[2] || 30);
const CONC = 3;

// Complète les durées manquantes (CarPlay + app), 120 par passage
let dureesOk = 0;
try {
  const ids = db.prepare("SELECT video_id FROM (" +
    "SELECT pt.video_id AS video_id FROM playlist_tracks pt LEFT JOIN track_meta tm ON tm.video_id = pt.video_id WHERE tm.video_id IS NULL " +
    "UNION SELECT l.video_id FROM likes l LEFT JOIN track_meta tm ON tm.video_id = l.video_id WHERE tm.video_id IS NULL " +
    "UNION SELECT h.video_id FROM history h LEFT JOIN track_meta tm ON tm.video_id = h.video_id WHERE tm.video_id IS NULL " +
    "ORDER BY video_id LIMIT 120)").all().map((r) => r.video_id);
  if (ids.length) { await dureesManquantes(db, ids); dureesOk = ids.length; }
} catch (e) {}

const rows = db.prepare('SELECT id, user_id, playlist_id, title, artist FROM pending ORDER BY (playlist_id IS NULL), id LIMIT ?').all(LOT);
if (!rows.length) { console.log('[resolve] durées=' + dureesOk + ' rien à faire'); process.exit(0); }

const insLike = db.prepare('INSERT OR IGNORE INTO likes (user_id, video_id, title, artist) VALUES (?, ?, ?, ?)');
const insPiste = db.prepare('INSERT OR IGNORE INTO playlist_tracks (playlist_id, video_id, title, artist) VALUES (?, ?, ?, ?)');
const del = db.prepare('DELETE FROM pending WHERE id = ?');

let ok = 0, ko = 0;
for (let i = 0; i < rows.length; i += CONC) {
  const tranche = rows.slice(i, i + CONC);
  await Promise.all(tranche.map(async (r) => {
    const res = await resoudre(r.title, r.artist);
    if (res) {
      if (r.playlist_id) insPiste.run(r.playlist_id, res.video_id, res.title, r.title);
      else insLike.run(r.user_id, res.video_id, res.title, r.artist);
      ok++;
    } else {
      ko++;
    }
    del.run(r.id);
  }));
}
console.log('[resolve] ok=' + ok + ' ko=' + ko + ' reste=' + db.prepare('SELECT COUNT(*) AS n FROM pending').get().n);
