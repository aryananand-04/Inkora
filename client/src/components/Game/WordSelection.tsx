import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface Props {
  words: string[]
  preSelectedWord: number
  timeLeft: number
  onChoose: (index: number) => void
}

export function WordSelection({ words, preSelectedWord, timeLeft, onChoose }: Props) {
  const [countdown, setCountdown] = useState(timeLeft)

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const progress = countdown / timeLeft

  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="glass bg-surface/90 border border-border rounded-2xl p-6 w-80 shadow-2xl"
      >
        <h2 className="text-text text-lg font-bold text-center mb-1">Choose a word</h2>
        <p className="text-text-muted text-xs text-center mb-3">
          Auto-selecting in{' '}
          <span className={`font-semibold ${countdown <= 5 ? 'text-red-400' : 'text-text'}`}>
            {countdown}s
          </span>
        </p>

        {/* Countdown bar */}
        <div className="h-1 bg-surface-light rounded-full mb-5 overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            style={{ width: `${progress * 100}%` }}
            transition={{ duration: 1, ease: 'linear' }}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          {words.map((word, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              onClick={() => onChoose(i)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full py-3.5 px-4 rounded-xl text-base font-semibold transition-all capitalize ${
                i === preSelectedWord
                  ? 'bg-primary/15 text-primary border border-primary/50 shadow-[0_0_16px_rgba(139,92,246,0.2)]'
                  : 'bg-surface-light text-text border border-border hover:border-primary/40 hover:bg-primary/8'
              }`}
            >
              {word}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
