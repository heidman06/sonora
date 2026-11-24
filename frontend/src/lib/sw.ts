// F4 — Enregistrement du SW maison, uniquement en PROD (jamais dev/HMR).
// La bannière de MAJ est pilotée par onUpdate (état swUpdateReady du moteur) ;
// pas de reload forcé : applyUpdate() est appelé par un clic utilisateur.

export function registerSw(onUpdate: () => void): void {
  if (!import.meta.env.PROD) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/musique/sw.js', { scope: '/musique/' }).then((reg) => {
    // MAJ déjà installée pendant que la page était fermée → bannière d'emblée.
    if (reg.waiting && navigator.serviceWorker.controller) onUpdate()
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing
      if (!installing) return
      installing.addEventListener('statechange', () => {
        // installed + controller existant = mise à jour (pas une 1re installation).
        if (installing.state === 'installed' && navigator.serviceWorker.controller) onUpdate()
      })
    })
  }).catch(() => { /* SW optionnel : l'app fonctionne sans */ })
}

/** Clic « Recharger » : le SW en attente prend la main, puis reload. */
export function applyUpdate(): void {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.controller?.postMessage('SKIP_WAITING')
  }
  location.reload()
}

/** Dernier recours : désenregistrement + purge des caches sonora-*. */
export async function resetApp(): Promise<void> {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister()))
  }
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k.startsWith('sonora-')).map((k) => caches.delete(k)))
  }
}
