import { it, expect } from 'vitest'
import { normalizeText, matchesQuery } from './normalize'

it('accent-insensitive', () => {
  expect(normalizeText('Éléphant')).toBe('elephant')
  expect(matchesQuery({ title: 'Bésame Mucho', artist: 'Andrea' }, 'besame')).toBe(true)
  expect(matchesQuery({ title: 'X', artist: 'Y' }, '')).toBe(true)
  expect(matchesQuery({ title: 'X', artist: 'Y' }, 'zz')).toBe(false)
})
