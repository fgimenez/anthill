import { z } from 'zod'
import { AgentBase, AgentConfig, decide } from './base.js'
import { getRandomStrategy } from './prompts.js'
import { INITIAL_GOODS_PRICE, MIN_PRICE } from '../constants.js'

export const ProducerActionSchema = z.object({
  action: z.enum(['raise_price', 'lower_price', 'hold', 'sell_to_market']),
  reasoning: z.string().optional(),
})
type ProducerAction = z.infer<typeof ProducerActionSchema>

export class ProducerAgent extends AgentBase {
  private readonly strategy = getRandomStrategy('producer')

  protected evaluateMergeOffer(amount: string): boolean {
    return BigInt(amount) > this.currentPrice * 2n
  }

  constructor(config: AgentConfig) {
    super(config, INITIAL_GOODS_PRICE)
    console.log(`[producer] strategy: ${this.strategy.name}`)
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
      this.strategy.prompt,
      { currentPrice: this.currentPrice.toString(), requestsThisTick: this.requestsThisTick },
      ProducerActionSchema,
      { action: 'hold' },
    )
    this.emitDecision(action.action)
    if (action.action === 'raise_price') {
      this.currentPrice = this.currentPrice * 105n / 100n
      this.emitPriceChange()
    } else if (action.action === 'lower_price') {
      const lowered = this.currentPrice * 95n / 100n
      this.currentPrice = lowered < MIN_PRICE ? MIN_PRICE : lowered
      this.emitPriceChange()
    }
  }
}
