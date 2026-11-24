import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang, Track } from '../lib/types'
import { tr } from '../lib/i18n'
import { engine } from '../audio/engine'
import { TrackRow } from './TrackRow'
import { EmptyState } from './EmptyState'

interface Props {
  tracks: Track[]
  lang: Lang
  likedIds: Set<string>
  currentId: string | null
  memoryKey?: string
  batchSize?: number
  removable?: boolean
  menu?: boolean
  emptyKey?: string
  onRemove?: (t: Track, i: number) => void
  onMenu?: (t: Track) => void
}

const BATCH = 100

// Delegated list: 3 stable handlers, absolute data-index, batches of 100 (design S0/N3).
export function TrackList({ tracks, lang, likedIds, currentId, memoryKey, batchSize, removable, menu, emptyKey, onRemove, onMenu }: Props) {
  const size = batchSize ?? BATCH
  const listRef = useRef(tracks)
  listRef.current = tracks
  const removeRef = useRef(onRemove)
  removeRef.current = onRemove
  const menuRef = useRef(onMenu)
  menuRef.current = onMenu
  // Lecture unique au montage : l'écriture de persistance ne doit pas corrompre
  // la cible de rehydratation en cours de route (revue finale 3).
  const [initial] = useState<{ scrollTop?: number; batchCount?: number }>(() => {
    if (!memoryKey) return {}
    try { return JSON.parse(sessionStorage.getItem('sonora.scroll.' + memoryKey) || '{}') } catch { return {} }
  })
  const target = Math.min(10, Math.max(1, Number(initial.batchCount) || 1))
  const [batches, setBatches] = useState(1)
  const batchesRef = useRef(batches)
  batchesRef.current = batches
  const hydrated = useRef(target <= 1)
  useEffect(() => {
    if (target <= 1) { hydrated.current = true; return }
    let cur = 1
    let raf = 0
    const step = () => {
      cur = Math.min(target, cur + 2)
      setBatches(cur)
      if (cur < target) raf = requestAnimationFrame(step)
      else {
        hydrated.current = true
        // après commit des derniers lots, sinon clamp du scrollTop profond
        if (initial.scrollTop) requestAnimationFrame(() => window.scrollTo(0, Number(initial.scrollTop) || 0))
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  useEffect(() => {
    if (!memoryKey || !hydrated.current) return
    const write = () => { try { sessionStorage.setItem('sonora.scroll.' + memoryKey, JSON.stringify({ scrollTop: window.scrollY, batchCount: batchesRef.current })) } catch { /* noop */ } }
    write()
    return () => { write() }
  }, [memoryKey, batches])
  const dispatch = useCallback((target: EventTarget | null) => {
    const el = target as HTMLElement | null
    if (!el || !el.closest) return
    const act = el.closest('[data-action]') as HTMLElement | null
    const row = el.closest('[data-index]') as HTMLElement | null
    if (!act || !row) return
    const i = Number(row.dataset.index)
    const list = listRef.current
    if (!Number.isFinite(i) || i < 0 || i >= list.length) return
    let track = list[i]
    if (track.id !== row.dataset.id) { const j = list.findIndex((t) => t.id === row.dataset.id); if (j < 0) return; track = list[j] }
    const action = act.dataset.action
    if (action === 'play') void engine.playTrack(track, list, i)
    else if (action === 'like') void engine.toggleLike(track)
    else if (action === 'remove') removeRef.current?.(track, i)
    else if (action === 'menu') menuRef.current?.(track)
  }, [])
  const onClick = useCallback((e: React.MouseEvent) => dispatch(e.target), [dispatch])
  const onKeyDown = useCallback((e: React.KeyboardEvent) => { if (e.key === 'Enter') dispatch(e.target) }, [dispatch])
  const visible = tracks.slice(0, batches * size)
  return (
    <div className={'list' + (batches === 1 ? ' stagger' : '')} onClick={onClick} onKeyDown={onKeyDown}>
      {visible.map((t, i) => (
        <TrackRow key={t.id + i} track={t} index={i} lang={lang} liked={likedIds.has(t.id)} isCurrent={currentId === t.id} removable={removable} menu={menu} />
      ))}
      {!tracks.length && (
        emptyKey === 'noFavorites' ? <EmptyState lang={lang} icon="heart" titleKey="noFavorites" hintKey="noFavoritesHint" /> :
        emptyKey === 'noDownloads' ? <EmptyState lang={lang} icon="download" titleKey="noDownloads" hintKey="noDownloadsHint" /> :
        emptyKey === 'noPlaylists' ? <EmptyState lang={lang} icon="library" titleKey="noPlaylists" hintKey="noPlaylistsHint" /> :
        <EmptyState lang={lang} icon="search" titleKey={emptyKey || 'noResults'} />
      )}
      {tracks.length > batches * size && (
        <button className="load-more" onClick={() => setBatches((b) => b + 1)}>{tr(lang, 'showMore')}</button>
      )}
    </div>
  )
}