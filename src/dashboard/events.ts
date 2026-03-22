export interface AntEvent {
  type: 'payment' | 'merge' | 'price-change' | 'decision' | 'tick' | 'game-over' | 'restarted' | 'narration' | 'winner'
  from?: string
  to?: string
  amount?: string
  txHash?: string
  price?: string
  agentType?: string
  agentLabel?: string
  action?: string
  text?: string           // narration text
  tick?: number
  winTicks?: number
  winnerLabel?: string    // winner event: winning agent label
  winnerBalance?: string  // winner event: balance in pathUSD
  winReason?: 'tick-limit' | 'last-standing'
  ts: number
}
