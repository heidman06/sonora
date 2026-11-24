import { useEffect, useMemo, useState } from 'react'
import { engine } from '../audio/engine'
import type { PlayerState } from '../audio/engine'
import type { Lang, MixSummary, Track } from '../lib/types'
import { storage, userKey } from '../lib/storage'
import { tr, hello, dateLabel } from '../lib/i18n'
import { navigate } from '../lib/hooks'
import { Icon } from '../components/Icon'

interface Props {
  lang: Lang
  state: PlayerState
  onPlay: (track: Track, queue: Track[], index: number) => void
}

const MOODS = [
  { q: 'phonk', fr: 'Phonk', en: 'Phonk', es: 'Phonk' },
  { q: 'chill lofi', fr: 'Chill', en: 'Chill', es: 'Relax' },
  { q: 'rap français', fr: 'Rap FR', en: 'Rap FR', es: 'Rap FR' },
  { q: 'afrobeats 2026', fr: 'Afrobeats', en: 'Afrobeats', es: 'Afrobeats' },
  { q: 'french touch', fr: 'French Touch', en: 'French Touch', es: 'French Touch' },
  { q: 'r&b smooth', fr: 'R&B', en: 'R&B', es: 'R&B' },
  { q: 'jazz lounge', fr: 'Jazz', en: 'Jazz', es: 'Jazz' },
  { q: 'electro house', fr: 'Électro', en: 'Electro', es: 'Electro' },
  { q: 'nouveautés 2026', fr: 'Nouveautés 2026', en: 'New in 2026', es: 'Novedades 2026' },
  { q: 'top hits france', fr: 'Top hits France', en: 'Top hits France', es: 'Top hits Francia' },
  { q: 'workout', fr: 'Workout', en: 'Workout', es: 'Entrenamiento' },
  { q: 'voiture', fr: 'Voiture', en: 'Drive', es: 'Coche' },
  { q: 'soirée', fr: 'Soirée', en: 'Party', es: 'Fiesta' },
  { q: 'concentration', fr: 'Concentration', en: 'Focus', es: 'Concentración' },
]

function mixName(name: string, lang: Lang): string {
  const map: Record<string, [string, string, string]> = {
    'Découvertes': ['Découvertes', 'Discoveries', 'Descubrimientos'],
    'En boucle': ['En boucle', 'On repeat', 'En bucle'],
    'Tes favoris': ['Tes favoris', 'Your favorites', 'Tus favoritos'],
  }
  const row = map[name]
  if (!row) return name
  return lang === 'fr' ? row[0] : lang === 'es' ? row[2] : row[1]
}

function TrackCard({ track, onPlay }: { track: Track; onPlay: () => void }) {
  return (
    <button className="card" onClick={onPlay}>
      <div className="card-art-wrap">
        <img className="card-art" src={track.thumb || ''} alt="" loading="lazy" />
        <span className="card-play"><Icon name="play" size={15} /></span>
      </div>
      <div className="card-title">{track.title}</div>
      <div className="card-sub">{track.artist || ''}</div>
    </button>
  )
}

export function HomeView({ lang, state, onPlay }: Props) {
  const [mixes, setMixes] = useState<MixSummary[]>([])
  const [recos, setRecos] = useState<Track[]>([])
  const [recent, setRecent] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const api = engine.api

  useEffect(() => {
    let alive = true
    setLoading(true)
    const localRecent = storage.get<Track[]>(userKey(state.user, 'recent'), [])
    setRecent(localRecent.slice(0, 14))
    if (!state.token) { setMixes([]); setRecos([]); setLoading(false); return }
    Promise.all([
      api?.mixes().catch(() => []) ?? Promise.resolve([]),
      api?.recos(16).catch(() => []) ?? Promise.resolve([]),
      api?.history(20).catch(() => []) ?? Promise.resolve([]),
    ]).then(([mixList, recoList, hist]) => {
      if (!alive) return
      setMixes(mixList)
      setRecos(recoList)
      if (hist.length) setRecent(hist.slice(0, 14))
      setLoading(false)
    }).catch(() => alive && setLoading(false))
    return () => { alive = false }
  }, [state.token, state.user, api])

  const seeds = useMemo(() => {
    const list: string[] = []
    for (const item of recos) if (item.seed && !list.includes(item.seed)) list.push(item.seed)
    return list.slice(0, 3)
  }, [recos])

  const playMix = (mix: MixSummary) => {
    if (!mix.tracks?.length) return
    onPlay(mix.tracks[0], mix.tracks, 0)
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
        {MOODS.slice(0, 8).map((mood) => (
          <button className="chip" key={mood.q} onClick={() => navigate('#/search/' + encodeURIComponent(mood.q))}>
            {lang === 'fr' ? mood.fr : lang === 'es' ? mood.es : mood.en}
          </button>
        ))}
      </div>

      <section className="section">
        <div className="section-head"><h2 className="section-title">{tr(lang, 'yourMixes')}</h2></div>
        <div className="row-scroll">
          {loading && <><div className="skel" style={{ width: 152, height: 152, borderRadius: 18 }} /><div className="skel" style={{ width: 152, height: 152, borderRadius: 18 }} /></>}
          {!loading && !mixes.length && <div className="empty" style={{ padding: '18px 0', opacity: 0.6, fontSize: 13 }}>{tr(lang, 'mixesEmpty')}</div>}
          {mixes.map((mix) => {
            const cover = mix.cover?.[0] ? 'https://i.ytimg.com/vi/' + mix.cover[0] + '/mqdefault.jpg' : ''
            return (
              <button className="card mix-card" key={mix.key} onClick={() => playMix(mix)}>
                <div className="card-art-wrap">
                  <img className="card-art" src={cover} alt="" loading="lazy" />
                  <span className="card-play"><Icon name="play" size={15} /></span>
                </div>
                <div className="card-title">{mixName(mix.name, lang)}</div>
                <div className="card-sub">{mix.count} {tr(lang, 'tracks')}</div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">{tr(lang, 'forYou')}</h2>
          <button className="section-link" onClick={playRadioMix}>✨ {tr(lang, 'mix')}</button>
        </div>
        {seeds.length > 0 && <span style={{ fontSize: 11, opacity: 0.55, marginLeft: 8 }}>{tr(lang, 'basedOn')}{seeds.join(' · ')}</span>}
        <div className="row-scroll">
          {!loading && !recos.length && <div className="empty" style={{ padding: '18px 0', opacity: 0.6, fontSize: 13 }}>{tr(lang, 'forYouEmpty')}</div>}
          {recos.map((track) => (
            <div className="fy-item" key={track.id}>
              <TrackCard track={track} onPlay={() => onPlay(track, recos, recos.indexOf(track))} />
              <button className="fy-hide" aria-label="Pas intéressé" title="Pas intéressé" onClick={() => dismiss(track)}>✕</button>
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
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {MOODS.slice(8).map((mood) => (
            <button className="chip" key={mood.q} onClick={() => navigate('#/search/' + encodeURIComponent(mood.q))}>
              {lang === 'fr' ? mood.fr : lang === 'es' ? mood.es : mood.en}
            </button>
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
                <img src={playlist.cover?.[0] ? 'https://i.ytimg.com/vi/' + playlist.cover[0] + '/mqdefault.jpg' : ''} alt="" loading="lazy" />
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
