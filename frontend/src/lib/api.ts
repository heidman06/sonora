import type {
  Account, AuthResponse, HistoryItem, MixSummary, PipedItem, PlaylistDetail, PlaylistSummary,
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
  relatedStreams: PipedItem[]
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
    const d = await this.json<PipedPlaylist>(PIPED + '/playlists/' + encodeURIComponent(String(id)))
    return { id: 0, name: d.name || '', tracks: (d.relatedStreams || []).map(pipedTrack) }
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
      .then((list) => list.map((x) => ({ id: x.videoId, title: x.title || '', artist: x.artist || '', thumb: thumbOf(x.videoId), duration: x.duration || 0 })))
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
      body: JSON.stringify({ videoId: track.id, title: track.title, artist: track.artist }),
    }).catch(() => {})
  }

  recos(n = 16): Promise<Track[]> {
    return this.json<Array<Record<string, unknown>>>(MUS + '/recos?n=' + n).then((list) => list.map(normalizeTrack))
  }

  mix(n = 30): Promise<Track[]> {
    return this.json<Array<Record<string, unknown>>>(MUS + '/mix?n=' + n).then((list) => list.map(normalizeTrack))
  }

  mixes(): Promise<MixSummary[]> {
    return this.json<Array<Record<string, unknown>>>(MUS + '/mixes').then((list) => list.map((m) => ({
      key: String(m.key ?? ''),
      name: String(m.name ?? ''),
      count: Number(m.count ?? 0),
      cover: Array.isArray(m.cover) ? m.cover.map(String) : [],
      tracks: Array.isArray(m.tracks) ? (m.tracks as Array<Record<string, unknown>>).map(normalizeTrack) : [],
    })))
  }

  feedback(videoId: string, action: 'dismiss' | 'like' = 'dismiss'): Promise<void> {
    return this.json(MUS + '/feedback', this.body({ videoId, action })).then(() => undefined)
  }

  search(q: string, filter = 'music_songs', nextpage = ''): Promise<SearchResponse> {
    let url = PIPED + '/search?q=' + encodeURIComponent(q) + '&filter=' + encodeURIComponent(filter)
    if (nextpage) url += '&nextpage=' + encodeURIComponent(nextpage)
    return this.json<SearchResponse>(url, {}, false)
  }

  suggestions(q: string): Promise<string[]> {
    return this.json<string[]>(PIPED + '/suggestions?query=' + encodeURIComponent(q), {}, false).catch(() => [])
  }

  channel(id: string): Promise<PipedPlaylist & { description?: string; avatarUrl?: string }> {
    return this.json(PIPED + '/channel/' + encodeURIComponent(id), {}, false)
  }
}

export function thumbOf(id: string | null | undefined): string {
  return id ? 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg' : ''
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
