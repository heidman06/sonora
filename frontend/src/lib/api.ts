import type {
  Account, AuthResponse, HistoryItem, Lang, MixesResponse, MixSummary, MoodsResponse, PipedItem, PlaylistDetail, PlaylistSummary,
  SearchResponse, Track,
} from './types'

const MUS = '/api/mus'
const PIPED = '/api/piped'

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface PipedPlaylist {
  name: string
  thumbnailUrl?: string
  relatedStreams?: PipedItem[]
  videos?: PipedItem[]
}

export class Api {
  private token = ''
  onUnauthorized: (() => void) | null = null

  setToken(token: string): void { this.token = token }

  private async request(path: string, init: RequestInit = {}, withAuth = true): Promise<Response> {
    const headers = new Headers(init.headers)
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    if (withAuth && this.token) headers.set('Authorization', 'Bearer ' + this.token)
    const res = await fetch(path, { ...init, headers, cache: 'no-store' })
    if (res.status === 401 && withAuth) this.onUnauthorized?.()
    return res
  }

  private async json<T>(path: string, init: RequestInit = {}, withAuth = true): Promise<T> {
    const res = await this.request(path, init, withAuth)
    let body: unknown = null
    try { body = await res.json() } catch { /* empty */ }
    if (!res.ok) {
      const message = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : 'HTTP ' + res.status
      throw new ApiError(message, res.status)
    }
    return body as T
  }

  private body(value: unknown): RequestInit {
    return { method: 'POST', body: JSON.stringify(value) }
  }

  login(username: string, password: string): Promise<AuthResponse> {
    return this.json<AuthResponse>(MUS + '/login', this.body({ username, password }), false)
  }

  register(username: string, password: string): Promise<AuthResponse> {
    return this.json<AuthResponse>(MUS + '/register', this.body({ username, password }), false)
  }

  async logout(): Promise<void> {
    try { await this.json(MUS + '/logout', { method: 'POST' }) } catch { /* noop */ }
  }

  me(): Promise<{ user: { id: number; username: string; display?: string } }> {
    return this.json(MUS + '/me')
  }

  playlists(): Promise<PlaylistSummary[]> {
    return this.json(MUS + '/playlists')
  }

  createPlaylist(name: string): Promise<PlaylistSummary> {
    return this.json(MUS + '/playlists', this.body({ name }))
  }

  deletePlaylist(id: number | string): Promise<void> {
    return this.json(MUS + '/playlists/' + id, { method: 'DELETE' })
  }

  async ytPlaylist(id: string): Promise<PlaylistDetail & { truncated: boolean }> {
    const d = await this.json<{ name: string; truncated?: boolean; tracks: Array<{ videoId: string; title: string; artist: string; duration: number; thumb?: string }> }>(MUS + '/ytplaylist?list=' + encodeURIComponent(id))
    return {
      id: 0,
      name: d.name || '',
      truncated: !!d.truncated,
      tracks: d.tracks.map((t) => ({ id: t.videoId, title: t.title || '', artist: cleanArtist(t.artist), thumb: t.thumb || thumbOf(t.videoId), duration: t.duration || 0 })),
    }
  }

  bulkAddToPlaylist(id: number | string, tracks: Track[]): Promise<{ added: number }> {
    return this.json(MUS + '/playlists/' + id + '/tracks/bulk', this.body({ tracks: tracks.map((t) => ({ videoId: t.id, title: t.title, artist: t.artist, duration: t.duration || 0 })) }))
  }

  reorderPlaylist(id: number | string, videoIds: string[]): Promise<void> {
    return this.json(MUS + '/playlists/' + id + '/reorder', this.body({ videoIds })).then(() => undefined)
  }

  stats(months = 6): Promise<{ totals: { plays: number; minutes: number; tracks: number }; topTracks: Array<Record<string, unknown>>; topArtists: Array<{ artist: string; plays: number; minutes: number }>; perMonth: Array<{ month: string; plays: number; minutes: number }> }> {
    return this.json(MUS + '/stats?months=' + months)
  }

  smart(key: 'top' | 'recent' | 'never'): Promise<Track[]> {
    return this.json<{ tracks: Array<Record<string, unknown>> }>(MUS + '/smart/' + key).then((d) => (d.tracks || []).map(normalizeTrack))
  }

  radio(seed: string, n = 30): Promise<Track[]> {
    return this.json<Array<Record<string, unknown>>>(MUS + '/radio?seed=' + encodeURIComponent(seed) + '&n=' + n).then((l) => l.map(normalizeTrack))
  }

  async playlist(id: number | string): Promise<PlaylistDetail> {
    if (/^\d+$/.test(String(id))) {
      const d = await this.json<{ id: number; name: string; tracks: Array<{ videoId: string; title: string; artist: string; duration: number }> }>(MUS + '/playlists/' + id)
      return {
        id: d.id,
        name: d.name,
        tracks: d.tracks.map((t) => ({
          id: t.videoId,
          title: t.title || '',
          artist: t.artist || '',
          thumb: thumbOf(t.videoId),
          duration: t.duration || 0,
        })),
      }
    }
    if (!/^\d+$/.test(String(id))) {
      try { const resolved = await this.ytPlaylist(String(id)); if (resolved.tracks.length) return resolved } catch { /* fall back to Piped */ }
    }
    const d = await this.json<PipedPlaylist>(PIPED + '/playlists/' + encodeURIComponent(String(id)))
    const streams = (d.relatedStreams && d.relatedStreams.length) ? d.relatedStreams : (Array.isArray(d.videos) ? d.videos : [])
    return { id: 0, name: d.name || '', tracks: streams.map(pipedTrack) }
  }

  addToPlaylist(playlistId: number | string, track: Track): Promise<void> {
    return this.json(MUS + '/playlists/' + playlistId + '/tracks', this.body({
      videoId: track.id, title: track.title, artist: track.artist,
    })).then(() => undefined)
  }

  removeFromPlaylist(playlistId: number | string, trackId: string): Promise<void> {
    return this.json(MUS + '/playlists/' + playlistId + '/tracks/' + trackId, { method: 'DELETE' }).then(() => undefined)
  }

  renamePlaylist(id: number | string, name: string): Promise<void> {
    return this.json(MUS + '/playlists/' + id, { method: 'PATCH', body: JSON.stringify({ name }) }).then(() => undefined)
  }

  likes(): Promise<Track[]> {
    return this.json<Array<{ videoId: string; title: string; artist: string; duration: number }>>(MUS + '/likes')
      .then((list) => list.map((x) => ({ id: x.videoId, title: x.title || '', artist: cleanArtist(x.artist), thumb: thumbOf(x.videoId), duration: x.duration || 0 })))
  }

  like(track: Track): Promise<void> {
    return this.json(MUS + '/likes', this.body({ videoId: track.id, title: track.title, artist: track.artist })).then(() => undefined)
  }

  unlike(trackId: string): Promise<void> {
    return this.json(MUS + '/likes/' + trackId, { method: 'DELETE' }).then(() => undefined)
  }

  history(n = 30): Promise<HistoryItem[]> {
    return this.json<Array<{ videoId: string; title: string; artist: string; duration: number; at?: string }>>(MUS + '/history?n=' + n)
      .then((list) => list.map((x) => ({ id: x.videoId, title: x.title || '', artist: x.artist || '', thumb: thumbOf(x.videoId), duration: x.duration || 0, at: x.at })))
  }

  pushHistory(track: Track): void {
    if (!this.token) return
    fetch(MUS + '/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.token },
      body: JSON.stringify({ videoId: track.id, title: track.title, artist: track.artist, duration: track.duration || 0 }),
    }).catch(() => {})
  }

  recos(n = 16): Promise<Track[]> {
    return this.json<Array<Record<string, unknown>>>(MUS + '/recos?n=' + n).then((list) => list.map(normalizeTrack))
  }

  mix(n = 30): Promise<Track[]> {
    return this.json<Array<Record<string, unknown>>>(MUS + '/mix?n=' + n).then((list) => list.map(normalizeTrack))
  }

  moods(lang: Lang): Promise<MoodsResponse> {
    return this.json<MoodsResponse>(MUS + '/moods?lang=' + lang)
  }

  mixes2(): Promise<MixesResponse> {
    return this.json<Record<string, unknown>>(MUS + '/mixes2').then((r) => ({
      v: Number(r.v ?? 1),
      cold: !!r.cold,
      seed: String(r.seed ?? ''),
      mixes: Array.isArray(r.mixes) ? (r.mixes as Array<Record<string, unknown>>).map((m) => ({
        key: String(m.key ?? ''),
        labelKey: String(m.labelKey ?? ''),
        ...(m.moodId ? { moodId: String(m.moodId) } : {}),
        ...(m.n !== undefined ? { n: Number(m.n) } : {}),
        ...(m.subtitleKey ? { subtitleKey: String(m.subtitleKey) } : {}),
        seeds: Array.isArray(m.seeds) ? (m.seeds as Array<Record<string, unknown>>).map((s) => ({ t: s.t === 'key' ? 'key' as const : 'artist' as const, v: String(s.v ?? '') })) : [],
        count: Number(m.count ?? 0),
        cover: Array.isArray(m.cover) ? m.cover.map(String) : [],
        tracks: Array.isArray(m.tracks) ? (m.tracks as Array<Record<string, unknown>>).map(normalizeTrack) : [],
      })) as MixSummary[] : [],
    }))
  }

  feedback(videoId: string, action: 'dismiss' | 'like'): Promise<{ ok: boolean }> {
    return this.json(MUS + '/feedback', this.body({ videoId, action }))
  }
  search(q: string, filter = 'music_songs', nextpage = ''): Promise<SearchResponse> {
    let url = PIPED + '/search?q=' + encodeURIComponent(q) + '&filter=' + encodeURIComponent(filter)
    if (nextpage) url += '&nextpage=' + encodeURIComponent(nextpage)
    return this.json<SearchResponse>(url)
  }

  suggestions(q: string): Promise<string[]> {
    return this.json<string[]>(PIPED + '/suggestions?query=' + encodeURIComponent(q)).catch(() => [])
  }

  channel(id: string): Promise<PipedPlaylist & { description?: string; avatarUrl?: string }> {
    return this.json(PIPED + '/channel/' + encodeURIComponent(id))
  }
}

export function cleanArtist(a: string | null | undefined): string {
  const s = String(a || '').trim()
  return s === 'NA' || s === 'N/A' ? '' : s
}

export function thumbOf(id: string | null | undefined): string {
  return id ? '/api/img/vi/' + id + '/mqdefault.jpg' : ''
}

export function pipedTrack(item: PipedItem): Track {
  const id = videoIdOf(item.url || '') || String(item.name || '')
  return {
    id,
    title: item.title || item.name || '',
    artist: item.uploaderName || '',
    thumb: item.thumbnail || thumbOf(id),
    duration: item.duration || 0,
  }
}

export function normalizeTrack(raw: Record<string, unknown>): Track {
  const id = String(raw.videoId ?? raw.id ?? '')
  return {
    id,
    title: String(raw.title ?? ''),
    artist: String(raw.artist ?? raw.uploaderName ?? ''),
    thumb: String(raw.thumb ?? raw.thumbnail ?? thumbOf(id)),
    duration: Number(raw.duration ?? 0) || 0,
    seed: raw.seed ? String(raw.seed) : undefined,
  }
}

export function videoIdOf(url: string): string {
  const m = /[?&]v=([A-Za-z0-9_-]{11})/.exec(url)
  return m ? m[1] : ''
}
