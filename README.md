# Anthill

An emergent agent economy simulation built on [MPP](https://mpp.dev) and the [Tempo](https://tempo.xyz) blockchain. Conway's Game of Life meets Monopoly — AI agents making real economic decisions, real on-chain payments, complex emergent dynamics.

Each agent is an HTTP server with a Claude Haiku brain. Every tick, agents call the LLM with their current state and get a structured action back: raise prices, buy goods, sell to market, propose a merger. Every inter-agent transaction is settled on-chain via Tempo pathUSD. Agents can acquire each other. Watch the economy evolve.

---

## How it works

```
Market (deterministic random-walk bids + stress events)
  │
  ├── buys goods from  →  Producer  (GET /produce, MPP-protected)
  │
  └── buys products from →  Processor  (GET /process, MPP-protected)
                                │
                           buys goods from Producer

Trader  (GET /signal, MPP-protected)
  └── spot-buys from Producer + Processor, sells price intelligence

Speculator
  └── buys signals from Trader, arbitrages gaps, proposes mergers
```

Every inter-agent call follows the MPP flow:

```
GET /produce  →  402 + WWW-Authenticate: Payment (challenge)
              →  client signs Tempo transfer tx
              →  retry with Authorization: Payment (credential)
              →  200 + Payment-Receipt (tx hash)
```

Each AI agent (Producer, Processor, Trader, Speculator) calls Claude Haiku once per tick with its current state. Haiku returns a structured JSON action — raise price, buy goods, skip, propose merger — and the agent executes it. Market bids follow a deterministic mean-reverting random walk with occasional stress spikes/crashes, creating boom/bust cycles the AI agents must navigate.

---

## Quickstart

### 1. Install

```bash
npm install
```

### 2. Generate wallets and fund them

```bash
npm run setup
```

This generates a fresh private key for each agent, funds each address with 1,000,000 pathUSD via the Tempo Moderato faucet, and writes everything to `.env`.

Then add your `ANTHROPIC_API_KEY` to `.env`.

### 3. Run

```bash
npm run sim
```

Open **http://localhost:3006** to watch the live dashboard — force-directed agent graph, transaction feed, leaderboard, and market price chart.

---

## Tech stack

- **Runtime:** Node.js + TypeScript (`tsx`)
- **Framework:** Express 5
- **Payments:** [mppx](https://mpp.dev) — MPP TypeScript SDK
- **Chain:** Tempo Moderato testnet (chainId `42431`)
- **Token:** pathUSD at `0x20c0000000000000000000000000000000000000`
- **Agent brain:** Claude Haiku (`claude-haiku-4-5`) via Anthropic SDK — structured JSON decisions per tick

---

## Project structure

```
sim.ts                            # Boots all agents, registry, and dashboard
src/
├── constants.ts                  # Chain config, token address, price constants
├── registry/
│   ├── index.ts                  # In-memory AgentRegistry
│   └── server.ts                 # HTTP registry: GET /agents, POST /agents/register, GET /leaderboard
├── agents/
│   ├── base.ts                   # AgentBase: Express + mppx, tick loop, decide(), register(), /merge-offer
│   ├── market.ts                 # External Market: random-walk bids, stress events (deterministic)
│   ├── producer.ts               # GET /produce (MPP) — Haiku decides price strategy
│   ├── processor.ts              # GET /process (MPP) — Haiku decides buy-and-sell vs skip
│   ├── trader.ts                 # GET /signal (MPP) — Haiku decides spot-buy and signal packaging
│   └── speculator.ts             # Haiku decides arbitrage vs merger proposal
└── dashboard/
    ├── events.ts                 # Singleton EventEmitter for payment/merge/price-change events
    ├── server.ts                 # SSE /events endpoint + static files
    └── public/
        └── index.html            # Force-directed graph, tx feed, leaderboard, price chart
```

---

## Agent archetypes

| Agent | Endpoint | Decision | Role |
|---|---|---|---|
| **Market** | `GET /prices`, `POST /buy-order` | deterministic random walk | external demand sink, non-acquirable |
| **Producer** | `GET /produce` | Claude Haiku | raw goods supplier |
| **Processor** | `GET /process` | Claude Haiku | buys goods, sells products |
| **Trader** | `GET /signal` | Claude Haiku | observes prices, sells signals |
| **Speculator** | — | Claude Haiku | arbitrage + acquisitions |

### Merge mechanic

Any agent exposes `POST /merge-offer` (MPP-protected). Speculator pays the buyout fee; target evaluates and accepts or rejects. On accept: target exits with a locked score (buyout + remaining balance), acquirer inherits its service routes.

### Ports

| Port | Service |
|---|---|
| 3000 | Registry |
| 3001 | Market |
| 3002 | Producer |
| 3003 | Processor |
| 3004 | Trader |
| 3005 | Speculator |
| 3006 | Dashboard |
| 3007 | Producer 2 |
| 3008 | Processor 2 |
