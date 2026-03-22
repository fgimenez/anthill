import express from 'express'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import type { AntEvent } from './events.js'
import type { SimulationManager } from '../sim-manager.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const HTML_TEMPLATE = readFileSync(join(__dirname, 'public/index.html'), 'utf8')
const PROMPTS = JSON.parse(
  readFileSync(join(__dirname, '../../strategies/prompts.json'), 'utf8')
) as Record<string, Array<{ name: string; prompt: string }>>

const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>🐜 Anthill</title>
  <style>
    body { background: #0a0a0a; color: #e0e0e0; font-family: 'Courier New', monospace; padding: 40px; }
    h1 { color: #fff; margin-bottom: 8px; font-size: 1.4rem; }
    p { color: #555; font-size: 0.8rem; margin-bottom: 32px; }
    .sim-list { margin-bottom: 24px; }
    .sim-link { display: block; padding: 6px 0; color: #38bdf8; text-decoration: none; font-size: 0.9rem; }
    .sim-link:hover { color: #7dd3fc; }
    .empty { color: #444; font-size: 0.85rem; }
    button { background: #1a1a1a; color: #ccc; border: 1px solid #333; border-radius: 4px; padding: 8px 20px; font-family: inherit; font-size: 0.85rem; cursor: pointer; }
    button:hover { background: #222; color: #fff; border-color: #555; }
  </style>
</head>
<body>
  <h1>🐜 Anthill</h1>
  <p>MPP · Tempo Moderato · Claude Haiku</p>
  <div class="sim-list" id="sims"><span class="empty">Loading…</span></div>
  <button onclick="createSim()">+ New Simulation</button>
  <script>
    async function load() {
      const sims = await (await fetch('/sims')).json()
      const div = document.getElementById('sims')
      div.innerHTML = sims.length === 0
        ? '<span class="empty">No simulations running.</span>'
        : sims.map(s => \`<a class="sim-link" href="/sim/\${s.id}">→ \${s.id}</a>\`).join('')
    }
    async function createSim() {
      const r = await fetch('/sims', { method: 'POST' })
      const { id } = await r.json()
      window.location.href = '/sim/' + id
    }
    load()
  </script>
</body>
</html>`

async function proxyTo(
  targetUrl: string,
  req: express.Request,
  res: express.Response,
): Promise<void> {
  const method = req.method
  const body = method !== 'GET' && method !== 'HEAD' && req.body
    ? JSON.stringify(req.body) : undefined
  const headers: Record<string, string> = {}
  if (body) headers['Content-Type'] = 'application/json'
  const upstream = await fetch(targetUrl, { method, body, headers })
  const text = await upstream.text()
  res.status(upstream.status)
  const ct = upstream.headers.get('content-type')
  if (ct) res.setHeader('Content-Type', ct)
  res.send(text)
}

export class DashboardServer {
  readonly app: ReturnType<typeof express>

  constructor(private readonly simManager: SimulationManager) {
    this.app = express()
    this.app.use(express.json())

    // ── Landing page ──────────────────────────────────────────────────────────
    this.app.get('/', (_req, res) => {
      res.setHeader('Content-Type', 'text/html')
      res.send(LANDING_HTML)
    })

    // ── Simulation management API ─────────────────────────────────────────────
    this.app.get('/sims', (_req, res) => {
      res.json(simManager.list())
    })

    this.app.post('/sims', async (_req, res) => {
      try {
        const sim = await simManager.create()
        res.json({ id: sim.id })
      } catch (e) {
        res.status(500).json({ error: (e as Error).message })
      }
    })

    // ── Per-sim dashboard (HTML with injected SIM_ID) ─────────────────────────
    this.app.get('/sim/:id', (req, res) => {
      const sim = simManager.get(req.params.id)
      if (!sim) { res.status(404).send('Simulation not found'); return }
      const html = HTML_TEMPLATE.replace(
        '</head>',
        `<script>window.SIM_ID = ${JSON.stringify(req.params.id)}</script>\n</head>`,
      )
      res.setHeader('Content-Type', 'text/html')
      res.send(html)
    })

    // ── SSE (scoped per sim) ──────────────────────────────────────────────────
    this.app.get('/sim/:id/events', (req, res) => {
      const sim = simManager.get(req.params.id)
      if (!sim) { res.status(404).end(); return }

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders()

      const simId = req.params.id
      const send = (event: AntEvent) => {
        // Rewrite payment `to` from http://localhost:PORT/path → /sim/:id/agent/PORT/path
        let ev = event
        if (ev.type === 'payment' && ev.to) {
          ev = {
            ...ev,
            to: ev.to.replace(
              /^http:\/\/localhost:(\d+)/,
              (_m, port) => `/sim/${simId}/agent/${port}`,
            ),
          }
        }
        res.write(`data: ${JSON.stringify(ev)}\n\n`)
      }

      sim.eventBus.on('event', send)
      req.on('close', () => sim.eventBus.off('event', send))
    })

    // ── Registry proxy — rewrites agent URLs to proxied paths ─────────────────
    this.app.get('/sim/:id/agents', async (req, res) => {
      const sim = simManager.get(req.params.id)
      if (!sim) { res.json([]); return }
      try {
        const raw = await fetch(`http://localhost:${sim.registryPort}/agents`)
        const agents = await raw.json() as Array<Record<string, unknown>>
        const simId = req.params.id
        const rewritten = agents.map(a => ({
          ...a,
          url: typeof a.url === 'string'
            ? a.url.replace(
                /^http:\/\/localhost:(\d+)/,
                (_m, port) => `/sim/${simId}/agent/${port}`,
              )
            : a.url,
        }))
        res.json(rewritten)
      } catch {
        res.json([])
      }
    })

    // ── Control endpoints ─────────────────────────────────────────────────────
    this.app.get('/sim/:id/control/state', (req, res) => {
      const sim = simManager.get(req.params.id)
      if (!sim) { res.status(404).end(); return }
      const c = sim.controller
      res.json({ paused: c.paused, tick: c.currentTick, winTicks: c.winTicks })
    })

    this.app.get('/sim/:id/control/strategies', (_req, res) => {
      res.json(PROMPTS)
    })

    this.app.post('/sim/:id/control/pause', (req, res) => {
      const sim = simManager.get(req.params.id)
      if (!sim) { res.status(404).end(); return }
      sim.controller.pause()
      res.json({ ok: true, paused: true })
    })

    this.app.post('/sim/:id/control/resume', (req, res) => {
      const sim = simManager.get(req.params.id)
      if (!sim) { res.status(404).end(); return }
      sim.controller.resume()
      res.json({ ok: true, paused: false })
    })

    this.app.post('/sim/:id/control/restart', async (req, res) => {
      const sim = simManager.get(req.params.id)
      if (!sim) { res.status(404).end(); return }
      try {
        await sim.controller.restart()
        res.json({ ok: true })
      } catch (e) {
        res.status(500).json({ error: (e as Error).message })
      }
    })

    this.app.post('/sim/:id/control/strategy/:type', (req, res) => {
      const sim = simManager.get(req.params.id)
      if (!sim) { res.status(404).end(); return }
      const { name } = req.body as { name: string }
      const strategies = PROMPTS[req.params.type]
      const strategy = strategies?.find(s => s.name === name)
      if (!strategy) { res.status(400).json({ error: 'unknown strategy' }); return }
      sim.controller.setStrategyForType(req.params.type, strategy)
      res.json({ ok: true })
    })

    // Per-agent strategy (label e.g. 'producer_1', 'processor_2', 'trader', 'speculator')
    this.app.post('/sim/:id/control/strategy/agent/:label', (req, res) => {
      const sim = simManager.get(req.params.id)
      if (!sim) { res.status(404).end(); return }
      const { name } = req.body as { name: string }
      const label = req.params.label
      const type = label.replace(/_\d+$/, '')   // producer_1 → producer
      const strategies = PROMPTS[type]
      const strategy = strategies?.find(s => s.name === name)
      if (!strategy) { res.status(400).json({ error: 'unknown strategy' }); return }
      sim.controller.setStrategyForLabel(label, strategy)
      res.json({ ok: true })
    })

    // ── Agent proxy — forwards all methods to internal agent ports ────────────
    // Parses /sim/:id/agent/:port/* manually (avoids Express 5 wildcard quirks)
    this.app.use(async (req, res, next) => {
      const m = req.path.match(/^\/sim\/([^/]+)\/agent\/(\d+)(\/.*)?$/)
      if (!m) return next()
      const [, simId, port, agentPath = '/'] = m
      const sim = simManager.get(simId)
      if (!sim) { res.status(404).json({ error: 'sim not found' }); return }
      const portNum = Number(port)
      if (portNum < sim.portRange.start || portNum > sim.portRange.end) {
        res.status(403).json({ error: 'port out of range' }); return
      }
      try {
        await proxyTo(`http://localhost:${portNum}${agentPath}`, req, res)
      } catch {
        res.status(502).json({ error: 'agent unreachable' })
      }
    })
  }
}
