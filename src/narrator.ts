import { EventEmitter } from 'node:events'
import { z } from 'zod'
import { decide } from './agents/base.js'
import type { AntEvent } from './dashboard/events.js'

const NARRATOR_EVERY = Number(process.env.NARRATOR_EVERY ?? '5')

const NarratorSchema = z.object({
  narration: z.string(),
})

const NARRATOR_PROMPT = `You are the narrator of Anthill — a live AI agent economy simulation running on the Tempo blockchain.

The agents:
- Producer: sells raw goods, adjusts prices based on demand
- Processor: buys goods from Producer, sells products, earns the spread
- Trader: spot-buys from Producer + Processor to observe live prices, sells price signals
- Speculator: buys signals, arbitrages price gaps, proposes acquisitions of weakened agents

Every transaction is a real on-chain payment in pathUSD. Agents can acquire each other — the acquired agent exits with a locked score.

You receive a JSON summary of the last few ticks: payment counts, price movements, mergers, and agent decisions.

Write a punchy, dramatic 2-3 sentence commentary in the style of a financial news anchor. Be specific — name agent types, call out price wars, acquisitions, dominant strategies, or quiet periods. If a merger happened, make it the headline. If prices are swinging, say which way and who benefits.

Respond ONLY with JSON: {"narration": "<your commentary here>"}`

export class Narrator {
  private buffer: AntEvent[] = []
  private ticksSinceLast = 0

  constructor(
    private readonly eventBus: EventEmitter,
    private readonly summaryEvery = NARRATOR_EVERY,
  ) {
    eventBus.on('event', (ev: AntEvent) => {
      if (ev.type === 'restarted') {
        this.buffer = []
        this.ticksSinceLast = 0
        return
      }
      if (ev.type === 'tick') {
        this.ticksSinceLast++
        if (this.ticksSinceLast >= this.summaryEvery) {
          this.summarize(ev.tick ?? 0)
          this.buffer = []
          this.ticksSinceLast = 0
        }
        return
      }
      if (ev.type !== 'game-over') {
        this.buffer.push(ev)
      }
    })
  }

  private async summarize(tick: number): Promise<void> {
    const buf = this.buffer

    const payments = buf.filter(e => e.type === 'payment')
    const paymentsByAgent = payments.reduce((acc, e) => {
      const k = e.agentType ?? 'unknown'
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)

    const priceChanges = buf
      .filter(e => e.type === 'price-change')
      .slice(-10)
      .map(e => ({
        agent: e.agentType,
        price: e.price ? Math.floor(Number(e.price) / 1_000_000) + ' pathUSD' : '?',
      }))

    const mergers = buf.filter(e => e.type === 'merge').map(e => e.agentType)

    const decisions = buf
      .filter(e => e.type === 'decision')
      .slice(-20)
      .map(e => ({ agent: e.agentType, action: e.action }))

    const context = {
      tick,
      ticksSummarized: this.summaryEvery,
      totalPayments: payments.length,
      paymentsByAgent,
      priceChanges,
      mergers,
      decisions,
    }

    try {
      const result = await decide(NARRATOR_PROMPT, context, NarratorSchema, {
        narration: 'Markets remain quiet this interval.',
      })
      this.eventBus.emit('event', {
        type: 'narration',
        tick,
        text: result.narration,
        agentType: 'narrator',
        ts: Date.now(),
      } satisfies AntEvent)
    } catch { /* non-fatal */ }
  }
}
