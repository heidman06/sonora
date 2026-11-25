import { useEffect, useState } from 'react'
import type { Lang, PodcastShow, PodcastEpisode } from '../lib/types'
import type { UiState } from '../audio/usePlayer'
import { tr } from '../lib/i18n'
import { engine } from '../audio/engine'
import { episodeToTrack } from '../lib/api'
import { navigate } from '../lib/hooks'
import { Icon } from '../components/Icon'
import { TrackList } from '../components/TrackList'

interface Props { lang: Lang; state: UiState; id: string }

export function PodcastShowView({ lang, state, id }: Props) {
  const api = engine.api
  const [show, setShow] = useState<PodcastShow | null>(null)
  const [eps, setEps] = useState<PodcastEpisode[]>([])
  const [stale, setStale] = useState(false)
  const [following, setFollowing] = useState(false)
  const [err, setErr] = useState('')
  const load = (refresh: boolean) => {
    api.podShow(Number(id), refresh).then((r) => { setShow(r.show); setEps(r.episodes); setStale(r.stale) }).catch(() => setErr(tr(lang, 'podFetchError')))
    api.podSubs().then((r) => setFollowing(r.shows.some((s) => s.id === Number(id)))).catch(() => {})
  }
  useEffect(() => { if (state.token) load(false) }, [id, state.token])
  if (!state.token) { navigate('#/library'); return null }
  if (err && !show) return <div className="empty">{err}</div>
  if (!show) return <div className="empty">{tr(lang, 'loading')}</div>
  const tracks = eps.map((e) => episodeToTrack(e, show.image))
  const toggleFollow = async () => {
    if (following) await api.podUnsub(show.id).catch(() => {})
    else await api.podSub(show.id).catch(() => {})
    setFollowing(!following)
  }
  return (
    <>
      <button className="back-btn" aria-label={tr(lang, 'back')} onClick={() => navigate('#/podcasts')}><Icon name="up" size={16} /></button>
      <div className="pod-show-head">
        {show.image ? <img className="pod-show-art" src={show.image} alt="" /> : <span className="pod-show-art pod-row-fallback"><Icon name="note" size={28} /></span>}
        <div className="pod-show-meta">
          <h1 className="h1">{show.title}</h1>
          <p className="sub">{show.author}</p>
          <div className="pod-show-actions">
            <button className={following ? 'btn-ghost' : 'btn-primary'} type="button" onClick={() => void toggleFollow()}>{following ? tr(lang, 'podUnfollow') : tr(lang, 'podFollow')}</button>
            <button className="btn-ghost" type="button" onClick={() => load(true)}>{tr(lang, 'podRefresh')}</button>
          </div>
        </div>
      </div>
      {stale && <div className="offline-note" role="status">{tr(lang, 'podStale')}</div>}
      {show.description && <p className="sub pod-desc">{show.description}</p>}
      <p className="sub">{eps.length} {tr(lang, 'podEpisodes')} · {tr(lang, 'podRateHint')}</p>
      <TrackList tracks={tracks} lang={lang} likedIds={new Set()} currentId={state.current?.id ?? null} memoryKey={'podshow.' + id} emptyKey="podEmpty" />
    </>
  )
}
