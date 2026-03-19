import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { Mppx } from 'mppx/express'
import { tempo } from 'mppx/server'
import { Mppx as MppxClient, tempo as tempoClient } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'
import { MIN_PRICE, PATHUSD, PATHUSD_DECIMALS, MPP_SECRET_KEY } from '../constants.js'
import type { AgentType } from '../registry/index.js'

export async function decide<T>(
  systemPrompt: string,
  context: object,
  schema: z.ZodType<T>,
  mockDefault: T,
): Promise<T> {
  if (process.env.MOCK_LLM === 'true') return mockDefault
  const client = new Anthropic()
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: systemPrompt + '\n\nRespond ONLY with valid JSON matching the required schema. No prose.',
    messages: [{ role: 'user', content: JSON.stringify(context) }],
  })
  const text = (msg.content[0] as { type: 'text'; text: string }).text
  try {
    return schema.parse(JSON.parse(text))
  } catch {
    return mockDefault
  }
}

export { adjustPrice }

export interface AgentConfig {
  type: AgentType
  port: number
  privateKey: `0x${string}`
  tickIntervalMs: number
}

export abstract class AgentBase {
  readonly app: ReturnType<typeof express>
  protected readonly address: `0x${string}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected readonly mppx: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected readonly mppxClient: any
  protected currentPrice: bigint
  protected requestsThisTick = 0
  protected txCount = 0
  protected lastTx?: string

  constructor(protected config: AgentConfig, initialPrice: bigint) {
    const account = privateKeyToAccount(config.privateKey)
    this.address = account.address
    this.currentPrice = initialPrice

    this.mppx = Mppx.create({
      methods: [tempo.charge()],
      secretKey: MPP_SECRET_KEY,
    })

    this.mppxClient = MppxClient.create({
      methods: [tempoClient.charge({ account })],
      polyfill: false,
    })

    this.app = express()
    this.app.use(express.json())
    this.app.get('/status', (_req, res) => res.json(this.status()))
    this.setup()
  }

  // Returns an Express middleware that issues a 402 challenge at the current price
  protected charged(description: string) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.mppx.charge({
        amount: this.currentPrice.toString(),
        currency: PATHUSD,
        decimals: PATHUSD_DECIMALS,
        recipient: this.address,
        description,
      })(req, res, next)
    }
  }

  protected async mppFetch(url: string): Promise<Response> {
    return this.mppxClient.fetch(url)
  }

  protected abstract setup(): void
  protected abstract tick(): Promise<void>

  status() {
    return {
      type: this.config.type,
      address: this.address,
      txCount: this.txCount,
      lastTx: this.lastTx,
      currentPrice: this.currentPrice.toString(),
      active: true,
    }
  }

  start() {
    this.app.listen(this.config.port, () => {
      console.log(`[${this.config.type}] :${this.config.port} wallet:${this.address}`)
    })
    setInterval(async () => {
      try { await this.tick() } catch (e) { /* swallow tick errors */ }
      this.requestsThisTick = 0
    }, this.config.tickIntervalMs)
  }
}

function adjustPrice(current: bigint, requestsThisTick: number): bigint {
  if (requestsThisTick > 2) return current * 105n / 100n
  if (requestsThisTick === 0) return current * 95n / 100n < MIN_PRICE ? MIN_PRICE : current * 95n / 100n
  return current
}
