import { expect, it } from 'vitest'
import { parseLrc } from './lrc'

it('multi-timestamps : une entrée par timestamp, même texte', () => {
  expect(parseLrc('[00:10.00][00:20.50]Hello')).toEqual([
    { time: 10, text: 'Hello' },
    { time: 20.5, text: 'Hello' },
  ])
})

it('tri par time', () => {
  const r = parseLrc('[00:30.00]trois\n[00:10.00]un\n[00:20.00]deux')
  expect(r.map((l) => l.time)).toEqual([10, 20, 30])
  expect(r.map((l) => l.text)).toEqual(['un', 'deux', 'trois'])
})

it('tags méta ignorés', () => {
  const r = parseLrc('[ar:Artiste]\n[ti:Titre]\n[al:Album]\n[offset:500]\n[00:01.00]Seule ligne')
  expect(r).toEqual([{ time: 1, text: 'Seule ligne' }])
})

it('ligne horodatée sans texte conservée avec texte vide', () => {
  expect(parseLrc('[00:05.00]')).toEqual([{ time: 5, text: '' }])
  expect(parseLrc('[00:05.00]   ')).toEqual([{ time: 5, text: '' }])
})

it('lignes sans timestamp ignorées ; texte vide → []', () => {
  expect(parseLrc('')).toEqual([])
  expect(parseLrc('\n\nblabla\n[ar:x]')).toEqual([])
})

it('précision mm:ss.xx, fraction courte et CRLF', () => {
  expect(parseLrc('[01:02.25]a\r\n[00:01.5]b')).toEqual([
    { time: 1.5, text: 'b' },
    { time: 62.25, text: 'a' },
  ])
})

it('minutes longues et fraction 3 chiffres', () => {
  expect(parseLrc('[123:45.678]x')).toEqual([{ time: 123 * 60 + 45.678, text: 'x' }])
})

it('timestamps séparés par des espaces', () => {
  expect(parseLrc('[00:10.00] [00:20.00] Hey')).toEqual([
    { time: 10, text: 'Hey' },
    { time: 20, text: 'Hey' },
  ])
})
