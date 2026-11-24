import { useState } from 'react'
import type { UiState } from '../audio/usePlayer'
import type { Lang, PlaylistSummary, Track } from '../lib/types'
import { tr } from '../lib/i18n'
import { Icon } from './Icon'

interface Props {
  state: UiState
  lang: Lang
  track?: Track | null
  onClose: () => void
  onAdd: (playlistId: number, track: Track) => void
  onCreate: (name: string) => Promise<PlaylistSummary>
}

export function AddSheet(props: Props) {
  const { state, lang, onClose, onAdd, onCreate } = props
  const [name, setName] = useState('')
  const current = props.track ?? state.current
  return (
    <div className="sheet small-sheet" id="addsheet">
      <div className="sheet-grab" />
      <button className="sheet-close" aria-label={tr(lang, 'close')} onClick={onClose}><Icon name="close" size={16} /></button>
      <h2 className="queue-title">{tr(lang, 'addToPlaylist')}</h2>
      <div className="queue-list">
        {state.playlists.map((playlist) => (
          <button className="q-row" key={playlist.id} onClick={() => current && onAdd(playlist.id, current)}>
            <span className="track-art" style={{ display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.08)' }}><Icon name="note" size={18} /></span>
            <div className="track-txt">
              <div className="track-title">{playlist.name}</div>
              <div className="track-sub">{playlist.count} {tr(lang, 'tracks')}</div>
            </div>
          </button>
        ))}
        {!state.playlists.length && <div className="empty">{tr(lang, 'addToPlaylistEmpty')}</div>}
      </div>
      <div className="add-new">
        <input value={name} placeholder={tr(lang, 'newPlaylist')} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" onClick={async () => {
          const clean = name.trim()
          if (!clean) return
          await onCreate(clean)
          setName('')
        }}>{tr(lang, 'create')}</button>
      </div>
    </div>
  )
}
