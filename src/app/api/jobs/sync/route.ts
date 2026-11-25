import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDbSchema, getDb } from "@/db";
import { jobMatches, jobs } from "@/db/schema";
import { syncAllJobSources } from "@/lib/job-sources";
import { calculateJobMatch } from "@/lib/matching-engine";
import { getOrCreateDefaultProfile, mapJobRow } from "@/lib/repository";

export async function POST() {
  try {
    await ensureDbSchema();
    const syncResult = await syncAllJobSources();
    const profile = await getOrCreateDefaultProfile();
    const db = getDb();

    const [recentJobs, existingMatches] = await Promise.all([
      db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(100),
      db
        .select({ jobId: jobMatches.jobId })
        .from(jobMatches)
        .where(eq(jobMatches.profileId, profile.id)),
    ]);

    const matchedIds = new Set(existingMatches.map((m) => m.jobId));
    let scoredCount = 0;

    for (const row of recentJobs) {
      if (matchedIds.has(row.id)) continue;
      const job = mapJobRow(row);
      const computed = await calculateJobMatch(profile, job);
      await db.insert(jobMatches).values({
        id: crypto.randomUUID(),
        jobId: computed.jobId,
        profileId: computed.profileId,
        overallScore: computed.overallScore,
        technicalScore: computed.technicalScore,
        seniorityScore: computed.seniorityScore,
        languageModelScore: computed.languageModelScore,
        financialScore: computed.financialScore,
        effortReturnScore: computed.effortReturnScore,
        matchedSkillsJson: JSON.stringify(computed.matchedSkills),
        missingSkillsJson: JSON.stringify(computed.missingSkills),
        atsSuggestionsJson: JSON.stringify(computed.atsSuggestions),
        rationale: computed.rationale,
        analyzedBy: computed.analyzedBy,
        updatedAt: new Date().toISOString(),
      });
      scoredCount++;
    }

    return NextResponse.json({
      ...syncResult,
      scoredCount,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao sincronizar vagas" },
      { status: 500 }
    );
  }
}

