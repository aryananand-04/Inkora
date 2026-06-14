import { GUESS_RESULT } from 'shared'
import type { GuessResult } from 'shared'

export { GUESS_RESULT }

function normalize(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ')
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  // Use two rows instead of full matrix to save memory
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  let curr = new Array<number>(n + 1)

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1]
      } else {
        curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
      }
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]
}

export function checkGuess(guess: string, word: string): GuessResult {
  const g = normalize(guess)
  const w = normalize(word)

  if (g === w) return GUESS_RESULT.EQUAL
  if (levenshtein(g, w) === 1) return GUESS_RESULT.CLOSE
  return GUESS_RESULT.DISTANT
}
