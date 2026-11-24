// Ambient dynamique (design V1/S4) : extraction 32×32 → 48 buckets (12 hue × 2 sat × 2 val),
// top-3 à hue ≥ 30°, clamp luminance WCAG [0.18;0.60] sur l'opaque. Cache de PROMESSES
// in-flight Map<id, Promise> plafonné 64 FIFO (C15) : StrictMode/transitions rapides = 1 extraction/id.
// applyAmbient(null) = reset explicite aux valeurs initiales (C9).
import { artOf } from './img'

export type RGB = [number, number, number]
export interface Palette { c1: RGB; c2: RGB; c3: RGB }

// Valeurs initiales = rgba du halo global (app.css body::before) ; d3 = 3e teinte de
// l'ancien .ambient supprimé. applyAmbient(null) y revient explicitement.
export const INITIAL = {
  d1: 'rgba(250, 45, 85, 0.10)',
  d2: 'rgba(120, 70, 255, 0.08)',
  d3: 'rgba(255, 110, 60, 0.12)',
} as const

const srgb = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
export function luma(c: RGB): number { return 0.2126 * srgb(c[0]) + 0.7152 * srgb(c[1]) + 0.0722 * srgb(c[2]) }
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

// Clamp luminance dans [0.18;0.60] par mélange vers blanc/noir (bissection 24 itérations).
export function clampLuma(c: RGB): RGB {
  const L = luma(c)
  const round = (x: RGB): RGB => [Math.round(x[0]), Math.round(x[1]), Math.round(x[2])]
  if (L >= 0.18 && L <= 0.60) return round(c)
  const target = L < 0.18 ? 0.18 : 0.60
  const toward: RGB = L < 0.18 ? [255, 255, 255] : [0, 0, 0]
  const increasing = L < 0.18
  let lo = 0, hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if ((luma(mix(c, toward, mid)) < target) === increasing) lo = mid; else hi = mid
  }
  return round(mix(c, toward, (lo + hi) / 2))
}

// Cœur pur : RGBA 32×32 (1024 px) → Palette | null. Filtrage alpha<128 + bandes noires
// (luma<40, sat<12). Poids count×(0.4+sat), top 3 buckets à hue circulaire ≥ 30°.
export function paletteFromPixels(data: ArrayLike<number>): Palette | null {
  const count = new Float64Array(48)
  const weight = new Float64Array(48)
  const rs = new Float64Array(48), gs = new Float64Array(48), bs = new Float64Array(48)
  const hueSum = new Float64Array(48)
  const n = Math.floor(data.length / 4)
  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3]
    if (a < 128) continue
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const l = (r * 299 + g * 587 + b * 114) / 1000
    const sat = max - min
    if (l < 40 || sat < 12) continue
    const v = max / 255
    const s = max === 0 ? 0 : sat / max
    let h: number
    if (max === r) h = ((g - b) / sat) % 6
    else if (max === g) h = (b - r) / sat + 2
    else h = (r - g) / sat + 4
    h = (h * 60 + 360) % 360
    const idx = Math.min(11, Math.floor(h / 30)) * 4 + (s >= 0.5 ? 2 : 0) + (v >= 0.5 ? 1 : 0)
    count[idx] += 1
    weight[idx] += 0.4 + s
    rs[idx] += r; gs[idx] += g; bs[idx] += b
    hueSum[idx] += h
  }
  const order = Array.from({ length: 48 }, (_, i) => i).filter((i) => count[i] > 0).sort((a, b) => weight[b] - weight[a])
  const picks: RGB[] = []
  const hues: number[] = []
  for (const idx of order) {
    const hue = hueSum[idx] / count[idx]
    if (hues.some((p) => { const d = Math.abs(p - hue); return Math.min(d, 360 - d) < 30 })) continue
    picks.push(clampLuma([rs[idx] / count[idx], gs[idx] / count[idx], bs[idx] / count[idx]]))
    hues.push(hue)
    if (picks.length === 3) break
  }
  if (!picks.length) return null
  return { c1: picks[0], c2: picks[1] ?? picks[0], c3: picks[2] ?? picks[0] }
}

export type Extractor = (id: string) => Promise<Palette | null>
const cache = new Map<string, Promise<Palette | null>>()
const MAX = 64

// miss → promesse créée AVANT tout await ; hit < 1 ms ; FIFO 64 (C15).
export function paletteFor(id: string, extract: Extractor = extractForId): Promise<Palette | null> {
  const hit = cache.get(id)
  if (hit) return hit
  const p = extract(id)
  cache.set(id, p)
  // Échec non mémorisé au-delà de l'in-flight : un /api/img momentanément coupé
  // ne fige pas le halo sur INITIAL jusqu'au reload (revue finale 17).
  void p.then((res) => { if (res === null && cache.get(id) === p) cache.delete(id) })
  if (cache.size > MAX) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  return p
}

// Extraction DOM : Image mq (320×180) → canvas 32×32 willReadFrequently → rAF post-onload.
// try/catch : canvas tainted / cross-origin / absent → null (reset INITIAL).
function extractForId(id: string): Promise<Palette | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(null); return }
    const img = new Image()
    img.onload = () => {
      requestAnimationFrame(() => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = 32; canvas.height = 32
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) { resolve(null); return }
          ctx.drawImage(img, 0, 0, 32, 32)
          const t0 = performance.now()
          const pal = paletteFromPixels(ctx.getImageData(0, 0, 32, 32).data)
          ;(globalThis as unknown as { __sonoraPaletteMs?: number }).__sonoraPaletteMs = performance.now() - t0
          resolve(pal)
        } catch { resolve(null) }
      })
    }
    img.onerror = () => resolve(null)
    img.src = artOf(id, 'mq')
  })
}

const fmt = (c: RGB) => 'rgb(' + c[0] + ', ' + c[1] + ', ' + c[2] + ')'
export function applyAmbient(p: Palette | null): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (!p) {
    root.style.setProperty('--dyn-1', INITIAL.d1)
    root.style.setProperty('--dyn-2', INITIAL.d2)
    root.style.setProperty('--dyn-3', INITIAL.d3)
    return
  }
  root.style.setProperty('--dyn-1', fmt(p.c1))
  root.style.setProperty('--dyn-2', fmt(p.c2))
  root.style.setProperty('--dyn-3', fmt(p.c3))
}
