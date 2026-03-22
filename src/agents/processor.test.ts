import { describe, it, expect } from 'vitest'
import { isMarginPositive } from './processor.js'
import { PROCESSOR_MARGIN_THRESHOLD } from '../constants.js'

describe('isMarginPositive', () => {
  it('can be imported', () => {
    expect(typeof isMarginPositive).toBe('function')
  })

  it('returns true when margin exceeds threshold', () => {
    // productsBid=75000, goodsPrice=50000 → margin=25000 > threshold=15000
    expect(isMarginPositive(75_000_000_000n, 50_000_000_000n, PROCESSOR_MARGIN_THRESHOLD)).toBe(true)
  })

  it('returns false when margin is below threshold', () => {
    // productsBid=60000, goodsPrice=50000 → margin=10000 < threshold=15000
    expect(isMarginPositive(60_000_000_000n, 50_000_000_000n, PROCESSOR_MARGIN_THRESHOLD)).toBe(false)
  })

  it('returns false when exactly at threshold (must strictly exceed)', () => {
    // productsBid=65000, goodsPrice=50000 → margin=15000 = threshold=15000
    expect(isMarginPositive(65_000_000_000n, 50_000_000_000n, PROCESSOR_MARGIN_THRESHOLD)).toBe(false)
  })
})
