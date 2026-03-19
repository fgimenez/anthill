import { describe, it, expect } from 'vitest'
import { isMarginPositive } from './processor.js'
import { PROCESSOR_MARGIN_THRESHOLD } from '../constants.js'

describe('isMarginPositive', () => {
  it('can be imported', () => {
    expect(typeof isMarginPositive).toBe('function')
  })

  it('returns true when margin exceeds threshold', () => {
    // productsBid=2000, goodsPrice=1000 → margin=1000 > threshold=300
    expect(isMarginPositive(2_000_000_000n, 1_000_000_000n, PROCESSOR_MARGIN_THRESHOLD)).toBe(true)
  })

  it('returns false when margin is below threshold', () => {
    // productsBid=1100, goodsPrice=1000 → margin=100 < threshold=300
    expect(isMarginPositive(1_100_000_000n, 1_000_000_000n, PROCESSOR_MARGIN_THRESHOLD)).toBe(false)
  })

  it('returns false when exactly at threshold (must strictly exceed)', () => {
    expect(isMarginPositive(1_300_000_000n, 1_000_000_000n, PROCESSOR_MARGIN_THRESHOLD)).toBe(false)
  })
})
