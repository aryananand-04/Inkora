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

const envOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()).filter(Boolean) ?? []
const allowedOrigins: (string | RegExp)[] = [
  ...new Set([
    'https://playinkora.vercel.app',
    'https://inkora-fawn.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    ...envOrigins,
  ]),
  // Vercel preview deployments of this project
  /^https:\/\/inkora-[a-z0-9]+-aryan-anands-projects-d1e00582\.vercel\.app$/,
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
