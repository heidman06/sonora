import { useEffect, useState } from 'react'

export interface Route {
  name: 'listen' | 'search' | 'library' | 'playlist' | 'artist'
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

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}
