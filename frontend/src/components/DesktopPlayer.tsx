import { useState, type CSSProperties } from 'react'
import { Art } from './Art'
import type { UiState } from '../audio/usePlayer'
import { usePlayerSelector } from '../audio/usePlayer'
import { engine } from '../audio/engine'
import { RatePicker } from './RatePicker'
import type { Lang } from '../lib/types'
import { tr } from '../lib/i18n'
import { Icon } from './Icon'
import { LikeBurst } from './LikeBurst'

interface Props {
  state: UiState
  lang: Lang
  onOpen: () => void
  onToggle: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (ratio: number) => void
  onVolume: (value: number) => void
  onQueue: () => void
  onLike: () => void
  onRepeat: () => void
  onShuffle: () => void
  onAdd: () => void
  onDownload: () => void
  fmt: (seconds: number) => string
}

export function DesktopPlayer({ state, lang, onOpen, onToggle, onNext, onPrev, onSeek, onVolume, onQueue, onLike, onRepeat, onShuffle, onAdd, onDownload, fmt }: Props) {
  const [drag, setDrag] = useState<number | null>(null)
  const [showRate, setShowRate] = useState(false)
  const [hoverSeek, setHoverSeek] = useState(false)
  const currentTime = usePlayerSelector((s) => s.currentTime)
  const duration = usePlayerSelector((s) => s.duration)
  const volume = usePlayerSelector((s) => s.volume)
  const track = state.current
  if (!track) return null
  const commit = () => { if (drag !== null) { onSeek(drag / 1000); setDrag(null) } }
  const liked = state.likes.some((x) => x.id === track.id)
  const ratio = duration ? currentTime / duration : 0
  const hoverCapable = window.matchMedia('(pointer: fine) and (min-width: 1000px)').matches
  const rest = Math.max(0, duration - currentTime)
  return (
    <footer className="desktop-player">
      <button className="dp-track" onClick={onOpen} disabled={!track}>
        <Art id={track.id} className="dp-art" />
        <span className="dp-meta">
          <span className="dp-title">{track?.title || '—'}</span>
          <span className="dp-artist">{track?.artist || tr(lang, 'nowPlaying')}</span>
        </span>
      </button>
      <div className="dp-center">
        <div className="dp-controls">
          <button className="dp-btn" aria-label={tr(lang, 'seekBack')} onClick={() => engine.seekBy(-10)}><Icon name="back10" size={15} /></button>
          <button className="dp-btn" aria-label={tr(lang, 'prev')} onClick={onPrev}><Icon name="prev" size={19} /></button>
          <button className={'dp-play morph' + (state.playing ? ' on' : '')} aria-label={state.playing ? tr(lang, 'pause') : tr(lang, 'play')} onClick={onToggle}>
            <Icon name="play" size={20} className="i-play" />
            <Icon name="pause" size={20} className="i-pause" />
          </button>
          <button className="dp-btn" aria-label={tr(lang, 'next')} onClick={onNext}><Icon name="next" size={19} /></button>
          <button className="dp-btn" aria-label={tr(lang, 'seekFwd')} onClick={() => engine.seekBy(10)}><Icon name="fwd10" size={15} /></button>
        </div>
        <div className="dp-seek" onPointerEnter={hoverCapable ? () => setHoverSeek(true) : undefined} onPointerLeave={hoverCapable ? () => setHoverSeek(false) : undefined}>
          <span>{fmt(currentTime)}</span>
          <input type="range" min={0} max={1000} value={Math.round(drag ?? ratio * 1000)} aria-label={tr(lang, 'progression')}
            aria-valuetext={fmt(currentTime) + ' / ' + fmt(duration) + ' · ' + tr(lang, 'remaining') + ' ' + fmt(rest)}
            style={{ '--fill': (ratio * 100) + '%' } as CSSProperties}
            onChange={(e) => setDrag(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} />
          <span>{hoverSeek ? '−' + fmt(rest) : fmt(duration)}</span>
        </div>
      </div>
      <div className="dp-tools">
        <button className={'dp-icon' + (state.shuffle ? ' on' : '')} aria-label={tr(lang, 'shuffle')} onClick={onShuffle}><Icon name="shuffle" size={17} /></button>
        <button className={'dp-icon' + (state.repeat !== 'off' ? ' on' : '')} aria-label={tr(lang, 'repeat')} onClick={onRepeat}><Icon name={state.repeat === 'one' ? 'repeat1' : 'repeat'} size={17} /></button>
        <button className={'dp-icon' + (liked ? ' on' : '')} aria-label={tr(lang, 'favorites')} onClick={onLike}><Icon name={liked ? 'heartFill' : 'heart'} size={18} /><LikeBurst active={liked} /></button>
        <button className="dp-icon" aria-label={tr(lang, 'addToPlaylist')} onClick={onAdd}><Icon name="plus" size={18} /></button>
        <button className="dp-icon" aria-label={tr(lang, 'download')} onClick={onDownload} disabled={!!state.downloading[track.id] || state.downloads.some((d) => d.id === track.id)}><Icon name={state.downloads.some((d) => d.id === track.id) ? 'check' : 'download'} size={18} /></button>
        <button className="dp-icon" aria-label={tr(lang, 'queue')} onClick={onQueue}><Icon name="queue" size={18} /></button>
        <button className={'dp-icon' + (state.rate !== 1 ? ' on' : '')} aria-label={tr(lang, 'rate')} onClick={() => setShowRate((v) => !v)}><Icon name="gauge" size={17} /></button>
        {showRate && <RatePicker lang={lang} rate={state.rate} hidden={state.hls} onPick={(r) => engine.setRate(r)} />}
        <div className="dp-vol">
          <Icon name={volume === 0 ? 'volumeOff' : 'volume'} size={17} />
          <input type="range" min={0} max={100} value={Math.round(volume * 100)} aria-label={tr(lang, 'volume')}
            style={{ '--fill': (volume * 100) + '%' } as CSSProperties}
            onChange={(e) => onVolume(Number(e.target.value) / 100)} />
        </div>
      </div>
    </footer>
  )
}
