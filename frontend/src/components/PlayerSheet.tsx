import type { PlayerState } from '../audio/engine'
import type { Lang } from '../lib/types'
import { tr } from '../lib/i18n'
import { Icon } from './Icon'

interface Props {
  state: PlayerState
  lang: Lang
  liked: boolean
  onClose: () => void
  onToggle: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (ratio: number) => void
  onVolume: (value: number) => void
  onLike: () => void
  onAdd: () => void
  onDownload: () => void
  onQueue: () => void
  onRepeat: () => void
  onShuffle: () => void
  fmt: (seconds: number) => string
}

export function PlayerSheet(props: Props) {
  const { state, lang, liked } = props
  const { current } = state
  if (!current) return null
  const ratio = state.duration ? state.currentTime / state.duration : 0
  const downloaded = state.downloads.some((d) => d.id === current.id)
  const downloading = !!state.downloading[current.id]
  return (
    <div className="sheet" id="player">
      <div className="sheet-bg" style={current.thumb ? { backgroundImage: 'url("' + current.thumb + '")' } : undefined} />
      <div className="sheet-grab" />
      <button className="sheet-close" aria-label={tr(lang, 'close')} onClick={props.onClose}><Icon name="close" size={16} /></button>
      <div className="player">
        <img className="player-art" src={current.thumb || ''} alt="" />
        <div className="player-meta">
          <div className="player-title">{current.title}</div>
          <div className="player-artist">{current.artist || ''}</div>
        </div>
        <div className="seek">
          <input type="range" min={0} max={1000} value={Math.round(ratio * 1000)} aria-label="Progression"
            onChange={(e) => props.onSeek(Number(e.target.value) / 1000)} />
          <div className="seek-times">
            <span>{props.fmt(state.currentTime)}</span>
            <span>{props.fmt(state.duration)}</span>
          </div>
        </div>
        <div className="controls">
          <button className={'ctl small' + (state.shuffle ? ' on' : '')} aria-label={tr(lang, 'shuffle')} onClick={props.onShuffle}><Icon name="shuffle" size={19} /></button>
          <button className="ctl" aria-label="Précédent" onClick={props.onPrev}><Icon name="prev" size={24} /></button>
          <button className="ctl main" aria-label={state.playing ? tr(lang, 'pause') : tr(lang, 'play')} onClick={props.onToggle}>
            <Icon name={state.playing ? 'pause' : 'play'} size={30} />
          </button>
          <button className="ctl" aria-label="Suivant" onClick={props.onNext}><Icon name="next" size={24} /></button>
          <button className={'ctl small' + (state.repeat !== 'off' ? ' on' : '')} aria-label={tr(lang, 'repeat')} onClick={props.onRepeat}>
            <Icon name={state.repeat === 'one' ? 'repeat1' : 'repeat'} size={19} />
          </button>
        </div>
        <div className="vol">
          <button className="vol-ico" aria-label={tr(lang, 'volume')}><Icon name={state.volume === 0 ? 'volumeOff' : 'volume'} size={18} /></button>
          <input type="range" min={0} max={100} value={Math.round(state.volume * 100)} aria-label={tr(lang, 'volume')}
            onChange={(e) => props.onVolume(Number(e.target.value) / 100)} />
        </div>
        <div className="foot-actions">
          <button className={'foot-btn' + (liked ? ' on' : '')} aria-label={tr(lang, 'favorites')} onClick={props.onLike}>
            <Icon name={liked ? 'heartFill' : 'heart'} size={19} />
          </button>
          <button className="foot-btn" aria-label={tr(lang, 'addToPlaylist')} onClick={props.onAdd}><Icon name="plus" size={19} /></button>
          <button className="foot-btn" aria-label={tr(lang, 'download')} onClick={props.onDownload} disabled={downloading || downloaded}>
            <Icon name={downloaded ? 'check' : 'download'} size={19} />
          </button>
        </div>
        <div className="player-foot">
          <button className="queue-btn" onClick={props.onQueue}>{tr(lang, 'queue')} <span>({state.queue.length})</span></button>
        </div>
      </div>
    </div>
  )
}
