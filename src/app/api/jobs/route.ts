import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDbSchema, getDb } from "@/db";
import { applications, jobMatches, jobs, syncRuns } from "@/db/schema";
import { getAggregatorCapabilities } from "@/lib/job-sources";
import { calculateJobMatch } from "@/lib/matching-engine";
import {
  getOrCreateDefaultProfile,
  mapApplicationRow,
  mapJobRow,
  mapMatchRow,
} from "@/lib/repository";

export async function GET(req: Request) {
  await ensureDbSchema();
  const db = getDb();
  const profile = await getOrCreateDefaultProfile();

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "all";
  const contractType = searchParams.get("contractType") || "all";
  const workModel = searchParams.get("workModel") || "all";
  const source = searchParams.get("source") || "all";
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const minScore = Number(searchParams.get("minScore") || "0");

  const [jobRows, matchRows, appRows, lastSyncRows] = await Promise.all([
    db.select().from(jobs).orderBy(desc(jobs.postedAt)).limit(300),
    db.select().from(jobMatches).where(eq(jobMatches.profileId, profile.id)),
    db.select().from(applications),
    db.select().from(syncRuns).orderBy(desc(syncRuns.createdAt)).limit(10),
  ]);

  const matchMap = new Map(matchRows.map((m) => [m.jobId, mapMatchRow(m)]));
  const appMap = new Map(appRows.map((a) => [a.jobId, mapApplicationRow(a)]));
  const sourceCounts: Record<string, number> = {};

  const enriched = [];
  for (const row of jobRows) {
    sourceCounts[row.source] = (sourceCounts[row.source] || 0) + 1;

    const job = mapJobRow(row);
    let match = matchMap.get(job.id);
    if (!match) {
      const computed = await calculateJobMatch(profile, job);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.insert(jobMatches).values({
        id,
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
      match = { id, ...computed, updatedAt: now };
    }

    if (scope !== "all" && job.scope !== scope) continue;
    if (contractType !== "all" && job.contractType !== contractType) continue;
    if (workModel !== "all" && job.workModel !== workModel) continue;
    if (source !== "all" && job.source !== source) continue;
    if (minScore > 0 && match.overallScore < minScore) continue;
    if (
      search &&
      !`${job.title} ${job.company} ${job.tags.join(" ")} ${job.location}`
        .toLowerCase()
        .includes(search)
    ) {
      continue;
    }

    enriched.push({
      job,
      match,
      application: appMap.get(job.id) || null,
    });
  }

  enriched.sort((a, b) => b.match.overallScore - a.match.overallScore);

  return NextResponse.json({
    items: enriched,
    total: enriched.length,
    sourceCounts,
    capabilities: getAggregatorCapabilities(),
    profileMeta: {
      headline: profile.headline,
      skills: profile.skills.slice(0, 4),
    },
    lastSyncs: lastSyncRows,
  });
}
