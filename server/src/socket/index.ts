import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from 'shared'
import { CONSTANTS } from 'shared'
import { roomManager, Player, Room } from '../rooms/index.js'
import { createGameManager, getGameManager, deleteGameManager } from '../game/index.js'

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>

const socketRooms = new Map<string, string>()
const disconnectTimers = new Map<string, NodeJS.Timeout>()
const drawerKickTimers = new Map<string, NodeJS.Timeout>()  // playerId → timer
const playerSessions = new Map<string, { visitorId: string; roomCode: string }>()
const messageCooldowns = new Map<string, number[]>() // socketId → recent message timestamps
const lineCooldowns = new Map<string, { count: number; windowStart: number }>()
// roomCode → targetPlayerId → Set of voterSocketIds
const kickVotes = new Map<string, Map<string, Set<string>>>()
// roomCode → visitorId → score  (ghost scores for players who left mid-game)
const ghostScores = new Map<string, Map<string, number>>()

const LINE_RATE_LIMIT = 200   // max line events per second per socket
const DRAWING_HISTORY_CAP = 3000  // max stored draw events per room

function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().slice(0, 20)
  return s.length >= 1 ? s : null
}

function isValidRoomCode(code: unknown): boolean {
  return typeof code === 'string' && /^[0-9]{4}$/.test(code)
}

function checkLineRate(socketId: string): boolean {
  const now = Date.now()
  const entry = lineCooldowns.get(socketId) ?? { count: 0, windowStart: now }
  if (now - entry.windowStart > 1000) { entry.count = 0; entry.windowStart = now }
  entry.count++
  lineCooldowns.set(socketId, entry)
  return entry.count <= LINE_RATE_LIMIT
}

function getClientIp(socket: TypedSocket): string {
  return (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || socket.handshake.address
    || 'unknown'
}

function getVisitorId(socket: TypedSocket): string {
  return `${getClientIp(socket)}-${socket.handshake.auth?.visitorId || ''}`
}

function sendReadyEvent(socket: TypedSocket, room: Room, player: Player) {
  const gm = getGameManager(room.code)
  const wordChoiceData = room.currentDrawerId === player.id ? gm?.getWordChoices() ?? null : null
  socket.emit('ready', {
    roomCode: room.code,
    playerId: player.id,
    playerName: player.name,
    ownerId: room.ownerId!,
    players: room.getPlayersArray().map(p => p.toJSON()),
    gameState: room.state,
    settings: room.settings,
    round: room.round,
    rounds: room.settings.rounds,
    timeLeft: room.timeLeft,
    drawingTimeSetting: room.settings.drawingTime,
    wordHints: gm?.getHints() ?? null,
    currentDrawing: room.drawing,
    allowDrawing: room.currentDrawerId === player.id && !wordChoiceData,
    currentWord: room.currentDrawerId === player.id ? room.currentWord : null,
    wordChoices: wordChoiceData?.words ?? null,
    preSelectedWord: wordChoiceData?.preSelectedWord ?? 0,
    currentDrawerId: room.currentDrawerId,
  })
}

function broadcastPlayers(io: TypedServer, room: Room) {
  io.to(room.code).emit('update-players', room.getPlayersArray().map(p => p.toJSON()))
}

export function setupSocketHandlers(io: TypedServer) {
  io.on('connection', (socket: TypedSocket) => {
    console.log(`Connected: ${socket.id}`)

    socket.on('create-room', ({ playerName, settings, preferredCode }) => {
      const name = sanitizeName(playerName)
      if (!name) { socket.emit('error', { message: 'Invalid player name', code: 'INVALID_NAME' }); return }
      console.log(`[create-room] Player: ${name}, Socket: ${socket.id}`)
      const room = roomManager.createRoom(settings, preferredCode)
      const player = new Player(socket.id, name, getClientIp(socket), getVisitorId(socket))

      const result = room.addPlayer(player)
      if (!result.success) {
        socket.emit('error', { message: 'Failed to create room', code: result.error })
        roomManager.deleteRoom(room.code)
        return
      }

      socket.join(room.code)
      socketRooms.set(socket.id, room.code)
      playerSessions.set(getVisitorId(socket), { visitorId: getVisitorId(socket), roomCode: room.code })

      console.log(`Room created: ${room.code} by ${playerName}`)
      sendReadyEvent(socket, room, player)
    })

    socket.on('join-room', ({ roomCode, playerName }) => {
      const name = sanitizeName(playerName)
      if (!name) { socket.emit('error', { message: 'Invalid player name', code: 'INVALID_NAME' }); return }
      if (!isValidRoomCode(roomCode)) { socket.emit('error', { message: 'Invalid room code', code: 'INVALID_CODE' }); return }

      const room = roomManager.getRoom(roomCode)

      if (!room) {
        socket.emit('error', { message: 'Room does not exist', code: 'ROOM_NOT_FOUND' })
        return
      }

      const visitorId = getVisitorId(socket)

      // Check for reconnection: find a disconnected player in this room with the same visitorId
      const disconnectedPlayer = room.getPlayersArray().find(
        p => !p.connected && p.visitorId === visitorId
      )

      if (disconnectedPlayer) {
        // Cancel pending removal timer
        const removalTimer = disconnectTimers.get(disconnectedPlayer.id)
        if (removalTimer) {
          clearTimeout(removalTimer)
          disconnectTimers.delete(disconnectedPlayer.id)
        }

        // Cancel pending drawer-kick timer
        const kickTimer = drawerKickTimers.get(disconnectedPlayer.id)
        if (kickTimer) {
          clearTimeout(kickTimer)
          drawerKickTimers.delete(disconnectedPlayer.id)
        }

        // Swap socket id onto the existing player slot (preserves score, state, drawer status)
        room.reconnectPlayer(disconnectedPlayer.id, socket.id)

        socket.join(room.code)
        socketRooms.set(socket.id, room.code)
        playerSessions.set(visitorId, { visitorId, roomCode: room.code })

        console.log(`${name} reconnected to room: ${room.code}`)

        // Broadcast full list so the player reappears for everyone
        broadcastPlayers(io, room)
        socket.to(room.code).emit('message', {
          playerId: '',
          playerName: '',
          content: `${name} reconnected`,
          type: 'system',
        })
        sendReadyEvent(socket, room, room.getPlayer(socket.id)!)
        return
      }

      const player = new Player(socket.id, name, getClientIp(socket), visitorId)
      const result = room.addPlayer(player)

      if (!result.success) {
        const messages: Record<string, string> = {
          ROOM_FULL: 'Room is full',
          GAME_OVER: 'Game has ended',
        }
        socket.emit('error', { message: messages[result.error!] || 'Cannot join room', code: result.error })
        return
      }

      // Late joiner — add to turn order and set correct state
      if (room.state === 'ongoing') {
        room.turnOrder.push(player.id)
        player.state = room.currentWord ? 'guessing' : 'standby'

        // Restore score if they were in this room before and left mid-game
        const savedScore = ghostScores.get(roomCode)?.get(visitorId)
        if (savedScore !== undefined) {
          player.score = savedScore
          ghostScores.get(roomCode)!.delete(visitorId)
        }
      }

      socket.join(room.code)
      socketRooms.set(socket.id, room.code)
      playerSessions.set(visitorId, { visitorId, roomCode: room.code })

      console.log(`${name} joined room: ${room.code}`)

      socket.to(room.code).emit('player-join', player.toJSON())
      socket.to(room.code).emit('message', {
        playerId: '',
        playerName: '',
        content: `${name} joined the game`,
        type: 'system',
      })
      sendReadyEvent(socket, room, player)
    })

    socket.on('toggle-ready', () => {
      const roomCode = socketRooms.get(socket.id)
      if (!roomCode) return

      const room = roomManager.getRoom(roomCode)
      if (!room || room.state !== 'unstarted') return

      const player = room.getPlayer(socket.id)
      if (!player || player.state === 'spectating') return

      player.state = player.state === 'ready' ? 'standby' : 'ready'
      broadcastPlayers(io, room)
    })

    socket.on('toggle-spectate', () => {
      const roomCode = socketRooms.get(socket.id)
      if (!roomCode) return

      const room = roomManager.getRoom(roomCode)
      if (!room || room.state === 'ongoing') return

      const player = room.getPlayer(socket.id)
      if (!player) return

      player.state = player.state === 'spectating' ? 'standby' : 'spectating'
      broadcastPlayers(io, room)
    })

    socket.on('start-game', () => {
      const roomCode = socketRooms.get(socket.id)
      if (!roomCode) return

      const room = roomManager.getRoom(roomCode)
      if (!room || room.state !== 'unstarted') return

      // Only owner can force start
      if (room.ownerId !== socket.id) {
        socket.emit('error', { message: 'Only room owner can start the game', code: 'NOT_OWNER' })
        return
      }

      const connectedPlayers = room.getConnectedPlayers().filter(p => p.state !== 'spectating')
      if (connectedPlayers.length < CONSTANTS.MIN_PLAYERS) {
        socket.emit('error', { message: 'Need at least 2 players to start', code: 'NOT_ENOUGH_PLAYERS' })
        return
      }

      // Start the game
      room.startGame()
      console.log(`Game started in room: ${room.code}`)

      // Create game manager and start first turn
      const gameManager = createGameManager(room.code, room.settings)
      gameManager.startTurn(io, room)
    })

    socket.on('choose-word', ({ wordIndex }) => {
      const roomCode = socketRooms.get(socket.id)
      if (!roomCode) return
      const room = roomManager.getRoom(roomCode)
      if (!room || room.currentDrawerId !== socket.id) return

      const gameManager = getGameManager(roomCode)
      if (!gameManager) return

      if (wordIndex < 0 || wordIndex >= room.settings.wordsPerTurn) return
      gameManager.chooseWord(io, room, wordIndex)
    })

    socket.on('line', (data) => {
      const roomCode = socketRooms.get(socket.id)
      if (!roomCode) return
      const room = roomManager.getRoom(roomCode)
      if (!room || room.currentDrawerId !== socket.id) return
      if (!checkLineRate(socket.id)) return
      if (room.drawing.length >= DRAWING_HISTORY_CAP) return

      const { x, y, x2, y2, color, width } = data
      if (color < 0 || color > 25) return
      if (![8, 16, 24, 32].includes(width)) return
      if (x < 0 || x > 1600 || x2 < 0 || x2 > 1600) return
      if (y < 0 || y > 900  || y2 < 0 || y2 > 900) return

      const event = { type: 'line' as const, data }
      room.pushDrawEvent(event)
      socket.to(roomCode).emit('line', data)
    })

    socket.on('lines', (batch) => {
      const roomCode = socketRooms.get(socket.id)
      if (!roomCode) return
      const room = roomManager.getRoom(roomCode)
      if (!room || room.currentDrawerId !== socket.id) return
      if (!Array.isArray(batch) || batch.length === 0) return

      const valid: typeof batch = []
      for (const data of batch) {
        if (!checkLineRate(socket.id)) break
        if (room.drawing.length + valid.length >= DRAWING_HISTORY_CAP) break
        const { x, y, x2, y2, color, width } = data
        if (color < 0 || color > 25) continue
        if (![8, 16, 24, 32].includes(width)) continue
        if (x < 0 || x > 1600 || x2 < 0 || x2 > 1600) continue
        if (y < 0 || y > 900  || y2 < 0 || y2 > 900) continue
        room.pushDrawEvent({ type: 'line' as const, data })
        valid.push(data)
      }
      if (valid.length > 0) socket.to(roomCode).emit('lines', valid)
    })

    socket.on('fill', (data) => {
      const roomCode = socketRooms.get(socket.id)
      if (!roomCode) return
      const room = roomManager.getRoom(roomCode)
      if (!room || room.currentDrawerId !== socket.id) return
      if (room.drawing.length >= DRAWING_HISTORY_CAP) return

      const { x, y, color } = data
      if (color < 0 || color > 25 || x < 0 || x > 1600 || y < 0 || y > 900) return

      const event = { type: 'fill' as const, data }
      room.pushDrawEvent(event)
      socket.to(roomCode).emit('fill', data)
    })

    socket.on('clear-canvas', () => {
      const roomCode = socketRooms.get(socket.id)
      if (!roomCode) return
      const room = roomManager.getRoom(roomCode)
      if (!room || room.currentDrawerId !== socket.id) return

      room.clearDrawing()
      socket.to(roomCode).emit('clear-canvas')
    })

    socket.on('undo', () => {
      const roomCode = socketRooms.get(socket.id)
      if (!roomCode) return
      const room = roomManager.getRoom(roomCode)
      if (!room || room.currentDrawerId !== socket.id) return

      const remaining = room.undo()
      if (remaining !== null) {
        // Send full drawing state to everyone so all clients are in sync
        io.to(roomCode).emit('drawing', remaining)
      }
    })

    socket.on('message', ({ content }) => {
      const roomCode = socketRooms.get(socket.id)
      if (!roomCode) return
      const room = roomManager.getRoom(roomCode)
      if (!room) return
      const player = room.getPlayer(socket.id)
      if (!player) return

      const text = content.trim().slice(0, CONSTANTS.MAX_MESSAGE_LENGTH)
      if (!text) return

      // Rate limiting: max 5 messages per 3 seconds
      const now = Date.now()
      const timestamps = (messageCooldowns.get(socket.id) ?? [])
        .filter(t => now - t < CONSTANTS.RATE_LIMIT_WINDOW)
      if (timestamps.length >= CONSTANTS.RATE_LIMIT_MESSAGES) {
        socket.emit('error', { message: 'Slow down!', code: 'RATE_LIMIT' })
        return
      }
      timestamps.push(now)
      messageCooldowns.set(socket.id, timestamps)

      // During an active turn, guessing players' messages are treated as guesses
      if (room.state === 'ongoing' && player.state === 'guessing' && room.currentWord) {
        const gm = getGameManager(roomCode)
        if (gm) {
          gm.handleGuess(io, room, player, text)
          return
        }
      }

      // Drawer and already-guessed players send normal chat
      io.to(roomCode).emit('message', {
        playerId: player.id,
        playerName: player.name,
        content: text,
        type: 'message',
      })
    })

    socket.on('update-settings', ({ settings }) => {
      const roomCode = socketRooms.get(socket.id)
      if (!roomCode) return
      const room = roomManager.getRoom(roomCode)
      if (!room || room.state === 'gameOver') return
      if (room.ownerId !== socket.id) return

      const isOngoing = room.state === 'ongoing'

      // Structural settings — pre-game only
      if (!isOngoing) {
        if (settings.maxPlayers !== undefined) {
          room.settings.maxPlayers = Math.min(10, Math.max(2, Math.floor(settings.maxPlayers)))
        }
      }

      // Rounds: changeable any time. Mid-game it can't drop below the round in
      // progress (that would end the game retroactively); raising it extends play.
      if (settings.rounds !== undefined) {
        let r = Math.min(10, Math.max(1, Math.floor(settings.rounds)))
        if (isOngoing) r = Math.max(r, room.round)
        room.settings.rounds = r
      }

      // Settings safe to change at any time (take effect next turn)
      if (settings.drawingTime !== undefined) {
        room.settings.drawingTime = Math.min(180, Math.max(30, Math.floor(settings.drawingTime)))
      }
      if (settings.wordsPerTurn !== undefined) {
        room.settings.wordsPerTurn = Math.min(5, Math.max(1, Math.floor(settings.wordsPerTurn)))
      }
      if (settings.scoringMode === 'normal' || settings.scoringMode === 'competitive') {
        room.settings.scoringMode = settings.scoringMode
      }

      // Custom words
      if (Array.isArray(settings.customWords)) {
        room.settings.customWords = (settings.customWords as unknown[])
          .filter((w): w is string => typeof w === 'string')
          .map(w => w.trim())
          .filter(w => w.length >= 2 && w.length <= 50)
          .slice(0, 200)
      }
      if (settings.customWordsChance !== undefined) {
        room.settings.customWordsChance = Math.min(100, Math.max(0, Math.floor(settings.customWordsChance)))
      }

      // Propagate custom word changes to the active GameManager
      if (isOngoing) {
        getGameManager(roomCode)?.updateCustomWords(
          room.settings.customWords,
          room.settings.customWordsChance,
        )
      }

      io.to(roomCode).emit('settings-updated', { settings: room.settings })
    })

    socket.on('name-change', ({ name }) => {
      const roomCode = socketRooms.get(socket.id)
      if (!roomCode) return
      const room = roomManager.getRoom(roomCode)
      if (!room) return
      const player = room.getPlayer(socket.id)
      if (!player) return

      player.name = name.trim().slice(0, 20) || player.name
      broadcastPlayers(io, room)
    })

    socket.on('kick-vote', ({ playerId: targetId }) => {
      const roomCode = socketRooms.get(socket.id)
      if (!roomCode) return
      const room = roomManager.getRoom(roomCode)
      if (!room) return
      const voter = room.getPlayer(socket.id)
      const target = room.getPlayer(targetId)
      if (!voter || !target || targetId === socket.id) return
      if (!target.connected) return

      // Init vote maps
      if (!kickVotes.has(roomCode)) kickVotes.set(roomCode, new Map())
      const roomVotes = kickVotes.get(roomCode)!
      if (!roomVotes.has(targetId)) roomVotes.set(targetId, new Set())
      const votes = roomVotes.get(targetId)!

      votes.add(socket.id)

      const connected = room.getConnectedPlayers()
      const eligible = connected.filter(p => p.id !== targetId)
      const votesNeeded = Math.ceil(eligible.length / 2)

      io.to(roomCode).emit('kick-vote', {
        targetId,
        currentVotes: votes.size,
        votesNeeded,
      })

      if (votes.size >= votesNeeded) {
        roomVotes.delete(targetId)
        kickPlayer(io, room, target, socket.id === room.currentDrawerId ? null : target.id)
      }
    })

    socket.on('play-again', () => {
      const roomCode = socketRooms.get(socket.id)
      if (!roomCode) return
      const room = roomManager.getRoom(roomCode)
      if (!room || room.state !== 'gameOver') return
      if (room.ownerId !== socket.id) return

      // Clean up current game and any ghost scores (scores reset on new game)
      deleteGameManager(roomCode)
      ghostScores.delete(roomCode)

      // Reset room to pre-game state
      room.state = 'unstarted'
      room.round = 0
      room.turnIndex = 0
      room.turnOrder = []
      room.currentDrawerId = null
      room.currentWord = ''
      room.turnEndTime = 0
      room.clearDrawing()

      // Reset all players (preserve spectator state)
      for (const player of room.getPlayersArray()) {
        player.score = 0
        player.lastScore = 0
        player.rank = 0
        if (player.state !== 'spectating') {
          player.state = 'standby'
        }
      }

      console.log(`Play again in room: ${roomCode}`)
      io.to(roomCode).emit('game-reset')
      broadcastPlayers(io, room)
    })

    socket.on('leave-room', () => {
      handleLeave(socket, io, true)
    })

    socket.on('disconnect', () => {
      console.log(`Disconnected: ${socket.id}`)
      handleLeave(socket, io, false)
    })
  })
}

function kickPlayer(io: TypedServer, room: Room, player: Player, _initiatorId: string | null) {
  const wasDrawer = room.currentDrawerId === player.id
  room.removePlayer(player.id)

  // Clear their session and ghost score so they can't auto-rejoin or reclaim points
  playerSessions.delete(player.visitorId)
  ghostScores.get(room.code)?.delete(player.visitorId)

  // Clean up any votes they started or received
  const roomVotes = kickVotes.get(room.code)
  if (roomVotes) {
    roomVotes.delete(player.id)
    for (const [, voters] of roomVotes) voters.delete(player.id)
  }
  messageCooldowns.delete(player.id)
  lineCooldowns.delete(player.id)

  if (room.isEmpty()) {
    deleteGameManager(room.code)
    kickVotes.delete(room.code)
    roomManager.deleteRoom(room.code)
    return
  }

  io.to(room.code).emit('player-leave', { playerId: player.id })
  io.to(room.code).emit('message', {
    playerId: '',
    playerName: '',
    content: `${player.name} was kicked`,
    type: 'system',
  })

  if (wasDrawer) {
    io.to(room.code).emit('drawer-kicked')
    const gm = getGameManager(room.code)
    if (gm && room.state === 'ongoing') {
      gm.kickDrawer(io, room)
    }
  }

  broadcastPlayers(io, room)
}

function handleLeave(socket: TypedSocket, io: TypedServer, intentional: boolean) {
  messageCooldowns.delete(socket.id)
  lineCooldowns.delete(socket.id)
  // Keep the session alive on accidental disconnects so the player can reconnect;
  // only remove it when they intentionally click Leave.
  if (intentional) playerSessions.delete(getVisitorId(socket))

  const roomCode = socketRooms.get(socket.id)
  if (!roomCode) return

  const room = roomManager.getRoom(roomCode)
  if (!room) return

  const player = room.getPlayer(socket.id)
  if (!player) return

  socketRooms.delete(socket.id)
  socket.leave(roomCode)

  // Preserve the player's score for an in-progress game so rejoining — whether
  // they clicked Leave or dropped — restores the points they already earned.
  // (Cleared when the game ends / room empties; see ghostScores cleanup.)
  if (room.state === 'ongoing') {
    if (!ghostScores.has(roomCode)) ghostScores.set(roomCode, new Map())
    ghostScores.get(roomCode)!.set(player.visitorId, player.score)
  } else {
    ghostScores.get(roomCode)?.delete(player.visitorId)
  }

  if (intentional) {
    // Intentional leave — remove immediately (no reserved slot)
    removePlayer(io, room, player)
  } else {
    // Disconnect — remove visually but keep the slot for a quick reconnect
    player.connected = false

    // Immediately remove from everyone's visible player list
    if (!room.isEmpty()) {
      io.to(roomCode).emit('player-leave', { playerId: player.id })
      io.to(roomCode).emit('message', {
        playerId: '',
        playerName: '',
        content: `${player.name} disconnected`,
        type: 'system',
      })

      // Transfer ownership immediately so the room isn't ownerless
      if (room.ownerId === player.id && room.ownerId) {
        const newOwner = room.getPlayer(room.ownerId)
        if (newOwner) {
          io.to(roomCode).emit('owner-change', {
            playerId: newOwner.id,
            playerName: newOwner.name,
          })
        }
      }
    }

    // If the drawer disconnected, give a short grace period then kick the turn
    if (room.state === 'ongoing' && room.currentDrawerId === player.id) {
      const gm = getGameManager(roomCode)
      if (gm) {
        const kickTimer = setTimeout(() => {
          drawerKickTimers.delete(player.id)
          const r = roomManager.getRoom(roomCode)
          if (r && !r.getPlayer(player.id)?.connected) {
            io.to(roomCode).emit('drawer-kicked')
            gm.kickDrawer(io, r)
          }
        }, CONSTANTS.DRAWER_DISCONNECT_GRACE * 1000)
        drawerKickTimers.set(player.id, kickTimer)
      }
    }

    // Silently expire the slot after 60 s if they haven't reconnected
    const timer = setTimeout(() => {
      disconnectTimers.delete(player.id)
      const currentRoom = roomManager.getRoom(roomCode)
      if (currentRoom) {
        const p = currentRoom.getPlayer(player.id)
        if (p && !p.connected) removePlayer(io, currentRoom, p, true)
      }
    }, CONSTANTS.SLOT_RESERVATION_TIME)

    disconnectTimers.set(player.id, timer)
    console.log(`Player ${player.name} disconnected, reserving slot for 60s`)
  }
}

function removePlayer(io: TypedServer, room: Room, player: Player, silent = false) {
  const wasOwner = room.ownerId === player.id
  room.removePlayer(player.id)

  // Clean up any kick votes for/by this player
  const roomVotes = kickVotes.get(room.code)
  if (roomVotes) {
    roomVotes.delete(player.id)
    for (const [, voters] of roomVotes) voters.delete(player.id)
  }

  if (room.isEmpty()) {
    deleteGameManager(room.code)
    kickVotes.delete(room.code)
    ghostScores.delete(room.code)
    roomManager.deleteRoom(room.code)
    console.log(`Room deleted: ${room.code}`)
  } else {
    // silent=true when called from the 60s timeout — player-leave and message
    // were already emitted the moment they disconnected, so skip them here.
    if (!silent) {
      io.to(room.code).emit('player-leave', { playerId: player.id })
      io.to(room.code).emit('message', {
        playerId: '',
        playerName: '',
        content: `${player.name} left the game`,
        type: 'system',
      })
    }

    if (wasOwner && room.ownerId) {
      const newOwner = room.getPlayer(room.ownerId)
      if (newOwner) {
        io.to(room.code).emit('owner-change', {
          playerId: newOwner.id,
          playerName: newOwner.name,
        })
      }
    }

    broadcastPlayers(io, room)
  }
}
