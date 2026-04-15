# StreamYield — AI-Optimized Payroll Streaming on HashKey Chain

> **PayFi protocol that streams employee salaries per-second while an autonomous AI agent routes unvested capital into ERC-4626 RWA yield vaults on HashKey Chain — turning payroll from a cost center into a profit center.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-000000?logo=vercel)](https://frontend-six-jade-81.vercel.app)
[![HashKey Chain](https://img.shields.io/badge/HashKey%20Chain-Testnet%20133-6366f1)](https://testnet-explorer.hsk.xyz)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636)](https://soliditylang.org)
[![Tests](https://img.shields.io/badge/Tests-18%2F18%20passing-10b981)](./contracts/test)
[![AI](https://img.shields.io/badge/AI-GLM--4%20Autonomous-a855f7)](https://open.bigmodel.cn)
[![Vaults](https://img.shields.io/badge/Vaults-ERC--4626-ec4899)](https://eips.ethereum.org/EIPS/eip-4626)
[![Track](https://img.shields.io/badge/Track-PayFi-f59e0b)](https://dorahacks.io/hackathon/2045)

---

## Table of Contents

1. [What is StreamYield?](#1-what-is-streamyield)
2. [The Problem](#2-the-problem)
3. [How It Works](#3-how-it-works)
4. [Smart Contracts](#4-smart-contracts)
5. [AI Agent Backend](#5-ai-agent-backend)
6. [RWA Vault Tiers](#6-rwa-vault-tiers)
7. [HSP Integration](#7-hsp-hashkey-settlement-protocol-integration)
8. [Frontend](#8-frontend)
9. [Deployed Contracts](#9-deployed-contracts-hashkey-chain-testnet)
10. [Tech Stack](#10-tech-stack)
11. [Project Structure](#11-project-structure)
12. [Quick Start](#12-quick-start)
13. [Testing](#13-testing)
14. [Multi-Track Coverage](#14-multi-track-coverage)
15. [Screenshots](#15-screenshots)

---

## 1. What is StreamYield?

StreamYield is a **PayFi protocol** built on HashKey Chain that solves the #1 inefficiency in B2B payroll: **idle capital**.

It does this in 4 steps:

1. **Employer deposits payroll** into `StreamVault` — capital is immediately deployed to an ERC-4626 RWA yield vault
2. **Autonomous AI decides the vault** — Zhipu GLM-4 receives live market context (yield curve, Sharpe ratios, credit spreads) and makes the routing decision with a confidence score — no hard-coded rules
3. **Salary streams per-second** — employees accumulate vested salary every block; no waiting until month-end
4. **Employer collects yield** — when the stream closes, the ERC-4626 vault redeems shares and sends accumulated yield directly to the employer

**Example:** A company with $500K monthly payroll earns **~$3,300/month** in yield from the Balanced vault instead of $0 sitting in a traditional bank account.

---

## 2. The Problem

| Metric | Traditional Payroll | StreamYield |
|--------|-------------------|-------------|
| Capital utilization | 0% (idle in bank) | 4–12% APY in RWA vaults |
| Payment frequency | Monthly batch | Per-second streaming |
| Employee liquidity | 0 until payday | Claimable any time |
| Yield to employer | $0 | Projected $3K–$40K/month per $500K payroll |
| Settlement standard | Bank wire | HSP state machine on HashKey Chain |
| Vault standard | N/A | ERC-4626 (same standard as Aave, Morpho, Ondo) |

---

## 3. How It Works

```
Employer deposits $100K payroll capital
          │
          ▼
┌─────────────────────────────────────────────────────┐
│  AI Agent (Next.js API Route + Zhipu GLM-4)         │
│  Input: duration, amount, risk, market conditions   │
│  → Autonomous vault decision (no hard-coded rules)  │
│  → Returns: tier, confidence score, risk warning    │
└───────────────────────┬─────────────────────────────┘
                        ↓ employer submits tx with tier + aiReasoning
┌─────────────────────────────────────────────────────┐
│  StreamVault.createStream()                         │
│  Pull tokens → approve router → ERC-4626 deposit   │
│  → Store aiReasoning on-chain → emit StreamCreated  │
└───────────────────────┬─────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  RWAYieldRouter → RWATierVault (ERC-4626)           │
│  Mints shares to router for the stream              │
│  totalAssets() tracks real token balance            │
│  convertToAssets(shares) enables yield accounting   │
└───────────────────────┬─────────────────────────────┘
                        ↓ every payroll action
┌─────────────────────────────────────────────────────┐
│  HSPSettlementEmitter (State Machine)               │
│  createSettlement() → PENDING                       │
│  expressSettle()    → SETTLED (with proofHash)      │
│  verifyProof()      → on-chain audit trail          │
└───────────────────────┬─────────────────────────────┘
                        ↓ employee calls at any time
┌─────────────────────────────────────────────────────┐
│  StreamVault.claimVested()                          │
│  Redeems ERC-4626 shares → transfers salary         │
│  Polls every 5s on frontend — updates live          │
└───────────────────────┴─────────────────────────────┘
              Stream ends → closeStream() harvests yield
```

---

## 4. Smart Contracts

Five contracts deployed on HashKey Chain Testnet (Solidity 0.8.24 + Cancun EVM, OpenZeppelin v5):

| Contract | Purpose | Key Functions | Standard |
|----------|---------|---------------|----------|
| `MockUSDC.sol` | Test ERC-20 stablecoin with faucet | `faucet()`, `transfer()`, `approve()` | ERC-20 |
| `RWATierVault.sol` | Per-tier tokenized yield vault (internal) | `deposit()`, `redeem()`, `totalAssets()`, `convertToAssets()` | **ERC-4626** |
| `RWAYieldRouter.sol` | Orchestrates 3 ERC-4626 tier vaults | `deposit()`, `withdraw()`, `harvestYield()`, `getVaultAddress()` | Custom |
| `StreamVault.sol` | Core streaming, vesting & HSP integration | `createStream()`, `claimVested()`, `closeStream()` | Custom |
| `HSPSettlementEmitter.sol` | HSP settlement lifecycle state machine | `createSettlement()`, `expressSettle()`, `finalizeSettlement()`, `verifyProof()` | HSP |

### StreamVault — Core Logic

```solidity
function createStream(
    address employee,
    address token,
    uint256 totalAmount,
    uint256 duration,        // seconds (minimum 60)
    uint8 vaultTier,         // 0=Stable, 1=Balanced, 2=Growth
    string calldata aiReasoning  // GLM-4 reasoning stored on-chain
) external returns (uint256 streamId)
```

- Linear vesting: `vestedAmount = totalAmount × elapsedTime / duration`
- Capital immediately deposited to ERC-4626 vault on stream creation
- AI reasoning string stored on-chain and displayed in employee dashboard
- Every action auto-creates and express-settles an HSP settlement record

### RWAYieldRouter — ERC-4626 Vaults

```solidity
// Three independent ERC-4626 vaults — deployed inside the constructor
RWATierVault public stableVault;    // 400 bps = 4%
RWATierVault public balancedVault;  // 800 bps = 8%
RWATierVault public growthVault;    // 1200 bps = 12%

// Router holds shares on behalf of each stream
mapping(uint256 => VaultPosition) public positions; // streamId → shares
```

Each vault is a fully conformant ERC-4626 implementation. `harvestYield()` redeems all remaining shares after a stream ends and sends proceeds to the employer.

### HSPSettlementEmitter — State Machine

```solidity
enum SettlementStatus { PENDING, PROCESSING, SETTLED, DISPUTED, CANCELLED }
enum SettlementType   { STREAM_CREATED, STREAM_CLAIMED, STREAM_CLOSED, YIELD_HARVESTED }

// On-chain proof hash for every settlement
bytes32 proofHash = keccak256(abi.encodePacked(
    settlementId, employer, employee, token, amount, streamId, settlementType, timestamp
));
```

Every payroll action in `StreamVault` automatically calls `createSettlement()` + `expressSettle()` — the settlement transitions from `PENDING → SETTLED` atomically with a tamper-proof `proofHash` stored on-chain.

---

## 5. AI Agent

The AI runs as **Next.js serverless API routes** (deployed on Vercel) — no separate server required. Zhipu GLM-4 is the sole decision-maker.

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/recommend-vault` | POST | Autonomous vault recommendation with confidence score |
| `/api/analyze-risk` | POST | Multi-factor portfolio risk assessment |
| `/api/tiers` | GET | Vault tier metadata + live market context |
| `/api/health` | GET | Server status + AI mode indicator |

### How the AI Decides (Autonomous Mode)

No hard-coded if/else rules. GLM-4 receives a structured prompt containing:

| Input | Value |
|-------|-------|
| Stream parameters | Amount, duration, risk tolerance, employer profile |
| Market context | Risk-free rate (3M T-bill), credit spread, yield curve shape |
| Vault metrics | Sharpe ratios (2.1 / 1.4 / 0.9), max drawdowns, T+ liquidity days |
| Yield projections | Pre-calculated for all 3 tiers |

GLM-4 returns structured JSON:

```json
{
  "recommendedTier": 0,
  "confidence": 90,
  "primaryReason": "Duration-liquidity match is critical for short-term payroll streams.",
  "reasoning": "Given the 30-day stream duration, Tier 0's T+1 liquidity aligns perfectly...",
  "riskWarning": "Tier 0 may not keep pace with potential market gains if yield curve normalizes.",
  "alternativeTier": 1,
  "alternativeReason": "Employers seeking balance between risk and return might prefer Tier 1."
}
```

| Mode | Trigger | Decision Logic |
|------|---------|----------------|
| **Autonomous** | `ZHIPU_API_KEY` set | Full GLM-4 financial reasoning |
| **Fallback** | No API key | Duration-liquidity constraint rules |

---

## 6. RWA Vault Tiers

| Tier | Name | APY | ERC-4626 Symbol | Sharpe | Max Drawdown | Liquidity |
|------|------|-----|-----------------|--------|--------------|-----------|
| 0 | Stable | 4% | `sySTV` | 2.1 | ~0% | T+1 |
| 1 | Balanced | 8% | `syBAV` | 1.4 | ~3% | T+7 |
| 2 | Growth | 12% | `syGTV` | 0.9 | ~8% | T+30 |

**Yield Projection Examples:**

| Payroll | Duration | Vault | Projected Yield |
|---------|----------|-------|----------------|
| $10,000 | 30 days | Balanced (8%) | $65.75 |
| $100,000 | 30 days | Balanced (8%) | $657.53 |
| $500,000 | 30 days | Balanced (8%) | $3,287.67 |
| $1,000,000 | 90 days | Growth (12%) | $29,589.04 |

---

## 7. HSP (HashKey Settlement Protocol) Integration

### Settlement Lifecycle

Every payroll action in `StreamVault` creates and immediately express-settles an HSP record:

```
createStream()  → PENDING → SETTLED  (type: STREAM_CREATED)
claimVested()   → PENDING → SETTLED  (type: STREAM_CLAIMED)
closeStream()   → PENDING → SETTLED  (type: YIELD_HARVESTED, if yield > 0)
```

HSP supports a full two-phase settlement for larger or flagged amounts:

```
createSettlement()    → PENDING
processSettlement()   → PROCESSING
finalizeSettlement()  → SETTLED
```

Or dispute/cancel:
```
disputeSettlement()   → DISPUTED
cancelSettlement()    → CANCELLED
```

### On-Chain Proof

Every settlement carries a tamper-proof `proofHash` verifiable on-chain:

```solidity
function verifyProof(uint256 settlementId)
    external view returns (bool valid, bytes32 expectedHash)
```

### Settlement Indexes

Settlements are indexed by `employer`, `employee`, and `streamId` for efficient querying by any HSP-compatible downstream system.

---

## 8. Frontend

Next.js 14 app with wagmi v2, viem, and RainbowKit for wallet connectivity.

### Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Overview | Landing page with protocol explanation and vault tier comparison |
| `/employer` | Employer Dashboard | Create streams, get AI recommendation, approve & deploy |
| `/employee` | Employee Dashboard | View live vesting progress, claim salary any time |
| `/ai-insights` | AI Advisor | Interactive GLM-4 vault advisor with example scenarios |

### Key UX Features

- **Real-time vesting** — employee dashboard polls every 5 seconds; progress bar updates live
- **AI-in-form** — click "Get AI recommendation" before picking a vault; GLM-4 auto-selects the tier + fills in reasoning
- **AI reasoning on-chain** — GLM-4's reasoning text is passed as `aiReasoning` to `createStream()` and shown on the employee's stream card
- **Wallet-gated** — dashboards show a clean connect prompt until MetaMask is connected to Chain ID 133
- **Confidence + risk warning** — employer sees GLM-4's confidence score and risk warning before confirming

---

## 9. Deployed Contracts (HashKey Chain Testnet)

> Deployed at block height ~April 2026. Chain ID: 133. RPC: `https://testnet.hsk.xyz`

| Contract | Address |
|----------|---------|
| MockUSDC | [`0x2f60576867dd52A3fDFEc6710D42B4471A8534b5`](https://testnet-explorer.hsk.xyz/address/0x2f60576867dd52A3fDFEc6710D42B4471A8534b5) |
| RWAYieldRouter | [`0xDa75B46D38eB43c68FA87be38D4D50A410FC8016`](https://testnet-explorer.hsk.xyz/address/0xDa75B46D38eB43c68FA87be38D4D50A410FC8016) |
| StreamVault | [`0x5818ea2a9163Efec9761CeF45cDd4D3B0b532809`](https://testnet-explorer.hsk.xyz/address/0x5818ea2a9163Efec9761CeF45cDd4D3B0b532809) |
| HSPSettlementEmitter | [`0x3C3e73f0F092085c66c2804F17F5500743D735E2`](https://testnet-explorer.hsk.xyz/address/0x3C3e73f0F092085c66c2804F17F5500743D735E2) |

**ERC-4626 Sub-Vaults (created by RWAYieldRouter constructor):**

| Vault | Symbol | APY | Address |
|-------|--------|-----|---------|
| Stable | `sySTV` | 4% | [`0xb5d498db2cACdFA2fa7a6FCfaAc6A90040228B46`](https://testnet-explorer.hsk.xyz/address/0xb5d498db2cACdFA2fa7a6FCfaAc6A90040228B46) |
| Balanced | `syBAV` | 8% | [`0xa0B1557d4642665779Bf074697f97ef19D7446ab`](https://testnet-explorer.hsk.xyz/address/0xa0B1557d4642665779Bf074697f97ef19D7446ab) |
| Growth | `syGTV` | 12% | [`0x5C9f41E374119CDE073bceCD36A242B2434D2b03`](https://testnet-explorer.hsk.xyz/address/0x5C9f41E374119CDE073bceCD36A242B2434D2b03) |

---

## 10. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Blockchain** | HashKey Chain Testnet (Chain ID 133, Cancun EVM) |
| **Smart Contracts** | Solidity 0.8.24 + OpenZeppelin v5 |
| **Vault Standard** | ERC-4626 (3 independent tokenized vault contracts) |
| **Development** | Hardhat v2 (CommonJS) |
| **AI / LLM** | Zhipu GLM-4 — autonomous decision mode (no if/else rules) |
| **AI API** | Next.js 14 App Router API routes (`/api/recommend-vault`, `/api/analyze-risk`) |
| **Hosting** | Vercel (frontend + AI serverless functions, no separate backend) |
| **Web3** | wagmi v2 + viem + RainbowKit v2 |
| **Styling** | Tailwind CSS + custom dark theme |
| **Settlement** | HSP state machine (PENDING→PROCESSING→SETTLED lifecycle) |
| **Test Token** | MockUSDC (ERC-20 with permissionless faucet) |

---

## 11. Project Structure

```
streamyield/
├── contracts/                       # Hardhat project
│   ├── contracts/
│   │   ├── MockUSDC.sol             # ERC-20 test stablecoin (6 decimals)
│   │   ├── RWAYieldRouter.sol       # Orchestrator + deploys 3 ERC-4626 vaults
│   │   │   └─ RWATierVault (×3)    # Stable / Balanced / Growth ERC-4626 vaults
│   │   ├── StreamVault.sol          # Core streaming, vesting, HSP wiring
│   │   └── HSPSettlementEmitter.sol # Full HSP lifecycle state machine
│   ├── scripts/
│   │   └── deploy.js                # Deploy + link all contracts
│   ├── test/
│   │   └── StreamYield.test.js      # 18 tests across all contracts
│   ├── hardhat.config.js            # HashKey Testnet + Cancun EVM
│   ├── deployed-addresses.json      # Auto-generated with sub-vault addresses
│   └── .env                         # PRIVATE_KEY
│
├── backend/                         # Standalone Express server (local dev only)
│   ├── server.js                    # Express + autonomous GLM-4 decision engine
│   └── .env                         # ZHIPU_API_KEY, PORT
│
├── frontend/                        # Next.js 14 app (deployed on Vercel)
│   ├── app/
│   │   ├── api/                     # Serverless AI API routes (replaces backend on Vercel)
│   │   │   ├── recommend-vault/route.ts  # GLM-4 autonomous vault recommendation
│   │   │   ├── analyze-risk/route.ts     # Multi-factor risk assessment
│   │   │   ├── tiers/route.ts            # Vault metadata + market context
│   │   │   └── health/route.ts           # AI agent health check
│   │   ├── page.tsx                 # Landing page
│   │   ├── employer/page.tsx        # Employer dashboard (AI + stream creation)
│   │   ├── employee/page.tsx        # Employee dashboard (live vesting + claim)
│   │   ├── ai-insights/page.tsx     # GLM-4 vault advisor
│   │   ├── layout.tsx               # Root layout + providers
│   │   └── providers.tsx            # wagmi + RainbowKit + React Query
│   ├── lib/
│   │   ├── config.ts                # Contract addresses, ABIs, chain config
│   │   └── ai-logic.ts              # Shared GLM-4 + vault logic (used by API routes)
│   └── .env.local                   # Contract addresses + ZHIPU_API_KEY
│
└── README.md
```

---

## 12. Quick Start

### Live Demo

🌐 **[https://frontend-six-jade-81.vercel.app](https://frontend-six-jade-81.vercel.app)**

> Connect MetaMask to HashKey Chain Testnet (Chain ID 133) to interact with live contracts.

### Prerequisites
- Node.js 18+
- MetaMask with HashKey Chain Testnet added (Chain ID: 133, RPC: `https://testnet.hsk.xyz`)
- Some HSK for gas → [faucet.hsk.xyz](https://faucet.hsk.xyz)

### 1. Clone & Install

```bash
git clone https://github.com/himanshu-sugha/StreamYield
cd StreamYield

cd contracts && npm install
cd ../backend  && npm install
cd ../frontend && npm install
```

### 2. Configure Environment

**`frontend/.env.local`** (pre-filled with deployed addresses — no changes needed)
```env
NEXT_PUBLIC_MOCK_USDC_ADDRESS=0x2f60576867dd52A3fDFEc6710D42B4471A8534b5
NEXT_PUBLIC_RWA_ROUTER_ADDRESS=0xDa75B46D38eB43c68FA87be38D4D50A410FC8016
NEXT_PUBLIC_STREAM_VAULT_ADDRESS=0x5818ea2a9163Efec9761CeF45cDd4D3B0b532809
NEXT_PUBLIC_HSP_EMITTER_ADDRESS=0x3C3e73f0F092085c66c2804F17F5500743D735E2

# Optional — enables GLM-4 autonomous mode (server-side, not exposed to browser)
ZHIPU_API_KEY=your_zhipu_api_key
```

> Get a free Zhipu API key at [open.bigmodel.cn/usercenter/apikeys](https://open.bigmodel.cn/usercenter/apikeys)  
> Without it the AI runs in fallback mode (rules-based, still functional).

### 3. Run Locally

```bash
# Frontend (includes AI API routes — no separate backend needed)
cd frontend && npm run dev
# → http://localhost:3000
# → AI available at http://localhost:3000/api/recommend-vault
```

> The standalone `backend/` Express server still works for local development if preferred:
> ```bash
> cd backend && node server.js  # → http://localhost:3001
> # Set NEXT_PUBLIC_BACKEND_URL=http://localhost:3001 in frontend/.env.local
> ```

### 4. Get Testnet Tokens

1. **HSK (gas):** [faucet.hsk.xyz](https://faucet.hsk.xyz)
2. **mUSDC:** Call `faucet(yourAddress, amount)` on MockUSDC at `0x2f605...` via [HashKey Explorer](https://testnet-explorer.hsk.xyz/address/0x2f60576867dd52A3fDFEc6710D42B4471A8534b5#write)

### 5. Deploy Your Own Contracts (optional)

```bash
cd contracts
echo "PRIVATE_KEY=your_key" > .env
npx hardhat run scripts/deploy.js --network hashkeyTestnet
```

---

## 13. Testing

18 comprehensive tests across all 4 contracts:

```bash
cd contracts
npx hardhat test
```

```
StreamYield Protocol
  MockUSDC
    ✓ has 6 decimals
    ✓ faucet mints tokens to any address
  StreamVault
    ✓ emits StreamCreated on creation
    ✓ vested amount is 0 at stream start
    ✓ 50% vested at midpoint
    ✓ 100% vested at end of stream
    ✓ employee claims vested salary
    ✓ non-employee cannot claim
    ✓ cannot stream to self
    ✓ tracks streams for employer and employee
  RWAYieldRouter
    ✓ correct APY per tier in bps
    ✓ exposes ERC-4626 vault address for each tier
    ✓ unauthorized cannot call deposit directly
    ✓ stream creation deposits into ERC-4626 vault
  HSPSettlementEmitter
    ✓ stream creation creates and express-settles an HSP record
    ✓ claim creates a second STREAM_CLAIMED settlement
    ✓ verifyProof returns true for a valid settlement
    ✓ unauthorized cannot call createSettlement directly

18 passing (1s)
```

---

## 14. Track: PayFi

StreamYield is submitted to the **PayFi track**.

| PayFi Criteria | Implementation |
|----------------|----------------|
| **Real-time payments** | Per-second linear vesting — salary accrues every block, claimable instantly |
| **Capital efficiency** | Idle payroll deployed to ERC-4626 yield vaults from deposit to claim |
| **B2B use case** | Employer → Employee payroll streaming with on-chain audit trail |
| **HSP native** | Every payroll action creates + express-settles an HSP settlement record |
| **AI-optimised** | GLM-4 autonomously selects vault based on duration, risk, and market context |

**Core value proposition:** $2.3T in global payroll sits idle for up to 30 days. StreamYield captures that yield window.

| Company | Monthly Payroll | Yield/month (Balanced 8%) |
|---------|----------------|---------------------------|
| Startup | $50,000 | ~$330 |
| SME | $500,000 | ~$3,288 |
| Enterprise | $5,000,000 | ~$32,877 |

---

## 15. Screenshots & Demo

🌐 **Live Demo:** [https://frontend-six-jade-81.vercel.app](https://frontend-six-jade-81.vercel.app)

### Landing Page
*Left-aligned product layout — idle capital problem, per-second streaming explainer, vault tier comparison*

### AI Vault Advisor
*GLM-4 autonomous recommendation — confidence score, primary reason, risk warning, alternative tier, full market context*

### Employer Dashboard
*Stream creation form — AI recommendation auto-selects vault tier, GLM-4 reasoning stored on-chain in `aiReasoning` field*

### Employee Dashboard
*Live vesting progress bar (polls every 5s), claimable mUSDC balance, on-chain GLM-4 reasoning from when employer created the stream*

---

## License

MIT

---

## Author

Built by **Himanshu Sugha**  
Contact: himanshusugha@gmail.com  
GitHub: [@himanshu-sugha](https://github.com/himanshu-sugha)

---

*HashKey On-Chain Horizon Hackathon 2026 · PayFi Track*
