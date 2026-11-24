import { useEffect, useState } from 'react'
import type { PlayerState } from '../audio/engine'
import type { Lang, Track } from '../lib/types'
import { pipedTrack } from '../lib/api'
import { tr } from '../lib/i18n'
import { TrackRow } from '../components/TrackRow'

interface Props {
  lang: Lang
  state: PlayerState
  id: string
  onPlay: (track: Track, queue: Track[], index: number) => void
  onLike: (track: Track) => void
}

export function ArtistView({ lang, state, id, onPlay, onLike }: Props) {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('')
  const [description, setDescription] = useState('')
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true); setError('')
    import('../audio/engine').then(({ engine }) => engine.api.channel(id)).then((data) => {
      if (!alive) return
      setName(data.name || '')
      setAvatar(data.thumbnailUrl || '')
      setDescription(data.description || '')
      setTracks((data.relatedStreams || []).map(pipedTrack).filter((t) => t.id))
      setLoading(false)
    }).catch(() => { if (alive) { setLoading(false); setError(tr(lang, 'error')) } })
    return () => { alive = false }
  }, [id, lang])

  if (loading) return <div className="empty">{tr(lang, 'loading')}</div>
  if (error) return <div className="empty">{error}</div>

  return (
    <>
      <div className="artist-hero">
        {avatar && <img className="artist-avatar" src={avatar} alt="" />}
        <h1 className="artist-name">{name}</h1>
        {description && <div className="artist-sub">{description.slice(0, 120)}</div>}
      </div>
      <div className="section" style={{ marginTop: 18 }}>
        <div className="section-head"><h2 className="section-title">{tr(lang, 'tracks')}</h2></div>
        <div className="list">
          {tracks.map((track, index) => (
            <TrackRow key={track.id + index} track={track} index={index} queue={tracks}
              onPlay={onPlay} liked={state.likes.some((x) => x.id === track.id)}
              onLike={onLike} isCurrent={state.current?.id === track.id} durationLabel={formatTime} />
          ))}
        </div>
      </div>
    </>
  )
}

function formatTime(sec: number): string {
  if (!sec) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m + ':' + (s < 10 ? '0' : '') + s
}
