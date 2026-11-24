import { afterEach, expect, it, vi } from 'vitest'
import { fetchLyrics } from './lyrics'
import type { LyricsIO, LyricsRecord } from './lyrics'

const DAY = 86_400_000
const track = { id: 'abc12345678', title: 'Song', artist: 'Artist', duration: 180 }

function io(cached: LyricsRecord | null) {
  const get = vi.fn(async (_id: string): Promise<LyricsRecord | null> => cached)
  const put = vi.fn(async (_rec: LyricsRecord) => {})
  const store: LyricsIO = { get, put }
  return { get, put, store }
}

function okJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

function rec(partial: Partial<LyricsRecord>): LyricsRecord {
  return { id: track.id, synced: '', plain: '', instrumental: false, fetchedAt: Date.now(), ...partial }
}

afterEach(() => { vi.unstubAllGlobals() })

it('cache succès frais (29 j < 30 j) → rendu tel quel, aucun fetch, aucun put', async () => {
  const cached = rec({ synced: '[00:01.00]x', plain: 'x', fetchedAt: Date.now() - 29 * DAY })
  const { store, put } = io(cached)
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const out = await fetchLyrics(track, store)
  expect(out).toBe(cached)
  expect(fetchMock).not.toHaveBeenCalled()
  expect(put).not.toHaveBeenCalled()
})

it('cache succès expiré (31 j > 30 j) → refetch + put', async () => {
  const { store, put } = io(rec({ synced: 'old', fetchedAt: Date.now() - 31 * DAY }))
  const fetchMock = vi.fn(async () => okJson({ syncedLyrics: '[00:02.00]y', plainLyrics: 'y', instrumental: false }))
  vi.stubGlobal('fetch', fetchMock)
  const out = await fetchLyrics(track, store)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(out.synced).toBe('[00:02.00]y')
  expect(put).toHaveBeenCalledTimes(1)
  expect(put.mock.calls[0][0].id).toBe(track.id)
})

it('cache échec frais (6 j < 7 j) → aucun fetch', async () => {
  const cached = rec({ fetchedAt: Date.now() - 6 * DAY })
  const { store } = io(cached)
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const out = await fetchLyrics(track, store)
  expect(out).toBe(cached)
  expect(fetchMock).not.toHaveBeenCalled()
})

it('cache échec expiré (8 j > 7 j) → refetch', async () => {
  const { store } = io(rec({ fetchedAt: Date.now() - 8 * DAY }))
  const fetchMock = vi.fn(async () => okJson({ syncedLyrics: 'S' }))
  vi.stubGlobal('fetch', fetchMock)
  const out = await fetchLyrics(track, store)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(out.synced).toBe('S')
})

it('instrumental = succès : TTL 30 j, pas 7 j', async () => {
  const cached = rec({ instrumental: true, fetchedAt: Date.now() - 29 * DAY })
  const { store } = io(cached)
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const out = await fetchLyrics(track, store)
  expect(out).toBe(cached)
  expect(fetchMock).not.toHaveBeenCalled()
})

it('get 200 : mapping synced/plain/instrumental + duration envoyée', async () => {
  const { store } = io(null)
  const fetchMock = vi.fn(async (_url: string) => okJson({ syncedLyrics: 'S', plainLyrics: 'P', instrumental: false }))
  vi.stubGlobal('fetch', fetchMock)
  const out = await fetchLyrics(track, store)
  const url = String(fetchMock.mock.calls[0][0])
  expect(url).toContain('https://lrclib.net/api/get?')
  expect(url).toContain('track_name=Song')
  expect(url).toContain('artist_name=Artist')
  expect(url).toContain('duration=180')
  expect(out).toMatchObject({ id: track.id, synced: 'S', plain: 'P', instrumental: false })
})

it('duration 0 ou absente → paramètre duration OMIT', async () => {
  for (const t of [{ ...track, duration: 0 }, { id: track.id, title: 'Song', artist: 'Artist' }]) {
    const { store } = io(null)
    const fetchMock = vi.fn(async (_url: string) => okJson({ syncedLyrics: 'S' }))
    vi.stubGlobal('fetch', fetchMock)
    await fetchLyrics(t, store)
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('duration=')
    vi.unstubAllGlobals()
  }
})

it('404 → search : premier synced avec |Δdurée| ≤ 5 s (pas le premier plain)', async () => {
  const { store } = io(null)
  const candidates = [
    { syncedLyrics: '', plainLyrics: 'plain early', duration: 180 },
    { syncedLyrics: 'too far', plainLyrics: 'x', duration: 200 },
    { syncedLyrics: 'good', plainLyrics: 'y', duration: 183 },
    { syncedLyrics: 'also good', plainLyrics: 'z', duration: 181 },
  ]
  const fetchMock = vi.fn(async (url: string) => String(url).includes('/api/get') ? okJson({}, 404) : okJson(candidates))
  vi.stubGlobal('fetch', fetchMock)
  const out = await fetchLyrics(track, store)
  expect(out.synced).toBe('good')
  expect(fetchMock).toHaveBeenCalledTimes(2)
  const searchUrl = String(fetchMock.mock.calls[1][0])
  expect(searchUrl).toContain('/api/search?')
  expect(searchUrl).not.toContain('duration=')
})

it('404 → search : aucun synced dans la tolérance → premier plain', async () => {
  const { store } = io(null)
  const candidates = [
    { syncedLyrics: 'far', duration: 300 },
    { plainLyrics: 'P1', duration: 10 },
    { plainLyrics: 'P2', duration: 180 },
  ]
  const fetchMock = vi.fn(async (url: string) => String(url).includes('/api/get') ? okJson({}, 404) : okJson(candidates))
  vi.stubGlobal('fetch', fetchMock)
  const out = await fetchLyrics(track, store)
  expect(out.synced).toBe('')
  expect(out.plain).toBe('P1')
})

it('repli plain : le synced recalé par la tolérance est écarté (pas de synchro mauvaise version)', async () => {
  const { store } = io(null)
  const candidates = [{ syncedLyrics: 'far', plainLyrics: 'x', duration: 300 }]
  const fetchMock = vi.fn(async (url: string) => String(url).includes('/api/get') ? okJson({}, 404) : okJson(candidates))
  vi.stubGlobal('fetch', fetchMock)
  const out = await fetchLyrics(track, store)
  expect(out.synced).toBe('')
  expect(out.plain).toBe('x')
})

it('404 → search vide → record échec persisté', async () => {
  const { store, put } = io(null)
  const fetchMock = vi.fn(async (url: string) => String(url).includes('/api/get') ? okJson({}, 404) : okJson([]))
  vi.stubGlobal('fetch', fetchMock)
  const out = await fetchLyrics(track, store)
  expect(out).toMatchObject({ id: track.id, synced: '', plain: '', instrumental: false })
  expect(put).toHaveBeenCalledTimes(1)
  expect(put.mock.calls[0][0]).toMatchObject({ synced: '', plain: '', instrumental: false })
})

it('instrumental renvoyé par get → record instrumental (succès)', async () => {
  const { store } = io(null)
  vi.stubGlobal('fetch', vi.fn(async () => okJson({ instrumental: true })))
  const out = await fetchLyrics(track, store)
  expect(out.instrumental).toBe(true)
  expect(out.synced).toBe('')
})

it('HTTP 500 → échec sans search', async () => {
  const { store } = io(null)
  const fetchMock = vi.fn(async () => okJson({}, 500))
  vi.stubGlobal('fetch', fetchMock)
  const out = await fetchLyrics(track, store)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(out).toMatchObject({ synced: '', plain: '', instrumental: false })
})

it('fetch en erreur → record échec, jamais throw', async () => {
  const { store, put } = io(null)
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
  const out = await fetchLyrics(track, store)
  expect(out).toMatchObject({ id: track.id, synced: '', plain: '', instrumental: false })
  expect(put).toHaveBeenCalledTimes(1)
})

it('put en erreur → record quand même rendu', async () => {
  const get = vi.fn(async (): Promise<LyricsRecord | null> => null)
  const put = vi.fn(async () => { throw new Error('quota') })
  vi.stubGlobal('fetch', vi.fn(async () => okJson({ syncedLyrics: 'S' })))
  const out = await fetchLyrics(track, { get, put })
  expect(out.synced).toBe('S')
})

it('cache IDB en erreur → repli réseau sans throw', async () => {
  const get = vi.fn(async (): Promise<LyricsRecord | null> => { throw new Error('idb ko') })
  const put = vi.fn(async (_rec: LyricsRecord) => {})
  vi.stubGlobal('fetch', vi.fn(async () => okJson({ syncedLyrics: 'S' })))
  const out = await fetchLyrics(track, { get, put })
  expect(out.synced).toBe('S')
})
