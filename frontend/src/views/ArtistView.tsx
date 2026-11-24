import { useEffect, useMemo, useState } from 'react'
import type { UiState } from '../audio/usePlayer'
import type { Lang, Track } from '../lib/types'
import { pipedTrack } from '../lib/api'
import { engine } from '../audio/engine'
import { tr } from '../lib/i18n'
import { navigate } from '../lib/hooks'
import { Icon } from '../components/Icon'
import { TrackList } from '../components/TrackList'

interface Props {
  lang: Lang
  state: UiState
  id: string
  onPlay: (track: Track, queue: Track[], index: number) => void
  onLike: (track: Track) => void
  onMenu?: (t: Track) => void
}

export function ArtistView({ lang, state, id, onMenu }: Props) {
  const likedIds = useMemo(() => new Set(state.likes.map((t) => t.id)), [state.likes])
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
  }, [id])

  if (loading) return <div className="empty">{tr(lang, 'loading')}</div>
  if (error) return <div className="empty">{error}</div>

  return (
    <>
      <button className="back-btn" aria-label={tr(lang, 'back')} onClick={() => navigate('#/library')}><Icon name="prev" size={18} /></button>
      <div className="artist-hero">
        {avatar && <img className="artist-avatar" src={avatar} alt="" />}
        <h1 className="artist-name">{name}</h1>
        {description && <div className="artist-sub">{description.slice(0, 120)}</div>}
        {name && <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => void engine.startRadio(name)}><Icon name="listen" size={16} /> {tr(lang, 'startRadio')}</button>}
      </div>
      <div className="section" style={{ marginTop: 18 }}>
        <div className="section-head"><h2 className="section-title">{tr(lang, 'tracks')}</h2></div>
        <div className="list">
          <TrackList tracks={tracks} lang={lang} likedIds={likedIds} currentId={state.current?.id ?? null} memoryKey={'artist.' + id} menu={!!onMenu} onMenu={onMenu} emptyKey="noResults" />
        </div>
      </div>
    </>
  )
}

