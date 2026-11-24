// Sonora - track durations via Piped, SQLite track_meta cache
const PIPED_URL = (process.env.PIPED_URL ?? 'http://127.0.0.1:8081').replace(/\/$/, '');

export async function dureePiped(id) {
  try {
    const r = await fetch(PIPED_URL + '/streams/' + encodeURIComponent(id), { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return 0;
    const d = await r.json();
    return Number(d.duration || 0) || 0;
  } catch (e) { return 0; }
}

export function dureesConnues(d, ids) {
  const map = new Map();
  const propres = Array.from(new Set(ids.filter((x) => /^[A-Za-z0-9_-]{11}$/.test(x))));
  if (!propres.length) return map;
  try {
    const marques = propres.map(() => '?').join(',');
    for (const r of d.prepare('SELECT video_id, duration FROM track_meta WHERE video_id IN (' + marques + ') AND duration > 0').all(...propres)) map.set(r.video_id, Number(r.duration));
  } catch (e) {}
  return map;
}

export async function dureesManquantes(d, ids, concurrence) {
  const map = dureesConnues(d, ids);
  const propres = Array.from(new Set(ids.filter((x) => /^[A-Za-z0-9_-]{11}$/.test(x))));
  const manquants = propres.filter((id) => !map.has(id));
  let i = 0;
  const n = Math.max(1, Math.min(12, concurrence || 8));
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < manquants.length) {
      const id = manquants[i++];
      const dur = await dureePiped(id);
      if (dur > 0) {
        map.set(id, dur);
        try { d.prepare('INSERT OR REPLACE INTO track_meta (video_id, duration) VALUES (?, ?)').run(id, dur); } catch (e) {}
      }
    }
  }));
  return map;
}
