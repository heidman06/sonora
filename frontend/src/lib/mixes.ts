// Store mixes : snapshot mémoire + cache localStorage LRU 6 + libellés localisés.
// Design mixes rev.2 : porteur d'état pour #/mixes, XOR subtitleKey/seeds, graines neutres.
import type { Lang, MixSeed, MixSummary, MixesResponse, Track } from './types'
import { storage, userKey } from './storage'
import { tr } from './i18n'
import { CATALOGUE } from './moods'

export const MIXES_VERSION = 2

const SEED_KEYS: Record<string, string> = { favorites: 'seedFavorites', history: 'seedHistory', playlists: 'seedPlaylists', rotation: 'seedRotation', bulk: 'seedBulk' }

export function mixLabel(lang: Lang, mix: MixSummary): string {
  if (mix.moodId && mix.labelKey === mix.moodId) return tr(lang, mix.moodId)
  if (mix.labelKey === 'mixMoodName' && mix.moodId) return tr(lang, 'mixMoodName', { mood: tr(lang, mix.moodId) })
  if (mix.labelKey === 'mixDailyName') return tr(lang, 'mixDailyName', { n: mix.n ?? 1 })
  return tr(lang, mix.labelKey)
}

export function mixSubtitle(lang: Lang, mix: MixSummary): string {
  if (mix.subtitleKey) return tr(lang, mix.subtitleKey)
  return tr(lang, 'basedOn') + (mix.seeds || []).map((s) => (s.t === 'key' ? tr(lang, SEED_KEYS[s.v] || s.v) : s.v)).join(' · ')
}

export function qCoquille(lang: Lang, moodId: string): string {
  const m = (CATALOGUE[lang] || CATALOGUE.en).find((x) => x.id === moodId)
  return m ? m.q : moodId
}

export function coquillesCold(): MixesResponse {
  return { v: MIXES_VERSION, cold: true, seed: '', mixes: ['moodNew', 'moodChill', 'moodPhonk'].map((moodId, i) => ({ key: 'cold' + (i + 1), labelKey: moodId, moodId, subtitleKey: 'mixColdSub', seeds: [] as MixSeed[], count: 0, cover: [] as string[], tracks: [] as Track[] })) }
}

let snapshot: { user: string; resp: MixesResponse } | null = null
export function lireMixesMem(user: string): MixesResponse | null { return snapshot && snapshot.user === user ? snapshot.resp : null }
export function majMixesMem(user: string, resp: MixesResponse): void { snapshot = { user, resp } }

interface CacheEntry { v: number; at: number; lastAccess: number; seed: string; resp: MixesResponse }

export function lireMixesCache(user: string): MixesResponse | null {
  const raw = storage.get<CacheEntry | null>(userKey(user, 'mixes'), null)
  if (!raw || raw.v !== MIXES_VERSION || !raw.resp || !Array.isArray(raw.resp.mixes)) return null
  storage.set(userKey(user, 'mixes'), { ...raw, lastAccess: Date.now() })
  return raw.resp
}

export interface StorageLike { keys(): string[]; get(k: string): string | null; set(k: string, v: string): void; remove(k: string): void }

export function bornerCacheMixes(store: StorageLike, currentUser: string): void {
  const re = /^sonora\.u\.(.+)\.mixes$/
  const entries: { key: string; user: string; at: number }[] = []
  for (const k of store.keys()) {
    const m = re.exec(k)
    if (!m) continue
    let at = 0
    try { const v = JSON.parse(store.get(k) || '{}'); at = Number(v.lastAccess || v.at || 0) } catch { at = 0 }
    entries.push({ key: k, user: m[1], at })
  }
  if (entries.length <= 6) return
  entries.sort((a, b) => a.at - b.at)
  let toRemove = entries.length - 6
  for (const e of entries) {
    if (toRemove <= 0) break
    if (e.user === currentUser) continue
    store.remove(e.key)
    toRemove--
  }
}

export function ecrireMixesCache(user: string, resp: MixesResponse): void {
  storage.set(userKey(user, 'mixes'), { v: MIXES_VERSION, at: Date.now(), lastAccess: Date.now(), seed: resp.seed, resp })
  try { bornerCacheMixes({ keys: () => Object.keys(localStorage), get: (k) => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v), remove: (k) => localStorage.removeItem(k) }, user) } catch { /* quota : repli */ }
}

export function peutEcrireMixes(capture: { user: string }, courant: { user: string }): boolean {
  return capture.user === courant.user
}