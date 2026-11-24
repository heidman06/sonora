import { it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DICTS } from './i18n'

const SRC = dirname(fileURLToPath(import.meta.url))
const ALLOWED_LITERALS = ['Sonora']
const ALLOWED_COGNATS = ['error']

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return files(p)
    return /\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : []
  })
}

it('keysets fr/en/es are identical', () => {
  const kf = Object.keys(DICTS.fr).sort()
  const ke = Object.keys(DICTS.en).sort()
  const ks = Object.keys(DICTS.es).sort()
  expect(ke).toEqual(kf)
  expect(ks).toEqual(kf)
})

it('every literal tr/t key exists in the 3 dictionaries', () => {
  const missing: string[] = []
  for (const f of files(SRC)) {
    const src = readFileSync(f, 'utf8')
    for (const re of [/\btr\([^,]*,\s*'([^']+)'/g, /\bt\('([^']+)'\)/g]) {
      for (const m of src.matchAll(re)) {
        const k = m[1]
        for (const lang of ['fr', 'en', 'es'] as const) if (!(k in DICTS[lang])) missing.push(lang + ':' + k + ' @' + f)
      }
    }
  }
  expect(missing).toEqual([])
})

it('no hardcoded literals in aria-label/placeholder/title', () => {
  const bad: string[] = []
  for (const f of files(SRC)) {
    const src = readFileSync(f, 'utf8')
    for (const re of [/aria-label="([^"]+)"/g, /placeholder="([^"]+)"/g, /title="([^"]+)"/g]) {
      for (const m of src.matchAll(re)) if (!ALLOWED_LITERALS.includes(m[1])) bad.push(m[1] + ' @' + f)
    }
  }
  expect(bad).toEqual([])
})

it('no hardcoded trilingual ternary with string literals', () => {
  const bad: string[] = []
  for (const f of files(SRC)) {
    const src = readFileSync(f, 'utf8')
    if (/lang === 'fr' \? '/.test(src)) bad.push(f)
  }
  expect(bad).toEqual([])
})

it('no EN value copied into ES (except cognats)', () => {
  const bad = Object.keys(DICTS.en).filter((k) => DICTS.es[k] === DICTS.en[k] && DICTS.fr[k] !== DICTS.en[k] && !ALLOWED_COGNATS.includes(k))
  expect(bad).toEqual([])
})

it('dynamic key sites resolve in the 3 dictionaries', () => {
  const missing: string[] = []
  const DYNAMIC = ['noResults', 'noFavorites', 'noDownloads', 'noPlaylists', 'searchHint', 'noFavoritesHint', 'noDownloadsHint', 'noPlaylistsHint', 'offlineHint', 'lyricsHint', 'lyricsUnavailable', 'lyricsInstrumental', 'smartTop', 'smartRecent', 'smartNever', 'playNext', 'addToQueue', 'addToPlaylist', 'startRadio', 'retry', 'seedFavorites', 'seedHistory', 'seedPlaylists', 'moodPhonk', 'moodChill', 'moodRapFr', 'moodAfro', 'moodFrenchTouch', 'moodRnb', 'moodJazz', 'moodElectro', 'moodNew', 'moodHitsFr', 'moodWorkout', 'moodDrive', 'moodParty', 'moodFocus', 'moodRapUs', 'moodIndie', 'moodHitsUs', 'moodReggaeton', 'moodLatinPop', 'moodRockEs', 'moodHitsEs', 'mixDeco', 'mixBoucle', 'mixFavoris', 'mixArchives', 'mixRotation', 'mixVrac', 'mixDailyName', 'mixMoodName', 'mixDecoSub', 'mixBoucleSub', 'mixFavorisSub', 'mixArchivesSub', 'mixColdSub', 'seedRotation', 'seedBulk']
  for (const k of DYNAMIC) for (const lang of ['fr', 'en', 'es'] as const) if (!(k in DICTS[lang])) missing.push(lang + ':' + k)
  for (const f of files(SRC)) {
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(/(?:emptyKey|titleKey|hintKey|labelKey)="([^"]+)"/g)) {
      for (const lang of ['fr', 'en', 'es'] as const) if (!(m[1] in DICTS[lang])) missing.push(lang + ':' + m[1] + ' @' + f)
    }
  }
  expect(missing).toEqual([])
})

it('placeholders identiques x3', () => {
  const bad: string[] = []
  for (const k of Object.keys(DICTS.fr)) {
    const ph = (l: 'fr' | 'en' | 'es') => ((DICTS[l] as Record<string, string>)[k] || '').match(/\{\w+\}/g)?.sort().join(',') || ''
    if (ph('fr') !== ph('en') || ph('fr') !== ph('es')) bad.push(k)
  }
  expect(bad).toEqual([])
})

it('no value equal to its key', () => {
  const SELF = ['tracks', 'playlists']; const bad = Object.keys(DICTS.en).filter((k) => !SELF.includes(k) && (DICTS.en[k] === k || DICTS.fr[k] === k || DICTS.es[k] === k))
  expect(bad).toEqual([])
})

it('every declared Hint key is consumed in src', () => {
  const hintKeys = Object.keys(DICTS.fr).filter((k) => /Hint$/.test(k))
  const sources = files(join(SRC, '..')).map((f) => readFileSync(f, 'utf8')).join('\n')
  const orphans = hintKeys.filter((k) => {
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const used = new RegExp("(?:tr\\([^,]*,\\s*'" + esc + "'|t\\('" + esc + "'\\)|(?:hintKey|titleKey)=\"" + esc + "\")")
    return !used.test(sources)
  })
  expect(orphans).toEqual([])
})
