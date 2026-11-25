import { useEffect, useState } from 'react'
import { engine } from '../audio/engine'
import type { UiState } from '../audio/usePlayer'
import type { Lang, MixesResponse, Track } from '../lib/types'
import { tr } from '../lib/i18n'
import { navigate, useScrollMemory } from '../lib/hooks'
import { lireMixesMem, lireMixesCache, majMixesMem, ecrireMixesCache, peutEcrireMixes, mixLabel, mixSubtitle, coquillesCold, qCoquille } from '../lib/mixes'
import { TrackList } from '../components/TrackList'
import { MixArt } from '../components/MixArt'
import { Icon } from '../components/Icon'

interface Props { lang: Lang; state: UiState; id: string; onPlay: (t: Track, q: Track[], i: number) => void; onMenu?: (t: Track) => void }

export function MixesView({ lang, state, id, onPlay, onMenu }: Props) {
  const [resp, setResp] = useState<MixesResponse | null>(() => lireMixesMem(state.user) || lireMixesCache(state.user))
  const [loading, setLoading] = useState(!resp)
  useScrollMemory('mixes')
  useEffect(() => {
    let alive = true
    const capture = { user: state.user }
    const mem = lireMixesMem(state.user) || lireMixesCache(state.user)
    if (mem) { setResp(mem); setLoading(false) } else if (!state.token) { setResp(coquillesCold()); setLoading(false); return }
    if (!state.token) return
    engine.api.mixes2().then((r) => {
      if (!alive || !peutEcrireMixes(capture, { user: state.user })) return
      setResp(r); setLoading(false)
      majMixesMem(capture.user, r)
      ecrireMixesCache(capture.user, r)
    }).catch(() => { if (alive) { setLoading(false); if (!mem) setResp(coquillesCold()) } })
    return () => { alive = false }
  }, [state.token, state.user])
  const play = (mix: MixesResponse['mixes'][number]) => {
    if (mix.tracks.length) { onPlay(mix.tracks[0], mix.tracks, 0); return }
    if (mix.moodId) void engine.api.radio(qCoquille(lang, mix.moodId), 40).then((ts) => { if (ts.length) onPlay(ts[0], ts, 0) }).catch(() => {})
  }
  if (loading) return <div className="empty">{tr(lang, 'loading')}</div>
  const mixes = resp ? resp.mixes : []
  const detail = id ? mixes.find((m) => m.key === id) : undefined
  if (id && !detail) { navigate('#/mixes'); return null }
  if (detail) {
    return (
      <>
        <button className="back-btn" aria-label={tr(lang, 'back')} onClick={() => navigate('#/mixes')}><Icon name="prev" size={18} /></button>
        <h1 className="h1">{mixLabel(lang, detail)}</h1>
        <p className="sub">{mixSubtitle(lang, detail)} · {detail.count} {tr(lang, 'tracks')}</p>
        <TrackList tracks={detail.tracks} lang={lang} likedIds={new Set(state.likes.map((l) => l.id))} currentId={state.current?.id ?? null} memoryKey={'mixes.' + detail.key} menu={!!onMenu} onMenu={onMenu} emptyKey="noResults" />
      </>
    )
  }
  return (
    <>
      <button className="back-btn" aria-label={tr(lang, 'back')} onClick={() => navigate('#/listen')}><Icon name="prev" size={18} /></button>
      <h1 className="h1">{tr(lang, 'yourMixes')}</h1>
      <div className="pl-grid">
        {mixes.map((m) => (
          <button className="pl-card mix-grid-card" key={m.key} onClick={() => navigate('#/mixes/' + m.key)}>
            <MixArt cover={m.cover} moodId={m.moodId} />
            <span className="pl-card-txt">
              <span className="pl-card-name">{mixLabel(lang, m)}</span>
              <span className="pl-card-count">{m.count} {tr(lang, 'tracks')}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  )
}