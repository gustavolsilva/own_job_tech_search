import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _client: Client | null = null;
let _db: ReturnType<typeof drizzleLibsql<typeof schema>> | null = null;
let _initialized = false;

function isPostgresMode(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function getLibsqlClient(): Client {
  if (_client) return _client;

  const url =
    process.env.TURSO_DATABASE_URL ||
    process.env.LIBSQL_URL ||
    (process.env.VERCEL ? "" : "file:./data/radar.db");

  if (!url) {
    throw new Error(
      "Banco de produção não configurado. Conecte Neon Postgres (DATABASE_URL) ou Turso (TURSO_DATABASE_URL) na Vercel."
    );
  }

  if (url.startsWith("file:")) {
    const filePath = url.replace(/^file:/, "");
    const dir = path.dirname(
      path.resolve(/*turbopackIgnore: true*/ process.cwd(), filePath)
    );
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  _client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN,
  });
  return _client;
}

export function getDb(): ReturnType<typeof drizzleLibsql<typeof schema>> {
  if (_db) return _db;

  if (isPostgresMode()) {
    const sql = neon(process.env.DATABASE_URL!);
    _db = drizzleNeon(sql, { schema: schema as never }) as unknown as ReturnType<
      typeof drizzleLibsql<typeof schema>
    >;
    return _db;
  }

  _db = drizzleLibsql(getLibsqlClient(), { schema });
  return _db;
}

export async function ensureDbSchema() {
  if (_initialized) return;

  const statements = [
    `CREATE TABLE IF NOT EXISTS candidate_profiles (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      headline TEXT NOT NULL,
      seniority TEXT NOT NULL DEFAULT 'senior',
      summary TEXT NOT NULL DEFAULT '',
      skills_json TEXT NOT NULL DEFAULT '[]',
      experiences_json TEXT NOT NULL DEFAULT '[]',
      languages_json TEXT NOT NULL DEFAULT '[]',
      accepted_contracts_json TEXT NOT NULL DEFAULT '["clt","pj","fixed_term","freelance"]',
      target_scope TEXT NOT NULL DEFAULT 'both',
      min_monthly_net_brl INTEGER NOT NULL DEFAULT 10000,
      min_hourly_usd INTEGER NOT NULL DEFAULT 35,
      weekly_free_hours INTEGER NOT NULL DEFAULT 20,
      github_username TEXT NOT NULL DEFAULT '',
      linkedin_url TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS profile_documents (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      storage_path TEXT NOT NULL DEFAULT '',
      extracted_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      url TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'international',
      contract_type TEXT NOT NULL DEFAULT 'indeterminate',
      work_model TEXT NOT NULL DEFAULT 'remote',
      location TEXT NOT NULL DEFAULT 'Remote',
      currency TEXT NOT NULL DEFAULT 'USD',
      salary_min DOUBLE PRECISION,
      salary_max DOUBLE PRECISION,
      salary_period TEXT NOT NULL DEFAULT 'monthly',
      estimated_monthly_net_brl INTEGER,
      benefits_json TEXT NOT NULL DEFAULT '[]',
      tags_json TEXT NOT NULL DEFAULT '[]',
      languages_json TEXT NOT NULL DEFAULT '["en"]',
      description_raw TEXT NOT NULL,
      summary_pt TEXT NOT NULL DEFAULT '',
      posted_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS company_intel (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL UNIQUE,
      segment TEXT NOT NULL DEFAULT 'Tech / Software',
      salary_benchmark_json TEXT NOT NULL DEFAULT '{}',
      benefits_estimate_json TEXT NOT NULL DEFAULT '{}',
      culture_reviews_json TEXT NOT NULL DEFAULT '{}',
      career_growth_json TEXT NOT NULL DEFAULT '{}',
      market_timing_json TEXT NOT NULL DEFAULT '{}',
      generated_by TEXT NOT NULL DEFAULT 'heuristic',
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS job_matches (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      overall_score INTEGER NOT NULL,
      technical_score INTEGER NOT NULL,
      seniority_score INTEGER NOT NULL,
      language_model_score INTEGER NOT NULL,
      financial_score INTEGER NOT NULL,
      effort_return_score INTEGER NOT NULL,
      matched_skills_json TEXT NOT NULL DEFAULT '[]',
      missing_skills_json TEXT NOT NULL DEFAULT '[]',
      ats_suggestions_json TEXT NOT NULL DEFAULT '[]',
      rationale TEXT NOT NULL DEFAULT '',
      analyzed_by TEXT NOT NULL DEFAULT 'heuristic',
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'saved',
      negotiated_monthly_brl INTEGER NOT NULL DEFAULT 0,
      estimated_weekly_hours INTEGER NOT NULL DEFAULT 20,
      notes TEXT NOT NULL DEFAULT '',
      contact_info TEXT NOT NULL DEFAULT '',
      follow_up_date TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS application_pitches (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      format TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'pt',
      content TEXT NOT NULL,
      generated_by TEXT NOT NULL DEFAULT 'heuristic',
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sync_runs (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      fetched_count INTEGER NOT NULL DEFAULT 0,
      inserted_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'success',
      error_message TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )`,
  ];

  if (isPostgresMode()) {
    const sql = neon(process.env.DATABASE_URL!);
    for (const stmt of statements) {
      await sql.query(stmt);
    }
  } else {
    const client = getLibsqlClient();
    for (const stmt of statements) {
      await client.execute(stmt);
    }
  }

  _initialized = true;
}
