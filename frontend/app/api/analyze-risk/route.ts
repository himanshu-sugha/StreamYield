import { NextResponse } from "next/server";
import { VAULT_TIERS, getMarketContext, callGLM4Json } from "@/lib/ai-logic";

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const { amount = 10000, durationDays = 30, tier = 1, employeeCount = 1 } =
        body as { amount?: number; durationDays?: number; tier?: number; employeeCount?: number };

    const market = getMarketContext();
    const vault = VAULT_TIERS[tier];
    if (!vault) return NextResponse.json({ success: false, error: "Invalid tier" }, { status: 400 });

    const systemPrompt = `You are a risk officer for a DeFi payroll protocol. Provide concise, factual risk analysis for institutional clients. Be direct. No fluff.`;

    const userMessage = `Risk assessment for: $${amount} payroll stream, ${durationDays} days, ${vault.name} vault (${vault.apy}% APY, max drawdown ${vault.maxDrawdown}, Sharpe ${vault.sharpeRatio}).
Market: risk-free rate ${market.riskFreeRate}%, credit spread ${market.creditSpread}, sentiment ${market.marketSentiment}.
Employees: ${employeeCount}
Provide 3 key risks and 2 mitigations in plain language. Keep under 150 words total.`;

    const analysis = await callGLM4Json(systemPrompt, userMessage);

    return NextResponse.json({
        success: true,
        riskAnalysis: analysis ||
            `Standard risk for ${vault.name} vault: liquidity risk (T+${vault.liquidityDays}), ` +
            `credit risk (${vault.maxDrawdown} max drawdown), and smart contract risk. ` +
            `Mitigate by staying within vault liquidity window and capping exposure at <10% of total treasury.`,
        vault:       vault.name,
        sharpeRatio: vault.sharpeRatio,
    });
}
