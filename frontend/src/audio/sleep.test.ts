import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { endNear, installSleep, sleepDue } from './sleep'
import type { SleepHost, SleepMode } from './sleep'

describe('filet ended capture (revue finale 1)', () => {
  it('intercepte ended en capture seulement en mode end', () => {
    const handlers: Record<string, (e: { stopPropagation(): void }) => void> = {}
    const docStub = {
      addEventListener: (t: string, h: (e: { stopPropagation(): void }) => void, capture?: boolean) => { handlers[t + (capture ? ':cap' : '')] = h },
      removeEventListener: () => {},
    }
    ;(globalThis as unknown as { document?: unknown }).document = docStub
    const mediaStub = { addEventListener: () => {}, removeEventListener: () => {} }
    let mode: SleepMode = 'end'
    let endStops = 0
    const stop = installSleep({
      media: mediaStub as unknown as HTMLAudioElement,
      read: () => ({ currentTime: 0, duration: 0 }),
      get: () => ({ mode, endsAt: 0 }),
      expire: () => {},
      endStop: () => { endStops++ },
    })
    const h = handlers['ended:cap']
    expect(typeof h).toBe('function')
    let prop = 0
    h({ stopPropagation: () => { prop++ } })
    expect(endStops).toBe(1)
    expect(prop).toBe(1)
    mode = 'off'
    prop = 0
    endStops = 0
    h({ stopPropagation: () => { prop++ } })
    expect(endStops).toBe(0)
    expect(prop).toBe(0)
    stop()
    delete (globalThis as unknown as { document?: unknown }).document
  })
})

describe('sleepDue', () => {
  it('modes minutes : bornes now < / = / > endsAt', () => {
    for (const mode of ['15', '30', '45', '60'] as SleepMode[]) {
      expect(sleepDue(mode, 1000, 999)).toBe(false)
      expect(sleepDue(mode, 1000, 1000)).toBe(true)
      expect(sleepDue(mode, 1000, 1001)).toBe(true)
    }
  })
  it('off et end ne sont jamais dus', () => {
    expect(sleepDue('off', 0, 1e12)).toBe(false)
    expect(sleepDue('end', 0, 1e12)).toBe(false)
  })
})

describe('endNear', () => {
  it('durée inconnue ou nulle → jamais', () => {
    expect(endNear(0, 0)).toBe(false)
    expect(endNear(10, -1)).toBe(false)
  })
  it('borne 0,4 s inclusive', () => {
    // 1 − 0.6 = 0.4 exactement en flottants IEEE (99.6/100 introduirait une erreur d'arrondi).
    expect(endNear(0.6, 1)).toBe(true)
    expect(endNear(0.59, 1)).toBe(false)
    expect(endNear(100, 100)).toBe(true)
    expect(endNear(0, 100)).toBe(false)
    expect(endNear(0, 0.4)).toBe(true)
    expect(endNear(0, 0.41)).toBe(false)
  })
})

// installSleep : harnais pur node (EventTarget natif, pas de DOM), horloge mockée.
function makeHost(state: { mode: SleepMode; endsAt: number; currentTime: number; duration: number }) {
  const media = new EventTarget()
  const calls = { expire: 0, endStop: 0 }
  const host: SleepHost = {
    media: media as unknown as HTMLAudioElement,
    read: () => ({ currentTime: state.currentTime, duration: state.duration }),
    get: () => ({ mode: state.mode, endsAt: state.endsAt }),
    expire: () => { calls.expire += 1 },
    endStop: () => { calls.endStop += 1 },
  }
  return { media, calls, host, state }
}

describe('installSleep', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('mode minutes : expire au tick 15 s, une seule fois par échéance', () => {
    const { calls, host, state } = makeHost({ mode: '15', endsAt: Date.now() + 1000, currentTime: 10, duration: 200 })
    const stop = installSleep(host)
    vi.advanceTimersByTime(14000)
    expect(calls.expire).toBe(0)
    vi.advanceTimersByTime(1000)
    expect(calls.expire).toBe(1)
    vi.advanceTimersByTime(30000)
    expect(calls.expire).toBe(1) // même échéance → pas de spam
    state.endsAt = Date.now() + 1 // nouvelle échéance → réarmement
    vi.advanceTimersByTime(15000)
    expect(calls.expire).toBe(2)
    stop()
  })

  it('timeupdate déclenche expire sans attendre le tick 15 s', () => {
    const { media, calls, host } = makeHost({ mode: '30', endsAt: Date.now() - 1, currentTime: 5, duration: 200 })
    const stop = installSleep(host)
    media.dispatchEvent(new Event('timeupdate'))
    expect(calls.expire).toBe(1)
    stop()
  })

  it('mode end : endStop à ≤ 0,4 s, seek arrière réarme', () => {
    const { media, calls, host, state } = makeHost({ mode: 'end', endsAt: 0, currentTime: 50, duration: 100 })
    const stop = installSleep(host)
    media.dispatchEvent(new Event('timeupdate'))
    expect(calls.endStop).toBe(0)
    state.currentTime = 99.7
    media.dispatchEvent(new Event('timeupdate'))
    expect(calls.endStop).toBe(1)
    media.dispatchEvent(new Event('timeupdate')) // en pause près de la fin : pas de spam
    expect(calls.endStop).toBe(1)
    state.currentTime = 30 // seek arrière → réarmement naturel
    media.dispatchEvent(new Event('timeupdate'))
    expect(calls.endStop).toBe(1)
    state.currentTime = 99.9
    media.dispatchEvent(new Event('timeupdate'))
    expect(calls.endStop).toBe(2)
    stop()
  })

  it('mode off : aucun effet', () => {
    const { media, calls, host } = makeHost({ mode: 'off', endsAt: 0, currentTime: 99.9, duration: 100 })
    const stop = installSleep(host)
    media.dispatchEvent(new Event('timeupdate'))
    vi.advanceTimersByTime(60000)
    expect(calls.expire).toBe(0)
    expect(calls.endStop).toBe(0)
    stop()
  })

  it('visibilitychange rattrape une échéance manquée', () => {
    const doc = new EventTarget() as EventTarget & { visibilityState: string }
    doc.visibilityState = 'visible'
    vi.stubGlobal('document', doc)
    const { calls, host } = makeHost({ mode: '45', endsAt: Date.now() - 1, currentTime: 0, duration: 10 })
    const stop = installSleep(host)
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(calls.expire).toBe(1)
    stop()
  })

  it('nettoyage : plus aucun tick après stop', () => {
    const { media, calls, host } = makeHost({ mode: '15', endsAt: Date.now(), currentTime: 0, duration: 10 })
    const stop = installSleep(host)
    stop()
    vi.advanceTimersByTime(60000)
    media.dispatchEvent(new Event('timeupdate'))
    expect(calls.expire).toBe(0)
  })
})
