import type { UiState } from '../audio/usePlayer'
import type { Route } from '../lib/hooks'
import type { Lang } from '../lib/types'
import { tr } from '../lib/i18n'
import { Icon } from './Icon'
import { Art } from './Art'

interface Props { lang: Lang; state: UiState; route: Route }

export function DesktopSidebar({ lang, state, route }: Props) {
  const nav = [
    { tab: 'listen', href: '#/listen', ico: 'listen', label: tr(lang, 'listen') },
    { tab: 'search', href: '#/search', ico: 'search', label: tr(lang, 'search') },
    { tab: 'library', href: '#/library', ico: 'library', label: tr(lang, 'library') },
  ] as const
  return (
    <aside className="desktop-sidebar">
      <a className="side-brand" href="#/listen">
        <span className="brand-dot" />
        <span className="side-brand-name">Sonora</span>
      </a>
      <nav className="side-nav">
        {nav.map((item) => (
          <a key={item.tab} className={'side-link' + (route.tab === item.tab ? ' on' : '')} href={item.href}>
            <Icon name={item.ico} size={20} /><span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div className="side-sep" />
      <div className="side-label">{tr(lang, 'yourPlaylists')}</div>
      <div className="side-playlists">
        {state.playlists.slice(0, 8).map((playlist) => (
          <a className="side-playlist" key={playlist.id} href={'#/playlist/' + playlist.id}>
            <Art id={playlist.cover?.[0]} />
            <span>{playlist.name}</span>
          </a>
        ))}
        {!state.playlists.length && <div className="side-empty">{tr(lang, 'noPlaylistsHint')}</div>}
      </div>
      <a className="side-all" href="#/library">{tr(lang, 'seeAll')}</a>
    </aside>
  )
}
