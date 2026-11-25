import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import WordExtractor from "word-extractor";
import { z } from "zod";
import { generateStructuredWithFallback } from "./ai";
import type { ExperienceItem, LanguageItem } from "./types";

const KNOWN_SKILLS = [
  "TypeScript",
  "JavaScript",
  "React",
  "Next.js",
  "Node.js",
  "Python",
  "FastAPI",
  "Django",
  "Flask",
  "Go",
  "Rust",
  "Java",
  "Spring Boot",
  "C#",
  ".NET",
  "PHP",
  "Laravel",
  "Ruby",
  "Rails",
  "PostgreSQL",
  "MySQL",
  "SQLite",
  "MongoDB",
  "Redis",
  "Docker",
  "Kubernetes",
  "AWS",
  "GCP",
  "Azure",
  "Vercel",
  "Terraform",
  "GraphQL",
  "REST",
  "Tailwind CSS",
  "Prisma",
  "Drizzle",
  "Playwright",
  "Jest",
  "Vitest",
  "CI/CD",
  "Git",
  "Linux",
  "AI SDK",
  "LLMs",
  "RAG",
  "LangChain",
  "Machine Learning",
  "Data Engineering",
  "Kafka",
  "RabbitMQ",
  "Figma",
  "React Native",
  "Flutter",
  "Swift",
  "Kotlin",
];

export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string
): Promise<{ text: string; fileType: "pdf" | "docx" | "doc" | "linkedin_pdf" | "text" }> {
  const ext = path.extname(fileName).toLowerCase();

  if (ext === ".pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      const text = (result.text || "").trim();
      const isLinkedin =
        text.includes("linkedin.com/in") ||
        (text.includes("Experience") && text.includes("Education")) ||
        (text.includes("Experiência") && text.includes("Formação acadêmica"));
      return {
        text,
        fileType: isLinkedin ? "linkedin_pdf" : "pdf",
      };
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return { text: (result.value || "").trim(), fileType: "docx" };
  }

  if (ext === ".doc") {
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    return { text: (doc.getBody() || "").trim(), fileType: "doc" };
  }

  return { text: buffer.toString("utf-8").trim(), fileType: "text" };
}

export async function saveUploadedFileLocally(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  // Em ambiente serverless na Vercel o filesystem do projeto é somente leitura;
  // o texto extraído já é persistido no banco de dados.
  if (process.env.VERCEL) {
    return "";
  }
  const uploadDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "data", "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const fullPath = path.join(uploadDir, safeName);
  fs.writeFileSync(fullPath, buffer);
  return fullPath;
}

const ParsedProfileSchema = z.object({
  fullName: z.string(),
  headline: z.string(),
  seniority: z.enum(["junior", "pleno", "senior", "staff", "lead"]),
  summary: z.string(),
  skills: z.array(z.string()),
  languages: z.array(
    z.object({
      language: z.string(),
      level: z.string(),
    })
  ),
  experiences: z.array(
    z.object({
      role: z.string(),
      company: z.string(),
      period: z.string(),
      highlights: z.array(z.string()),
    })
  ),
});

export async function parseProfileFromText(rawText: string): Promise<{
  fullName: string;
  headline: string;
  seniority: string;
  summary: string;
  skills: string[];
  languages: LanguageItem[];
  experiences: ExperienceItem[];
  parsedBy: "ai" | "heuristic";
}> {
  const aiResult = await generateStructuredWithFallback({
    schema: ParsedProfileSchema,
    operation: "parse_profile",
    system:
      "Você é um especialista em recrutamento técnico. Extraia os dados estruturados do currículo ou perfil do LinkedIn exatamente como constam no texto, sem inventar experiências.",
    prompt: `Extraia nome, título/headline, senioridade, resumo profissional, lista de skills técnicas, idiomas e experiências deste perfil:\n\n${rawText.slice(0, 14000)}`,
  });

  if (aiResult) {
    return { ...aiResult.data, parsedBy: "ai" };
  }

  // Fallback heurístico determinístico (funciona 100% offline/sem chave)
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const fullName =
    lines.find((l) => l.length > 3 && l.length < 60 && !l.includes("@") && !l.includes("http")) ||
    "Profissional";

  const lower = rawText.toLowerCase();
  const matchedSkills = KNOWN_SKILLS.filter((skill) => {
    const escaped = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(lower);
  });

  let seniority = "pleno";
  if (/(staff|principal|architect|arquiteto)/i.test(rawText)) seniority = "staff";
  else if (/(tech lead|team lead|líder técnico|head)/i.test(rawText)) seniority = "lead";
  else if (/(sênior|senior|sr\.?)/i.test(rawText)) seniority = "senior";
  else if (/(júnior|junior|jr\.?)/i.test(rawText)) seniority = "junior";

  const languages: LanguageItem[] = [];
  if (/(português|portuguese)/i.test(rawText)) {
    languages.push({ language: "Português", level: "Nativo / Fluente" });
  }
  if (/(inglês|english)/i.test(rawText)) {
    const level = /(fluent|fluente|c1|c2|advanced|avançado)/i.test(rawText)
      ? "Avançado / Fluente"
      : "Intermediário";
    languages.push({ language: "Inglês", level });
  }
  if (/(espanhol|spanish)/i.test(rawText)) {
    languages.push({ language: "Espanhol", level: "Intermediário" });
  }
  if (languages.length === 0) {
    languages.push({ language: "Português", level: "Nativo" });
  }

  const headline =
    lines[1] && lines[1].length < 110
      ? lines[1]
      : `${seniority.toUpperCase()} Software Engineer`;

  const summary = lines.slice(0, 6).join(" ").slice(0, 420);

  return {
    fullName,
    headline,
    seniority,
    summary,
    skills: matchedSkills.length > 0 ? matchedSkills : ["TypeScript", "React", "Node.js"],
    languages,
    experiences: [],
    parsedBy: "heuristic",
  };
}

export async function fetchGithubSkills(username: string): Promise<string[]> {
  const clean = username.trim().replace(/^@/, "").replace(/^https?:\/\/github\.com\//, "").split("/")[0];
  if (!clean) return [];

  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(clean)}/repos?sort=updated&per_page=15`, {
      headers: { "User-Agent": "own-job-tech-search" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const repos = (await res.json()) as Array<{ language?: string | null; topics?: string[] }>;
    const langs = new Set<string>();
    for (const r of repos) {
      if (r.language) langs.add(r.language);
      if (Array.isArray(r.topics)) {
        for (const t of r.topics.slice(0, 4)) langs.add(t);
      }
    }
    return Array.from(langs);
  } catch {
    return [];
  }
}

