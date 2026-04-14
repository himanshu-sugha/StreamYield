import { createConfig, http } from "wagmi";
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

// Deployed April 2026 — full protocol (ERC-4626 + Autonomous AI + HSP State Machine)
export const CONTRACT_ADDRESSES = {
    MockUSDC:            process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS    || "0x0000000000000000000000000000000000000000",
    RWAYieldRouter:      process.env.NEXT_PUBLIC_RWA_ROUTER_ADDRESS   || "0x0000000000000000000000000000000000000000",
    StreamVault:         process.env.NEXT_PUBLIC_STREAM_VAULT_ADDRESS || "0x0000000000000000000000000000000000000000",
    HSPSettlementEmitter: process.env.NEXT_PUBLIC_HSP_EMITTER_ADDRESS || "0x0000000000000000000000000000000000000000",
};

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

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
