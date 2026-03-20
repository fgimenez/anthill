/**
 * Test script: send a real 1000 pathUSD transfer via the fee payer relay.
 * Run: npx tsx scripts/test-feepayer.ts
 */
import { createClient, createWalletClient, http, custom } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { withFeePayer } from 'viem/tempo'
import { sendRawTransactionSync, prepareTransactionRequest, signTransaction } from 'viem/actions'
import { Actions } from 'viem/tempo'

const RPC = 'https://rpc.moderato.tempo.xyz'
const FEE_PAYER_URL = 'https://sponsor.moderato.tempo.xyz'
const PATHUSD = '0x20c0000000000000000000000000000000000000' as `0x${string}`

// Use processor1 private key (from .env)
const SENDER_KEY = process.env.PRIVATE_KEY_PROCESSOR as `0x${string}`
if (!SENDER_KEY) throw new Error('Set PRIVATE_KEY_PROCESSOR env var')

const account = privateKeyToAccount(SENDER_KEY)
const RECIPIENT = '0x2B6Fc8928c94000252bf0f4543e8e1DE3C4077Bf' as `0x${string}` // market

console.log('sender:', account.address)
console.log('recipient:', RECIPIENT)
console.log('amount: 1000 pathUSD')
console.log()

async function getBalance(addr: string) {
  const data = ('0x70a08231' + addr.slice(2).padStart(64, '0')) as `0x${string}`
  const res = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: PATHUSD, data }, 'latest'] }) })
  const { result } = await res.json() as { result: string }
  return BigInt(result) / 1_000_000n
}

// --- sign-and-broadcast policy ---
async function testSignAndBroadcast() {
  console.log('=== Testing sign-and-broadcast policy ===')
  const client = createClient({
    account,
    chain: tempoModerato,
    transport: withFeePayer(http(RPC), http(FEE_PAYER_URL), { policy: 'sign-and-broadcast' }),
  })

  const transferCall = Actions.token.transfer.call({ amount: 1_000_000_000n, to: RECIPIENT, token: PATHUSD })

  try {
    const prepared = await prepareTransactionRequest(client as any, {
      account, calls: [transferCall], feePayer: true, nonceKey: 'expiring',
    } as any)
    console.log('prepared gas:', prepared.gas)
    const signed = await signTransaction(client as any, prepared as any)
    console.log('signed tx (first 40 chars):', (signed as string).slice(0, 40), '...')
    const receipt = await sendRawTransactionSync(client as any, { serializedTransaction: signed as any })
    console.log('receipt:', receipt)
  } catch (e) {
    console.error('FAILED:', (e as Error).message?.slice(0, 200))
  }
}

// --- sign-only policy (default) ---
async function testSignOnly() {
  console.log()
  console.log('=== Testing sign-only policy (default) ===')
  const client = createClient({
    account,
    chain: tempoModerato,
    transport: withFeePayer(http(RPC), http(FEE_PAYER_URL)),
  })

  const transferCall = Actions.token.transfer.call({ amount: 1_000_000_000n, to: RECIPIENT, token: PATHUSD })

  try {
    const prepared = await prepareTransactionRequest(client as any, {
      account, calls: [transferCall], feePayer: true, nonceKey: 'expiring',
    } as any)
    const signed = await signTransaction(client as any, prepared as any)
    console.log('signed tx (first 40 chars):', (signed as string).slice(0, 40), '...')
    const receipt = await sendRawTransactionSync(client as any, { serializedTransaction: signed as any })
    console.log('receipt:', receipt)
  } catch (e) {
    console.error('FAILED:', (e as Error).message?.slice(0, 200))
  }
}

const senderBefore = await getBalance(account.address)
const recipBefore = await getBalance(RECIPIENT)
console.log('balances before:')
console.log('  sender:', senderBefore.toString(), 'pathUSD')
console.log('  recipient:', recipBefore.toString(), 'pathUSD')
console.log()

await testSignAndBroadcast()
await testSignOnly()

const senderAfter = await getBalance(account.address)
const recipAfter = await getBalance(RECIPIENT)
console.log()
console.log('balances after:')
console.log('  sender:', senderAfter.toString(), 'pathUSD')
console.log('  recipient:', recipAfter.toString(), 'pathUSD')
console.log('  delta sender:', (senderAfter - senderBefore).toString())
console.log('  delta recipient:', (recipAfter - recipBefore).toString())
