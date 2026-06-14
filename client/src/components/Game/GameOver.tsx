import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Player } from 'shared'
import { useAuth } from '../../context/AuthContext'
import { supabase, supabaseEnabled } from '../../lib/supabase'
import { Doodles } from '../Doodles'

interface Props {
  players: Player[]
  winner: Player
  playerId: string | null
  isOwner: boolean
  roomCode: string | null
  onPlayAgain: () => void
  onLeave: () => void
}

const MEDALS = ['🥇', '🥈', '🥉']

export function GameOver({ players, winner, playerId, isOwner, roomCode, onPlayAgain, onLeave }: Props) {
  const { user, profile } = useAuth()
  const [saved, setSaved]   = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const savedRef = useRef(false)

  const sorted = [...players].sort((a, b) => b.score - a.score)
  const me = sorted.find(p => p.id === playerId)
  const myRank = me ? sorted.indexOf(me) + 1 : null

  useEffect(() => {
    if (!supabaseEnabled || !user || user.is_anonymous || !profile || !me || savedRef.current) return
    savedRef.current = true
    supabase
      .from('game_history')
      .insert({
        user_id:       user.id,
        room_code:     roomCode ?? 'unknown',
        score:         me.score,
        rank:          myRank ?? 0,
        words_guessed: 0,
      })
      .then(({ error }) => {
        if (error) setSaveErr(error.message)
        else setSaved(true)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">

      {/* Word-doodle backdrop */}
      <Doodles />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
            className="text-6xl mb-3"
          >
            🏆
          </motion.div>
          <h1 className="text-text text-3xl font-black mb-1">Game Over</h1>
          <p className="text-text-muted text-sm">
            <span className="text-yellow-400 font-bold">{winner.name}</span> wins!
          </p>
          {saved && (
            <p className="text-green-400 text-xs mt-1.5">Result saved to leaderboard ✓</p>
          )}
          {saveErr && (
            <p className="text-red-400 text-xs mt-1.5">Couldn't save result: {saveErr}</p>
          )}
        </div>

        {/* Scoreboard */}
        <div className="bg-surface border border-border rounded-2xl overflow-hidden mb-4 shadow-lg shadow-black/5">
          {sorted.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.06, duration: 0.3 }}
              className={`flex items-center gap-3 px-4 py-3.5 ${
                i < sorted.length - 1 ? 'border-b border-border' : ''
              } ${p.id === playerId ? 'bg-primary/8' : ''}`}
            >
              <span className="text-lg w-7 text-center flex-shrink-0">
                {MEDALS[i] ?? <span className="text-text-muted text-sm font-mono">{i + 1}</span>}
              </span>
              <span className={`flex-1 font-semibold text-sm truncate ${
                p.id === playerId ? 'text-primary' : 'text-text'
              }`}>
                {p.name}
                {p.id === playerId && <span className="text-primary/60 text-xs ml-1.5">(you)</span>}
              </span>
              <span className="text-text font-bold tabular-nums">{p.score}</span>
              {p.lastScore > 0 && (
                <span className="text-green-400 text-xs tabular-nums font-medium">+{p.lastScore}</span>
              )}
            </motion.div>
          ))}
        </div>

        {/* Prompt to create account */}
        {supabaseEnabled && user?.is_anonymous && (
          <div className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3 mb-4 text-center text-sm text-primary">
            Create an account to save your results to the leaderboard
          </div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex gap-2"
        >
          {isOwner ? (
            <button
              onClick={onPlayAgain}
              className="flex-1 py-3.5 bg-primary text-white font-bold rounded-2xl hover:brightness-110 transition-all shadow-md shadow-primary/20"
            >
              Play Again
            </button>
          ) : (
            <div className="flex-1 py-3.5 bg-surface border border-border text-text-muted text-sm text-center rounded-2xl">
              Waiting for owner to restart…
            </div>
          )}
          <button
            onClick={onLeave}
            className="px-5 py-3.5 bg-red-500/10 text-red-400 font-medium rounded-2xl hover:bg-red-500/20 transition-colors border border-red-500/20"
          >
            Leave
          </button>
        </motion.div>
      </motion.div>
    </div>
  )
}
