const PREFIX = 'sonora.'

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown): void {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)) } catch { /* quota */ }
  },
  del(key: string): void {
    try { localStorage.removeItem(PREFIX + key) } catch { /* noop */ }
  },
}

export function userKey(user: string | null | undefined, key: string): string {
  return 'u.' + (user || 'guest') + '.' + key
}
