// Same-origin artwork proxy (hub /api/img): HD, private, cacheable.
import { videoIdOf } from './api'

export type ArtSize = 'mq' | 'hq' | 'maxres'

export function artOf(id: string | null | undefined, size: ArtSize = 'maxres'): string {
  if (!id) return ''
  const f = size === 'maxres' ? 'maxresdefault' : size === 'hq' ? 'hqdefault' : 'mqdefault'
  return '/api/img/vi/' + id + '/' + f + '.jpg'
}

// Streams SearchView (design C17/S7) : vignette same-origin via videoIdOf.
export function thumbOf(item: { url?: string }): string {
  const id = videoIdOf(item.url || '')
  return id ? artOf(id, 'mq') : ''
}
