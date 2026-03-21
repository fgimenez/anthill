import { describe, it, expect } from 'vitest'
import { isMarginPositive } from './processor.js'
import { PROCESSOR_MARGIN_THRESHOLD } from '../constants.js'

describe('isMarginPositive', () => {
  it('can be imported', () => {
    expect(typeof isMarginPositive).toBe('function')
  })

  it('returns true when margin exceeds threshold', () => {
    // productsBid=20000, goodsPrice=10000 → margin=10000 > threshold=3000
    expect(isMarginPositive(20_000_000_000n, 10_000_000_000n, PROCESSOR_MARGIN_THRESHOLD)).toBe(true)
  })

  it('returns false when margin is below threshold', () => {
    // productsBid=11000, goodsPrice=10000 → margin=1000 < threshold=3000
    expect(isMarginPositive(11_000_000_000n, 10_000_000_000n, PROCESSOR_MARGIN_THRESHOLD)).toBe(false)
  })

  it('returns false when exactly at threshold (must strictly exceed)', () => {
    // productsBid=13000, goodsPrice=10000 → margin=3000 = threshold=3000
    expect(isMarginPositive(13_000_000_000n, 10_000_000_000n, PROCESSOR_MARGIN_THRESHOLD)).toBe(false)
  })
})
