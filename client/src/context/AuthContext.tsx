import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, supabaseEnabled } from '../lib/supabase'
import type { Profile } from '../lib/supabase'

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  error: string | null
}

interface AuthActions {
  signInAnonymous: () => Promise<void>
  signUp: (email: string, password: string, username: string) => Promise<boolean>
  signIn: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  clearError: () => void
}

type AuthContextValue = AuthState & AuthActions

const AuthContext = createContext<AuthContextValue>({
  user: null, profile: null, loading: true, error: null,
  signInAnonymous: async () => {},
  signUp: async () => false,
  signIn: async () => false,
  signOut: async () => {},
  clearError: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setProfile(data ?? null)
  }, [])

  // Restore session on mount
  useEffect(() => {
    if (!supabaseEnabled) { setLoading(false); return }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signInAnonymous = useCallback(async () => {
    if (!supabaseEnabled) return
    setError(null)
    const { error } = await supabase.auth.signInAnonymously()
    if (error) setError(error.message)
  }, [])

  const signUp = useCallback(async (email: string, password: string, username: string): Promise<boolean> => {
    if (!supabaseEnabled) return false
    setError(null)

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (existing) { setError('Username already taken'); return false }

    const { data, error: signUpErr } = await supabase.auth.signUp({ email, password })
    if (signUpErr) { setError(signUpErr.message); return false }
    if (!data.user) { setError('Sign-up failed'); return false }

    const { error: profileErr } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, username })
    if (profileErr) { setError(profileErr.message); return false }
    return true
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (!supabaseEnabled) return false
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); return false }
    return true
  }, [])

  const signOut = useCallback(async () => {
    if (!supabaseEnabled) return
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return (
    <AuthContext.Provider value={{
      user, profile, loading, error,
      signInAnonymous, signUp, signIn, signOut, clearError,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
