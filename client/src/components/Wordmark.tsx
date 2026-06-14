// The Inkora wordmark: solid ink color with a hand-drawn marker underline.
// Replaces the old gradient-clipped text. `underline` is opt-out for tight
// contexts (e.g. the in-game header) where the stroke would crowd.

export function MarkerUnderline({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 12"
      fill="none"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <path
        d="M4 7.5C38 4 70 9.5 104 6.2c30-2.9 62 3 92 1.6"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Wordmark({
  className = '',
  underline = true,
}: {
  className?: string
  underline?: boolean
}) {
  return (
    <span className={`relative inline-block text-primary ${className}`}>
      Inkora
      {underline && (
        <MarkerUnderline className="absolute left-0 -bottom-[0.18em] w-full h-[0.16em] text-accent" />
      )}
    </span>
  )
}
