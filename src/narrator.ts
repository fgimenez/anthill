import { EventEmitter } from 'node:events'
import { z } from 'zod'
import { decide } from './agents/base.js'
import type { AntEvent } from './dashboard/events.js'

const NARRATOR_EVERY = Number(process.env.NARRATOR_EVERY ?? '5')

const NarratorSchema = z.object({
  narration: z.string(),
})

const NARRATOR_PROMPT = `You are the narrator of Anthill — a live AI agent economy simulation running on the Tempo blockchain.

The simulation has these named agents:
- producer_1, producer_2: sell raw goods, compete on price
- processor_1, processor_2: buy goods from producers, sell products, earn the spread
- trader: spot-buys from producers + processors, packages price signals
- speculator: buys signals, arbitrages gaps, proposes acquisitions of weakened agents

Every transaction is a real on-chain payment in pathUSD. Agents can acquire each other — the acquired agent exits with a locked score.

You receive a JSON summary of the last few ticks: payment counts, price movements, mergers, and agent decisions — each tagged with the agent's label (e.g. producer_1, processor_2).

Write a punchy, dramatic 2-3 sentence commentary in the style of a financial news anchor. Be specific — use the exact agent labels (producer_1, processor_2 etc.), call out price wars, acquisitions, dominant strategies, or quiet periods. If a merger happened, make it the headline. If prices are swinging, say which way and who benefits.

Respond ONLY with JSON: {"narration": "<your commentary here>"}`

const FINAL_VERDICT_PROMPT = `You are the narrator of Anthill — a live AI agent economy simulation.

The game has ended. You are writing the FINAL VERDICT: a dramatic 3-4 sentence closing statement in the style of a financial news anchor signing off.

Name the winner by their exact label (e.g. producer_1, processor_2). State why they won (last standing or highest balance at game end). Reference any notable events — mergers, price wars, agents that went bust. Make it feel historic.

Respond ONLY with JSON: {"narration": "<your final verdict here>"}`

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
      if (ev.type === 'winner') {
        this.finalVerdict(ev)
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
      const k = e.agentLabel ?? e.agentType ?? 'unknown'
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)

    const priceChanges = buf
      .filter(e => e.type === 'price-change')
      .slice(-10)
      .map(e => ({
        agent: e.agentLabel ?? e.agentType,
        price: e.price ? Math.floor(Number(e.price) / 1_000_000) + ' pathUSD' : '?',
      }))

    const mergers = buf.filter(e => e.type === 'merge').map(e => e.agentLabel ?? e.agentType)

    const decisions = buf
      .filter(e => e.type === 'decision')
      .slice(-20)
      .map(e => ({ agent: e.agentLabel ?? e.agentType, action: e.action }))

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

  private async finalVerdict(ev: AntEvent): Promise<void> {
    const buf = this.buffer
    const context = {
      winnerLabel: ev.winnerLabel,
      winnerBalance: Math.floor(Number(ev.winnerBalance ?? 0)) + ' pathUSD',
      winReason: ev.winReason === 'last-standing' ? 'last agent standing' : 'highest balance at tick limit',
      tick: ev.tick,
      mergers: buf.filter(e => e.type === 'merge').map(e => e.agentLabel ?? e.agentType),
      totalPayments: buf.filter(e => e.type === 'payment').length,
      recentPriceChanges: buf
        .filter(e => e.type === 'price-change')
        .slice(-6)
        .map(e => ({ agent: e.agentLabel ?? e.agentType, price: Math.floor(Number(e.price ?? 0) / 1_000_000) + ' pathUSD' })),
    }
    try {
      const result = await decide(FINAL_VERDICT_PROMPT, context, NarratorSchema, {
        narration: `${ev.winnerLabel ?? 'An agent'} wins the simulation.`,
      })
      this.eventBus.emit('event', {
        type: 'narration',
        tick: ev.tick,
        text: '🏆 FINAL VERDICT — ' + result.narration,
        agentType: 'narrator',
        ts: Date.now(),
      } satisfies AntEvent)
    } catch { /* non-fatal */ }
  }
}
