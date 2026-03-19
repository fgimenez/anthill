import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { RegistryServer } from './server.js'

describe('RegistryServer', () => {
  it('can be imported', () => {
    new RegistryServer()
  })

  it('GET /agents returns empty array initially', async () => {
    const res = await request(new RegistryServer().app).get('/agents')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('POST /agents/register returns 201', async () => {
    const res = await request(new RegistryServer().app).post('/agents/register').send({
      id: 'agent-1', type: 'producer', url: 'http://localhost:3001', address: '0xabc'
    })
    expect(res.status).toBe(201)
  })

  it('POST /agents/register adds agent visible in GET /agents', async () => {
    const server = new RegistryServer()
    await request(server.app).post('/agents/register').send({
      id: 'agent-1', type: 'producer', url: 'http://localhost:3001', address: '0xabc'
    })
    const res = await request(server.app).get('/agents')
    expect(res.body).toHaveLength(1)
    expect(res.body[0].id).toBe('agent-1')
  })

  it('GET /leaderboard returns 200', async () => {
    const res = await request(new RegistryServer().app).get('/leaderboard')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})
