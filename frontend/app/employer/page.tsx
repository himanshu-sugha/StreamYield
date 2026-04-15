"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import Navbar from "@/components/Navbar";
import { CONTRACT_ADDRESSES, ERC20_ABI, BACKEND_URL } from "@/lib/config";

const TIER_INFO = [
  { id: 0, name: "Stable", apy: "4%", risk: "Conservative", badgeCls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { id: 1, name: "Balanced", apy: "8%", risk: "Moderate", badgeCls: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  { id: 2, name: "Growth", apy: "12%", risk: "Aggressive", badgeCls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
];

interface AIRecommendation {
  tier: number;
  tierName: string;
  apy: string;
  projectedYieldUSD: string;
  aiReasoning: string;
}

export default function EmployerPage() {
  const { isConnected } = useAccount();
  const [form, setForm] = useState({ employee: "", amount: "", duration: "30", riskTolerance: "medium" });
  const [aiResult, setAiResult] = useState<AIRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

  const { writeContract, isPending, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleAskAI = async () => {
    if (!form.amount || !form.duration) return;
    setLoading(true);
    setAiResult(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/recommend-vault`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(form.amount),
          durationDays: parseInt(form.duration),
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

  const handleApproveAndCreate = async () => {
    if (!form.employee || !form.amount || selectedTier === null) return;
    const amount = parseUnits(form.amount, 6);
    writeContract({
      address: CONTRACT_ADDRESSES.MockUSDC as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACT_ADDRESSES.StreamVault as `0x${string}`, amount],
    });
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
            <p className="text-sm text-slate-500">Connect to HashKey Chain Testnet to access the employer dashboard.</p>
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
                  {loading ? "Analysing with GLM-4..." : "Get AI vault recommendation"}
                </button>
              </div>
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

            {/* Submit */}
            <button
              className="btn-primary w-full py-3 text-sm"
              onClick={handleApproveAndCreate}
              disabled={!form.employee || !form.amount || selectedTier === null || isPending || isConfirming}
            >
              {isPending ? "Waiting for signature..." : isConfirming ? "Confirming on-chain..." : "Approve & create stream"}
            </button>

            {isSuccess && (
              <div className="border border-emerald-500/20 rounded-lg p-4 bg-emerald-500/5 text-center">
                <p className="text-sm text-emerald-400 font-medium">Stream created successfully</p>
                <a
                  href={`https://testnet-explorer.hsk.xyz/tx/${hash}`}
                  target="_blank"
                  rel="noopener"
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors mt-1 inline-block"
                >
                  View transaction on HashKey Explorer →
                </a>
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
                  <p className="text-xs">Fill in the stream details and click<br />{' “Get AI vault recommendation”'}</p>
                </div>
              )}

              {loading && (
                <div className="text-center py-10">
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs text-slate-500">GLM-4 is analysing your stream...</p>
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
                  HSK faucet (gas) → faucet.hsk.xyz
                </a>
                <p className="text-xs text-slate-600">
                  mUSDC: call <code className="text-indigo-400">faucet()</code> on{" "}
                  <a
                    href="https://testnet-explorer.hsk.xyz/address/0x1ecED1DDBF70987d28659fd83fA9B24D884bDB87"
                    target="_blank"
                    rel="noopener"
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    MockUSDC contract
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
