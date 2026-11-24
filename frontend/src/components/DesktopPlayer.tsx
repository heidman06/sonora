import type { PlayerState } from '../audio/engine'
import type { Lang } from '../lib/types'
import { tr } from '../lib/i18n'
import { Icon } from './Icon'

interface Props {
  state: PlayerState
  lang: Lang
  onOpen: () => void
  onToggle: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (ratio: number) => void
  onVolume: (value: number) => void
  onQueue: () => void
  onLike: () => void
  fmt: (seconds: number) => string
}

export function DesktopPlayer({ state, lang, onOpen, onToggle, onNext, onPrev, onSeek, onVolume, onQueue, onLike, fmt }: Props) {
  const track = state.current
  if (!track) return null
  const liked = state.likes.some((x) => x.id === track.id)
  const ratio = state.duration ? state.currentTime / state.duration : 0
  return (
    <footer className="desktop-player">
      <button className="dp-track" onClick={onOpen} disabled={!track}>
        <img className="dp-art" src={track?.thumb || ''} alt="" />
        <span className="dp-meta">
          <span className="dp-title">{track?.title || '—'}</span>
          <span className="dp-artist">{track?.artist || tr(lang, 'nowPlaying')}</span>
        </span>
      </button>
      <div className="dp-center">
        <div className="dp-controls">
          <button className="dp-btn" aria-label="Précédent" onClick={onPrev}><Icon name="prev" size={19} /></button>
          <button className="dp-play" aria-label={state.playing ? tr(lang, 'pause') : tr(lang, 'play')} onClick={onToggle}>
            <Icon name={state.playing ? 'pause' : 'play'} size={20} />
          </button>
          <button className="dp-btn" aria-label="Suivant" onClick={onNext}><Icon name="next" size={19} /></button>
        </div>
        <div className="dp-seek">
          <span>{fmt(state.currentTime)}</span>
          <input type="range" min={0} max={1000} value={Math.round(ratio * 1000)} aria-label="Progression"
            onChange={(e) => onSeek(Number(e.target.value) / 1000)} />
          <span>{fmt(state.duration)}</span>
        </div>
      </div>
      <div className="dp-tools">
        <button className={'dp-icon' + (liked ? ' on' : '')} aria-label={tr(lang, 'favorites')} onClick={onLike}><Icon name={liked ? 'heartFill' : 'heart'} size={18} /></button>
        <button className="dp-icon" aria-label={tr(lang, 'queue')} onClick={onQueue}><Icon name="queue" size={18} /></button>
        <div className="dp-vol">
          <Icon name={state.volume === 0 ? 'volumeOff' : 'volume'} size={17} />
          <input type="range" min={0} max={100} value={Math.round(state.volume * 100)} aria-label={tr(lang, 'volume')}
            onChange={(e) => onVolume(Number(e.target.value) / 100)} />
        </div>
      </div>
    </footer>
  )
}
