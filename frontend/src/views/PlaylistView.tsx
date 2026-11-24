import { useEffect, useState } from 'react'
import type { PlayerState } from '../audio/engine'
import type { Lang, PlaylistDetail, Track } from '../lib/types'
import { tr } from '../lib/i18n'
import { Icon } from '../components/Icon'
import { TrackRow } from '../components/TrackRow'

interface Props {
  lang: Lang
  state: PlayerState
  id: string
  onPlay: (track: Track, queue: Track[], index: number) => void
  onLike: (track: Track) => void
  onDelete: (id: string) => void
}

export function PlaylistView({ lang, state, id, onPlay, onLike, onDelete }: Props) {
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true); setError('')
    import('../audio/engine').then(({ engine }) => engine.api.playlist(id)).then((data) => {
      if (alive) { setPlaylist(data); setLoading(false) }
    }).catch(() => { if (alive) { setLoading(false); setError(tr(lang, 'error')) } })
    return () => { alive = false }
  }, [id, lang])

  const play = (shuffle = false) => {
    if (!playlist?.tracks.length) return
    const tracks = shuffle ? [...playlist.tracks].sort(() => Math.random() - 0.5) : playlist.tracks
    onPlay(tracks[0], tracks, 0)
  }

  if (loading) return <div className="empty">{tr(lang, 'loading')}</div>
  if (error || !playlist) return <div className="empty">{error || tr(lang, 'error')}</div>

  return (
    <>
      <h1 className="h1">{playlist.name}</h1>
      <p className="sub">{playlist.tracks.length} {tr(lang, 'playlistTracks')}</p>
      <div className="pl-actions">
        <button className="btn-primary" onClick={() => play(false)}><Icon name="play" size={16} /> {tr(lang, 'play')}</button>
        <button className="btn-ghost" onClick={() => play(true)}><Icon name="shuffle" size={16} /> {tr(lang, 'shuffle')}</button>
        {/^\d+$/.test(id) && (
          <button className="pl-danger" onClick={() => { if (window.confirm(tr(lang, 'delete') + ' ?')) onDelete(id) }}>{tr(lang, 'delete')}</button>
        )}
      </div>
      <div className="list">
        {playlist.tracks.map((track, index) => (
          <TrackRow key={track.id + index} track={track} index={index} queue={playlist.tracks}
            onPlay={onPlay} liked={state.likes.some((x) => x.id === track.id)}
            onLike={onLike} isCurrent={state.current?.id === track.id} durationLabel={formatTime} />
        ))}
        {!playlist.tracks.length && <div className="empty">{tr(lang, 'noPlaylists')}</div>}
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
