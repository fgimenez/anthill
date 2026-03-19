import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { AgentBase } from './base.js'

// Minimal concrete agent for testing AgentBase
const TEST_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

class TestAgent extends AgentBase {
  constructor() {
    super({ type: 'producer', port: 0, privateKey: TEST_KEY, tickIntervalMs: 60000 }, 1_000_000n)
  }
  protected setup() {
    this.app.get('/produce', this.charged('Buy goods'), (_req, res) => res.json({ goods: 1 }))
  }
  protected async tick() {}
}

describe('AgentBase /status', () => {
  it('returns 200 with type, address, txCount, currentPrice', async () => {
    const agent = new TestAgent()
    const res = await request(agent.app).get('/status')
    expect(res.status).toBe(200)
    expect(res.body.type).toBe('producer')
    expect(res.body.address).toMatch(/^0x/)
    expect(res.body.txCount).toBe(0)
    expect(res.body.currentPrice).toBe('1000000')
  })
})

describe('AgentBase protected route', () => {
  it('returns 402 with WWW-Authenticate header when no credentials', async () => {
    const agent = new TestAgent()
    const res = await request(agent.app).get('/produce')
    expect(res.status).toBe(402)
    expect(res.headers['www-authenticate']).toMatch(/Payment/)
  })
})
