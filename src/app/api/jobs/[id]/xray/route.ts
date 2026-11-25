import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDbSchema, getDb } from "@/db";
import { companyIntel, jobs } from "@/db/schema";
import { generateCompanyXRay } from "@/lib/matching-engine";
import { mapCompanyIntelRow } from "@/lib/repository";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbSchema();
    const { id } = await context.params;
    const db = getDb();

    const [jobRow] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!jobRow) {
      return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });
    }

    const xray = await generateCompanyXRay(
      jobRow.company,
      jobRow.title,
      jobRow.descriptionRaw
    );

    const now = new Date().toISOString();
    const intelId = crypto.randomUUID();

    await db
      .insert(companyIntel)
      .values({
        id: intelId,
        companyName: xray.companyName,
        segment: xray.segment,
        salaryBenchmarkJson: JSON.stringify(xray.salaryBenchmark),
        benefitsEstimateJson: JSON.stringify(xray.benefitsEstimate),
        cultureReviewsJson: JSON.stringify(xray.cultureReviews),
        careerGrowthJson: JSON.stringify(xray.careerGrowth),
        marketTimingJson: JSON.stringify(xray.marketTiming),
        generatedBy: xray.generatedBy,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: companyIntel.companyName,
        set: {
          segment: xray.segment,
          salaryBenchmarkJson: JSON.stringify(xray.salaryBenchmark),
          benefitsEstimateJson: JSON.stringify(xray.benefitsEstimate),
          cultureReviewsJson: JSON.stringify(xray.cultureReviews),
          careerGrowthJson: JSON.stringify(xray.careerGrowth),
          marketTimingJson: JSON.stringify(xray.marketTiming),
          generatedBy: xray.generatedBy,
          updatedAt: now,
        },
      });

    const [saved] = await db
      .select()
      .from(companyIntel)
      .where(eq(companyIntel.companyName, xray.companyName))
      .limit(1);

    return NextResponse.json({ companyIntel: mapCompanyIntelRow(saved) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao gerar Raio-X" },
      { status: 500 }
    );
  }
}

