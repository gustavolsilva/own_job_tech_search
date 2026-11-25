import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDbSchema, getDb } from "@/db";
import {
  applicationPitches,
  applications,
  companyIntel,
  jobMatches,
  jobs,
} from "@/db/schema";
import { getFxRates } from "@/lib/currency";
import { calculateJobMatch } from "@/lib/matching-engine";
import {
  getOrCreateDefaultProfile,
  mapApplicationRow,
  mapCompanyIntelRow,
  mapJobRow,
  mapMatchRow,
} from "@/lib/repository";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  await ensureDbSchema();
  const { id } = await context.params;
  const db = getDb();
  const profile = await getOrCreateDefaultProfile();

  const [jobRow] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!jobRow) {
    return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });
  }

  const job = mapJobRow(jobRow);

  const [matchRows, intelRows, appRows, pitchRows, fx] = await Promise.all([
    db
      .select()
      .from(jobMatches)
      .where(and(eq(jobMatches.jobId, job.id), eq(jobMatches.profileId, profile.id)))
      .limit(1),
    db
      .select()
      .from(companyIntel)
      .where(eq(companyIntel.companyName, job.company))
      .limit(1),
    db.select().from(applications).where(eq(applications.jobId, job.id)).limit(1),
    db
      .select()
      .from(applicationPitches)
      .where(eq(applicationPitches.jobId, job.id))
      .orderBy(desc(applicationPitches.createdAt)),
    getFxRates(),
  ]);

  let match = matchRows[0] ? mapMatchRow(matchRows[0]) : null;
  if (!match) {
    const computed = await calculateJobMatch(profile, job);
    const matchId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(jobMatches).values({
      id: matchId,
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
      updatedAt: now,
    });
    match = { id: matchId, ...computed, updatedAt: now };
  }

  return NextResponse.json({
    job,
    match,
    companyIntel: intelRows[0] ? mapCompanyIntelRow(intelRows[0]) : null,
    application: appRows[0] ? mapApplicationRow(appRows[0]) : null,
    pitches: pitchRows,
    profile,
    fx,
  });
}

