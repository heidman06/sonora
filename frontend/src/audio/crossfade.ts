// F3 — Crossfade en mode direct uniquement (module additif, défaut off).
// this.media reste l'unique élément lié à l'état (invariant I2) ; le
// secondaire n'est qu'un pré-roll, jamais référencé par l'état. HLS exclu :
// flux continu unique côté serveur, offsets désynchronisés par un 2e élément.
// Pas de gapless strict : coupure possible ≤ 100 ms au relais (design F3).

export interface ArmInput {
  hls: boolean
  fade: number
  repeat: string
  hasNext: boolean
  duration: number
  currentTime: number
  sleepMode: string
  sleepHalted: boolean
}

/** Armement à T−N : toutes les gardes du design F3. */
export function shouldArm(o: ArmInput): boolean {
  return !o.hls && o.fade > 0 && o.repeat !== 'one' && o.hasNext && o.sleepMode !== 'end' && !o.sleepHalted &&
    o.duration > 2 * o.fade && o.currentTime >= o.duration - o.fade
}

/** Rampe égal-power : a = cos(t·π/2) (primaire), b = sin(t·π/2) (secondaire). */
export function equalPower(t: number): { a: number; b: number } {
  const c = Math.max(0, Math.min(1, t))
  return { a: Math.cos(c * Math.PI / 2), b: Math.sin(c * Math.PI / 2) }
}

export interface CrossfadeHost {
  media: HTMLAudioElement
  read(): { hls: boolean; repeat: string; currentTime: number; duration: number; volume: number; sleepMode: string; sleepEndsAt: number; sleepHalted: boolean }
  /** Réglage utilisateur en secondes (0 = off). */
  fade(): number
  next(): { id: string; duration: number } | null
  /**
   * Prépare l'élément secondaire : blob IDB si disponible, sinon l'URL
   * '/musique/dl/<id>' fournie par le module ; volume 0. Le module appelle
   * play() et surveille waiting/error. null = pré-roll impossible → pas de
   * fondu, le chemin 'ended → playNext(true)' existant prend le relais.
   */
  startSecondary(src: string): Promise<HTMLAudioElement | null>
  /** Relais final : this.media reprend la même source à `position` (host). */
  relay(position: number): Promise<void>
  /** Abandon : pause secondaire + volume primaire restauré (host). */
  abandon(): void
  /** Applique les volumes primaire/secondaire à chaque tick de rampe. */
  rampTick(a: number, b: number): void
}

/**
 * Listener 'timeupdate' additif ; armement → pré-roll secondaire → rampe
 * setInterval 100 ms sur fade secondes (égal-power) → host.relay(position du
 * secondaire) puis cleanup. waiting/error du secondaire → host.abandon().
 * Retourne une fonction de nettoyage (abandon si fondu en cours).
 */
export function installCrossfade(host: CrossfadeHost): () => void {
  let active = false
  let gaveUp = false
  let ramp: ReturnType<typeof setInterval> | null = null
  let secondary: HTMLAudioElement | null = null
  let onBad: (() => void) | null = null

  const stopRamp = (): void => { if (ramp !== null) { clearInterval(ramp); ramp = null } }
  const detach = (): void => {
    if (secondary && onBad) {
      secondary.removeEventListener('waiting', onBad)
      secondary.removeEventListener('error', onBad)
    }
    secondary = null
    onBad = null
  }
  const finish = (): void => { stopRamp(); detach(); active = false }
  const fail = (): void => {
    if (!active) return
    gaveUp = true
    finish()
    host.abandon()
  }

  const arm = async (): Promise<void> => {
    const nxt = host.next()
    const fade = host.fade()
    const base = host.read().volume
    if (!nxt || fade <= 0) { active = false; return }
    let sec: HTMLAudioElement | null = null
    try { sec = await host.startSecondary('/musique/dl/' + encodeURIComponent(nxt.id)) } catch { sec = null }
    if (!active) return // nettoyé pendant l'attente
    if (!sec) { active = false; gaveUp = true; return }
    secondary = sec
    try { sec.volume = 0 } catch { /* noop */ }
    onBad = (): void => fail()
    sec.addEventListener('waiting', onBad)
    sec.addEventListener('error', onBad)
    try { await sec.play() } catch { fail(); return }
    if (!active) return
    const startedAt = Date.now()
    ramp = setInterval(() => {
      const t = Math.min(1, (Date.now() - startedAt) / (fade * 1000))
      const { a, b } = equalPower(t)
      host.rampTick(base * a, base * b)
      if (t >= 1) {
        stopRamp()
        const pos = secondary ? secondary.currentTime : 0
        const settle = (ok: boolean): void => {
          if (!active) return // déjà abandonné/nettoyé pendant le relais
          if (!ok) gaveUp = true
          finish()
          if (!ok) host.abandon()
        }
        void Promise.resolve().then(() => host.relay(pos)).then(() => settle(true), () => settle(false))
      }
    }, 100)
  }

  const tick = (): void => {
    const fade = host.fade()
    if (fade <= 0) { gaveUp = false; return }
    const s = host.read()
    if (s.sleepHalted) { if (active) fail(); return }
    if (s.sleepMode !== 'off' && s.sleepMode !== 'end' && Date.now() >= s.sleepEndsAt) { if (active) fail(); return }
    const hasNext = host.next() !== null
    const armable = shouldArm({ hls: s.hls, fade, repeat: s.repeat, hasNext, duration: s.duration, currentTime: s.currentTime, sleepMode: s.sleepMode, sleepHalted: s.sleepHalted })
    if (!armable) { gaveUp = false; return } // nouveau titre / seek arrière → réarmement possible
    if (active || gaveUp) return
    active = true
    void arm()
  }

  host.media.addEventListener('timeupdate', tick)
  return () => {
    host.media.removeEventListener('timeupdate', tick)
    if (active) fail()
    else finish()
  }
}
