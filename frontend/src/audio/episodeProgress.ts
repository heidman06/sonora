// Progression des épisodes : reprise, sauvegarde throttled, completed -> suivant. Pur helpers testables.
import type { Track } from '../lib/types'
export function resumePosition(p: { position: number; duration: number; completed: number } | null | undefined, duration: number): number | null {
  if (!p || p.completed) return null
  const pos = p.position || 0
  const dur = duration || p.duration || 0
  if (pos > 5 && (dur === 0 || pos < dur - 10)) return pos
  return null
}
export function isCompleted(pos: number, dur: number): boolean { return dur > 0 && pos / dur >= 0.95 }
export function attachEpisodeProgress(media: HTMLAudioElement, track: Track, api: { podProgress: (id: number) => Promise<{ progress: { position: number; duration: number; completed: number } | null }>; podSaveProgress: (id: number, p: number, d: number, c: boolean) => Promise<unknown> }, onCompleted: () => void): () => void {
  const epId = Number(track.id.replace(/^ep/, ''))
  let last = -1
  let done = false
  const save = (completed: boolean) => {
    const pos = media.currentTime || 0
    const dur = media.duration || track.duration || 0
    if (completed || Math.abs(pos - last) > 1) { last = pos; void api.podSaveProgress(epId, pos, dur, completed).catch(() => {}) }
  }
  const applyResume = () => {
    api.podProgress(epId).then(({ progress }) => {
      const pos = resumePosition(progress, media.duration || track.duration || 0)
      if (pos != null) { try { media.currentTime = pos } catch (e) { /* noop */ } }
    }).catch(() => {})
  }
  if (media.readyState >= 1) applyResume()
  else media.addEventListener('loadedmetadata', applyResume, { once: true })
  const onEnded = () => { done = true; save(true); onCompleted() }
  const onPause = () => { if (!done) save(false) }
  media.addEventListener('ended', onEnded)
  media.addEventListener('pause', onPause)
  const timer = window.setInterval(() => { if (!media.paused && !done) save(false) }, 15000)
  return () => { window.clearInterval(timer); media.removeEventListener('ended', onEnded); media.removeEventListener('pause', onPause); media.removeEventListener('loadedmetadata', applyResume); if (!done) save(false) }
}
