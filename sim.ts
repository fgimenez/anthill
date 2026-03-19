import 'dotenv/config'
import chalk from 'chalk'
import { RegistryServer } from './src/registry/server.js'
import { DashboardServer } from './src/dashboard/server.js'
import { MarketAgent } from './src/agents/market.js'
import { ProducerAgent } from './src/agents/producer.js'
import { ProcessorAgent } from './src/agents/processor.js'
import { TraderAgent } from './src/agents/trader.js'
import { SpeculatorAgent } from './src/agents/speculator.js'

const required = (name: string) => {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v as `0x${string}`
}

const TICK = Number(process.env.TICK_INTERVAL_MS ?? 10000)
const REGISTRY_PORT = Number(process.env.PORT_REGISTRY ?? 3000)
const DASHBOARD_PORT = Number(process.env.PORT_DASHBOARD ?? 3006)
const REGISTRY_URL = `http://localhost:${REGISTRY_PORT}`

// Start registry and dashboard servers
const registryServer = new RegistryServer()
registryServer.app.listen(REGISTRY_PORT, () => {
  console.log(chalk.cyan(`[REGISTRY ] :${REGISTRY_PORT}`))
})

const dashboardServer = new DashboardServer()
dashboardServer.app.listen(DASHBOARD_PORT, () => {
  console.log(chalk.cyan(`[DASHBOARD] :${DASHBOARD_PORT} → http://localhost:${DASHBOARD_PORT}`))
})

const MARKET_URL = `http://localhost:${process.env.PORT_MARKET ?? 3001}`

const market      = new MarketAgent    ({ type: 'market',     port: Number(process.env.PORT_MARKET      ?? 3001), privateKey: required('PRIVATE_KEY_MARKET'),      tickIntervalMs: TICK, registryUrl: REGISTRY_URL })
const producer    = new ProducerAgent  ({ type: 'producer',   port: Number(process.env.PORT_PRODUCER    ?? 3002), privateKey: required('PRIVATE_KEY_PRODUCER'),    tickIntervalMs: TICK, registryUrl: REGISTRY_URL })
const producer2   = new ProducerAgent  ({ type: 'producer',   port: Number(process.env.PORT_PRODUCER_2  ?? 3007), privateKey: required('PRIVATE_KEY_PRODUCER_2'),  tickIntervalMs: TICK, registryUrl: REGISTRY_URL })
const processor   = new ProcessorAgent ({ type: 'processor',  port: Number(process.env.PORT_PROCESSOR   ?? 3003), privateKey: required('PRIVATE_KEY_PROCESSOR'),   tickIntervalMs: TICK, registryUrl: REGISTRY_URL }, MARKET_URL)
const processor2  = new ProcessorAgent ({ type: 'processor',  port: Number(process.env.PORT_PROCESSOR_2 ?? 3008), privateKey: required('PRIVATE_KEY_PROCESSOR_2'),  tickIntervalMs: TICK, registryUrl: REGISTRY_URL }, MARKET_URL)
const trader      = new TraderAgent    ({ type: 'trader',     port: Number(process.env.PORT_TRADER      ?? 3004), privateKey: required('PRIVATE_KEY_TRADER'),      tickIntervalMs: TICK, registryUrl: REGISTRY_URL })
const speculator  = new SpeculatorAgent({ type: 'speculator', port: Number(process.env.PORT_SPECULATOR  ?? 3005), privateKey: required('PRIVATE_KEY_SPECULATOR'),  tickIntervalMs: TICK, registryUrl: REGISTRY_URL })

const label: Record<string, (s: string) => string> = {
  market:     s => chalk.yellow (`[MARKET   ] ${s}`),
  producer:   s => chalk.green  (`[PRODUCER ] ${s}`),
  processor:  s => chalk.blue   (`[PROCESSOR] ${s}`),
  trader:     s => chalk.magenta(`[TRADER   ] ${s}`),
  speculator: s => chalk.red    (`[SPECULATOR] ${s}`),
}

console.log(chalk.bold('\n🐜 Anthill — starting simulation\n'))

const allAgents = [market, producer, producer2, processor, processor2, trader, speculator]
for (const agent of allAgents) {
  const s = agent.status()
  const fn = label[s.type] ?? (x => x)
  console.log(fn(chalk.dim(s.address)))
}
console.log()

for (const agent of allAgents) agent.start()

console.log(chalk.bold('\nAll agents started. Ctrl+C to stop.\n'))
console.log(chalk.dim('Fund wallets with:'))
console.log(chalk.dim('  cast rpc tempo_fundAddress <ADDRESS> --rpc-url https://rpc.moderato.tempo.xyz\n'))
