import { useEffect, useMemo, useRef, useState } from 'react'
import { engine } from '../audio/engine'
import type { UiState } from '../audio/usePlayer'
import type { Lang, PipedItem, Track } from '../lib/types'
import { pipedTrack, videoIdOf } from '../lib/api'
import { tr } from '../lib/i18n'
import { navigate } from '../lib/hooks'
import { Icon } from '../components/Icon'
import { TrackList } from '../components/TrackList'
import { EmptyState } from '../components/EmptyState'
import { catalogueStatique, lireMoodsCache, ecrireMoodsCache } from '../lib/moods'
import type { MoodsResponse } from '../lib/types'

interface Props {
  lang: Lang
  state: UiState
  query: string
  onPlay: (track: Track, queue: Track[], index: number) => void
  onMenu?: (t: Track) => void
}

const FILTERS = [
  { key: 'music_songs', label: 'all' },
  { key: 'music_videos', label: 'videos' },
  { key: 'music_albums', label: 'albums' },
  { key: 'music_artists', label: 'artists' },
] as const

export function SearchView({ lang, state, query, onMenu }: Props) {
  const [text, setText] = useState(query)
  const [filter, setFilter] = useState('music_songs')
  const [items, setItems] = useState<PipedItem[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const [nextpage, setNextpage] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const api = engine.api
  const [perso, setPerso] = useState<MoodsResponse | null>(() => (state.token ? lireMoodsCache(state.user, lang) : null))
  useEffect(() => {
    let alive = true
    if (!state.token) { setPerso(null); return }
    const c = lireMoodsCache(state.user, lang)
    if (c) { setPerso(c); return }
    api.moods(lang).then((r) => { if (alive) { setPerso(r); ecrireMoodsCache(state.user, lang, r) } }).catch(() => {})
    return () => { alive = false }
  }, [state.token, state.user, lang, api])
  const chips = perso && !perso.cold
    ? [...perso.moods.filter((m) => (m.score || 0) > 0).slice(0, 4).map((m) => ({ label: tr(lang, m.labelKey), q: m.q })), ...perso.artists.slice(0, 2).map((a) => ({ label: a.name, q: a.q }))]
    : catalogueStatique(lang).slice(0, 6).map((m) => ({ label: tr(lang, m.labelKey), q: m.q }))
  const likedIds = useMemo(() => new Set(state.likes.map((t) => t.id)), [state.likes])
  const timer = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const suggestOpen = useRef(false)

  useEffect(() => { setText(query) }, [query])

  useEffect(() => {
    setSuggestions([])
    suggestOpen.current = false
    if (!query.trim() || !state.token) { setItems([]); setTracks([]); setLoading(false); return }
    let alive = true
    setLoading(true)
    setError(false)
    api?.search(query, filter).then((data) => {
      if (!alive) return
      const uniq = <T,>(list: T[]) => { const seen = new Set<string>(); return list.filter((x) => { const o = x as { videoId?: string; id?: string; url?: string }; const k = String(o.videoId || o.id || o.url || ''); if (!k || seen.has(k)) return false; seen.add(k); return true }) }
      const items = uniq(data.items || [])
      setItems(items)
      setNextpage(data.nextpage || '')
      setTracks(uniq(items.filter((x) => x.type === 'stream').map(pipedTrack).filter((t) => t.id)))
      setLoading(false)
    }).catch(() => { if (alive) { setLoading(false); setItems([]); setTracks([]); setError(true) } })
    return () => { alive = false }
  }, [query, filter, api, retry])

  const submit = (value: string) => {
    const q = value.trim()
    if (!q) return
    if (!state.token) { navigate('#/library'); return }
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
      setTracks((prev) => { const seen = new Set(prev.map((t) => t.id)); return [...prev, ...more.filter((t) => !seen.has(t.id))] })
      setNextpage(data.nextpage || '')
    }).catch(() => {})
  }

  if (!state.token) {
    return (
      <>
        <h1 className="h1">{tr(lang, 'searchTitle')}</h1>
        <p className="sub">{tr(lang, 'searchSubtitle')}</p>
        <EmptyState lang={lang} icon="search" titleKey="searchGuestTitle" hintKey="searchGuestHint" action={{ labelKey: 'signIn', onClick: () => navigate('#/library') }} />
      </>
    )
  }

  return (
    <>
      <h1 className="h1">{tr(lang, 'searchTitle')}</h1>
      <p className="sub">{tr(lang, 'searchSubtitle')}</p>
      <div className="pod-search-entry"><a className="chip" href="#/podcasts"><Icon name="note" size={14} /> {tr(lang, 'podcasts')}</a></div>
      <div className="searchbar">
        <span className="s-ico"><Icon name="search" size={19} /></span>
        <input ref={inputRef} type="search" value={text} placeholder={tr(lang, 'searchPlaceholder')} autoComplete="off"
          onChange={(e) => onInput(e.target.value)}
          onBlur={() => { window.setTimeout(() => { suggestOpen.current = false; setSuggestions([]) }, 160) }}
          onFocus={() => { if (text.trim() && suggestions.length) suggestOpen.current = true }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(text) }} />
        {suggestions.length > 0 && (
          <div className="segmented" id="suggestions">
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
        {!query.trim() && <EmptyState lang={lang} icon="search" titleKey="searchTitle" hintKey="searchHint" />}
        {!query.trim() && chips.length > 0 && (
          <div className="chips" style={{ flexWrap: 'wrap', marginTop: 14 }}>
            {chips.map((c) => <button className="chip" key={c.q} onClick={() => submit(c.q)}>{c.label}</button>)}
          </div>
        )}
        {loading && query.trim() && <div className="empty">{tr(lang, 'loading')}</div>}
        {!loading && query.trim() && error && (
          typeof navigator !== 'undefined' && !navigator.onLine
            ? <EmptyState lang={lang} icon="globeOff" titleKey="searchError" hintKey="offlineHint" action={{ labelKey: 'retry', onClick: () => setRetry((r) => r + 1) }} />
            : <EmptyState lang={lang} icon="globe" titleKey="searchError" action={{ labelKey: 'retry', onClick: () => setRetry((r) => r + 1) }} />
        )}
        {!loading && query.trim() && !error && items.length === 0 && <div className="empty">{tr(lang, 'noResults')}</div>}

        {query.trim() && (filter === 'music_songs' || filter === 'music_videos') && (
          <TrackList tracks={tracks} lang={lang} likedIds={likedIds} currentId={state.current?.id ?? null} menu={!!onMenu} onMenu={onMenu} emptyKey="noResults" />
        )}

        {query.trim() && filter === 'music_artists' && items.map((item, index) => {
          const id = (item.url || '').split('/channel/')[1] || ''
          return (
            <button className="track" key={id + index} onClick={() => id && navigate('#/artist/' + id)}>
              <img className="track-art" src={item.thumbnail || ''} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
              <div className="track-txt">
                <div className="track-title">{item.name || item.title}</div>
                <div className="track-sub">{tr(lang, 'artists')}</div>
              </div>
            </button>
          )
        })}

        {query.trim() && filter === 'music_albums' && (
          <div className="pl-grid" style={{ marginTop: 8 }}>
            {items.map((item, index) => {
              const url = item.url || ''
              const id = url.split('list=')[1]?.split('&')[0] || videoIdOf(url)
              return (
                <button className="pl-card" key={String(item.url) + index} onClick={() => id && navigate('#/playlist/' + id)}>
                  <img src={item.thumbnail || ''} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
                  <span className="pl-card-shade" />
                  <span className="pl-card-txt">
                    <span className="pl-card-name">{item.name || item.title}</span>
                    <span className="pl-card-count">{item.uploaderName || ''}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}


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
