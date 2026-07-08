import { createRequire } from 'module'
import { GameManager } from './GameManager.js'
import type { RoomSettings } from 'shared'
import { WORD_CATEGORIES } from 'shared'

export { GameManager, generateHints } from './GameManager.js'

// Use createRequire to load JSON in ESM context
const _require = createRequire(import.meta.url)
const classicWords: string[] = _require('../data/words/english.json')
const categoryWords: Record<string, string[]> = _require('../data/words/categories.json')

const VALID_CATEGORY_IDS = new Set<string>(WORD_CATEGORIES.map(c => c.id))

// Merge the selected category packs into one deck (GameManager shuffles it).
// Unknown ids are dropped; an empty/invalid selection falls back to classic.
export function buildWordPool(categories: string[] | undefined): string[] {
  const selected = (categories ?? []).filter(c => VALID_CATEGORY_IDS.has(c))
  const ids = selected.length > 0 ? selected : ['classic']

  const pool: string[] = []
  for (const id of ids) {
    if (id === 'classic') pool.push(...classicWords)
    else pool.push(...(categoryWords[id] ?? []))
  }
  return pool.length > 0 ? pool : [...classicWords]
}

// One GameManager per active room, keyed by room code
export const gameManagers = new Map<string, GameManager>()

export function createGameManager(
  roomCode: string,
  settings?: Pick<RoomSettings, 'customWords' | 'customWordsChance' | 'wordCategories'>,
): GameManager {
  const manager = new GameManager(
    buildWordPool(settings?.wordCategories),
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
