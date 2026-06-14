import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL  as string | undefined
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !key) {
  console.warn('[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — auth/leaderboard disabled')
}

export const supabase = createClient(
  url  ?? 'https://placeholder.supabase.co',
  key  ?? 'placeholder',
)

export const supabaseEnabled = !!(url && key)

export interface Profile {
  id: string
  username: string
  created_at: string
}

export interface LeaderboardEntry {
  id: string
  username: string
  games_played: number
  total_score: number
  avg_score: number
  total_words_guessed: number
  wins: number
}

export interface GameHistoryInsert {
  user_id: string
  room_code: string
  score: number
  rank: number
  words_guessed: number
}
