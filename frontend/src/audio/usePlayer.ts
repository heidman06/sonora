import { useSyncExternalStore } from 'react'
import { engine } from './engine'

export function usePlayer() {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
}
