export const PATHUSD = '0x20c0000000000000000000000000000000000000' as const
export const PATHUSD_DECIMALS = 6
export const RPC_URL = process.env.RPC_URL ?? 'https://rpc.moderato.tempo.xyz'
export const FEE_PAYER_URL = process.env.FEE_PAYER_URL ?? 'https://sponsor.moderato.tempo.xyz'
export const CHAIN_ID = 42431
export const MPP_SECRET_KEY = process.env.MPP_SECRET_KEY ?? 'anthill-dev-secret'

// Prices in pathUSD base units (6 decimals)
// Faucet gives 1,000,000 pathUSD — prices set so ~100 txs drain a wallet
export const INITIAL_GOODS_BID    = 8_000_000_000n   // 8,000 pathUSD
export const INITIAL_PRODUCTS_BID = 20_000_000_000n  // 20,000 pathUSD
export const INITIAL_GOODS_PRICE    = 10_000_000_000n // 10,000 pathUSD
export const INITIAL_PRODUCTS_PRICE = 25_000_000_000n // 25,000 pathUSD
export const INITIAL_SIGNAL_PRICE   = 3_000_000_000n  // 3,000 pathUSD
export const MIN_PRICE = 1_000_000_000n  // 1,000 pathUSD floor
export const PROCESSOR_MARGIN_THRESHOLD = 3_000_000_000n // 3,000 pathUSD min margin

// Win condition: game ends after this many ticks (0 = disabled)
export const WIN_TICKS = Number(process.env.WIN_TICKS ?? '0')
