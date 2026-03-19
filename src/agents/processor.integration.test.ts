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

  it('tick() with buy_goods_and_sell calls mppFetch on producer URL from registry', async () => {
    vi.stubEnv('MOCK_LLM', 'true')
    const { RegistryServer } = await import('../registry/server.js')
    const registry = new RegistryServer()
    const srv = registry.app.listen(0)
    const port = (srv.address() as { port: number }).port
    await fetch(`http://localhost:${port}/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'p1', type: 'producer', url: 'http://producer:3001', address: '0xaaa' }),
    })
    const agent = new ProcessorAgent(
      { ...config, registryUrl: `http://localhost:${port}` },
      `http://localhost:${port}`,
    )
    const mppFetchSpy = vi.spyOn(agent as unknown as { mppFetch: (u: string) => Promise<Response> }, 'mppFetch')
      .mockResolvedValue(new Response(JSON.stringify({ goods: 1 })))
    await (agent as unknown as { tickWithAction(a: string): Promise<void> }).tickWithAction('buy_goods_and_sell')
    expect(mppFetchSpy).toHaveBeenCalledWith('http://producer:3001/produce')
    srv.close()
  })
})
