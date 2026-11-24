import type { PlayerState } from '../audio/engine'
import { Icon } from './Icon'

interface Props {
  state: PlayerState
  onOpen: () => void
  onToggle: () => void
  onNext: () => void
}

export function MiniPlayer({ state, onOpen, onToggle, onNext }: Props) {
  if (!state.current) return null
  const progress = state.duration ? Math.min(100, (state.currentTime / state.duration) * 100) : 0
  return (
    <div className="mini" id="mini" onClick={onOpen}>
      <img className="mini-art" src={state.current.thumb || ''} alt="" />
      <div className="mini-txt">
        <div className="mini-title">{state.current.title}</div>
        <div className="mini-sub">{state.current.artist || ''}</div>
      </div>
      <button className="mini-btn" aria-label={state.playing ? 'Pause' : 'Play'}
        onClick={(e) => { e.stopPropagation(); onToggle() }}>
        <Icon name={state.playing ? 'pause' : 'play'} size={18} />
      </button>
      <button className="mini-next" aria-label="Suivant"
        onClick={(e) => { e.stopPropagation(); onNext() }}>
        <Icon name="next" size={18} />
      </button>
      <div className="mini-progress"><span style={{ width: progress + '%' }} /></div>
    </div>
  )
}
