import { metric } from "@vercel/functions";
import { ensureDbSchema, getDb } from "@/db";
import { jobs, syncRuns } from "@/db/schema";
import { getFxRates, type FxRates } from "./currency";
import {
  computeEstimatedNetBrl,
  detectContractType,
  detectWorkModel,
  extractBenefits,
  extractSalaryInfo,
  extractTags,
  stripHtml,
} from "./job-normalizer";
import { getOrCreateDefaultProfile } from "./repository";
import type { ContractType, CurrencyCode, JobScope, SalaryPeriod, WorkModel } from "./types";

interface NormalizedJobInput {
  externalId: string;
  source: string;
  title: string;
  company: string;
  url: string;
  scope: JobScope;
  contractType: ContractType;
  workModel: WorkModel;
  location: string;
  currency: CurrencyCode;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: SalaryPeriod;
  descriptionRaw: string;
  extraTags: string[];
  languages: string[];
  postedAt: string;
}

function fingerprint(company: string, title: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  return `${norm(company)}::${norm(title)}`;
}

async function fetchRemotive(): Promise<NormalizedJobInput[]> {
  const res = await fetch("https://remotive.com/api/remote-jobs?limit=25", {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Remotive HTTP ${res.status}`);
  const data = (await res.json()) as {
    jobs?: Array<{
      id: number;
      url: string;
      title: string;
      company_name: string;
      category: string;
      tags?: string[];
      job_type?: string;
      publication_date: string;
      candidate_required_location?: string;
      salary?: string;
      description: string;
    }>;
  };

  return (data.jobs || []).map((j) => {
    const cleanDesc = stripHtml(j.description || "");
    const salaryText = `${j.salary || ""} ${cleanDesc.slice(0, 600)}`;
    const salary = extractSalaryInfo(salaryText, "USD");
    const contractType =
      j.job_type === "freelance"
        ? "freelance"
        : j.job_type === "part_time"
          ? "part_time"
          : j.job_type === "contract"
            ? "fixed_term"
            : detectContractType(cleanDesc);

    return {
      externalId: `remotive:${j.id}`,
      source: "remotive",
      title: j.title,
      company: j.company_name,
      url: j.url,
      scope: "international",
      contractType,
      workModel: "remote",
      location: j.candidate_required_location || "Worldwide Remote",
      ...salary,
      descriptionRaw: cleanDesc.slice(0, 8000),
      extraTags: [...(j.tags || []), j.category].filter(Boolean),
      languages: ["en"],
      postedAt: j.publication_date || new Date().toISOString(),
    };
  });
}

async function fetchRemoteOK(): Promise<NormalizedJobInput[]> {
  const res = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "own-job-tech-search" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`RemoteOK HTTP ${res.status}`);
  const raw = (await res.json()) as Array<{
    id?: string;
    slug?: string;
    url?: string;
    position?: string;
    company?: string;
    location?: string;
    tags?: string[];
    salary_min?: number;
    salary_max?: number;
    date?: string;
    description?: string;
  }>;

  return raw
    .filter((j) => j && j.position && j.company)
    .slice(0, 25)
    .map((j) => {
      const cleanDesc = stripHtml(j.description || "");
      const hasApiSalary = Boolean(j.salary_min || j.salary_max);
      const salary = hasApiSalary
        ? {
            currency: "USD" as CurrencyCode,
            salaryMin: j.salary_min ?? j.salary_max ?? null,
            salaryMax: j.salary_max ?? j.salary_min ?? null,
            salaryPeriod: "yearly" as SalaryPeriod,
          }
        : extractSalaryInfo(cleanDesc.slice(0, 600), "USD");

      return {
        externalId: `remoteok:${j.id || j.slug}`,
        source: "remoteok",
        title: j.position!,
        company: j.company!,
        url: j.url || `https://remoteok.com/remote-jobs/${j.slug || j.id}`,
        scope: "international",
        contractType: detectContractType(`${j.position} ${cleanDesc}`),
        workModel: "remote",
        location: j.location || "Remote Worldwide",
        ...salary,
        descriptionRaw: cleanDesc.slice(0, 8000),
        extraTags: j.tags || [],
        languages: ["en"],
        postedAt: j.date || new Date().toISOString(),
      };
    });
}

async function fetchArbeitnow(): Promise<NormalizedJobInput[]> {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Arbeitnow HTTP ${res.status}`);
  const data = (await res.json()) as {
    data?: Array<{
      slug: string;
      company_name: string;
      title: string;
      description: string;
      remote: boolean;
      url: string;
      tags?: string[];
      job_types?: string[];
      location: string;
      created_at: number;
    }>;
  };

  return (data.data || []).slice(0, 20).map((j) => {
    const cleanDesc = stripHtml(j.description || "");
    const salary = extractSalaryInfo(cleanDesc.slice(0, 800), "EUR");
    return {
      externalId: `arbeitnow:${j.slug}`,
      source: "arbeitnow",
      title: j.title,
      company: j.company_name,
      url: j.url,
      scope: "international",
      contractType: detectContractType(cleanDesc, j.job_types || []),
      workModel: j.remote ? "remote" : detectWorkModel(cleanDesc, j.location),
      location: j.location || (j.remote ? "Europe / Remote" : "Europe"),
      ...salary,
      descriptionRaw: cleanDesc.slice(0, 8000),
      extraTags: j.tags || [],
      languages: ["en"],
      postedAt: j.created_at
        ? new Date(j.created_at * 1000).toISOString()
        : new Date().toISOString(),
    };
  });
}

async function fetchJobicy(): Promise<NormalizedJobInput[]> {
  const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=20", {
    headers: { "User-Agent": "own-job-tech-search" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Jobicy HTTP ${res.status}`);
  const data = (await res.json()) as {
    jobs?: Array<{
      id: number;
      url: string;
      jobTitle: string;
      companyName: string;
      jobIndustry?: string[];
      jobType?: string[];
      jobGeo?: string;
      pubDate: string;
      annualSalaryMin?: string | number;
      annualSalaryMax?: string | number;
      salaryCurrency?: string;
      jobDescription?: string;
    }>;
  };

  return (data.jobs || []).map((j) => {
    const cleanDesc = stripHtml(j.jobDescription || "");
    const min = j.annualSalaryMin ? Number(j.annualSalaryMin) : null;
    const max = j.annualSalaryMax ? Number(j.annualSalaryMax) : null;
    const hasSalary = Boolean(min || max);
    const salary = hasSalary
      ? {
          currency: (j.salaryCurrency as CurrencyCode) || "USD",
          salaryMin: min || max,
          salaryMax: max || min,
          salaryPeriod: "yearly" as SalaryPeriod,
        }
      : extractSalaryInfo(cleanDesc.slice(0, 800), "USD");

    return {
      externalId: `jobicy:${j.id}`,
      source: "jobicy",
      title: j.jobTitle,
      company: j.companyName,
      url: j.url,
      scope: "international",
      contractType: detectContractType(cleanDesc, j.jobType || []),
      workModel: "remote",
      location: j.jobGeo || "Worldwide Remote",
      ...salary,
      descriptionRaw: cleanDesc.slice(0, 8000),
      extraTags: j.jobIndustry || [],
      languages: ["en"],
      postedAt: j.pubDate || new Date().toISOString(),
    };
  });
}

async function fetchHimalayas(): Promise<NormalizedJobInput[]> {
  const res = await fetch("https://himalayas.app/jobs/api?limit=20", {
    headers: { "User-Agent": "own-job-tech-search" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Himalayas HTTP ${res.status}`);
  const data = (await res.json()) as {
    jobs?: Array<{
      guid?: string;
      title: string;
      companyName: string;
      applicationLink?: string;
      description?: string;
      excerpt?: string;
      employmentType?: string;
      minSalary?: number | null;
      maxSalary?: number | null;
      currency?: string;
      locationRestrictions?: string[];
      categories?: string[];
      pubDate?: number;
    }>;
  };

  return (data.jobs || []).map((j, idx) => {
    const cleanDesc = stripHtml(j.description || j.excerpt || "");
    const hasSalary = Boolean(j.minSalary || j.maxSalary);
    const salary = hasSalary
      ? {
          currency: (j.currency as CurrencyCode) || "USD",
          salaryMin: j.minSalary ?? j.maxSalary ?? null,
          salaryMax: j.maxSalary ?? j.minSalary ?? null,
          salaryPeriod: "yearly" as SalaryPeriod,
        }
      : extractSalaryInfo(cleanDesc.slice(0, 800), "USD");

    return {
      externalId: `himalayas:${j.guid || `${j.companyName}-${idx}`}`,
      source: "himalayas",
      title: j.title,
      company: j.companyName,
      url: j.applicationLink || "https://himalayas.app/jobs",
      scope: "international",
      contractType: detectContractType(cleanDesc, [j.employmentType || ""]),
      workModel: "remote",
      location:
        j.locationRestrictions && j.locationRestrictions.length > 0
          ? j.locationRestrictions.join(", ")
          : "Worldwide Remote",
      ...salary,
      descriptionRaw: cleanDesc.slice(0, 8000),
      extraTags: j.categories || [],
      languages: ["en"],
      postedAt: j.pubDate
        ? new Date(j.pubDate * 1000).toISOString()
        : new Date().toISOString(),
    };
  });
}

async function fetchHnHiring(): Promise<NormalizedJobInput[]> {
  const storyRes = await fetch(
    "https://hn.algolia.com/api/v1/search_by_date?query=%22Ask%20HN:%20Who%20is%20hiring%22&tags=story&hitsPerPage=1",
    { signal: AbortSignal.timeout(7000) }
  );
  if (!storyRes.ok) throw new Error(`HN Story HTTP ${storyRes.status}`);
  const storyData = (await storyRes.json()) as {
    hits?: Array<{ objectID: string }>;
  };
  const storyId = storyData.hits?.[0]?.objectID;
  if (!storyId) return [];

  const commentsRes = await fetch(
    `https://hn.algolia.com/api/v1/search_by_date?tags=comment,story_${storyId}&hitsPerPage=20`,
    { signal: AbortSignal.timeout(7000) }
  );
  if (!commentsRes.ok) throw new Error(`HN Comments HTTP ${commentsRes.status}`);
  const commentsData = (await commentsRes.json()) as {
    hits?: Array<{
      objectID: string;
      comment_text?: string;
      created_at?: string;
    }>;
  };

  return (commentsData.hits || [])
    .filter((c) => c.comment_text && c.comment_text.length > 60)
    .map((c) => {
      const clean = stripHtml(c.comment_text || "");
      const header = clean.split("|").map((p) => p.trim());
      const company = (header[0] || "Startup (HN)").slice(0, 50);
      const title = (header[1] || "Software Engineer (HN Who is Hiring)").slice(0, 85);
      const location = header[2] || "Remote / Global";
      const salary = extractSalaryInfo(clean, "USD");

      return {
        externalId: `hn_hiring:${c.objectID}`,
        source: "hn_hiring",
        title,
        company,
        url: `https://news.ycombinator.com/item?id=${c.objectID}`,
        scope: "international" as JobScope,
        contractType: detectContractType(clean),
        workModel: detectWorkModel(clean, location),
        location: location.slice(0, 60),
        ...salary,
        descriptionRaw: clean.slice(0, 8000),
        extraTags: ["HN Hiring"],
        languages: ["en"],
        postedAt: c.created_at || new Date().toISOString(),
      };
    });
}

async function fetchWeWorkRemotely(): Promise<NormalizedJobInput[]> {
  const res = await fetch("https://weworkremotely.com/remote-jobs.rss", {
    headers: { "User-Agent": "own-job-tech-search" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`WWR HTTP ${res.status}`);
  const xml = await res.text();
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  return itemMatches.slice(0, 20).map((itemXml, idx) => {
    const getTag = (tag: string) => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "";
    };

    const fullTitle = stripHtml(getTag("title"));
    const [companyPart, ...roleParts] = fullTitle.split(":");
    const company = roleParts.length > 0 ? companyPart.trim() : "Remote Company";
    const title = roleParts.length > 0 ? roleParts.join(":").trim() : fullTitle;
    const link = getTag("link");
    const desc = stripHtml(getTag("description"));
    const pubDate = getTag("pubDate");
    const salary = extractSalaryInfo(desc.slice(0, 800), "USD");

    return {
      externalId: `weworkremotely:${link || idx}`,
      source: "weworkremotely",
      title: title || "Remote Engineer",
      company,
      url: link || "https://weworkremotely.com",
      scope: "international" as JobScope,
      contractType: detectContractType(desc),
      workModel: "remote" as WorkModel,
      location: "Remote Worldwide",
      ...salary,
      descriptionRaw: desc.slice(0, 8000),
      extraTags: ["We Work Remotely"],
      languages: ["en"],
      postedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    };
  });
}

async function fetchGithubBrazilJobs(): Promise<NormalizedJobInput[]> {
  const repos = [
    "backend-br/vagas",
    "frontendbr/vagas",
    "react-brasil/vagas",
    "devops-br/vagas",
    "datascience-br/vagas",
    "qa-brasil/vagas",
    "mobile-br/vagas",
  ];

  const results = await Promise.allSettled(
    repos.map(async (repo) => {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/issues?state=open&per_page=6&sort=created&direction=desc`,
        {
          headers: { "User-Agent": "own-job-tech-search" },
          signal: AbortSignal.timeout(7000),
        }
      );
      if (!res.ok) throw new Error(`GitHub ${repo} HTTP ${res.status}`);
      const issues = (await res.json()) as Array<{
        id: number;
        html_url: string;
        title: string;
        body?: string | null;
        created_at: string;
        labels?: Array<{ name: string }>;
      }>;

      return issues.map((issue) => {
        const labels = (issue.labels || []).map((l) => l.name);
        const body = issue.body || "";
        const titleCompanyMatch = issue.title.match(/(?:na|at|@|-)\s*([^\]|[\]]+)$/i);
        const company =
          titleCompanyMatch?.[1]?.trim() ||
          issue.title.split("]").pop()?.split("-").pop()?.trim() ||
          "Empresa BR";

        const salary = extractSalaryInfo(`${issue.title}\n${body}`, "BRL");
        return {
          externalId: `github_br:${repo}:${issue.id}`,
          source: "github_br",
          title: issue.title,
          company: company.slice(0, 60),
          url: issue.html_url,
          scope: "national" as JobScope,
          contractType: detectContractType(`${issue.title} ${body}`, labels),
          workModel: detectWorkModel(`${issue.title} ${body} ${labels.join(" ")}`),
          location: labels.some((l) => /remoto|remote/i.test(l))
            ? "Brasil (Remoto)"
            : "Brasil",
          ...salary,
          descriptionRaw: body.slice(0, 8000),
          extraTags: labels,
          languages: ["pt"],
          postedAt: issue.created_at,
        };
      });
    })
  );

  const collected: NormalizedJobInput[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") collected.push(...r.value);
  }
  return collected;
}

/**
 * Conector sancionado JSearch (RapidAPI): consolida LinkedIn, Glassdoor, Indeed e ZipRecruiter.
 */
async function fetchJSearchAggregator(query: string): Promise<NormalizedJobInput[]> {
  const apiKey = process.env.RAPIDAPI_JSEARCH_KEY?.trim();
  if (!apiKey) return [];

  const res = await fetch(
    `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=2&date_posted=week`,
    {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) throw new Error(`JSearch HTTP ${res.status}`);
  const data = (await res.json()) as {
    data?: Array<{
      job_id: string;
      job_publisher?: string;
      job_title: string;
      employer_name: string;
      job_apply_link: string;
      job_description: string;
      job_is_remote?: boolean;
      job_city?: string;
      job_country?: string;
      job_employment_type?: string;
      job_min_salary?: number | null;
      job_max_salary?: number | null;
      job_salary_currency?: string | null;
      job_salary_period?: string | null;
      job_posted_at_datetime_utc?: string;
    }>;
  };

  return (data.data || []).map((j) => {
    const pub = (j.job_publisher || "jsearch").toLowerCase();
    const source = pub.includes("linkedin")
      ? "linkedin"
      : pub.includes("glassdoor")
        ? "glassdoor"
        : pub.includes("indeed")
          ? "indeed"
          : "jsearch";
    const isBr = j.job_country === "BR" || /brazil|brasil/i.test(j.job_country || "");
    const desc = j.job_description || "";
    const hasSalary = Boolean(j.job_min_salary || j.job_max_salary);
    const salary = hasSalary
      ? {
          currency: ((j.job_salary_currency as CurrencyCode) ||
            (isBr ? "BRL" : "USD")) as CurrencyCode,
          salaryMin: j.job_min_salary ?? j.job_max_salary ?? null,
          salaryMax: j.job_max_salary ?? j.job_min_salary ?? null,
          salaryPeriod:
            j.job_salary_period?.toLowerCase() === "hour"
              ? ("hourly" as SalaryPeriod)
              : j.job_salary_period?.toLowerCase() === "month"
                ? ("monthly" as SalaryPeriod)
                : ("yearly" as SalaryPeriod),
        }
      : extractSalaryInfo(desc.slice(0, 800), isBr ? "BRL" : "USD");

    return {
      externalId: `${source}:${j.job_id}`,
      source,
      title: j.job_title,
      company: j.employer_name,
      url: j.job_apply_link,
      scope: isBr ? "national" : "international",
      contractType:
        j.job_employment_type === "CONTRACTOR"
          ? "fixed_term"
          : j.job_employment_type === "PARTTIME"
            ? "part_time"
            : detectContractType(desc),
      workModel: j.job_is_remote ? "remote" : detectWorkModel(desc, j.job_city || ""),
      location: [j.job_city, j.job_country].filter(Boolean).join(", ") || "Remote",
      ...salary,
      descriptionRaw: desc.slice(0, 8000),
      extraTags: [j.job_publisher || "Aggregator"],
      languages: [isBr ? "pt" : "en"],
      postedAt: j.job_posted_at_datetime_utc || new Date().toISOString(),
    };
  });
}

/**
 * Conector sancionado Adzuna (BR + US): agrega Indeed, Catho, InfoJobs e portais corporativos.
 */
async function fetchAdzunaAggregator(query: string): Promise<NormalizedJobInput[]> {
  const appId = process.env.ADZUNA_APP_ID?.trim();
  const appKey = process.env.ADZUNA_APP_KEY?.trim();
  if (!appId || !appKey) return [];

  const countries: Array<{ code: "br" | "us"; scope: JobScope; currency: CurrencyCode }> = [
    { code: "br", scope: "national", currency: "BRL" },
    { code: "us", scope: "international", currency: "USD" },
  ];

  const settled = await Promise.allSettled(
    countries.map(async (c) => {
      const res = await fetch(
        `https://api.adzuna.com/v1/api/jobs/${c.code}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=12&what=${encodeURIComponent(query)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error(`Adzuna ${c.code} HTTP ${res.status}`);
      const data = (await res.json()) as {
        results?: Array<{
          id: string;
          title: string;
          company?: { display_name?: string };
          location?: { display_name?: string };
          description: string;
          redirect_url: string;
          salary_min?: number;
          salary_max?: number;
          contract_type?: string;
          created: string;
        }>;
      };

      return (data.results || []).map((j) => ({
        externalId: `adzuna_${c.code}:${j.id}`,
        source: "adzuna",
        title: stripHtml(j.title),
        company: j.company?.display_name || "Empresa",
        url: j.redirect_url,
        scope: c.scope,
        contractType: detectContractType(j.description, [j.contract_type || ""]),
        workModel: detectWorkModel(j.description, j.location?.display_name || ""),
        location: j.location?.display_name || (c.code === "br" ? "Brasil" : "USA"),
        currency: c.currency,
        salaryMin: j.salary_min ?? null,
        salaryMax: j.salary_max ?? null,
        salaryPeriod: (c.code === "br" ? "monthly" : "yearly") as SalaryPeriod,
        descriptionRaw: stripHtml(j.description).slice(0, 8000),
        extraTags: ["Adzuna"],
        languages: [c.code === "br" ? "pt" : "en"],
        postedAt: j.created || new Date().toISOString(),
      }));
    })
  );

  const out: NormalizedJobInput[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") out.push(...r.value);
  }
  return out;
}

/**
 * Conector sancionado Jooble: agregador Brasil e Global.
 */
async function fetchJoobleAggregator(query: string): Promise<NormalizedJobInput[]> {
  const apiKey = process.env.JOOBLE_API_KEY?.trim();
  if (!apiKey) return [];

  const res = await fetch(`https://jooble.org/api/${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords: query, location: "Remote" }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Jooble HTTP ${res.status}`);
  const data = (await res.json()) as {
    jobs?: Array<{
      id: number | string;
      title: string;
      company?: string;
      location?: string;
      snippet: string;
      salary?: string;
      link: string;
      type?: string;
      updated?: string;
    }>;
  };

  return (data.jobs || []).slice(0, 15).map((j) => {
    const clean = stripHtml(j.snippet || "");
    const salary = extractSalaryInfo(`${j.salary || ""} ${clean}`, "BRL");
    const isBr = /brasil|brazil|r\$/i.test(`${j.location} ${j.salary}`);
    return {
      externalId: `jooble:${j.id}`,
      source: "jooble",
      title: stripHtml(j.title),
      company: j.company || "Empresa (Jooble)",
      url: j.link,
      scope: isBr ? ("national" as JobScope) : ("international" as JobScope),
      contractType: detectContractType(`${j.type || ""} ${clean}`),
      workModel: detectWorkModel(clean, j.location || ""),
      location: j.location || "Remote",
      ...salary,
      descriptionRaw: clean.slice(0, 8000),
      extraTags: ["Jooble"],
      languages: [isBr ? "pt" : "en"],
      postedAt: j.updated || new Date().toISOString(),
    };
  });
}

export function getAggregatorCapabilities() {
  return {
    openEngines: [
      { id: "github_br", name: "GitHub Vagas BR (7 comunidades)", active: true },
      { id: "remotive", name: "Remotive", active: true },
      { id: "remoteok", name: "RemoteOK", active: true },
      { id: "arbeitnow", name: "Arbeitnow", active: true },
      { id: "jobicy", name: "Jobicy", active: true },
      { id: "himalayas", name: "Himalayas", active: true },
      { id: "hn_hiring", name: "Hacker News Who is Hiring", active: true },
      { id: "weworkremotely", name: "We Work Remotely", active: true },
    ],
    keyedEngines: [
      {
        id: "jsearch",
        name: "JSearch (LinkedIn + Glassdoor + Indeed)",
        envKey: "RAPIDAPI_JSEARCH_KEY",
        active: Boolean(process.env.RAPIDAPI_JSEARCH_KEY?.trim()),
      },
      {
        id: "adzuna",
        name: "Adzuna (Brasil & Global)",
        envKey: "ADZUNA_APP_ID",
        active: Boolean(
          process.env.ADZUNA_APP_ID?.trim() && process.env.ADZUNA_APP_KEY?.trim()
        ),
      },
      {
        id: "jooble",
        name: "Jooble (Brasil & Global)",
        envKey: "JOOBLE_API_KEY",
        active: Boolean(process.env.JOOBLE_API_KEY?.trim()),
      },
    ],
  };
}

export async function syncAllJobSources(): Promise<{
  totalFetched: number;
  totalInserted: number;
  deduplicatedCount: number;
  bySource: Array<{ source: string; fetched: number; inserted: number; status: string; error?: string }>;
}> {
  const startedAt = performance.now();
  await ensureDbSchema();
  const db = getDb();
  const [rates, profile, existingJobs] = await Promise.all([
    getFxRates(),
    getOrCreateDefaultProfile(),
    db.select({ company: jobs.company, title: jobs.title }).from(jobs),
  ]);

  const seenFingerprints = new Set(
    existingJobs.map((j) => fingerprint(j.company, j.title))
  );

  const searchQuery = `${profile.headline} ${profile.skills.slice(0, 3).join(" ")}`.trim() || "Software Engineer";

  const sourceFetchers: Array<{ name: string; fn: () => Promise<NormalizedJobInput[]> }> = [
    { name: "github_br", fn: fetchGithubBrazilJobs },
    { name: "remotive", fn: fetchRemotive },
    { name: "remoteok", fn: fetchRemoteOK },
    { name: "arbeitnow", fn: fetchArbeitnow },
    { name: "jobicy", fn: fetchJobicy },
    { name: "himalayas", fn: fetchHimalayas },
    { name: "hn_hiring", fn: fetchHnHiring },
    { name: "weworkremotely", fn: fetchWeWorkRemotely },
  ];

  if (process.env.RAPIDAPI_JSEARCH_KEY?.trim()) {
    sourceFetchers.push({
      name: "jsearch_linkedin_glassdoor_indeed",
      fn: () => fetchJSearchAggregator(searchQuery),
    });
  }
  if (process.env.ADZUNA_APP_ID?.trim() && process.env.ADZUNA_APP_KEY?.trim()) {
    sourceFetchers.push({
      name: "adzuna",
      fn: () => fetchAdzunaAggregator(searchQuery),
    });
  }
  if (process.env.JOOBLE_API_KEY?.trim()) {
    sourceFetchers.push({
      name: "jooble",
      fn: () => fetchJoobleAggregator(searchQuery),
    });
  }

  const settled = await Promise.allSettled(
    sourceFetchers.map(async (s) => ({ name: s.name, items: await s.fn() }))
  );

  let totalFetched = 0;
  let totalInserted = 0;
  let deduplicatedCount = 0;
  const bySource: Array<{
    source: string;
    fetched: number;
    inserted: number;
    status: string;
    error?: string;
  }> = [];

  for (let i = 0; i < settled.length; i++) {
    const sourceName = sourceFetchers[i].name;
    const result = settled[i];

    if (result.status === "rejected") {
      const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      bySource.push({ source: sourceName, fetched: 0, inserted: 0, status: "error", error: errMsg });
      await db.insert(syncRuns).values({
        id: crypto.randomUUID(),
        source: sourceName,
        fetchedCount: 0,
        insertedCount: 0,
        status: "error",
        errorMessage: errMsg,
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    const items = result.value.items;
    totalFetched += items.length;
    let insertedForSource = 0;

    for (const item of items) {
      const fp = fingerprint(item.company, item.title);
      if (seenFingerprints.has(fp)) {
        deduplicatedCount++;
        continue;
      }

      const benefits = extractBenefits(item.descriptionRaw);
      const tags = extractTags(`${item.title} ${item.descriptionRaw}`, item.extraTags);
      const estimatedMonthlyNetBrl = computeEstimatedNetBrl({
        salaryMin: item.salaryMin,
        salaryMax: item.salaryMax,
        currency: item.currency,
        salaryPeriod: item.salaryPeriod,
        contractType: item.contractType,
        scope: item.scope,
        benefits,
        rates,
      });

      const inserted = await db
        .insert(jobs)
        .values({
          id: crypto.randomUUID(),
          externalId: item.externalId,
          source: item.source,
          title: item.title,
          company: item.company,
          url: item.url,
          scope: item.scope,
          contractType: item.contractType,
          workModel: item.workModel,
          location: item.location,
          currency: item.currency,
          salaryMin: item.salaryMin,
          salaryMax: item.salaryMax,
          salaryPeriod: item.salaryPeriod,
          estimatedMonthlyNetBrl,
          benefitsJson: JSON.stringify(benefits),
          tagsJson: JSON.stringify(tags),
          languagesJson: JSON.stringify(item.languages),
          descriptionRaw: item.descriptionRaw,
          summaryPt: "",
          postedAt: item.postedAt,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing({ target: jobs.externalId })
        .returning({ id: jobs.id });

      if (inserted.length > 0) {
        seenFingerprints.add(fp);
        insertedForSource++;
        totalInserted++;
      }
    }

    bySource.push({
      source: sourceName,
      fetched: items.length,
      inserted: insertedForSource,
      status: "success",
    });

    await db.insert(syncRuns).values({
      id: crypto.randomUUID(),
      source: sourceName,
      fetchedCount: items.length,
      insertedCount: insertedForSource,
      status: "success",
      errorMessage: "",
      createdAt: new Date().toISOString(),
    });
  }

  metric("jobs.sync.fetched", totalFetched);
  metric("jobs.sync.inserted", totalInserted);
  metric("jobs.sync.duration_ms", performance.now() - startedAt);

  return { totalFetched, totalInserted, deduplicatedCount, bySource };
}
