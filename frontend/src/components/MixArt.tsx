import { artOf } from '../lib/img'

// Mosaïque 2x2 façon Spotify (design mixes X3) ; 4 img lazy, zéro dépendance.
export function MixArt({ cover }: { cover: string[] }) {
  return (
    <div className="mix-art" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (cover[i] ? <img key={i} src={artOf(cover[i], 'mq')} alt="" loading="lazy" /> : <span key={i} className="mix-art-empty" />))}
    </div>
  )
}