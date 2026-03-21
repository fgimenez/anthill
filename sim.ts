import 'dotenv/config'
// Polyfill Web Crypto for Node.js < 19
if (!globalThis.crypto) {
  const { webcrypto } = await import('node:crypto')
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
}
import chalk from 'chalk'
import { SimulationManager } from './src/sim-manager.js'
import { DashboardServer } from './src/dashboard/server.js'

const DASHBOARD_PORT = Number(process.env.PORT ?? process.env.PORT_DASHBOARD ?? 3006)

const manager = new SimulationManager()
const dashboard = new DashboardServer(manager)

// Start HTTP server first so Railway healthcheck passes immediately,
// then create the simulation (wallet funding involves slow RPC calls)
dashboard.app.listen(DASHBOARD_PORT, () => {
  console.log(chalk.cyan(`[DASHBOARD] :${DASHBOARD_PORT}`))
  console.log(chalk.dim(`            http://localhost:${DASHBOARD_PORT}/`))
  console.log(chalk.dim(`            http://localhost:${DASHBOARD_PORT}/sim/default\n`))
  manager.create('default').catch(e => console.error('[sim] failed to start:', e))
})
