import { NextResponse } from "next/server";
import { getMarketContext } from "@/lib/ai-logic";

export async function GET() {
    return NextResponse.json({
        success:       true,
        service:       "StreamYield AI Agent",
        aiProvider:    process.env.ZHIPU_API_KEY
            ? "Zhipu GLM-4 (autonomous decision mode)"
            : "Fallback (rules + template — set ZHIPU_API_KEY to enable AI)",
        autonomousMode: !!process.env.ZHIPU_API_KEY,
        marketContext:  getMarketContext(),
        timestamp:      new Date().toISOString(),
    });
}
