import { useState } from 'react'
import type { Lang } from '../lib/types'
import type { UiState } from '../audio/usePlayer'
import { tr } from '../lib/i18n'
import { navigate } from '../lib/hooks'
import { matchesQuery } from '../lib/normalize'
import { engine, shuffleArray } from '../audio/engine'
import { TrackList } from '../components/TrackList'
import { Icon } from '../components/Icon'

interface Props {
  onMenu?: (t: import('../lib/types').Track) => void
  lang: Lang
  state: UiState
}

// Design échelle A3/N4 : le filtre porte sur la liste COMPLÈTE avant lotissement TrackList.
export function LikedView({ lang, state, onMenu }: Props) {
  const [query, setQuery] = useState('')
  const filtered = state.likes.filter((t) => matchesQuery(t, query))
  const likedIds = new Set(state.likes.map((t) => t.id))

  const shufflePlay = () => {
    if (!state.likes.length) return
    const shuffled = shuffleArray(state.likes)
    void engine.playTrack(shuffled[0], shuffled, 0)
  }

  return (
    <>
      <button className="back-btn" aria-label={tr(lang, 'back')} onClick={() => navigate('#/library')}><Icon name="prev" size={18} /></button>
      <h1 className="h1">{tr(lang, 'likedView')}</h1>
      <p className="sub">{state.likes.length} {tr(lang, 'tracks')}</p>
      <div className="searchbar" style={{ marginTop: 14 }}>
        <input value={query} placeholder={tr(lang, 'filterLikes')} aria-label={tr(lang, 'filterLikes')} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="pl-actions">
        <button className="btn-primary" type="button" disabled={!state.likes.length} onClick={shufflePlay}>
          <Icon name="shuffle" size={16} /> {tr(lang, 'shufflePlay')}
        </button>
      </div>
      <TrackList tracks={filtered} lang={lang} likedIds={likedIds} currentId={state.current?.id ?? null} memoryKey="liked" menu={!!onMenu} onMenu={onMenu} emptyKey="noFavorites" />
    </>
  )
}
