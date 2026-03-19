import { EventEmitter } from 'node:events'

export interface AntEvent {
  type: 'payment' | 'merge' | 'price-change' | 'decision'
  from: string
  to?: string
  amount?: string
  txHash?: string
  price?: string
  agentType?: string
  action?: string
  ts: number
}

export const eventBus = new EventEmitter()
