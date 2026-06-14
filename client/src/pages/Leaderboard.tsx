import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { LeaderboardEntry } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ThemeToggle } from '../components/ThemeToggle'
import { Doodles } from '../components/Doodles'

const MEDALS = ['🥇', '🥈', '🥉']
const SERVER_URL = import.meta.env.VITE_SERVER_URL as string ?? 'http://localhost:3001'

interface Props {
  onBack: () => void
}

export function Leaderboard({ onBack }: Props) {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch(`${SERVER_URL}/api/leaderboard`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => { setEntries(d.leaderboard ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-4 relative overflow-hidden">

      <Doodles />

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-2xl relative z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <button
            onClick={onBack}
            className="text-text-muted hover:text-text text-sm transition-colors flex items-center gap-1.5 font-medium"
          >
            ← Back
          </button>
          <h1 className="text-primary text-2xl font-black">Leaderboard</h1>
          <div className="w-12" />
        </div>

        {loading && (
          <div className="text-center text-text-muted py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading…
          </div>
        )}

        {error && (
          <div className="bg-red-500/15 border border-red-500/30 text-red-400 rounded-2xl p-4 text-center text-sm">
            {error === 'HTTP 503'
              ? 'Leaderboard unavailable — Supabase not configured on the server'
              : `Failed to load: ${error}`}
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center text-text-muted py-16">
            No games recorded yet. Play a round to be first on the board!
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-lg shadow-black/5">
            <div className="grid grid-cols-[2rem_1fr_5rem_5rem_4rem] gap-2 px-4 py-3 border-b border-border text-xs text-text-muted uppercase tracking-wider font-semibold">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Score</span>
              <span className="text-right">Games</span>
              <span className="text-right">Wins</span>
            </div>

            {entries.map((e, i) => {
              const isMe = profile?.username === e.username
              return (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  className={`grid grid-cols-[2rem_1fr_5rem_5rem_4rem] gap-2 px-4 py-3.5 items-center ${
                    i < entries.length - 1 ? 'border-b border-border' : ''
                  } ${isMe ? 'bg-primary/8' : ''}`}
                >
                  <span className="text-center text-sm">
                    {MEDALS[i] ?? <span className="text-text-muted tabular-nums text-xs font-mono">{i + 1}</span>}
                  </span>
                  <span className={`font-semibold text-sm truncate ${isMe ? 'text-primary' : 'text-text'}`}>
                    {e.username}
                    {isMe && <span className="text-primary/60 text-xs ml-1.5">(you)</span>}
                  </span>
                  <span className="text-right text-text font-bold tabular-nums text-sm">{e.total_score.toLocaleString()}</span>
                  <span className="text-right text-text-muted tabular-nums text-sm">{e.games_played}</span>
                  <span className="text-right text-yellow-400 tabular-nums text-sm font-medium">{e.wins}</span>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}
