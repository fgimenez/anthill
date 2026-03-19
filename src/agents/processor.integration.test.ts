import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { ProcessorAgent, ProcessorActionSchema } from './processor.js'

const TEST_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
const config = { type: 'processor' as const, port: 0, privateKey: TEST_KEY, tickIntervalMs: 60000 }

describe('ProcessorAgent', () => {
  it('GET /process returns 402 without credentials', async () => {
    const agent = new ProcessorAgent(config)
    const res = await request(agent.app).get('/process')
    expect(res.status).toBe(402)
    expect(res.headers['www-authenticate']).toMatch(/Payment/)
  })

  it('ProcessorActionSchema validates skip action', () => {
    expect(ProcessorActionSchema.parse({ action: 'skip' })).toEqual({ action: 'skip' })
  })

  it('tick() completes without error with MOCK_LLM', async () => {
    vi.stubEnv('MOCK_LLM', 'true')
    const agent = new ProcessorAgent(config)
    await expect((agent as unknown as { tick(): Promise<void> }).tick()).resolves.not.toThrow()
  })
})
