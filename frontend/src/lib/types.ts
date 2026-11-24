export interface Track {
  id: string
  title: string
  artist?: string
  thumb?: string
  duration?: number
  seed?: string
}

export interface Account { user: string; token: string }
export interface AuthResponse { token: string; user: { id: number; username: string; display?: string } }

export interface PlaylistSummary { id: number; name: string; count: number; cover: string[] }
export interface PlaylistDetail { id: number; name: string; tracks: Track[] }

export interface MixSummary { key: string; name: string; count: number; cover: string[]; tracks?: Track[] }

export interface HistoryItem extends Track { at?: string }

export interface PipedItem {
  url?: string
  type?: string
  title?: string
  name?: string
  uploaderName?: string
  thumbnail?: string
  duration?: number
}

export interface SearchResponse {
  items: PipedItem[]
  nextpage?: string
  suggestion?: string
  corrected?: boolean
}

export interface DownloadRecord {
  id: string
  title: string
  artist?: string
  thumb?: string
  duration?: number
  blob: Blob
  addedAt: number
}

export type Lang = 'fr' | 'en' | 'es'
