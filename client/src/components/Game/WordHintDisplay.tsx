import type { WordHint } from 'shared'

interface Props {
  hints: WordHint[]
  actualWord?: string | null
}

export function WordHintDisplay({ hints, actualWord }: Props) {
  // Drawer sees the actual word in full
  if (actualWord) {
    return (
      <div className="flex items-center justify-center gap-px">
        {actualWord.split('').map((char, i) => (
          <span
            key={i}
            className={`text-base font-mono font-semibold ${
              char === ' ' ? 'w-4' : 'text-white mx-0.5'
            }`}
          >
            {char === ' ' ? ' ' : char}
          </span>
        ))}
      </div>
    )
  }

  // Guessers see blanks and revealed letters
  return (
    <div className="flex items-center justify-center gap-px flex-wrap">
      {hints.map((hint, i) => {
        if (hint.character === ' ') {
          return <div key={i} className="w-4" />
        }
        return (
          <div key={i} className="flex flex-col items-center mx-0.5">
            <span className="text-sm font-mono font-bold text-white w-5 text-center h-5 flex items-center justify-center">
              {hint.revealed && hint.character ? hint.character.toUpperCase() : ' '}
            </span>
            {hint.underline && (
              <div className="w-5 h-px bg-gray-400 mt-0.5" />
            )}
          </div>
        )
      })}
    </div>
  )
}
