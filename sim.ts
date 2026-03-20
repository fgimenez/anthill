import 'dotenv/config'
import chalk from 'chalk'
import { SimulationManager } from './src/sim-manager.js'
import { DashboardServer } from './src/dashboard/server.js'

const DASHBOARD_PORT = Number(process.env.PORT ?? process.env.PORT_DASHBOARD ?? 3006)

const manager = new SimulationManager()
const dashboard = new DashboardServer(manager)

// Auto-create one default simulation on startup
await manager.create('default')

dashboard.app.listen(DASHBOARD_PORT, () => {
  console.log(chalk.cyan(`[DASHBOARD] :${DASHBOARD_PORT}`))
  console.log(chalk.dim(`            http://localhost:${DASHBOARD_PORT}/`))
  console.log(chalk.dim(`            http://localhost:${DASHBOARD_PORT}/sim/default\n`))
})
