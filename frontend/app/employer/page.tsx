"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useReadContract } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import Navbar from "@/components/Navbar";
import { CONTRACT_ADDRESSES, STREAM_VAULT_ABI, ERC20_ABI, BACKEND_URL } from "@/lib/config";

const TIER_INFO = [
  { id: 0, name: "Stable",   apy: "4%",  risk: "Conservative", badgeCls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { id: 1, name: "Balanced", apy: "8%",  risk: "Moderate",     badgeCls: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"  },
  { id: 2, name: "Growth",   apy: "12%", risk: "Aggressive",   badgeCls: "bg-amber-500/10 text-amber-400 border-amber-500/20"     },
];

interface AIRecommendation {
  tier: number;
  tierName: string;
  apy: string;
  projectedYieldUSD: string;
  aiReasoning: string;
}

// ── Step enum so UI always shows the right label ──────────────────────────────
type Step = "idle" | "approving" | "creating" | "done";

export default function EmployerPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isWrongNetwork = chainId !== 133;

  const [form, setForm]         = useState({ employee: "", amount: "", duration: "30", riskTolerance: "medium" });
  const [aiResult, setAiResult] = useState<AIRecommendation | null>(null);
  const [loading, setLoading]   = useState(false);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [step, setStep]         = useState<Step>("idle");
  const [pendingCreate, setPendingCreate] = useState(false);

  // Live mUSDC balance
  const { data: rawBalance, refetch: refetchBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
    query: { enabled: !!address },
  });
  const mUSDCBalance = rawBalance ? formatUnits(rawBalance as bigint, 6) : "0";
  const amountNeeded = form.amount ? parseFloat(form.amount) : 0;
  const hasEnough    = parseFloat(mUSDCBalance) >= amountNeeded;
  const shortfall    = Math.max(0, amountNeeded - parseFloat(mUSDCBalance)).toFixed(2); // gate: only call createStream once per approval

  // ── Two separate write hooks — one per tx ─────────────────────────────────
  const {
    writeContract: writeApprove,
    isPending: approvePending,
    data: approveHash,
    error: approveError,
  } = useWriteContract();

  const {
    writeContract: writeCreate,
    isPending: createPending,
    data: createHash,
    error: createError,
  } = useWriteContract();

  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isSuccess: createSuccess  } = useWaitForTransactionReceipt({ hash: createHash  });

  // ── Step 1: Approve ───────────────────────────────────────────────────────
  const handleApproveAndCreate = () => {
    if (!form.employee || !form.amount || selectedTier === null) return;
    if (isWrongNetwork) return; // guard — shouldn't be reachable since button is disabled
    const amount = parseUnits(form.amount, 6);
    console.log("[StreamYield] Step 1: approving", amount.toString(), "mUSDC for StreamVault");
    setStep("approving");
    setPendingCreate(true);
    writeApprove({
      address: CONTRACT_ADDRESSES.MockUSDC as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACT_ADDRESSES.StreamVault as `0x${string}`, amount],
    });
  };

  // ── Step 2: CreateStream — fires automatically after approve confirms ─────
  useEffect(() => {
    if (!approveSuccess || !pendingCreate) return;
    setPendingCreate(false);
    setStep("creating");
    console.log("[StreamYield] Approval confirmed — Step 2: createStream");

    const amount      = parseUnits(form.amount, 6);
    const durationSec = BigInt(Math.max(60, parseInt(form.duration) * 86400));
    const reasoning   = aiResult?.aiReasoning ?? "Manual vault selection.";
    console.log("[StreamYield] createStream args:", { employee: form.employee, amount: amount.toString(), durationSec: durationSec.toString(), tier: selectedTier, reasoning });

    writeCreate({
      address: CONTRACT_ADDRESSES.StreamVault as `0x${string}`,
      abi: STREAM_VAULT_ABI,
      functionName: "createStream",
      args: [
        form.employee as `0x${string}`,
        CONTRACT_ADDRESSES.MockUSDC as `0x${string}`,
        amount,
        durationSec,
        selectedTier as number,
        reasoning,
      ],
    });
  }, [approveSuccess, pendingCreate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Done ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (createSuccess) setStep("done");
  }, [createSuccess]);

  // ── Label helpers ─────────────────────────────────────────────────────────
  const buttonLabel = () => {
    if (step === "approving" || approvePending) return "Step 1/2 — Approving mUSDC…";
    if (step === "creating"  || createPending)  return "Step 2/2 — Creating stream…";
    return "Approve & create stream";
  };

  const isBusy = approvePending || createPending || step === "approving" || step === "creating";
  const txError = approveError || createError;
  const txErrorMsg = txError
    ? (txError as { shortMessage?: string }).shortMessage ?? txError.message ?? "Transaction failed"
    : null;

  // Refetch balance after successful stream creation
  useEffect(() => { if (createSuccess) refetchBalance(); }, [createSuccess, refetchBalance]);

  // ── AI recommendation ─────────────────────────────────────────────────────
  const handleAskAI = async () => {
    if (!form.amount || !form.duration) return;
    setLoading(true);
    setAiResult(null);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/recommend-vault`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount:        parseFloat(form.amount),
          durationDays:  parseInt(form.duration),
          riskTolerance: form.riskTolerance,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAiResult(data.recommendation);
        setSelectedTier(data.recommendation.tier);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <main>
        <div className="gradient-bg" />
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2">Connect your wallet</h2>
            <p className="text-sm text-slate-500">Connect MetaMask to HashKey Chain Testnet (Chain ID 133) to continue.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="gradient-bg" />
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 pt-24 pb-16">

        {/* Wrong network banner */}
        {isWrongNetwork && (
          <div className="mb-6 border border-amber-500/30 rounded-xl p-4 bg-amber-500/5 flex items-center gap-3">
            <span className="text-amber-400 text-lg">⚠</span>
            <div>
              <p className="text-sm font-medium text-amber-300">Wrong network — connected to Chain ID {chainId}</p>
              <p className="text-xs text-slate-500 mt-0.5">Switch MetaMask to <strong>HashKey Chain Testnet</strong> (Chain ID 133, RPC: https://testnet.hsk.xyz) to create streams.</p>
            </div>
          </div>
        )}

        {/* Page header */}
        <div className="mb-8 pt-4">
          <h1 className="text-xl font-semibold mb-1">Employer dashboard</h1>
          <p className="text-sm text-slate-500">Create a payroll stream and let the AI route unvested capital to the best yield vault.</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">

          {/* Left — Stream form */}
          <div className="lg:col-span-3 space-y-4">

            {/* Form */}
            <div className="border border-white/5 rounded-xl bg-white/[0.02] p-6">
              <h2 className="text-sm font-semibold mb-5 text-slate-300">Stream details</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Employee wallet address</label>
                  <input
                    className="form-input"
                    placeholder="0x..."
                    value={form.employee}
                    onChange={(e) => setForm({ ...form, employee: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Amount (mUSDC)</label>
                    <input
                      className="form-input"
                      type="number"
                      placeholder="1000"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Duration (days)</label>
                    <input
                      className="form-input"
                      type="number"
                      placeholder="30"
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Risk tolerance</label>
                  <select
                    className="form-input"
                    value={form.riskTolerance}
                    onChange={(e) => setForm({ ...form, riskTolerance: e.target.value })}
                  >
                    <option value="low">Conservative — preserve capital</option>
                    <option value="medium">Moderate — balanced growth</option>
                    <option value="high">Aggressive — maximise yield</option>
                  </select>
                </div>
                <button
                  className="btn-secondary w-full text-sm"
                  onClick={handleAskAI}
                  disabled={loading || !form.amount || !form.duration}
                >
                  {loading ? "Analysing with GLM-4…" : "Get AI vault recommendation"}
                </button>
              </div>

              {/* Balance indicator */}
              {address && (
                <div className={`mt-4 pt-4 border-t border-white/5 flex items-center justify-between`}>
                  <span className="text-xs text-slate-500">Your mUSDC balance</span>
                  <span className={`text-xs font-semibold ${
                    !form.amount ? "text-slate-300" :
                    hasEnough ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {parseFloat(mUSDCBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })} mUSDC
                  </span>
                </div>
              )}

              {/* Insufficient balance warning */}
              {address && form.amount && !hasEnough && (
                <div className="mt-3 border border-red-500/20 rounded-lg p-3 bg-red-500/5">
                  <p className="text-xs text-red-400 font-medium mb-1">Insufficient mUSDC balance</p>
                  <p className="text-xs text-slate-400 mb-2">
                    You need <strong>{shortfall} more mUSDC</strong>. Use the faucet to get free testnet tokens.
                  </p>
                  <a
                    href={`https://testnet-explorer.hsk.xyz/address/0x2f60576867dd52A3fDFEc6710D42B4471A8534b5#write`}
                    target="_blank"
                    rel="noopener"
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    → Call faucet() on MockUSDC (HashKey Explorer)
                  </a>
                </div>
              )}
            </div>

            {/* Vault tier selector */}
            <div className="border border-white/5 rounded-xl bg-white/[0.02] p-6">
              <h2 className="text-sm font-semibold mb-4 text-slate-300">Select vault tier</h2>
              <div className="grid grid-cols-3 gap-3">
                {TIER_INFO.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTier(t.id)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      selectedTier === t.id
                        ? "border-indigo-500/50 bg-indigo-500/5"
                        : "border-white/5 bg-white/[0.01] hover:border-white/10"
                    }`}
                  >
                    <div className="text-base font-bold text-white mb-0.5">{t.apy}</div>
                    <div className="text-xs text-slate-400 mb-2">{t.name}</div>
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${t.badgeCls}`}>{t.risk}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step indicator */}
            {step !== "idle" && step !== "done" && (
              <div className="border border-indigo-500/20 rounded-lg p-4 bg-indigo-500/5 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-indigo-300">{buttonLabel()}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {step === "approving"
                      ? "Confirm the approval in MetaMask. This lets StreamVault move your mUSDC."
                      : "Approval confirmed — confirm the stream creation in MetaMask."}
                  </p>
                </div>
              </div>
            )}

            {/* Error display */}
            {txErrorMsg && step !== "done" && (
              <div className="border border-red-500/20 rounded-lg p-4 bg-red-500/5">
                <p className="text-xs font-medium text-red-400 mb-1">Transaction error</p>
                <p className="text-xs text-slate-400">{txErrorMsg}</p>
                <button
                  className="text-xs text-slate-500 hover:text-slate-300 mt-2 underline"
                  onClick={() => setStep("idle")}
                >
                  Reset and try again
                </button>
              </div>
            )}

            {/* Submit */}
            <button
              className="btn-primary w-full py-3 text-sm"
              onClick={handleApproveAndCreate}
              disabled={!form.employee || !form.amount || selectedTier === null || isBusy || step === "done" || isWrongNetwork || (!!form.amount && !hasEnough)}
            >
              {buttonLabel()}
            </button>

            {step === "done" && (
              <div className="border border-emerald-500/20 rounded-lg p-4 bg-emerald-500/5 text-center">
                <p className="text-sm text-emerald-400 font-medium mb-1">✓ Stream created successfully</p>
                <p className="text-xs text-slate-500 mb-2">Share the stream ID with your employee so they can track their salary.</p>
                {createHash && (
                  <a
                    href={`https://testnet-explorer.hsk.xyz/tx/${createHash}`}
                    target="_blank"
                    rel="noopener"
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    View on HashKey Explorer →
                  </a>
                )}
                <button
                  className="btn-secondary text-xs py-1.5 px-4 mt-3 block w-full"
                  onClick={() => { setStep("idle"); setForm({ employee: "", amount: "", duration: "30", riskTolerance: "medium" }); setSelectedTier(null); setAiResult(null); }}
                >
                  Create another stream
                </button>
              </div>
            )}
          </div>

          {/* Right — AI panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="border border-white/5 rounded-xl bg-white/[0.02] p-6">
              <h2 className="text-sm font-semibold mb-1 text-slate-300">AI recommendation</h2>
              <p className="text-xs text-slate-600 mb-5">Powered by Zhipu GLM-4</p>

              {!aiResult && !loading && (
                <div className="text-center py-10 text-slate-600">
                  <p className="text-xs">Fill in the stream details and click<br />{'"Get AI vault recommendation"'}</p>
                </div>
              )}

              {loading && (
                <div className="text-center py-10">
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs text-slate-500">GLM-4 is analysing your stream…</p>
                </div>
              )}

              {aiResult && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Recommended tier</span>
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${TIER_INFO[aiResult.tier].badgeCls}`}>
                      {aiResult.tierName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Vault APY</span>
                    <span className="text-sm font-semibold text-emerald-400">{aiResult.apy}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Projected yield</span>
                    <span className="text-sm font-semibold text-amber-400">${aiResult.projectedYieldUSD} USDC</span>
                  </div>
                  <div className="border-t border-white/5 pt-4">
                    <p className="text-xs text-slate-600 mb-2">GLM-4 reasoning</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{aiResult.aiReasoning}</p>
                  </div>
                  <button
                    className="btn-primary w-full text-xs py-2"
                    onClick={() => setSelectedTier(aiResult.tier)}
                  >
                    Apply recommendation
                  </button>
                </div>
              )}
            </div>

            {/* Faucet info */}
            <div className="border border-white/5 rounded-xl bg-white/[0.02] p-5">
              <h2 className="text-xs font-semibold text-slate-400 mb-3">Need testnet tokens?</h2>
              <div className="space-y-2">
                <a
                  href="https://faucet.hsk.xyz"
                  target="_blank"
                  rel="noopener"
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors block"
                >
                  HSK (gas) → faucet.hsk.xyz
                </a>
                <div className="text-xs text-slate-600">
                  <p className="mb-1">mUSDC — call <code className="text-indigo-400">faucet(yourAddress, amount)</code>:</p>
                  <a
                    href="https://testnet-explorer.hsk.xyz/address/0x2f60576867dd52A3fDFEc6710D42B4471A8534b5#write"
                    target="_blank"
                    rel="noopener"
                    className="text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    MockUSDC on HashKey Explorer →
                  </a>
                  <p className="text-slate-700 mt-1">amount: 1000000000 = 1,000 mUSDC (6 decimals)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
