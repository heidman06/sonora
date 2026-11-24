import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// S1 / I7 — miroir des tokens app.css + composites couche/couche (pire cas pochette).
// Pur : aucun DOM. Vérifie WCAG AA >= 4.5 sur les 17 sites <= 13 px, dark + light,
// et >= 3 pour les icônes. Les tokens sont RELUS depuis app.css (pas de copie figée).

const SRC = dirname(fileURLToPath(import.meta.url))
type RGB = [number, number, number]

function parseColor(v: string): { rgb: RGB; a: number } {
  const s = v.trim()
  if (s.startsWith('#')) {
    const h = s.slice(1)
    return { rgb: [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)], a: 1 }
  }
  const m = /rgba?\(([^)]+)\)/.exec(s)
  if (!m) throw new Error('couleur illisible: ' + s)
  const p = m[1].split(',').map((x) => parseFloat(x.trim()))
  return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 }
}
const over = (fg: RGB, a: number, bg: RGB): RGB => [
  fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a),
]
const chan = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
const luma = (c: RGB) => 0.2126 * chan(c[0]) + 0.7152 * chan(c[1]) + 0.0722 * chan(c[2])
const ratio = (a: RGB, b: RGB) => { const l1 = luma(a); const l2 = luma(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) }

const css = readFileSync(join(SRC, '..', 'app.css'), 'utf8')
function vars(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}
const lightRe = /\[data-theme="light"\]\s*\{[^}]*\}/g
const lightBlocks = [...css.matchAll(lightRe)].map((m) => m[0])
const LIGHT = Object.assign({}, ...lightBlocks.map(vars)) as Record<string, string>
const DARK = vars(css.replace(lightRe, ''))

const tok = (t: Record<string, string>, k: string) => parseColor(t[k])

interface Site { name: string; px: number; text: { rgb: RGB; a: number }; bg: RGB }

function sites(theme: 'dark' | 'light'): Site[] {
  const T = theme === 'dark' ? DARK : LIGHT
  const txt = tok(T, 'txt'); const txt2 = tok(T, 'txt-2'); const txt3 = tok(T, 'txt-3')
  const accent = tok(T, 'accent'); const err = tok(T, 'err')
  const bg = tok(T, 'bg').rgb; const bg2 = tok(T, 'bg-2').rgb
  const glass1 = tok(T, 'glass-1')
  const art: RGB = theme === 'dark' ? [255, 255, 255] : [0, 0, 0]
  const glass = over(glass1.rgb, glass1.a, art)
  const sheetTop = theme === 'dark' ? over([9, 9, 13], 0.72, art) : over([247, 247, 249], 0.72, art)
  const barTop = theme === 'dark' ? over([20, 20, 26], 0.82, art) : over([255, 255, 255], 0.82, art)
  const sidebar = theme === 'dark' ? over([255, 255, 255], 0.055, bg) : over([255, 255, 255], 0.7, bg)
  // #queue est forcée sombre (mus-queue.css) + tokens dark scopés en light → toujours tokens dark.
  const qTxt3 = tok(DARK, 'txt-3'); const queueBg: RGB = [12, 13, 18]
  const chipBg = over(accent.rgb, 0.08, bg)
  const s = (name: string, px: number, text: { rgb: RGB; a: number }, bgc: RGB): Site => ({ name, px, text, bg: bgc })
  return [
    s('tab', 10.5, txt2, glass),
    s('seek-times', 11.5, txt2, sheetTop),
    s('dp-seek', 10.5, txt2, barTop),
    s('dp-vol', 10.5, txt2, barTop),
    s('dp-artist', 11.5, txt2, barTop),
    s('side-label', 10.5, txt3, sidebar),
    s('side-playlist', 12.5, txt2, sidebar),
    s('side-empty', 12, txt2, sidebar),
    s('dl-pct', 11, accent, bg),
    s('track-dur', 12.5, txt3, bg),
    s('track-sub', 12, txt2, bg),
    s('card-sub', 12.5, txt2, bg),
    s('mini-sub', 12, txt2, glass),
    s('q-row-dur', 12, qTxt3, queueBg),
    s('chip-mini', 11, accent, chipBg),
    s('vol-ios', 11.5, txt2, sheetTop),
    s('form-err', 13, err, bg2),
  ]
}

for (const theme of ['dark', 'light'] as const) {
  it('AA >= 4.5 sur les 17 sites <= 13 px (' + theme + ')', () => {
    const bad: string[] = []
    for (const site of sites(theme)) {
      const composite = over(site.text.rgb, site.text.a, site.bg)
      const r = ratio(composite, site.bg)
      if (r < 4.5) bad.push(site.name + ' ' + site.px + 'px = ' + r.toFixed(2))
    }
    expect(bad).toEqual([])
  })
  it('icônes >= 3 (' + theme + ')', () => {
    const T = theme === 'dark' ? DARK : LIGHT
    const bg = tok(T, 'bg').rgb
    const txt3 = tok(T, 'txt-3'); const accent = tok(T, 'accent')
    expect(ratio(over(txt3.rgb, txt3.a, bg), bg)).toBeGreaterThanOrEqual(3)
    expect(ratio(accent.rgb, bg)).toBeGreaterThanOrEqual(3)
  })
}

it('tokens clés recalculés (glass-1 .78, txt-2 .68/.66, accent light #c81e42)', () => {
  expect(tok(DARK, 'glass-1').a).toBeCloseTo(0.78, 5)
  expect(tok(LIGHT, 'glass-1').a).toBeCloseTo(0.78, 5)
  expect(tok(DARK, 'txt-2').a).toBeCloseTo(0.68, 5)
  expect(tok(LIGHT, 'txt-2').a).toBeCloseTo(0.66, 5)
  expect(tok(LIGHT, 'accent').rgb).toEqual([200, 30, 66])
})

it('mini/tabs couche/couche ~4.71 dark / ~5.22 light (gradient blanc supprimé)', () => {
  const gd = over(tok(DARK, 'glass-1').rgb, 0.78, [255, 255, 255])
  const td = over(tok(DARK, 'txt-2').rgb, 0.68, gd)
  expect(ratio(td, gd)).toBeGreaterThan(4.5)
  const gl = over(tok(LIGHT, 'glass-1').rgb, 0.78, [0, 0, 0])
  const tl = over(tok(LIGHT, 'txt-2').rgb, 0.66, gl)
  expect(ratio(tl, gl)).toBeGreaterThan(4.5)
})
