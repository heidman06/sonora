import type { Lang } from '../lib/types'
import { tr } from '../lib/i18n'
import { PATHS } from './Icon'

interface Props {
  lang: Lang
  icon: string
  titleKey: string
  hintKey?: string
  action?: { labelKey: string; onClick: () => void }
}

// État vide (design V6/S6) : 6+N nœuds (≤10 sans action, ≤11 avec action texte).
// Cercle/rayons en ::before/::after (0 DOM). Charte stroke 1.8 conservée.
export function EmptyState({ lang, icon, titleKey, hintKey, action }: Props) {
  return (
    <div className="empty-illu">
      <span className="empty-illu-art" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <g dangerouslySetInnerHTML={{ __html: PATHS[icon] || '' }} />
        </svg>
      </span>
      <div className="empty-title">{tr(lang, titleKey)}</div>
      {hintKey && <div className="empty-hint">{tr(lang, hintKey)}</div>}
      {action && <button className="empty-action" type="button" onClick={action.onClick}>{tr(lang, action.labelKey)}</button>}
    </div>
  )
}
