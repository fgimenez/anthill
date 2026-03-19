import { AgentBase, AgentConfig } from './base.js'
import { INITIAL_GOODS_BID, INITIAL_PRODUCTS_BID, MIN_PRICE } from '../constants.js'

export { nextPrice }

export class MarketAgent extends AgentBase {
  private goodsBid = INITIAL_GOODS_BID
  private productsBid = INITIAL_PRODUCTS_BID

  constructor(config: AgentConfig) {
    super(config, 0n) // market doesn't sell, price unused
  }

  protected setup() {
    this.app.get('/prices', (_req, res) => {
      res.json({
        goodsBid: this.goodsBid.toString(),
        productsBid: this.productsBid.toString(),
        updatedAt: new Date().toISOString(),
      })
    })

    this.app.post('/buy-order', this.charged('Sell to market'), (_req, res) => {
      this.txCount++
      res.json({ status: 'accepted' })
    })
  }

  protected async tick() {
    this.goodsBid = nextPrice(this.goodsBid, INITIAL_GOODS_BID)
    this.productsBid = nextPrice(this.productsBid, INITIAL_PRODUCTS_BID)
    // ensure invariant: productsBid > goodsBid
    if (this.productsBid <= this.goodsBid) this.productsBid = this.goodsBid + INITIAL_GOODS_BID / 2n
  }
}

function nextPrice(current: bigint, mean: bigint): bigint {
  const change = (Math.random() < 0.5 ? -1n : 1n) * (mean / 20n)
  const meanPull = (mean - current) / 10n
  const next = current + change + meanPull
  return next < MIN_PRICE ? MIN_PRICE : next
}
