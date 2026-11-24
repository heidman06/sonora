import type { DownloadRecord } from './types'
import type { LyricsRecord } from './lyrics'

const DB_NAME = 'sonora'
const DB_VERSION = 2
const STORE = 'downloads'
const LYRICS_STORE = 'lyrics'
const LYRICS_MAX = 500
let dbPromise: Promise<IDBDatabase> | null = null

function attempt(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    let blockedTimer: ReturnType<typeof setTimeout> | null = null
    const clearBlocked = (): void => {
      if (blockedTimer !== null) { clearTimeout(blockedTimer); blockedTimer = null }
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(LYRICS_STORE)) db.createObjectStore(LYRICS_STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => {
      clearBlocked()
      const db = req.result
      // Un autre onglet demande une version plus récente → fermer, rouvrir au prochain appel.
      db.onversionchange = () => { db.close(); dbPromise = null }
      resolve(db)
    }
    req.onerror = () => { clearBlocked(); dbPromise = null; reject(req.error) }
    // Upgrade bloqué par un onglet ouvert : échec après 3 s, réessai possible.
    req.onblocked = () => {
      clearBlocked()
      blockedTimer = setTimeout(() => { reject(new Error('sonora: IndexedDB upgrade blocked')) }, 3000)
    }
  })
}

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  // Un echec transitoire (upgrade bloque par un onglet, pression memoire iOS) ne
  // doit pas vider la bibliotheque : une seconde tentative est faite avant d'abandonner.
  dbPromise = attempt().catch(() => new Promise<void>((r) => setTimeout(r, 600)).then(() => attempt()))
  dbPromise.catch(() => { dbPromise = null })
  return dbPromise
}

export interface ManifestRow { id: string; title: string; artist?: string; thumb?: string; duration?: number; addedAt: number }
const MANIFEST_KEY = 'sonora.dlManifest'
export function lireManifest(): ManifestRow[] {
  try { return JSON.parse(localStorage.getItem(MANIFEST_KEY) || '[]') as ManifestRow[] } catch { return [] }
}
function ecrireManifest(rows: ManifestRow[]): void {
  try { localStorage.setItem(MANIFEST_KEY, JSON.stringify(rows)) } catch { /* quota */ }
}
export function manifestSync(rows: DownloadRecord[]): void {
  ecrireManifest(rows.map((r) => ({ id: r.id, title: r.title, artist: r.artist, thumb: r.thumb, duration: r.duration, addedAt: r.addedAt })))
}
function manifestUpsert(rec: DownloadRecord): void {
  const rows = lireManifest().filter((r) => r.id !== rec.id)
  rows.push({ id: rec.id, title: rec.title, artist: rec.artist, thumb: rec.thumb, duration: rec.duration, addedAt: rec.addedAt })
  ecrireManifest(rows)
}
function manifestRemove(id: string): void {
  ecrireManifest(lireManifest().filter((r) => r.id !== id))
}

export async function downloadGet(id: string): Promise<DownloadRecord | null> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as DownloadRecord | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function downloadAll(): Promise<DownloadRecord[]> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result as DownloadRecord[]) || [])
    req.onerror = () => reject(req.error)
  })
}

export async function downloadPut(rec: DownloadRecord): Promise<void> {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(rec)
    tx.oncomplete = () => { manifestUpsert(rec); resolve() }
    tx.onerror = () => reject(tx.error)
  })
}

export async function downloadDel(id: string): Promise<void> {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => { manifestRemove(id); resolve() }
    tx.onerror = () => reject(tx.error)
  })
}

export async function lyricsGet(id: string): Promise<LyricsRecord | null> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = db.transaction(LYRICS_STORE, 'readonly').objectStore(LYRICS_STORE).get(id)
    req.onsuccess = () => resolve((req.result as LyricsRecord | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

/** Plafond 500 entrées : éviction des fetchedAt les plus anciens à l'insertion. */
export async function lyricsPut(rec: LyricsRecord): Promise<void> {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LYRICS_STORE, 'readwrite')
    const store = tx.objectStore(LYRICS_STORE)
    store.put(rec)
    const countReq = store.count()
    countReq.onsuccess = () => {
      const excess = countReq.result - LYRICS_MAX
      if (excess <= 0) return
      const allReq = store.getAll()
      allReq.onsuccess = () => {
        const rows = (allReq.result as LyricsRecord[]) || []
        rows.sort((a, b) => a.fetchedAt - b.fetchedAt)
        const victims = rows.filter((r) => r.id !== rec.id).slice(0, excess)
        for (const v of victims) store.delete(v.id)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
