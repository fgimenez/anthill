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

  it('tick() with buy_spot_and_signal calls mppFetch on producer and processor from registry', async () => {
    vi.stubEnv('MOCK_LLM', 'true')
    const { RegistryServer } = await import('../registry/server.js')
    const registry = new RegistryServer()
    const srv = registry.app.listen(0)
    const port = (srv.address() as { port: number }).port
    for (const [id, type, url] of [['p1', 'producer', 'http://producer:3001'], ['p2', 'processor', 'http://processor:3002']]) {
      await fetch(`http://localhost:${port}/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type, url, address: '0xaaa' }),
      })
    }
    const agent = new TraderAgent({ ...config, registryUrl: `http://localhost:${port}` })
    const mppFetchSpy = vi.spyOn(agent as unknown as { mppFetch: (u: string) => Promise<Response> }, 'mppFetch')
      .mockResolvedValue(new Response(JSON.stringify({ goods: 1, price: '1000000' })))
    await (agent as unknown as { tickWithAction(a: string): Promise<void> }).tickWithAction('buy_spot_and_signal')
    expect(mppFetchSpy).toHaveBeenCalledWith('http://producer:3001/produce')
    expect(mppFetchSpy).toHaveBeenCalledWith('http://processor:3002/process')
    srv.close()
  })
})
