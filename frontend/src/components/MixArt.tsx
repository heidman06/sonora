import { artOf } from '../lib/img'
import { Icon } from './Icon'

// Mosaïque 2x2 façon Spotify (design mixes X3) ; 4 img lazy, zéro dépendance.
// Sans pochette (compte froid/invité), une tuile typée remplace les 4 cases vides
// qui ressemblaient à un squelette de chargement infini.
const HUES: Record<string, number> = { moodChill: 205, moodPhonk: 285, moodRapFr: 14, moodRapUs: 14, moodAfro: 28, moodFrenchTouch: 322, moodRnb: 340, moodJazz: 42, moodElectro: 265, moodNew: 190, moodHitsFr: 8, moodHitsUs: 8, moodWorkout: 96, moodDrive: 230, moodParty: 305, moodFocus: 160, moodIndie: 175 }

export function MixArt({ cover, moodId }: { cover: string[]; moodId?: string }) {
  const covers = (cover || []).filter(Boolean).slice(0, 4)
  if (!covers.length) {
    const h = (moodId && HUES[moodId]) || 330
    return (
      <div className="mix-art" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="mix-art-cell" style={{ background: 'linear-gradient(135deg, hsl(' + (h + i * 14) + ' 78% ' + (44 + i * 6) + '%), hsl(' + (h + i * 14 + 30) + ' 70% ' + (22 + i * 4) + '%))' }}>
            <Icon name="note" size={14} />
          </span>
        ))}
      </div>
    )
  }
  return (
    <div className="mix-art" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (covers[i] ? <img key={i} src={artOf(covers[i], 'mq')} alt="" loading="lazy" /> : <span key={i} className="mix-art-empty" />))}
    </div>
  )
}