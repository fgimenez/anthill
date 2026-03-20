import { z } from 'zod'
import { AgentBase, AgentConfig, decide, cheapest } from './base.js'
import { getRandomStrategy } from './prompts.js'
import { INITIAL_PRODUCTS_PRICE, MIN_PRICE } from '../constants.js'

export { isMarginPositive }

export const ProcessorActionSchema = z.object({
  action: z.enum(['buy_goods_and_sell', 'skip', 'raise_price', 'lower_price']),
  producer_url: z.string().nullish(),
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

    // Fetch producers with current prices so LLM can pick the best one
    let producers: Array<{ url: string; price: string }> = []
    const registryUrl = this.config.registryUrl
    if (registryUrl) {
      try {
        const agents = await (await fetch(`${registryUrl}/agents`)).json() as Array<{ type: string; url: string }>
        producers = await Promise.all(
          agents.filter(a => a.type === 'producer').map(async a => {
            try {
              const s = await (await fetch(`${a.url}/status`)).json() as { currentPrice?: string }
              return { url: a.url, price: s.currentPrice ?? '999999999999' }
            } catch { return { url: a.url, price: '999999999999' } }
          })
        )
      } catch { /* non-fatal */ }
    }

    const action = await decide<ProcessorAction>(
      this.strategy.prompt,
      {
        currentPrice: this.currentPrice.toString(),
        requestsThisTick: this.requestsThisTick,
        goodsBid,
        productsBid,
        producers,
      },
      ProcessorActionSchema,
      { action: 'skip' },
    )

    await this.tickWithAction(action.action, action.producer_url ?? undefined)
  }

  async tickWithAction(action: string, producerUrl?: string): Promise<void> {
    this.emitDecision(action)
    if (action === 'raise_price') {
      this.currentPrice = this.currentPrice * 105n / 100n
      this.emitPriceChange()
    } else if (action === 'lower_price') {
      const lowered = this.currentPrice * 95n / 100n
      this.currentPrice = lowered < MIN_PRICE ? MIN_PRICE : lowered
      this.emitPriceChange()
    } else if (action === 'buy_goods_and_sell') {
      await this.buyGoodsAndSell(producerUrl)
    }
  }

  private async buyGoodsAndSell(producerUrl?: string): Promise<void> {
    const registryUrl = this.config.registryUrl
    if (!registryUrl) return
    try {
      let url = producerUrl
      if (!url) {
        const agents = await (await fetch(`${registryUrl}/agents`)).json() as Array<{ type: string; url: string }>
        const producer = await cheapest(agents, 'producer')
        if (!producer) return
        url = producer.url
      }
      await this.mppFetch(`${url}/produce`)
      if (this.marketUrl) {
        await this.mppFetch(`${this.marketUrl}/buy-order`)
      }
    } catch { /* non-fatal */ }
  }
}

function isMarginPositive(productsBid: bigint, goodsPrice: bigint, threshold: bigint): boolean {
  return productsBid - goodsPrice > threshold
}
