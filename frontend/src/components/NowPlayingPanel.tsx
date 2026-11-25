import { memo, useCallback, useEffect, useState } from 'react'
import type { UiState } from '../audio/usePlayer'
import { usePlayerSelector } from '../audio/usePlayer'
import { engine } from '../audio/engine'
import type { Lang, Track } from '../lib/types'
import { tr } from '../lib/i18n'
import { artOf } from '../lib/img'
import { fetchLyrics } from '../lib/lyrics'
import { parseLrc } from '../lib/lrc'
import { formatTime } from '../lib/time'
import { Icon } from './Icon'

interface Props { lang: Lang; state: UiState; onQueue: () => void }

// .np-row dépouillé = 6 éléments (design V3/C2a) : button > img + span.np-txt > (title + sub) + span.np-dur.
const NpRow = memo(function NpRow({ track, index, onPlay }: { track: Track; index: number; onPlay: (t: Track, i: number) => void }) {
  return (
    <button className="np-row" type="button" onClick={() => onPlay(track, index)}>
      <img className="np-art" src={artOf(track.id, 'mq')} alt="" loading="lazy" />
      <span className="np-txt">
        <span className="np-title">{track.title}</span>
        <span className="np-sub">{track.artist || ''}</span>
      </span>
      <span className="np-dur">{formatTime(track.duration || 0)}</span>
    </button>
  )
})

// Panneau >=1500 px (design V3/S8) : plafond 52 éléments, paroles 4 lignes (fetch caché IDB),
// file 5 rangs, 2 actions. Abonnement currentTime interne (1 render/s), lignes memo, App inchangé.
export function NowPlayingPanel({ lang, state, onQueue }: Props) {
  const currentTime = usePlayerSelector((s) => s.currentTime)
  const current = state.current
  const queue = state.queue
  const [lines, setLines] = useState<{ time: number; text: string }[]>([])
  useEffect(() => {
    if (!current) { setLines([]); return }
    let alive = true
    void fetchLyrics(current).then((rec) => { if (alive) setLines(rec.synced ? parseLrc(rec.synced) : []) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])
  const playRow = useCallback((t: Track, i: number) => { void engine.playTrack(t, queue, i) }, [queue])
  if (!current) return null
  let active = -1
  for (let i = 0; i < lines.length; i++) { if (lines[i].time <= currentTime) active = i; else break }
  const start = Math.max(0, active)
  const window4 = lines.slice(start, start + 4)
  const idx = queue.findIndex((t) => t.id === current.id)
  const nextRows = idx >= 0 ? queue.slice(idx + 1, idx + 6).map((t, i) => ({ t, i: idx + 1 + i })) : []
  return (
    <aside className="np-panel" id="np-panel">
      <img className="np-art" src={artOf(current.id, 'mq')} alt="" />
      <div className="np-meta">
        <div className="np-title">{current.title}</div>
        <div className="np-artist">{current.artist || ''}</div>
      </div>
      <div className="np-lyrics">
        {window4.length
          ? window4.map((line, i) => (
            <button key={start + i} type="button" className={'np-line' + (start + i === active ? ' on' : '')} onClick={() => engine.seekTo(line.time)}>{line.text}</button>
          ))
          : <div className="np-lyrics-none">{tr(lang, 'lyricsUnavailable')}</div>}
      </div>
      <div className="np-queue-head">{tr(lang, 'queue')}</div>
      <div className="np-queue">
        {nextRows.map(({ t, i }) => <NpRow key={t.id + i} track={t} index={i} onPlay={playRow} />)}
      </div>
      <div className="np-actions">
        <button className="np-action" type="button" aria-label={state.playing ? tr(lang, 'pause') : tr(lang, 'play')} onClick={() => engine.togglePlay()}>
          <Icon name={state.playing ? 'pause' : 'play'} size={18} />
        </button>
        <button className="np-action" type="button" aria-label={tr(lang, 'queue')} onClick={onQueue}>
          <Icon name="queue" size={18} />
        </button>
      </div>
    </aside>
  )
}
