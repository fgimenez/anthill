import { describe, it, expect } from 'vitest'
import { isMarginPositive } from './processor.js'
import { PROCESSOR_MARGIN_THRESHOLD } from '../constants.js'

describe('isMarginPositive', () => {
  it('can be imported', () => {
    expect(typeof isMarginPositive).toBe('function')
  })

  it('returns true when margin exceeds threshold', () => {
    // productsBid=2.00, goodsPrice=1.00 → margin=1.00 > threshold=0.30
    expect(isMarginPositive(2_000_000n, 1_000_000n, PROCESSOR_MARGIN_THRESHOLD)).toBe(true)
  })

  it('returns false when margin is below threshold', () => {
    // productsBid=1.10, goodsPrice=1.00 → margin=0.10 < threshold=0.30
    expect(isMarginPositive(1_100_000n, 1_000_000n, PROCESSOR_MARGIN_THRESHOLD)).toBe(false)
  })

  it('returns false when exactly at threshold (must strictly exceed)', () => {
    expect(isMarginPositive(1_300_000n, 1_000_000n, PROCESSOR_MARGIN_THRESHOLD)).toBe(false)
  })
})
