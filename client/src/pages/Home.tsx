import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRoom } from '../hooks/useRoom'
import { useAuth } from '../context/AuthContext'
import { AuthModal } from '../components/AuthModal'
import { ThemeToggle } from '../components/ThemeToggle'
import { Doodles } from '../components/Doodles'
import { Wordmark } from '../components/Wordmark'
import { supabaseEnabled } from '../lib/supabase'

interface Props {
  onLeaderboard: () => void
}

function generateCode(): string {
  return String(Math.floor(Math.random() * 9000) + 1000)
}

export function Home({ onLeaderboard }: Props) {
  const { createRoom, joinRoom, error, isConnected } = useRoom()
  const { user, profile, signOut, loading: authLoading } = useAuth()

  const [playerName, setPlayerName] = useState(profile?.username ?? '')
  const [mode, setMode]             = useState<'home' | 'create' | 'join'>('home')
  const [generatedCode, setGeneratedCode] = useState('')
  const [joinDigits, setJoinDigits] = useState(['', '', '', ''])
  const [showAuth, setShowAuth]     = useState(false)
  const [joining, setJoining]       = useState(false)
  const digitRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { if (error) setJoining(false) }, [error])

  const displayName = profile?.username ?? playerName

  const openCreate = () => {
    setGeneratedCode(generateCode())
    setMode('create')
  }

  const handleCreate = () => {
    if (!displayName.trim()) return
    setJoining(true)
    createRoom(displayName.trim(), undefined, generatedCode)
  }

  const joinCode = joinDigits.join('')
  const handleJoin = () => {
    if (displayName.trim() && joinCode.length === 4) {
      setJoining(true)
      joinRoom(joinCode, displayName.trim())
    }
  }

  const isAnonymous = user?.is_anonymous ?? false

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* Word-doodle backdrop */}
      <Doodles />

      {/* Top bar */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeToggle />
        {supabaseEnabled && !authLoading && (
          user && !isAnonymous && profile ? (
            <>
              <span className="text-text-muted text-sm">{profile.username}</span>
              <button
                onClick={signOut}
                className="text-xs text-text-muted hover:text-text transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="px-3 py-1.5 bg-surface border border-border text-text-muted text-sm rounded-lg hover:bg-surface-light hover:text-text transition-colors"
            >
              Sign in
            </button>
          )
        )}
      </div>

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-6xl font-black tracking-tight mb-2"
          >
            <Wordmark />
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-text-muted text-sm"
          >
            Real-time multiplayer drawing game
          </motion.p>
        </div>

        {/* Connection status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-4 text-sm"
        >
          <span className={`inline-flex items-center gap-1.5 ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
            {isConnected ? 'Connected' : 'Connecting…'}
          </span>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500/15 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-xl mb-4 text-center text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
          className="bg-surface rounded-2xl p-6 border border-border shadow-lg shadow-black/5"
        >
          {/* Name input */}
          <input
            type="text"
            value={profile?.username ?? playerName}
            onChange={e => { if (!profile) setPlayerName(e.target.value) }}
            readOnly={!!profile}
            placeholder="Your name"
            maxLength={20}
            className={`w-full px-4 py-3 bg-surface-light rounded-xl border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 mb-5 transition-all font-medium ${
              profile ? 'opacity-60 cursor-default' : ''
            }`}
          />

          <AnimatePresence mode="wait">

            {/* Home mode */}
            {mode === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <button
                  onClick={openCreate}
                  disabled={!displayName.trim() || !isConnected}
                  className="w-full px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-primary/20"
                >
                  Create Room
                </button>
                <button
                  onClick={() => setMode('join')}
                  className="w-full px-6 py-3 bg-surface-light text-text border border-border rounded-xl font-medium hover:bg-border/50 transition-colors"
                >
                  Join Room
                </button>
              </motion.div>
            )}

            {/* Create mode */}
            {mode === 'create' && (
              <motion.div
                key="create"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="text-center">
                  <p className="text-text-muted text-sm mb-4">
                    Share this code with your friends
                  </p>
                  <div className="flex items-center justify-center gap-3 mb-3">
                    {generatedCode.split('').map((digit, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.8, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.3 }}
                        className="w-16 h-20 flex items-center justify-center bg-surface-light border-2 border-primary rounded-2xl shadow-sm shadow-primary/15"
                      >
                        <span className="text-4xl font-black font-mono text-text tracking-tighter">
                          {digit}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                  <button
                    onClick={() => setGeneratedCode(generateCode())}
                    className="text-xs text-text-muted hover:text-primary transition-colors underline underline-offset-2"
                  >
                    Generate a different code
                  </button>
                </div>
                <button
                  onClick={handleCreate}
                  disabled={!isConnected || joining}
                  className="w-full px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
                >
                  {joining ? 'Creating…' : 'Create Room'}
                </button>
                <button
                  onClick={() => { setMode('home'); setJoining(false) }}
                  className="w-full px-6 py-3 bg-surface-light text-text border border-border rounded-xl font-medium hover:bg-border/50 transition-colors"
                >
                  Back
                </button>
              </motion.div>
            )}

            {/* Join mode */}
            {mode === 'join' && (
              <motion.div
                key="join"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <p className="text-text-muted text-sm text-center mb-3 font-medium">Enter room code</p>
                  <div className="flex gap-3 justify-center">
                    {joinDigits.map((d, i) => (
                      <input
                        key={i}
                        ref={el => { digitRefs.current[i] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '').slice(-1)
                          const next = [...joinDigits]
                          next[i] = val
                          setJoinDigits(next)
                          if (val && i < 3) digitRefs.current[i + 1]?.focus()
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Backspace' && !joinDigits[i] && i > 0) {
                            const next = [...joinDigits]
                            next[i - 1] = ''
                            setJoinDigits(next)
                            digitRefs.current[i - 1]?.focus()
                          }
                          if (e.key === 'Enter' && joinCode.length === 4) handleJoin()
                        }}
                        onFocus={e => e.target.select()}
                        className="w-14 h-16 text-center text-2xl font-black font-mono bg-surface-light border-2 border-border rounded-2xl text-text focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all caret-transparent"
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleJoin}
                  disabled={!displayName.trim() || joinCode.length !== 4 || !isConnected || joining}
                  className="w-full px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
                >
                  {joining ? 'Joining…' : 'Join Room'}
                </button>
                <button
                  onClick={() => { setMode('home'); setJoinDigits(['', '', '', '']) }}
                  className="w-full px-6 py-3 bg-surface-light text-text border border-border rounded-xl font-medium hover:bg-border/50 transition-colors"
                >
                  Back
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-5 flex items-center justify-center gap-2 text-sm text-text-muted"
        >
          {['Draw', 'Guess', 'Score'].map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              {i > 0 && <span className="text-text-faint" aria-hidden>→</span>}
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-primary/12 text-primary text-xs font-bold tabular-nums">
                  {i + 1}
                </span>
                {step}
              </span>
            </span>
          ))}
        </motion.div>

        {supabaseEnabled && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            onClick={onLeaderboard}
            className="mt-4 w-full py-2 text-text-muted hover:text-text text-sm transition-colors"
          >
            🏆 Leaderboard
          </motion.button>
        )}
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}
