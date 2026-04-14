# StreamYield — AI-Optimized Payroll Streaming on HashKey Chain

> **PayFi protocol that streams employee salaries per-second while an AI agent routes unvested capital into RWA yield vaults on HashKey Chain — turning payroll from a cost center into a profit center.**

[![HashKey Chain](https://img.shields.io/badge/HashKey%20Chain-Testnet%20133-6366f1)](https://testnet-explorer.hsk.xyz)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636)](https://soliditylang.org)
[![Tests](https://img.shields.io/badge/Tests-14%2F14%20passing-10b981)](./contracts/test)
[![AI](https://img.shields.io/badge/AI-Zhipu%20GLM--4-a855f7)](https://open.bigmodel.cn)
[![Tracks](https://img.shields.io/badge/Tracks-PayFi%20%7C%20DeFi%20%7C%20AI-f59e0b)](https://dorahacks.io/hackathon/2045)

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

1. **Employer deposits payroll** into `StreamVault` — capital is immediately deployed to an RWA yield vault
2. **AI selects the optimal vault** — Zhipu GLM-4 analyses duration, amount, and risk tolerance to recommend Stable (4%), Balanced (8%), or Growth (12%) APY
3. **Salary streams per-second** — employees accumulate vested salary every block; no waiting until month-end
4. **Employer collects yield** — when the stream closes, the employer withdraws all accumulated RWA yield

**Example:** A company with $500K monthly payroll earns **~$3,300/month** in yield from the Balanced vault instead of $0 from a traditional bank account.

---

## 2. The Problem

| Metric | Traditional Payroll | StreamYield |
|--------|-------------------|-------------|
| Capital utilization | 0% (idle in bank) | 4–12% APY in RWA vaults |
| Payment frequency | Monthly batch | Per-second streaming |
| Employee liquidity | 0 until payday | Claimable any time |
| Yield to employer | $0 | Projected $3K–$40K/month per $500K payroll |
| Settlement standard | Bank wire | HSP on HashKey Chain |

---

## 3. How It Works

```
Employer deposits $100K payroll capital
          │
          ▼
┌─────────────────────────────────────────────────────┐
│  StreamVault.createStream()                         │
│  Lock capital → Route to RWAYieldRouter             │
│  → Emit HSPSettlementEvent                          │
└───────────────────────┬─────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│  AI Agent Backend (Node.js + Zhipu GLM-4)           │
│  Analyse: duration + amount + risk tolerance        │
│  → Recommend vault tier (Stable/Balanced/Growth)    │
│  → Generate human-readable reasoning                │
└───────────────────────┬─────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│  RWAYieldRouter                                     │
│  Route capital to selected vault tier               │
│  → Accrue yield per-second (4% / 8% / 12% APY)     │
└───────────────────────┬─────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│  Per-second vesting (StreamVault)                   │
│  Employee calls getClaimable() → claimVested()      │
│  → Receives salary pro-rated to the second          │
└───────────────────────┬─────────────────────────────┘
                        ▼
            Stream ends → Employer withdraws yield
```

---

## 4. Smart Contracts

Four contracts deployed on HashKey Chain Testnet (Solidity 0.8.24, OpenZeppelin v5):

| Contract | Purpose | Key Functions |
|----------|---------|---------------|
| `MockUSDC.sol` | Test ERC-20 stablecoin | `faucet()`, `transfer()`, `approve()` |
| `RWAYieldRouter.sol` | Routes capital to 3 yield tiers | `deposit()`, `withdraw()`, `getYield()` |
| `StreamVault.sol` | Core streaming & vesting logic | `createStream()`, `claimVested()`, `getClaimable()` |
| `HSPSettlementEmitter.sol` | HashKey Settlement Protocol events | `emitSettlement()` |

### StreamVault — Core Logic

```solidity
function createStream(
    address employee,
    address token,
    uint256 totalAmount,
    uint256 duration,        // seconds
    uint8 vaultTier,         // 0=Stable, 1=Balanced, 2=Growth
    string calldata aiReasoning
) external returns (uint256 streamId)
```

- Linear vesting: `vestedAmount = totalAmount × elapsedTime / duration`
- Capital immediately deployed to `RWAYieldRouter` on stream creation
- AI reasoning string stored on-chain, displayed in employee dashboard
- Employer stream registry + employee stream registry for easy lookup

### RWAYieldRouter — Yield Tiers

```solidity
// Tiered APY rates (simulated on testnet)
uint256 public constant STABLE_APY  = 400;   // 4%
uint256 public constant BALANCED_APY = 800;  // 8%
uint256 public constant GROWTH_APY   = 1200; // 12%
```

Yield accrues linearly per-second based on principal × APY × elapsed time.

### HSPSettlementEmitter — Protocol Integration

```solidity
event SettlementEvent(
    address indexed employer,
    address indexed employee,
    address token,
    uint256 amount,
    uint256 streamId,
    uint256 timestamp,
    string settlementType   // "STREAM_CREATED" | "STREAM_CLAIMED"
);
```

Every payroll action emits a structured HSP-compatible event for compliance and settlement tracking.

---

## 5. AI Agent Backend

A Node.js/Express server that wraps Zhipu GLM-4 for vault recommendations.

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/recommend-vault` | POST | Get AI vault recommendation for a stream |
| `/api/tiers` | GET | Fetch all vault tier metadata |
| `/health` | GET | Server health check |

### How the AI Decides

The backend uses a **hybrid approach** — a rules engine for speed and accuracy, GLM-4 for human-readable reasoning:

**Step 1: Rules engine scores the stream**

| Condition | Recommended Tier |
|-----------|-----------------|
| Duration < 30 days OR risk = low | Stable (4%) |
| Duration 30–89 days OR risk = medium | Balanced (8%) |
| Duration ≥ 90 days AND risk = high | Growth (12%) |

**Step 2: Zhipu GLM-4 generates reasoning**

```
Input:  $10,000 stream, 30 days, medium risk
Output: "The Balanced vault was selected because it offers a 
         moderate risk-reward profile perfectly matching your 
         30-day payroll stream. Expected yield: $65.75 USDC."
```

**Fallback:** If no API key is set, a smart template generates the reasoning. The app works 100% without the AI key.

| Feature | With Zhipu Key | Without Key |
|---------|----------------|-------------|
| Vault recommendation | GLM-4 generated | Rules-based |
| Reasoning text | Natural language | Template string |
| Projected yield | Calculated | Calculated |
| Response time | ~3 seconds | ~50ms |

---

## 6. RWA Vault Tiers

| Tier | Name | APY | Risk | Best For | Real-World Assets |
|------|------|-----|------|----------|-------------------|
| 0 | Stable | 4% | Conservative | Streams < 30 days | T-bills, money market funds |
| 1 | Balanced | 8% | Moderate | 30–90 day payroll | Real estate + corporate bonds |
| 2 | Growth | 12% | Aggressive | Streams > 90 days | Private credit, high-yield RE |

**Yield Projection Examples** (based on `projectedYield = principal × APY × (days/365)`):

| Payroll | Duration | Vault | Projected Yield |
|---------|----------|-------|----------------|
| $10,000 | 30 days | Balanced (8%) | $65.75 |
| $100,000 | 30 days | Balanced (8%) | $657.53 |
| $500,000 | 30 days | Balanced (8%) | $3,287.67 |
| $1,000,000 | 90 days | Growth (12%) | $29,589.04 |

---

## 7. HSP (HashKey Settlement Protocol) Integration

`HSPSettlementEmitter.sol` emits structured settlement events on every payroll action, making StreamYield natively compatible with HashKey's settlement infrastructure.

**Settlement payload structure:**

```json
{
  "employer":       "0xC1425Db1...",
  "employee":       "0x...",
  "token":          "0x1ecED1...",
  "amount":         "10000000000",
  "streamId":       0,
  "timestamp":      1744609200,
  "settlementType": "STREAM_CREATED"
}
```

Events are indexed by both `employer` and `employee` addresses, enabling any HSP-compatible system to subscribe and process settlements in real time.

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

- **Real-time vesting** — employee dashboard polls every 5 seconds; progress bar updates automatically
- **AI-in-form** — employer can click "Get AI recommendation" before picking a vault; recommendation auto-selects the tier
- **Store AI reasoning on-chain** — the GLM-4 reasoning text is passed as `aiReasoning` argument to `createStream()` and displayed on the employee's stream card
- **Wallet-gated** — dashboards show a clean connect prompt until MetaMask is connected to Chain ID 133

---

## 9. Deployed Contracts (HashKey Chain Testnet)

| Contract | Address |
|----------|---------|
| MockUSDC | [`0x1ecED1DDBF70987d28659fd83fA9B24D884bDB87`](https://testnet-explorer.hsk.xyz/address/0x1ecED1DDBF70987d28659fd83fA9B24D884bDB87) |
| RWAYieldRouter | [`0x96f132319963f885700C985f72037C3F3425D138`](https://testnet-explorer.hsk.xyz/address/0x96f132319963f885700C985f72037C3F3425D138) |
| StreamVault | [`0x0507302FBDACEc8D9A83E722Ce016064a6578848`](https://testnet-explorer.hsk.xyz/address/0x0507302FBDACEc8D9A83E722Ce016064a6578848) |
| HSPSettlementEmitter | [`0x5b654a8A5bBFc3aC337Dfcb044175dA549aEBfbB`](https://testnet-explorer.hsk.xyz/address/0x5b654a8A5bBFc3aC337Dfcb044175dA549aEBfbB) |

**Network:** HashKey Chain Testnet · Chain ID: 133 · RPC: `https://testnet.hsk.xyz`

---

## 10. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Blockchain** | HashKey Chain Testnet (Chain ID 133) |
| **Smart Contracts** | Solidity 0.8.24 + OpenZeppelin v5 |
| **Development** | Hardhat v2 (CommonJS) |
| **AI / LLM** | Zhipu GLM-4 via `openai` SDK (OpenAI-compatible endpoint) |
| **AI Backend** | Node.js 18 + Express |
| **Frontend** | Next.js 14 (App Router) + TypeScript |
| **Web3** | wagmi v2 + viem + RainbowKit v2 |
| **Styling** | Tailwind CSS + custom dark theme |
| **Settlement** | HSP (HashKey Settlement Protocol) |
| **Test Token** | MockUSDC (ERC-20 with faucet) |

---

## 11. Project Structure

```
streamyield/
├── contracts/                    # Hardhat project
│   ├── contracts/
│   │   ├── MockUSDC.sol          # Test ERC-20 stablecoin
│   │   ├── RWAYieldRouter.sol    # 3-tier RWA yield vault
│   │   ├── StreamVault.sol       # Core streaming + vesting
│   │   └── HSPSettlementEmitter.sol # HSP settlement events
│   ├── scripts/
│   │   └── deploy.js             # Full deployment script
│   ├── test/
│   │   └── StreamYield.test.js   # 14 comprehensive tests
│   ├── hardhat.config.js         # HashKey Chain Testnet config
│   ├── deployed-addresses.json   # Auto-generated after deploy
│   └── .env                      # PRIVATE_KEY
│
├── backend/                      # AI Agent service
│   ├── server.js                 # Express server + GLM-4 integration
│   ├── package.json
│   └── .env                      # ZHIPU_API_KEY, PORT
│
└── frontend/                     # Next.js 14 app
    ├── app/
    │   ├── page.tsx              # Landing page
    │   ├── employer/page.tsx     # Employer dashboard
    │   ├── employee/page.tsx     # Employee dashboard
    │   ├── ai-insights/page.tsx  # AI vault advisor
    │   ├── layout.tsx            # Root layout + providers
    │   ├── providers.tsx         # wagmi + RainbowKit + React Query
    │   └── globals.css           # Design system
    ├── components/
    │   └── Navbar.tsx            # Navigation bar
    ├── lib/
    │   └── config.ts             # Contract addresses, ABIs, chain config
    └── .env.local                # NEXT_PUBLIC_* contract addresses
```

---

## 12. Quick Start

### Prerequisites
- Node.js 18+
- MetaMask with HashKey Chain Testnet added (Chain ID: 133, RPC: `https://testnet.hsk.xyz`)
- Some HSK for gas → [faucet.hsk.xyz](https://faucet.hsk.xyz)

### 1. Clone & Install

```bash
git clone https://github.com/himanshu-sugha/streamyield
cd streamyield

# Install all three packages
cd contracts && npm install
cd ../backend && npm install
cd ../frontend && npm install
```

### 2. Configure Environment

**`contracts/.env`**
```env
PRIVATE_KEY=your_deployer_private_key
```

**`backend/.env`**
```env
ZHIPU_API_KEY=your_zhipu_api_key   # Free at: https://open.bigmodel.cn/usercenter/apikeys
PORT=3001
```

**`frontend/.env.local`** (pre-filled with deployed addresses)
```env
NEXT_PUBLIC_MOCK_USDC_ADDRESS=0x1ecED1DDBF70987d28659fd83fA9B24D884bDB87
NEXT_PUBLIC_RWA_ROUTER_ADDRESS=0x96f132319963f885700C985f72037C3F3425D138
NEXT_PUBLIC_STREAM_VAULT_ADDRESS=0x0507302FBDACEc8D9A83E722Ce016064a6578848
NEXT_PUBLIC_HSP_EMITTER_ADDRESS=0x5b654a8A5bBFc3aC337Dfcb044175dA549aEBfbB
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### 3. Run Locally

```bash
# Terminal 1 — AI backend
cd backend && node server.js
# → http://localhost:3001

# Terminal 2 — Frontend
cd frontend && npm run dev
# → http://localhost:3000
```

### 4. Get Testnet Tokens

1. **HSK (gas):** [faucet.hsk.xyz](https://faucet.hsk.xyz)
2. **mUSDC (test stablecoin):** Call `faucet()` on the MockUSDC contract at `0x1ecED1...` via HashKey Explorer write tab

### 5. Deploy Your Own Contracts (optional)

```bash
cd contracts
npx hardhat run scripts/deploy.js --network hashkeyTestnet
# Generates deployed-addresses.json and prints all addresses
```

---

## 13. Testing

14 unit tests covering all core financial flows:

```bash
cd contracts
npx hardhat test
```

```
StreamYield Protocol Tests
  MockUSDC
    ✓ should have correct name and symbol
    ✓ should mint tokens via faucet
  RWAYieldRouter
    ✓ should have correct APY rates (4%, 8%, 12%)
    ✓ should deposit and track balance
    ✓ should accrue yield over time
    ✓ should withdraw principal and yield
  StreamVault
    ✓ should create a stream and transfer tokens
    ✓ should calculate vested amount correctly
    ✓ should return 0 vested at stream start
    ✓ should allow employee to claim vested tokens
    ✓ should track employer and employee streams
  HSPSettlementEmitter
    ✓ should emit settlement event with correct fields
    ✓ should allow owner to emit settlement
    ✓ should reject unauthorized callers

14 passing (929ms)
```

---

## 14. Multi-Track Coverage

| Track | How StreamYield Qualifies |
|-------|--------------------------|
| **PayFi** | Real-time per-second B2B payroll streaming via `StreamVault` |
| **DeFi** | `RWAYieldRouter` routes capital into 3 yield tiers; yield accrues autonomously |
| **AI** | Zhipu GLM-4 agent makes vault routing decisions and generates natural language reasoning stored on-chain |

**3 out of 4 hackathon tracks covered** in a single, coherent protocol.

---

## 15. Screenshots

### Landing Page
*Left-aligned product layout with protocol overview and vault tier comparison*

### AI Vault Advisor
*Zhipu GLM-4 recommendation: Balanced vault, 8% APY, $65.75 projected yield — with full reasoning*

### Employer Dashboard
*Stream creation form with AI recommendation panel and vault tier selector*

### Employee Dashboard
*Real-time vesting progress bar (polls every 5s) with claimable balance and on-chain AI reasoning*

---

## License

MIT

---

## Author

Built by **Himanshu Sugha**  
Contact: himanshusugha@gmail.com  
GitHub: [@himanshu-sugha](https://github.com/himanshu-sugha)

---

*HashKey On-Chain Horizon Hackathon 2026 · PayFi + DeFi + AI tracks*
