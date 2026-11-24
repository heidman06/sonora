import type { Lang } from '../lib/types'
import { tr } from '../lib/i18n'

interface Props {
  lang: Lang
  playing: boolean
  onReload: () => void
}

// Bannière MAJ (design features F4) : reload à action utilisateur, désactivé pendant la lecture.
export function UpdateBanner({ lang, playing, onReload }: Props) {
  return (
    <div
      role="status"
      style={{ position: 'fixed', top: 'calc(10px + var(--safe-t))', left: '50%', transform: 'translateX(-50%)', zIndex: 160, display: 'flex', alignItems: 'center', gap: 12, background: '#0d0d12', color: '#f5f5f7', border: '1px solid rgba(255,255,255,.14)', borderRadius: 14, padding: '10px 14px', boxShadow: '0 18px 40px rgba(0,0,0,.4)', fontSize: 13.5, fontWeight: 650, maxWidth: 'calc(100vw - 24px)' }}
    >
      <span>{tr(lang, 'updateReady')}</span>
      <button className="btn-primary" type="button" style={{ flex: 'none', padding: '8px 14px', fontSize: 13 }} disabled={playing} onClick={onReload}>
        {tr(lang, 'reloadNow')}
      </button>
    </div>
  )
}
