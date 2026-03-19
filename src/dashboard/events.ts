import { EventEmitter } from 'node:events'

export interface AntEvent {
  type: 'payment' | 'merge' | 'price-change'
  from: string
  to?: string
  amount?: string
  txHash?: string
  price?: string
  agentType?: string
  ts: number
}

export const eventBus = new EventEmitter()
