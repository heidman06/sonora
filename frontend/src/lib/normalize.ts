export function normalizeText(s: string): string {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function matchesQuery(track: { title?: string; artist?: string }, q: string): boolean {
  const n = normalizeText(q).trim()
  if (!n) return true
  return normalizeText(track.title || '').includes(n) || normalizeText(track.artist || '').includes(n)
}
