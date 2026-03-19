# Anthill

An emergent agent economy simulation built on [MPP](https://mpp.dev) and the [Tempo](https://tempo.xyz) blockchain. Conway's Game of Life meets Monopoly — AI agents making real economic decisions, real on-chain payments, complex emergent dynamics.

Each agent is an HTTP server with a Claude Haiku brain. Every tick, agents call the LLM with their current state and get a structured action back: raise prices, buy goods, sell to market, propose a merger. Every inter-agent transaction is settled on-chain via Tempo pathUSD. Agents can acquire each other. Watch the economy evolve.

---

## How it works

```
Market (fluctuating bids)
  │
  ├── buys goods from  →  Producer  (GET /produce, MPP-protected)
  │
  └── buys products from →  Processor  (GET /process, MPP-protected)
                                │
                           buys goods from Producer

Trader  (GET /signal, MPP-protected)
  └── observes prices, sells market intelligence

Speculator  (Round 2)
  └── arbitrages price gaps, acquires weakened agents
```

Every inter-agent call follows the MPP flow:

```
GET /produce  →  402 + WWW-Authenticate: Payment (challenge)
              →  client signs Tempo transfer tx
              →  retry with Authorization: Payment (credential)
              →  200 + Payment-Receipt (tx hash)
```

Each AI agent calls Claude Haiku once per tick with its current state. Haiku returns a structured JSON action — raise price, buy goods, skip, propose merger — and the agent executes it. Market bids follow a deterministic mean-reverting random walk, creating boom/bust cycles the AI agents must navigate.

---

## Quickstart

### 1. Install

```bash
npm install
```

### 2. Configure wallets

```bash
cp .env.example .env
```

Generate a private key per agent (e.g. with `cast wallet new`) and fill in `.env`.

### 3. Fund wallets

Each agent needs pathUSD on Tempo Moderato testnet. Run once per address:

```bash
cast rpc tempo_fundAddress <ADDRESS> --rpc-url https://rpc.moderato.tempo.xyz
```

This drops 1,000,000 pathUSD — enough for hours of simulation at ~1 pathUSD/tx.

### 4. Run

```bash
npm run sim
```

Watch the terminal for live agent activity and on-chain transaction hashes.

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
src/
├── constants.ts          # Chain config, token address, price constants
├── registry/
│   └── index.ts          # In-memory agent registry
└── agents/
    ├── base.ts           # AgentBase: Express + mppx, tick loop, /status
    ├── market.ts         # External Market: fluctuating bids, drives demand
    ├── producer.ts       # Sells raw goods (GET /produce)
    ├── processor.ts      # Buys goods, sells products (GET /process)
    └── trader.ts         # Sells price signals (GET /signal)
sim.ts                    # Boots all agents
```

---

## Agent archetypes

| Agent | Endpoint | Price | Role |
|---|---|---|---|
| **Market** | `GET /prices`, `POST /buy-order` | fluctuating bids | external demand sink, non-acquirable |
| **Producer** | `GET /produce` | demand-driven | raw goods supplier |
| **Processor** | `GET /process` | cost-plus margin | value-add middleman |
| **Trader** | `GET /signal` | demand-driven | information broker |
| **Speculator** | *(Round 2)* | — | arbitrage + acquisitions |

---

## Roadmap

**Round 1 (done):** MPP-protected supply-side APIs, Claude Haiku decision loop per agent, Market random-walk demand, sim runner.

**Round 2:** Speculator agent, merger/acquisition mechanic, service discovery via OpenAPI, human participation (deploy your own agent).

**Round 3:** Live browser dashboard with force-directed agent graph, SSE transaction feed, leaderboard (active agents + locked exit scores).
