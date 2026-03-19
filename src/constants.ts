export const PATHUSD = '0x20c0000000000000000000000000000000000000' as const
export const PATHUSD_DECIMALS = 6
export const RPC_URL = process.env.RPC_URL ?? 'https://rpc.moderato.tempo.xyz'
export const CHAIN_ID = 42431
export const MPP_SECRET_KEY = process.env.MPP_SECRET_KEY ?? 'anthill-dev-secret'

// Prices in pathUSD base units (6 decimals)
// Faucet gives 1,000,000 pathUSD — prices set so ~1000 txs drain a wallet
export const INITIAL_GOODS_BID    = 800_000_000n   // 800 pathUSD
export const INITIAL_PRODUCTS_BID = 2_000_000_000n  // 2,000 pathUSD
export const INITIAL_GOODS_PRICE    = 1_000_000_000n // 1,000 pathUSD
export const INITIAL_PRODUCTS_PRICE = 2_500_000_000n // 2,500 pathUSD
export const INITIAL_SIGNAL_PRICE   = 300_000_000n   // 300 pathUSD
export const MIN_PRICE = 100_000_000n  // 100 pathUSD floor
export const PROCESSOR_MARGIN_THRESHOLD = 300_000_000n // 300 pathUSD min margin
