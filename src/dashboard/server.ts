import express from 'express'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { eventBus, type AntEvent } from './events.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export class DashboardServer {
  readonly app: ReturnType<typeof express>

  constructor() {
    this.app = express()
    this.app.use(express.static(join(__dirname, 'public')))

    this.app.get('/events', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders()

      const send = (event: AntEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      }

      eventBus.on('event', send)
      req.on('close', () => eventBus.off('event', send))
    })
  }
}
