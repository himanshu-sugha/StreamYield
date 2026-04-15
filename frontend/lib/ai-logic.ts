/**
 * Shared AI + vault logic — used by all Next.js API routes.
 * This replaces the Express backend and runs as Vercel serverless functions.
 */

export const VAULT_TIERS: Record<number, {
    name: string; apy: number; risk: string;
    description: string; sharpeRatio: number;
    maxDrawdown: string; liquidityDays: number;
}> = {
    0: { name: "Stable",   apy: 4,  risk: "Conservative", description: "T-bills, money market, short-duration government bonds",                    sharpeRatio: 2.1, maxDrawdown: "~0%", liquidityDays: 1  },
    1: { name: "Balanced", apy: 8,  risk: "Moderate",     description: "Diversified RWA: real estate + investment-grade bonds + trade finance",     sharpeRatio: 1.4, maxDrawdown: "~3%", liquidityDays: 7  },
    2: { name: "Growth",   apy: 12, risk: "Aggressive",   description: "High-yield real estate, private credit, and emerging market bonds",          sharpeRatio: 0.9, maxDrawdown: "~8%", liquidityDays: 30 },
};

export function getMarketContext() {
    const month = new Date().getMonth();
    const baseRate = 4.5 + Math.sin((month / 6) * Math.PI) * 0.5;
    return {
        riskFreeRate:        baseRate.toFixed(2),
        creditSpread:        "185bps",
        globalRWAMarketSize: "$16.1T",
        inflationEstimate:   "2.8%",
        yieldCurveShape:     baseRate > 4.8 ? "inverted" : "normal",
        marketSentiment:     "cautious-optimistic",
    };
}

export function calcYield(amount: number, apy: number, durationDays: number) {
    return ((amount * apy) / 100) * (durationDays / 365);
}

export async function callGLM4Json(systemPrompt: string, userMessage: string): Promise<string | null> {
    const key = process.env.ZHIPU_API_KEY;
    if (!key) return null;
    try {
        const res = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
                model: "glm-4-flash",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user",   content: userMessage  },
                ],
                temperature: 0.3,
                max_tokens:  600,
            }),
        });
        const data = await res.json() as { choices?: { message?: { content?: string } }[] };
        return data.choices?.[0]?.message?.content ?? null;
    } catch (err) {
        console.error("GLM-4 error:", err);
        return null;
    }
}
