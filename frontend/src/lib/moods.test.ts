import { describe, expect, it } from 'vitest'
import { CATALOGUE, catalogueStatique, splitChips, peutEcrireMoods, bornerCacheMoods, MOODS_VERSION } from './moods'
import type { Mood, MoodArtist } from './types'

const moods = (scores: number[]): Mood[] => CATALOGUE.fr.map((m, i) => ({ ...m, score: scores[i] || 0 }))

describe('splitChips', () => {
  it('froid 8/6 et moodNew en exploration', () => {
    const r = splitChips(moods([]), [])
    expect(r.head.length).toBe(8)
    expect(r.explore.length).toBe(6)
    expect(r.explore.some((m) => m.id === 'moodNew')).toBe(true)
    expect(r.head.some((m) => 'labelKey' in m && m.id === 'moodNew')).toBe(false)
  })
  it('chaud 2 artistes : tete 6 moods + 2 artistes, exploration 8', () => {
    const artists: MoodArtist[] = [{ name: 'Jul', q: 'Jul' }, { name: 'Ninho', q: 'Ninho' }]
    const r = splitChips(moods([9, 8, 7, 6, 5, 4, 3, 2, 0, 1, 0, 0, 0, 0]), artists)
    expect(r.head.length).toBe(8)
    expect(r.head.slice(6)).toEqual(artists)
    expect(r.explore.length).toBe(8)
  })
  it('exploration zero-first puis scored restants', () => {
    const r = splitChips(moods([9, 8, 7, 6, 5, 4, 3, 2, 0, 1, 0, 0, 0, 0]), [])
    expect(r.explore[0].score).toBe(0)
    expect(r.explore[r.explore.length - 1].score).toBe(1)
  })
})

describe('peutEcrireMoods', () => {
  it('4 cas de course', () => {
    expect(peutEcrireMoods({ user: 'a', lang: 'fr' }, { user: 'a', lang: 'fr' })).toBe(true)
    expect(peutEcrireMoods({ user: 'a', lang: 'fr' }, { user: 'a', lang: 'en' })).toBe(false)
    expect(peutEcrireMoods({ user: 'a', lang: 'fr' }, { user: 'b', lang: 'fr' })).toBe(false)
    expect(peutEcrireMoods({ user: 'a', lang: 'fr' }, { user: 'b', lang: 'en' })).toBe(false)
  })
})

describe('bornerCacheMoods', () => {
  it('LRU 12 global, jamais le compte courant', () => {
    const map = new Map<string, string>()
    const store = { keys: () => Array.from(map.keys()), get: (k: string) => map.get(k) ?? null, set: (k: string, v: string) => { map.set(k, v) }, remove: (k: string) => { map.delete(k) } }
    let t = 1000
    for (const u of ['u1', 'u2', 'u3', 'u4', 'u5']) for (const l of ['fr', 'en', 'es']) { map.set('sonora.u.' + u + '.moods.' + l, JSON.stringify({ v: MOODS_VERSION, at: t, lastAccess: t })); t += 10 }
    bornerCacheMoods(store, 'u1')
    expect(map.size).toBeLessThanOrEqual(12)
    for (const l of ['fr', 'en', 'es']) expect(map.has('sonora.u.u1.moods.' + l)).toBe(true)
    expect(map.has('sonora.u.u2.moods.fr')).toBe(false)
  })
})

describe('catalogue client', () => {
  it('14 moods par langue, q non vides <= 100 chars', () => {
    for (const l of ['fr', 'en', 'es'] as const) {
      expect(CATALOGUE[l].length).toBe(14)
      for (const m of CATALOGUE[l]) { expect(m.q.length).toBeGreaterThan(0); expect(m.q.length).toBeLessThanOrEqual(100) }
    }
    expect(catalogueStatique('es').some((m) => m.id === 'moodElectro')).toBe(true)
    expect(catalogueStatique('es').some((m) => m.id === 'moodJazz')).toBe(false)
  })
})