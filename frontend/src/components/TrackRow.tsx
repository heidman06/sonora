import type { Track } from '../lib/types'
import { Icon } from './Icon'

interface Props {
  track: Track
  index: number
  queue: Track[]
  onPlay: (track: Track, queue: Track[], index: number) => void
  liked: boolean
  onLike: (track: Track) => void
  isCurrent?: boolean
  durationLabel: (seconds: number) => string
  onRemove?: (track: Track) => void
}

export function TrackRow({ track, index, queue, onPlay, liked, onLike, isCurrent, durationLabel, onRemove }: Props) {
  return (
    <div className={'track' + (isCurrent ? ' is-current' : '')} role="button" tabIndex={0}
      onClick={() => onPlay(track, queue, index)}
      onKeyDown={(e) => { if (e.key === 'Enter') onPlay(track, queue, index) }}>
      <img className="track-art" src={track.thumb || ''} alt="" loading="lazy" />
      <div className="track-txt">
        <div className="track-title">{track.title}</div>
        <div className="track-sub">{track.artist || ''}</div>
      </div>
      <button className={'tlike' + (liked ? ' liked' : '')} type="button"
        aria-label="Favori" onClick={(e) => { e.stopPropagation(); onLike(track) }}>
        <Icon name={liked ? 'heartFill' : 'heart'} size={15} />
      </button>
      {onRemove && <button className="tremove" type="button" aria-label="Retirer" onClick={(e) => { e.stopPropagation(); onRemove(track) }}><Icon name="trash" size={14} /></button>}
      <span className="track-dur">{durationLabel(track.duration || 0)}</span>
    </div>
  )
}
