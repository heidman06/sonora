import type { Lang } from '../lib/types'
import { tr } from '../lib/i18n'

interface Props {
  lang: Lang
  rate: number
  hidden: boolean
  episode?: boolean
  onPick: (r: number) => void
}

const RATES = [0.75, 1, 1.25, 1.5]
const RATES_EP = [0.75, 1, 1.25, 1.5, 1.75, 2]

// Segment vitesse (design features F10) ; masqué avec message honnête en file HLS iOS.
export function RatePicker({ lang, rate, hidden, episode, onPick }: Props) {
  if (hidden) return <p className="sub">{tr(lang, 'rateHiddenIos')}</p>
  return (
    <div className="segmented" role="group" aria-label={tr(lang, 'rate')}>
      {(episode ? RATES_EP : RATES).map((r) => (
        <button key={r} type="button" className={rate === r ? 'on' : ''} aria-pressed={rate === r} onClick={() => onPick(r)}>
          {r + '×'}
        </button>
      ))}
    </div>
  )
}
