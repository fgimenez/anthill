import { z } from 'zod'
import { AgentBase, AgentConfig, decide } from './base.js'
import { INITIAL_SIGNAL_PRICE, MIN_PRICE } from '../constants.js'

export const TraderActionSchema = z.object({
  action: z.enum(['buy_spot_and_signal', 'skip', 'raise_price', 'lower_price']),
  reasoning: z.string().optional(),
})
type TraderAction = z.infer<typeof TraderActionSchema>

const TRADER_PROMPT = `You are a Trader agent in an emergent economy simulation.
You observe prices by spot-buying from Producers and Processors, then sell price signals via GET /signal.
Your goal is to maximize pathUSD earnings by selling timely, accurate market intelligence.

Each tick you receive your current state and must respond with a JSON action.
Available actions:
- "buy_spot_and_signal": buy spot from available agents to update your signal (costs pathUSD, earns from signal sales)
- "skip": do nothing this tick (when you lack capital or demand is low)
- "raise_price": increase your signal price by ~5%
- "lower_price": decrease your signal price by ~5%

Respond ONLY with JSON: {"action": "<action>", "reasoning": "<brief reason>"}`

interface PriceSignal {
  goodsPrice: string
  productsPrice: string
  spread: string
  observedAt: string
}

export class TraderAgent extends AgentBase {
  private latestSignal: PriceSignal | null = null

  constructor(config: AgentConfig) {
    super(config, INITIAL_SIGNAL_PRICE)
  }

  protected setup() {
    this.app.get('/signal', this.charged('Buy price signal'), (_req, res) => {
      this.requestsThisTick++
      this.txCount++
      res.json(this.latestSignal ?? { goodsPrice: '0', productsPrice: '0', spread: '0', observedAt: new Date().toISOString() })
    })
  }

  protected async tick() {
    const action = await decide<TraderAction>(
      TRADER_PROMPT,
      {
        currentPrice: this.currentPrice.toString(),
        requestsThisTick: this.requestsThisTick,
        hasSignal: this.latestSignal !== null,
        signalAge: this.latestSignal
          ? Math.floor((Date.now() - new Date(this.latestSignal.observedAt).getTime()) / 1000)
          : null,
      },
      TraderActionSchema,
      { action: 'skip' },
    )

    await this.tickWithAction(action.action)
  }

  async tickWithAction(action: string): Promise<void> {
    if (action === 'raise_price') {
      this.currentPrice = this.currentPrice * 105n / 100n
    } else if (action === 'lower_price') {
      const lowered = this.currentPrice * 95n / 100n
      this.currentPrice = lowered < MIN_PRICE ? MIN_PRICE : lowered
    } else if (action === 'buy_spot_and_signal') {
      await this.buySpotAndBuildSignal()
    }
  }

  private async buySpotAndBuildSignal(): Promise<void> {
    const registryUrl = this.config.registryUrl
    if (!registryUrl) return
    try {
      const agentsRes = await fetch(`${registryUrl}/agents`)
      const agents = await agentsRes.json() as Array<{ type: string; url: string }>
      const producer = agents.find(a => a.type === 'producer')
      const processor = agents.find(a => a.type === 'processor')

      let goodsPrice = '0'
      let productsPrice = '0'

      if (producer) {
        const res = await this.mppFetch(`${producer.url}/produce`)
        const body = await res.json() as { price?: string }
        goodsPrice = body.price ?? '0'
        this.txCount++
      }
      if (processor) {
        const res = await this.mppFetch(`${processor.url}/process`)
        const body = await res.json() as { price?: string }
        productsPrice = body.price ?? '0'
        this.txCount++
      }

      const spread = (BigInt(productsPrice) - BigInt(goodsPrice)).toString()
      this.latestSignal = { goodsPrice, productsPrice, spread, observedAt: new Date().toISOString() }
    } catch { /* non-fatal */ }
  }
}
