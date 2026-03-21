import { describe, it, expect, vi, beforeEach } from 'vitest'
import { adjustPrice } from './base.js'
import { MIN_PRICE } from '../constants.js'

describe('adjustPrice', () => {
  it('can be imported', () => {
    expect(typeof adjustPrice).toBe('function')
  })

  it('raises price by 5% when requests exceed 2', () => {
    expect(adjustPrice(10_000_000_000n, 3)).toBe(10_500_000_000n)
  })

  it('lowers price by 5% when no requests', () => {
    expect(adjustPrice(10_000_000_000n, 0)).toBe(9_500_000_000n)
  })

  it('keeps price unchanged for 1 or 2 requests', () => {
    expect(adjustPrice(10_000_000_000n, 1)).toBe(10_000_000_000n)
    expect(adjustPrice(10_000_000_000n, 2)).toBe(10_000_000_000n)
  })

  it('never drops below MIN_PRICE', () => {
    expect(adjustPrice(MIN_PRICE, 0)).toBe(MIN_PRICE)
  })
})

describe('decide (MOCK_LLM)', () => {
  beforeEach(() => {
    vi.stubEnv('MOCK_LLM', 'true')
  })

  it('decide is exported from base', async () => {
    const { decide } = await import('./base.js')
    expect(typeof decide).toBe('function')
  })
})
