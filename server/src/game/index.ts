import { createRequire } from 'module'
import { GameManager } from './GameManager.js'
import type { RoomSettings } from 'shared'

export { GameManager, generateHints } from './GameManager.js'

// Use createRequire to load JSON in ESM context
const _require = createRequire(import.meta.url)
const wordList: string[] = _require('../data/words/english.json')

// One GameManager per active room, keyed by room code
export const gameManagers = new Map<string, GameManager>()

export function createGameManager(roomCode: string, settings?: Pick<RoomSettings, 'customWords' | 'customWordsChance'>): GameManager {
  const manager = new GameManager(
    wordList,
    settings?.customWords ?? [],
    settings?.customWordsChance ?? 0,
  )
  gameManagers.set(roomCode, manager)
  return manager
}

export function getGameManager(roomCode: string): GameManager | undefined {
  return gameManagers.get(roomCode)
}

export function deleteGameManager(roomCode: string): void {
  const manager = gameManagers.get(roomCode)
  if (manager) {
    manager.cleanup()
    gameManagers.delete(roomCode)
  }
}
