import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcGuesserPoints, calcDrawerPoints } from './GameManager.js'

test('normal guesser points: 100 base + time bonus + hint bonus', () => {
  // full time left, no hints revealed → 100 + 80 + 20
  assert.equal(calcGuesserPoints(80, 80, 'normal', 0, 4), 200)
  // no time left, all hints revealed → 100 + 0 + 0
  assert.equal(calcGuesserPoints(0, 80, 'normal', 4, 4), 100)
})

test('competitive guesser points: 50 base + quadratic time bonus + hint bonus', () => {
  // full time, no hints → 50 + 350 + 100
  assert.equal(calcGuesserPoints(80, 80, 'competitive', 0, 4), 500)
  // half the time → quadratic curve: 50 + floor(0.25 * 350) + 100
  assert.equal(calcGuesserPoints(40, 80, 'competitive', 0, 4), 50 + Math.floor(0.25 * 350) + 100)
})

test('drawer points scale with the fraction who guessed', () => {
  assert.equal(calcDrawerPoints(4, 4, 'normal'), 50)
  assert.equal(calcDrawerPoints(2, 4, 'normal'), 25)
  assert.equal(calcDrawerPoints(0, 4, 'normal'), 0)
  assert.equal(calcDrawerPoints(4, 4, 'competitive'), 100)
  assert.equal(calcDrawerPoints(0, 0, 'normal'), 0) // no guessers → no divide-by-zero
})
