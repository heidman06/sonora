import type { PlaylistDetail } from './types'

const clean = (s: string) => String(s || '').replace(/[\r\n]+/g, ' ').trim()

// M3U ext: UTF-8 no BOM, LF; first comma separates duration, title commas kept.
export function toM3U(p: PlaylistDetail): string {
  const lines = ['#EXTM3U']
  for (const t of p.tracks) {
    lines.push('#EXTINF:' + Math.round(t.duration || 0) + ',' + clean(t.artist || '') + ' - ' + clean(t.title || ''))
    lines.push('https://www.youtube.com/watch?v=' + t.id)
  }
  return lines.join('\n') + '\n'
}

export function toJSON(p: PlaylistDetail): string {
  return JSON.stringify(p, null, 2)
}

export function download(name: string, mime: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
