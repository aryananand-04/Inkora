import { useSyncExternalStore } from 'react'
import { getSoundPrefs, subscribeSoundPrefs } from '../services/sounds'

// Reactive view of the persisted sound preferences. The snapshot is the same
// object reference between changes, so this is safe with useSyncExternalStore.
export function useSoundPrefs() {
  return useSyncExternalStore(subscribeSoundPrefs, getSoundPrefs, getSoundPrefs)
}
