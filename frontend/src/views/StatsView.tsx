import { useEffect, useState } from 'react'
import type { Lang } from '../lib/types'
import type { UiState } from '../audio/usePlayer'
import { tr } from '../lib/i18n'
import { navigate } from '../lib/hooks'
import { engine } from '../audio/engine'
import { normalizeTrack } from '../lib/api'
import { TrackList } from '../components/TrackList'
import { Icon } from '../components/Icon'

interface Props {
  lang: Lang
  state: UiState
}

type Stats = Awaited<ReturnType<typeof engine.api.stats>>

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 12px', textAlign: 'center' }
const cardNum: React.CSSProperties = { fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }
const cardLabel: React.CSSProperties = { marginTop: 4, fontSize: 12, color: 'var(--txt-2)' }
const h2: React.CSSProperties = { fontSize: 18, fontWeight: 750, letterSpacing: '-.02em', margin: '22px 0 10px' }

// Statistiques d'écoute (design features F5) : barres CSS proportionnelles, aucune lib.
export function StatsView({ lang, state }: Props) {
  const [data, setData] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [months, setMonths] = useState(6)

  useEffect(() => {
    let alive = true
    engine.api.stats(months).then((s) => {
      if (!alive) return
      setData(s); setLoading(false)
    }).catch(() => { if (alive) { setLoading(false); setError(true) } })
    return () => { alive = false }
  }, [months])

  const back = <button className="back-btn" aria-label={tr(lang, 'back')} onClick={() => navigate('#/library')}><Icon name="prev" size={18} /></button>
  if (loading) return <>{back}<h1 className="h1">{tr(lang, 'statsTitle')}</h1><div className="empty">{tr(lang, 'loading')}</div></>
  if (error || !data) return <>{back}<h1 className="h1">{tr(lang, 'statsTitle')}</h1><div className="empty">{tr(lang, 'error')}</div></>

  const topTracks = data.topTracks.map(normalizeTrack)
  const maxPlays = Math.max(1, ...data.perMonth.map((m) => m.plays))

  return (
    <>
      {back}
      <h1 className="h1">{tr(lang, 'statsTitle')}</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}>
        <div style={card}><div style={cardNum}>{data.totals.plays}</div><div style={cardLabel}>{tr(lang, 'statsPlays')}</div></div>
        <div style={card}><div style={cardNum}>{Math.round(data.totals.minutes)}</div><div style={cardLabel}>{tr(lang, 'statsMinutes')}</div></div>
        <div style={card}><div style={cardNum}>{data.totals.tracks}</div><div style={cardLabel}>{tr(lang, 'statsTracks')}</div></div>
      </div>
      <p className="sub">{tr(lang, 'statsHonest')}</p>
      <div className="segmented" role="group" aria-label={tr(lang, 'statsMonths')} style={{ marginTop: 10, width: 'fit-content' }}>
        {[3, 6, 12].map((n) => (
          <button key={n} type="button" className={months === n ? 'on' : ''} onClick={() => setMonths(n)}>{n} {tr(lang, 'statsMonths')}</button>
        ))}
      </div>

      <h2 style={h2}>{tr(lang, 'statsTopTracks')}</h2>
      <TrackList tracks={topTracks} lang={lang} likedIds={new Set(state.likes.map((t) => t.id))} currentId={state.current?.id ?? null} />

      <h2 style={h2}>{tr(lang, 'statsTopArtists')}</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {data.topArtists.map((a) => (
          <button className="chip" key={a.artist} type="button" onClick={() => navigate('#/search/' + encodeURIComponent(a.artist))}>{a.artist}</button>
        ))}
      </div>

      <h2 style={h2}>{tr(lang, 'statsPerMonth')}</h2>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        {data.perMonth.map((m) => (
          <div key={m.month} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div role="img" aria-label={m.month + ' : ' + m.plays} style={{ width: '100%', height: Math.max(2, Math.round((m.plays / maxPlays) * 96)), background: 'var(--accent)', borderRadius: '6px 6px 2px 2px' }} />
            <span style={{ fontSize: 10, color: 'var(--txt-3)', whiteSpace: 'nowrap' }}>{m.month.slice(5)}</span>
          </div>
        ))}
      </div>
    </>
  )
}
