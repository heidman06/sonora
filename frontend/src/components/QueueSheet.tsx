import { useState } from 'react'
import type { UiState } from '../audio/usePlayer'
import type { Track } from '../lib/types'
import { tr } from '../lib/i18n'
import { Art } from './Art'
import { Icon } from './Icon'
import { engine } from '../audio/engine'

interface Props {
  lang: import('../lib/types').Lang
  state: UiState
  onClose: () => void
  onPlay: (track: Track, queue: Track[], index: number) => void
  fmt: (seconds: number) => string
}

export function QueueSheet({ lang, state, onClose, onPlay, fmt }: Props) {
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  return (
    <div className="sheet queue-sheet" id="queue">
      <div className="sheet-grab" />
      <button className="sheet-close" aria-label={tr(lang, 'close')} onClick={onClose}><Icon name="close" size={16} /></button>
      <h2 className="queue-title">{tr(lang, 'queue')}</h2>
      <div className="queue-head-tools">
        <button onClick={() => engine.clearQueue()} disabled={!state.queue.length}>{tr(lang, 'clearQueue')}</button>
        <button onClick={() => setSaving((v) => !v)} disabled={!state.queue.length}>{tr(lang, 'saveQueue')}</button>
      </div>
      {saving && (
        <div className="add-new" style={{ padding: '0 4px 10px' }}>
          <input value={name} placeholder={tr(lang, 'newPlaylist')} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary" onClick={async () => { await engine.saveQueueAsPlaylist(name); setName(''); setSaving(false) }}>{tr(lang, 'create')}</button>
        </div>
      )}
      <div className="queue-list">
        {state.queue.map((track, index) => (
          <div className={'q-row' + (state.current?.id === track.id ? ' playing' : '')} key={track.id + index} role="button" tabIndex={0}
            onClick={() => onPlay(track, state.queue, index)}
            onKeyDown={(e) => { if (e.key === 'Enter') onPlay(track, state.queue, index) }}>
            <Art id={track.id} className="track-art" />
            <div className="track-txt">
              <div className="track-title">{track.title}</div>
              <div className="track-sub">{track.artist || ''}</div>
            </div>
            <span className="track-dur">{fmt(track.duration || 0)}</span>
            <span className="q-tools">
              <button className="q-btn" aria-label={tr(lang, 'moveUp')} onClick={(e) => { e.stopPropagation(); engine.moveQueue(index, Math.max(0, index - 1)) }}><Icon name="up" size={14} /></button>
              <button className="q-btn" aria-label={tr(lang, 'moveDown')} onClick={(e) => { e.stopPropagation(); engine.moveQueue(index, Math.min(state.queue.length - 1, index + 1)) }}><Icon name="down" size={14} /></button>
              <button className="q-btn" aria-label={tr(lang, 'remove')} onClick={(e) => { e.stopPropagation(); engine.removeFromQueue(index) }}><Icon name="close" size={13} /></button>
            </span>
          </div>
        ))}
        {!state.queue.length && <div className="empty">{tr(lang, 'queueEmpty')}</div>}
      </div>
    </div>
  )
}
