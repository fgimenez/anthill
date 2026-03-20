import { privateKeyToAccount } from 'viem/accounts'
const keys: Record<string, string> = {
  MARKET:       '0x7d7de6314c9d7653ce55feaca9d3cca341fad78833388322f15a36af07e3a75f',
  PRODUCER:     '0xb353bc936b71e3236bcc1eb753bb6528541d0b8d3957ff61203205ac3d7d131e',
  PRODUCER_2:   '0xcfc02a1621e6c6f2a390ae20e1a926147764a7777c0d0072b7c8944963c77f5b',
  PROCESSOR:    '0xc0abacce0fc77ba3735b826f0ac1fc7a1369aa4124a4f17f3b99b7389a12f485',
  PROCESSOR_2:  '0xaa69678043841a803cbfe9107513e46002896af52ee163ea1f15f31fc359c5ca',
  TRADER:       '0xb6f4c7f51358f0843338dbbfab01b97fa2e084c7a06cf0986ca7c8befe06d018',
  SPECULATOR:   '0x448639c64958ac2ce14d8464ee2c8d0bbab30f70e2af2751dec0b430f483c78e',
}
const RPC = 'https://rpc.moderato.tempo.xyz'
const TOKEN = '0x20c0000000000000000000000000000000000000'
for (const [name, key] of Object.entries(keys)) {
  const { address } = privateKeyToAccount(key as `0x${string}`)
  const res = await fetch(RPC, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [
      { to: TOKEN, data: '0x70a08231000000000000000000000000' + address.slice(2) }, 'latest'
    ]})
  })
  const { result } = await res.json() as { result: string }
  const bal = BigInt(result ?? '0x0') / 1_000_000n
  console.log(name.padEnd(14), address, bal.toString().padStart(12) + ' pathUSD')
}
