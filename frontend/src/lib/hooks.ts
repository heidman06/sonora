import { useEffect, useState } from 'react'
import { applyAmbient, paletteFor } from './palette'

export interface Route {
  name: 'listen' | 'search' | 'library' | 'playlist' | 'artist' | 'liked' | 'smart' | 'stats' | 'mixes'
  id: string
  tab: 'listen' | 'search' | 'library'
}

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '')
  const [name, ...rest] = clean.split('/')
  const id = rest.join('/')
  if (name === 'search') return { name: 'search', id: decodeURIComponent(id), tab: 'search' }
  if (name === 'library') return { name: 'library', id: '', tab: 'library' }
  if (name === 'playlist') return { name: 'playlist', id, tab: 'library' }
  if (name === 'artist') return { name: 'artist', id, tab: 'library' }
  if (name === 'liked') return { name: 'liked', id: '', tab: 'library' }
  if (name === 'smart') return { name: 'smart', id, tab: 'library' }
  if (name === 'stats') return { name: 'stats', id: '', tab: 'library' }
  if (name === 'mixes') return { name: 'mixes', id, tab: 'listen' }
  return { name: 'listen', id: '', tab: 'listen' }
}

export function useHashRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash || '#/listen')
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/listen')
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return parseHash(hash)
}

export function navigate(path: string): void {
  if (window.location.hash === path) return
  window.location.hash = path
}

export function useScrollMemory(key: string): void {
  useEffect(() => {
    const raw = sessionStorage.getItem('sonora.scroll.' + key)
    let top = 0
    if (raw) { try { const o = JSON.parse(raw); top = Number(o.scrollTop) || 0 } catch { top = Number(raw) || 0 } }
    if (top) window.scrollTo(0, top)
    return () => {
      let batchCount = 1
      try { batchCount = Number(JSON.parse(sessionStorage.getItem('sonora.scroll.' + key) || '{}').batchCount) || 1 } catch { /* noop */ }
      sessionStorage.setItem('sonora.scroll.' + key, JSON.stringify({ scrollTop: window.scrollY, batchCount }))
    }
  }, [key])
}

// Ambient dynamique (S4) : effet seul, 0 render ajouté. null → reset INITIAL.
export function useDynamicAmbient(id: string | null | undefined): void {
  useEffect(() => {
    if (!id) { applyAmbient(null); return }
    let alive = true
    void paletteFor(id).then((p) => { if (alive) applyAmbient(p) })
    return () => { alive = false }
  }, [id])
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}
