import type { Router } from 'express'
import type { PublicRoomInfo } from 'shared'
import { roomManager } from '../rooms/index.js'

export function registerRoomRoutes(router: Router) {
  router.get('/api/rooms/public', (_req, res) => {
    const rooms: PublicRoomInfo[] = roomManager.getPublicRooms().map(room => {
      const host = room.ownerId ? room.getPlayer(room.ownerId) : null
      return {
        code: room.code,
        hostName: host?.name ?? 'Unknown',
        playerCount: room.getConnectedPlayers().length,
        maxPlayers: room.settings.maxPlayers,
        state: room.state,
        round: room.round,
        rounds: room.settings.rounds,
      }
    })
    res.json({ rooms })
  })
}
