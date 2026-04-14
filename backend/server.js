require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;

// ─── Vault tier metadata ─────────────────────────────────────────────────────

const VAULT_TIERS = {
    0: {
        name: "Stable",
        apy: 4,
        risk: "Conservative",
        description: "T-bills, money market, short-duration government bonds",
        sharpeRatio: 2.1,
        maxDrawdown: "~0%",
        liquidityDays: 1,
    },
    1: {
        name: "Balanced",
        apy: 8,
        risk: "Moderate",
        description: "Diversified RWA: real estate + investment-grade bonds + trade finance",
        sharpeRatio: 1.4,
        maxDrawdown: "~3%",
        liquidityDays: 7,
    },
    2: {
        name: "Growth",
        apy: 12,
        risk: "Aggressive",
        description: "High-yield real estate, private credit, and emerging market bonds",
        sharpeRatio: 0.9,
        maxDrawdown: "~8%",
        liquidityDays: 30,
    },
};

// ─── Market context (simulated macroeconomic signals for AI context) ──────────
// In production these would be fetched from a price oracle / data provider

function getMarketContext() {
    const now = new Date();
    const month = now.getMonth();
    // Seasonal yield curve simulation — realistic range
    const baseRate = 4.5 + Math.sin(month / 6 * Math.PI) * 0.5; // ~4–5% risk-free
    return {
        riskFreeRate: baseRate.toFixed(2),          // approximating 3-month T-bill
        creditSpread: "185bps",                      // IG credit spread
        globalRWAMarketSize: "$16.1T",               // tokenized RWA market 2025
        inflationEstimate: "2.8%",                   // CPI estimate
        yieldCurveShape: baseRate > 4.8 ? "inverted" : "normal",
        marketSentiment: "cautious-optimistic",
    };
}

// ─── Projected yield calculation ─────────────────────────────────────────────

function calcYield(amount, apy, durationDays) {
    return ((amount * apy) / 100) * (durationDays / 365);
}

// ─── GLM-4: Full autonomous decision ─────────────────────────────────────────
// The AI decides the tier. No hard-coded if/else rules. The market context,
// duration, amount, and risk profile are inputs; GLM-4 reasons and outputs
// a structured JSON decision.

async function callGLM4Json(systemPrompt, userMessage) {
    if (!ZHIPU_API_KEY) return null;
    try {
        const { default: fetch } = await import("node-fetch");
        const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${ZHIPU_API_KEY}`,
            },
            body: JSON.stringify({
                model: "glm-4-flash",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage },
                ],
                temperature: 0.3,   // lower = more deterministic financial reasoning
                max_tokens: 600,
            }),
        });
        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (err) {
        console.error("GLM-4 API error:", err.message);
        return null;
    }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/recommend-vault
 * Body: { amount, durationDays, riskTolerance, employerProfile? }
 *
 * GLM-4 is the decision-maker. It receives full financial context and
 * outputs a structured JSON recommendation. The rules engine is a fallback
 * only — it is never invoked when GLM-4 is available.
 */
app.post("/api/recommend-vault", async (req, res) => {
    const {
        amount = 1000,
        durationDays = 30,
        riskTolerance = "medium",
        employerProfile = "B2B technology company",
    } = req.body;

    const market = getMarketContext();
    const yields = {
        stable:   calcYield(amount, 4,  durationDays).toFixed(2),
        balanced: calcYield(amount, 8,  durationDays).toFixed(2),
        growth:   calcYield(amount, 12, durationDays).toFixed(2),
    };

    // ── Attempt GLM-4 full autonomous decision ────────────────────────────────
    const systemPrompt = `You are a quantitative financial advisor for StreamYield, a PayFi protocol 
on HashKey Chain. You allocate B2B payroll capital into three RWA vault tiers.

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

Based on all of the above, select the optimal vault tier. Consider duration-liquidity matching first.`;

    let tier = 1;         // default fallback
    let aiReasoning = ""; // will be set by GLM-4 or fallback template
    let confidence = 75;
    let riskWarning = "";
    let alternativeTier = 0;
    let alternativeReason = "";
    let primaryReason = "";

    const raw = await callGLM4Json(systemPrompt, userMessage);

    if (raw) {
        try {
            // Extract JSON from GLM-4 response (handles markdown code fences)
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                tier            = Math.min(2, Math.max(0, parseInt(parsed.recommendedTier)));
                confidence      = parsed.confidence || 75;
                primaryReason   = parsed.primaryReason || "";
                aiReasoning     = parsed.reasoning || "";
                riskWarning     = parsed.riskWarning || "";
                alternativeTier = Math.min(2, Math.max(0, parseInt(parsed.alternativeTier ?? (tier > 0 ? tier - 1 : 1))));
                alternativeReason = parsed.alternativeReason || "";
            }
        } catch (e) {
            // JSON parse failed — GLM-4 returned non-JSON, use text as reasoning
            aiReasoning = raw.slice(0, 300);
        }
    }

    // ── Fallback rules (only used when GLM-4 is unavailable) ─────────────────
    if (!raw) {
        // Duration-liquidity match is the primary constraint
        if (durationDays < 7) {
            tier = 0;
            primaryReason = "Duration too short for anything but Stable — liquidity constraint.";
        } else if (durationDays >= 90 && riskTolerance === "high") {
            tier = 2;
            primaryReason = "Long duration and high risk tolerance allow Growth vault.";
        } else if (durationDays >= 30) {
            tier = riskTolerance === "low" ? 0 : 1;
            primaryReason = "Medium duration fits Balanced; Stable selected for conservative employers.";
        } else {
            tier = 0;
            primaryReason = "Short duration defaults to Stable to avoid liquidity mismatch.";
        }

        const projYield = calcYield(amount, VAULT_TIERS[tier].apy, durationDays).toFixed(2);
        aiReasoning = `The ${VAULT_TIERS[tier].name} vault (${VAULT_TIERS[tier].apy}% APY) was selected because ${primaryReason.toLowerCase()} ` +
            `With the current risk-free rate at ${market.riskFreeRate}%, this vault delivers a ${(VAULT_TIERS[tier].apy - parseFloat(market.riskFreeRate)).toFixed(1)}% excess return. ` +
            `Projected yield for this stream: $${projYield} USDC — your payroll capital works instead of sitting idle.`;
        riskWarning = `${VAULT_TIERS[tier].name} vault has T+${VAULT_TIERS[tier].liquidityDays} liquidity — ensure this aligns with your operational needs.`;
    }

    const projectedYieldUSD = calcYield(amount, VAULT_TIERS[tier].apy, durationDays).toFixed(2);

    res.json({
        success: true,
        recommendation: {
            tier,
            tierName: VAULT_TIERS[tier].name,
            apy: `${VAULT_TIERS[tier].apy}%`,
            projectedYieldUSD,
            riskLevel: VAULT_TIERS[tier].risk,
            confidence,
            primaryReason,
            aiReasoning,
            riskWarning,
            alternativeTier,
            alternativeTierName: VAULT_TIERS[alternativeTier]?.name,
            alternativeReason,
            marketContext: market,
            allYields: yields,
            aiPowered: !!raw,  // tells frontend if this was real GLM-4 or fallback
        },
    });
});

/**
 * POST /api/analyze-risk
 * Deep risk analysis for a specific stream configuration.
 * Uses GLM-4 to run a multi-factor portfolio risk assessment.
 */
app.post("/api/analyze-risk", async (req, res) => {
    const { amount = 10000, durationDays = 30, tier = 1, employeeCount = 1 } = req.body;
    const market = getMarketContext();
    const vault = VAULT_TIERS[tier];
    if (!vault) return res.status(400).json({ success: false, error: "Invalid tier" });

    const systemPrompt = `You are a risk officer for a DeFi payroll protocol. Provide concise, 
factual risk analysis for institutional clients. Be direct. No fluff.`;

    const userMessage = `Risk assessment for: $${amount} payroll stream, ${durationDays} days, 
${vault.name} vault (${vault.apy}% APY, max drawdown ${vault.maxDrawdown}, Sharpe ${vault.sharpeRatio}).
Market: risk-free rate ${market.riskFreeRate}%, credit spread ${market.creditSpread}, sentiment ${market.marketSentiment}.
Employees: ${employeeCount}

Provide 3 key risks and 2 mitigations in plain language. Keep under 150 words total.`;

    const analysis = await callGLM4Json(systemPrompt, userMessage);

    res.json({
        success: true,
        riskAnalysis: analysis || `Standard risk for ${vault.name} vault: liquidity risk (T+${vault.liquidityDays}), ` +
            `credit risk (${vault.maxDrawdown} max drawdown), and smart contract risk. ` +
            `Mitigate by staying within vault liquidity window and capping exposure at <10% of total treasury.`,
        vault: vault.name,
        sharpeRatio: vault.sharpeRatio,
    });
});

/**
 * GET /api/tiers
 */
app.get("/api/tiers", (req, res) => {
    res.json({ success: true, tiers: VAULT_TIERS, market: getMarketContext() });
});

/**
 * GET /api/health
 */
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        service: "StreamYield AI Agent",
        aiProvider: ZHIPU_API_KEY ? "Zhipu GLM-4 (autonomous decision mode)" : "Fallback (rules + template)",
        autonomousMode: !!ZHIPU_API_KEY,
        marketContext: getMarketContext(),
        timestamp: new Date().toISOString(),
    });
});

// ─── Start server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`🤖 StreamYield AI Agent running on http://localhost:${PORT}`);
    console.log(`💡 AI mode: ${ZHIPU_API_KEY ? "Zhipu GLM-4 autonomous (no hard-coded rules)" : "Fallback mode (no API key)"}`);
});
