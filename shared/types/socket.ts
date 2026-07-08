import type { Player, GameState, WordHint, RoomSettings, TurnEndReason } from './game.js'
import type { DrawEvent, LineEvent, FillEvent } from './canvas.js'

export interface ReadyEvent {
  roomCode: string
  playerId: string
  playerName: string
  ownerId: string
  players: Player[]
  gameState: GameState
  settings: RoomSettings
  round: number
  rounds: number
  timeLeft: number
  drawingTimeSetting: number
  wordHints: WordHint[] | null
  currentDrawing: DrawEvent[]
  allowDrawing: boolean
  currentWord: string | null
  wordChoices: string[] | null
  preSelectedWord: number
  currentDrawerId: string | null
}

// Points earned by a player during a single turn (for the end-of-turn reveal)
export interface TurnScore {
  playerId: string
  playerName: string
  points: number
}

export interface NextTurnEvent {
  round: number
  players: Player[]
  choiceTimeLeft: number
  previousWord: string | null
  drawerId: string
  turnEndReason: TurnEndReason | null
  turnScores: TurnScore[]
}

export interface YourTurnEvent {
  words: string[]
  preSelectedWord: number
  timeLeft: number
}

export interface WordChosenEvent {
  timeLeft: number
  hints: WordHint[]
}

export interface MessageEvent {
  playerId: string
  playerName: string
  content: string
  type: 'message' | 'system' | 'correct' | 'close'
}

export interface CorrectGuessEvent {
  playerId: string
  playerName: string
}

export interface GameOverEvent {
  players: Player[]
  winner: Player
}

export interface OwnerChangeEvent {
  playerId: string
  playerName: string
}

export interface KickVoteEvent {
  targetId: string
  votesNeeded: number
  currentVotes: number
}

export interface ClientToServerEvents {
  'join-room': (data: { roomCode: string; playerName: string }) => void
  'create-room': (data: { playerName: string; settings?: Partial<RoomSettings>; preferredCode?: string }) => void
  'toggle-ready': () => void
  'start-game': () => void
  'choose-word': (data: { wordIndex: number }) => void
  'message': (data: { content: string }) => void
  'line': (data: LineEvent) => void
  'lines': (data: LineEvent[]) => void
  'fill': (data: FillEvent) => void
  'clear-canvas': () => void
  'undo': () => void
  'name-change': (data: { name: string }) => void
  'kick-vote': (data: { playerId: string }) => void
  'update-settings': (data: { settings: Partial<RoomSettings> }) => void
  'toggle-spectate': () => void
  'play-again': () => void
  'leave-room': () => void
  'reaction': (data: { emoji: string }) => void
  'generate-ai-words': (data: { theme: string }) => void
}

export interface ServerToClientEvents {
  'ready': (data: ReadyEvent) => void
  'update-players': (players: Player[]) => void
  'next-turn': (data: NextTurnEvent) => void
  'your-turn': (data: YourTurnEvent) => void
  'word-chosen': (data: WordChosenEvent) => void
  'update-wordhint': (hints: WordHint[]) => void
  'message': (data: MessageEvent) => void
  'correct-guess': (data: CorrectGuessEvent) => void
  'close-guess': (data: { content: string }) => void
  'line': (data: LineEvent) => void
  'lines': (data: LineEvent[]) => void
  'fill': (data: FillEvent) => void
  'clear-canvas': () => void
  'drawing': (events: DrawEvent[]) => void
  'game-over': (data: GameOverEvent) => void
  'owner-change': (data: OwnerChangeEvent) => void
  'kick-vote': (data: KickVoteEvent) => void
  'drawer-kicked': () => void
  'player-join': (player: Player) => void
  'player-leave': (data: { playerId: string }) => void
  'settings-updated': (data: { settings: RoomSettings }) => void
  'game-reset': () => void
  'reaction': (data: { playerId: string; playerName: string; emoji: string }) => void
  'ai-words-result': (data: { theme: string; words: string[]; error?: string }) => void
  'error': (data: { message: string; code?: string }) => void
}
