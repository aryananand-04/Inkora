// Faint line-art background for menu screens — guessable-word doodles at low
// opacity. Static by design (no animation), so it's inherently reduced-motion safe.

const ICONS: Record<string, string> = {
  house: 'M3 11l9-7 9 7M5 10v10h14V10',
  star: 'M12 3l2.5 5.6 6.1.5-4.6 4 1.4 6L12 16.5 6.6 19.1l1.4-6-4.6-4 6.1-.5z',
  sun: 'M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2L19 19M19 5l-1.8 1.8M6.8 17.2L5 19',
  cloud: 'M6.5 18h10a4 4 0 00.4-8 6 6 0 00-11.4 1.6A3.5 3.5 0 006.5 18z',
  cat: 'M5 5l2.2 4M19 5l-2.2 4M5.5 9a6.5 6 0 0013 0M9.3 13.2h.01M14.7 13.2h.01M11 15.5h2',
  fish: 'M3 12c3.5-5 11.5-5 15 0-3.5 5-11.5 5-15 0zM18 12l3-3.2v6.4zM8 11h.01',
  bulb: 'M9.5 18.5h5M10.5 21h3M12 3a6 6 0 00-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0012 3z',
  tree: 'M12 3l4.5 6.5h-2.5L18 16H6l4-6.5H7.5zM12 16v5',
  heart: 'M12 20s-7-4.6-9-9a4.5 4.5 0 018-3 4.5 4.5 0 018 3c-2 4.4-7 9-7 9z',
  umbrella: 'M12 3v2M3.5 12a8.5 8.5 0 0117 0zM12 12v6a2 2 0 004 0',
}

// position (% based) / size / rotation, hand-placed for an even, uncrowded scatter
const PLACEMENT: { icon: keyof typeof ICONS; top: string; left: string; size: number; rot: number }[] = [
  { icon: 'star', top: '12%', left: '8%', size: 64, rot: -12 },
  { icon: 'house', top: '70%', left: '6%', size: 88, rot: 8 },
  { icon: 'cat', top: '22%', left: '84%', size: 80, rot: 10 },
  { icon: 'bulb', top: '78%', left: '82%', size: 60, rot: -8 },
  { icon: 'cloud', top: '6%', left: '46%', size: 72, rot: 4 },
  { icon: 'fish', top: '86%', left: '40%', size: 70, rot: -6 },
  { icon: 'sun', top: '40%', left: '18%', size: 52, rot: 0 },
  { icon: 'tree', top: '34%', left: '90%', size: 56, rot: -10 },
  { icon: 'heart', top: '54%', left: '78%', size: 48, rot: 12 },
  { icon: 'umbrella', top: '58%', left: '4%', size: 54, rot: -14 },
]

export function Doodles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none text-text" aria-hidden>
      {PLACEMENT.map((d, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute opacity-[0.055]"
          style={{
            top: d.top,
            left: d.left,
            width: d.size,
            height: d.size,
            transform: `translate(-50%, -50%) rotate(${d.rot}deg)`,
          }}
        >
          <path d={ICONS[d.icon]} />
        </svg>
      ))}
    </div>
  )
}
