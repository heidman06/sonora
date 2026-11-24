import { useEffect, useMemo, useState } from 'react'
import type { UiState } from '../audio/usePlayer'
import type { Lang, PlaylistDetail, Track } from '../lib/types'
import { tr } from '../lib/i18n'
import { navigate } from '../lib/hooks'
import { Icon } from '../components/Icon'
import { TrackList } from '../components/TrackList'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { UndoToast } from '../components/UndoToast'
import { engine, shuffleArray } from '../audio/engine'
import { toM3U, toJSON, download } from '../lib/export'

interface Props {
  lang: Lang
  state: UiState
  id: string
  onPlay: (track: Track, queue: Track[], index: number) => void
  onLike: (track: Track) => void
  onMenu?: (t: Track) => void
  onDelete: (id: string) => void
}

export function PlaylistView({ lang, state, id, onDelete, onMenu }: Props) {
  const likedIds = useMemo(() => new Set(state.likes.map((t) => t.id)), [state.likes])
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const [undo, setUndo] = useState<{ track: Track; index: number } | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setError('')
    engine.api.playlist(id).then((data) => {
      if (alive) { setPlaylist(data); setLoading(false) }
    }).catch(() => { if (alive) { setLoading(false); setError(tr(lang, 'error')) } })
    return () => { alive = false }
  }, [id])

  const play = (shuffle = false) => {
    if (!playlist?.tracks.length) return
    const tracks = shuffle ? shuffleArray(playlist.tracks) : playlist.tracks
    void engine.playTrack(tracks[0], tracks, 0)
  }

  const removeTrack = (t: Track, i: number) => {
    if (!playlist) return
    const before = playlist
    setPlaylist({ ...playlist, tracks: playlist.tracks.filter((x) => x.id !== t.id) })
    void engine.removeFromPlaylist(id, t).then(() => {
      setUndo({ track: t, index: i })
    }).catch(() => {
      setPlaylist(before)
      engine.showToast(tr(lang, 'error'))
    })
  }

  const undoRemove = async () => {
    if (!undo || !playlist) return
    const u = undo
    setUndo(null)
    try {
      await engine.api.addToPlaylist(id, u.track)
      // Ordre reconstruit depuis l'état courant (jamais un snapshot périmé) : pas de 400.
      const baseIds = (playlist ? playlist.tracks : []).map((t) => t.id).filter((x) => x !== u.track.id)
      const at = Math.min(u.index, baseIds.length)
      const order = [...baseIds.slice(0, at), u.track.id, ...baseIds.slice(at)]
      await engine.api.reorderPlaylist(id, order)
      const fresh = await engine.api.playlist(id)
      setPlaylist(fresh)
    } catch {
      engine.showToast(tr(lang, 'error'))
      const fresh = await engine.api.playlist(id).catch(() => null)
      if (fresh) setPlaylist(fresh)
    }
  }

  const rename = async () => {
    const clean = name.trim()
    if (!clean || !playlist) { setEditing(false); return }
    await engine.api.renamePlaylist(id, clean)
    setPlaylist({ ...playlist, name: clean })
    await engine.loadPlaylists()
    setEditing(false)
  }

  if (loading) return <div className="empty">{tr(lang, 'loading')}</div>
  if (error || !playlist) return <div className="empty">{error || tr(lang, 'error')}</div>
  const numeric = /^\d+$/.test(id)

  return (
    <>
      <button className="back-btn" aria-label={tr(lang, 'back')} onClick={() => navigate('#/library')}><Icon name="prev" size={18} /></button>
      {editing ? (
        <div className="add-new">
          <input value={name} placeholder={tr(lang, 'rename')} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void rename() }} />
          <button className="btn-primary" onClick={() => void rename()}>{tr(lang, 'confirm')}</button>
          <button className="btn-ghost" onClick={() => setEditing(false)}>{tr(lang, 'cancel')}</button>
        </div>
      ) : (
        <div className="pl-title-row">
          <h1 className="h1">{playlist.name}</h1>
          {numeric && <button className="icon-btn" aria-label={tr(lang, 'rename')} onClick={() => { setName(playlist.name); setEditing(true) }}><Icon name="pencil" size={15} /></button>}
        </div>
      )}
      <p className="sub">{playlist.tracks.length} {tr(lang, 'playlistTracks')}</p>
      <div className="pl-actions">
        <button className="btn-primary" onClick={() => play(false)}><Icon name="play" size={16} /> {tr(lang, 'play')}</button>
        <button className="btn-ghost" onClick={() => play(true)}><Icon name="shuffle" size={16} /> {tr(lang, 'shuffle')}</button>
        <button className="btn-ghost" onClick={() => download(playlist.name + '.m3u', 'audio/x-mpegurl', toM3U(playlist))}>{tr(lang, 'exportM3U')}</button>
        <button className="btn-ghost" onClick={() => download(playlist.name + '.json', 'application/json', toJSON(playlist))}>{tr(lang, 'exportJSON')}</button>
        {numeric && <button className="pl-danger" onClick={() => setConfirmDel(true)}>{tr(lang, 'delete')}</button>}
      </div>
      <TrackList tracks={playlist.tracks} lang={lang} likedIds={likedIds} currentId={state.current?.id ?? null} memoryKey={'playlist.' + id}
        removable={numeric} menu={!!onMenu} onMenu={onMenu} onRemove={removeTrack} emptyKey="noPlaylists" />
      {undo && <UndoToast message={tr(lang, 'removed') + ' : ' + undo.track.title} actionLabel={tr(lang, 'undo')} onAction={() => void undoRemove()} onDone={() => setUndo(null)} />}
      {confirmDel && (
        <ConfirmDialog title={tr(lang, 'delete') + ' « ' + playlist.name + ' » ?'} confirmLabel={tr(lang, 'delete')} cancelLabel={tr(lang, 'cancel')}
          onConfirm={() => { setConfirmDel(false); onDelete(id) }} onCancel={() => setConfirmDel(false)} />
      )}
    </>
  )
}