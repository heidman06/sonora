// F1 — Parsing LRC pur (aucun réseau, aucun DOM).
// Timestamps [mm:ss.xx] (1 à n par ligne, fraction 1 à 3 chiffres : .x, .xx,
// .xxx ; séparateur '.' ou ':'), tri par time, tags méta ([ar:…], [ti:…],
// [offset:…]) ignorés. Une ligne horodatée sans texte est conservée avec
// texte '' (ligne instrumentale / respiration) ; une ligne sans timestamp
// (vide ou méta) n'a pas de temps → ignorée.

export interface LrcLine { time: number; text: string }

const STAMP = /^\s*\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/

export function parseLrc(text: string): LrcLine[] {
  const out: LrcLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    let rest = raw
    const times: number[] = []
    for (;;) {
      const m = STAMP.exec(rest)
      if (!m) break
      const frac = m[3] ?? ''
      times.push(Number(m[1]) * 60 + Number(m[2]) + (frac ? Number(frac) / 10 ** frac.length : 0))
      rest = rest.slice(m[0].length)
    }
    if (!times.length) continue
    const line = rest.trim()
    for (const time of times) out.push({ time, text: line })
  }
  return out.sort((a, b) => a.time - b.time)
}
