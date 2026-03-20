import { z } from 'zod'
import { AgentBase, AgentConfig, decide } from './base.js'
import { getRandomStrategy } from './prompts.js'
import { INITIAL_PRODUCTS_PRICE, MIN_PRICE } from '../constants.js'

export { isMarginPositive }

export const ProcessorActionSchema = z.object({
  action: z.enum(['buy_goods_and_sell', 'skip', 'raise_price', 'lower_price']),
  reasoning: z.string().optional(),
})
type ProcessorAction = z.infer<typeof ProcessorActionSchema>

export class ProcessorAgent extends AgentBase {
  private marketUrl?: string

  protected evaluateMergeOffer(amount: string): boolean {
    return BigInt(amount) > this.currentPrice * 3n
  }

  constructor(config: AgentConfig, marketUrl?: string) {
    super(config, INITIAL_PRODUCTS_PRICE)
    this.marketUrl = marketUrl
    this.strategy = getRandomStrategy('processor')
    console.log(`[processor] strategy: ${this.strategy.name}`)
  }

  protected setup() {
    this.app.get('/process', this.charged('Buy processed products'), (_req, res) => {
      this.requestsThisTick++
      this.txCount++
      res.json({ product: 1, price: this.currentPrice.toString() })
    })
  }

  protected async tick() {
    let goodsBid = '0'
    let productsBid = '0'
    if (this.marketUrl) {
      try {
        const pricesRes = await fetch(`${this.marketUrl}/prices`)
        const prices = await pricesRes.json() as { goodsBid: string; productsBid: string }
        goodsBid = prices.goodsBid
        productsBid = prices.productsBid
      } catch { /* non-fatal */ }
    }

    const action = await decide<ProcessorAction>(
      this.strategy.prompt,
      {
        currentPrice: this.currentPrice.toString(),
        requestsThisTick: this.requestsThisTick,
        goodsBid,
        productsBid,
        marketUrl: this.marketUrl ?? null,
      },
      ProcessorActionSchema,
      { action: 'skip' },
    )

    await this.tickWithAction(action.action)
  }

  async tickWithAction(action: string): Promise<void> {
    this.emitDecision(action)
    if (action === 'raise_price') {
      this.currentPrice = this.currentPrice * 105n / 100n
      this.emitPriceChange()
    } else if (action === 'lower_price') {
      const lowered = this.currentPrice * 95n / 100n
      this.currentPrice = lowered < MIN_PRICE ? MIN_PRICE : lowered
      this.emitPriceChange()
    } else if (action === 'buy_goods_and_sell') {
      await this.buyGoodsAndSell()
    }
  }

  private async buyGoodsAndSell(): Promise<void> {
    const registryUrl = this.config.registryUrl
    if (!registryUrl) return
    try {
      const agentsRes = await fetch(`${registryUrl}/agents`)
      const agents = await agentsRes.json() as Array<{ type: string; url: string }>
      const producer = agents.find(a => a.type === 'producer')
      if (!producer) return
      await this.mppFetch(`${producer.url}/produce`)
      if (this.marketUrl) {
        await this.mppFetch(`${this.marketUrl}/buy-order`)
      }
    } catch { /* non-fatal */ }
  }
}

function isMarginPositive(productsBid: bigint, goodsPrice: bigint, threshold: bigint): boolean {
  return productsBid - goodsPrice > threshold
}
