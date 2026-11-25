import { NextResponse } from "next/server";
import { ensureDbSchema } from "@/db";
import { getConfiguredModels, isAiConfigured } from "@/lib/ai";
import { getFxRates } from "@/lib/currency";

export async function GET() {
  await ensureDbSchema();
  const rates = await getFxRates();
  return NextResponse.json({
    ok: true,
    ai: {
      configured: isAiConfigured(),
      mode: isAiConfigured() ? "hybrid-ai-active" : "heuristic-offline",
      models: getConfiguredModels(),
    },
    fx: rates,
  });
}

