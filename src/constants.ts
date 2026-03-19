export const PATHUSD = '0x20c0000000000000000000000000000000000000' as const
export const PATHUSD_DECIMALS = 6
export const RPC_URL = process.env.RPC_URL ?? 'https://rpc.moderato.tempo.xyz'
export const CHAIN_ID = 42431
export const MPP_SECRET_KEY = process.env.MPP_SECRET_KEY ?? 'anthill-dev-secret'

// Prices in pathUSD base units (6 decimals)
export const INITIAL_GOODS_BID    = 800_000n   // 0.80 pathUSD
export const INITIAL_PRODUCTS_BID = 2_000_000n  // 2.00 pathUSD
export const INITIAL_GOODS_PRICE    = 1_000_000n // 1.00 pathUSD
export const INITIAL_PRODUCTS_PRICE = 2_500_000n // 2.50 pathUSD
export const INITIAL_SIGNAL_PRICE   = 300_000n   // 0.30 pathUSD
export const MIN_PRICE = 100_000n  // 0.10 pathUSD floor
export const PROCESSOR_MARGIN_THRESHOLD = 300_000n // 0.30 pathUSD min margin
