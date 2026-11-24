import { useEffect, useState } from 'react'
import type { Lang } from '../lib/types'
import { tr } from '../lib/i18n'

interface Props {
  lang: Lang
  mode: string
  endsAt: number
  onPick: (mode: string) => void
}

const MODES = ['off', '15', '30', '45', '60', 'end']
const MINUTES = ['15', '30', '45', '60']

// Segment minuterie (design features F2) + compte à rebours mm:ss tické localement à 1 s.
export function SleepPicker({ lang, mode, endsAt, onPick }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const minutes = MINUTES.includes(mode)

  useEffect(() => {
    if (!minutes || endsAt <= Date.now()) return
    const timer = window.setInterval(() => {
      setNow(Date.now())
      if (Date.now() >= endsAt) window.clearInterval(timer)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [minutes, endsAt])

  const left = Math.max(0, Math.ceil((endsAt - now) / 1000))
  const mm = Math.floor(left / 60)
  const ss = left % 60
  const countdown = mm + ':' + (ss < 10 ? '0' : '') + ss

  return (
    <div>
      <div className="segmented" role="group" aria-label={tr(lang, 'sleepTimer')}>
        {MODES.map((m) => (
          <button key={m} type="button" className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => onPick(m)}>
            {m === 'off' ? tr(lang, 'sleepOff') : m === 'end' ? tr(lang, 'sleepEnd') : m}
          </button>
        ))}
      </div>
      {minutes && endsAt > now && <p className="sub" style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{countdown}</p>}
    </div>
  )
}
