import type { UiState } from '../audio/usePlayer'
import { usePlayerSelector } from '../audio/usePlayer'
import type { Lang } from '../lib/types'
import { tr } from '../lib/i18n'
import { Art } from './Art'
import { Icon } from './Icon'

interface Props {
  state: UiState
  lang: Lang
  onOpen: () => void
  onToggle: () => void
  onNext: () => void
}

export function MiniPlayer({ state, lang, onOpen, onToggle, onNext }: Props) {
  const currentTime = usePlayerSelector((s) => s.currentTime)
  const duration = usePlayerSelector((s) => s.duration)
  if (!state.current) return null
  const progress = duration ? Math.min(100, (currentTime / duration) * 100) : 0
  return (
    <div className="mini" id="mini" onClick={onOpen}>
      <Art id={state.current.id} className="mini-art" />
      <div className="mini-txt">
        <div className="mini-title">{state.current.title}</div>
        <div className="mini-sub">{state.current.artist || ''}</div>
      </div>
      <button className={'mini-btn morph' + (state.playing ? ' on' : '')} aria-label={state.playing ? tr(lang, 'pause') : tr(lang, 'play')}
        onClick={(e) => { e.stopPropagation(); onToggle() }}>
        <Icon name="play" size={18} className="i-play" />
        <Icon name="pause" size={18} className="i-pause" />
      </button>
      <button className="mini-next" aria-label={tr(lang, 'next')}
        onClick={(e) => { e.stopPropagation(); onNext() }}>
        <Icon name="next" size={18} />
      </button>
      <div className="mini-progress"><span style={{ width: progress + '%' }} /></div>
    </div>
  )
}
