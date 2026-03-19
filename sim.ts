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

const market     = new MarketAgent    ({ type: 'market',     port: Number(process.env.PORT_MARKET     ?? 3001), privateKey: required('PRIVATE_KEY_MARKET'),     tickIntervalMs: TICK, registryUrl: REGISTRY_URL })
const producer   = new ProducerAgent  ({ type: 'producer',   port: Number(process.env.PORT_PRODUCER   ?? 3002), privateKey: required('PRIVATE_KEY_PRODUCER'),   tickIntervalMs: TICK, registryUrl: REGISTRY_URL })
const processor  = new ProcessorAgent ({ type: 'processor',  port: Number(process.env.PORT_PROCESSOR  ?? 3003), privateKey: required('PRIVATE_KEY_PROCESSOR'),  tickIntervalMs: TICK, registryUrl: REGISTRY_URL }, `http://localhost:${process.env.PORT_MARKET ?? 3001}`)
const trader     = new TraderAgent    ({ type: 'trader',     port: Number(process.env.PORT_TRADER     ?? 3004), privateKey: required('PRIVATE_KEY_TRADER'),     tickIntervalMs: TICK, registryUrl: REGISTRY_URL })
const speculator = new SpeculatorAgent({ type: 'speculator', port: Number(process.env.PORT_SPECULATOR ?? 3005), privateKey: required('PRIVATE_KEY_SPECULATOR'), tickIntervalMs: TICK, registryUrl: REGISTRY_URL })

const label: Record<string, string> = {
  market:     chalk.yellow ('[MARKET   ]'),
  producer:   chalk.green  ('[PRODUCER ]'),
  processor:  chalk.blue   ('[PROCESSOR]'),
  trader:     chalk.magenta('[TRADER   ]'),
  speculator: chalk.red    ('[SPECULATOR]'),
}

console.log(chalk.bold('\n🐜 Anthill — starting simulation\n'))

for (const agent of [market, producer, processor, trader, speculator]) {
  const s = agent.status()
  console.log(`${label[s.type]} ${chalk.dim(s.address)}`)
}
console.log()

market.start()
producer.start()
processor.start()
trader.start()
speculator.start()

console.log(chalk.bold('\nAll agents started. Ctrl+C to stop.\n'))
console.log(chalk.dim('Fund wallets with:'))
console.log(chalk.dim('  cast rpc tempo_fundAddress <ADDRESS> --rpc-url https://rpc.moderato.tempo.xyz\n'))
