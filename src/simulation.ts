import { EventEmitter } from 'node:events'
import chalk from 'chalk'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { RegistryServer } from './registry/server.js'
import { SimController } from './sim-controller.js'
import { MarketAgent } from './agents/market.js'
import { ProducerAgent } from './agents/producer.js'
import { ProcessorAgent } from './agents/processor.js'
import { TraderAgent } from './agents/trader.js'
import { SpeculatorAgent } from './agents/speculator.js'
import { getPathUSDBalance, fundAddress } from './bootstrap.js'
import { WIN_TICKS } from './constants.js'
import { Narrator } from './narrator.js'
import type { AgentBase } from './agents/base.js'

const TICK = Number(process.env.TICK_INTERVAL_MS ?? 10000)
const FUND_THRESHOLD = 100_000_000_000n  // 100,000 pathUSD

export class Simulation {
  readonly id: string
  readonly basePort: number
  readonly eventBus: EventEmitter
  readonly controller: SimController
  readonly registryServer: RegistryServer
  readonly agents: AgentBase[]
  private readonly privateKeys: `0x${string}`[]

  constructor(id: string, basePort: number) {
    this.id = id
    this.basePort = basePort
    this.eventBus = new EventEmitter()

    const registryPort = basePort
    const registryUrl = `http://localhost:${registryPort}`
    const marketUrl = `http://localhost:${basePort + 1}`

    this.privateKeys = Array.from({ length: 7 }, () => generatePrivateKey())
    const pk = (i: number) => this.privateKeys[i]

    const base = (type: string, label: string, offset: number, i: number) => ({
      type: type as never,
      label,
      port: basePort + offset,
      privateKey: pk(i),
      tickIntervalMs: TICK,
      registryUrl,
      eventBus: this.eventBus,
    })

    this.registryServer = new RegistryServer()
    this.controller = new SimController(
      WIN_TICKS,
      this.eventBus,
      () => this.refundWallets(),
    )

    new Narrator(this.eventBus)

    this.agents = [
      new MarketAgent    (base('market',     'market',      1, 0)),
      new ProducerAgent  (base('producer',   'producer_1',  2, 1)),
      new ProducerAgent  (base('producer',   'producer_2',  3, 2)),
      new ProcessorAgent (base('processor',  'processor_1', 4, 3), marketUrl),
      new ProcessorAgent (base('processor',  'processor_2', 5, 4), marketUrl),
      new TraderAgent    (base('trader',     'trader',      6, 5)),
      new SpeculatorAgent(base('speculator', 'speculator',  7, 6)),
    ]
    for (const a of this.agents) this.controller.register(a)
  }

  async start(): Promise<void> {
    console.log(chalk.bold(`\n🐜 [${this.id}] starting simulation\n`))
    await this.refundWallets()

    await new Promise<void>(resolve => {
      this.registryServer.app.listen(this.basePort, () => {
        console.log(chalk.cyan(`[${this.id}] registry :${this.basePort}`))
        resolve()
      })
    })

    for (const agent of this.agents) {
      agent.start()
      console.log(chalk.dim(`[${this.id}] ${agent.agentType.padEnd(10)} :${agent.port}  ${agent.status().address}`))
    }

    this.controller.start(TICK)
    console.log()
  }

  async refundWallets(): Promise<void> {
    if (process.env.SKIP_FUNDING === 'true') return
    for (const pk of this.privateKeys) {
      const { address } = privateKeyToAccount(pk)
      try {
        const balance = await getPathUSDBalance(address)
        if (balance < FUND_THRESHOLD) {
          process.stdout.write(`[${this.id}] funding ${address} … `)
          await fundAddress(address)
          console.log('✓ 1,000,000 pathUSD')
        }
      } catch (e) {
        console.warn(`[${this.id}] could not fund ${address}: ${(e as Error).message}`)
      }
    }
  }

  get registryPort() { return this.basePort }

  get portRange(): { start: number; end: number } {
    return { start: this.basePort, end: this.basePort + 7 }
  }
}
