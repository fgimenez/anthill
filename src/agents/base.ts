import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { Mppx } from 'mppx/express'
import { tempo } from 'mppx/server'
import { Mppx as MppxClient, tempo as tempoClient } from 'mppx/client'
import { createClient, custom, http } from 'viem'
import { tempoModerato } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { EventEmitter } from 'node:events'
import { MIN_PRICE, PATHUSD, MPP_SECRET_KEY, FEE_PAYER_URL, RPC_URL } from '../constants.js'
import type { AgentType } from '../registry/index.js'

export async function decide<T>(
  systemPrompt: string,
  context: object,
  schema: z.ZodType<T>,
  mockDefault: T,
): Promise<T> {
  if (process.env.MOCK_LLM === 'true') return mockDefault
  try {
    const client = new Anthropic()
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: systemPrompt + '\n\nRespond ONLY with valid JSON matching the required schema. No prose.',
      messages: [{ role: 'user', content: JSON.stringify(context) }],
    })
    const text = (msg.content[0] as { type: 'text'; text: string }).text
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`no JSON object in response: ${text.slice(0, 80)}`)
    return schema.parse(JSON.parse(match[0]))
  } catch (e) {
    console.warn(`[decide] fallback to default — ${(e as Error).message?.slice(0, 100)}`)
    return mockDefault
  }
}

export { adjustPrice }

export interface AgentConfig {
  type: AgentType
  port: number
  privateKey: `0x${string}`
  tickIntervalMs: number
  registryUrl?: string
  eventBus?: EventEmitter
}

export abstract class AgentBase {
  readonly app: ReturnType<typeof express>
  protected readonly address: `0x${string}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected readonly mppx: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected readonly mppxClient: any
  protected readonly eventBus: EventEmitter
  protected currentPrice: bigint
  protected readonly initialPrice: bigint
  protected strategy: { name: string; prompt: string } = { name: 'default', prompt: '' }
  protected requestsThisTick = 0
  protected txCount = 0
  protected lastTx?: string
  protected active = true
  private _paused = false
  private tickInterval?: ReturnType<typeof setInterval>
  private cachedBalance = '0'
  private lastOnChainRaw = 0n    // last confirmed on-chain balance in base units
  private pendingReceived = 0n   // received but not yet confirmed on-chain (base units)

  constructor(protected config: AgentConfig, initialPrice: bigint) {
    const account = privateKeyToAccount(config.privateKey)
    this.address = account.address
    this.currentPrice = initialPrice
    this.initialPrice = initialPrice
    this.eventBus = config.eventBus ?? new EventEmitter()

    // Server-side client: routes send-tx methods to the fee payer relay (which co-signs
    // and broadcasts type-0x76 txs with feePayerSignature=null), all else to RPC.
    const getServerClient = () => createClient({
      chain: tempoModerato,
      transport: custom<any>({
        async request({ method, params }: { method: string; params?: unknown[] }) {
          if (method === 'eth_sendRawTransactionSync' || method === 'eth_sendRawTransaction') {
            const res = await fetch(FEE_PAYER_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
            })
            const json = await res.json() as { result: unknown; error?: { message: string } }
            if (json.error) throw new Error(json.error.message)
            return json.result
          }
          const res = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
          })
          const json = await res.json() as { result: unknown; error?: { message: string } }
          if (json.error) throw new Error(json.error.message)
          return json.result
        },
      }),
    })

    this.mppx = Mppx.create({
      methods: [tempo.charge({
        testnet: true,
        feePayer: FEE_PAYER_URL,
        getClient: getServerClient,
      })],
      secretKey: MPP_SECRET_KEY,
    })

    // Custom client: intercepts eth_estimateGas so fee-payer tx prep doesn't fail.
    // Gas estimation charges gas to sender in pathUSD (24 gwei × ~40k gas ≈ 950M pathUSD),
    // but sender only has 1M pathUSD. Fee payer covers actual gas on-chain; we return a
    // fixed estimate here so prepareTransactionRequest can proceed.
    const getClientForCharge = () => createClient({
      chain: tempoModerato,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transport: custom<any>({
        async request({ method, params }: { method: string; params?: unknown }) {
          if (method === 'eth_estimateGas') return '0x50000'  // 327k gas; fee payer covers it
          for (let attempt = 0; attempt < 5; attempt++) {
            const res = await fetch(RPC_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
            })
            const json = await res.json() as { result: unknown; error?: { message: string } }
            if (!json.error) return json.result
            if (!json.error.message.includes('rate limit')) throw new Error(json.error.message)
            await new Promise(r => setTimeout(r, 100 * (attempt + 1)))
          }
          throw new Error('RPC rate-limited after retries')
        },
      }),
    })

    this.mppxClient = MppxClient.create({
      methods: [tempoClient.charge({ account, getClient: getClientForCharge })],
      polyfill: false,
    })

    this.app = express()
    this.app.use(express.json())
    this.app.use((_req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next() })
    this.app.get('/status', (_req, res) => res.json(this.status()))
    this.app.post('/merge-offer', this.charged('Merge offer evaluation'), (req, res) => {
      const amount = req.body?.amount ?? '0'
      const accept = this.evaluateMergeOffer(amount)
      res.json({ accept })
      if (accept) setImmediate(() => this.executeExit(amount).catch(() => {}))
    })
    this.setup()
  }

  // Returns an Express middleware that issues a 402 challenge at the current price
  protected charged(description: string) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const countingNext: express.NextFunction = (...args) => {
        this.txCount++
        // Immediately reflect received payment in balance (exact amount known here)
        this.pendingReceived += this.currentPrice
        this.cachedBalance = ((this.lastOnChainRaw + this.pendingReceived) / 1_000_000n).toString()
        next(...args)
      }
      this.mppx.charge({
        amount: this.currentPrice.toString(),
        currency: PATHUSD,
        decimals: 0,  // amount is already in base units (bigint); decimals=0 skips parseUnits scaling
        recipient: this.address,
        description,
      })(req, res, countingNext)
    }
  }

  protected async mppFetch(url: string, init?: RequestInit): Promise<Response> {
    try {
      const res = await this.mppxClient.fetch(url, init)
      this.txCount++
      const receipt = res.headers.get('Payment-Receipt')
      this.eventBus.emit('event', {
        type: 'payment',
        from: this.address,
        to: url,
        txHash: receipt ?? undefined,
        agentType: this.config.type,
        ts: Date.now(),
      })
      // Refresh balance async — we don't know exact amount charged, so re-read from chain
      this.refreshBalance().catch(() => {})
      return res
    } catch (e) {
      console.warn(`[mppFetch] ${this.config.type} → ${url.replace(/.*localhost:\d+/, '')} : ${(e as Error).message?.slice(0, 120)}`)
      throw e
    }
  }

  protected emitPriceChange() {
    this.eventBus.emit('event', {
      type: 'price-change',
      from: this.address,
      price: this.currentPrice.toString(),
      agentType: this.config.type,
      ts: Date.now(),
    })
  }

  protected emitDecision(action: string) {
    this.eventBus.emit('event', {
      type: 'decision',
      from: this.address,
      agentType: this.config.type,
      action,
      ts: Date.now(),
    })
  }

  async register(registryUrl: string, agentUrl: string): Promise<void> {
    await fetch(`${registryUrl}/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `${this.config.type}-${this.address}`,
        type: this.config.type,
        url: agentUrl,
        address: this.address,
      }),
    })
  }

  protected abstract setup(): void
  protected abstract tick(): Promise<void>

  get agentType() { return this.config.type }
  get port() { return this.config.port }

  setStrategy(s: { name: string; prompt: string }) { this.strategy = s }

  setPaused(v: boolean) { this._paused = v }

  reset() {
    this.active = true
    this._paused = false
    this.txCount = 0
    this.currentPrice = this.initialPrice
    this.requestsThisTick = 0
    this.lastOnChainRaw = 0n
    this.pendingReceived = 0n
    this.cachedBalance = '0'
    // Restart tick interval if it was cleared (e.g. after executeExit)
    if (!this.tickInterval) this.startTicking()
    this.refreshBalance().catch(() => {})
  }

  protected evaluateMergeOffer(_amount: string): boolean {
    return false  // default: reject; subclasses override
  }

  protected async executeExit(buyout: string): Promise<void> {
    this.active = false
    clearInterval(this.tickInterval)
    this.tickInterval = undefined
    const exitScore = buyout
    const id = `${this.config.type}-${this.address}`
    if (this.config.registryUrl) {
      await fetch(`${this.config.registryUrl}/agents/${encodeURIComponent(id)}/exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exitScore }),
      }).catch(() => {})
    }
    this.eventBus.emit('event', { type: 'merge', from: this.address, amount: buyout, agentType: this.config.type, ts: Date.now() })
    console.log(`[${this.config.type}] acquired — exit score: ${exitScore} pathUSD`)
  }

  status() {
    return {
      type: this.config.type,
      address: this.address,
      txCount: this.txCount,
      lastTx: this.lastTx,
      currentPrice: this.currentPrice.toString(),
      active: this.active,
      balance: this.cachedBalance,
      strategy: this.strategy.name,
    }
  }

  private startTicking() {
    this.tickInterval = setInterval(async () => {
      if (!this.active || this._paused) return
      try { await this.tick() } catch { /* swallow tick errors */ }
      this.requestsThisTick = 0
    }, this.config.tickIntervalMs)
  }

  async refreshBalance(): Promise<void> {
    try {
      const data = '0x70a08231' + this.address.slice(2).padStart(64, '0')
      const res = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'eth_call', params: [{ to: PATHUSD, data }, 'latest'] }),
      })
      const json = await res.json() as { result: string; error?: { message: string } }
      if (!json.result || json.error) return
      const onChain = BigInt(json.result)
      // If chain went up since last read, pending receives have been confirmed — clear them
      if (this.lastOnChainRaw > 0n && onChain > this.lastOnChainRaw) {
        const confirmed = onChain - this.lastOnChainRaw
        this.pendingReceived = this.pendingReceived > confirmed ? this.pendingReceived - confirmed : 0n
      }
      this.lastOnChainRaw = onChain
      // Display = on-chain + unconfirmed receives (senders' balance drops are chain-only)
      this.cachedBalance = ((onChain + this.pendingReceived) / 1_000_000n).toString()
    } catch { /* non-fatal */ }
  }

  private startBalancePolling() {
    this.refreshBalance()  // fetch immediately on start
    setInterval(() => this.refreshBalance(), 5_000)
  }

  start() {
    this.app.listen(this.config.port, () => {
      console.log(`[${this.config.type}] :${this.config.port} wallet:${this.address}`)
      if (this.config.registryUrl) {
        this.register(this.config.registryUrl, `http://localhost:${this.config.port}`)
          .catch(() => { /* non-fatal */ })
      }
    })
    this.startTicking()
    this.startBalancePolling()
  }
}

function adjustPrice(current: bigint, requestsThisTick: number): bigint {
  if (requestsThisTick > 2) return current * 105n / 100n
  if (requestsThisTick === 0) return current * 95n / 100n < MIN_PRICE ? MIN_PRICE : current * 95n / 100n
  return current
}
