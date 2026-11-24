// F1 — Paroles lrclib : GET /api/get → repli /api/search sur 404.
// Cache IndexedDB (store 'lyrics') : TTL 30 j pour un succès (instrumental
// inclus), 7 j pour un échec (synced='' && plain='' && !instrumental).
// Ne JAMAIS throw vers l'UI : toute erreur réseau/IDB rend un record échec.
import { lyricsGet, lyricsPut } from './idb'

export interface LyricsRecord {
  id: string
  synced: string
  plain: string
  instrumental: boolean
  fetchedAt: number
}

export interface LyricsIO {
  get(id: string): Promise<LyricsRecord | null>
  put(rec: LyricsRecord): Promise<void>
}

interface LrclibSong {
  syncedLyrics?: string | null
  plainLyrics?: string | null
  instrumental?: boolean
  duration?: number
}

const DAY = 86_400_000
const TTL_SUCCESS = 30 * DAY
const TTL_FAILURE = 7 * DAY
const TIMEOUT_MS = 8000

function isFailure(rec: LyricsRecord): boolean {
  return rec.synced === '' && rec.plain === '' && !rec.instrumental
}

function isFresh(rec: LyricsRecord, now: number): boolean {
  return now - rec.fetchedAt < (isFailure(rec) ? TTL_FAILURE : TTL_SUCCESS)
}

function failure(id: string, now: number): LyricsRecord {
  return { id, synced: '', plain: '', instrumental: false, fetchedAt: now }
}

function toRecord(id: string, song: LrclibSong, now: number): LyricsRecord {
  return {
    id,
    synced: typeof song.syncedLyrics === 'string' ? song.syncedLyrics : '',
    plain: typeof song.plainLyrics === 'string' ? song.plainLyrics : '',
    instrumental: song.instrumental === true,
    fetchedAt: now,
  }
}

/** Premier candidat synced avec |Δdurée| ≤ 5 s (si durée connue), sinon premier plain. */
function pickCandidate(list: LrclibSong[], duration?: number): LrclibSong | null {
  const want = duration && duration > 0 ? duration : 0
  const synced = list.find((c) => typeof c.syncedLyrics === 'string' && c.syncedLyrics !== '' &&
    (want === 0 || (typeof c.duration === 'number' && Math.abs(c.duration - want) <= 5)))
  if (synced) return synced
  const plain = list.find((c) => typeof c.plainLyrics === 'string' && c.plainLyrics !== '')
  // Un candidat recalé par la tolérance de durée ne doit PAS fournir de synchro
  // (mauvaise version, design R2) : le repli plain ne garde que le texte.
  return plain ? { ...plain, syncedLyrics: '' } : null
}

async function fetchRemote(track: { id: string; title: string; artist?: string; duration?: number }, now: number): Promise<LyricsRecord> {
  const getParams = new URLSearchParams({ track_name: track.title, artist_name: track.artist ?? '' })
  // duration OMIT si 0/absente (lrclib refuse duration=0).
  if (track.duration && track.duration > 0) getParams.set('duration', String(Math.round(track.duration)))
  const res = await fetch('https://lrclib.net/api/get?' + getParams.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (res.ok) return toRecord(track.id, await res.json() as LrclibSong, now)
  if (res.status === 404) {
    const searchParams = new URLSearchParams({ track_name: track.title, artist_name: track.artist ?? '' })
    const sres = await fetch('https://lrclib.net/api/search?' + searchParams.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (sres.ok) {
      const list = await sres.json() as LrclibSong[]
      if (Array.isArray(list)) {
        const cand = pickCandidate(list, track.duration)
        if (cand) return toRecord(track.id, cand, now)
      }
    }
  }
  return failure(track.id, now)
}

export async function fetchLyrics(
  track: { id: string; title: string; artist?: string; duration?: number },
  io?: LyricsIO,
): Promise<LyricsRecord> {
  const store: LyricsIO = io ?? { get: lyricsGet, put: lyricsPut }
  const now = Date.now()
  try {
    const cached = await store.get(track.id)
    if (cached && isFresh(cached, now)) return cached
  } catch { /* IDB indisponible → réseau */ }
  let rec: LyricsRecord
  try {
    rec = await fetchRemote(track, now)
  } catch {
    rec = failure(track.id, now)
  }
  try { await store.put(rec) } catch { /* quota/IDB : on rend quand même */ }
  return rec
}
