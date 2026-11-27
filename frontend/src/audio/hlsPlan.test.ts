import { describe, it, expect } from 'vitest'
import { hlsPlan, HLS_WINDOW } from './hlsPlan'

const t = (id: string, duration = 200) => ({ id, title: id, artist: '', thumb: '', duration })
const list = Array.from({ length: 112 }, (_, i) => t('id' + i, i === 3 ? 0 : 200))

describe('hlsPlan', () => {
  it('index < fenêtre : queue complète, index conservé', () => {
    const p = hlsPlan(list, 5)
    expect(p.index).toBe(5)
    expect(p.queue.length).toBe(HLS_WINDOW)
    expect(p.queue[5].id).toBe('id5')
  })

  it('index >= fenêtre : fenêtre démarre au titre choisi', () => {
    const p = hlsPlan(list, 80)
    expect(p.index).toBe(0)
    expect(p.queue[0].id).toBe('id80')
    expect(p.queue.length).toBe(32)
  })

  it('titre choisi toujours à l’offset attendu', () => {
    const p = hlsPlan(list, 40)
    expect(p.queue[p.index].id).toBe('id40')
  })
})
