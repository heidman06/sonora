// Equality-cached selector: value identity stable across notifications (design N1 rev4).
export interface SelectorCache<S, T> { read(source: S, select: (s: S) => T, eq: (a: T, b: T) => boolean): T }

export function createSelectorCache<S, T>(): SelectorCache<S, T> {
  let entree: { source: S; select: (s: S) => T; value: T } | null = null
  return {
    read(source, select, eq) {
      if (entree && entree.source === source && entree.select === select) return entree.value
      const next = select(source)
      const value = entree && eq(entree.value, next) ? entree.value : next
      entree = { source, select, value }
      return value
    },
  }
}

export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const ka = Object.keys(a as Record<string, unknown>)
  const kb = Object.keys(b as Record<string, unknown>)
  if (ka.length !== kb.length) return false
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false
  }
  return true
}
