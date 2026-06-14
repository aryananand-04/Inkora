import { Room } from './Room.js'
import { CONSTANTS } from 'shared'
import type { RoomSettings } from 'shared'

class RoomManager {
  private rooms: Map<string, Room> = new Map()

  private generateRoomCode(): string {
    let code: string
    do {
      // 4-digit numeric code: 1000–9999
      code = String(Math.floor(Math.random() * 9000) + 1000)
    } while (this.rooms.has(code))
    return code
  }

  createRoom(settings?: Partial<RoomSettings>, preferredCode?: string): Room {
    let code: string
    if (preferredCode && /^[0-9]{4}$/.test(preferredCode) && !this.rooms.has(preferredCode)) {
      code = preferredCode
    } else {
      code = this.generateRoomCode()
    }
    const room = new Room(code, settings)
    this.rooms.set(code, room)
    return room
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
