import type { Lang, Track } from '../lib/types'
import { tr } from '../lib/i18n'
import { Icon } from './Icon'

interface Props {
  track: Track
  lang: Lang
  onClose: () => void
  onPlayNext: (t: Track) => void
  onEnqueue: (t: Track) => void
  onAdd: (t: Track) => void
  onRadio: (t: Track) => void
}

// Menu ⋯ par titre (design échelle C1, features F6) : chaque action ferme la feuille.
export function ActionSheet({ track, lang, onClose, onPlayNext, onEnqueue, onAdd, onRadio }: Props) {
  if (track.kind === 'episode') return null
  const rows: Array<{ key: string; icon: 'next' | 'queue' | 'plus' | 'radio'; run: (t: Track) => void }> = [
    { key: 'playNext', icon: 'next', run: onPlayNext },
    { key: 'addToQueue', icon: 'queue', run: onEnqueue },
    { key: 'addToPlaylist', icon: 'plus', run: onAdd },
    { key: 'startRadio', icon: 'radio', run: onRadio },
  ]
  return (
    <div className="sheet small-sheet" id="actionsheet">
      <div className="sheet-grab" />
      <button className="sheet-close" aria-label={tr(lang, 'close')} onClick={onClose}><Icon name="close" size={16} /></button>
      <h2 className="queue-title">{track.title}</h2>
      <div className="queue-list">
        {rows.map((row) => (
          <button className="q-row" key={row.key} type="button" style={{ width: '100%', textAlign: 'left' }}
            onClick={() => { row.run(track); onClose() }}>
            <Icon name={row.icon} size={17} />
            <div className="track-txt"><div className="track-title">{tr(lang, row.key)}</div></div>
          </button>
        ))}
      </div>
    </div>
  )
}
