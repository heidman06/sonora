import { useEffect, useState } from 'react'
import type { PlayerState } from '../audio/engine'
import type { Lang, Track } from '../lib/types'
import { tr } from '../lib/i18n'
import { navigate } from '../lib/hooks'
import { Icon } from '../components/Icon'
import { TrackRow } from '../components/TrackRow'

interface Props {
  lang: Lang
  state: PlayerState
  onPlay: (track: Track, queue: Track[], index: number) => void
  onLike: (track: Track) => void
  onDeletePlaylist: (id: number) => void
}

type Mode = 'login' | 'register'

export function LibraryView({ lang, state, onPlay, onLike, onDeletePlaylist }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [newPlaylist, setNewPlaylist] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (state.token) void import('../audio/engine').then(({ engine }) => engine.refreshLibrary())
  }, [state.token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) { setError(tr(lang, 'fillFields')); return }
    setBusy(true); setError('')
    try {
      const { engine } = await import('../audio/engine')
      if (mode === 'login') await engine.login(username.trim(), password)
      else await engine.register(username.trim(), password)
      setUsername(''); setPassword(''); setShowAddAccount(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : tr(lang, 'error'))
    } finally { setBusy(false) }
  }

  const languageRow = (
    <div className="setting-row">
      <b>{tr(lang, 'language')}</b>
      <div className="seg-lang">
        {(['fr', 'en', 'es'] as const).map((value) => (
          <button key={value} className={state.lang === value ? 'on' : ''}
            onClick={() => import('../audio/engine').then(({ engine }) => engine.setLang(value))}>{value.toUpperCase()}</button>
        ))}
      </div>
    </div>
  )

  if (!state.token) {
    return (
      <>
        <h1 className="h1">{tr(lang, 'library')}</h1>
        <p className="sub">{tr(lang, 'noSession')}</p>
        <div className="login-card">
          <h3>{mode === 'login' ? tr(lang, 'signIn') : tr(lang, 'createAccount')}</h3>
          <p>{tr(lang, 'signInBody')}</p>
          <form onSubmit={submit}>
            <div className="field"><input value={username} placeholder={tr(lang, 'username')} autoCapitalize="none" autoComplete="username" onChange={(e) => setUsername(e.target.value)} /></div>
            <div className="field"><input value={password} type="password" placeholder={tr(lang, 'password')} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} /></div>
            <button className="btn-wide" type="submit" disabled={busy}>{busy ? tr(lang, 'loggingIn') : mode === 'login' ? tr(lang, 'signIn') : tr(lang, 'createAccount')}</button>
            <button type="button" className="reg-link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
              {mode === 'login' ? tr(lang, 'createAccount') : tr(lang, 'signIn')}
            </button>
            {error && <div className="form-err">{error}</div>}
          </form>
        </div>
        {languageRow}
      </>
    )
  }

  const createPlaylist = async () => {
    const name = newPlaylist.trim()
    if (!name) return
    setCreating(true)
    try {
      const { engine } = await import('../audio/engine')
      await engine.createPlaylist(name)
      setNewPlaylist('')
    } finally { setCreating(false) }
  }

  return (
    <>
      <h1 className="h1">{tr(lang, 'library')}</h1>
      <p className="sub">{tr(lang, 'yourPlaylists')}</p>
      <div className="account">
        <div><b>{state.user}</b><br /><span>{state.playlists.length} {tr(lang, 'accountPlaylists')}</span></div>
        <button className="logout" onClick={() => import('../audio/engine').then(({ engine }) => engine.logout())}>{tr(lang, 'logout')}</button>
      </div>
      <div className="accounts">
        {state.accounts.map((account) => (
          <button className={'acc-chip' + (account.user === state.user ? ' on' : '')} key={account.user}
            onClick={() => import('../audio/engine').then(({ engine }) => engine.setActiveUser(account.user))}>
            <Icon name="note" size={14} />{account.user}
          </button>
        ))}
        <button className="acc-add" onClick={() => setShowAddAccount((value) => !value)}><Icon name="plus" size={15} /> {tr(lang, 'addAccount')}</button>
      </div>

      {showAddAccount && (
        <div className="login-card" style={{ marginTop: 14 }}>
          <h3>{tr(lang, 'addAccountTitle')}</h3>
          <p>{tr(lang, 'oneAccount')}</p>
          <form onSubmit={submit}>
            <div className="field"><input value={username} placeholder={tr(lang, 'username')} autoCapitalize="none" onChange={(e) => setUsername(e.target.value)} /></div>
            <div className="field"><input value={password} type="password" placeholder={tr(lang, 'password')} onChange={(e) => setPassword(e.target.value)} /></div>
            <button className="btn-wide" type="submit" disabled={busy}>{busy ? tr(lang, 'loggingIn') : tr(lang, 'signIn')}</button>
            {error && <div className="form-err">{error}</div>}
          </form>
        </div>
      )}

      <div className="setting-row"><b>{tr(lang, 'version')}</b><span style={{ opacity: 0.65, fontSize: 13 }}>2.0.2 · React</span></div>
      {languageRow}

      <section className="lib-sec">
        <div className="lib-sec-head"><h2 className="lib-sec-title">{tr(lang, 'downloads')}</h2></div>
        <div className="list">
          {state.downloads.map((download) => (
            <TrackRow key={download.id} track={download} queue={state.downloads} index={state.downloads.indexOf(download)}
              onPlay={onPlay} liked={state.likes.some((x) => x.id === download.id)}
              onLike={onLike} isCurrent={state.current?.id === download.id}
              durationLabel={(s) => formatTime(s)} onRemove={(track) => { void import('../audio/engine').then(({ engine }) => engine.removeDownload(track.id)) }} />
          ))}
          {!state.downloads.length && <div className="empty">{tr(lang, 'noDownloads')}</div>}
        </div>
      </section>

      <section className="lib-sec">
        <div className="lib-sec-head"><h2 className="lib-sec-title">{tr(lang, 'favorites')}</h2></div>
        <div className="list">
          {state.likes.map((track, index) => (
            <TrackRow key={track.id} track={track} queue={state.likes} index={index}
              onPlay={onPlay} liked onLike={onLike}
              isCurrent={state.current?.id === track.id} durationLabel={(s) => formatTime(s)} />
          ))}
          {!state.likes.length && <div className="empty">{tr(lang, 'noFavorites')}</div>}
        </div>
      </section>

      <section className="lib-sec">
        <div className="lib-sec-head"><h2 className="lib-sec-title">{tr(lang, 'myPlaylists')}</h2></div>
        <div className="add-new" style={{ marginBottom: 10 }}>
          <input value={newPlaylist} placeholder={tr(lang, 'newPlaylist')} onChange={(e) => setNewPlaylist(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void createPlaylist() }} />
          <button className="btn-primary" onClick={() => void createPlaylist()} disabled={creating}>{tr(lang, 'create')}</button>
        </div>
        <div className="pl-grid">
          {state.playlists.map((playlist) => (
            <div className="pl-card-wrap" key={playlist.id} style={{ position: 'relative' }}>
              <button className="pl-card" onClick={() => navigate('#/playlist/' + playlist.id)}>
                <img src={playlist.cover?.[0] ? 'https://i.ytimg.com/vi/' + playlist.cover[0] + '/mqdefault.jpg' : ''} alt="" loading="lazy" />
                <span className="pl-card-shade" />
                <span className="pl-card-txt">
                  <span className="pl-card-name">{playlist.name}</span>
                  <span className="pl-card-count">{playlist.count} {tr(lang, 'tracks')}</span>
                </span>
              </button>
              <button className="pl-delete" aria-label={tr(lang, 'delete')}
                style={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }}
                onClick={(e) => { e.stopPropagation(); if (window.confirm(tr(lang, 'delete') + ' « ' + playlist.name + ' » ?')) onDeletePlaylist(playlist.id) }}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
          {!state.playlists.length && <div className="empty">{tr(lang, 'noPlaylists')}</div>}
        </div>
      </section>
    </>
  )
}

function formatTime(sec: number): string {
  if (!sec) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m + ':' + (s < 10 ? '0' : '') + s
}
