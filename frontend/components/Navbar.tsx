"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Navbar() {
  const pathname = usePathname();
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#030712]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600" />
          <span className="font-semibold text-sm text-white tracking-tight">StreamYield</span>
          <span className="hidden sm:block text-xs text-slate-600">/ HashKey Chain</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/"
            className={`text-sm transition-colors ${pathname === "/" ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
          >
            Overview
          </Link>
          <Link
            href="/employer"
            className={`text-sm transition-colors ${pathname === "/employer" ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
          >
            Employer
          </Link>
          <Link
            href="/employee"
            className={`text-sm transition-colors ${pathname === "/employee" ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
          >
            Employee
          </Link>
          <Link
            href="/ai-insights"
            className={`text-sm transition-colors ${pathname === "/ai-insights" ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
          >
            AI Advisor
          </Link>
        </div>

        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
      </div>
    </nav>
  );
}
