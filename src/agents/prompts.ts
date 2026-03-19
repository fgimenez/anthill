import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const PROMPTS = require('./prompts.json') as Record<string, Array<{ name: string; prompt: string }>>

export type AgentArchetype = 'producer' | 'processor' | 'trader' | 'speculator'

export function getRandomPrompt(type: AgentArchetype): string {
  const strategies = PROMPTS[type]
  const pick = strategies[Math.floor(Math.random() * strategies.length)]
  return pick.prompt
}

export function getRandomStrategy(type: AgentArchetype): { name: string; prompt: string } {
  const strategies = PROMPTS[type]
  return strategies[Math.floor(Math.random() * strategies.length)]
}
