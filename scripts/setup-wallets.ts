#!/usr/bin/env tsx
/**
 * setup-wallets.ts
 *
 * Generates a fresh private key for each agent, funds each address via the
 * Tempo Moderato faucet, and writes the keys to .env.
 *
 * Usage:
 *   npx tsx scripts/setup-wallets.ts          # generate fresh keys + fund
 *   FUND_ONLY=true npx tsx scripts/setup-wallets.ts  # re-fund existing keys
 *   SKIP_FUNDING=true npx tsx scripts/setup-wallets.ts  # generate keys, no funding
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
const FUND_ONLY = process.env.FUND_ONLY === 'true'

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

if (FUND_ONLY) {
  // Read existing keys from .env, just re-fund them
  console.log('FUND_ONLY mode — reading existing keys from .env\n')
  const env = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : ''
  for (const agent of AGENTS) {
    const match = env.match(new RegExp(`^PRIVATE_KEY_${agent}=(.+)$`, 'm'))
    if (!match) { console.log(`${agent.padEnd(12)} ✗ not found in .env`); continue }
    const { address } = privateKeyToAccount(match[1].trim() as `0x${string}`)
    wallets[agent] = { privateKey: match[1].trim(), address }
    console.log(`${agent.padEnd(12)} ${address}`)
  }
} else {
  // Generate fresh keys
  for (const agent of AGENTS) {
    const privateKey = generatePrivateKey()
    const { address } = privateKeyToAccount(privateKey)
    wallets[agent] = { privateKey, address }
    console.log(`${agent.padEnd(12)} ${address}`)
  }
}

console.log()

if (!SKIP_FUNDING) {
  console.log(`Funding via ${RPC_URL}…\n`)
  for (const agent of AGENTS) {
    if (!wallets[agent]) continue
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

if (!FUND_ONLY) {
  // ── Write .env ──────────────────────────────────────────────────────────────
  // Read existing .env to preserve non-key entries (ports, RPC_URL, etc.)
  let existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : ''

  // Remove existing PRIVATE_KEY lines so we don't duplicate
  existing = existing.replace(/^PRIVATE_KEY_\w+=.*\n?/gm, '').trimStart()

  const keyBlock = AGENTS.map(a => `PRIVATE_KEY_${a}=${wallets[a].privateKey}`).join('\n')
  const envContent = keyBlock + '\n\n' + existing

  writeFileSync(ENV_PATH, envContent)
  console.log(`✓ Written to .env\n`)
}

console.log('Next steps:')
if (!FUND_ONLY) console.log('  1. Add ANTHROPIC_API_KEY to .env')
console.log('  npm run sim')
