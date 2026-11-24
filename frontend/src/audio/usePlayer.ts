import { useCallback, useRef, useSyncExternalStore } from 'react'
import { engine, type PlayerState } from './engine'
import { createSelectorCache } from '../lib/selector'

export function usePlayer() {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
}

// Stable getSnapshot forever; select/eq held in refs (design N1 rev4, no re-create).
export function usePlayerSelector<T>(select: (s: PlayerState) => T, eq: (a: T, b: T) => boolean = Object.is): T {
  const cache = useRef(createSelectorCache<PlayerState, T>())
  const selectRef = useRef(select)
  selectRef.current = select
  const eqRef = useRef(eq)
  eqRef.current = eq
  const get = useCallback(() => cache.current.read(engine.getSnapshot(), selectRef.current, eqRef.current), [])
  return useSyncExternalStore(engine.subscribe, get, get)
}

export type UiState = Omit<PlayerState, 'currentTime' | 'duration' | 'volume'>

export function selectUiState(s: PlayerState): UiState {
  const { currentTime, duration, volume, ...rest } = s
  void currentTime; void duration; void volume
  return rest
}