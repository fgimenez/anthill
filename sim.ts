import 'dotenv/config'
import chalk from 'chalk'
import { AgentRegistry } from './src/registry/index.js'
import { MarketAgent } from './src/agents/market.js'
import { ProducerAgent } from './src/agents/producer.js'
import { ProcessorAgent } from './src/agents/processor.js'
import { TraderAgent } from './src/agents/trader.js'

const required = (name: string) => {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v as `0x${string}`
}

const TICK = Number(process.env.TICK_INTERVAL_MS ?? 5000)

const registry = new AgentRegistry()

const market    = new MarketAgent   ({ type: 'market',    port: 3001, privateKey: required('PRIVATE_KEY_MARKET'),    tickIntervalMs: TICK })
const producer  = new ProducerAgent ({ type: 'producer',  port: 3002, privateKey: required('PRIVATE_KEY_PRODUCER'),  tickIntervalMs: TICK })
const processor = new ProcessorAgent({ type: 'processor', port: 3003, privateKey: required('PRIVATE_KEY_PROCESSOR'), tickIntervalMs: TICK }, 'http://localhost:3001')
const trader    = new TraderAgent   ({ type: 'trader',    port: 3004, privateKey: required('PRIVATE_KEY_TRADER'),    tickIntervalMs: TICK })

registry.register({ id: 'market',    type: 'market',    url: 'http://localhost:3001', address: market.status().address })
registry.register({ id: 'producer',  type: 'producer',  url: 'http://localhost:3002', address: producer.status().address })
registry.register({ id: 'processor', type: 'processor', url: 'http://localhost:3003', address: processor.status().address })
registry.register({ id: 'trader',    type: 'trader',    url: 'http://localhost:3004', address: trader.status().address })

const label = {
  market:    chalk.yellow('[MARKET   ]'),
  producer:  chalk.green ('[PRODUCER ]'),
  processor: chalk.blue  ('[PROCESSOR]'),
  trader:    chalk.magenta('[TRADER   ]'),
}

console.log(chalk.bold('\n🐜 Anthill — starting simulation\n'))
for (const [id, entry] of Object.entries({ market, producer, processor, trader })) {
  const s = entry.status()
  console.log(`${label[s.type as keyof typeof label]} :${['3001','3002','3003','3004'][Object.keys({market,producer,processor,trader}).indexOf(id)]} ${chalk.dim(s.address)}`)
}
console.log()

market.start()
producer.start()
processor.start()
trader.start()

console.log(chalk.bold('\nAll agents started. Ctrl+C to stop.\n'))
console.log(chalk.dim('Fund wallets with:'))
console.log(chalk.dim('  cast rpc tempo_fundAddress <ADDRESS> --rpc-url https://rpc.moderato.tempo.xyz\n'))
