import { useEffect, useRef, useState } from 'react'
import { engine } from '../audio/engine'
import type { PlayerState } from '../audio/engine'
import type { Lang, PipedItem, Track } from '../lib/types'
import { pipedTrack, videoIdOf } from '../lib/api'
import { tr } from '../lib/i18n'
import { navigate } from '../lib/hooks'
import { Icon } from '../components/Icon'
import { TrackRow } from '../components/TrackRow'

interface Props {
  lang: Lang
  state: PlayerState
  query: string
  onPlay: (track: Track, queue: Track[], index: number) => void
}

const FILTERS = [
  { key: 'music_songs', label: 'all' },
  { key: 'music_videos', label: 'videos' },
  { key: 'music_albums', label: 'albums' },
  { key: 'music_artists', label: 'artists' },
] as const

export function SearchView({ lang, state, query, onPlay }: Props) {
  const [text, setText] = useState(query)
  const [filter, setFilter] = useState('music_songs')
  const [items, setItems] = useState<PipedItem[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const [nextpage, setNextpage] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const api = engine.api
  const timer = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const suggestOpen = useRef(false)

  useEffect(() => { setText(query) }, [query])

  useEffect(() => {
    setSuggestions([])
    suggestOpen.current = false
    if (!query.trim()) { setItems([]); setTracks([]); return }
    let alive = true
    setLoading(true)
    api?.search(query, filter).then((data) => {
      if (!alive) return
      setItems(data.items || [])
      setNextpage(data.nextpage || '')
      setTracks((data.items || []).filter((x) => x.type === 'stream').map(pipedTrack).filter((t) => t.id))
      setLoading(false)
    }).catch(() => { if (alive) { setLoading(false); setItems([]); setTracks([]) } })
    return () => { alive = false }
  }, [query, filter, api])

  const submit = (value: string) => {
    const q = value.trim()
    if (!q) return
    if (timer.current) window.clearTimeout(timer.current)
    suggestOpen.current = false
    setSuggestions([])
    ;(document.activeElement as HTMLElement | null)?.blur()
    navigate('#/search/' + encodeURIComponent(q))
  }

  const onInput = (value: string) => {
    setText(value)
    if (timer.current) window.clearTimeout(timer.current)
    if (!value.trim()) { suggestOpen.current = false; setSuggestions([]); return }
    suggestOpen.current = true
    timer.current = window.setTimeout(() => {
      const asked = value.trim()
      api?.suggestions(asked).then((list) => {
        if (!suggestOpen.current) return
        if (!inputRef.current || document.activeElement !== inputRef.current) return
        if (inputRef.current.value.trim() !== asked) return
        setSuggestions(list)
      }).catch(() => {})
    }, 250)
  }

  const loadMore = () => {
    if (!nextpage || !api) return
    api.search(query, filter, nextpage).then((data) => {
      const more = (data.items || []).filter((x) => x.type === 'stream').map(pipedTrack).filter((t) => t.id)
      setTracks((prev) => [...prev, ...more])
      setNextpage(data.nextpage || '')
    }).catch(() => {})
  }

  return (
    <>
      <h1 className="h1">{tr(lang, 'searchTitle')}</h1>
      <p className="sub">{tr(lang, 'searchSubtitle')}</p>
      <div className="searchbar">
        <span className="s-ico"><Icon name="search" size={19} /></span>
        <input ref={inputRef} type="search" value={text} placeholder={tr(lang, 'searchPlaceholder')} autoComplete="off"
          onChange={(e) => onInput(e.target.value)}
          onBlur={() => { window.setTimeout(() => { suggestOpen.current = false; setSuggestions([]) }, 160) }}
          onFocus={() => { if (text.trim() && suggestions.length) suggestOpen.current = true }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(text) }} />
        {suggestions.length > 0 && (
          <div className="segmented" id="filters">
            {suggestions.slice(0, 7).map((s) => (
              <button key={s} onClick={() => { setText(s); submit(s) }}><Icon name="search" size={15} />{s}</button>
            ))}
          </div>
        )}
      </div>
      <div className="segmented" id="filters">
        {FILTERS.map((f) => (
          <button key={f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>{tr(lang, f.label)}</button>
        ))}
      </div>
      <div id="results" className="list">
        {!query.trim() && <div className="empty"><Icon name="search" size={34} /><div>{tr(lang, 'searchHint')}</div></div>}
        {loading && query.trim() && <div className="empty">{tr(lang, 'loading')}</div>}
        {!loading && query.trim() && items.length === 0 && <div className="empty">{tr(lang, 'noResults')}</div>}

        {(filter === 'music_songs' || filter === 'music_videos') && tracks.map((track, index) => (
          <TrackRow key={track.id + index} track={track} index={index} queue={tracks}
            onPlay={onPlay} liked={state.likes.some((x) => x.id === track.id)}
            onLike={(t) => { void import('../audio/engine').then(({ engine }) => engine.toggleLike(t)) }}
            isCurrent={state.current?.id === track.id} durationLabel={(s) => engineTime(s)} />
        ))}

        {filter === 'music_artists' && items.map((item, index) => {
          const id = (item.url || '').split('/channel/')[1] || ''
          return (
            <button className="track" key={id + index} onClick={() => id && navigate('#/artist/' + id)}>
              <img className="track-art" src={item.thumbnail || ''} alt="" loading="lazy" />
              <div className="track-txt">
                <div className="track-title">{item.name || item.title}</div>
                <div className="track-sub">{tr(lang, 'artists')}</div>
              </div>
            </button>
          )
        })}

        {filter === 'music_albums' && items.map((item, index) => {
          const id = videoIdOf(item.url || '') || (item.url || '').split('list=')[1]?.split('&')[0] || ''
          return (
            <button className="track" key={String(item.url) + index} onClick={() => id && navigate('#/playlist/' + id)}>
              <img className="track-art" src={item.thumbnail || ''} alt="" loading="lazy" />
              <div className="track-txt">
                <div className="track-title">{item.name || item.title}</div>
                <div className="track-sub">{item.uploaderName || ''}</div>
              </div>
            </button>
          )
        })}

        {nextpage && (filter === 'music_songs' || filter === 'music_videos') && (
          <button className="load-more" onClick={loadMore}>{tr(lang, 'loadMore')}</button>
        )}
      </div>
    </>
  )
}

function engineTime(sec: number): string {
  if (!sec || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m + ':' + (s < 10 ? '0' : '') + s
}
