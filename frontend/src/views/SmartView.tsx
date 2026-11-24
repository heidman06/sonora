import { useEffect, useState } from 'react'
import type { Lang, Track } from '../lib/types'
import type { UiState } from '../audio/usePlayer'
import { tr } from '../lib/i18n'
import { navigate } from '../lib/hooks'
import { engine } from '../audio/engine'
import { TrackList } from '../components/TrackList'
import { Icon } from '../components/Icon'

interface Props {
  lang: Lang
  state: UiState
  id: string
}

// Listes intelligentes virtuelles (design features F7) : lecture seule, noms traduits côté client.
export function SmartView({ lang, state, id }: Props) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const titleKey = id === 'top' ? 'smartTop' : id === 'recent' ? 'smartRecent' : 'smartNever'

  useEffect(() => {
    let alive = true
    setLoading(true); setError(false)
    // Clé validée côté serveur (404 si inconnue) ; le cast reflète le paramètre de route.
    engine.api.smart(id as 'top' | 'recent' | 'never').then((list) => {
      if (!alive) return
      setTracks(list); setLoading(false)
    }).catch(() => { if (alive) { setLoading(false); setError(true) } })
    return () => { alive = false }
  }, [id])

  return (
    <>
      <button className="back-btn" aria-label={tr(lang, 'back')} onClick={() => navigate('#/library')}><Icon name="prev" size={18} /></button>
      <h1 className="h1">{tr(lang, titleKey)}</h1>
      {!loading && !error && <p className="sub">{tracks.length} {tr(lang, 'tracks')}</p>}
      {loading && <div className="empty">{tr(lang, 'loading')}</div>}
      {error && <div className="empty">{tr(lang, 'error')}</div>}
      {!loading && !error && (
        <TrackList tracks={tracks} lang={lang} likedIds={new Set(state.likes.map((t) => t.id))} currentId={state.current?.id ?? null} />
      )}
    </>
  )
}
