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
  protected evaluateMergeOffer(amount: string): boolean {
    return BigInt(amount) > this.currentPrice * 2n
  }

  constructor(config: AgentConfig) {
    super(config, INITIAL_GOODS_PRICE)
    this.strategy = getRandomStrategy('producer')
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
    let goodsBid = '0'
    const registryUrl = this.config.registryUrl
    if (registryUrl) {
      try {
        const agents = await (await fetch(`${registryUrl}/agents`)).json() as Array<{ type: string; url: string }>
        const market = agents.find(a => a.type === 'market')
        if (market) {
          const prices = await (await fetch(`${market.url}/prices`)).json() as { goodsBid: string }
          goodsBid = prices.goodsBid
        }
      } catch { /* non-fatal */ }
    }

    const action = await decide<ProducerAction>(
      this.strategy.prompt,
      {
        currentPrice: this.currentPrice.toString(),
        requestsThisTick: this.requestsThisTick,
        goodsBid,
        balance: this.status().balance,
      },
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
