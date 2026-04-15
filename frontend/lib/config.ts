import { defineChain } from "viem";

export const hashkeyTestnet = defineChain({
    id: 133,
    name: "HashKey Chain Testnet",
    nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://testnet.hsk.xyz"] },
    },
    blockExplorers: {
        default: { name: "HashKey Explorer", url: "https://testnet-explorer.hsk.xyz" },
    },
    testnet: true,
});

// Deployed April 2026 — HashKey Chain Testnet (Chain ID 133)
// Fallbacks are the real deployed addresses — .env.local overrides for local dev only
export const CONTRACT_ADDRESSES = {
    MockUSDC:             process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS    || "0x2f60576867dd52A3fDFEc6710D42B4471A8534b5",
    RWAYieldRouter:       process.env.NEXT_PUBLIC_RWA_ROUTER_ADDRESS   || "0xDa75B46D38eB43c68FA87be38D4D50A410FC8016",
    StreamVault:          process.env.NEXT_PUBLIC_STREAM_VAULT_ADDRESS || "0x5818ea2a9163Efec9761CeF45cDd4D3B0b532809",
    HSPSettlementEmitter: process.env.NEXT_PUBLIC_HSP_EMITTER_ADDRESS  || "0x3C3e73f0F092085c66c2804F17F5500743D735E2",
};

// Empty = use relative /api/* routes (Next.js API routes on Vercel)
// Set to http://localhost:3001 to use the standalone Express backend locally
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const STREAM_VAULT_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "employee", "type": "address" },
            { "internalType": "address", "name": "token", "type": "address" },
            { "internalType": "uint256", "name": "totalAmount", "type": "uint256" },
            { "internalType": "uint256", "name": "duration", "type": "uint256" },
            { "internalType": "uint8", "name": "vaultTier", "type": "uint8" },
            { "internalType": "string", "name": "aiReasoning", "type": "string" }
        ],
        "name": "createStream",
        "outputs": [{ "internalType": "uint256", "name": "streamId", "type": "uint256" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "streamId", "type": "uint256" }],
        "name": "claimVested",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "streamId", "type": "uint256" }],
        "name": "getVestedAmount",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "streamId", "type": "uint256" }],
        "name": "getClaimable",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "streamId", "type": "uint256" }],
        "name": "getStream",
        "outputs": [
            {
                "components": [
                    { "internalType": "address", "name": "employer", "type": "address" },
                    { "internalType": "address", "name": "employee", "type": "address" },
                    { "internalType": "address", "name": "token", "type": "address" },
                    { "internalType": "uint256", "name": "totalAmount", "type": "uint256" },
                    { "internalType": "uint256", "name": "startTime", "type": "uint256" },
                    { "internalType": "uint256", "name": "endTime", "type": "uint256" },
                    { "internalType": "uint256", "name": "claimedAmount", "type": "uint256" },
                    { "internalType": "uint8", "name": "vaultTier", "type": "uint8" },
                    { "internalType": "bool", "name": "active", "type": "bool" },
                    { "internalType": "string", "name": "aiReasoning", "type": "string" }
                ],
                "internalType": "struct StreamVault.Stream",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "employer", "type": "address" }],
        "name": "getEmployerStreams",
        "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "employee", "type": "address" }],
        "name": "getEmployeeStreams",
        "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
        "stateMutability": "view",
        "type": "function"
    }
];

export const ERC20_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "spender", "type": "address" },
            { "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "to", "type": "address" },
            { "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "faucet",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];
