import { NextResponse } from "next/server";
import { VAULT_TIERS, getMarketContext, calcYield, callGLM4Json } from "@/lib/ai-logic";

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const {
        amount         = 1000,
        durationDays   = 30,
        riskTolerance  = "medium",
        employerProfile = "B2B technology company",
    } = body as { amount?: number; durationDays?: number; riskTolerance?: string; employerProfile?: string };

    const market = getMarketContext();
    const yields = {
        stable:   calcYield(amount, 4,  durationDays).toFixed(2),
        balanced: calcYield(amount, 8,  durationDays).toFixed(2),
        growth:   calcYield(amount, 12, durationDays).toFixed(2),
    };

    const systemPrompt = `You are a quantitative financial advisor for StreamYield, a PayFi protocol on HashKey Chain. You allocate B2B payroll capital into three RWA vault tiers.

VAULT OPTIONS:
- Tier 0 (Stable, 4% APY): T-bills and money market. Sharpe ratio 2.1. Liquidity: T+1. Max drawdown ~0%.
- Tier 1 (Balanced, 8% APY): Diversified RWA — real estate, IG bonds, trade finance. Sharpe 1.4. Liquidity: T+7. Max drawdown ~3%.
- Tier 2 (Growth, 12% APY): High-yield real estate, private credit. Sharpe 0.9. Liquidity: T+30. Max drawdown ~8%.

DECISION FRAMEWORK:
1. Duration-liquidity match: vault liquidity must not exceed stream duration
2. Risk-return tradeoff: consider employer's stated risk tolerance vs yield pickup
3. Capital preservation: large payrolls (>$50K) warrant extra caution on tail risk
4. Yield curve: compare vault APY vs current risk-free rate to justify risk premium
5. Opportunity cost: always quantify the improvement over a 0% bank account

Respond ONLY with valid JSON in this exact format:
{
  "recommendedTier": <0|1|2>,
  "confidence": <0-100>,
  "primaryReason": "<one sentence — the most important factor>",
  "reasoning": "<2-3 sentences — professional financial analysis>",
  "riskWarning": "<one sentence — what could go wrong>",
  "alternativeTier": <0|1|2>,
  "alternativeReason": "<why an employer might prefer the alternative>"
}`;

    const userMessage = `PAYROLL STREAM PARAMETERS:
- Employer: ${employerProfile}
- Payroll amount: $${amount} USDC
- Stream duration: ${durationDays} days
- Employer risk tolerance: ${riskTolerance}

CURRENT MARKET CONDITIONS:
- Risk-free rate (3M T-bill): ${market.riskFreeRate}%
- IG credit spread: ${market.creditSpread}
- Yield curve: ${market.yieldCurveShape}
- Global tokenized RWA market: ${market.globalRWAMarketSize}
- Inflation estimate: ${market.inflationEstimate}
- Market sentiment: ${market.marketSentiment}

PROJECTED YIELDS FOR THIS STREAM:
- Stable (4%): $${yields.stable} USDC
- Balanced (8%): $${yields.balanced} USDC
- Growth (12%): $${yields.growth} USDC

Based on all of the above, select the optimal vault tier.`;

    let tier = 1;
    let aiReasoning = "";
    let confidence = 75;
    let riskWarning = "";
    let alternativeTier = 0;
    let alternativeReason = "";
    let primaryReason = "";

    const raw = await callGLM4Json(systemPrompt, userMessage);

    if (raw) {
        try {
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                tier             = Math.min(2, Math.max(0, parseInt(parsed.recommendedTier)));
                confidence       = parsed.confidence || 75;
                primaryReason    = parsed.primaryReason || "";
                aiReasoning      = parsed.reasoning || "";
                riskWarning      = parsed.riskWarning || "";
                alternativeTier  = Math.min(2, Math.max(0, parseInt(parsed.alternativeTier ?? (tier > 0 ? tier - 1 : 1))));
                alternativeReason = parsed.alternativeReason || "";
            }
        } catch {
            aiReasoning = raw.slice(0, 300);
        }
    }

    if (!raw) {
        if (durationDays < 7)                                { tier = 0; primaryReason = "Duration too short — liquidity constraint forces Stable."; }
        else if (durationDays >= 90 && riskTolerance === "high") { tier = 2; primaryReason = "Long duration + high tolerance → Growth vault."; }
        else if (durationDays >= 30)                         { tier = riskTolerance === "low" ? 0 : 1; primaryReason = "Medium duration — Balanced or Stable based on risk."; }
        else                                                 { tier = 0; primaryReason = "Short duration defaults to Stable."; }

        const v = VAULT_TIERS[tier];
        aiReasoning = `The ${v.name} vault (${v.apy}% APY) was selected: ${primaryReason.toLowerCase()} ` +
            `Risk-free rate is ${market.riskFreeRate}% — this vault delivers ${(v.apy - parseFloat(market.riskFreeRate)).toFixed(1)}% excess return. ` +
            `Projected yield: $${calcYield(amount, v.apy, durationDays).toFixed(2)} USDC.`;
        riskWarning = `${v.name} vault has T+${v.liquidityDays} liquidity — ensure this aligns with your operational needs.`;
    }

    const projectedYieldUSD = calcYield(amount, VAULT_TIERS[tier].apy, durationDays).toFixed(2);

    return NextResponse.json({
        success: true,
        recommendation: {
            tier,
            tierName:         VAULT_TIERS[tier].name,
            apy:              `${VAULT_TIERS[tier].apy}%`,
            projectedYieldUSD,
            riskLevel:        VAULT_TIERS[tier].risk,
            confidence,
            primaryReason,
            aiReasoning,
            riskWarning,
            alternativeTier,
            alternativeTierName: VAULT_TIERS[alternativeTier]?.name,
            alternativeReason,
            marketContext:    market,
            allYields:        yields,
            aiPowered:        !!raw,
        },
    });
}
