export interface AntEvent {
  type: 'payment' | 'merge' | 'price-change' | 'decision' | 'tick' | 'game-over' | 'restarted' | 'narration'
  from?: string
  to?: string
  amount?: string
  txHash?: string
  price?: string
  agentType?: string
  action?: string
  text?: string      // narration text
  tick?: number
  winTicks?: number
  ts: number
}
