import {
  sqliteTable,
  text as sText,
  integer as sInt,
  real as sReal,
} from "drizzle-orm/sqlite-core";
import {
  pgTable,
  text as pText,
  integer as pInt,
  doublePrecision as pReal,
} from "drizzle-orm/pg-core";

const usePg = Boolean(process.env.DATABASE_URL);
const tbl = (usePg ? pgTable : sqliteTable) as typeof sqliteTable;
const text = (usePg ? pText : sText) as typeof sText;
const integer = (usePg ? pInt : sInt) as typeof sInt;
const real = (usePg ? pReal : sReal) as typeof sReal;

export const candidateProfiles = tbl("candidate_profiles", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  headline: text("headline").notNull(),
  seniority: text("seniority").notNull().default("senior"),
  summary: text("summary").notNull().default(""),
  skillsJson: text("skills_json").notNull().default("[]"),
  experiencesJson: text("experiences_json").notNull().default("[]"),
  languagesJson: text("languages_json").notNull().default("[]"),
  acceptedContractsJson: text("accepted_contracts_json")
    .notNull()
    .default('["clt","pj","fixed_term","freelance"]'),
  targetScope: text("target_scope").notNull().default("both"),
  minMonthlyNetBrl: integer("min_monthly_net_brl").notNull().default(10000),
  minHourlyUsd: integer("min_hourly_usd").notNull().default(35),
  weeklyFreeHours: integer("weekly_free_hours").notNull().default(20),
  githubUsername: text("github_username").notNull().default(""),
  linkedinUrl: text("linkedin_url").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});

export const profileDocuments = tbl("profile_documents", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull().default(0),
  storagePath: text("storage_path").notNull().default(""),
  extractedText: text("extracted_text").notNull(),
  createdAt: text("created_at").notNull(),
});

export const jobs = tbl("jobs", {
  id: text("id").primaryKey(),
  externalId: text("external_id").notNull().unique(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  url: text("url").notNull(),
  scope: text("scope").notNull().default("international"),
  contractType: text("contract_type").notNull().default("indeterminate"),
  workModel: text("work_model").notNull().default("remote"),
  location: text("location").notNull().default("Remote"),
  currency: text("currency").notNull().default("USD"),
  salaryMin: real("salary_min"),
  salaryMax: real("salary_max"),
  salaryPeriod: text("salary_period").notNull().default("monthly"),
  estimatedMonthlyNetBrl: integer("estimated_monthly_net_brl"),
  benefitsJson: text("benefits_json").notNull().default("[]"),
  tagsJson: text("tags_json").notNull().default("[]"),
  languagesJson: text("languages_json").notNull().default('["en"]'),
  descriptionRaw: text("description_raw").notNull(),
  summaryPt: text("summary_pt").notNull().default(""),
  postedAt: text("posted_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const companyIntel = tbl("company_intel", {
  id: text("id").primaryKey(),
  companyName: text("company_name").notNull().unique(),
  segment: text("segment").notNull().default("Tech / Software"),
  salaryBenchmarkJson: text("salary_benchmark_json").notNull().default("{}"),
  benefitsEstimateJson: text("benefits_estimate_json").notNull().default("{}"),
  cultureReviewsJson: text("culture_reviews_json").notNull().default("{}"),
  careerGrowthJson: text("career_growth_json").notNull().default("{}"),
  marketTimingJson: text("market_timing_json").notNull().default("{}"),
  generatedBy: text("generated_by").notNull().default("heuristic"),
  updatedAt: text("updated_at").notNull(),
});

export const jobMatches = tbl("job_matches", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  profileId: text("profile_id").notNull(),
  overallScore: integer("overall_score").notNull(),
  technicalScore: integer("technical_score").notNull(),
  seniorityScore: integer("seniority_score").notNull(),
  languageModelScore: integer("language_model_score").notNull(),
  financialScore: integer("financial_score").notNull(),
  effortReturnScore: integer("effort_return_score").notNull(),
  matchedSkillsJson: text("matched_skills_json").notNull().default("[]"),
  missingSkillsJson: text("missing_skills_json").notNull().default("[]"),
  atsSuggestionsJson: text("ats_suggestions_json").notNull().default("[]"),
  rationale: text("rationale").notNull().default(""),
  analyzedBy: text("analyzed_by").notNull().default("heuristic"),
  updatedAt: text("updated_at").notNull(),
});

export const applications = tbl("applications", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  status: text("status").notNull().default("saved"),
  negotiatedMonthlyBrl: integer("negotiated_monthly_brl").notNull().default(0),
  estimatedWeeklyHours: integer("estimated_weekly_hours").notNull().default(20),
  notes: text("notes").notNull().default(""),
  contactInfo: text("contact_info").notNull().default(""),
  followUpDate: text("follow_up_date").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});

export const applicationPitches = tbl("application_pitches", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  format: text("format").notNull(),
  language: text("language").notNull().default("pt"),
  content: text("content").notNull(),
  generatedBy: text("generated_by").notNull().default("heuristic"),
  createdAt: text("created_at").notNull(),
});

export const syncRuns = tbl("sync_runs", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  fetchedCount: integer("fetched_count").notNull().default(0),
  insertedCount: integer("inserted_count").notNull().default(0),
  status: text("status").notNull().default("success"),
  errorMessage: text("error_message").notNull().default(""),
  createdAt: text("created_at").notNull(),
});
