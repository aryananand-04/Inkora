import { useState, useEffect } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { useRoom } from './hooks/useRoom'
import { useVoice } from './hooks/useVoice'
import type { VoiceState } from './hooks/useVoice'
import { AuthProvider } from './context/AuthContext'
import { Home } from './pages/Home'
import { Lobby } from './pages/Lobby'
import { Game } from './pages/Game'
import { GameOver } from './components/Game/GameOver'
import { Leaderboard } from './pages/Leaderboard'

export type { VoiceState }

const SESSION_KEY = 'inkora-session'

const pageVariants: Variants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.28, ease: 'easeOut' } },
  exit:    { opacity: 0, scale: 0.97, transition: { duration: 0.18, ease: 'easeIn' } },
}

function ReconnectingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-text-muted text-sm">Rejoining room…</p>
      </div>
    </div>
  )
}

function AppInner() {
  const { roomCode, gameState, gameOverData, players, playerId, isOwner, leaveRoom, playAgain, error, isConnected } = useRoom()
  const voice = useVoice({ roomCode, playerId, players })
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const [reconnecting, setReconnecting] = useState(() => !!sessionStorage.getItem(SESSION_KEY))

  useEffect(() => {
    if (roomCode || error) setReconnecting(false)
  }, [roomCode, error])

  useEffect(() => {
    if (isConnected && !sessionStorage.getItem(SESSION_KEY)) setReconnecting(false)
  }, [isConnected])

  if (reconnecting) return <ReconnectingScreen />

  let page: React.ReactNode
  let pageKey: string

  if (showLeaderboard && !roomCode) {
    page = <Leaderboard onBack={() => setShowLeaderboard(false)} />
    pageKey = 'leaderboard'
  } else if (roomCode && gameState === 'gameOver' && gameOverData) {
    page = (
      <GameOver
        players={players}
        winner={gameOverData.winner}
        playerId={playerId}
        isOwner={isOwner}
        roomCode={roomCode}
        onPlayAgain={playAgain}
        onLeave={leaveRoom}
      />
    )
    pageKey = 'gameover'
  } else if (roomCode && gameState === 'ongoing') {
    page = <Game voice={voice} />
    pageKey = 'game'
  } else if (roomCode) {
    page = <Lobby roomCode={roomCode} voice={voice} />
    pageKey = 'lobby'
  } else {
    page = <Home onLeaderboard={() => setShowLeaderboard(true)} />
    pageKey = 'home'
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div key={pageKey} {...pageVariants} style={{ minHeight: '100vh' }}>
        {page}
      </motion.div>
    </AnimatePresence>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}

export default App
