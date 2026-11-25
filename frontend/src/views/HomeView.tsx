import { useEffect, useMemo, useState } from 'react'
import { engine } from '../audio/engine'
import type { UiState } from '../audio/usePlayer'
import type { Lang, MixSummary, Mood, MoodArtist, Track } from '../lib/types'
import { catalogueStatique, splitChips, lireMoodsCache, ecrireMoodsCache, peutEcrireMoods } from '../lib/moods'
import { lireMixesMem, lireMixesCache, majMixesMem, ecrireMixesCache, peutEcrireMixes, mixLabel, mixSubtitle, coquillesCold, qCoquille } from '../lib/mixes'
import { MixArt } from '../components/MixArt'
import { storage, userKey } from '../lib/storage'
import { tr, hello, dateLabel } from '../lib/i18n'
import { navigate } from '../lib/hooks'
import { Icon } from '../components/Icon'
import { Art } from '../components/Art'

interface Props {
  lang: Lang
  state: UiState
  onPlay: (track: Track, queue: Track[], index: number) => void
}


const SEED_KEYS: Record<string, string> = { 'tes favoris': 'seedFavorites', 'ton historique': 'seedHistory', 'tes playlists': 'seedPlaylists' }


function dedupTracks(list: Track[]): Track[] {
  const vus = new Set<string>()
  const out: Track[] = []
  for (const t of list) { if (!t || vus.has(t.id)) continue; vus.add(t.id); out.push(t) }
  return out
}

function TrackCard({ track, onPlay }: { track: Track; onPlay: () => void }) {
  return (
    <button className="card" onClick={onPlay}>
      <div className="card-art-wrap">
        <Art id={track.id} className="card-art" />
        <span className="card-play"><Icon name="play" size={15} /></span>
      </div>
      <div className="card-title">{track.title}</div>
      <div className="card-sub">{track.artist || ''}</div>
    </button>
  )
}

export function HomeView({ lang, state, onPlay }: Props) {
  const [mixes, setMixes] = useState<MixSummary[]>(() => (lireMixesMem(state.user) || lireMixesCache(state.user) || coquillesCold()).mixes)
  const [mixesLoading, setMixesLoading] = useState(!(lireMixesMem(state.user) || lireMixesCache(state.user)) && !!state.token)
  const [recos, setRecos] = useState<Track[]>([])
  const [recent, setRecent] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [moods, setMoods] = useState<Mood[]>(() => catalogueStatique(lang))
  const [artists, setArtists] = useState<MoodArtist[]>([])
  const [moodsLoading, setMoodsLoading] = useState(false)
  const api = engine.api

  useEffect(() => {
    let alive = true
    setLoading(true)
    const localRecent = storage.get<Track[]>(userKey(state.user, 'recent'), [])
    setRecent(dedupTracks(localRecent).slice(0, 14))
    if (!state.token) { setRecos([]); setLoading(false); return }
    Promise.all([
      api?.recos(16).catch(() => []) ?? Promise.resolve([]),
      api?.history(20).catch(() => []) ?? Promise.resolve([]),
    ]).then(([recoList, hist]) => {
      if (!alive) return
      setRecos(recoList)
      if (hist.length) setRecent(dedupTracks(hist).slice(0, 14))
      setLoading(false)
    }).catch(() => alive && setLoading(false))
    return () => { alive = false }
  }, [state.token, state.user, api])

  // Effet mixes SEPARE (design mixes C21) : cache rendu immediat, SWR, sans lang.
  useEffect(() => {
    let alive = true
    const capture = { user: state.user }
    if (!state.token) { setMixes(coquillesCold().mixes); setMixesLoading(false); return }
    const mem = lireMixesMem(state.user) || lireMixesCache(state.user)
    if (mem) { setMixes(mem.mixes); setMixesLoading(false) } else { setMixesLoading(true) }
    api?.mixes2().then((r) => {
      if (!alive || !peutEcrireMixes(capture, { user: state.user })) return
      setMixes(r.mixes)
      setMixesLoading(false)
      majMixesMem(capture.user, r)
      ecrireMixesCache(capture.user, r)
    }).catch(() => {
      if (!alive) return
      setMixesLoading(false)
      if (!mem) setMixes(coquillesCold().mixes)
    })
    return () => { alive = false }
  }, [state.token, state.user, api])

  // Effet moods SEPARE de l'effet mixes/recos : un switch de langue ne refetch
  // que /moods et ne reflashe pas la page (design moods rev.2 C9).
  useEffect(() => {
    let alive = true
    const capture = { user: state.user, lang }
    if (!state.token) { setMoods(catalogueStatique(lang)); setArtists([]); setMoodsLoading(false); return }
    const cached = lireMoodsCache(state.user, lang)
    if (cached) { setMoods(cached.moods); setArtists(cached.artists); setMoodsLoading(false) } else { setMoodsLoading(true) }
    api?.moods(lang).then((resp) => {
      if (!alive || !peutEcrireMoods(capture, { user: state.user, lang })) return
      setMoods(resp.moods)
      setArtists(resp.artists)
      setMoodsLoading(false)
      ecrireMoodsCache(capture.user, capture.lang, resp)
    }).catch(() => {
      if (!alive) return
      setMoodsLoading(false)
      if (!cached) { setMoods(catalogueStatique(lang)); setArtists([]) }
    })
    return () => { alive = false }
  }, [state.token, state.user, api, lang])

  const { head, explore } = splitChips(moods, artists)

  const seeds = useMemo(() => {
    const list: string[] = []
    for (const item of recos) if (item.seed && !list.includes(item.seed)) list.push(item.seed)
    return list.slice(0, 3)
  }, [recos])

  const playMix = (mix: MixSummary) => {
    if (mix.tracks?.length) { onPlay(mix.tracks[0], mix.tracks, 0); return }
    if (mix.moodId) void api?.radio(qCoquille(lang, mix.moodId), 40).then((ts) => { if (ts.length) onPlay(ts[0], ts, 0) }).catch(() => {})
  }

  const playRadioMix = () => {
    if (!state.token) { navigate('#/library'); return }
    api?.mix(30).then((tracks) => {
      if (tracks.length) onPlay(tracks[0], tracks, 0)
    }).catch(() => {})
  }

  const dismiss = (track: Track) => {
    setRecos((items) => items.filter((x) => x.id !== track.id))
    api?.feedback(track.id, 'dismiss').catch(() => {})
  }

  return (
    <>
      <div className="home-hero">
        <div className="eyebrow">{dateLabel(lang)}</div>
        <h1 className="h1">{hello(lang)}</h1>
        <p className="sub">{tr(lang, 'homeSubtitle')}</p>
      </div>
      <div className="chips" style={{ marginTop: 16 }}>
        {moodsLoading ? Array.from({ length: 8 }, (_, i) => <span key={i} className="chip-skel skel" />) : head.map((item) => (
          'labelKey' in item ? (
            <button className="chip" key={item.id} onClick={() => navigate('#/search/' + encodeURIComponent(item.q))}>{tr(lang, item.labelKey)}</button>
          ) : (
            <button className="chip chip-artist" key={'a-' + item.name} aria-label={tr(lang, 'becauseYouLike') + ' ' + item.name} onClick={() => navigate('#/search/' + encodeURIComponent(item.q))}>{item.name}</button>
          )
        ))}
      </div>

      <section className="section">
        <div className="section-head"><h2 className="section-title">{tr(lang, 'yourMixes')}</h2>{state.token && <a className="section-link" href="#/mixes">{tr(lang, 'seeAll')}</a>}</div>
        {!state.token ? (
          <div className="mixes-guest">
            <div className="mixes-guest-txt">
              <b>{tr(lang, 'mixesGuestTitle')}</b>
              <span>{tr(lang, 'mixesGuestHint')}</span>
            </div>
            <a className="btn-primary" href="#/library">{tr(lang, 'signIn')}</a>
          </div>
        ) : (
          <div className="row-scroll">
            {mixesLoading && Array.from({ length: 4 }, (_, i) => <div key={i} className="skel" style={{ width: 152, height: 152, borderRadius: 18 }} />)}
            {!mixesLoading && !mixes.length && <div className="empty" style={{ padding: '18px 0', opacity: 0.6, fontSize: 13 }}>{tr(lang, 'mixesEmpty')}</div>}
            {mixes.slice(0, 12).map((mix) => {
              return (
                <button className="card mix-card" key={mix.key} onClick={() => playMix(mix)}>
                  <div className="card-art-wrap">
                    <MixArt cover={mix.cover} moodId={mix.moodId} />
                    <span className="card-play"><Icon name="play" size={15} /></span>
                  </div>
                  <div className="card-title">{mixLabel(lang, mix)}</div>
                  <div className="card-sub">{mixSubtitle(lang, mix)}</div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">{tr(lang, 'forYou')}</h2>
          <button className="section-link" onClick={playRadioMix}>✨ {tr(lang, 'mix')}</button>
        </div>
        {seeds.length > 0 && <span style={{ fontSize: 11, opacity: 0.55, marginLeft: 8 }}>{tr(lang, 'basedOn')}{seeds.map((s) => (SEED_KEYS[s] ? tr(lang, SEED_KEYS[s]) : s)).join(' · ')}</span>}
        <div className="row-scroll">
          {loading && <><div className="skel" style={{ width: 152, height: 152, borderRadius: 18 }} /><div className="skel" style={{ width: 152, height: 152, borderRadius: 18 }} /><div className="skel" style={{ width: 152, height: 152, borderRadius: 18 }} /></>}
          {!loading && !recos.length && <div className="empty" style={{ padding: '18px 0', opacity: 0.6, fontSize: 13 }}>{tr(lang, 'forYouEmpty')}</div>}
          {recos.map((track) => (
            <div className="fy-item" key={track.id}>
              <TrackCard track={track} onPlay={() => onPlay(track, recos, recos.indexOf(track))} />
              <button className="fy-hide" aria-label={tr(lang, 'notInterested')} title={tr(lang, 'notInterested')} onClick={() => dismiss(track)}>✕</button>
            </div>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="section">
          <div className="section-head"><h2 className="section-title">{tr(lang, 'recent')}</h2></div>
          <div className="row-scroll">
            {recent.map((track, index) => (
              <TrackCard key={track.id + index} track={track} onPlay={() => onPlay(track, recent, index)} />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head"><h2 className="section-title">{tr(lang, 'exploreMoods')}</h2></div>
        <div className="chips" style={{ flexWrap: 'wrap', minHeight: 87 }}>
          {moodsLoading ? Array.from({ length: 8 }, (_, i) => <span key={i} className="chip-skel skel" />) : explore.map((mood) => (
            <button className="chip" key={mood.id} onClick={() => navigate('#/search/' + encodeURIComponent(mood.q))}>{tr(lang, mood.labelKey)}</button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">{tr(lang, 'yourPlaylists')}</h2>
          {state.token && <a className="section-link" href="#/library">{tr(lang, 'seeAll')}</a>}
        </div>
        {state.token && state.playlists.length > 0 ? (
          <div className="pl-grid">
            {state.playlists.slice(0, 6).map((playlist) => (
              <button className="pl-card" key={playlist.id} onClick={() => navigate('#/playlist/' + playlist.id)}>
                <Art id={playlist.cover?.[0]} />
                <span className="pl-card-shade" />
                <span className="pl-card-txt">
                  <span className="pl-card-name">{playlist.name}</span>
                  <span className="pl-card-count">{playlist.count} {tr(lang, 'tracks')}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="login-card">
            <h3>{tr(lang, 'signInTitle')}</h3>
            <p>{tr(lang, 'signInBody')}</p>
            {!state.token && <a className="btn-primary" href="#/library">{tr(lang, 'signIn')} <Icon name="prev" size={14} /></a>}
          </div>
        )}
      </section>
    </>
  )
}
