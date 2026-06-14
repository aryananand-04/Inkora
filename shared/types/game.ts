export type GameState = 'unstarted' | 'ongoing' | 'gameOver'

export type PlayerState = 'standby' | 'ready' | 'drawing' | 'guessing' | 'spectating'

export type ScoringMode = 'normal' | 'competitive'

export type TurnEndReason = 'time' | 'all_guessed' | 'drawer_kicked'

export interface Player {
  id: string
  name: string
  state: PlayerState
  score: number
  lastScore: number
  rank: number
  connected: boolean
}

export interface RoomSettings {
  maxPlayers: number
  rounds: number
  drawingTime: number
  wordsPerTurn: number
  isPublic: boolean
  scoringMode: ScoringMode
  customWords: string[]
  customWordsChance: number  // 0–100 — percentage of word picks that come from the custom pool
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 8,
  rounds: 3,
  drawingTime: 80,
  wordsPerTurn: 3,
  isPublic: false,
  scoringMode: 'normal',
  customWords: [],
  customWordsChance: 50,
}

export interface WordHint {
  character: string | null
  underline: boolean
  revealed: boolean
}

export const GUESS_RESULT = {
  EQUAL: 0,
  CLOSE: 1,
  DISTANT: 2,
} as const

export type GuessResult = (typeof GUESS_RESULT)[keyof typeof GUESS_RESULT]

export const CONSTANTS = {
  CANVAS_BASE_WIDTH: 1600,
  CANVAS_BASE_HEIGHT: 900,
  MAX_PLAYERS: 10,
  MIN_PLAYERS: 2,
  DEFAULT_ROUNDS: 3,
  DEFAULT_DRAWING_TIME: 80,
  WORD_CHOICE_TIMEOUT: 30,
  DRAWER_DISCONNECT_GRACE: 8,
  MAX_MESSAGE_LENGTH: 200,
  RATE_LIMIT_MESSAGES: 5,
  RATE_LIMIT_WINDOW: 3000,
  ROOM_CODE_LENGTH: 4,
  SLOT_RESERVATION_TIME: 60000,
} as const
