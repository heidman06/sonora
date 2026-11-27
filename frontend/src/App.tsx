import { useEffect, useState } from 'react'
import { engine } from './audio/engine'
import { usePlayerSelector, selectUiState } from './audio/usePlayer'
import { shallowEqual } from './lib/selector'
import { useHashRoute, useDynamicAmbient, useMediaQuery, navigate } from './lib/hooks'
import { nextLang, langLabel, tr } from './lib/i18n'
import type { Lang, Track } from './lib/types'
import { storage } from './lib/storage'
import { Icon } from './components/Icon'
import { MiniPlayer } from './components/MiniPlayer'
import { PlayerSheet } from './components/PlayerSheet'
import { QueueSheet } from './components/QueueSheet'
import { AddSheet } from './components/AddSheet'
import { DesktopSidebar } from './components/DesktopSidebar'
import { DesktopPlayer } from './components/DesktopPlayer'
import { NowPlayingPanel } from './components/NowPlayingPanel'
import { HomeView } from './views/HomeView'
import { SearchView } from './views/SearchView'
import { LibraryView } from './views/LibraryView'
import { PlaylistView } from './views/PlaylistView'
import { ArtistView } from './views/ArtistView'
import { LikedView } from './views/LikedView'
import { SmartView } from './views/SmartView'
import { StatsView } from './views/StatsView'
import { MixesView } from './views/MixesView'
import { PodcastsView } from './views/PodcastsView'
import { PodcastShowView } from './views/PodcastShowView'
import { PodNewView } from './views/PodNewView'
import { ActionSheet } from './components/ActionSheet'
import { UpdateBanner } from './components/UpdateBanner'
import { applyUpdate } from './lib/sw'

export default function App() {
  // Partage PWA (share_target) : on récupère un lien Spotify/Apple/YouTube partagé vers Sonora.
  useEffect(() => {
    const raw = new URLSearchParams(location.search).get('share')
    if (!raw) return
    let url = ''
    try {
      const j = JSON.parse(raw)
      url = String(j.url || '')
      if (!url && j.text) { const m = /https?:\/\/\S+/.exec(String(j.text)); if (m) url = m[0] }
    } catch (e) { url = raw }
    try { history.replaceState(null, '', location.pathname + (location.hash || '')) } catch (e) { /* noop */ }
    if (!/^https?:\/\//.test(url)) return
    try { sessionStorage.setItem('sonora.shareUrl', url) } catch (e) { /* noop */ }
    navigate('#/library')
  }, [])
  const state = usePlayerSelector(selectUiState, shallowEqual)
  const route = useHashRoute()
  const [playerOpen, setPlayerOpen] = useState(false)
  const [playerClosing, setPlayerClosing] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addTrack, setAddTrack] = useState<Track | null>(null)
  const [actionTrack, setActionTrack] = useState<Track | null>(null)
  const widePanel = useMediaQuery('(min-width: 1500px)')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => storage.get('theme', 'dark') as 'dark' | 'light')

  useEffect(() => { void engine.boot() }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    storage.set('theme', theme)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#07070a' : '#f7f7f9')
  }, [theme])
  useEffect(() => {
    document.body.classList.toggle('has-player', !!state.current)
  }, [state.current])
  useDynamicAmbient(state.current?.id)
  useEffect(() => {
    ;(window as unknown as { Sonora?: unknown }).Sonora = { S: { playing: state.playing, lang: state.lang } }
  }, [state.playing, state.lang])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && target.matches('input,textarea,select,[contenteditable=true]')) return
      if (event.code === 'Space') {
        if (target && target.closest('button,a,[role="button"],select,summary')) return
        event.preventDefault(); engine.togglePlay()
      }
      if (event.code === 'ArrowRight' && event.shiftKey) { event.preventDefault(); engine.seekBy(10); return }
      if (event.code === 'ArrowLeft' && event.shiftKey) { event.preventDefault(); engine.seekBy(-10); return }
      if (event.code === 'ArrowRight') { event.preventDefault(); engine.playNext(false) }
      if (event.code === 'ArrowLeft') { event.preventDefault(); engine.playPrev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1000px)')
    const onWheel = (e: WheelEvent) => {
      if (!mq.matches) return
      const target = e.target as HTMLElement | null
      const view = document.querySelector('.view') as HTMLElement | null
      if (!view || !target) return
      if (target.closest('.view')) return
      if (target.closest('#np-panel, .np-queue, .sheet, .queue-sheet, .pl-actions, [data-scroll-own]')) return
      if (!e.deltaY) return
      e.preventDefault()
      view.scrollTop += e.deltaY
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1000px)')
    const view = document.querySelector('.view')
    const top = document.querySelector('.top')
    if (!view || !top) return
    const onScroll = () => { if (mq.matches) top.classList.toggle('scrolled', view.scrollTop > 8) }
    view.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => view.removeEventListener('scroll', onScroll)
  }, [state.ready])

  const lang = state.lang as Lang
  const t = (key: string) => tr(lang, key)

  if (!state.ready) {
    return <div className="app" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', opacity: 0.7 }}>{t('loading')}</div>
  }

  const play = (track: Track, queue: Track[], index: number) => {
    void engine.playTrack(track, queue, index)
  }

  // Fermeture pilotée : état closing + timer reduce?0:260 (design V4/C3).
  const closePlayer = () => {
    if (playerClosing) return
    setPlayerClosing(true)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(() => { setPlayerOpen(false); setPlayerClosing(false) }, reduce ? 0 : 260)
  }

  const nav = [
    { tab: 'listen', href: '#/listen', ico: 'listen', label: t('listen') },
    { tab: 'search', href: '#/search', ico: 'search', label: t('search') },
    { tab: 'library', href: '#/library', ico: 'library', label: t('library') },
  ] as const

  return (
    <div className="app" id="app">
      <DesktopSidebar lang={lang} state={state} route={route} />
      <header className="top" id="top">
        <div className="top-row">
          <a className="brand" href="#/listen" aria-label="Sonora">
            <span className="brand-dot" />
            <span className="brand-name">Sonora</span>
          </a>
          <div className="top-actions">
            <button className="icon-btn lang-btn" aria-label={t('language')} onClick={() => engine.setLang(nextLang(lang))}>
              <Icon name="globe" size={14} /><span>{langLabel(lang)}</span>
            </button>
            <button className="icon-btn theme-btn" aria-label={t('theme')} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              <span className={'theme-ico' + (theme === 'light' ? ' light' : '')}>
                <Icon name="sun" size={18} className="i-sun" />
                <Icon name="moon" size={18} className="i-moon" />
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="view">
        {route.name === 'listen' && <HomeView lang={lang} state={state} onPlay={play} />}
        {route.name === 'search' && <SearchView lang={lang} state={state} query={route.id} onPlay={play} onMenu={setActionTrack} />}
        {route.name === 'library' && (
          <LibraryView lang={lang} state={state} onPlay={play} onLike={(track) => void engine.toggleLike(track)} onMenu={setActionTrack}
            onDeletePlaylist={(id) => { void engine.deletePlaylist(id) }} />
        )}
        {route.name === 'playlist' && (
          <PlaylistView lang={lang} state={state} id={route.id} onPlay={play} onLike={(track) => void engine.toggleLike(track)} onMenu={setActionTrack}
            onDelete={(id) => { void engine.deletePlaylist(id); window.location.hash = '#/library' }} />
        )}
        {route.name === 'artist' && <ArtistView lang={lang} state={state} id={route.id} onPlay={play} onLike={(track) => void engine.toggleLike(track)} onMenu={setActionTrack} />}
        {route.name === 'liked' && <LikedView lang={lang} state={state} onMenu={setActionTrack} />}
        {route.name === 'smart' && <SmartView lang={lang} state={state} id={route.id} />}
        {route.name === 'stats' && <StatsView lang={lang} state={state} />}
      {route.name === 'mixes' && <MixesView lang={lang} state={state} id={route.id} onPlay={play} onMenu={setActionTrack} />}
      {route.name === 'podcasts' && <PodcastsView lang={lang} state={state} />}
      {route.name === 'podshow' && <PodcastShowView lang={lang} state={state} id={route.id} />}
      {route.name === 'podnew' && <PodNewView lang={lang} state={state} />}
      </main>

      <MiniPlayer state={state} lang={lang} onOpen={() => setPlayerOpen(true)} onToggle={() => engine.togglePlay()} onNext={() => engine.playNext(false)} />

      <nav className="tabs" id="tabs">
        {nav.map((item) => (
          <a key={item.tab} className={'tab' + (route.tab === item.tab ? ' on' : '')} data-tab={item.tab} href={item.href}>
            <span className="tab-ico"><Icon name={item.ico} size={21} /></span><span>{item.label}</span>
          </a>
        ))}
      </nav>

      {playerOpen && state.current && (
        <PlayerSheet state={state} lang={lang} closing={playerClosing} liked={state.likes.some((x) => x.id === state.current?.id)}
          onClose={closePlayer} onToggle={() => engine.togglePlay()}
          onNext={() => engine.playNext(false)} onPrev={() => engine.playPrev()}
          onSeek={(ratio) => engine.seekRatio(ratio)} onVolume={(value) => engine.setVolume(value)}
          onLike={() => state.current && void engine.toggleLike(state.current)}
          onAdd={() => setAddOpen(true)} onDownload={() => state.current && void engine.downloadTrack(state.current)}
          onQueue={() => setQueueOpen(true)} onRepeat={() => engine.cycleRepeat()} onShuffle={() => engine.toggleShuffle()}
          fmt={(seconds) => engine.timeLabel(seconds)} />
      )}

      {queueOpen && <QueueSheet lang={lang} state={state} onClose={() => setQueueOpen(false)} onPlay={play} fmt={(seconds) => engine.timeLabel(seconds)} />}

      {actionTrack && (
        <ActionSheet track={actionTrack} lang={lang} onClose={() => setActionTrack(null)}
          onPlayNext={(t) => engine.playNextInQueue(t)} onEnqueue={(t) => engine.enqueue(t)}
          onAdd={(t) => { setAddTrack(t); setAddOpen(true) }} onRadio={(t) => void engine.startRadio(t.id)} />
      )}
      {state.swUpdate && <UpdateBanner lang={lang} playing={state.playing} onReload={applyUpdate} />}
      {addOpen && (state.current || addTrack) && (
        <AddSheet state={state} lang={lang} track={addTrack ?? state.current} onClose={() => { setAddOpen(false); setAddTrack(null) }}
          onAdd={(playlistId, track) => { void engine.addToPlaylist(playlistId, track).then(() => setAddOpen(false)) }}
          onCreate={(name) => engine.createPlaylist(name)} />
      )}

      <DesktopPlayer state={state} lang={lang} fmt={(seconds) => engine.timeLabel(seconds)}
        onOpen={() => setPlayerOpen(true)} onToggle={() => engine.togglePlay()}
        onNext={() => engine.playNext(false)} onPrev={() => engine.playPrev()}
        onSeek={(ratio) => engine.seekRatio(ratio)} onVolume={(value) => engine.setVolume(value)}
        onQueue={() => setQueueOpen(true)} onLike={() => state.current && void engine.toggleLike(state.current)}
        onRepeat={() => engine.cycleRepeat()} onShuffle={() => engine.toggleShuffle()}
        onAdd={() => setAddOpen(true)} onDownload={() => state.current && void engine.downloadTrack(state.current)} />

      {widePanel && state.current && <NowPlayingPanel lang={lang} state={state} onQueue={() => setQueueOpen(true)} />}

      {state.toast && <div className="toast" role="status" aria-live="polite">{state.toast}</div>}
      {state.authError && !state.token && (
        <div className="session-banner" role="alert">{state.authError} <a href="#/library">{t('signIn')}</a></div>
      )}
    </div>
  )
}
