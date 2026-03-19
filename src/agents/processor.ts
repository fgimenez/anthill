import { z } from 'zod'
import { AgentBase, AgentConfig, decide } from './base.js'
import { INITIAL_PRODUCTS_PRICE, MIN_PRICE } from '../constants.js'

export { isMarginPositive }

export const ProcessorActionSchema = z.object({
  action: z.enum(['buy_goods_and_sell', 'skip', 'raise_price', 'lower_price']),
  reasoning: z.string().optional(),
})
type ProcessorAction = z.infer<typeof ProcessorActionSchema>

const PROCESSOR_PROMPT = `You are a Processor agent in an emergent economy simulation.
You buy raw goods from Producers and sell processed products via GET /process.
Your goal is to maximize pathUSD earnings. You only profit when: productsBid - goodsPrice > threshold.

Each tick you receive your current state and must respond with a JSON action.
Available actions:
- "buy_goods_and_sell": buy goods from a Producer, sell products to Market (only if margin is positive)
- "skip": do nothing this tick (when margin is negative or uncertain)
- "raise_price": increase your product price by ~5%
- "lower_price": decrease your product price by ~5%

Respond ONLY with JSON: {"action": "<action>", "reasoning": "<brief reason>"}`

export class ProcessorAgent extends AgentBase {
  private marketUrl?: string

  protected evaluateMergeOffer(amount: string): boolean {
    // Accept only premium offers (> 3× current price)
    return BigInt(amount) > this.currentPrice * 3n
  }

  constructor(config: AgentConfig, marketUrl?: string) {
    super(config, INITIAL_PRODUCTS_PRICE)
    this.marketUrl = marketUrl
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
      PROCESSOR_PROMPT,
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
      this.txCount++
      if (this.marketUrl) {
        await this.mppFetch(`${this.marketUrl}/buy-order`)
        this.txCount++
      }
    } catch { /* non-fatal */ }
  }
}

function isMarginPositive(productsBid: bigint, goodsPrice: bigint, threshold: bigint): boolean {
  return productsBid - goodsPrice > threshold
}
