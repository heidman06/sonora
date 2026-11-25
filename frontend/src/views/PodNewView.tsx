import { useEffect, useState } from 'react'
import type { Lang, PodcastEpisode } from '../lib/types'
import type { UiState } from '../audio/usePlayer'
import { tr } from '../lib/i18n'
import { engine } from '../audio/engine'
import { episodeToTrack } from '../lib/api'
import { navigate } from '../lib/hooks'
import { TrackList } from '../components/TrackList'
import { EmptyState } from '../components/EmptyState'

interface Props { lang: Lang; state: UiState }

export function PodNewView({ lang, state }: Props) {
  const api = engine.api
  const [eps, setEps] = useState<PodcastEpisode[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { if (state.token) api.podNew().then((r) => { setEps(r.episodes); setLoaded(true) }).catch(() => setLoaded(true)) }, [state.token, api])
  if (!state.token) { navigate('#/library'); return null }
  const tracks = eps.map((e) => episodeToTrack(e))
  return (
    <>
      <h1 className="h1">{tr(lang, 'podNew')}</h1>
      {loaded && !tracks.length
        ? <EmptyState lang={lang} icon="note" titleKey="podNewEmpty" hintKey="podEmptyHint" action={{ labelKey: 'podDiscover', onClick: () => navigate('#/podcasts') }} />
        : <TrackList tracks={tracks} lang={lang} likedIds={new Set()} currentId={state.current?.id ?? null} memoryKey="podnew" emptyKey="podNewEmpty" />}
    </>
  )
}
