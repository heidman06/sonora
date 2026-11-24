import { it, expect } from 'vitest'
import { formatTime } from './time'

it('formats mm:ss', () => {
  expect(formatTime(0)).toBe('0:00')
  expect(formatTime(65)).toBe('1:05')
  expect(formatTime(230)).toBe('3:50')
  expect(formatTime(-3)).toBe('0:00')
  expect(formatTime(NaN)).toBe('0:00')
})
