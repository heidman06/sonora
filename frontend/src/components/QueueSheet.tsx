import type { PlayerState } from '../audio/engine'
import type { Track } from '../lib/types'
import { Icon } from './Icon'
import { engine } from '../audio/engine'

interface Props {
  lang: import('../lib/types').Lang
  state: PlayerState
  onClose: () => void
  onPlay: (track: Track, queue: Track[], index: number) => void
  fmt: (seconds: number) => string
}

export function QueueSheet({ lang, state, onClose, onPlay, fmt }: Props) {
  return (
    <div className="sheet queue-sheet" id="queue">
      <div className="sheet-grab" />
      <button className="sheet-close" aria-label="Fermer" onClick={onClose}><Icon name="close" size={16} /></button>
      <h2 className="queue-title">{lang === 'fr' ? 'File d’attente' : lang === 'es' ? 'Cola' : 'Queue'}</h2>
      <div className="queue-list">
        {state.queue.map((track, index) => (
          <div className={'q-row' + (state.current?.id === track.id ? ' playing' : '')} key={track.id + index} role="button" tabIndex={0}
            onClick={() => onPlay(track, state.queue, index)}
            onKeyDown={(e) => { if (e.key === 'Enter') onPlay(track, state.queue, index) }}>
            <img className="track-art" src={track.thumb || ''} alt="" loading="lazy" />
            <div className="track-txt">
              <div className="track-title">{track.title}</div>
              <div className="track-sub">{track.artist || ''}</div>
            </div>
            <span className="track-dur">{fmt(track.duration || 0)}</span>
            <span className="q-tools">
              <button className="q-btn" aria-label="Monter" onClick={(e) => { e.stopPropagation(); engine.moveQueue(index, Math.max(0, index - 1)) }}><Icon name="up" size={14} /></button>
              <button className="q-btn" aria-label="Descendre" onClick={(e) => { e.stopPropagation(); engine.moveQueue(index, Math.min(state.queue.length - 1, index + 1)) }}><Icon name="down" size={14} /></button>
              <button className="q-btn" aria-label="Retirer" onClick={(e) => { e.stopPropagation(); engine.removeFromQueue(index) }}><Icon name="close" size={13} /></button>
            </span>
          </div>
        ))}
        {!state.queue.length && <div className="empty">File vide</div>}
      </div>
    </div>
  )
}
