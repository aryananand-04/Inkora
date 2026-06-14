import type { Router } from 'express'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey  = process.env.SUPABASE_SERVICE_KEY

// Loaded lazily: @supabase/supabase-js is a heavy, optional dependency only
// needed when the leaderboard endpoint is hit AND Supabase is configured.
// Importing it at module top level blocks server startup, so defer it here.
async function getClient() {
  if (!supabaseUrl || !serviceKey) return null
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })
}

export function registerLeaderboardRoutes(router: Router) {
  router.get('/api/leaderboard', async (_req, res) => {
    const client = await getClient()
    if (!client) {
      res.status(503).json({ error: 'Leaderboard unavailable — Supabase not configured' })
      return
    }

    const { data, error } = await client
      .from('leaderboard')
      .select('*')

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({ leaderboard: data ?? [] })
  })
}
