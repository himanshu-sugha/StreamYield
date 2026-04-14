"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";

const steps = [
  {
    number: "01",
    title: "Deposit payroll capital",
    desc: "Employer deposits the total salary amount into StreamVault on HashKey Chain. Capital is immediately put to work.",
  },
  {
    number: "02",
    title: "AI selects a yield vault",
    desc: "An AI agent analyzes the stream duration and risk preference, then routes capital into the best-fit RWA vault.",
  },
  {
    number: "03",
    title: "Salary streams every second",
    desc: "Employees accumulate salary continuously. No waiting until month-end — funds vest in real time.",
  },
  {
    number: "04",
    title: "Employer collects yield",
    desc: "Once the stream ends the employer withdraws the accumulated yield. Payroll capital has worked the whole time.",
  },
];

const vaultTiers = [
  {
    name: "Stable",
    apy: "4% APY",
    risk: "Conservative",
    desc: "T-bills and money market instruments. Capital preservation with predictable returns.",
    border: "border-emerald-500/20",
    badge: "bg-emerald-500/10 text-emerald-400",
  },
  {
    name: "Balanced",
    apy: "8% APY",
    risk: "Moderate",
    desc: "Diversified RWA basket across real estate, corporate bonds, and credit markets.",
    border: "border-indigo-500/20",
    badge: "bg-indigo-500/10 text-indigo-400",
  },
  {
    name: "Growth",
    apy: "12% APY",
    risk: "Aggressive",
    desc: "High-yield real estate and private credit. Best for long-duration streams.",
    border: "border-amber-500/20",
    badge: "bg-amber-500/10 text-amber-400",
  },
];

export default function Home() {
  return (
    <main>
      <div className="gradient-bg" />
      <Navbar />

      {/* Hero — asymmetric, left-aligned */}
      <section className="max-w-6xl mx-auto px-6 pt-40 pb-28">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-400 tracking-wide">Live on HashKey Chain Testnet — Chain ID 133</span>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight mb-6 max-w-3xl">
          Payroll that works<br />
          <span className="gradient-text">while you sleep.</span>
        </h1>

        <p className="text-lg text-slate-400 max-w-xl mb-10 leading-relaxed">
          StreamYield streams employee salaries per-second and routes your unvested capital
          into on-chain RWA yield vaults. Your payroll budget earns — automatically.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link href="/employer">
            <button className="btn-primary px-6 py-2.5 text-sm">
              Open employer dashboard
            </button>
          </Link>
          <Link href="/employee">
            <button className="btn-secondary px-6 py-2.5 text-sm">
              View earnings stream
            </button>
          </Link>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="border-t border-white/5" />
      </div>

      {/* How it works — numbered list style */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase mb-10">How it works</p>
        <div className="grid md:grid-cols-2 gap-px bg-white/5 border border-white/5 rounded-xl overflow-hidden">
          {steps.map((step) => (
            <div key={step.number} className="bg-[#030712] p-8 hover:bg-white/[0.02] transition-colors">
              <div className="text-xs font-mono text-slate-600 mb-4">{step.number}</div>
              <h3 className="text-base font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Vault tiers */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase mb-3">RWA vault tiers</p>
        <h2 className="text-2xl font-bold mb-2">
          AI picks the right vault for your stream.
        </h2>
        <p className="text-slate-500 text-sm mb-10 max-w-lg">
          Based on duration and employer risk preference, the AI agent routes capital to one of three real-world asset vaults.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          {vaultTiers.map((v) => (
            <div key={v.name} className={`glass-card p-6 border ${v.border} hover:bg-white/[0.03] transition-colors`}>
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-white">{v.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.badge}`}>{v.risk}</span>
              </div>
              <div className="text-3xl font-bold text-white mb-3">{v.apy}</div>
              <p className="text-sm text-slate-500 leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problem statement — clean callout */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase mb-4">The problem</p>
            <h2 className="text-2xl font-bold mb-4 leading-snug">
              Traditional payroll locks up capital for weeks — earning nothing.
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Companies pre-fund payroll days before the payment date. That capital sits idle in a bank account, 
              generating zero return. For a company with a $500K monthly payroll, that represents significant 
              opportunity cost every single month.
            </p>
            <p className="text-slate-500 text-sm leading-relaxed">
              StreamYield keeps that capital productive from day one — and returns all generated yield 
              to the employer when the stream closes.
            </p>
          </div>
          <div className="glass-card p-8 border border-white/5">
            <div className="space-y-5">
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-sm text-slate-400">Traditional payroll yield</span>
                <span className="text-sm font-semibold text-red-400">0%</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-sm text-slate-400">Stable vault (conservative)</span>
                <span className="text-sm font-semibold text-emerald-400">4% APY</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-sm text-slate-400">Balanced vault (moderate)</span>
                <span className="text-sm font-semibold text-emerald-400">8% APY</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-sm text-slate-400">Growth vault (aggressive)</span>
                <span className="text-sm font-semibold text-emerald-400">12% APY</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="border border-white/5 rounded-xl p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 bg-white/[0.02]">
          <div>
            <h2 className="text-xl font-bold mb-1">Ready to get started?</h2>
            <p className="text-sm text-slate-500">Connect your wallet to HashKey Chain Testnet and create your first payroll stream.</p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Link href="/employer">
              <button className="btn-primary px-6 py-2.5 text-sm">Launch app</button>
            </Link>
            <Link href="/ai-insights">
              <button className="btn-secondary px-6 py-2.5 text-sm">AI advisor</button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-xs text-slate-600">
            StreamYield · HashKey Chain Testnet · HashKey On-Chain Horizon Hackathon 2026
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <a href="https://testnet-explorer.hsk.xyz/address/0x0507302FBDACEc8D9A83E722Ce016064a6578848" target="_blank" rel="noopener" className="hover:text-slate-400 transition-colors">StreamVault contract</a>
            <a href="https://testnet.hsk.xyz" target="_blank" rel="noopener" className="hover:text-slate-400 transition-colors">HashKey Testnet</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
