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
  let active = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentTime) active = i
    else break
  }

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
      <div ref={boxRef} style={{ ...wrap, overflow: 'auto' }}>
        {lines.map((line, i) => (
          <button
            key={i} type="button"
            ref={(el) => { rowRefs.current[i] = el }}
            onClick={() => onSeek(line.time)}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 10, border: 0, background: i === active ? 'var(--surface)' : 'transparent', color: i === active ? 'var(--txt)' : 'var(--txt-2)', fontWeight: i === active ? 750 : 500, fontSize: 15, lineHeight: 1.4 }}
          >{line.text}</button>
        ))}
      </div>
    )
  }
  if (record?.plain) return <div style={{ ...wrap, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.55, color: 'var(--txt-2)', padding: '4px 6px' }}>{record.plain}</div>
  return <EmptyState lang={lang} icon="note" titleKey="lyricsUnavailable" hintKey="lyricsHint" />
}
