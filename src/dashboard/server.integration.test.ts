import { describe, it, expect } from 'vitest'
import http from 'node:http'
import { DashboardServer } from './server.js'

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
})
