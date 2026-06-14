// Mic glyph shown beside a player's name. Lights green with a pulsing ring
// while that player is actively transmitting voice; dim and idle otherwise.
export function SpeakingIndicator({ speaking, className = '' }: { speaking: boolean; className?: string }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center w-4 h-4 flex-shrink-0 ${className}`}
      title={speaking ? 'Talking' : 'Mic idle'}
      aria-label={speaking ? 'Talking' : 'Not talking'}
      role="img"
    >
      {speaking && (
        <span className="absolute inset-0 rounded-full bg-green-400/30 animate-ping motion-reduce:hidden" />
      )}
      <svg
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`relative transition-colors ${speaking ? 'text-green-400' : 'text-text-faint'}`}
      >
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v3" />
      </svg>
    </span>
  )
}
