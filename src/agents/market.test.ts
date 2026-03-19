import { describe, it, expect } from 'vitest'
import { nextPrice } from './market.js'
import { INITIAL_GOODS_BID, MIN_PRICE } from '../constants.js'

describe('nextPrice', () => {
  it('can be imported', () => {
    expect(typeof nextPrice).toBe('function')
  })

  it('never drops below MIN_PRICE after 200 steps', () => {
    let price = INITIAL_GOODS_BID
    for (let i = 0; i < 200; i++) price = nextPrice(price, INITIAL_GOODS_BID)
    expect(price).toBeGreaterThanOrEqual(MIN_PRICE)
  })

  it('stays within 3x of mean after 200 steps', () => {
    let price = INITIAL_GOODS_BID
    for (let i = 0; i < 200; i++) price = nextPrice(price, INITIAL_GOODS_BID)
    expect(price).toBeLessThanOrEqual(INITIAL_GOODS_BID * 3n)
  })
})
