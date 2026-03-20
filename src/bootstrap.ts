import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PATHUSD, RPC_URL } from './constants.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ENV_PATH = join(ROOT, '.env')

const AGENT_KEYS = [
  'PRIVATE_KEY_MARKET',
  'PRIVATE_KEY_PRODUCER',
  'PRIVATE_KEY_PRODUCER_2',
  'PRIVATE_KEY_PROCESSOR',
  'PRIVATE_KEY_PROCESSOR_2',
  'PRIVATE_KEY_TRADER',
  'PRIVATE_KEY_SPECULATOR',
] as const

// Fund if balance is below 100,000 pathUSD
const FUND_THRESHOLD = 100_000_000_000n

export async function getPathUSDBalance(address: string): Promise<bigint> {
  const data = '0x70a08231' + address.slice(2).padStart(64, '0')
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'eth_call',
      params: [{ to: PATHUSD, data }, 'latest'],
    }),
  })
  const json = await res.json() as { result: string; error?: { message: string } }
  if (json.error) throw new Error(json.error.message)
  return BigInt(json.result)
}

export async function fundAddress(address: string): Promise<void> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tempo_fundAddress', params: [address] }),
  })
  const body = await res.json() as { error?: { message: string } }
  if (body.error) throw new Error(body.error.message)
}

export async function bootstrap(): Promise<void> {
  let envContent = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : ''
  let changed = false

  // Ensure all private keys exist — generate missing ones
  for (const key of AGENT_KEYS) {
    if (process.env[key]) continue

    const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'))
    if (match) {
      process.env[key] = match[1].trim()
      continue
    }

    const pk = generatePrivateKey()
    process.env[key] = pk
    envContent = `${key}=${pk}\n` + envContent
    changed = true
    const { address } = privateKeyToAccount(pk)
    console.log(`[bootstrap] generated ${key}: ${address}`)
  }

  if (changed) writeFileSync(ENV_PATH, envContent)

  if (process.env.SKIP_FUNDING === 'true') return

  // Check balances and fund wallets below threshold
  for (const key of AGENT_KEYS) {
    const pk = process.env[key]
    if (!pk) continue
    const { address } = privateKeyToAccount(pk as `0x${string}`)
    try {
      const balance = await getPathUSDBalance(address)
      if (balance < FUND_THRESHOLD) {
        process.stdout.write(`[bootstrap] funding ${key} (${address}) … `)
        await fundAddress(address)
        console.log('✓ 1,000,000 pathUSD')
      } else {
        console.log(`[bootstrap] ${key} ok — ${balance / 1_000_000n} pathUSD`)
      }
    } catch (e) {
      console.warn(`[bootstrap] could not check/fund ${key}: ${(e as Error).message}`)
    }
  }
}
