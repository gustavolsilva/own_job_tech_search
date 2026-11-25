import { desc, eq } from "drizzle-orm";
import { ensureDbSchema, getDb } from "@/db";
import {
  applications,
  candidateProfiles,
  companyIntel,
  jobMatches,
  jobs,
  profileDocuments,
} from "@/db/schema";
import type {
  ApplicationDTO,
  ApplicationStatus,
  BenefitItem,
  CompanyIntelDTO,
  ContractType,
  CurrencyCode,
  ExperienceItem,
  JobDTO,
  JobScope,
  LanguageItem,
  MatchDTO,
  ProfileDTO,
  SalaryPeriod,
  WorkModel,
} from "./types";

function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getOrCreateDefaultProfile(): Promise<ProfileDTO> {
  await ensureDbSchema();
  const db = getDb();
  const rows = await db
    .select()
    .from(candidateProfiles)
    .orderBy(desc(candidateProfiles.updatedAt))
    .limit(1);

  if (rows.length > 0) {
    const r = rows[0];
    return {
      id: r.id,
      fullName: r.fullName,
      headline: r.headline,
      seniority: r.seniority,
      summary: r.summary,
      skills: safeParseJson<string[]>(r.skillsJson, []),
      experiences: safeParseJson<ExperienceItem[]>(r.experiencesJson, []),
      languages: safeParseJson<LanguageItem[]>(r.languagesJson, []),
      acceptedContracts: safeParseJson<ContractType[]>(r.acceptedContractsJson, [
        "clt",
        "pj",
        "fixed_term",
        "freelance",
      ]),
      targetScope: (r.targetScope as ProfileDTO["targetScope"]) || "both",
      minMonthlyNetBrl: r.minMonthlyNetBrl,
      minHourlyUsd: r.minHourlyUsd,
      weeklyFreeHours: r.weeklyFreeHours,
      githubUsername: r.githubUsername,
      linkedinUrl: r.linkedinUrl,
      updatedAt: r.updatedAt,
    };
  }

  const now = new Date().toISOString();
  const defaultProfile: ProfileDTO = {
    id: "default-profile",
    fullName: "Seu Perfil Profissional",
    headline: "Full-Stack Software Engineer",
    seniority: "senior",
    summary:
      "Envie seu PDF do LinkedIn, currículo (.pdf, .docx, .doc) ou cole seu resumo para personalizar o cálculo de aderência e as propostas.",
    skills: ["TypeScript", "React", "Next.js", "Node.js", "Python", "PostgreSQL", "Docker"],
    experiences: [],
    languages: [
      { language: "Português", level: "Nativo" },
      { language: "Inglês", level: "Avançado" },
    ],
    acceptedContracts: ["clt", "pj", "indeterminate", "fixed_term", "freelance", "part_time"],
    targetScope: "both",
    minMonthlyNetBrl: 12000,
    minHourlyUsd: 40,
    weeklyFreeHours: 20,
    githubUsername: "",
    linkedinUrl: "",
    updatedAt: now,
  };

  await db.insert(candidateProfiles).values({
    id: defaultProfile.id,
    fullName: defaultProfile.fullName,
    headline: defaultProfile.headline,
    seniority: defaultProfile.seniority,
    summary: defaultProfile.summary,
    skillsJson: JSON.stringify(defaultProfile.skills),
    experiencesJson: JSON.stringify(defaultProfile.experiences),
    languagesJson: JSON.stringify(defaultProfile.languages),
    acceptedContractsJson: JSON.stringify(defaultProfile.acceptedContracts),
    targetScope: defaultProfile.targetScope,
    minMonthlyNetBrl: defaultProfile.minMonthlyNetBrl,
    minHourlyUsd: defaultProfile.minHourlyUsd,
    weeklyFreeHours: defaultProfile.weeklyFreeHours,
    githubUsername: defaultProfile.githubUsername,
    linkedinUrl: defaultProfile.linkedinUrl,
    updatedAt: now,
  });

  return defaultProfile;
}

export function mapJobRow(r: typeof jobs.$inferSelect): JobDTO {
  return {
    id: r.id,
    externalId: r.externalId,
    source: r.source,
    title: r.title,
    company: r.company,
    url: r.url,
    scope: r.scope as JobScope,
    contractType: r.contractType as ContractType,
    workModel: r.workModel as WorkModel,
    location: r.location,
    currency: r.currency as CurrencyCode,
    salaryMin: r.salaryMin,
    salaryMax: r.salaryMax,
    salaryPeriod: r.salaryPeriod as SalaryPeriod,
    estimatedMonthlyNetBrl: r.estimatedMonthlyNetBrl,
    benefits: safeParseJson<BenefitItem[]>(r.benefitsJson, []),
    tags: safeParseJson<string[]>(r.tagsJson, []),
    languages: safeParseJson<string[]>(r.languagesJson, ["en"]),
    descriptionRaw: r.descriptionRaw,
    summaryPt: r.summaryPt,
    postedAt: r.postedAt,
    createdAt: r.createdAt,
  };
}

export function mapMatchRow(r: typeof jobMatches.$inferSelect): MatchDTO {
  return {
    id: r.id,
    jobId: r.jobId,
    profileId: r.profileId,
    overallScore: r.overallScore,
    technicalScore: r.technicalScore,
    seniorityScore: r.seniorityScore,
    languageModelScore: r.languageModelScore,
    financialScore: r.financialScore,
    effortReturnScore: r.effortReturnScore,
    matchedSkills: safeParseJson<string[]>(r.matchedSkillsJson, []),
    missingSkills: safeParseJson<string[]>(r.missingSkillsJson, []),
    atsSuggestions: safeParseJson<string[]>(r.atsSuggestionsJson, []),
    rationale: r.rationale,
    analyzedBy: (r.analyzedBy as "ai" | "heuristic") || "heuristic",
    updatedAt: r.updatedAt,
  };
}

export function mapCompanyIntelRow(
  r: typeof companyIntel.$inferSelect
): CompanyIntelDTO {
  return {
    id: r.id,
    companyName: r.companyName,
    segment: r.segment,
    salaryBenchmark: safeParseJson(r.salaryBenchmarkJson, {
      cltRangeBrl: "",
      pjOrContractorRange: "",
      variablePay: "",
      dataOrigin: "",
    }),
    benefitsEstimate: safeParseJson(r.benefitsEstimateJson, {
      vrVaMonthlyBrl: "",
      healthDental: "",
      homeOfficeAndEducation: "",
      wellhubAndOther: "",
    }),
    cultureReviews: safeParseJson(r.cultureReviewsJson, {
      estimatedRating: "",
      praisedPoints: [],
      commonComplaints: [],
      exEmployeeSignals: "",
    }),
    careerGrowth: safeParseJson(r.careerGrowthJson, {
      yTrackOrSpecialist: "",
      reviewCycle: "",
      renewalPotentialForContracts: "",
    }),
    marketTiming: safeParseJson(r.marketTimingJson, {
      currentMomentum: "",
      favorableSignals: [],
      alertSignals: [],
      verdict: "",
    }),
    generatedBy: (r.generatedBy as "ai" | "heuristic") || "heuristic",
    updatedAt: r.updatedAt,
  };
}

export function mapApplicationRow(
  r: typeof applications.$inferSelect
): ApplicationDTO {
  return {
    id: r.id,
    jobId: r.jobId,
    status: r.status as ApplicationStatus,
    negotiatedMonthlyBrl: r.negotiatedMonthlyBrl,
    estimatedWeeklyHours: r.estimatedWeeklyHours,
    notes: r.notes,
    contactInfo: r.contactInfo,
    followUpDate: r.followUpDate,
    updatedAt: r.updatedAt,
  };
}

export async function getProfileDocuments(profileId: string) {
  await ensureDbSchema();
  const db = getDb();
  return db
    .select()
    .from(profileDocuments)
    .where(eq(profileDocuments.profileId, profileId))
    .orderBy(desc(profileDocuments.createdAt));
}

