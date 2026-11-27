import { useState } from 'react'
import type { Lang } from '../lib/types'
import { tr } from '../lib/i18n'
import { engine } from '../audio/engine'
import { Icon } from './Icon'

interface Props {
  lang: Lang
  onClose: () => void
  onImported: () => void
}

type PreviewTrack = { videoId?: string; title: string; artist: string; duration?: number; playlist?: string }
type Preview = { source: string; name: string; truncated: boolean; tracks: PreviewTrack[] }

const SOURCE_LABEL: Record<string, string> = { spotify: 'Spotify', apple: 'Apple Music', deezer: 'Deezer', youtube: 'YouTube', csv: 'CSV' }

export function ImportSheet({ lang, onClose, onImported }: Props) {
  const [mode, setMode] = useState<'url' | 'csv'>('url')
  const [input, setInput] = useState('')
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const fetchPreview = async () => {
    if (busy) return
    const body = mode === 'csv' ? { csv } : { url: input.trim() }
    if (mode === 'url' && !body.url) { setError(tr(lang, 'error')); return }
    if (mode === 'csv' && !csv.trim()) { setError(tr(lang, 'error')); return }
    setBusy(true); setError('')
    try {
      const d = await engine.api.importPreview(body)
      if (!d.tracks.length) { setPreview(null); setError(tr(lang, 'noResults')) } else setPreview(d)
    } catch {
      setPreview(null); setError(tr(lang, 'error'))
    } finally { setBusy(false) }
  }

  const confirm = async () => {
    if (busy || !preview) return
    setBusy(true); setError('')
    try {
      const nom = (preview.name || '').trim() && preview.name !== 'Apple Music' && preview.name !== 'CSV' ? preview.name : tr(lang, 'importTitle')
      const r = await engine.api.importApply(nom, preview.tracks)
      if (!r.ajoutes && !r.enAttente) throw new Error('empty')
      onImported()
    } catch { setError(tr(lang, 'error')) } finally { setBusy(false) }
  }

  const resume = preview ? preview.tracks.slice(0, 6) : []

  return (
    <div className="sheet small-sheet" id="importsheet">
      <div className="sheet-grab" />
      <button className="sheet-close" aria-label={tr(lang, 'close')} onClick={onClose}><Icon name="close" size={16} /></button>
      <h2 className="queue-title">{tr(lang, 'importTitle')}</h2>
      <div className="import-tabs">
        <button className={mode === 'url' ? 'on' : ''} onClick={() => { setMode('url'); setPreview(null); setError('') }}><Icon name="globe" size={14} /> {tr(lang, 'importUrl')}</button>
        <button className={mode === 'csv' ? 'on' : ''} onClick={() => { setMode('csv'); setPreview(null); setError('') }}><Icon name="download" size={14} /> {tr(lang, 'importCsv')}</button>
      </div>
      {mode === 'url' ? (
        <div className="add-new">
          <input value={input} placeholder={tr(lang, 'importHint')} aria-label={tr(lang, 'importHint')}
            onChange={(e) => { setInput(e.target.value); setError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') void fetchPreview() }} />
          <button className="btn-primary" type="button" disabled={busy} onClick={() => void fetchPreview()}>
            {busy && !preview ? tr(lang, 'loading') : tr(lang, 'importPreview')}
          </button>
        </div>
      ) : (
        <>
          <textarea className="import-csv" value={csv} placeholder={tr(lang, 'importCsvHint')} aria-label={tr(lang, 'importCsvHint')}
            onChange={(e) => { setCsv(e.target.value); setError('') }} rows={6} />
          <div className="add-new">
            <button className="btn-primary" type="button" style={{ flex: 1 }} disabled={busy} onClick={() => void fetchPreview()}>
              {busy && !preview ? tr(lang, 'loading') : tr(lang, 'importPreview')}
            </button>
          </div>
        </>
      )}
      {error && <div className="empty" style={{ padding: '12px 4px' }}>{error}</div>}
      {preview && (
        <div className="import-preview">
          <div className="track-txt">
            <div className="track-title">{preview.name || tr(lang, 'importTitle')}</div>
            <div className="track-sub">{SOURCE_LABEL[preview.source] || preview.source} · {preview.tracks.length} {tr(lang, 'tracks')}</div>
          </div>
          {preview.truncated && <p className="sub" style={{ color: 'var(--accent)' }}>{tr(lang, 'truncated')}</p>}
          <ul className="import-list">
            {resume.map((t, i) => (
              <li key={i}><span className="import-t">{t.title}</span><span className="import-a">{t.artist}</span></li>
            ))}
            {preview.tracks.length > resume.length && <li className="import-more">+{preview.tracks.length - resume.length}</li>}
          </ul>
          <button className="btn-primary" type="button" style={{ width: '100%' }} disabled={busy} onClick={() => void confirm()}>
            {busy ? tr(lang, 'loading') : tr(lang, 'importApply') + ' (' + preview.tracks.length + ')'}
          </button>
        </div>
      )}
    </div>
  )
}
