import { Api, thumbOf } from '../lib/api'
import { downloadAll, downloadDel, downloadGet, downloadPut } from '../lib/idb'
import { storage, userKey } from '../lib/storage'
import type { Account, AuthResponse, DownloadRecord, Lang, PlaylistSummary, Track } from '../lib/types'

const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

type Repeat = 'off' | 'all' | 'one'
type ToastFn = (message: string) => void

export interface PlayerState {
  ready: boolean
  user: string
  token: string
  accounts: Account[]
  lang: Lang
  playlists: PlaylistSummary[]
  likes: Track[]
  downloads: DownloadRecord[]
  queue: Track[]
  current: Track | null
  playing: boolean
  currentTime: number
  duration: number
  volume: number
  repeat: Repeat
  shuffle: boolean
  hls: boolean
  loadingTrack: string
  downloading: Record<string, boolean>
  authError: string
  toast: string
}

interface HlsState {
  active: boolean
  queue: Track[]
  durs: number[]
  offsets: number[]
  cooldownUntil: number
}

function initialState(): PlayerState {
  return {
    ready: false,
    user: storage.get('user', ''),
    token: storage.get('token', ''),
    accounts: storage.get('accounts', [] as Account[]),
    lang: storage.get('lang', 'en') as Lang,
    playlists: [],
    likes: [],
    downloads: [],
    queue: [],
    current: null,
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: storage.get('volume', 0.9),
    repeat: storage.get('repeat', 'off') as Repeat,
    shuffle: false,
    hls: false,
    loadingTrack: '',
    downloading: {},
    authError: '',
    toast: '',
  }
}

function fmt(sec: number): string {
  if (!sec || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m + ':' + (s < 10 ? '0' : '') + s
}

export class PlayerEngine {
  readonly api = new Api()
  private state: PlayerState = initialState()
  private listeners = new Set<() => void>()
  private media: HTMLAudioElement
  private blobUrl = ''
  private hls: HlsState = { active: false, queue: [], durs: [], offsets: [], cooldownUntil: 0 }
  private intentPlay = false
  private stallTimer: number | null = null
  private toastTimer: number | null = null
  private watchdogTries = 0
  private skipCount = 0
  private historyLoadedFor = ''
  private onToast: ToastFn | null = null

  constructor() {
    this.media = document.createElement('audio')
    this.media.id = 'sonora-media'
    this.media.preload = 'auto'
    this.media.setAttribute('playsinline', '')
    this.media.style.display = 'none'
    document.body.appendChild(this.media)
    const active = storage.get('active', '')
    const accounts = storage.get('accounts', [] as Account[])
    const acc = accounts.find((a) => a.user === active) || accounts.find((a) => a.user === this.state.user)
    if (acc) { this.state.user = acc.user; this.state.token = acc.token || '' }
    this.api.setToken(this.state.token)
    this.bindMedia()
    document.addEventListener('pointerdown', this.unlock, { capture: true, once: true })
    document.addEventListener('touchstart', this.unlock, { capture: true, once: true })
    this.api.onUnauthorized = () => this.handleUnauthorized()
  }

  // ---------- store ----------
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): PlayerState => this.state

  private patch(patch: Partial<PlayerState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  private toast(message: string): void {
    this.onToast?.(message)
    this.patch({ toast: message })
    if (this.toastTimer) window.clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => this.patch({ toast: '' }), 2300)
  }

  setToastHandler(fn: ToastFn | null): void { this.onToast = fn }

  // ---------- auth / accounts ----------
  private booted = false
  async boot(): Promise<void> {
    if (this.booted) return
    this.booted = true
    const active = storage.get('active', '')
    const accounts = storage.get('accounts', [] as Account[])
    const acc = accounts.find((a) => a.user === active) || accounts.find((a) => a.user === this.state.user)
    if (acc) {
      this.api.setToken(acc.token || '')
      this.patch({ user: acc.user, token: acc.token || '', accounts })
    } else {
      this.api.setToken(this.state.token)
    }
    await this.loadLocalUser()
    if (this.state.token) {
      this.api.me().catch(() => { /* offline token is fine */ })
      await this.refreshLibrary()
    }
    this.patch({ ready: true })
  }

  private async loadLocalUser(): Promise<void> {
    const user = this.state.user || 'guest'
    const queue = storage.get(userKey(this.state.user, 'queue'), [] as Track[])
    const qi = storage.get(userKey(this.state.user, 'qi'), -1)
    const likes = storage.get(userKey(this.state.user, 'favs'), [] as Track[])
    const downloads = await downloadAll()
    const current = queue[qi] || null
    this.patch({ queue, current, likes, downloads })
    if (current && !this.state.ready) this.patch({ ready: true })
    this.historyLoadedFor = ''
    this.applyThemeLanguage()
    void user
  }

  private applyThemeLanguage(): void {
    document.documentElement.lang = this.state.lang
  }

  async login(username: string, password: string): Promise<Account> {
    const result = await this.api.login(username, password)
    return this.applyAuth(result)
  }

  async register(username: string, password: string): Promise<Account> {
    const result = await this.api.register(username, password)
    return this.applyAuth(result)
  }

  private async applyAuth(result: AuthResponse): Promise<Account> {
    const name = result.user.username
    const accounts = [{ user: name, token: result.token }, ...this.state.accounts.filter((a) => a.user !== name)]
    this.api.setToken(result.token)
    storage.set('accounts', accounts)
    storage.set('active', name)
    storage.set('user', name)
    storage.set('token', result.token)
    this.patch({ accounts, user: name, token: result.token, authError: '' })
    await this.loadLocalUser()
    await this.refreshLibrary()
    return { user: name, token: result.token }
  }

  async setActiveUser(name: string): Promise<void> {
    const acc = this.state.accounts.find((a) => a.user === name)
    if (!acc) return
    this.api.setToken(acc.token)
    storage.set('active', name)
    storage.set('user', name)
    storage.set('token', acc.token)
    this.patch({ user: name, token: acc.token })
    await this.loadLocalUser()
    await this.refreshLibrary()
  }

  async logout(): Promise<void> {
    await this.api.logout()
    const accounts = this.state.accounts.filter((a) => a.user !== this.state.user)
    storage.set('accounts', accounts)
    storage.del('active')
    storage.del('user')
    storage.del('token')
    this.api.setToken('')
    this.media.pause()
    this.patch({ user: '', token: '', accounts, playlists: [], likes: [], queue: [], current: null, playing: false })
  }

  private handleUnauthorized(): void {
    storage.del('active')
    storage.del('token')
    this.patch({ user: '', token: '', authError: 'session expirée' })
  }

  // ---------- data ----------
  async refreshLibrary(): Promise<void> {
    if (!this.state.token) return
    const [playlists, likes, history] = await Promise.all([
      this.api.playlists().catch(() => [] as PlaylistSummary[]),
      this.api.likes().catch(() => [] as Track[]),
      this.api.history(30).catch(() => [] as Track[]),
    ])
    this.patch({ playlists, likes })
    if (history.length) storage.set(userKey(this.state.user, 'recent'), history)
  }

  async loadPlaylists(): Promise<PlaylistSummary[]> {
    const playlists = await this.api.playlists().catch(() => [])
    this.patch({ playlists })
    return playlists
  }

  async createPlaylist(name: string): Promise<PlaylistSummary> {
    const p = await this.api.createPlaylist(name)
    await this.loadPlaylists()
    return p
  }

  async deletePlaylist(id: number | string): Promise<void> {
    await this.api.deletePlaylist(id)
    await this.loadPlaylists()
  }

  async addToPlaylist(playlistId: number | string, track: Track): Promise<void> {
    await this.api.addToPlaylist(playlistId, track)
    await this.loadPlaylists()
    this.toast('Ajouté ✓')
  }

  isLiked(id: string): boolean {
    return this.state.likes.some((t) => t.id === id)
  }

  async toggleLike(track: Track): Promise<void> {
    const liked = this.isLiked(track.id)
    const likes = liked ? this.state.likes.filter((t) => t.id !== track.id) : [track, ...this.state.likes]
    this.patch({ likes })
    storage.set(userKey(this.state.user, 'favs'), likes)
    try {
      if (liked) await this.api.unlike(track.id)
      else await this.api.like(track)
    } catch {
      this.toast('Favori non enregistré')
    }
  }

  // ---------- queue ----------
  private persistQueue(): void {
    storage.set(userKey(this.state.user, 'queue'), this.state.queue)
    storage.set(userKey(this.state.user, 'qi'), Math.max(0, this.state.queue.findIndex((t) => t.id === this.state.current?.id)))
  }

  async playTrack(track: Track, queue?: Track[], index = 0): Promise<void> {
    if (!track || !track.id) { this.toast('Titre introuvable'); return }
    const nextQueue = queue ? queue.slice() : (this.state.queue.some((t) => t.id === track.id) ? this.state.queue : [track, ...this.state.queue])
    const qi = queue ? index : Math.max(0, nextQueue.findIndex((t) => t.id === track.id))
    this.intentPlay = true
    this.hls.active = false
    this.media.pause()
    this.watchdogTries = 0
    this.skipCount = 0
    this.patch({ queue: nextQueue, current: track, playing: false, currentTime: 0, duration: track.duration || 0, loadingTrack: track.id, hls: false })
    this.persistQueue()
    this.updateMediaSession()
    this.api.pushHistory(track)

    if (this.supportsHls() && nextQueue.length > 1) {
      const started = await this.startHls(qi)
      if (started) return
    }
    await this.startDirect(track)
  }

  private async startDirect(track: Track): Promise<void> {
    try {
      const rec = await downloadGet(track.id)
      if (rec?.blob) {
        this.revokeBlob()
        this.blobUrl = URL.createObjectURL(rec.blob)
        this.media.src = this.blobUrl
        this.patch({ duration: rec.duration || track.duration || 0 })
        await this.playMedia()
        return
      }
      this.revokeBlob()
      this.media.src = '/musique/dl/' + encodeURIComponent(track.id)
      this.media.load()
      this.patch({ loadingTrack: '' })
      await this.playMedia()
      this.prefetchNext()
    } catch (error) {
      this.toast('Lecture impossible')
      this.patch({ loadingTrack: '' })
      this.maybeSkip()
      void error
    }
  }

  private async playMedia(): Promise<void> {
    try {
      await this.media.play()
      this.patch({ playing: true, loadingTrack: '' })
    } catch {
      this.patch({ playing: false, loadingTrack: '' })
      this.toast('Appuie sur lecture')
    }
  }

  private async startHls(index: number): Promise<boolean> {
    if (!this.state.queue.length) return false
    if (Date.now() < this.hls.cooldownUntil) return false
    try {
      const queue = this.state.queue.slice(0, 60).filter((t) => t.id)
      if (queue.length < 2) return false
      const durs: number[] = []
      const offsets: number[] = []
      let acc = 0
      for (const t of queue) {
        const d = Math.max(10, Math.round(t.duration || 240))
        offsets.push(acc)
        acc += d
        durs.push(d)
      }
      this.hls = { active: true, queue, durs, offsets, cooldownUntil: 0 }
      const url = location.origin + '/musique/hls/index.m3u8?ids=' + queue.map((t) => t.id).join(',') + '&durs=' + durs.join(',')
      this.media.src = url
      this.media.load()
      const target = offsets[Math.max(0, index)] || 0
      this.media.addEventListener('loadedmetadata', () => {
        try { if (Math.abs(this.media.currentTime - target) > 1) this.media.currentTime = target } catch { /* noop */ }
      }, { once: true })
      void fetch(url, { cache: 'no-store' }).then((r) => r.text()).then((txt) => {
        const parsed = Array.from(txt.matchAll(/#EXTINF:([0-9.]+)/g)).map((m) => Number(m[1]))
        if (parsed.length === this.hls.durs.length) {
          const offsets2: number[] = []
          let total = 0
          for (const d of parsed) { offsets2.push(total); total += d }
          this.hls.durs = parsed
          this.hls.offsets = offsets2
        }
      }).catch(() => {})
      this.patch({ current: queue[index] || queue[0], queue, duration: durs[index] || 0, currentTime: 0, hls: true, loadingTrack: '' })
      this.updatePositionState()
      await this.playMedia()
      this.prefetchNext()
      return true
    } catch {
      this.hls.active = false
      this.hls.cooldownUntil = Date.now() + 12000
      this.patch({ hls: false })
      return false
    }
  }

  private supportsHls(): boolean {
    if (Date.now() < this.hls.cooldownUntil) return false
    if (IS_IOS) return true
    try { return this.media.canPlayType('application/vnd.apple.mpegurl') !== '' } catch { return false }
  }

  playNext(auto = false): void {
    const queue = this.hls.active ? this.hls.queue : this.state.queue
    if (!queue.length) return
    const idx = this.state.current ? queue.findIndex((t) => t.id === this.state.current?.id) : 0
    let next = idx + 1
    if (next >= queue.length) {
      if (this.state.repeat === 'all') next = 0
      else if (!auto) return
      else { this.patch({ playing: false }); this.media.pause(); return }
    }
    if (this.hls.active) {
      this.media.currentTime = this.hls.offsets[next] || 0
      this.patch({ current: queue[next], currentTime: 0 })
      this.updatePositionState()
      return
    }
    void this.playTrack(queue[next], queue, next)
  }

  playPrev(): void {
    if (this.hls.active) {
      const queue = this.hls.queue
      const idx = this.hls.queue.findIndex((t) => t.id === this.state.current?.id)
      const rel = this.media.currentTime - (this.hls.offsets[idx] || 0)
      const target = rel > 4 ? idx : (idx <= 0 ? queue.length - 1 : idx - 1)
      this.media.currentTime = this.hls.offsets[target] || 0
      this.patch({ current: queue[target], currentTime: 0 })
      this.updatePositionState()
      return
    }
    if (this.media.currentTime > 4) { this.media.currentTime = 0; return }
    const queue = this.state.queue
    if (!queue.length) return
    const idx = Math.max(0, queue.findIndex((t) => t.id === this.state.current?.id))
    const target = idx <= 0 ? queue.length - 1 : idx - 1
    void this.playTrack(queue[target], queue, target)
  }

  togglePlay(): void {
    this.intentPlay = true
    if (!this.media.src) { if (this.state.queue.length) void this.playTrack(this.state.current || this.state.queue[0], this.state.queue, 0); return }
    if (this.media.paused) void this.playMedia()
    else { this.media.pause(); this.patch({ playing: false }) }
  }

  seekRatio(ratio: number): void {
    const r = Math.max(0, Math.min(1, ratio))
    if (this.hls.active) {
      const idx = Math.max(0, this.hls.queue.findIndex((t) => t.id === this.state.current?.id))
      const off = this.hls.offsets[idx] || 0
      const dur = this.hls.durs[idx] || 1
      try { this.media.currentTime = off + Math.min(dur - 0.35, r * dur) } catch { /* noop */ }
      this.updatePositionState()
      return
    }
    if (Number.isFinite(this.media.duration) && this.media.duration > 0) this.media.currentTime = r * this.media.duration
  }

  setVolume(v: number): void {
    const volume = Math.max(0, Math.min(1, v))
    this.media.volume = volume
    storage.set('volume', volume)
    this.patch({ volume })
  }

  cycleRepeat(): void {
    const next: Repeat = this.state.repeat === 'off' ? 'all' : this.state.repeat === 'all' ? 'one' : 'off'
    storage.set('repeat', next)
    this.patch({ repeat: next })
  }

  removeFromQueue(index: number): void {
    const queue = this.state.queue.slice()
    if (index < 0 || index >= queue.length) return
    const wasCurrent = this.state.current?.id === queue[index]?.id
    queue.splice(index, 1)
    let current = this.state.current
    const currentId = current?.id
    let qi = currentId ? queue.findIndex((t) => t.id === currentId) : -1
    if (wasCurrent) {
      qi = Math.min(index, queue.length - 1)
      current = queue[qi] || null
    } else if (qi < 0) qi = 0
    this.patch({ queue, current })
    this.persistQueue()
    if (wasCurrent) {
      if (current) void this.playTrack(current, queue, qi)
      else { this.media.pause(); this.patch({ playing: false }) }
    } else if (this.hls.active && current) {
      void this.startHls(qi)
    }
  }

  moveQueue(from: number, to: number): void {
    const queue = this.state.queue.slice()
    if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return
    const [track] = queue.splice(from, 1)
    queue.splice(to, 0, track)
    const current = this.state.current
    const qi = current ? queue.findIndex((t) => t.id === current.id) : -1
    this.patch({ queue })
    this.persistQueue()
    if (this.hls.active && qi >= 0) void this.startHls(qi)
  }

  toggleShuffle(): void {
    const shuffle = !this.state.shuffle
    const queue = shuffle ? [...this.state.queue].sort(() => Math.random() - 0.5) : this.state.queue
    const current = this.state.current
    const qi = current ? queue.findIndex((t) => t.id === current.id) : -1
    this.patch({ shuffle, queue })
    this.persistQueue()
    if (this.hls.active && qi >= 0) void this.startHls(qi)
  }

  async downloadTrack(track: Track): Promise<void> {
    if (this.state.downloads.some((d) => d.id === track.id) || this.state.downloading[track.id]) return
    this.patch({ downloading: { ...this.state.downloading, [track.id]: true } })
    try {
      const res = await fetch('/musique/dl/' + encodeURIComponent(track.id), { cache: 'no-store' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const blob = await res.blob()
      const rec: DownloadRecord = {
        id: track.id, title: track.title, artist: track.artist, thumb: track.thumb,
        duration: track.duration, blob, addedAt: Date.now(),
      }
      await downloadPut(rec)
      const downloads = await downloadAll()
      this.patch({ downloads })
      this.toast('Téléchargé ✓')
    } catch {
      this.toast('Téléchargement impossible')
    } finally {
      const next = { ...this.state.downloading }
      delete next[track.id]
      this.patch({ downloading: next })
    }
  }

  async removeDownload(id: string): Promise<void> {
    await downloadDel(id)
    this.patch({ downloads: await downloadAll() })
    this.toast('Supprimé')
  }

  // ---------- media ----------
  private bindMedia(): void {
    this.media.addEventListener('timeupdate', () => {
      if (this.hls.active) {
        const t = this.media.currentTime || 0
        let idx = 0
        for (let i = 0; i < this.hls.offsets.length; i++) if (t >= this.hls.offsets[i]) idx = i
        const off = this.hls.offsets[idx] || 0
        const dur = this.hls.durs[idx] || 1
        const rel = Math.max(0, Math.min(dur, t - off))
        const current = this.hls.queue[idx] || this.state.current
        if (current && current.id !== this.state.current?.id) {
          this.api.pushHistory(current)
          this.patch({ current, currentTime: rel, duration: dur, hls: true })
          this.updateMediaSession()
          this.updatePositionState()
          if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = 'playing' } catch { /* noop */ } }
          return
        }
        this.patch({ current, currentTime: rel, duration: dur, hls: true })
        this.updatePositionState()
        if (this.watchdogTries > 0) this.watchdogTries = 0
        return
      }
      const duration = Number.isFinite(this.media.duration) ? this.media.duration : (this.state.current?.duration || 0)
      this.patch({ currentTime: this.media.currentTime, duration })
      this.updatePositionState()
    })
    this.media.addEventListener('play', () => { this.patch({ playing: true }); this.prefetchNext(); if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = 'playing' } catch { /* noop */ } } this.updatePositionState() })
    this.media.addEventListener('pause', () => { this.patch({ playing: false }); if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = 'paused' } catch { /* noop */ } } this.updatePositionState() })
    this.media.addEventListener('playing', () => { this.patch({ playing: true, loadingTrack: '' }); this.clearStall() })
    this.media.addEventListener('waiting', () => this.armStall())
    this.media.addEventListener('stalled', () => this.armStall())
    this.media.addEventListener('ended', () => {
      if (this.hls.active) {
        if (this.state.repeat === 'all') { this.media.currentTime = 0; void this.media.play() }
        else if (this.state.repeat === 'one') { this.media.currentTime = this.hls.offsets[this.currentIndex()] || 0; void this.media.play() }
        else this.patch({ playing: false })
        return
      }
      if (this.state.repeat === 'one') { this.media.currentTime = 0; void this.media.play(); return }
      this.playNext(true)
    })
    this.media.addEventListener('error', () => this.onMediaError())
  }

  private currentIndex(): number {
    const list = this.hls.active ? this.hls.queue : this.state.queue
    return Math.max(0, list.findIndex((t) => t.id === this.state.current?.id))
  }

  private onMediaError(): void {
    if (this.hls.active) {
      this.hls.active = false
      this.hls.cooldownUntil = Date.now() + 12000
      this.patch({ hls: false })
      const current = this.state.current
      if (current) void this.startDirect(current)
      return
    }
    this.watchdogTries += 1
    if (this.watchdogTries <= 1 && this.state.current) {
      this.toast('Reconnexion…')
      void this.startDirect(this.state.current)
      return
    }
    this.toast('Titre indisponible — suivant')
    this.maybeSkip()
  }

  private maybeSkip(): void {
    if (this.skipCount >= 5) { this.toast('Lecture impossible'); return }
    if (this.state.queue.length < 2) return
    this.skipCount += 1
    window.setTimeout(() => this.playNext(true), 600)
  }

  private armStall(): void {
    if (this.stallTimer || !this.intentPlay || this.media.paused) return
    const pos = this.media.currentTime
    this.stallTimer = window.setTimeout(() => {
      this.stallTimer = null
      if (this.media.paused || !this.intentPlay) return
      if (Math.abs(this.media.currentTime - pos) > 0.3) { this.armStall(); return }
      if (this.hls.active) { this.media.currentTime = this.media.currentTime + 0.01; return }
      const current = this.state.current
      if (!current) return
      this.toast('Reconnexion…')
      try { this.media.currentTime = pos } catch { /* noop */ }
      this.media.src = '/musique/dl/' + encodeURIComponent(current.id) + '?r=' + Date.now()
      void this.playMedia()
    }, 9000)
  }

  private clearStall(): void {
    if (this.stallTimer) { window.clearTimeout(this.stallTimer); this.stallTimer = null }
  }

  private prefetchNext(): void {
    const list = this.hls.active ? this.hls.queue : this.state.queue
    const idx = this.currentIndex()
    for (let k = 1; k <= 2; k++) {
      const next = list[idx + k]
      if (next?.id) fetch('/musique/dl/' + encodeURIComponent(next.id), { method: 'HEAD' }).catch(() => {})
    }
  }

  private revokeBlob(): void {
    if (this.blobUrl) { URL.revokeObjectURL(this.blobUrl); this.blobUrl = '' }
  }

  private unlock = (): void => {
    try {
      const wav = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA='
      this.media.src = wav
      void this.media.play().then(() => { this.media.pause(); this.media.removeAttribute('src'); this.media.load() }).catch(() => {})
    } catch { /* noop */ }
  }

  private updatePositionState(): void {
    if (!('mediaSession' in navigator)) return
    const session = navigator.mediaSession as MediaSession & { setPositionState?: (state: { duration: number; position: number; playbackRate?: number }) => void }
    if (typeof session.setPositionState !== 'function') return
    let duration: number
    let position: number
    if (this.hls.active) {
      const idx = Math.max(0, this.hls.queue.findIndex((t) => t.id === this.state.current?.id))
      duration = this.hls.durs[idx] || 0
      position = this.state.currentTime
    } else {
      duration = Number.isFinite(this.media.duration) ? this.media.duration : (this.state.duration || 0)
      position = this.media.currentTime || 0
    }
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return
    try {
      session.setPositionState({
        duration,
        position: Math.max(0, Math.min(position, duration)),
        playbackRate: this.media.playbackRate || 1,
      })
    } catch { /* Safari can reject transient states */ }
  }

  private updateMediaSession(): void {
    if (!('mediaSession' in navigator) || !this.state.current) return
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.state.current.title,
        artist: this.state.current.artist || 'Sonora',
        album: 'Sonora',
        artwork: this.state.current.thumb ? [{ src: this.state.current.thumb, sizes: '512x512' }] : [],
      })
      navigator.mediaSession.setActionHandler('play', () => this.togglePlay())
      navigator.mediaSession.setActionHandler('pause', () => this.togglePlay())
      navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext(false))
      navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrev())
    } catch { /* noop */ }
  }

  setLang(lang: Lang): void {
    storage.set('lang', lang)
    document.documentElement.lang = lang
    this.patch({ lang })
  }

  canHls(): boolean { return this.supportsHls() }

  timeLabel(sec: number): string { return fmt(sec) }
}

export const engine = new PlayerEngine()
export type { Track }
