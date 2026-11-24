import { useEffect, useState } from 'react'
import { engine } from './audio/engine'
import { usePlayer } from './audio/usePlayer'
import { useHashRoute } from './lib/hooks'
import { nextLang, langLabel, tr } from './lib/i18n'
import type { Lang, Track } from './lib/types'
import { storage } from './lib/storage'
import { Icon } from './components/Icon'
import { MiniPlayer } from './components/MiniPlayer'
import { PlayerSheet } from './components/PlayerSheet'
import { QueueSheet } from './components/QueueSheet'
import { AddSheet } from './components/AddSheet'
import { HomeView } from './views/HomeView'
import { SearchView } from './views/SearchView'
import { LibraryView } from './views/LibraryView'
import { PlaylistView } from './views/PlaylistView'
import { ArtistView } from './views/ArtistView'

export default function App() {
  const state = usePlayer()
  const route = useHashRoute()
  const [playerOpen, setPlayerOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => storage.get('theme', 'dark') as 'dark' | 'light')

  useEffect(() => { void engine.boot() }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    storage.set('theme', theme)
  }, [theme])
  useEffect(() => {
    document.body.classList.toggle('has-player', !!state.current)
  }, [state.current])

  const lang = state.lang as Lang
  const t = (key: string) => tr(lang, key)

  if (!state.ready) {
    return <div className="app" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', opacity: 0.7 }}>{t('loading')}</div>
  }

  const play = (track: Track, queue: Track[], index: number) => {
    setPlayerOpen(true)
    void engine.playTrack(track, queue, index)
  }

  const nav = [
    { tab: 'listen', href: '#/listen', ico: 'listen', label: t('listen') },
    { tab: 'search', href: '#/search', ico: 'search', label: t('search') },
    { tab: 'library', href: '#/library', ico: 'library', label: t('library') },
  ] as const

  return (
    <div className="app" id="app">
      <header className="top" id="top">
        <div className="top-row">
          <a className="brand" href="#/listen" aria-label="Sonora">
            <span className="brand-dot" />
            <span className="brand-name">Sonora</span>
          </a>
          <div className="top-actions">
            <button className="icon-btn lang-btn" aria-label={t('language')} onClick={() => engine.setLang(nextLang(lang))}>{langLabel(lang)}</button>
            <button className="icon-btn" aria-label="theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="view">
        {route.name === 'listen' && <HomeView lang={lang} state={state} onPlay={play} />}
        {route.name === 'search' && <SearchView lang={lang} state={state} query={route.id} onPlay={play} />}
        {route.name === 'library' && (
          <LibraryView lang={lang} state={state} onPlay={play} onLike={(track) => void engine.toggleLike(track)}
            onDeletePlaylist={(id) => { void engine.deletePlaylist(id) }} />
        )}
        {route.name === 'playlist' && (
          <PlaylistView lang={lang} state={state} id={route.id} onPlay={play} onLike={(track) => void engine.toggleLike(track)}
            onDelete={(id) => { void engine.deletePlaylist(id); window.location.hash = '#/library' }} />
        )}
        {route.name === 'artist' && <ArtistView lang={lang} state={state} id={route.id} onPlay={play} onLike={(track) => void engine.toggleLike(track)} />}
      </main>

      <MiniPlayer state={state} onOpen={() => setPlayerOpen(true)} onToggle={() => engine.togglePlay()} onNext={() => engine.playNext(false)} />

      <nav className="tabs" id="tabs">
        {nav.map((item) => (
          <a key={item.tab} className={'tab' + (route.tab === item.tab ? ' on' : '')} data-tab={item.tab} href={item.href}>
            <span className="tab-ico"><Icon name={item.ico} size={21} /></span><span>{item.label}</span>
          </a>
        ))}
      </nav>

      {playerOpen && state.current && (
        <PlayerSheet state={state} lang={lang} liked={state.likes.some((x) => x.id === state.current?.id)}
          onClose={() => setPlayerOpen(false)} onToggle={() => engine.togglePlay()}
          onNext={() => engine.playNext(false)} onPrev={() => engine.playPrev()}
          onSeek={(ratio) => engine.seekRatio(ratio)} onVolume={(value) => engine.setVolume(value)}
          onLike={() => state.current && void engine.toggleLike(state.current)}
          onAdd={() => setAddOpen(true)} onDownload={() => state.current && void engine.downloadTrack(state.current)}
          onQueue={() => setQueueOpen(true)} onRepeat={() => engine.cycleRepeat()} onShuffle={() => engine.toggleShuffle()}
          fmt={(seconds) => engine.timeLabel(seconds)} />
      )}

      {queueOpen && <QueueSheet lang={lang} state={state} onClose={() => setQueueOpen(false)} onPlay={play} fmt={(seconds) => engine.timeLabel(seconds)} />}

      {addOpen && state.current && (
        <AddSheet state={state} lang={lang} onClose={() => setAddOpen(false)}
          onAdd={(playlistId, track) => { void engine.addToPlaylist(playlistId, track).then(() => setAddOpen(false)) }}
          onCreate={(name) => engine.createPlaylist(name)} />
      )}

      {state.toast && <div className="toast">{state.toast}</div>}
    </div>
  )
}
