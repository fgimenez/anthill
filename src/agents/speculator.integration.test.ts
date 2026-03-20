import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

const TEST_KEY = '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926b' as `0x${string}`
const config = { type: 'speculator' as const, port: 0, privateKey: TEST_KEY, tickIntervalMs: 60000 }

describe('SpeculatorAgent', () => {
  it('can be imported', async () => {
    const { SpeculatorAgent } = await import('./speculator.js')
    expect(typeof SpeculatorAgent).toBe('function')
  })

  it('GET /status returns 200 with type speculator', async () => {
    const { SpeculatorAgent } = await import('./speculator.js')
    const agent = new SpeculatorAgent(config)
    const res = await request(agent.app).get('/status')
    expect(res.status).toBe(200)
    expect(res.body.type).toBe('speculator')
  })
})
