import { it, expect } from 'vitest'
import { paletteFromPixels, clampLuma, luma, paletteFor, INITIAL } from './palette'

function px(colors: [number, number, number][], alpha = 255): Uint8ClampedArray {
  const a = new Uint8ClampedArray(colors.length * 4)
  colors.forEach((c, i) => { a[i * 4] = c[0]; a[i * 4 + 1] = c[1]; a[i * 4 + 2] = c[2]; a[i * 4 + 3] = alpha })
  return a
}
const rep = (c: [number, number, number], n: number) => Array.from({ length: n }, () => c)

it('top-3 buckets à hue >= 30° : 3 teintes distinctes', () => {
  const data = px([...rep([220, 40, 40], 300), ...rep([40, 200, 60], 300), ...rep([50, 60, 220], 300)])
  const p = paletteFromPixels(data)
  expect(p).not.toBeNull()
  if (!p) return
  expect(p.c1).not.toEqual(p.c2)
  expect(p.c2).not.toEqual(p.c3)
  for (const c of [p.c1, p.c2, p.c3]) {
    expect(luma(c)).toBeGreaterThanOrEqual(0.17)
    expect(luma(c)).toBeLessThanOrEqual(0.61)
  }
})

it('bandes noires / gris filtrées → null', () => {
  expect(paletteFromPixels(px(rep([10, 10, 10], 200)))).toBeNull()
  expect(paletteFromPixels(px(rep([128, 128, 128], 200)))).toBeNull()
})

it('alpha < 128 filtré → null', () => {
  expect(paletteFromPixels(px(rep([220, 40, 40], 200), 0))).toBeNull()
})

it('clamp luminance [0.18;0.60]', () => {
  expect(luma(clampLuma([5, 5, 5]))).toBeGreaterThanOrEqual(0.17)
  expect(luma(clampLuma([255, 255, 255]))).toBeLessThanOrEqual(0.61)
  const mid = clampLuma([120, 80, 90])
  expect(luma(mid)).toBeGreaterThanOrEqual(0.17)
  expect(luma(mid)).toBeLessThanOrEqual(0.61)
})

it('dédup promesses : 2 appels = 1 extraction (C15)', async () => {
  let calls = 0
  const ex = async () => { calls++; return null }
  const p1 = paletteFor('dedup-id', ex)
  const p2 = paletteFor('dedup-id', ex)
  expect(p1).toBe(p2)
  await Promise.all([p1, p2])
  expect(calls).toBe(1)
})

it('cache FIFO 64 : la 65e entrée évince la plus ancienne', async () => {
  let n = 0
  const ex = async () => { n++; return null }
  for (let i = 0; i < 65; i++) await paletteFor('fifo-' + i, ex)
  expect(n).toBe(65)
  await paletteFor('fifo-0', ex)
  expect(n).toBe(66)
})

it('INITIAL = rgba du halo fixe (reset explicite C9)', () => {
  expect(INITIAL.d1).toBe('rgba(250, 45, 85, 0.10)')
  expect(INITIAL.d2).toBe('rgba(120, 70, 255, 0.08)')
})
