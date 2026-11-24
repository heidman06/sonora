import { describe, expect, it } from 'vitest'
import { mixLabel, mixSubtitle, coquillesCold, qCoquille, bornerCacheMixes, peutEcrireMixes, MIXES_VERSION } from './mixes'
import type { MixSeed, MixSummary, Track } from './types'

const mk = (over: Partial<MixSummary>): MixSummary => Object.assign({ key: 'k', labelKey: 'mixDeco', seeds: [] as MixSeed[], count: 0, cover: [] as string[], tracks: [] as Track[] }, over) as MixSummary

describe('mixLabel', () => {
  it('x3 dont branche coquille et params', () => {
    expect(mixLabel('fr', mk({ labelKey: 'moodPhonk', moodId: 'moodPhonk' }))).toBe('Phonk')
    expect(mixLabel('en', mk({ labelKey: 'mixMoodName', moodId: 'moodJazz' }))).toBe('Jazz mix')
    expect(mixLabel('es', mk({ labelKey: 'mixMoodName', moodId: 'moodJazz' }))).toBe('Mix Jazz')
    expect(mixLabel('fr', mk({ labelKey: 'mixDailyName', n: 2 }))).toBe('Mix du jour 2')
    expect(mixLabel('en', mk({ labelKey: 'mixDailyName', n: 2 }))).toBe('Daily mix 2')
    expect(mixLabel('es', mk({ labelKey: 'mixDailyName', n: 2 }))).toBe('Mix diario 2')
  })
})

describe('mixSubtitle', () => {
  it('XOR subtitleKey/seeds + vocabulaire neutre', () => {
    expect(mixSubtitle('fr', mk({ subtitleKey: 'mixDecoSub' }))).toBe('Nouveaux titres selon tes goûts')
    const s = mixSubtitle('en', mk({ seeds: [{ t: 'key', v: 'history' }, { t: 'artist', v: 'Kordhell' }] }))
    expect(s).toContain('your history')
    expect(s).toContain('Kordhell')
    expect(mixSubtitle('es', mk({ seeds: [{ t: 'key', v: 'bulk' }] }))).toContain('tus listas')
  })
})

describe('coquilles', () => {
  it('egalite serveur/client keys+moodIds, q localisees', () => {
    const c = coquillesCold()
    expect(c.mixes.map((m) => m.key)).toEqual(['cold1', 'cold2', 'cold3'])
    expect(c.mixes.map((m) => m.moodId)).toEqual(['moodNew', 'moodChill', 'moodPhonk'])
    expect(qCoquille('fr', 'moodChill')).toBe('chill lofi')
    expect(qCoquille('es', 'moodPhonk')).toBe('phonk')
  })
})

describe('cache mixes', () => {
  it('LRU 6 jamais le compte courant', () => {
    const map = new Map<string, string>()
    const store = { keys: () => Array.from(map.keys()), get: (k: string) => map.get(k) ?? null, set: (k: string, v: string) => { map.set(k, v) }, remove: (k: string) => { map.delete(k) } }
    let t = 1000
    for (const u of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7']) { map.set('sonora.u.' + u + '.mixes', JSON.stringify({ v: MIXES_VERSION, at: t, lastAccess: t })); t += 10 }
    bornerCacheMixes(store, 'u1')
    expect(map.size).toBeLessThanOrEqual(6)
    expect(map.has('sonora.u.u1.mixes')).toBe(true)
    expect(map.has('sonora.u.u2.mixes')).toBe(false)
  })
  it('garde de course', () => {
    expect(peutEcrireMixes({ user: 'a' }, { user: 'a' })).toBe(true)
    expect(peutEcrireMixes({ user: 'a' }, { user: 'b' })).toBe(false)
  })
})