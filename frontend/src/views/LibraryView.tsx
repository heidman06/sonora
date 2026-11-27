import { useEffect, useState } from 'react'
import type { UiState } from '../audio/usePlayer'
import type { Lang } from '../lib/types'
import { tr } from '../lib/i18n'
import { navigate, useScrollMemory } from '../lib/hooks'
import { Icon } from '../components/Icon'
import { Art } from '../components/Art'
import { TrackList } from '../components/TrackList'
import { usePrefetch } from '../lib/prefetch'
import { EmptyState } from '../components/EmptyState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ApiError } from '../lib/api'
import { engine } from '../audio/engine'
import { resetApp } from '../lib/sw'

interface Props {
  lang: Lang
  state: UiState
  onPlay: (track: import('../lib/types').Track, queue: import('../lib/types').Track[], index: number) => void
  onLike: (track: import('../lib/types').Track) => void
  onDeletePlaylist: (id: number) => void
  onMenu?: (t: import('../lib/types').Track) => void
}

type Mode = 'login' | 'register'

export function LibraryView({ lang, state, onDeletePlaylist, onMenu }: Props) {
  useScrollMemory('library')
  usePrefetch(state.likes)
  usePrefetch(state.downloads)
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [newPlaylist, setNewPlaylist] = useState('')
  const [creating, setCreating] = useState(false)
  const [confirmDel, setConfirmDel] = useState<{ id: number; name: string } | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    if (state.token) void engine.refreshLibrary()
  }, [state.token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) { setError(tr(lang, 'fillFields')); return }
    setBusy(true); setError('')
    try {
      if (mode === 'login') await engine.login(username.trim(), password)
      else await engine.register(username.trim(), password, inviteCode.trim() || undefined)
      setUsername(''); setPassword(''); setInviteCode(''); setShowAddAccount(false)
    } catch (err) {
      setError(authMessage(err, lang))
    } finally { setBusy(false) }
  }

  const languageRow = (
    <div className="setting-row">
      <b>{tr(lang, 'language')}</b>
      <div className="seg-lang">
        {(['fr', 'en', 'es'] as const).map((value) => (
          <button key={value} className={state.lang === value ? 'on' : ''} onClick={() => engine.setLang(value)}>{value.toUpperCase()}</button>
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
            {mode === 'register' && <div className="field"><input value={inviteCode} placeholder={tr(lang, 'inviteCode')} autoComplete="off" onChange={(e) => setInviteCode(e.target.value)} /></div>}
            {mode === 'register' && <p className="sub" style={{ margin: '-4px 0 10px', fontSize: 12 }}>{tr(lang, 'inviteCodeHint')}</p>}
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
    try { await engine.createPlaylist(name); setNewPlaylist('') } finally { setCreating(false) }
  }

  const likedIds = new Set(state.likes.map((t) => t.id))

  return (
    <>
      <h1 className="h1">{tr(lang, 'library')}</h1>
      <p className="sub">{tr(lang, 'yourPlaylists')}</p>
      <section className="section pod-lib">
        <div className="section-head"><h2 className="section-title">{tr(lang, 'podcasts')}</h2><a className="section-link" href="#/podcasts">{tr(lang, 'podDiscover')}</a></div>
        <div className="pod-lib-links">
          <a className="chip" href="#/podcasts"><Icon name="note" size={14} /> {tr(lang, 'podDiscover')}</a>
          <a className="chip" href="#/podnew"><Icon name="spark" size={14} /> {tr(lang, 'podNew')}</a>
        </div>
      </section>
      {(state.stale.playlists || state.stale.likes) && <div className="offline-note" role="status">{tr(lang, 'offlineBanner')}</div>}
      <div className="account">
        <div><b>{state.user}</b><br /><span>{state.playlists.length} {tr(lang, 'accountPlaylists')}</span></div>
        <button className="logout" onClick={() => void engine.logout()}>{tr(lang, 'logout')}</button>
      </div>
      <div className="accounts">
        {state.accounts.map((account) => (
          <button className={'acc-chip' + (account.user === state.user ? ' on' : '')} key={account.user} onClick={() => void engine.setActiveUser(account.user)}>
            <Icon name="note" size={14} />{account.user}
          </button>
        ))}
        <button className="acc-add" onClick={() => setShowAddAccount((v) => !v)}><Icon name="plus" size={15} /> {tr(lang, 'addAccount')}</button>
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

      <section className="lib-sec">
        <div className="lib-sec-head"><h2 className="lib-sec-title">{tr(lang, 'myPlaylists')}</h2>
          <button className="section-link" onClick={() => setImportOpen(true)}>{tr(lang, 'importYouTube')}</button>
        </div>
        <div className="add-new" style={{ marginBottom: 10 }}>
          <input value={newPlaylist} placeholder={tr(lang, 'newPlaylist')} onChange={(e) => setNewPlaylist(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void createPlaylist() }} />
          <button className="btn-primary" onClick={() => void createPlaylist()} disabled={creating}>{tr(lang, 'create')}</button>
        </div>
        <div className="pl-grid">
          {state.playlists.map((playlist) => (
            <div className="pl-card-wrap" key={playlist.id} style={{ position: 'relative' }}>
              <button className="pl-card" onClick={() => navigate('#/playlist/' + playlist.id)}>
                <Art id={playlist.cover?.[0]} />
                <span className="pl-card-shade" />
                <span className="pl-card-txt">
                  <span className="pl-card-name">{playlist.name}</span>
                  <span className="pl-card-count">{playlist.count} {tr(lang, 'tracks')}</span>
                </span>
              </button>
              <button className="pl-delete" aria-label={tr(lang, 'delete')} style={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }}
                onClick={(e) => { e.stopPropagation(); setConfirmDel({ id: playlist.id, name: playlist.name }) }}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
          {!state.playlists.length && <EmptyState lang={lang} icon="library" titleKey="noPlaylists" hintKey="noPlaylistsHint" />}
        </div>
      </section>

      <section className="lib-sec">
        <button className="liked-card" onClick={() => navigate('#/liked')}>
          <span className="liked-card-ico"><Icon name="heartFill" size={20} /></span>
          <span className="liked-card-txt"><b>{tr(lang, 'likedView')}</b><span>{state.likes.length} {tr(lang, 'tracks')}</span></span>
          <Icon name="next" size={16} />
        </button>
        <TrackList tracks={state.likes.slice(0, 20)} lang={lang} likedIds={likedIds} currentId={state.current?.id ?? null} memoryKey="library.likes" menu={!!onMenu} onMenu={onMenu} emptyKey="noFavorites" />
      </section>

      <section className="lib-sec">
        <div className="lib-sec-head"><h2 className="lib-sec-title">{tr(lang, 'smartTop')}</h2></div>
        <div className="chips">
          {(['top', 'recent', 'never'] as const).map((k) => (
            <button className="chip" key={k} onClick={() => navigate('#/smart/' + k)}>
              {tr(lang, k === 'top' ? 'smartTop' : k === 'recent' ? 'smartRecent' : 'smartNever')}
            </button>
          ))}
          <button className="chip" onClick={() => navigate('#/stats')}>{tr(lang, 'statsTitle')}</button>
        </div>
      </section>

      <section className="lib-sec">
        <div className="lib-sec-head"><h2 className="lib-sec-title">{tr(lang, 'downloads')}</h2>{state.downloads.some((d) => d.missing) && <span className="sub">{tr(lang, 'dlMissing')}</span>}</div>
        <TrackList tracks={state.downloads} lang={lang} likedIds={likedIds} currentId={state.current?.id ?? null} memoryKey="library.downloads" batchSize={20}
          removable menu={!!onMenu} onMenu={onMenu} onRemove={(t) => void engine.removeDownload(t.id)} emptyKey="noDownloads" />
      </section>

      <div className="setting-row"><b>{tr(lang, 'version')}</b><span style={{ opacity: 0.65, fontSize: 13 }}>{__APP_VERSION__} · React</span></div>
      {languageRow}
      <div className="setting-row">
        <b>{tr(lang, 'crossfade')}</b>
        <div className="seg-lang">
          {[0, 3, 6, 10].map((s) => (
            <button key={s} className={state.crossfade === s ? 'on' : ''} onClick={() => engine.setCrossfade(s)}>{s === 0 ? tr(lang, 'crossfadeOff') : s + 's'}</button>
          ))}
        </div>
      </div>
      {state.hls && <p className="sub" style={{ fontSize: 12 }}>{tr(lang, 'crossfadeIos')}</p>}
      <div className="setting-row"><b>{tr(lang, 'resetApp')}</b><button className="section-link" onClick={() => void resetApp()}>{tr(lang, 'resetApp')}</button></div>

      {confirmDel && (
        <ConfirmDialog title={tr(lang, 'delete') + ' « ' + confirmDel.name + ' » ?'} confirmLabel={tr(lang, 'delete')} cancelLabel={tr(lang, 'cancel')}
          onConfirm={() => { onDeletePlaylist(confirmDel.id); setConfirmDel(null) }} onCancel={() => setConfirmDel(null)} />
      )}
      {importOpen && <ImportSheetLazy lang={lang} onClose={() => setImportOpen(false)} onImported={() => { setImportOpen(false); void engine.loadPlaylists() }} />}
    </>
  )
}

function ImportSheetLazy(props: { lang: Lang; onClose(): void; onImported(): void }) {
  const [Mod, setMod] = useState<null | React.ComponentType<typeof props>>(null)
  useEffect(() => { void import('../components/ImportSheet').then((m) => setMod(() => m.ImportSheet)) }, [])
  if (!Mod) return null
  return <Mod {...props} />
}

function authMessage(err: unknown, lang: Lang): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return tr(lang, 'loginError')
    if (err.status === 409) return tr(lang, 'registerTaken')
    if (err.status === 403) return tr(lang, 'inviteCodeInvalid')
    if (err.status === 400) {
      if (/nom invalide/.test(err.message)) return tr(lang, 'registerUsername')
      if (/trop court/.test(err.message)) return tr(lang, 'registerPassword')
    }
  }
  return err instanceof Error ? err.message : tr(lang, 'error')
}