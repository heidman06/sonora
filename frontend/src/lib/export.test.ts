import { it, expect } from 'vitest'
import { toM3U, toJSON } from './export'
import type { PlaylistDetail } from './types'

const p: PlaylistDetail = { id: 1, name: 'P', tracks: [
  { id: 'aaaaaaaaaaa', title: 'Hello, World', artist: 'A\nB', duration: 200 },
  { id: 'bbbbbbbbbbb', title: 'Été', artist: 'C', duration: 0 },
] }

it('M3U keeps order, escapes newlines, keeps title commas', () => {
  const m = toM3U(p)
  const lines = m.split('\n')
  expect(lines[0]).toBe('#EXTM3U')
  expect(lines[1]).toBe('#EXTINF:200,A B - Hello, World')
  expect(lines[2]).toBe('https://www.youtube.com/watch?v=aaaaaaaaaaa')
  expect(lines[3]).toBe('#EXTINF:0,C - Été')
  expect(m.endsWith('\n')).toBe(true)
  expect(m.includes('\r')).toBe(false)
})

it('JSON round-trip preserves order', () => {
  const back = JSON.parse(toJSON(p)) as PlaylistDetail
  expect(back.tracks.map((t) => t.id)).toEqual(p.tracks.map((t) => t.id))
})