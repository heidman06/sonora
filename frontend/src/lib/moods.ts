// Moods personnalises : catalogue localise (repli offline/froid/invite), repartition
// tete/exploration, garde de course et cache localStorage borne (design moods rev. 2).
// Le catalogue est duplique du serveur ; parite testee par node:test (extraction JSON).
import type { Lang, Mood, MoodArtist, MoodsResponse } from './types'
import { storage, userKey } from './storage'

export const MOODS_VERSION = 1

// MOODS_CATALOGUE_BEGIN
const CATALOGUE_JSON = '{"fr":[{"id":"moodPhonk","labelKey":"moodPhonk","q":"phonk"},{"id":"moodChill","labelKey":"moodChill","q":"chill lofi"},{"id":"moodRapFr","labelKey":"moodRapFr","q":"rap français"},{"id":"moodAfro","labelKey":"moodAfro","q":"afrobeats 2026"},{"id":"moodFrenchTouch","labelKey":"moodFrenchTouch","q":"french touch"},{"id":"moodRnb","labelKey":"moodRnb","q":"r&b smooth"},{"id":"moodJazz","labelKey":"moodJazz","q":"jazz lounge"},{"id":"moodElectro","labelKey":"moodElectro","q":"electro house"},{"id":"moodNew","labelKey":"moodNew","q":"nouveautés 2026"},{"id":"moodHitsFr","labelKey":"moodHitsFr","q":"top hits france"},{"id":"moodWorkout","labelKey":"moodWorkout","q":"workout"},{"id":"moodDrive","labelKey":"moodDrive","q":"voiture"},{"id":"moodParty","labelKey":"moodParty","q":"soirée"},{"id":"moodFocus","labelKey":"moodFocus","q":"concentration"}],"en":[{"id":"moodPhonk","labelKey":"moodPhonk","q":"phonk"},{"id":"moodChill","labelKey":"moodChill","q":"chill lofi"},{"id":"moodRapUs","labelKey":"moodRapUs","q":"hip hop rap"},{"id":"moodAfro","labelKey":"moodAfro","q":"afrobeats 2026"},{"id":"moodIndie","labelKey":"moodIndie","q":"indie alternative"},{"id":"moodRnb","labelKey":"moodRnb","q":"r&b smooth"},{"id":"moodJazz","labelKey":"moodJazz","q":"jazz lounge"},{"id":"moodElectro","labelKey":"moodElectro","q":"edm house"},{"id":"moodNew","labelKey":"moodNew","q":"new music 2026"},{"id":"moodHitsUs","labelKey":"moodHitsUs","q":"top hits usa"},{"id":"moodWorkout","labelKey":"moodWorkout","q":"workout mix"},{"id":"moodDrive","labelKey":"moodDrive","q":"night drive"},{"id":"moodParty","labelKey":"moodParty","q":"party hits"},{"id":"moodFocus","labelKey":"moodFocus","q":"focus study"}],"es":[{"id":"moodPhonk","labelKey":"moodPhonk","q":"phonk"},{"id":"moodChill","labelKey":"moodChill","q":"chill lofi"},{"id":"moodReggaeton","labelKey":"moodReggaeton","q":"reggaeton 2026"},{"id":"moodAfro","labelKey":"moodAfro","q":"afrobeats 2026"},{"id":"moodLatinPop","labelKey":"moodLatinPop","q":"pop latino"},{"id":"moodRnb","labelKey":"moodRnb","q":"r&b smooth"},{"id":"moodRockEs","labelKey":"moodRockEs","q":"rock en español"},{"id":"moodElectro","labelKey":"moodElectro","q":"electro house"},{"id":"moodNew","labelKey":"moodNew","q":"novedades 2026"},{"id":"moodHitsEs","labelKey":"moodHitsEs","q":"top éxitos latinos"},{"id":"moodWorkout","labelKey":"moodWorkout","q":"música para entrenar"},{"id":"moodDrive","labelKey":"moodDrive","q":"música para conducir"},{"id":"moodParty","labelKey":"moodParty","q":"fiesta 2026"},{"id":"moodFocus","labelKey":"moodFocus","q":"música para concentrarse"}]}'
// MOODS_CATALOGUE_END

export const CATALOGUE: Record<Lang, Mood[]> = JSON.parse(CATALOGUE_JSON)

export function catalogueStatique(lang: Lang): Mood[] {
  return (CATALOGUE[lang] || CATALOGUE.en).map((m) => ({ ...m, score: 0 }))
}

export function splitChips(moods: Mood[], artists: MoodArtist[]): { head: (Mood | MoodArtist)[]; explore: Mood[] } {
  const scored = moods.filter((m) => (m.score || 0) > 0).sort((a, b) => (b.score || 0) - (a.score || 0))
  const zero = moods.filter((m) => !((m.score || 0) > 0))
  const headMoods = scored.concat(zero).slice(0, Math.max(0, 8 - artists.length))
  const reste = moods.filter((m) => !headMoods.includes(m))
  const explore = reste.filter((m) => !((m.score || 0) > 0)).concat(reste.filter((m) => (m.score || 0) > 0).sort((a, b) => (b.score || 0) - (a.score || 0)))
  return { head: [...headMoods, ...artists], explore }
}

export function peutEcrireMoods(capture: { user: string; lang: Lang }, courant: { user: string; lang: Lang }): boolean {
  return capture.user === courant.user && capture.lang === courant.lang
}

interface CacheEntry { v: number; at: number; lastAccess: number; moods: Mood[]; artists: MoodArtist[]; cold: boolean }

export function lireMoodsCache(user: string, lang: Lang): MoodsResponse | null {
  const raw = storage.get<CacheEntry | null>(userKey(user, 'moods.' + lang), null)
  if (!raw || raw.v !== MOODS_VERSION || !Array.isArray(raw.moods)) return null
  storage.set(userKey(user, 'moods.' + lang), { ...raw, lastAccess: Date.now() })
  return { v: raw.v, lang, cold: raw.cold, moods: raw.moods, artists: raw.artists || [] }
}

export interface StorageLike { keys(): string[]; get(k: string): string | null; set(k: string, v: string): void; remove(k: string): void }

export function bornerCacheMoods(store: StorageLike, currentUser: string): void {
  const re = /^sonora\.u\.(.+)\.moods\.(fr|en|es)$/
  const entries: { key: string; user: string; at: number }[] = []
  for (const k of store.keys()) {
    const m = re.exec(k)
    if (!m) continue
    let at = 0
    try { const v = JSON.parse(store.get(k) || '{}'); at = Number(v.lastAccess || v.at || 0) } catch { at = 0 }
    entries.push({ key: k, user: m[1], at })
  }
  if (entries.length <= 12) return
  entries.sort((a, b) => a.at - b.at)
  let toRemove = entries.length - 12
  for (const e of entries) {
    if (toRemove <= 0) break
    if (e.user === currentUser) continue
    store.remove(e.key)
    toRemove--
  }
}

export function ecrireMoodsCache(user: string, lang: Lang, resp: MoodsResponse): void {
  storage.set(userKey(user, 'moods.' + lang), { v: MOODS_VERSION, at: Date.now(), lastAccess: Date.now(), moods: resp.moods, artists: resp.artists, cold: resp.cold })
  try {
    bornerCacheMoods({ keys: () => Object.keys(localStorage), get: (k) => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v), remove: (k) => localStorage.removeItem(k) }, user)
  } catch { /* quota/shim : repli statique */ }
}