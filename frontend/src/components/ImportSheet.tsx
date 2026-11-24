import { useState } from 'react'
import type { Lang, PlaylistDetail } from '../lib/types'
import { tr } from '../lib/i18n'
import { engine } from '../audio/engine'
import { Icon } from './Icon'

interface Props {
  lang: Lang
  onClose: () => void
  onImported: () => void
}

type Preview = PlaylistDetail & { truncated?: boolean }

// Extraction list=… sinon ID brut (design échelle P3) ; rien n'est créé avant l'aperçu.
function extractListId(raw: string): string | null {
  const s = raw.trim()
  const m = /[?&]list=([A-Za-z0-9_-]+)/.exec(s)
  if (m) return m[1]
  return /^[A-Za-z0-9_-]{10,80}$/.test(s) ? s : null
}

export function ImportSheet({ lang, onClose, onImported }: Props) {
  const [input, setInput] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const fetchPreview = async () => {
    if (busy) return
    const id = extractListId(input)
    if (!id) { setError(true); return }
    setBusy(true); setError(false)
    try {
      const d = await engine.api.ytPlaylist(id)
      setPreview(d)
    } catch {
      setPreview(null); setError(true)
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    if (busy || !preview) return
    setBusy(true); setError(false)
    let pid: number | null = null
    try {
      const name = preview.name.trim() || tr(lang, 'importYouTube')
      const p = await engine.createPlaylist(name)
      pid = p.id
      await engine.api.bulkAddToPlaylist(p.id, preview.tracks)
      onImported()
    } catch {
      // Bulk échoué ⇒ suppression best-effort de la playlist créée (design P3, R-e).
      if (pid !== null) { try { await engine.deletePlaylist(pid) } catch { /* dégradation sûre : playlist vide supprimable */ } }
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet small-sheet" id="importsheet">
      <div className="sheet-grab" />
      <button className="sheet-close" aria-label={tr(lang, 'close')} onClick={onClose}><Icon name="close" size={16} /></button>
      <h2 className="queue-title">{tr(lang, 'importYouTube')}</h2>
      <div className="add-new">
        <input value={input} placeholder={tr(lang, 'importHint')} aria-label={tr(lang, 'importHint')}
          onChange={(e) => { setInput(e.target.value); setError(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') void fetchPreview() }} />
        <button className="btn-primary" type="button" disabled={busy} onClick={() => void fetchPreview()}>
          {busy && !preview ? tr(lang, 'loading') : tr(lang, 'importYouTube')}
        </button>
      </div>
      {error && <div className="empty" style={{ padding: '12px 4px' }}>{tr(lang, 'error')}</div>}
      {preview && (
        <div className="queue-list" style={{ flex: 'none' }}>
          <div className="track-txt" style={{ padding: '10px 4px 0' }}>
            <div className="track-title">{preview.name}</div>
            <div className="track-sub">{preview.tracks.length} {tr(lang, 'tracks')}</div>
          </div>
          {preview.truncated && <p className="sub" style={{ padding: '8px 4px 0', color: 'var(--accent)' }}>{tr(lang, 'truncated')}</p>}
          <div className="add-new">
            <button className="btn-primary" type="button" style={{ flex: 1 }} disabled={busy} onClick={() => void confirm()}>
              {busy ? tr(lang, 'loading') : tr(lang, 'confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
