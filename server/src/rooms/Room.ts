import type { GameState, RoomSettings, DrawEvent } from 'shared'
import { DEFAULT_ROOM_SETTINGS, CONSTANTS } from 'shared'
import { Player } from './Player.js'

export class Room {
  code: string
  players: Map<string, Player> = new Map()
  ownerId: string | null = null
  settings: RoomSettings
  state: GameState = 'unstarted'
  round: number = 0
  currentDrawerId: string | null = null
  currentWord: string = ''
  turnOrder: string[] = []
  turnIndex: number = 0
  drawing: DrawEvent[] = []
  // Stack of indices into drawing[] where each connected stroke group begins
  undoStack: number[] = []
  lastDrawTime: number = 0
  turnEndTime: number = 0

  get timeLeft(): number {
    if (!this.turnEndTime) return 0
    return Math.max(0, Math.round((this.turnEndTime - Date.now()) / 1000))
  }

  constructor(code: string, settings?: Partial<RoomSettings>) {
    this.code = code
    this.settings = { ...DEFAULT_ROOM_SETTINGS, ...settings }
  }

  addPlayer(player: Player): { success: boolean; error?: string } {
    if (this.players.size >= this.settings.maxPlayers) {
      return { success: false, error: 'ROOM_FULL' }
    }

    if (this.state === 'gameOver') {
      return { success: false, error: 'GAME_OVER' }
    }

    this.players.set(player.id, player)

    if (!this.ownerId) {
      this.ownerId = player.id
    }

    return { success: true }
  }

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId)
    if (!player) return

    this.players.delete(playerId)

    if (this.ownerId === playerId && this.players.size > 0) {
      const connectedPlayers = Array.from(this.players.values()).filter(p => p.connected)
      if (connectedPlayers.length > 0) {
        this.ownerId = connectedPlayers[0].id
      } else {
        this.ownerId = this.players.values().next().value?.id || null
      }
    }

    // Keep turnOrder in sync so advanceTurn lands on the right player
    const turnIdx = this.turnOrder.indexOf(playerId)
    if (turnIdx !== -1) {
      this.turnOrder.splice(turnIdx, 1)
      // Shift index left when removed entry was at or before current position
      if (turnIdx <= this.turnIndex) {
        this.turnIndex = Math.max(-1, this.turnIndex - 1)
      }
    }
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId)
  }

  getPlayersArray(): Player[] {
    return Array.from(this.players.values())
  }

  getConnectedPlayers(): Player[] {
    return this.getPlayersArray().filter(p => p.connected)
  }

  allPlayersReady(): boolean {
    const players = this.getConnectedPlayers().filter(p => p.state !== 'spectating')
    return players.length >= CONSTANTS.MIN_PLAYERS && players.every(p => p.state === 'ready')
  }

  isEmpty(): boolean {
    return this.players.size === 0
  }

  pushDrawEvent(event: DrawEvent): void {
    const now = Date.now()
    const isFill = event.type === 'fill'
    const gap = now - this.lastDrawTime

    // New stroke group when gap > 150ms or last event was a fill
    if (gap > 150 || isFill || this.drawing.length === 0) {
      this.undoStack.push(this.drawing.length)
    }
    this.lastDrawTime = now
    this.drawing.push(event)
  }

  undo(): DrawEvent[] | null {
    if (this.undoStack.length === 0) return null
    const undoFrom = this.undoStack.pop()!
    this.drawing = this.drawing.slice(0, undoFrom)
    return this.drawing
  }

  clearDrawing(): void {
    this.drawing = []
    this.undoStack = []
    this.lastDrawTime = 0
  }

  reconnectPlayer(oldId: string, newId: string): void {
    const player = this.players.get(oldId)
    if (!player) return

    this.players.delete(oldId)
    player.id = newId
    player.connected = true
    this.players.set(newId, player)

    if (this.ownerId === oldId) {
      this.ownerId = newId
    }

    if (this.currentDrawerId === oldId) {
      this.currentDrawerId = newId
    }

    const turnIdx = this.turnOrder.indexOf(oldId)
    if (turnIdx !== -1) {
      this.turnOrder[turnIdx] = newId
    }
  }

  startGame(): void {
    if (this.state !== 'unstarted') return

    this.state = 'ongoing'
    this.round = 1

    // Build turn order before touching states (spectators have state 'spectating')
    this.turnOrder = this.getConnectedPlayers().filter(p => p.state !== 'spectating').map(p => p.id)
    this.shuffleTurnOrder()
    this.turnIndex = 0

    for (const player of this.players.values()) {
      player.score = 0
      player.lastScore = 0
      if (player.state !== 'spectating') {
        player.state = 'standby'
      }
    }
  }

  private shuffleTurnOrder(): void {
    for (let i = this.turnOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.turnOrder[i], this.turnOrder[j]] = [this.turnOrder[j], this.turnOrder[i]]
    }
  }
}
