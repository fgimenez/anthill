import { z } from 'zod'
import { AgentBase, AgentConfig, decide } from './base.js'
import { INITIAL_GOODS_PRICE, MIN_PRICE } from '../constants.js'

export const ProducerActionSchema = z.object({
  action: z.enum(['raise_price', 'lower_price', 'hold', 'sell_to_market']),
  reasoning: z.string().optional(),
})
type ProducerAction = z.infer<typeof ProducerActionSchema>

const PRODUCER_PROMPT = `You are a Producer agent in an emergent economy simulation.
You sell raw goods via GET /produce. Your goal is to maximize pathUSD earnings over time.

Each tick you receive your current state and must respond with a JSON action.
Available actions:
- "raise_price": increase your price by ~5% (do this when demand is high)
- "lower_price": decrease your price by ~5% (do this when demand is low and you need buyers)
- "hold": keep price unchanged
- "sell_to_market": signal willingness to sell directly to market at current price

Respond ONLY with JSON: {"action": "<action>", "reasoning": "<brief reason>"}`

export class ProducerAgent extends AgentBase {
  constructor(config: AgentConfig) {
    super(config, INITIAL_GOODS_PRICE)
  }

  protected setup() {
    this.app.get('/produce', this.charged('Buy raw goods'), (_req, res) => {
      this.requestsThisTick++
      this.txCount++
      res.json({ goods: 1, price: this.currentPrice.toString() })
    })
  }

  protected async tick() {
    const action = await decide<ProducerAction>(
      PRODUCER_PROMPT,
      { currentPrice: this.currentPrice.toString(), requestsThisTick: this.requestsThisTick },
      ProducerActionSchema,
      { action: 'hold' },
    )
    if (action.action === 'raise_price') {
      this.currentPrice = this.currentPrice * 105n / 100n
    } else if (action.action === 'lower_price') {
      const lowered = this.currentPrice * 95n / 100n
      this.currentPrice = lowered < MIN_PRICE ? MIN_PRICE : lowered
    }
  }
}
