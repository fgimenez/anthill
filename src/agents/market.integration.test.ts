import { describe, it, expect } from 'vitest'
import { EventEmitter } from 'node:events'
import request from 'supertest'
import { MarketAgent } from './market.js'

const TEST_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`

const makeAgent = () => {
  const bus = new EventEmitter()
  const agent = new MarketAgent({ type: 'market', port: 0, privateKey: TEST_KEY, tickIntervalMs: 60000, eventBus: bus })
  return { agent, bus }
}

describe('MarketAgent', () => {
  it('GET /prices returns goodsBid and productsBid', async () => {
    const { agent } = makeAgent()
    const res = await request(agent.app).get('/prices')
    expect(res.status).toBe(200)
    expect(res.body.goodsBid).toBeDefined()
    expect(res.body.productsBid).toBeDefined()
  })

  it('productsBid is always greater than goodsBid', async () => {
    const { agent } = makeAgent()
    const res = await request(agent.app).get('/prices')
    expect(BigInt(res.body.productsBid)).toBeGreaterThan(BigInt(res.body.goodsBid))
  })

  it('tick() emits a price-change event every tick', async () => {
    const { agent, bus } = makeAgent()
    const received = await new Promise((resolve) => {
      bus.once('event', resolve)
      ;(agent as unknown as { tick(): Promise<void> }).tick()
    })
    expect((received as { type: string }).type).toBe('price-change')
  })
})
