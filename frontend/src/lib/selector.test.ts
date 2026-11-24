import { it, expect } from 'vitest'
import { createSelectorCache, shallowEqual } from './selector'

interface S { playing: boolean; currentTime: number; likes: string[] }
const base: S = { playing: false, currentTime: 0, likes: ['a'] }
const selectUi = (s: S) => ({ playing: s.playing, likes: s.likes })

it('same source twice returns identical reference', () => {
  const c = createSelectorCache<S, { playing: boolean; likes: string[] }>()
  const r1 = c.read(base, selectUi, shallowEqual)
  const r2 = c.read(base, selectUi, shallowEqual)
  expect(Object.is(r1, r2)).toBe(true)
})

it('100 fresh inline selectors, currentTime-only patch: same value reference', () => {
  const c = createSelectorCache<S, { playing: boolean; likes: string[] }>()
  let prev = c.read(base, (s) => ({ playing: s.playing, likes: s.likes }), shallowEqual)
  for (let i = 1; i <= 100; i++) {
    const src = { ...base, currentTime: i }
    const next = c.read(src, (s) => ({ playing: s.playing, likes: s.likes }), shallowEqual)
    expect(Object.is(next, prev)).toBe(true)
    prev = next
  }
})

it('playing patch yields a new reference', () => {
  const c = createSelectorCache<S, { playing: boolean; likes: string[] }>()
  const r1 = c.read(base, selectUi, shallowEqual)
  const r2 = c.read({ ...base, playing: true }, selectUi, shallowEqual)
  expect(Object.is(r1, r2)).toBe(false)
})

it('shallowEqual compares keys by identity', () => {
  const likes = ['a']
  expect(shallowEqual({ x: 1, likes }, { x: 1, likes })).toBe(true)
  expect(shallowEqual({ x: 1, likes }, { x: 2, likes })).toBe(false)
  expect(shallowEqual({ x: 1 }, { x: 1, y: 2 })).toBe(false)
  expect(shallowEqual(null, null)).toBe(true)
  expect(shallowEqual(null, {})).toBe(false)
})