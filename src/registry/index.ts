export type AgentType = 'producer' | 'processor' | 'trader' | 'speculator' | 'market'

export interface AgentEntry {
  id: string
  type: AgentType
  label: string
  url: string
  address: string
  active: boolean
  exitScore?: string
}

export class AgentRegistry {
  private agents: AgentEntry[] = []

  register(entry: Omit<AgentEntry, 'active'>) {
    this.agents.push({ ...entry, active: true })
  }

  list(): AgentEntry[] {
    return this.agents
  }

  find(type: AgentType): AgentEntry[] {
    return this.agents.filter(a => a.type === type && a.active)
  }

  recordExit(id: string, exitScore: string) {
    const agent = this.agents.find(a => a.id === id)
    if (agent) { agent.active = false; agent.exitScore = exitScore }
  }
}
