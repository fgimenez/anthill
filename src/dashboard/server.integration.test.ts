import { describe, it, expect } from 'vitest'
import { EventEmitter } from 'node:events'
import http from 'node:http'
import { DashboardServer } from './server.js'
import type { SimulationManager } from '../sim-manager.js'
import type { AntEvent } from './events.js'

// Minimal SimulationManager mock with a controllable eventBus
function makeMockManager(bus: EventEmitter) {
  return {
    get: (id: string) => id === 'test' ? { eventBus: bus, registryPort: 9999, portRange: { start: 9999, end: 10006 }, controller: { paused: false, currentTick: 0, winTicks: 0 } } : undefined,
    list: () => [],
    create: async () => { throw new Error('not implemented') },
  } as unknown as SimulationManager
}

describe('DashboardServer', () => {
  it('GET / returns landing page', async () => {
    const bus = new EventEmitter()
    const dashboard = new DashboardServer(makeMockManager(bus))
    const srv = dashboard.app.listen(0)
    const port = (srv.address() as { port: number }).port
    const res = await fetch(`http://localhost:${port}/`)
    srv.close()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
  })

  it('GET /sim/:id/events returns SSE stream', async () => {
    const bus = new EventEmitter()
    const dashboard = new DashboardServer(makeMockManager(bus))
    const srv = dashboard.app.listen(0)
    const port = (srv.address() as { port: number }).port
    const { status, contentType } = await new Promise<{ status: number; contentType: string }>((resolve) => {
      const req = http.get(`http://localhost:${port}/sim/test/events`, (res) => {
        resolve({ status: res.statusCode ?? 0, contentType: res.headers['content-type'] ?? '' })
        req.destroy()
      })
    })
    srv.close()
    expect(status).toBe(200)
    expect(contentType).toMatch(/text\/event-stream/)
  })

  it('events emitted on sim eventBus appear in the SSE stream', async () => {
    const bus = new EventEmitter()
    const dashboard = new DashboardServer(makeMockManager(bus))
    const srv = dashboard.app.listen(0)
    const port = (srv.address() as { port: number }).port

    const received = await new Promise<AntEvent>((resolve) => {
      const req = http.get(`http://localhost:${port}/sim/test/events`, (res) => {
        res.on('data', (chunk: Buffer) => {
          const line = chunk.toString().trim()
          if (line.startsWith('data: ')) {
            resolve(JSON.parse(line.slice(6)))
            req.destroy()
          }
        })
      })
      setTimeout(() => {
        bus.emit('event', { type: 'payment', from: '0xabc', agentType: 'producer', ts: Date.now() } satisfies AntEvent)
      }, 50)
    })

    srv.close()
    expect(received.type).toBe('payment')
    expect(received.from).toBe('0xabc')
  })
})
