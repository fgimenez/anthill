import { z } from 'zod'
import { AgentBase, AgentConfig, decide } from './base.js'
import { getRandomStrategy } from './prompts.js'
import { INITIAL_GOODS_PRICE } from '../constants.js'

export const SpeculatorActionSchema = z.object({
  action: z.enum(['arbitrage', 'propose_merger', 'skip']),
  target_url: z.string().nullish(),
  reasoning: z.string().nullish(),
})
type SpeculatorAction = z.infer<typeof SpeculatorActionSchema>

export class SpeculatorAgent extends AgentBase {
  constructor(config: AgentConfig) {
    super(config, 0n)
    this.strategy = getRandomStrategy('speculator')
    console.log(`[speculator] strategy: ${this.strategy.name}`)
  }

  protected setup() {
    // Speculator has no sold service — it only buys
  }

  protected async tick() {
    const signal = await this.fetchSignal()
    const agents = await this.fetchAgents()

    const action = await decide<SpeculatorAction>(
      this.strategy.prompt,
      { signal, agents, currentBalance: this.txCount },
      SpeculatorActionSchema,
      { action: 'skip' },
    )

    this.emitDecision(action.action)
    if (action.action === 'arbitrage') {
      await this.doArbitrage(agents)
    } else if (action.action === 'propose_merger' && action.target_url) {
      await this.proposeMerger(action.target_url)
    }
  }

  private async fetchSignal(): Promise<unknown> {
    const registryUrl = this.config.registryUrl
    if (!registryUrl) return null
    try {
      const agents = await (await fetch(`${registryUrl}/agents`)).json() as Array<{ type: string; url: string }>
      const trader = agents.find(a => a.type === 'trader')
      if (!trader) return null
      const res = await this.mppFetch(`${trader.url}/signal`)
      return res.json()
    } catch { return null }
  }

  private async fetchAgents(): Promise<Array<{ type: string; url: string; address: string }>> {
    const registryUrl = this.config.registryUrl
    if (!registryUrl) return []
    try {
      return (await (await fetch(`${registryUrl}/agents`)).json()) as Array<{ type: string; url: string; address: string }>
    } catch { return [] }
  }

  private async doArbitrage(agents: Array<{ type: string; url: string }>): Promise<void> {
    const producer = agents.find(a => a.type === 'producer')
    const market = agents.find(a => a.type === 'market')
    if (!producer || !market) return
    try {
      await this.mppFetch(`${producer.url}/produce`)
      await this.mppFetch(`${market.url}/buy-order`)
    } catch { /* non-fatal */ }
  }

  private async proposeMerger(targetUrl: string): Promise<void> {
    try {
      // Fetch target's current price to make a realistic offer (3× current price)
      let offerAmount = INITIAL_GOODS_PRICE * 3n
      try {
        const status = await (await fetch(`${targetUrl}/status`)).json() as { currentPrice?: string }
        if (status.currentPrice) offerAmount = BigInt(status.currentPrice) * 3n
      } catch { /* use default */ }
      await this.mppFetch(`${targetUrl}/merge-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: offerAmount.toString() }),
      })
    } catch { /* non-fatal */ }
  }
}
