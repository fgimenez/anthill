#!/usr/bin/env tsx
/**
 * setup-wallets.ts
 *
 * Generates a fresh private key for each agent, funds each address via the
 * Tempo Moderato faucet, and writes the keys to .env.
 *
 * Usage:
 *   npx tsx scripts/setup-wallets.ts
 *
 * To skip funding (e.g. offline):
 *   SKIP_FUNDING=true npx tsx scripts/setup-wallets.ts
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ENV_PATH = join(ROOT, '.env')
const RPC_URL = process.env.RPC_URL ?? 'https://rpc.moderato.tempo.xyz'
const SKIP_FUNDING = process.env.SKIP_FUNDING === 'true'

const AGENTS = ['MARKET', 'PRODUCER', 'PRODUCER_2', 'PROCESSOR', 'PROCESSOR_2', 'TRADER', 'SPECULATOR'] as const

async function fundAddress(address: string): Promise<void> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tempo_fundAddress',
      params: [address],
      id: 1,
    }),
  })
  const body = await res.json() as { error?: { message: string } }
  if (body.error) throw new Error(body.error.message)
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('🐜 Anthill — wallet setup\n')

const wallets: Record<string, { privateKey: string; address: string }> = {}

for (const agent of AGENTS) {
  const privateKey = generatePrivateKey()
  const { address } = privateKeyToAccount(privateKey)
  wallets[agent] = { privateKey, address }
  console.log(`${agent.padEnd(12)} ${address}`)
}

console.log()

if (!SKIP_FUNDING) {
  console.log(`Funding via ${RPC_URL}…\n`)
  for (const agent of AGENTS) {
    const { address } = wallets[agent]
    process.stdout.write(`  funding ${agent.padEnd(12)} ${address} … `)
    try {
      await fundAddress(address)
      console.log('✓ 1,000,000 pathUSD')
    } catch (e) {
      console.log(`✗ ${(e as Error).message}`)
    }
  }
  console.log()
} else {
  console.log('Skipping funding (SKIP_FUNDING=true)\n')
}

// ── Write .env ────────────────────────────────────────────────────────────────

// Read existing .env to preserve non-key entries (ports, RPC_URL, etc.)
let existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : ''

// Remove existing PRIVATE_KEY lines so we don't duplicate
existing = existing.replace(/^PRIVATE_KEY_\w+=.*\n?/gm, '').trimStart()

const keyBlock = AGENTS.map(a => `PRIVATE_KEY_${a}=${wallets[a].privateKey}`).join('\n')
const envContent = keyBlock + '\n\n' + existing

writeFileSync(ENV_PATH, envContent)
console.log(`✓ Written to .env`)
console.log()
console.log('Next steps:')
console.log('  1. Add ANTHROPIC_API_KEY to .env')
console.log('  2. npm run sim')
