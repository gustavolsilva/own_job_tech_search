import { normalizeToMonthlyGrossBrl, simulateMonthlyNetBrl, type FxRates } from "./currency";
import type {
  BenefitItem,
  ContractType,
  CurrencyCode,
  JobScope,
  SalaryPeriod,
  WorkModel,
} from "./types";

const TECH_TAGS = [
  "TypeScript",
  "JavaScript",
  "React",
  "Next.js",
  "Node.js",
  "Python",
  "FastAPI",
  "Django",
  "Go",
  "Rust",
  "Java",
  "C#",
  ".NET",
  "PHP",
  "Ruby",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "Docker",
  "Kubernetes",
  "AWS",
  "GCP",
  "Azure",
  "GraphQL",
  "Tailwind",
  "AI",
  "LLM",
  "DevOps",
  "Mobile",
  "React Native",
  "Flutter",
  "QA",
];

export function stripHtml(input: string): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTags(text: string, extraTags: string[] = []): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>(
    extraTags.map((t) => t.trim()).filter((t) => t.length > 1 && t.length < 28)
  );
  for (const tag of TECH_TAGS) {
    const escaped = tag.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(lower)) {
      found.add(tag);
    }
  }
  return Array.from(found).slice(0, 12);
}

export function detectContractType(text: string, labels: string[] = []): ContractType {
  const combined = `${text} ${labels.join(" ")}`.toLowerCase();
  if (/(freelance|freela|upwork|workana|bounty|escopo fechado|por projeto)/i.test(combined)) {
    return "freelance";
  }
  if (/(part[- ]?time|meio per[ií]odo|fractional|20h\/week|10h\/week)/i.test(combined)) {
    return "part_time";
  }
  if (/(tempo determinado|fixed[- ]?term|tempor[áa]rio|\d+\s*(meses|months)\s*(contract|contrato))/i.test(combined)) {
    return "fixed_term";
  }
  if (/\bpj\b|pessoa jur[ií]dica|b2b|contractor/i.test(combined)) {
    return "pj";
  }
  if (/\bclt\b/i.test(combined)) {
    return "clt";
  }
  return "indeterminate";
}

export function detectWorkModel(text: string, location = ""): WorkModel {
  const combined = `${text} ${location}`.toLowerCase();
  if (/(h[ií]brido|hybrid)/i.test(combined)) return "hybrid";
  if (/(presencial|on[- ]?site|in[- ]?office)/i.test(combined) && !/remoto|remote/i.test(combined)) {
    return "onsite";
  }
  return "remote";
}

export function extractBenefits(text: string): BenefitItem[] {
  const benefits: BenefitItem[] = [];
  const lower = text.toLowerCase();

  // VR / VA
  const vrMatch = text.match(/(?:vr|va|vale[- ]?refei[çc][ãa]o|vale[- ]?alimenta[çc][ãa]o|caju|flash|swile)[^\d\n]{0,25}r\$\s*([\d.,]+)/i);
  if (vrMatch || /(vale[- ]?refei[çc][ãa]o|vale[- ]?alimenta[çc][ãa]o|\bvr\b|\bva\b|caju|flash|swile)/i.test(lower)) {
    const val = vrMatch ? parseNumber(vrMatch[1]) : 950;
    benefits.push({
      name: "VR / VA",
      estimatedBrl: val && val > 100 && val < 5000 ? val : 950,
      details: vrMatch ? `Valor citado: R$ ${vrMatch[1]}` : "Benefício alimentação/refeição mencionado",
    });
  }

  if (/(plano de sa[úu]de|assist[êe]ncia m[ée]dica|health insurance|medical|dental|odonto)/i.test(lower)) {
    benefits.push({
      name: "Plano de Saúde / Odonto",
      estimatedBrl: 650,
      details: "Cobertura médica/odontológica citada na vaga",
    });
  }

  if (/(home office|remote stipend|aux[íi]lio.*remoto|setup|equipment)/i.test(lower)) {
    benefits.push({
      name: "Auxílio Home Office / Setup",
      estimatedBrl: 250,
      details: "Ajuda de custo para trabalho remoto ou equipamento",
    });
  }

  if (/(wellhub|gympass|totalpass|wellness|sa[úu]de mental)/i.test(lower)) {
    benefits.push({
      name: "Wellhub / Bem-estar",
      estimatedBrl: 180,
      details: "Benefício de academia / bem-estar",
    });
  }

  if (/(plr|b[ôo]nus|bonus|14[ºo]|profit sharing|equity|stock options|rsu)/i.test(lower)) {
    benefits.push({
      name: "PLR / Bônus / Equity",
      estimatedBrl: null,
      details: "Remuneração variável ou participação societária mencionada",
    });
  }

  if (/(pto|paid time off|f[ée]rias remuneradas|day off|descanso remunerado)/i.test(lower)) {
    benefits.push({
      name: "PTO / Férias Remuneradas",
      estimatedBrl: null,
      details: "Dias de descanso remunerado previstos",
    });
  }

  if (/(educa[çc][ãa]o|learning|cursos|idiomas|ingl[êe]s|alura|udemy|confer[êe]ncias)/i.test(lower)) {
    benefits.push({
      name: "Auxílio Educação / Idiomas",
      estimatedBrl: 200,
      details: "Verba para capacitação ou idiomas",
    });
  }

  return benefits;
}

function parseNumber(raw: string): number | null {
  if (!raw) return null;
  let cleaned = raw.trim().toLowerCase();
  const isK = cleaned.endsWith("k");
  cleaned = cleaned.replace(/k$/, "");

  // Handle BR format 12.000,00 vs US 12,000.00 vs 12.000
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, "");
  } else {
    cleaned = cleaned.replace(",", ".");
  }

  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return isK ? num * 1000 : num;
}

export function extractSalaryInfo(
  text: string,
  defaultCurrency: CurrencyCode = "USD"
): {
  currency: CurrencyCode;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: SalaryPeriod;
} {
  let currency: CurrencyCode = defaultCurrency;
  if (/r\$|brl/i.test(text)) currency = "BRL";
  else if (/€|eur\b/i.test(text)) currency = "EUR";
  else if (/£|gbp\b/i.test(text)) currency = "GBP";
  else if (/\$|usd\b/i.test(text)) currency = "USD";

  let salaryPeriod: SalaryPeriod = "monthly";
  if (/(\/hr|\/h\b|per hour|hourly|por hora)/i.test(text)) {
    salaryPeriod = "hourly";
  } else if (/(\/yr|\/year|per year|annual|yearly|p\.a\.|anuais)/i.test(text)) {
    salaryPeriod = "yearly";
  } else if (/(fixed price|por projeto|project budget|escopo fechado)/i.test(text)) {
    salaryPeriod = "project";
  }

  // Match ranges like "$120k - $150k", "R$ 12.000 - R$ 18.000", "$50 - $70/hr"
  const rangeRegex =
    /(?:r\$|us\$|usd|eur|gbp|€|£|\$)\s*(\d[\d.,]*k?)\s*(?:-|–|to|a|até)\s*(?:r\$|us\$|usd|eur|gbp|€|£|\$)?\s*(\d[\d.,]*k?)/i;
  const rangeMatch = text.match(rangeRegex);
  if (rangeMatch) {
    let min = parseNumber(rangeMatch[1]);
    let max = parseNumber(rangeMatch[2]);
    if (min && max) {
      // If max had 'k' (e.g. "120 - 150k")
      if (max >= 1000 && min < 1000 && /k/i.test(rangeMatch[2])) {
        min = min * 1000;
      }
      if (min > 35000 && salaryPeriod === "monthly" && currency !== "BRL") {
        salaryPeriod = "yearly";
      }
      return { currency, salaryMin: min, salaryMax: max, salaryPeriod };
    }
  }

  const singleRegex = /(?:r\$|us\$|usd|eur|gbp|€|£|\$)\s*(\d[\d.,]*k?)/i;
  const singleMatch = text.match(singleRegex);
  if (singleMatch) {
    const val = parseNumber(singleMatch[1]);
    if (val && val > 10) {
      if (val > 35000 && salaryPeriod === "monthly" && currency !== "BRL") {
        salaryPeriod = "yearly";
      }
      return { currency, salaryMin: val, salaryMax: val, salaryPeriod };
    }
  }

  return { currency, salaryMin: null, salaryMax: null, salaryPeriod };
}

export function computeEstimatedNetBrl(params: {
  salaryMin: number | null;
  salaryMax: number | null;
  currency: CurrencyCode;
  salaryPeriod: SalaryPeriod;
  contractType: ContractType;
  scope: JobScope;
  benefits: BenefitItem[];
  rates: FxRates;
}): number | null {
  const baseSalary =
    params.salaryMin && params.salaryMax
      ? (params.salaryMin + params.salaryMax) / 2
      : params.salaryMin || params.salaryMax;

  if (!baseSalary) return null;

  const grossMonthlyBrl = normalizeToMonthlyGrossBrl(
    baseSalary,
    params.currency,
    params.salaryPeriod,
    params.rates,
    params.contractType === "part_time" ? 20 : 40
  );

  const benefitsBrl = params.benefits.reduce(
    (acc, b) => acc + (b.estimatedBrl ?? 0),
    0
  );

  const sim = simulateMonthlyNetBrl({
    grossMonthlyBrl,
    contractType: params.contractType,
    isInternational: params.scope === "international",
    benefitsMonthlyBrl: benefitsBrl,
  });

  return sim.netMonthlyBrl;
}

