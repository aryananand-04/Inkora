import { useState, useEffect, useRef } from 'react'
import { useSocket } from '../../context/SocketContext'
import { WORD_CATEGORIES } from 'shared'

// ── Category picker — chip toggles for the word packs ───────────────────────

export function CategoryPicker({ selected, onChange }: {
  selected: string[]
  onChange: (categories: string[]) => void
}) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      // Never allow an empty selection
      if (selected.length === 1) return
      onChange(selected.filter(c => c !== id))
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <div>
      <span className="text-text-muted text-sm font-medium block mb-2">Word packs</span>
      <div className="flex flex-wrap gap-1.5">
        {WORD_CATEGORIES.map(cat => {
          const active = selected.includes(cat.id)
          return (
            <button
              key={cat.id}
              onClick={() => toggle(cat.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                active
                  ? 'bg-primary/20 border-primary/50 text-primary'
                  : 'bg-surface-light border-border text-text-muted hover:text-text'
              }`}
            >
              {cat.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── AI word generator — theme → words appended into the draft ───────────────

export function AiWordGenerator({ onWords }: { onWords: (words: string[]) => void }) {
  const { socket, isConnected } = useSocket()
  const [theme, setTheme] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Keep the latest onWords without re-binding the socket listener
  const onWordsRef = useRef(onWords)
  onWordsRef.current = onWords

  useEffect(() => {
    const onResult = ({ words, error }: { theme: string; words: string[]; error?: string }) => {
      setLoading(false)
      if (error) { setError(error); return }
      setError(null)
      onWordsRef.current(words)
      setTheme('')
    }
    socket.on('ai-words-result', onResult)
    return () => { socket.off('ai-words-result', onResult) }
  }, [socket])

  const generate = () => {
    if (!isConnected || loading || theme.trim().length < 2) return
    setError(null)
    setLoading(true)
    socket.emit('generate-ai-words', { theme: theme.trim() })
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={theme}
          onChange={e => setTheme(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); generate() } }}
          placeholder="AI: theme (e.g. space, 90s cartoons)"
          maxLength={40}
          className="flex-1 px-3 py-2 bg-surface-light rounded-xl border border-border text-text text-sm placeholder:text-text-faint focus:outline-none focus:border-primary transition-colors"
        />
        <button
          onClick={generate}
          disabled={loading || theme.trim().length < 2}
          className="px-3 py-2 bg-primary/15 border border-primary/30 text-primary text-sm rounded-xl hover:bg-primary/25 transition-colors disabled:opacity-40 whitespace-nowrap"
        >
          {loading ? 'Generating…' : '✨ Generate'}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-400 mt-1.5">{error}</p>}
    </div>
  )
}
