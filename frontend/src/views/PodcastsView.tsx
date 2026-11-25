import { useEffect, useState } from 'react'
import type { Lang, PodDiscovery } from '../lib/types'
import type { UiState } from '../audio/usePlayer'
import { tr } from '../lib/i18n'
import { engine } from '../audio/engine'
import { navigate } from '../lib/hooks'
import { Icon } from '../components/Icon'
import { EmptyState } from '../components/EmptyState'

interface Props { lang: Lang; state: UiState }

export function PodcastsView({ lang, state }: Props) {
  const api = engine.api
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PodDiscovery[]>([])
  const [curated, setCurated] = useState<PodDiscovery[]>([])
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (state.token) api.podCurated(lang).then((r) => setCurated(r.results)).catch(() => {}) }, [lang, state.token, api])
  useEffect(() => {
    if (!state.token || !q.trim()) { setResults([]); return }
    const t = window.setTimeout(() => { api.podSearch(q.trim()).then((r) => setResults(r.results)).catch(() => setResults([])) }, 300)
    return () => window.clearTimeout(t)
  }, [q, state.token, api])
  if (!state.token) {
    return (<><h1 className="h1">{tr(lang, 'podcasts')}</h1><EmptyState lang={lang} icon="note" titleKey="podGuestTitle" hintKey="podGuestHint" action={{ labelKey: 'signIn', onClick: () => navigate('#/library') }} /></>)
  }
  const open = async (feedUrl: string) => {
    setBusy(true); setErr('')
    try { const r = await api.podAddShow(feedUrl); navigate('#/podshow/' + r.show.id) }
    catch (e) { setErr(tr(lang, 'podFetchError')) }
    finally { setBusy(false) }
  }
  const row = (d: PodDiscovery) => (
    <button className="pod-row" key={d.feedUrl} type="button" disabled={busy} onClick={() => void open(d.feedUrl)}>
      {d.logo ? <img className="pod-row-art" src={d.logo} alt="" loading="lazy" /> : <span className="pod-row-art pod-row-fallback"><Icon name="note" size={18} /></span>}
      <span className="pod-row-txt"><b>{d.title}</b><span>{d.author}</span></span>
      <Icon name="plus" size={16} />
    </button>
  )
  return (
    <>
      <h1 className="h1">{tr(lang, 'podcasts')}</h1>
      <p className="sub"><a className="section-link" href="#/podnew">{tr(lang, 'podNew')}</a></p>
      <div className="searchbar pod-search">
        <span className="s-ico"><Icon name="search" size={19} /></span>
        <input type="search" value={q} placeholder={tr(lang, 'podSearchPlaceholder')} autoComplete="off" onChange={(e) => setQ(e.target.value)} />
      </div>
      {err && <div className="form-err">{err}</div>}
      {q.trim() && <section className="section"><div className="section-head"><h2 className="section-title">{tr(lang, 'podDiscover')}</h2></div>
        {results.length ? <div className="pod-list">{results.map(row)}</div> : <div className="empty">{tr(lang, 'podNoResults')}</div>}
      </section>}
      <section className="section"><div className="section-head"><h2 className="section-title">{tr(lang, 'podCurated')}</h2></div>
        <div className="pod-list">{curated.map(row)}</div>
      </section>
      <section className="section"><div className="section-head"><h2 className="section-title">{tr(lang, 'podImportUrl')}</h2></div>
        <div className="pod-import">
          <input value={url} placeholder={tr(lang, 'podImportPlaceholder')} autoComplete="off" onChange={(e) => setUrl(e.target.value)} />
          <button className="btn-primary" type="button" disabled={busy || !url.trim()} onClick={() => void open(url.trim())}>{tr(lang, 'podAddUrl')}</button>
        </div>
      </section>
    </>
  )
}
