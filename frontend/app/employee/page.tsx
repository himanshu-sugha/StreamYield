"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits } from "viem";
import Navbar from "@/components/Navbar";
import { CONTRACT_ADDRESSES, STREAM_VAULT_ABI } from "@/lib/config";

const TIER_NAMES = ["Stable", "Balanced", "Growth"];
const TIER_CLASSES = ["tier-stable", "tier-balanced", "tier-growth"];
const TIER_APY = ["4%", "8%", "12%"];

function StreamCard({ streamId }: { streamId: bigint }) {
    const { data: stream } = useReadContract({
        address: CONTRACT_ADDRESSES.StreamVault as `0x${string}`,
        abi: STREAM_VAULT_ABI,
        functionName: "getStream",
        args: [streamId],
    });

    const { data: claimable, refetch } = useReadContract({
        address: CONTRACT_ADDRESSES.StreamVault as `0x${string}`,
        abi: STREAM_VAULT_ABI,
        functionName: "getClaimable",
        args: [streamId],
    });

    const { writeContract, isPending, data: hash } = useWriteContract();
    const { isSuccess } = useWaitForTransactionReceipt({ hash });

    useEffect(() => {
        const interval = setInterval(() => refetch(), 5000);
        return () => clearInterval(interval);
    }, [refetch]);

    if (!stream) return <div className="glass-card p-4 text-center text-slate-500 text-sm">Loading stream #{streamId.toString()}...</div>;

    const s = stream as any;
    const totalAmount = BigInt(s.totalAmount);
    const claimed = BigInt(s.claimedAmount);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const start = BigInt(s.startTime);
    const end = BigInt(s.endTime);
    const duration = end - start;
    const ZERO = BigInt(0);
    const elapsed = now > end ? duration : now > start ? now - start : ZERO;
    const percentVested = duration > ZERO ? Number((elapsed * BigInt(100)) / duration) : 0;

    const claimableFormatted = claimable ? formatUnits(claimable as bigint, 6) : "0";
    const totalFormatted = formatUnits(totalAmount, 6);

    return (
        <div className="border border-white/5 rounded-xl bg-white/[0.02] p-6">
            <div className="flex items-center justify-between mb-5">
                <span className="text-sm font-medium text-slate-300">Stream #{streamId.toString()}</span>
                <span className={`text-xs px-2 py-0.5 rounded border font-medium ${TIER_CLASSES[s.vaultTier]}`}>
                    {TIER_NAMES[s.vaultTier]} · {TIER_APY[s.vaultTier]} APY
                </span>
            </div>

            <div className="mb-5">
                <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-500">Vested</span>
                    <span className="text-slate-300 font-medium">{percentVested.toFixed(2)}%</span>
                </div>
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${percentVested}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-600 mt-1.5">
                    <span>0 mUSDC</span>
                    <span>{parseFloat(totalFormatted).toLocaleString()} mUSDC</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="border border-white/5 rounded-lg p-3 bg-white/[0.02]">
                    <div className="text-xs text-slate-500 mb-1">Claimable now</div>
                    <div className="text-base font-semibold text-emerald-400">{parseFloat(claimableFormatted).toFixed(4)}</div>
                    <div className="text-xs text-slate-600">mUSDC</div>
                </div>
                <div className="border border-white/5 rounded-lg p-3 bg-white/[0.02]">
                    <div className="text-xs text-slate-500 mb-1">Total stream</div>
                    <div className="text-base font-semibold text-white">{parseFloat(totalFormatted).toLocaleString()}</div>
                    <div className="text-xs text-slate-600">mUSDC</div>
                </div>
            </div>

            {s.aiReasoning && (
                <div className="border border-indigo-500/20 rounded-lg p-3 mb-4 bg-indigo-500/5">
                    <p className="text-xs text-slate-500 font-medium mb-1">AI vault reasoning</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{s.aiReasoning}</p>
                </div>
            )}

            <button
                className="btn-primary w-full text-sm py-2.5"
                disabled={!claimable || (claimable as bigint) === BigInt(0) || isPending}
                onClick={() =>
                    writeContract({
                        address: CONTRACT_ADDRESSES.StreamVault as `0x${string}`,
                        abi: STREAM_VAULT_ABI,
                        functionName: "claimVested",
                        args: [streamId],
                    })
                }
            >
                {isPending ? "Confirming..." : `Claim ${parseFloat(claimableFormatted).toFixed(4)} mUSDC`}
            </button>

            {isSuccess && (
                <div className="mt-3 text-center text-xs text-emerald-400">Claimed successfully.</div>
            )}
        </div>
    );
}

export default function EmployeePage() {
    const { address, isConnected } = useAccount();
    const [streamIdInput, setStreamIdInput] = useState("");
    const [viewIds, setViewIds] = useState<bigint[]>([]);

    const { data: myStreams } = useReadContract({
        address: CONTRACT_ADDRESSES.StreamVault as `0x${string}`,
        abi: STREAM_VAULT_ABI,
        functionName: "getEmployeeStreams",
        args: [address as `0x${string}`],
        query: { enabled: !!address },
    });

    const streams = (myStreams as bigint[] | undefined) || viewIds;

    const handleAddStream = () => {
        const id = BigInt(streamIdInput);
        if (!viewIds.includes(id)) setViewIds([...viewIds, id]);
        setStreamIdInput("");
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
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-semibold mb-2">Connect your wallet</h2>
                        <p className="text-sm text-slate-500">Connect to HashKey Chain Testnet to view your incoming salary streams.</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main>
            <div className="gradient-bg" />
            <Navbar />

            <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
                <div className="mb-8 pt-4">
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-xl font-semibold">Your payroll streams</h1>
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            live
                        </span>
                    </div>
                    <p className="text-sm text-slate-500">Salary vests every second. Claim any time.</p>
                </div>

                {/* Manual stream lookup */}
                <div className="border border-white/5 rounded-xl bg-white/[0.02] p-6 mb-5">
                    <h2 className="text-sm font-semibold text-slate-300 mb-4">Look up a stream by ID</h2>
                    <div className="flex gap-3">
                        <input
                            type="number"
                            className="form-input flex-1"
                            placeholder="Stream ID — e.g. 0"
                            value={streamIdInput}
                            onChange={(e) => setStreamIdInput(e.target.value)}
                        />
                        <button className="btn-secondary px-5 text-sm" onClick={handleAddStream} disabled={!streamIdInput}>
                            View
                        </button>
                    </div>
                    <p className="text-xs text-slate-600 mt-2">Your employer gave you a stream ID when they created the payroll stream.</p>
                </div>

                {/* Stream cards */}
                {streams.length === 0 ? (
                    <div className="border border-white/5 rounded-xl bg-white/[0.02] p-14 text-center">
                        <p className="text-sm text-slate-500 mb-1">No streams found</p>
                        <p className="text-xs text-slate-600">Enter a stream ID above, or ask your employer to add your wallet to a payroll stream.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {streams.map((id) => (
                            <StreamCard key={id.toString()} streamId={id} />
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
