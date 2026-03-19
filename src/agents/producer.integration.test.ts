import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { ProducerAgent, ProducerActionSchema } from './producer.js'

const TEST_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'

const config = { type: 'producer' as const, port: 0, privateKey: TEST_KEY, tickIntervalMs: 60000 }

describe('ProducerAgent', () => {
  it('GET /produce returns 402 without credentials', async () => {
    const agent = new ProducerAgent(config)
    const res = await request(agent.app).get('/produce')
    expect(res.status).toBe(402)
    expect(res.headers['www-authenticate']).toMatch(/Payment/)
  })

  it('ProducerActionSchema validates hold action', () => {
    expect(ProducerActionSchema.parse({ action: 'hold' })).toEqual({ action: 'hold' })
  })

  it('tick() completes without error with MOCK_LLM', async () => {
    vi.stubEnv('MOCK_LLM', 'true')
    const agent = new ProducerAgent(config)
    await expect((agent as unknown as { tick(): Promise<void> }).tick()).resolves.not.toThrow()
  })
})
