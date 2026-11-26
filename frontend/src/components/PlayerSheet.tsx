import { useRef, useEffect, useState, type CSSProperties } from 'react'
import type { UiState } from '../audio/usePlayer'
import { usePlayerSelector } from '../audio/usePlayer'
import { IS_IOS } from '../audio/engine'
import { artOf } from '../lib/img'
import { Art } from './Art'
import { LyricsPanel } from './LyricsPanel'
import { SleepPicker } from './SleepPicker'
import { RatePicker } from './RatePicker'
import { engine } from '../audio/engine'
import type { Lang } from '../lib/types'
import { tr } from '../lib/i18n'
import { Icon } from './Icon'
import { LikeBurst } from './LikeBurst'

interface Props {
  state: UiState
  lang: Lang
  liked: boolean
  closing?: boolean
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

function SleepCountdown({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const left = Math.max(0, Math.round((endsAt - now) / 1000))
  const m = Math.floor(left / 60)
  const s = left % 60
  return <span className="sleep-count">{m + ':' + (s < 10 ? '0' : '') + s}</span>
}

export function PlayerSheet(props: Props) {
  const { state, lang, liked } = props
  const { current } = state
  const currentTime = usePlayerSelector((s) => s.currentTime)
  const duration = usePlayerSelector((s) => s.duration)
  const volume = usePlayerSelector((s) => s.volume)
  const [drag, setDrag] = useState<number | null>(null)
  const [showLyrics, setShowLyrics] = useState(false)
  useEffect(() => {
    if (!showLyrics) return
    const t = window.setTimeout(() => {
      const sheet = document.querySelector('#player')
      const panel = document.querySelector('#player .player-panels')
      if (!sheet || !panel) return
      const target = panel.getBoundingClientRect().top - sheet.getBoundingClientRect().top + sheet.scrollTop - 16
      sheet.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
    }, 60)
    return () => window.clearTimeout(t)
  }, [showLyrics])
  const [showSleep, setShowSleep] = useState(false)
  const [showRate, setShowRate] = useState(false)
  const [hoverSeek, setHoverSeek] = useState(false)
  const prevVolume = useRef(0.8)
  if (!current) return null
  const ratio = duration ? currentTime / duration : 0
  const downloaded = state.downloads.some((d) => d.id === current.id)
  const downloading = !!state.downloading[current.id]
  const commit = () => { if (drag !== null) { props.onSeek(drag / 1000); setDrag(null) } }
  const hoverCapable = window.matchMedia('(pointer: fine) and (min-width: 1000px)').matches
  const rest = Math.max(0, duration - currentTime)
  // Mute réel (C6) : prevVolume mémorisé avant early-return ; clic volume>0 → 0, clic 0 → prev (défaut .8).
  const toggleMute = () => {
    if (volume > 0) { prevVolume.current = volume; props.onVolume(0) }
    else props.onVolume(prevVolume.current || 0.8)
  }
  return (
    <div className={'sheet' + (props.closing ? ' closing' : '')} id="player">
      <div className="sheet-bg" style={current.id ? { backgroundImage: 'url("' + artOf(current.id, 'mq') + '")' } : undefined} />
      <div className="player-halo" />
      <div className="sheet-grab" />
      <button className="sheet-close" aria-label={tr(lang, 'close')} onClick={props.onClose}><Icon name="close" size={16} /></button>
      <div className="player">
        <Art id={current.id} className="player-art" />
        <div className="player-meta">
          <div className="player-title">{current.title}</div>
          <div className="player-artist">{current.artist || ''}</div>
          {state.sleep.mode !== 'off' && state.sleep.mode !== 'end' && state.sleep.endsAt > 0 && <SleepCountdown endsAt={state.sleep.endsAt} />}
        </div>
        <div className="seek" onPointerEnter={hoverCapable ? () => setHoverSeek(true) : undefined} onPointerLeave={hoverCapable ? () => setHoverSeek(false) : undefined}>
          <input type="range" min={0} max={1000} value={Math.round(drag ?? ratio * 1000)} aria-label={tr(lang, 'progression')}
            aria-valuetext={props.fmt(currentTime) + ' / ' + props.fmt(duration) + ' · ' + tr(lang, 'remaining') + ' ' + props.fmt(rest)}
            style={{ '--fill': (ratio * 100) + '%' } as CSSProperties}
            onChange={(e) => setDrag(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} />
          <div className="seek-times">
            <span>{props.fmt(drag !== null ? (drag / 1000) * duration : currentTime)}</span>
            <span>{hoverSeek ? '−' + props.fmt(rest) : props.fmt(duration)}</span>
          </div>
        </div>
        <div className="controls">
          <button className={'ctl small' + (state.shuffle ? ' on' : '')} aria-label={tr(lang, 'shuffle')} onClick={props.onShuffle}><Icon name="shuffle" size={19} /></button>
          <button className="ctl" aria-label={tr(lang, 'prev')} onClick={props.onPrev}><Icon name="prev" size={24} /></button>
          <button className={'ctl main morph' + (state.playing ? ' on' : '')} aria-label={state.playing ? tr(lang, 'pause') : tr(lang, 'play')} onClick={props.onToggle}>
            <Icon name="play" size={30} className="i-play" />
            <Icon name="pause" size={30} className="i-pause" />
          </button>
          <button className="ctl" aria-label={tr(lang, 'next')} onClick={props.onNext}><Icon name="next" size={24} /></button>
          <button className={'ctl small' + (state.repeat !== 'off' ? ' on' : '')} aria-label={tr(lang, 'repeat')} onClick={props.onRepeat}>
            <Icon name={state.repeat === 'one' ? 'repeat1' : 'repeat'} size={19} />
          </button>
        </div>
        {IS_IOS ? (
          <div className="vol vol-ios">{tr(lang, 'volumeIos')}</div>
        ) : (
          <div className="vol">
            <button className="vol-ico" aria-label={volume === 0 ? tr(lang, 'unmute') : tr(lang, 'mute')} onClick={toggleMute}><Icon name={volume === 0 ? 'volumeOff' : 'volume'} size={18} /></button>
            <input type="range" min={0} max={100} value={Math.round(volume * 100)} aria-label={tr(lang, 'volume')}
              style={{ '--fill': (volume * 100) + '%' } as CSSProperties}
              onChange={(e) => props.onVolume(Number(e.target.value) / 100)} />
          </div>
        )}
        <div className="foot-actions">
          <div className="foot-cell">
            <button className={'foot-btn' + (liked ? ' on' : '')} aria-label={tr(lang, 'favorites')} onClick={props.onLike}>
              <Icon name={liked ? 'heartFill' : 'heart'} size={19} />
              <LikeBurst active={liked} />
            </button>
            <span className="foot-label">{tr(lang, 'footLike')}</span>
          </div>
          <div className="foot-cell">
            <button className="foot-btn" aria-label={tr(lang, 'addToPlaylist')} onClick={props.onAdd}><Icon name="plus" size={19} /></button>
            <span className="foot-label">{tr(lang, 'footAdd')}</span>
          </div>
          <div className="foot-cell">
            <button className={'foot-btn' + (showLyrics ? ' on' : '')} aria-label={tr(lang, 'lyrics')} onClick={() => setShowLyrics((v) => !v)}><Icon name="note" size={19} /></button>
            <span className="foot-label">{tr(lang, 'footLyrics')}</span>
          </div>
          <div className="foot-cell">
            <button className={'foot-btn' + (state.sleep.mode !== 'off' ? ' on' : '')} aria-label={tr(lang, 'sleepTimer')} onClick={() => setShowSleep((v) => !v)}><Icon name="moon" size={19} /></button>
            <span className="foot-label">{tr(lang, 'footSleep')}</span>
          </div>
          <div className="foot-cell">
            <button className={'foot-btn' + (showRate ? ' on' : '')} aria-label={tr(lang, 'rate')} onClick={() => setShowRate((v) => !v)}><Icon name="gauge" size={19} /></button>
            <span className="foot-label">{tr(lang, 'footSpeed')}</span>
          </div>
          <div className="foot-cell">
            <button className="foot-btn" aria-label={tr(lang, 'startRadio')} onClick={() => current && void engine.startRadio(current.id)}><Icon name="radio" size={19} /></button>
            <span className="foot-label">{tr(lang, 'footRadio')}</span>
          </div>
          <div className="foot-cell">
            <button className="foot-btn" aria-label={tr(lang, 'download')} onClick={props.onDownload} disabled={downloading || downloaded}>
              {downloading ? <span className="dl-pct">{state.downloadProgress[current.id] ?? 0}%</span> : <Icon name={downloaded ? 'check' : 'download'} size={19} />}
            </button>
            <span className="foot-label">{tr(lang, 'footSave')}</span>
          </div>
        </div>
        {showLyrics && <div className="player-panels"><LyricsPanel track={current} lang={lang} currentTime={currentTime} onSeek={(s) => engine.seekTo(s)} /></div>}
        {showSleep && <div className="player-panels"><SleepPicker lang={lang} mode={state.sleep.mode} endsAt={state.sleep.endsAt} onPick={(m) => engine.setSleep(m)} /></div>}
        {showRate && <div className="player-panels"><RatePicker lang={lang} rate={state.rate} hidden={state.hls} episode={state.current?.kind === 'episode'} onPick={(r) => engine.setRate(r)} /></div>}
        <div className="player-foot">
          <button className="queue-btn" onClick={props.onQueue}>{tr(lang, 'queue')} <span>({state.queue.length})</span></button>
        </div>
      </div>
    </div>
  )
}
