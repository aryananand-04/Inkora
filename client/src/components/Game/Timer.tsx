import { useState, useEffect, useRef, memo } from 'react'
import { playTimerWarningSound } from '../../services/sounds'

interface Props {
  timeLeft: number   // initial seconds from server
  totalTime: number  // full drawing duration (for the ring fill)
}

const SIZE = 36
const R = 13
const CIRC = 2 * Math.PI * R

export const Timer = memo(function Timer({ timeLeft, totalTime }: Props) {
  const [count, setCount] = useState(timeLeft)
  const lastTick = useRef(-1)

  // Single deadline-driven countdown, reset whenever the server pushes a new
  // timeLeft. One interval per turn — no chained timeouts that can overlap.
  useEffect(() => {
    setCount(timeLeft)
    lastTick.current = -1
    if (timeLeft <= 0) return
    const end = Date.now() + timeLeft * 1000
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.round((end - Date.now()) / 1000))
      setCount(remaining)
      if (remaining <= 0) clearInterval(id)
    }, 250)
    return () => clearInterval(id)
  }, [timeLeft])

  // Warning tick: at most once per whole second in the ≤10s zone. The ref
  // dedupes so re-renders / StrictMode double-invokes can't double the sound.
  useEffect(() => {
    if (count > 0 && count <= 10 && lastTick.current !== count) {
      lastTick.current = count
      playTimerWarningSound()
    }
  }, [count])

  const fraction = totalTime > 0 ? count / totalTime : 0
  const strokeDashoffset = CIRC * (1 - fraction)

  const color =
    fraction > 0.5 ? '#4ade80' :  // green
    fraction > 0.25 ? '#facc15' : // yellow
    '#f87171'                      // red

  return (
    <div className="flex items-center gap-1.5">
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        {/* Track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="#2e303a"
          strokeWidth={3}
        />
        {/* Progress */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeDasharray={CIRC}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
        />
      </svg>
      <span
        className="text-sm font-mono font-semibold tabular-nums w-6 text-center"
        style={{ color }}
      >
        {count}
      </span>
    </div>
  )
})
