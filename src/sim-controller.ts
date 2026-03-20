import { bootstrap } from './bootstrap.js'
import type { AgentBase } from './agents/base.js'
import { eventBus } from './dashboard/events.js'

export class SimController {
  private agents: AgentBase[] = []
  private _paused = false
  private tickCount = 0
  private masterInterval?: ReturnType<typeof setInterval>
  readonly winTicks: number

  constructor(winTicks = 0) {
    this.winTicks = winTicks
  }

  register(agent: AgentBase) {
    this.agents.push(agent)
  }

  // Start the master tick counter (same interval as agents)
  start(tickIntervalMs: number) {
    this.masterInterval = setInterval(() => {
      if (this._paused) return
      this.tickCount++
      eventBus.emit('event', {
        type: 'tick',
        tick: this.tickCount,
        winTicks: this.winTicks,
        ts: Date.now(),
      })
      if (this.winTicks > 0 && this.tickCount >= this.winTicks) {
        clearInterval(this.masterInterval)
        this.pause()
        eventBus.emit('event', { type: 'game-over', tick: this.tickCount, ts: Date.now() })
        console.log(`[sim] game over — ${this.tickCount} ticks`)
      }
    }, tickIntervalMs)
  }

  pause() {
    this._paused = true
    for (const a of this.agents) a.setPaused(true)
  }

  resume() {
    this._paused = false
    for (const a of this.agents) a.setPaused(false)
  }

  async restart() {
    this.pause()
    this.tickCount = 0
    console.log('[sim] restarting — re-funding wallets…')
    await bootstrap()
    for (const a of this.agents) a.reset()
    this.resume()
    console.log('[sim] restarted')
    eventBus.emit('event', { type: 'restarted', ts: Date.now() })
  }

  setStrategyForType(type: string, strategy: { name: string; prompt: string }) {
    for (const a of this.agents) {
      if (a.agentType === type) a.setStrategy(strategy)
    }
  }

  get paused() { return this._paused }
  get currentTick() { return this.tickCount }
}
