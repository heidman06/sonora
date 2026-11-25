import { memo } from 'react'
import type { Lang, Track } from '../lib/types'
import { tr } from '../lib/i18n'
import { formatTime } from '../lib/time'
import { Icon } from './Icon'
import { Art } from './Art'

interface Props {
  track: Track
  index: number
  lang: Lang
  liked: boolean
  isCurrent?: boolean
  removable?: boolean
  menu?: boolean
}

// No per-row closures: actions are delegated by TrackList via data-action (design N1/S0).
export const TrackRow = memo(function TrackRow({ track, index, lang, liked, isCurrent, removable, menu }: Props) {
  return (
    <div className={'track' + (isCurrent ? ' is-current playing' : '')} role="button" tabIndex={0} data-action="play" data-id={track.id} data-index={index}>
      <Art id={track.id} className="track-art" />
      <button className="tplay" type="button" data-action={isCurrent ? 'toggle' : 'play'} data-id={track.id} data-index={index} aria-label={tr(lang, isCurrent ? 'pause' : 'play')}>
        <Icon name={isCurrent ? 'pause' : 'play'} size={14} />
      </button>
      {isCurrent && <span className="eq" aria-hidden="true"><i /><i /><i /></span>}
      <div className="track-txt">
        <div className="track-title">{track.title}</div>
        <div className="track-sub">{track.artist || ''}</div>
      </div>
      <button className={'tlike' + (liked ? ' liked' : '')} type="button" data-action="like" data-id={track.id} data-index={index} aria-label={tr(lang, 'liked')}>
        <Icon name={liked ? 'heartFill' : 'heart'} size={15} />
      </button>
      {menu && <button className="tmenu" type="button" data-action="menu" data-id={track.id} data-index={index} aria-label={tr(lang, 'menu')}><Icon name="dots" size={15} /></button>}
      {removable && <button className="tremove" type="button" data-action="remove" data-id={track.id} data-index={index} aria-label={tr(lang, 'remove')}><Icon name="trash" size={14} /></button>}
      <span className="track-dur">{formatTime(track.duration || 0)}</span>
    </div>
  )
})