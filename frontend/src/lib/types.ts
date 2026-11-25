export interface Track {
  id: string
  title: string
  artist?: string
  thumb?: string
  duration?: number
  seed?: string
  kind?: 'episode'
  showId?: number
  showTitle?: string
  pubDate?: string | null
  src?: string
}

export interface PodDiscovery { feedUrl: string; title: string; author: string; description: string; logo: string | null }

export interface PodcastShow { id: number; feedUrl: string; itunesId?: string | null; title: string; author: string; description: string; image: string; fetchedAt: number }
export interface PodcastEpisode { id: number; showId: number; showTitle: string; showImage?: string; guid: string; title: string; description: string; pubDate: string | null; duration: number; enclosureType: string; unavailable?: boolean; src: string; progress?: { position: number; duration: number; completed: number } | null }

export interface Account { user: string; token: string }
export interface AuthResponse { token: string; user: { id: number; username: string; display?: string } }

export interface PlaylistSummary { id: number; name: string; count: number; cover: string[] }
export interface PlaylistDetail { id: number; name: string; tracks: Track[] }

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
  missing?: boolean
  kind?: 'episode'
  id: string
  title: string
  artist?: string
  thumb?: string
  duration?: number
  blob: Blob
  addedAt: number
}

export type Lang = 'fr' | 'en' | 'es'

export interface MixSeed { t: 'key' | 'artist'; v: string }
export interface MixSummary { key: string; labelKey: string; moodId?: string; n?: number; subtitleKey?: string; seeds: MixSeed[]; count: number; cover: string[]; tracks: Track[] }
export interface MixesResponse { v: number; cold: boolean; seed: string; mixes: MixSummary[] }

export interface Mood { id: string; labelKey: string; q: string; score?: number }
export interface MoodArtist { name: string; q: string }
export interface MoodsResponse { v: number; lang: Lang; cold: boolean; moods: Mood[]; artists: MoodArtist[] }
