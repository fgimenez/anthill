import { Simulation } from './simulation.js'

const PORTS_PER_SIM = 8
const BASE_PORT = 4000

export class SimulationManager {
  private sims = new Map<string, Simulation>()
  private nextPort = BASE_PORT

  async create(id?: string): Promise<Simulation> {
    const simId = id ?? `sim-${Date.now()}`
    if (this.sims.has(simId)) throw new Error(`simulation '${simId}' already exists`)

    const basePort = this.nextPort
    this.nextPort += PORTS_PER_SIM

    const sim = new Simulation(simId, basePort)
    this.sims.set(simId, sim)
    await sim.start()
    return sim
  }

  get(id: string): Simulation | undefined {
    return this.sims.get(id)
  }

  list(): Array<{ id: string }> {
    return [...this.sims.keys()].map(id => ({ id }))
  }
}
