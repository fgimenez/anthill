import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { TraderAgent, TraderActionSchema } from './trader.js'

const TEST_KEY = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6'
const config = { type: 'trader' as const, port: 0, privateKey: TEST_KEY, tickIntervalMs: 60000 }

describe('TraderAgent', () => {
  it('GET /signal returns 402 without credentials', async () => {
    const agent = new TraderAgent(config)
    const res = await request(agent.app).get('/signal')
    expect(res.status).toBe(402)
    expect(res.headers['www-authenticate']).toMatch(/Payment/)
  })

  it('TraderActionSchema validates skip action', () => {
    expect(TraderActionSchema.parse({ action: 'skip' })).toEqual({ action: 'skip' })
  })

  it('tick() completes without error with MOCK_LLM', async () => {
    vi.stubEnv('MOCK_LLM', 'true')
    const agent = new TraderAgent(config)
    await expect((agent as unknown as { tick(): Promise<void> }).tick()).resolves.not.toThrow()
  })
})
