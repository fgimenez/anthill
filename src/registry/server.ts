import express from 'express'
import { AgentRegistry } from './index.js'

export class RegistryServer {
  readonly app: ReturnType<typeof express>
  private registry = new AgentRegistry()

  constructor() {
    this.app = express()
    this.app.use(express.json())
    this.app.use((_req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next() })
    this.app.get('/agents', (_req, res) => res.json(this.registry.list()))
    this.app.post('/agents/register', (req, res) => {
      this.registry.register(req.body)
      res.status(201).json({ ok: true })
    })
    this.app.post('/agents/:id/exit', (req, res) => {
      this.registry.recordExit(req.params.id, req.body.exitScore ?? '0')
      res.json({ ok: true })
    })
    this.app.get('/leaderboard', (_req, res) => res.json(this.registry.list()))
  }
}
