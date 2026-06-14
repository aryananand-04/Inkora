import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { setSoundPref, type SoundKey } from '../../services/sounds'
import { useSoundPrefs } from '../../hooks/useSoundPrefs'

const ITEMS: { key: SoundKey; label: string; hint: string }[] = [
  { key: 'ticking',   label: 'Countdown ticking',  hint: 'Last 10 seconds' },
  { key: 'selection', label: 'Word selection',     hint: 'When a word is chosen' },
  { key: 'chat',      label: 'Correct guess',      hint: 'When someone guesses' },
]

function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative w-9 h-5 rounded-full flex-shrink-0 transition-colors ${
        on ? 'bg-primary' : 'bg-border'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
          on ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </span>
  )
}

export function AudioSettings() {
  const prefs = useSoundPrefs()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const allOff = !prefs.ticking && !prefs.selection && !prefs.chat

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Sound settings"
        aria-label="Sound settings"
        aria-haspopup="true"
        aria-expanded={open}
        className="w-7 h-7 flex items-center justify-center bg-surface-light hover:bg-border/60 border border-border rounded-lg text-text-muted hover:text-text text-sm transition-colors"
      >
        {allOff ? '🔇' : '🔊'}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-64 bg-surface border border-border rounded-xl shadow-2xl p-1.5 z-40"
          >
            <p className="px-2.5 py-1.5 text-xs font-semibold text-text-muted">Sound effects</p>
            {ITEMS.map(item => (
              <button
                key={item.key}
                role="menuitemcheckbox"
                aria-checked={prefs[item.key]}
                onClick={() => setSoundPref(item.key, !prefs[item.key])}
                className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg hover:bg-surface-light text-left transition-colors"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-text">{item.label}</span>
                  <span className="block text-[11px] text-text-faint">{item.hint}</span>
                </span>
                <Switch on={prefs[item.key]} />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
