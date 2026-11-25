import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDbSchema, getDb } from "@/db";
import { jobMatches, jobs } from "@/db/schema";
import { getFxRates } from "@/lib/currency";
import {
  computeEstimatedNetBrl,
  detectContractType,
  detectWorkModel,
  extractBenefits,
  extractSalaryInfo,
  extractTags,
  stripHtml,
} from "@/lib/job-normalizer";
import { calculateJobMatch } from "@/lib/matching-engine";
import { getOrCreateDefaultProfile, mapJobRow } from "@/lib/repository";

const AnalyzeSchema = z.object({
  title: z.string().optional().default(""),
  company: z.string().optional().default(""),
  url: z.string().optional().default(""),
  rawText: z.string().optional().default(""),
  scope: z.enum(["national", "international", "auto"]).optional().default("auto"),
  contractType: z
    .enum(["clt", "pj", "indeterminate", "fixed_term", "freelance", "part_time", "auto"])
    .optional()
    .default("auto"),
});

export async function POST(req: Request) {
  try {
    await ensureDbSchema();
    const body = AnalyzeSchema.parse(await req.json());
    let content = body.rawText.trim();

    if (!content && body.url) {
      try {
        const res = await fetch(body.url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(7000),
        });
        if (res.ok) {
          const html = await res.text();
          content = stripHtml(html).slice(0, 12000);
        }
      } catch {
        // Ignore fetch failure; user may paste text directly
      }
    }

    if (!content) {
      return NextResponse.json(
        { error: "Cole o texto da vaga/projeto ou informe uma URL acessível." },
        { status: 400 }
      );
    }

    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const title = body.title.trim() || lines[0]?.slice(0, 90) || "Oportunidade Externa";
    const company = body.company.trim() || "Empresa / Cliente Externo";

    const scope =
      body.scope === "auto"
        ? /(r\$|clt|pj|brasil|brazil|são paulo|remoto brasil|português)/i.test(content)
          ? "national"
          : "international"
        : body.scope;

    const contractType =
      body.contractType === "auto" ? detectContractType(`${title} ${content}`) : body.contractType;
    const workModel = detectWorkModel(content);
    const salary = extractSalaryInfo(content, scope === "national" ? "BRL" : "USD");
    const benefits = extractBenefits(content);
    const tags = extractTags(`${title} ${content}`);
    const rates = await getFxRates();

    const estimatedMonthlyNetBrl = computeEstimatedNetBrl({
      salaryMin: salary.salaryMin,
      salaryMax: salary.salaryMax,
      currency: salary.currency,
      salaryPeriod: salary.salaryPeriod,
      contractType,
      scope,
      benefits,
      rates,
    });

    const db = getDb();
    const now = new Date().toISOString();
    const jobId = crypto.randomUUID();
    const externalId = `manual:${jobId}`;

    const [inserted] = await db
      .insert(jobs)
      .values({
        id: jobId,
        externalId,
        source: "manual",
        title,
        company,
        url: body.url || "",
        scope,
        contractType,
        workModel,
        location: scope === "national" ? "Brasil" : "Internacional",
        currency: salary.currency,
        salaryMin: salary.salaryMin,
        salaryMax: salary.salaryMax,
        salaryPeriod: salary.salaryPeriod,
        estimatedMonthlyNetBrl,
        benefitsJson: JSON.stringify(benefits),
        tagsJson: JSON.stringify(tags),
        languagesJson: JSON.stringify([scope === "national" ? "pt" : "en"]),
        descriptionRaw: content.slice(0, 12000),
        summaryPt: "",
        postedAt: now,
        createdAt: now,
      })
      .returning();

    const job = mapJobRow(inserted);
    const profile = await getOrCreateDefaultProfile();
    const computed = await calculateJobMatch(profile, job);
    const matchId = crypto.randomUUID();

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

    return NextResponse.json({
      job,
      match: { id: matchId, ...computed, updatedAt: now },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao analisar oportunidade" },
      { status: 400 }
    );
  }
}

