import { NextResponse } from "next/server";
import { VAULT_TIERS, getMarketContext } from "@/lib/ai-logic";

export async function GET() {
    return NextResponse.json({
        success: true,
        tiers:  VAULT_TIERS,
        market: getMarketContext(),
    });
}
