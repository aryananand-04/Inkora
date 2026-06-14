import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkGuess, GUESS_RESULT } from './guessChecker.js'

test('exact match is EQUAL (case- and whitespace-insensitive)', () => {
  assert.equal(checkGuess('apple', 'apple'), GUESS_RESULT.EQUAL)
  assert.equal(checkGuess('  Apple  ', 'apple'), GUESS_RESULT.EQUAL)
  assert.equal(checkGuess('ICE   cream', 'ice cream'), GUESS_RESULT.EQUAL)
})

test('off-by-one edits are CLOSE', () => {
  assert.equal(checkGuess('aple', 'apple'), GUESS_RESULT.CLOSE)    // missing letter
  assert.equal(checkGuess('apples', 'apple'), GUESS_RESULT.CLOSE)  // extra letter
  assert.equal(checkGuess('appke', 'apple'), GUESS_RESULT.CLOSE)   // one wrong letter
})

test('far-off guesses are DISTANT', () => {
  assert.equal(checkGuess('banana', 'apple'), GUESS_RESULT.DISTANT)
  assert.equal(checkGuess('', 'apple'), GUESS_RESULT.DISTANT)
  // adjacent transposition is edit-distance 2, so it is not treated as CLOSE
  assert.equal(checkGuess('aplpe', 'apple'), GUESS_RESULT.DISTANT)
})
