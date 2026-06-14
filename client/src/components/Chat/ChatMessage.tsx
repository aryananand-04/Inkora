import { memo } from 'react'
import type { MessageEvent } from 'shared'

interface Props {
  message: MessageEvent
}

export const ChatMessage = memo(function ChatMessage({ message }: Props) {
  if (message.type === 'system') {
    return (
      <div className="text-center py-0.5">
        <span className="text-text-faint text-xs italic">{message.content}</span>
      </div>
    )
  }

  if (message.type === 'correct') {
    return (
      <div className="flex items-center gap-1.5 bg-green-500/10 rounded-lg px-2 py-1 border border-green-500/15">
        <span className="text-green-500 text-xs">✓</span>
        <span className="text-green-400 text-xs font-semibold">{message.content}</span>
      </div>
    )
  }

  return (
    <div className="px-1 py-0.5">
      <span className="text-primary text-xs font-semibold break-all">{message.playerName}</span>
      <span className="text-text-faint text-xs">: </span>
      <span className="text-text text-xs break-words">{message.content}</span>
    </div>
  )
})
