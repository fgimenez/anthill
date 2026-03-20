export interface AntEvent {
  type: 'payment' | 'merge' | 'price-change' | 'decision' | 'tick' | 'game-over' | 'restarted'
  from?: string
  to?: string
  amount?: string
  txHash?: string
  price?: string
  agentType?: string
  action?: string
  tick?: number
  winTicks?: number
  ts: number
}
