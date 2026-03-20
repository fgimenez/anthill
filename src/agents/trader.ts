import { z } from 'zod'
import { AgentBase, AgentConfig, decide, cheapest } from './base.js'
import { getRandomStrategy } from './prompts.js'
import { INITIAL_SIGNAL_PRICE, MIN_PRICE } from '../constants.js'

export const TraderActionSchema = z.object({
  action: z.enum(['buy_spot_and_signal', 'skip', 'raise_price', 'lower_price']),
  producer_url: z.string().nullish(),
  processor_url: z.string().nullish(),
  reasoning: z.string().optional(),
})
type TraderAction = z.infer<typeof TraderActionSchema>

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
    this.strategy = getRandomStrategy('trader')
    console.log(`[trader] strategy: ${this.strategy.name}`)
  }

  protected setup() {
    this.app.get('/signal', this.charged('Buy price signal'), (_req, res) => {
      this.requestsThisTick++
      this.txCount++
      res.json(this.latestSignal ?? { goodsPrice: '0', productsPrice: '0', spread: '0', observedAt: new Date().toISOString() })
    })
  }

  protected async tick() {
    // Fetch producers and processors with current prices so LLM can pick the best
    let producers: Array<{ url: string; price: string }> = []
    let processors: Array<{ url: string; price: string }> = []
    const registryUrl = this.config.registryUrl
    if (registryUrl) {
      try {
        const agents = await (await fetch(`${registryUrl}/agents`)).json() as Array<{ type: string; url: string }>
        const fetchPrice = async (a: { type: string; url: string }) => {
          try {
            const s = await (await fetch(`${a.url}/status`)).json() as { currentPrice?: string }
            return { url: a.url, price: s.currentPrice ?? '999999999999' }
          } catch { return { url: a.url, price: '999999999999' } }
        }
        producers = await Promise.all(agents.filter(a => a.type === 'producer').map(fetchPrice))
        processors = await Promise.all(agents.filter(a => a.type === 'processor').map(fetchPrice))
      } catch { /* non-fatal */ }
    }

    const action = await decide<TraderAction>(
      this.strategy.prompt,
      {
        currentPrice: this.currentPrice.toString(),
        requestsThisTick: this.requestsThisTick,
        hasSignal: this.latestSignal !== null,
        signalAge: this.latestSignal
          ? Math.floor((Date.now() - new Date(this.latestSignal.observedAt).getTime()) / 1000)
          : null,
        producers,
        processors,
      },
      TraderActionSchema,
      { action: 'skip' },
    )

    await this.tickWithAction(action.action, action.producer_url ?? undefined, action.processor_url ?? undefined)
  }

  async tickWithAction(action: string, producerUrl?: string, processorUrl?: string): Promise<void> {
    this.emitDecision(action)
    if (action === 'raise_price') {
      this.currentPrice = this.currentPrice * 105n / 100n
      this.emitPriceChange()
    } else if (action === 'lower_price') {
      const lowered = this.currentPrice * 95n / 100n
      this.currentPrice = lowered < MIN_PRICE ? MIN_PRICE : lowered
      this.emitPriceChange()
    } else if (action === 'buy_spot_and_signal') {
      await this.buySpotAndBuildSignal(producerUrl, processorUrl)
    }
  }

  private async buySpotAndBuildSignal(producerUrl?: string, processorUrl?: string): Promise<void> {
    const registryUrl = this.config.registryUrl
    if (!registryUrl) return
    try {
      let pUrl = producerUrl
      let prUrl = processorUrl
      if (!pUrl || !prUrl) {
        const agents = await (await fetch(`${registryUrl}/agents`)).json() as Array<{ type: string; url: string }>
        if (!pUrl) pUrl = (await cheapest(agents, 'producer'))?.url
        if (!prUrl) prUrl = (await cheapest(agents, 'processor'))?.url
      }

      let goodsPrice = '0'
      let productsPrice = '0'

      if (pUrl) {
        const res = await this.mppFetch(`${pUrl}/produce`)
        const body = await res.json() as { price?: string }
        goodsPrice = body.price ?? '0'
      }
      if (prUrl) {
        const res = await this.mppFetch(`${prUrl}/process`)
        const body = await res.json() as { price?: string }
        productsPrice = body.price ?? '0'
      }

      const spread = (BigInt(productsPrice) - BigInt(goodsPrice)).toString()
      this.latestSignal = { goodsPrice, productsPrice, spread, observedAt: new Date().toISOString() }
    } catch { /* non-fatal */ }
  }
}
