import { Room } from './Room.js'
import { CONSTANTS } from 'shared'
import type { RoomSettings } from 'shared'

class RoomManager {
  private rooms: Map<string, Room> = new Map()

  private generateRoomCode(): string {
    const alphabet = CONSTANTS.ROOM_CODE_ALPHABET
    let code: string
    do {
      code = Array.from(
        { length: CONSTANTS.ROOM_CODE_LENGTH },
        () => alphabet[Math.floor(Math.random() * alphabet.length)],
      ).join('')
    } while (this.rooms.has(code))
    return code
  }

  isValidCode(code: unknown): code is string {
    return typeof code === 'string'
      && code.length === CONSTANTS.ROOM_CODE_LENGTH
      && [...code].every(ch => CONSTANTS.ROOM_CODE_ALPHABET.includes(ch))
  }

  createRoom(settings?: Partial<RoomSettings>, preferredCode?: string): Room {
    let code: string
    if (preferredCode && this.isValidCode(preferredCode) && !this.rooms.has(preferredCode)) {
      code = preferredCode
    } else {
      code = this.generateRoomCode()
    }
    const room = new Room(code, settings)
    this.rooms.set(code, room)
    return room
  }

  // Rooms that opted into the public list and can still be joined
  getPublicRooms(): Room[] {
    return [...this.rooms.values()].filter(room =>
      room.settings.isPublic
      && room.state !== 'gameOver'
      && room.players.size < room.settings.maxPlayers,
    )
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code)
  }

  deleteRoom(code: string): void {
    this.rooms.delete(code)
  }

  cleanupEmptyRooms(): void {
    for (const [code, room] of this.rooms) {
      if (room.isEmpty()) {
        this.rooms.delete(code)
      }
    }
  }

  getRoomCount(): number {
    return this.rooms.size
  }
}

export const roomManager = new RoomManager()
