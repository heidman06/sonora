import { artOf } from '../lib/img'
import { Icon } from './Icon'

// Mosaïque 2x2 façon Spotify (design mixes X3) ; 4 img lazy, zéro dépendance.
// Sans pochette (compte froid/invité), une tuile typée remplace les 4 cases vides
// qui ressemblaient à un squelette de chargement infini.
export function MixArt({ cover }: { cover: string[] }) {
  const covers = (cover || []).filter(Boolean).slice(0, 4)
  if (!covers.length) {
    return (
      <div className="mix-art mix-art-fallback" aria-hidden="true">
        <Icon name="note" size={26} />
      </div>
    )
  }
  return (
    <div className="mix-art" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (covers[i] ? <img key={i} src={artOf(covers[i], 'mq')} alt="" loading="lazy" /> : <span key={i} className="mix-art-empty" />))}
    </div>
  )
}