import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { setupSocketHandlers } from './socket/index.js'
import { registerLeaderboardRoutes } from './api/leaderboard.js'
import { registerRoomRoutes } from './api/rooms.js'
import type { ClientToServerEvents, ServerToClientEvents } from 'shared'

const app = express()
const httpServer = createServer(app)

const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
]

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
})

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({ name: 'Inkora API', version: '1.0.0' })
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

setupSocketHandlers(io)
registerLeaderboardRoutes(app)
registerRoomRoutes(app)

const PORT = process.env.PORT || 3001

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
