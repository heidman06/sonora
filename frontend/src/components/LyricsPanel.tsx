import { useEffect, useMemo, useRef, useState } from 'react'
import type { Lang, Track } from '../lib/types'
import { tr } from '../lib/i18n'
import { fetchLyrics } from '../lib/lyrics'
import { parseLrc } from '../lib/lrc'
import { EmptyState } from './EmptyState'

interface Props {
  track: Track
  lang: Lang
  currentTime: number
  onSeek: (sec: number) => void
}

type LyricsRecord = Awaited<ReturnType<typeof fetchLyrics>>

// Panneau paroles (design features F1) : fetch paresseux au montage/changement de titre,
// ligne active = dernière dont time <= currentTime, auto-scroll block nearest, tap = seek.
export function LyricsPanel({ track, lang, currentTime, onSeek }: Props) {
  const [record, setRecord] = useState<LyricsRecord | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [offset, setOffset] = useState<number>(() => {
    try { const v = Number(localStorage.getItem('sonora.lyrics.offset')); return Number.isFinite(v) ? Math.max(-5000, Math.min(5000, v)) : 0 } catch (e) { return 0 }
  })
  const nudge = (delta: number) => setOffset((prev) => {
    const next = Math.max(-5000, Math.min(5000, prev + delta))
    try { localStorage.setItem('sonora.lyrics.offset', String(next)) } catch (e) { /* noop */ }
    return next
  })
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([])
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let alive = true
    setStatus('loading'); setRecord(null)
    fetchLyrics(track).then((rec) => {
      if (!alive) return
      // fetchLyrics ne throw jamais : un record vide (synced/plain vides, non instrumental) est un échec → Réessayer.
      if (!rec.synced && !rec.plain && !rec.instrumental) { setStatus('error'); return }
      setRecord(rec); setStatus('ready')
    }).catch(() => { if (alive) setStatus('error') })
    return () => { alive = false }
  }, [track.id, attempt])

  const lines = useMemo(() => (record?.synced ? parseLrc(record.synced) : []), [record])
  const t = currentTime + offset / 1000
  let active = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= t) active = i
    else break
  }

  useEffect(() => {
    if (!lines.length) return
    const panneau = boxRef.current && boxRef.current.closest('.player-panels')
    const sc = panneau && panneau.closest('.player-scroll')
    if (panneau && sc) {
      const delta = panneau.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 8
      try { sc.scrollTo({ top: Math.max(0, delta), behavior: 'auto' }) } catch (e) { /* noop */ }
    }
  }, [lines.length])

  useEffect(() => {
    // Scroll confiné au conteneur de paroles : scrollIntoView scrollerait aussi la page/sheet (vue cassée).
    const box = boxRef.current
    const row = active >= 0 ? rowRefs.current[active] : null
    if (!box || !row) return
    const target = row.offsetTop - box.clientHeight / 2 + row.clientHeight / 2
    box.scrollTo({ top: Math.max(0, target), behavior: 'auto' })
  }, [active])

  const wrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', width: '100%', flex: 1, minHeight: 0, maxHeight: '46vh', position: 'relative', zIndex: 3 }

  if (status === 'loading') return <div className="empty" style={wrap}>{tr(lang, 'loading')}</div>
  if (status === 'error') {
    return <EmptyState lang={lang} icon="note" titleKey="lyricsUnavailable" hintKey="lyricsHint" action={{ labelKey: 'retry', onClick: () => setAttempt((a) => a + 1) }} />
  }
  if (record?.instrumental) return <EmptyState lang={lang} icon="note" titleKey="lyricsInstrumental" hintKey="lyricsHint" />
  if (lines.length) {
    return (
      <div style={{ ...wrap, height: '46vh' }}>
        <div className="lyr-off" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, padding: '2px 4px 6px' }}>
          <button type="button" className="lyr-nudge" aria-label="lyrics -0,5s" onClick={() => nudge(-500)}>−</button>
          <span className="lyr-off-v" style={{ fontSize: 12, color: 'var(--txt-2)', minWidth: 46, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{(offset / 1000).toFixed(1).replace('.', ',')} s</span>
          <button type="button" className="lyr-nudge" aria-label="lyrics +0,5s" onClick={() => nudge(500)}>+</button>
        </div>
        <div ref={boxRef} style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {lines.map((line, i) => (
            <button
              key={i} type="button"
              ref={(el) => { rowRefs.current[i] = el }}
              onClick={() => onSeek(line.time)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 10, border: 0, background: i === active ? 'var(--surface)' : 'transparent', color: i === active ? 'var(--txt)' : 'var(--txt-2)', fontWeight: i === active ? 750 : 500, fontSize: 15, lineHeight: 1.4 }}
            >{line.text}</button>
          ))}
        </div>
      </div>
    )
  }
  if (record?.plain) return <div style={{ ...wrap, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.55, color: 'var(--txt-2)', padding: '4px 6px' }}>{record.plain}</div>
  return <EmptyState lang={lang} icon="note" titleKey="lyricsUnavailable" hintKey="lyricsHint" />
}
