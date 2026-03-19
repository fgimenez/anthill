import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { MarketAgent } from './market.js'
import { eventBus } from '../dashboard/events.js'

const TEST_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

describe('MarketAgent', () => {
  it('GET /prices returns goodsBid and productsBid', async () => {
    const agent = new MarketAgent({ type: 'market', port: 0, privateKey: TEST_KEY, tickIntervalMs: 60000 })
    const res = await request(agent.app).get('/prices')
    expect(res.status).toBe(200)
    expect(res.body.goodsBid).toBeDefined()
    expect(res.body.productsBid).toBeDefined()
  })

  it('productsBid is always greater than goodsBid', async () => {
    const agent = new MarketAgent({ type: 'market', port: 0, privateKey: TEST_KEY, tickIntervalMs: 60000 })
    const res = await request(agent.app).get('/prices')
    expect(BigInt(res.body.productsBid)).toBeGreaterThan(BigInt(res.body.goodsBid))
  })

  it('tick() emits a price-change event every tick', async () => {
    const agent = new MarketAgent({ type: 'market', port: 0, privateKey: TEST_KEY, tickIntervalMs: 60000 })
    const received = await new Promise((resolve) => {
      eventBus.once('event', resolve)
      ;(agent as unknown as { tick(): Promise<void> }).tick()
    })
    expect((received as { type: string }).type).toBe('price-change')
  })
})
