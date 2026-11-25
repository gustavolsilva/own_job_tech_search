import type { ApplicationStatus, ContractType, JobDTO } from "./types";

export const CONTRACT_LABELS: Record<ContractType, string> = {
  clt: "CLT",
  pj: "PJ",
  indeterminate: "Indeterminado",
  fixed_term: "Tempo Determinado",
  freelance: "Freelance / Projeto",
  part_time: "Part-time / Fractional",
};

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Radar / Salvas",
  pitch_ready: "Proposta Pronta",
  applied: "Candidatura Enviada",
  interview: "Entrevista / Negociação",
  active: "Ativo / Fechado",
  discarded: "Descartada",
};

export function formatBrl(value: number | null | undefined): string {
  if (value === null || value === undefined) return "A combinar";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatOriginalSalary(job: JobDTO): string {
  if (!job.salaryMin && !job.salaryMax) return "Faixa não informada";
  const fmt = (n: number) =>
    new Intl.NumberFormat(job.currency === "BRL" ? "pt-BR" : "en-US", {
      style: "currency",
      currency: job.currency,
      maximumFractionDigits: 0,
    }).format(n);

  const periodSuffix: Record<string, string> = {
    hourly: "/h",
    project: "/projeto",
    monthly: "/mês",
    yearly: "/ano",
  };

  const range =
    job.salaryMin && job.salaryMax && job.salaryMin !== job.salaryMax
      ? `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}`
      : fmt((job.salaryMin || job.salaryMax)!);

  return `${range}${periodSuffix[job.salaryPeriod] || ""}`;
}

export function scoreBadgeColor(score: number): string {
  if (score >= 75) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (score >= 55) return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return "bg-rose-500/15 text-rose-300 border-rose-500/30";
}

