// F2 — Minuterie de sommeil (module additif : zéro diff bindMedia/playNext).
//
// IMPORTANT — host.read() doit renvoyer le temps RELATIF au titre courant
// (state.currentTime / state.duration du moteur), JAMAIS media.currentTime
// brut : en file HLS iOS, media.currentTime est la position absolue dans le
// flux continu et le mode 'end' se déclencherait au mauvais endroit. Le host
// fourni par engine lira donc l'état PlayerState (déjà relatif, cf. bindMedia).
//
// Limites honnêtes (design F2) : audio en pause + écran verrouillé, les timers
// peuvent être bridés par l'OS → arrêt possiblement tardif ; rattrapage au
// prochain timeupdate / visibilitychange / tick 15 s. Mode 'end' : arrêt
// ~0,4 s avant la fin réelle (granularité timeupdate), assumé.

export type SleepMode = 'off' | '15' | '30' | '45' | '60' | 'end'

/** Vrai uniquement pour un mode « minutes » dont l'échéance est atteinte. */
export function sleepDue(mode: SleepMode, endsAt: number, now: number): boolean {
  if (mode === 'off' || mode === 'end') return false
  return now >= endsAt
}

/** Vrai si la fin du titre est à ≤ 0,4 s (durée connue uniquement). */
export function endNear(currentTime: number, duration: number): boolean {
  return duration > 0 && duration - currentTime <= 0.4
}

export interface SleepHost {
  media: HTMLAudioElement
  /** Temps RELATIF au titre (état engine), pas media.currentTime en HLS. */
  read(): { currentTime: number; duration: number }
  get(): { mode: SleepMode; endsAt: number }
  /** Échéance minutes atteinte : pause + playing:false + toast (host). */
  expire(): void
  /** Mode 'end' : pause avant la fin → pas d'event 'ended' → pas de playNext. */
  endStop(): void
}

/**
 * Listener 'timeupdate' ADDITIF sur host.media + setInterval 15 s de
 * rattrapage + visibilitychange. Retourne une fonction de nettoyage.
 * expire() n'est appelé qu'une fois par échéance ; endStop() une fois par
 * approche de fin — un seek arrière réarme naturellement (recalcul par tick).
 */
export function installSleep(host: SleepHost): () => void {
  let expiredEndsAt: number | null = null
  let endStopped = false

  const tick = (): void => {
    const { mode, endsAt } = host.get()
    if (mode === 'off') { expiredEndsAt = null; endStopped = false; return }
    if (mode === 'end') {
      const { currentTime, duration } = host.read()
      if (endNear(currentTime, duration)) {
        if (!endStopped) { endStopped = true; host.endStop() }
      } else {
        endStopped = false
      }
      return
    }
    if (sleepDue(mode, endsAt, Date.now()) && expiredEndsAt !== endsAt) {
      expiredEndsAt = endsAt
      host.expire()
    }
  }

  // Filet arrière-plan : si le bridage OS fait manquer la fenêtre 0,4 s et laisse
  // 'ended' partir, on l'intercepte en capture (ancêtre) avant bindMedia/playNext.
  const onEnded = (e: Event): void => {
    if (host.get().mode !== 'end') return
    e.stopPropagation()
    host.endStop()
  }
  host.media.addEventListener('timeupdate', tick)
  const interval = setInterval(tick, 15000)
  const hasDoc = typeof document !== 'undefined'
  if (hasDoc) {
    document.addEventListener('visibilitychange', tick)
    document.addEventListener('ended', onEnded, true)
  }
  return () => {
    host.media.removeEventListener('timeupdate', tick)
    clearInterval(interval)
    if (hasDoc) {
      document.removeEventListener('visibilitychange', tick)
      document.removeEventListener('ended', onEnded, true)
    }
  }
}
