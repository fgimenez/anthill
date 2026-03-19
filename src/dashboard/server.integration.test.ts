import { describe, it, expect } from 'vitest'
import http from 'node:http'
import { DashboardServer } from './server.js'
import { eventBus, type AntEvent } from './events.js'

describe('DashboardServer', () => {
  it('can be imported', () => {
    new DashboardServer()
  })

  it('GET /events returns 200 with text/event-stream', async () => {
    const dashboard = new DashboardServer()
    const srv = dashboard.app.listen(0)
    const port = (srv.address() as { port: number }).port
    const { status, contentType } = await new Promise<{ status: number; contentType: string }>((resolve) => {
      const req = http.get(`http://localhost:${port}/events`, (res) => {
        resolve({ status: res.statusCode ?? 0, contentType: res.headers['content-type'] ?? '' })
        req.destroy()
      })
    })
    srv.close()
    expect(status).toBe(200)
    expect(contentType).toMatch(/text\/event-stream/)
  })

  it('events emitted on eventBus appear in the SSE stream', async () => {
    const dashboard = new DashboardServer()
    const srv = dashboard.app.listen(0)
    const port = (srv.address() as { port: number }).port

    const received = await new Promise<AntEvent>((resolve) => {
      const req = http.get(`http://localhost:${port}/events`, (res) => {
        res.on('data', (chunk: Buffer) => {
          const line = chunk.toString().trim()
          if (line.startsWith('data: ')) {
            resolve(JSON.parse(line.slice(6)))
            req.destroy()
          }
        })
      })
      // emit after connection is established
      setTimeout(() => {
        eventBus.emit('event', { type: 'payment', from: '0xabc', agentType: 'producer', ts: Date.now() } satisfies AntEvent)
      }, 50)
    })

    srv.close()
    expect(received.type).toBe('payment')
    expect(received.from).toBe('0xabc')
  })
})
