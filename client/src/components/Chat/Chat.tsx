import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { MessageEvent } from 'shared'
import { ChatMessage } from './ChatMessage'

interface Props {
  messages: MessageEvent[]
  onSend: (content: string) => void
  playerState: string
  closeGuessHint: string | null
}

export function Chat({ messages, onSend, playerState, closeGuessHint }: Props) {
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    onSend(text)
    setInput('')
  }

  const placeholder =
    playerState === 'drawing'    ? 'Chat (you are drawing)…' :
    playerState === 'guessing'   ? 'Type to guess…' :
    playerState === 'spectating' ? 'Spectating — type to chat…' :
    'Chat…'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border flex-shrink-0">
        <h2 className="text-text-muted text-xs uppercase tracking-wider font-semibold">Chat</h2>
      </div>

      {/* Close-guess hint banner */}
      <AnimatePresence>
        {closeGuessHint && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-2 mt-2 bg-yellow-500/15 border border-yellow-500/30 rounded-xl px-3 py-2 flex-shrink-0"
          >
            <p className="text-yellow-400 text-xs font-semibold">So close!</p>
            <p className="text-yellow-500/70 text-xs">"{closeGuessHint}" is almost right</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto py-2 px-1 space-y-0.5 min-h-0"
      >
        {messages.length === 0 ? (
          <p className="text-text-faint text-xs text-center pt-6">No messages yet</p>
        ) : (
          messages.map((msg, i) => <ChatMessage key={i} message={msg} />)
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-border flex-shrink-0">
        <div className="flex gap-1">
          <input
            className="flex-1 bg-surface-light text-text text-xs rounded-xl px-3 py-2 outline-none border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/20 placeholder-text-muted/60 min-w-0 transition-all"
            placeholder={placeholder}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
            maxLength={200}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-2.5 py-2 bg-primary text-white text-xs rounded-xl disabled:opacity-30 hover:brightness-110 transition-all flex-shrink-0"
          >
            ↵
          </button>
        </div>
      </div>
    </div>
  )
}
