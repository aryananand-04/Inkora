import type { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents, WordHint, ScoringMode, TurnEndReason, TurnScore } from 'shared'
import { CONSTANTS } from 'shared'
import type { Room } from '../rooms/Room.js'
import type { Player } from '../rooms/Player.js'
import { checkGuess, GUESS_RESULT } from './guessChecker.js'

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>

const WORD_CHOICE_TIME = CONSTANTS.WORD_CHOICE_TIMEOUT // 30 seconds
const ADVANCE_DELAY = 3000                              // pause before next turn (ms)

export class GameManager {
  private defaultDeck: string[]
  private defaultIndex = 0
  private customDeck: string[]
  private customIndex = 0
  private customWordsChance: number
  private currentWords: string[] = []
  private preSelectedWord: number = 0
  private wordChosen: boolean = false
  private wordChoiceTimer: NodeJS.Timeout | null = null
  private drawingTimer: NodeJS.Timeout | null = null
  private advanceTimer: NodeJS.Timeout | null = null
  private hintTimers: NodeJS.Timeout[] = []
  private hints: WordHint[] = []
  private hintsRevealedCount: number = 0
  private totalHintCount: number = 0
  private correctGuessers = new Set<string>()
  private lastTurnScores: TurnScore[] = []
  previousWord: string | null = null

  constructor(defaultWords: string[], customWords: string[] = [], customWordsChance = 0) {
    this.defaultDeck = shuffle([...defaultWords])
    this.customDeck = shuffle([...customWords])
    this.customWordsChance = Math.max(0, Math.min(100, customWordsChance))
  }

  updateCustomWords(words: string[], chance: number): void {
    this.customDeck = shuffle([...words])
    this.customIndex = 0
    this.customWordsChance = Math.max(0, Math.min(100, chance))
  }

  // Swap the default deck (e.g. when the owner changes word categories mid-game)
  updateDefaultWords(words: string[]): void {
    if (words.length === 0) return
    this.defaultDeck = shuffle([...words])
    this.defaultIndex = 0
  }

  getHints(): WordHint[] | null {
    return this.hints.length > 0 ? this.hints : null
  }

  getWordChoices(): { words: string[]; preSelectedWord: number } | null {
    if (this.wordChosen || this.currentWords.length === 0) return null
    return { words: this.currentWords, preSelectedWord: this.preSelectedWord }
  }

  // --- Word deck ---

  private pickFromDefault(): string {
    if (this.defaultIndex >= this.defaultDeck.length) {
      this.defaultDeck = shuffle(this.defaultDeck)
      this.defaultIndex = 0
    }
    return this.defaultDeck[this.defaultIndex++]
  }

  private pickFromCustom(): string {
    if (this.customIndex >= this.customDeck.length) {
      this.customDeck = shuffle(this.customDeck)
      this.customIndex = 0
    }
    return this.customDeck[this.customIndex++]
  }

  private pickWords(count: number): string[] {
    const result: string[] = []
    for (let i = 0; i < count; i++) {
      const useCustom = this.customDeck.length > 0 && Math.random() * 100 < this.customWordsChance
      result.push(useCustom ? this.pickFromCustom() : this.pickFromDefault())
    }
    return result
  }

  // --- Turn flow ---

  startTurn(io: TypedServer, room: Room, prevTurnEndReason: TurnEndReason | null = null): void {
    this.clearTimers()
    this.wordChosen = false
    this.hints = []
    this.hintsRevealedCount = 0
    this.totalHintCount = 0
    this.correctGuessers = new Set()
    room.clearDrawing()
    room.turnEndTime = 0
    io.to(room.code).emit('clear-canvas')

    const drawerId = room.turnOrder[room.turnIndex]
    room.currentDrawerId = drawerId

    for (const player of room.getPlayersArray()) {
      player.lastScore = 0
      if (player.state === 'spectating') continue
      player.state = player.id === drawerId ? 'standby' : 'guessing'
    }

    this.currentWords = this.pickWords(room.settings.wordsPerTurn)
    this.preSelectedWord = Math.floor(Math.random() * room.settings.wordsPerTurn)

    io.to(room.code).emit('next-turn', {
      round: room.round,
      players: room.getPlayersArray().map(p => p.toJSON()),
      choiceTimeLeft: WORD_CHOICE_TIME,
      previousWord: this.previousWord,
      drawerId,
      turnEndReason: prevTurnEndReason,
      turnScores: this.lastTurnScores,
    })

    io.to(drawerId).emit('your-turn', {
      words: this.currentWords,
      preSelectedWord: this.preSelectedWord,
      timeLeft: WORD_CHOICE_TIME,
    })

    this.wordChoiceTimer = setTimeout(() => {
      this.chooseWord(io, room, this.preSelectedWord)
    }, WORD_CHOICE_TIME * 1000)
  }

  chooseWord(io: TypedServer, room: Room, wordIndex: number): void {
    if (this.wordChosen || !this.currentWords.length) return
    this.wordChosen = true
    this.clearWordChoiceTimer()

    const word = this.currentWords[wordIndex] ?? this.currentWords[0]
    room.currentWord = word
    this.currentWords = []
    this.previousWord = word

    for (const player of room.getPlayersArray()) {
      if (player.state === 'spectating') continue
      player.state = player.id === room.currentDrawerId ? 'drawing' : 'guessing'
    }

    this.hints = generateHints(word)
    const drawingMs = room.settings.drawingTime * 1000
    room.turnEndTime = Date.now() + drawingMs

    io.to(room.code).emit('word-chosen', {
      timeLeft: room.settings.drawingTime,
      hints: [...this.hints],
    })
    io.to(room.code).emit('update-players', room.getPlayersArray().map(p => p.toJSON()))

    this.scheduleHints(io, room, word, drawingMs)

    this.drawingTimer = setTimeout(() => {
      this.awardDrawerAndAdvance(io, room, 'time')
    }, drawingMs)
  }

  // --- Guess handling ---

  handleGuess(io: TypedServer, room: Room, player: Player, guess: string): void {
    const result = checkGuess(guess, room.currentWord)

    if (result === GUESS_RESULT.EQUAL) {
      const points = calcGuesserPoints(
        room.timeLeft, room.settings.drawingTime, room.settings.scoringMode,
        this.hintsRevealedCount, this.totalHintCount,
      )
      player.score += points
      player.lastScore = points
      player.state = 'standby' // can no longer guess this turn
      this.correctGuessers.add(player.id)

      io.to(room.code).emit('correct-guess', { playerId: player.id, playerName: player.name })
      io.to(room.code).emit('update-players', room.getPlayersArray().map(p => p.toJSON()))

      // If all connected non-spectator guessers have now guessed, end the turn early
      const guessers = room.getPlayersArray().filter(
        p => p.id !== room.currentDrawerId && p.connected && p.state !== 'spectating',
      )
      if (guessers.length > 0 && guessers.every(p => p.state !== 'guessing')) {
        this.awardDrawerAndAdvance(io, room, 'all_guessed')
      }
    } else if (result === GUESS_RESULT.CLOSE) {
      // Private "close!" nudge to this player only
      io.to(player.id).emit('close-guess', { content: guess })
      // Still show the guess text in chat so everyone sees it (drawer included)
      io.to(room.code).emit('message', {
        playerId: player.id,
        playerName: player.name,
        content: guess,
        type: 'message',
      })
    } else {
      // Wrong — normal chat message visible to all
      io.to(room.code).emit('message', {
        playerId: player.id,
        playerName: player.name,
        content: guess,
        type: 'message',
      })
    }
  }

  // Kick the drawer mid-turn — revert this turn's guesser points, no drawer
  // award, then advance after a brief pause (PRD §5.3)
  kickDrawer(io: TypedServer, room: Room): void {
    this.clearTimers()   // clears drawingTimer, hintTimers, AND any existing advanceTimer

    let reverted = false
    for (const playerId of this.correctGuessers) {
      const player = room.getPlayer(playerId)
      if (player && player.lastScore > 0) {
        player.score -= player.lastScore
        player.lastScore = 0
        reverted = true
      }
    }
    this.lastTurnScores = []
    if (reverted) {
      io.to(room.code).emit('update-players', room.getPlayersArray().map(p => p.toJSON()))
      io.to(room.code).emit('message', {
        playerId: '',
        playerName: '',
        content: 'Drawer was kicked — points from this turn were reverted',
        type: 'system',
      })
    }

    this.advanceTimer = setTimeout(() => {
      this.advanceTimer = null
      const continued = this.advanceTurn(io, room, 'drawer_kicked')
      if (!continued) {
        const players = room.getPlayersArray().map(p => p.toJSON())
        const winner = [...players].sort((a, b) => b.score - a.score)[0]
        io.to(room.code).emit('game-over', { players, winner: winner! })
      }
    }, ADVANCE_DELAY)
  }

  // Award the drawer then move to the next turn after a short pause
  private awardDrawerAndAdvance(io: TypedServer, room: Room, reason: TurnEndReason): void {
    if (this.advanceTimer) return   // already scheduled, don't double-advance
    this.clearDrawingTimers()

    // Award drawer based on fraction of guessers who got it
    const drawer = room.currentDrawerId ? room.getPlayer(room.currentDrawerId) : null
    if (drawer) {
      const guessers = room.getPlayersArray().filter(
        p => p.id !== room.currentDrawerId && p.connected && p.state !== 'spectating',
      )
      if (guessers.length > 0) {
        const drawerPoints = calcDrawerPoints(this.correctGuessers.size, guessers.length, room.settings.scoringMode)
        drawer.score += drawerPoints
        drawer.lastScore = drawerPoints
      }
      io.to(room.code).emit('update-players', room.getPlayersArray().map(p => p.toJSON()))
    }

    // Snapshot this turn's earnings before startTurn resets lastScore,
    // so the next next-turn event can show the score summary.
    this.lastTurnScores = room.getPlayersArray()
      .filter(p => p.lastScore > 0)
      .sort((a, b) => b.lastScore - a.lastScore)
      .map(p => ({ playerId: p.id, playerName: p.name, points: p.lastScore }))

    // Short pause so players can see the final state before the next turn
    this.advanceTimer = setTimeout(() => {
      this.advanceTimer = null
      const continued = this.advanceTurn(io, room, reason)
      if (!continued) {
        const players = room.getPlayersArray().map(p => p.toJSON())
        const winner = [...players].sort((a, b) => b.score - a.score)[0]
        io.to(room.code).emit('game-over', { players, winner: winner! })
      }
    }, ADVANCE_DELAY)
  }

  // Advance to the next drawer; returns false when all rounds are done
  advanceTurn(io: TypedServer, room: Room, reason: TurnEndReason | null = null): boolean {
    this.clearTimers()
    this.hints = []
    this.correctGuessers = new Set()
    room.currentWord = ''
    room.currentDrawerId = null
    room.turnEndTime = 0

    for (const player of room.getPlayersArray()) {
      if (player.state !== 'spectating') {
        player.state = 'standby'
      }
    }

    room.turnIndex++

    if (room.turnOrder.length === 0) {
      room.state = 'gameOver'
      return false
    }

    if (room.turnIndex >= room.turnOrder.length) {
      room.turnIndex = 0
      room.round++

      if (room.round > room.settings.rounds) {
        room.state = 'gameOver'
        return false
      }
    }

    this.startTurn(io, room, reason)
    return true
  }

  // --- Hint scheduling ---

  private scheduleHints(io: TypedServer, room: Room, word: string, drawingMs: number): void {
    const eligible: number[] = []
    for (let i = 0; i < word.length; i++) {
      if (word[i] !== ' ' && word[i] !== '-') eligible.push(i)
    }

    const hintCount = Math.min(
      Math.floor(word.length / 3),
      Math.max(0, eligible.length - 1),
    )
    if (hintCount <= 0) return

    this.totalHintCount = hintCount

    const toReveal = shuffle([...eligible]).slice(0, hintCount)

    for (let i = 0; i < toReveal.length; i++) {
      const charIndex = toReveal[i]
      const delay = Math.round((drawingMs * (i + 1)) / (hintCount + 1))

      const timer = setTimeout(() => {
        const hint = this.hints[charIndex]
        if (hint && !hint.revealed) {
          hint.character = word[charIndex]
          hint.revealed = true
          this.hintsRevealedCount++
          io.to(room.code).emit('update-wordhint', [...this.hints])
        }
      }, delay)

      this.hintTimers.push(timer)
    }
  }

  // --- Cleanup ---

  private clearWordChoiceTimer(): void {
    if (this.wordChoiceTimer) {
      clearTimeout(this.wordChoiceTimer)
      this.wordChoiceTimer = null
    }
  }

  private clearDrawingTimers(): void {
    if (this.drawingTimer) {
      clearTimeout(this.drawingTimer)
      this.drawingTimer = null
    }
    for (const t of this.hintTimers) clearTimeout(t)
    this.hintTimers = []
  }

  clearTimers(): void {
    this.clearWordChoiceTimer()
    this.clearDrawingTimers()
    if (this.advanceTimer) {
      clearTimeout(this.advanceTimer)
      this.advanceTimer = null
    }
  }

  cleanup(): void {
    this.clearTimers()
  }
}

// --- Helpers ---

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// --- Scoring helpers ---

// Normal:      100 base + up to 80 time + up to 20 hint  → 100–200 pts
// Competitive: 50 base  + up to 350 quadratic + up to 100 hint → 50–500 pts
// Hint bonus rewards guessing before hints are revealed.
export function calcGuesserPoints(
  timeLeft: number, drawingTime: number, mode: ScoringMode,
  hintsRevealed: number, totalHints: number,
): number {
  const timeRatio = drawingTime > 0 ? timeLeft / drawingTime : 0
  const hintRatio = totalHints > 0 ? 1 - hintsRevealed / totalHints : 1

  if (mode === 'competitive') {
    return 50 + Math.floor(timeRatio * timeRatio * 350) + Math.floor(hintRatio * 100)
  }
  return 100 + Math.floor(timeRatio * 80) + Math.floor(hintRatio * 20)
}

// Normal:      up to 50 pts   Competitive: up to 100 pts
export function calcDrawerPoints(correct: number, total: number, mode: ScoringMode): number {
  const maxDrawer = mode === 'competitive' ? 100 : 50
  return total > 0 ? Math.floor((correct / total) * maxDrawer) : 0
}

export function generateHints(word: string): WordHint[] {
  return word.split('').map(char => ({
    character: char === ' ' ? ' ' : null,
    underline: char !== ' ',
    revealed: char === ' ',
  }))
}
