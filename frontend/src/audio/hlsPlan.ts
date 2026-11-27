import type { Track } from '../lib/types'

// Fenêtre HLS : on démarre TOUJOURS la playlist au titre choisi (offset 0).
// Sinon un index > 60 ou une durée manquante (duration=0) décale les offsets et
// fait jouer un autre titre (souvent déjà terminé).
export const HLS_WINDOW = 60

export function hlsPlan(queue: Track[], index: number): { queue: Track[]; index: number } {
  const i = Math.max(0, Math.min(Number.isFinite(index) ? index : 0, Math.max(0, queue.length - 1)))
  const debut = i >= HLS_WINDOW ? i : 0
  return { queue: queue.slice(debut, debut + HLS_WINDOW), index: i - debut }
}
