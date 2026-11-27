import { useEffect, useRef } from 'react'
import { engine } from '../audio/engine'
import type { Track } from './types'

// Pré-résolution spéculative : les titres visibles à l'écran sont résolus côté serveur
// (yt-dlp -g) pour que le tap parte d'une URL déjà prête (~100 ms au lieu de ~4 s).
const vus = new Set<string>()

export function usePrefetch(tracks: Track[] | undefined | null): void {
  const premier = useRef(true)
  useEffect(() => {
    if (!tracks || !tracks.length) return
    const ids = tracks
      .map((t) => t.id)
      .filter((id) => id && !id.startsWith('ep') && !vus.has(id))
      .slice(0, 3)
    if (!ids.length) return
    for (const id of ids) vus.add(id)
    const d = window.setTimeout(() => {
      void engine.api.prefetchAudio(ids).catch(() => {})
      premier.current = false
    }, 250)
    return () => window.clearTimeout(d)
  }, [tracks])
}
