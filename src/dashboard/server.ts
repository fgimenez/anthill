import express from 'express'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { eventBus, type AntEvent } from './events.js'
import type { SimController } from '../sim-controller.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROMPTS = JSON.parse(
  readFileSync(join(__dirname, '../../strategies/prompts.json'), 'utf8')
) as Record<string, Array<{ name: string; prompt: string }>>

export class DashboardServer {
  readonly app: ReturnType<typeof express>

  constructor(controller?: SimController) {
    this.app = express()
    this.app.use(express.json())
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

    // Control endpoints — available when SimController is provided
    if (controller) {
      this.app.get('/control/state', (_req, res) => {
        res.json({ paused: controller.paused, tick: controller.currentTick, winTicks: controller.winTicks })
      })

      this.app.get('/control/strategies', (_req, res) => {
        res.json(PROMPTS)
      })

      this.app.post('/control/pause', (_req, res) => {
        controller.pause()
        res.json({ ok: true, paused: true })
      })

      this.app.post('/control/resume', (_req, res) => {
        controller.resume()
        res.json({ ok: true, paused: false })
      })

      this.app.post('/control/restart', async (_req, res) => {
        try {
          await controller.restart()
          res.json({ ok: true })
        } catch (e) {
          res.status(500).json({ error: (e as Error).message })
        }
      })

      this.app.post('/control/strategy/:type', (req, res) => {
        const { name } = req.body as { name: string }
        const strategies = PROMPTS[req.params.type]
        const strategy = strategies?.find(s => s.name === name)
        if (!strategy) { res.status(400).json({ error: 'unknown strategy' }); return }
        controller.setStrategyForType(req.params.type, strategy)
        res.json({ ok: true, type: req.params.type, strategy: name })
      })
    }
  }
}
