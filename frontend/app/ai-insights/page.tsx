"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import { BACKEND_URL } from "@/lib/config";

const EXAMPLES = [
  { amount: 5000, duration: 30, risk: "medium", label: "Monthly payroll — $5K, 30 days" },
  { amount: 50000, duration: 90, risk: "low", label: "Quarterly budget — $50K, 90 days" },
  { amount: 500, duration: 7, risk: "high", label: "Weekly freelancer — $500, 7 days" },
];

const VAULT_INFO = [
  {
    name: "Stable",
    apy: "4%",
    risk: "Conservative",
    desc: "T-bills, money market funds, and short-duration government bonds. Capital preservation first.",
    when: "Best for streams under 30 days or employers who prioritise safety over return.",
    badgeCls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  {
    name: "Balanced",
    apy: "8%",
    risk: "Moderate",
    desc: "Diversified basket of real estate, corporate bonds, and credit instruments.",
    when: "Best for 30–90 day payroll streams with a standard risk tolerance.",
    badgeCls: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  },
  {
    name: "Growth",
    apy: "12%",
    risk: "Aggressive",
    desc: "Higher-yield real estate and private credit with superior long-term returns.",
    when: "Best for streams longer than 90 days where growth outweighs short-term volatility.",
    badgeCls: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
];

export default function AIInsightsPage() {
  const [form, setForm] = useState({ amount: "10000", duration: "30", risk: "medium" });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleQuery = async () => {
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/recommend-vault`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(form.amount),
          durationDays: parseInt(form.duration),
          riskTolerance: form.risk,
        }),
      });
      const data = await res.json();
      if (data.success) setResult(data.recommendation);
      else setError("Could not get recommendation. Try again.");
    } catch {
      setError("Backend unreachable. Make sure the AI server is running on port 3001.");
    } finally {
      setLoading(false);
    }
  };

  const selectedVault = result ? VAULT_INFO[result.tier] : null;

  return (
    <main>
      <div className="gradient-bg" />
      <Navbar />

      <div className="max-w-5xl mx-auto px-6 pt-24 pb-16">

        <div className="mb-8 pt-4">
          <h1 className="text-xl font-semibold mb-1">AI vault advisor</h1>
          <p className="text-sm text-slate-500">
            Powered by Zhipu GLM-4 · Enter your payroll parameters to get a personalised RWA vault recommendation.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-5 mb-10">
          {/* Query panel */}
          <div className="border border-white/5 rounded-xl bg-white/[0.02] p-6">
            <h2 className="text-sm font-semibold text-slate-300 mb-5">Stream parameters</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Stream amount (USD)</label>
                <input
                  className="form-input"
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Duration (days)</label>
                <input
                  className="form-input"
                  type="number"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Risk tolerance</label>
                <select
                  className="form-input"
                  value={form.risk}
                  onChange={(e) => setForm({ ...form, risk: e.target.value })}
                >
                  <option value="low">Conservative — capital preservation</option>
                  <option value="medium">Moderate — balanced growth</option>
                  <option value="high">Aggressive — maximise yield</option>
                </select>
              </div>
              <button
                className="btn-primary w-full py-2.5 text-sm"
                onClick={handleQuery}
                disabled={loading}
              >
                {loading ? "Analysing..." : "Get recommendation"}
              </button>
            </div>

            <div className="mt-6 border-t border-white/5 pt-5">
              <p className="text-xs text-slate-600 mb-3">Try an example</p>
              <div className="space-y-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-white/5 bg-white/[0.01] hover:bg-white/[0.04] transition-colors text-slate-400 hover:text-slate-300"
                    onClick={() => setForm({ amount: ex.amount.toString(), duration: ex.duration.toString(), risk: ex.risk })}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Result panel */}
          <div className="border border-white/5 rounded-xl bg-white/[0.02] p-6">
            <h2 className="text-sm font-semibold text-slate-300 mb-1">Recommendation</h2>
            <p className="text-xs text-slate-600 mb-5">GLM-4 will appear here after analysis</p>

            {!result && !loading && !error && (
              <div className="flex items-center justify-center h-56 text-slate-600">
                <p className="text-xs text-center">Fill in the parameters on the left<br />and click "Get recommendation"</p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center h-56 gap-3">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-500">GLM-4 is analysing your stream...</p>
              </div>
            )}

            {error && (
              <div className="border border-red-500/20 rounded-lg p-4 bg-red-500/5">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {result && selectedVault && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-white">{result.apy}</span>
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${selectedVault.badgeCls}`}>
                      {result.tierName}
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">{selectedVault.risk}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-white/5 rounded-lg p-3 bg-white/[0.02]">
                    <div className="text-xs text-slate-500 mb-1">Projected yield</div>
                    <div className="text-base font-semibold text-amber-400">${result.projectedYieldUSD}</div>
                  </div>
                  <div className="border border-white/5 rounded-lg p-3 bg-white/[0.02]">
                    <div className="text-xs text-slate-500 mb-1">Risk level</div>
                    <div className="text-base font-semibold text-white">{result.riskLevel}</div>
                  </div>
                </div>

                <div className="border border-indigo-500/20 rounded-lg p-4 bg-indigo-500/5">
                  <p className="text-xs text-slate-500 font-medium mb-2">GLM-4 analysis</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{result.aiReasoning}</p>
                </div>

                {result.ruleBasedReasons?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-600 mb-2">Decision factors</p>
                    <ul className="space-y-1">
                      {result.ruleBasedReasons.map((r: string, i: number) => (
                        <li key={i} className="text-xs text-slate-500 flex gap-2">
                          <span className="text-indigo-500 mt-px">›</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Vault detail table */}
        <div className="border border-white/5 rounded-xl bg-white/[0.02] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-slate-300">RWA vault tiers</h2>
            <p className="text-xs text-slate-500 mt-0.5">All vaults are simulated on HashKey Chain Testnet</p>
          </div>
          <div className="divide-y divide-white/5">
            {VAULT_INFO.map((v) => (
              <div key={v.name} className="px-6 py-5 flex flex-col md:flex-row md:items-start gap-4">
                <div className="md:w-48 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">{v.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${v.badgeCls}`}>{v.risk}</span>
                  </div>
                  <div className="text-xl font-bold text-white">{v.apy} APY</div>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-400 mb-1.5 leading-relaxed">{v.desc}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{v.when}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
