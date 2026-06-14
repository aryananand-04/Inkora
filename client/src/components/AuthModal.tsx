import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

type Tab = 'signin' | 'signup'

interface Props {
  onClose: () => void
}

export function AuthModal({ onClose }: Props) {
  const { signIn, signUp, error, clearError, loading } = useAuth()
  const [tab, setTab]           = useState<Tab>('signin')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [busy, setBusy]         = useState(false)

  const switchTab = (t: Tab) => { setTab(t); clearError() }

  const handleSubmit = async () => {
    setBusy(true)
    const ok = tab === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, username)
    setBusy(false)
    if (ok) onClose()
  }

  const canSubmit = email.trim() && password.length >= 6 &&
    (tab === 'signin' || username.trim().length >= 2)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass bg-surface/90 border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl"
      >
        {/* Tabs */}
        <div className="flex mb-5 bg-surface-light rounded-xl p-1">
          {(['signin', 'signup'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                tab === t
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {t === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {tab === 'signup' && (
            <input
              type="text"
              placeholder="Username (2–20 chars)"
              value={username}
              onChange={e => setUsername(e.target.value.slice(0, 20))}
              maxLength={20}
              className="w-full px-3 py-2.5 bg-surface-light border border-border rounded-xl text-text placeholder:text-text-muted text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 bg-surface-light border border-border rounded-xl text-text placeholder:text-text-muted text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <input
            type="password"
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canSubmit) handleSubmit() }}
            className="w-full px-3 py-2.5 bg-surface-light border border-border rounded-xl text-text placeholder:text-text-muted text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {error && (
          <p className="mt-3 text-red-400 text-xs text-center">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || busy || loading}
          className="mt-4 w-full py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-40 shadow-lg shadow-primary/20"
        >
          {busy ? 'Please wait…' : tab === 'signin' ? 'Sign In' : 'Create Account'}
        </button>

        <button
          onClick={onClose}
          className="mt-2 w-full py-2 text-text-muted text-xs hover:text-text transition-colors"
        >
          Cancel
        </button>
      </motion.div>
    </div>
  )
}
