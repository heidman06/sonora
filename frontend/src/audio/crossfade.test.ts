import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { equalPower, installCrossfade, shouldArm } from './crossfade'
import type { ArmInput, CrossfadeHost } from './crossfade'

const ok: ArmInput = { hls: false, fade: 6, repeat: 'off', hasNext: true, duration: 100, currentTime: 94, sleepMode: 'off', sleepHalted: false }

describe('shouldArm', () => {
  it('armable à T−N (borne inclusive)', () => {
    expect(shouldArm(ok)).toBe(true)
    expect(shouldArm({ ...ok, currentTime: 100 })).toBe(true)
  })
  it('chaque garde bloque', () => {
    expect(shouldArm({ ...ok, hls: true })).toBe(false)
    expect(shouldArm({ ...ok, fade: 0 })).toBe(false)
    expect(shouldArm({ ...ok, fade: -3 })).toBe(false)
    expect(shouldArm({ ...ok, repeat: 'one' })).toBe(false)
    expect(shouldArm({ ...ok, hasNext: false })).toBe(false)
    expect(shouldArm({ ...ok, duration: 12 })).toBe(false) // == 2×fade → refusé
    expect(shouldArm({ ...ok, duration: 11 })).toBe(false)
    expect(shouldArm({ ...ok, currentTime: 93.9 })).toBe(false)
  })
  it('sleep fin de titre bloque le fondu (revue finale 2)', () => {
    expect(shouldArm({ ...ok, sleepMode: 'end' })).toBe(false)
    expect(shouldArm({ ...ok, sleepMode: '15' })).toBe(true)
    expect(shouldArm({ ...ok, sleepHalted: true })).toBe(false)
  })
  it('repeat all autorisé ; durée strictement > 2×fade', () => {
    expect(shouldArm({ ...ok, repeat: 'all' })).toBe(true)
    expect(shouldArm({ ...ok, duration: 12.1 })).toBe(true)
  })
})

describe('equalPower', () => {
  it('bornes 0 et 1', () => {
    expect(equalPower(0)).toEqual({ a: 1, b: 0 })
    const one = equalPower(1)
    expect(one.a).toBeCloseTo(0, 10)
    expect(one.b).toBeCloseTo(1, 10)
  })
  it('milieu : a = b = √2/2 ; puissance conservée sur [0,1]', () => {
    const mid = equalPower(0.5)
    expect(mid.a).toBeCloseTo(Math.SQRT1_2, 10)
    expect(mid.b).toBeCloseTo(Math.SQRT1_2, 10)
    for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const { a, b } = equalPower(t)
      expect(a * a + b * b).toBeCloseTo(1, 10)
    }
  })
  it('clamp hors [0,1]', () => {
    expect(equalPower(-1)).toEqual(equalPower(0))
    expect(equalPower(2).b).toBeCloseTo(1, 10)
    expect(equalPower(2).a).toBeCloseTo(0, 10)
  })
})

// installCrossfade : harnais pur node (EventTarget natif), horloge mockée.
interface FakeSec extends EventTarget { currentTime: number; volume: number; play(): Promise<void> }

function makeSec(): FakeSec {
  const sec = new EventTarget() as FakeSec
  sec.currentTime = 0
  sec.volume = 1
  sec.play = async () => {}
  return sec
}

function harness(opts: { fade?: number; hls?: boolean; repeat?: string; hasNext?: boolean; duration?: number; currentTime?: number; volume?: number; sec?: FakeSec | null } = {}) {
  const media = new EventTarget()
  const state = {
    hls: opts.hls ?? false,
    repeat: opts.repeat ?? 'off',
    currentTime: opts.currentTime ?? 198,
    duration: opts.duration ?? 200,
    volume: opts.volume ?? 0.8,
    sleepMode: 'off',
    sleepEndsAt: 0,
    sleepHalted: false,
  }
  const sec = opts.sec === undefined ? makeSec() : opts.sec
  const calls = {
    startSecondary: vi.fn(async (_src: string): Promise<HTMLAudioElement | null> => sec as unknown as HTMLAudioElement | null),
    relay: vi.fn(async (_pos: number) => {}),
    abandon: vi.fn(),
    rampTick: vi.fn((_a: number, _b: number) => {}),
  }
  const host: CrossfadeHost = {
    media: media as unknown as HTMLAudioElement,
    read: () => ({ ...state }),
    fade: () => opts.fade ?? 2,
    next: () => (opts.hasNext ?? true) ? { id: 'next1', duration: 200 } : null,
    startSecondary: calls.startSecondary,
    relay: calls.relay,
    abandon: calls.abandon,
    rampTick: calls.rampTick,
  }
  return { media, state, sec, calls, host }
}

const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0)
  await vi.advanceTimersByTimeAsync(0)
}

describe('installCrossfade', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('armement à T−N, rampe 100 ms égal-power puis relais à la position du secondaire', async () => {
    const h = harness() // fade 2 s, duration 200, currentTime 198, volume 0.8
    const stop = installCrossfade(h.host)
    h.media.dispatchEvent(new Event('timeupdate'))
    await flush()
    expect(h.calls.startSecondary).toHaveBeenCalledTimes(1)
    expect(h.calls.startSecondary).toHaveBeenCalledWith('/musique/dl/next1')
    expect((h.sec as FakeSec).volume).toBe(0)
    await vi.advanceTimersByTimeAsync(1000)
    expect(h.calls.relay).not.toHaveBeenCalled()
    h.media.dispatchEvent(new Event('timeupdate')) // pas de double armement pendant le fondu
    await flush()
    expect(h.calls.startSecondary).toHaveBeenCalledTimes(1)
    ;(h.sec as FakeSec).currentTime = 1.9
    await vi.advanceTimersByTimeAsync(1000)
    expect(h.calls.relay).toHaveBeenCalledTimes(1)
    expect(h.calls.relay).toHaveBeenCalledWith(1.9)
    const ticks = h.calls.rampTick.mock.calls
    expect(ticks.length).toBe(20) // 2 s / 100 ms
    const first = ticks[0]
    expect(first[0]).toBeGreaterThan(0.7) // primaire ≈ volume au départ
    expect(first[0]).toBeLessThan(0.8)
    expect(first[1]).toBeLessThan(0.1) // secondaire ≈ 0
    const last = ticks[ticks.length - 1]
    expect(last[0]).toBeCloseTo(0, 5)
    expect(last[1]).toBeCloseTo(0.8, 5)
    stop()
  })

  it('HLS → jamais armé', async () => {
    const h = harness({ hls: true })
    const stop = installCrossfade(h.host)
    h.media.dispatchEvent(new Event('timeupdate'))
    await vi.advanceTimersByTimeAsync(100)
    expect(h.calls.startSecondary).not.toHaveBeenCalled()
    stop()
  })

  it('fade off → jamais armé', async () => {
    const h = harness({ fade: 0 })
    const stop = installCrossfade(h.host)
    h.media.dispatchEvent(new Event('timeupdate'))
    await vi.advanceTimersByTimeAsync(100)
    expect(h.calls.startSecondary).not.toHaveBeenCalled()
    stop()
  })

  it('waiting du secondaire → abandon, rampe stoppée, pas de relais', async () => {
    const h = harness()
    const stop = installCrossfade(h.host)
    h.media.dispatchEvent(new Event('timeupdate'))
    await flush()
    await vi.advanceTimersByTimeAsync(500)
    const n = h.calls.rampTick.mock.calls.length
    expect(n).toBeGreaterThan(0)
    ;(h.sec as FakeSec).dispatchEvent(new Event('waiting'))
    expect(h.calls.abandon).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(3000)
    expect(h.calls.rampTick.mock.calls.length).toBe(n)
    expect(h.calls.relay).not.toHaveBeenCalled()
    stop()
  })

  it('error du secondaire → abandon', async () => {
    const h = harness()
    const stop = installCrossfade(h.host)
    h.media.dispatchEvent(new Event('timeupdate'))
    await flush()
    ;(h.sec as FakeSec).dispatchEvent(new Event('error'))
    expect(h.calls.abandon).toHaveBeenCalledTimes(1)
    stop()
  })

  it('startSecondary null → pas de fondu, pas de retry en boucle', async () => {
    const h = harness({ sec: null })
    const stop = installCrossfade(h.host)
    h.media.dispatchEvent(new Event('timeupdate'))
    await flush()
    h.media.dispatchEvent(new Event('timeupdate'))
    h.media.dispatchEvent(new Event('timeupdate'))
    await flush()
    expect(h.calls.startSecondary).toHaveBeenCalledTimes(1)
    expect(h.calls.rampTick).not.toHaveBeenCalled()
    expect(h.calls.relay).not.toHaveBeenCalled()
    stop()
  })

  it('relais rejeté → abandon', async () => {
    const h = harness()
    h.calls.relay.mockRejectedValueOnce(new Error('relay ko'))
    const stop = installCrossfade(h.host)
    h.media.dispatchEvent(new Event('timeupdate'))
    await flush()
    await vi.advanceTimersByTimeAsync(2000)
    await flush()
    expect(h.calls.relay).toHaveBeenCalledTimes(1)
    expect(h.calls.abandon).toHaveBeenCalledTimes(1)
    stop()
  })

  it('nettoyage en plein fondu → abandon + timers stoppés', async () => {
    const h = harness()
    const stop = installCrossfade(h.host)
    h.media.dispatchEvent(new Event('timeupdate'))
    await vi.advanceTimersByTimeAsync(300)
    stop()
    expect(h.calls.abandon).toHaveBeenCalledTimes(1)
    const n = h.calls.rampTick.mock.calls.length
    await vi.advanceTimersByTimeAsync(3000)
    expect(h.calls.rampTick.mock.calls.length).toBe(n)
    expect(h.calls.relay).not.toHaveBeenCalled()
  })
})
