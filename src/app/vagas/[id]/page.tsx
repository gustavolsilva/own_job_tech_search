"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  ExternalLink,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  normalizeToMonthlyGrossBrl,
  simulateMonthlyNetBrl,
  type FxRates,
} from "@/lib/currency";
import {
  CONTRACT_LABELS,
  formatBrl,
  formatOriginalSalary,
  scoreBadgeColor,
} from "@/lib/formatters";
import type {
  ApplicationDTO,
  CompanyIntelDTO,
  ContractType,
  JobDTO,
  MatchDTO,
} from "@/lib/types";

interface PitchRecord {
  id: string;
  format: string;
  language: string;
  content: string;
  generatedBy: string;
  createdAt: string;
}

export default function VagaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<JobDTO | null>(null);
  const [match, setMatch] = useState<MatchDTO | null>(null);
  const [intel, setIntel] = useState<CompanyIntelDTO | null>(null);
  const [application, setApplication] = useState<ApplicationDTO | null>(null);
  const [pitches, setPitches] = useState<PitchRecord[]>([]);
  const [fx, setFx] = useState<FxRates | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingXray, setLoadingXray] = useState(false);
  const [loadingPitch, setLoadingPitch] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Simulador interativo
  const [simContract, setSimContract] = useState<ContractType>("pj");
  const [simGross, setSimGross] = useState<number>(15000);
  const [simBenefits, setSimBenefits] = useState<number>(0);
  const [simTaxRate, setSimTaxRate] = useState<number>(8);

  // Gerador de pitch
  const [pitchFormat, setPitchFormat] = useState<
    "recruiter_dm" | "freelance_proposal" | "cover_letter"
  >("freelance_proposal");
  const [pitchLang, setPitchLang] = useState<"pt" | "en">("pt");

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setJob(data.job);
      setMatch(data.match);
      setIntel(data.companyIntel);
      setApplication(data.application);
      setPitches(data.pitches || []);
      setFx(data.fx);

      if (data.job) {
        setSimContract(data.job.contractType);
        setPitchLang(data.job.scope === "international" ? "en" : "pt");
        const benefitsSum = (data.job.benefits || []).reduce(
          (acc: number, b: { estimatedBrl: number | null }) =>
            acc + (b.estimatedBrl ?? 0),
          0
        );
        setSimBenefits(benefitsSum);

        const baseSalary = data.job.salaryMin || data.job.salaryMax;
        if (baseSalary && data.fx) {
          const grossBrl = normalizeToMonthlyGrossBrl(
            baseSalary,
            data.job.currency,
            data.job.salaryPeriod,
            data.fx,
            data.job.contractType === "part_time" ? 20 : 40
          );
          setSimGross(grossBrl);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  async function handleGenerateXray() {
    setLoadingXray(true);
    try {
      const res = await fetch(`/api/jobs/${id}/xray`, { method: "POST" });
      const data = await res.json();
      if (data.companyIntel) setIntel(data.companyIntel);
    } finally {
      setLoadingXray(false);
    }
  }

  async function handleGeneratePitch() {
    setLoadingPitch(true);
    try {
      const res = await fetch(`/api/jobs/${id}/pitch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: pitchFormat, language: pitchLang }),
      });
      const data = await res.json();
      if (data.pitch) setPitches((prev) => [data.pitch, ...prev]);
    } finally {
      setLoadingPitch(false);
    }
  }

  async function handleMoveStatus(status: string) {
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: id,
        status,
        negotiatedMonthlyBrl: simResult?.netMonthlyBrl || 0,
      }),
    });
    const data = await res.json();
    if (data.application) setApplication(data.application);
  }

  async function copyText(pitchId: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(pitchId);
    setTimeout(() => setCopiedId(null), 1800);
  }

  if (loading || !job || !match) {
    return (
      <div className="p-8 text-sm text-slate-400">
        {loading ? "Carregando análise completa..." : "Vaga não encontrada."}
      </div>
    );
  }

  const simResult = simulateMonthlyNetBrl({
    grossMonthlyBrl: simGross,
    contractType: simContract,
    isInternational: job.scope === "international",
    benefitsMonthlyBrl: simBenefits,
    pjTaxRatePercent: simTaxRate,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Radar
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={application?.status || ""}
            onChange={(e) => e.target.value && handleMoveStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#1A1D28] border border-white/10 text-xs text-slate-200"
          >
            <option value="">Adicionar ao Pipeline...</option>
            <option value="saved">Radar / Salvas</option>
            <option value="pitch_ready">Proposta Pronta</option>
            <option value="applied">Candidatura Enviada</option>
            <option value="interview">Entrevista / Negociação</option>
            <option value="active">Ativo / Fechado</option>
            <option value="discarded">Descartada</option>
          </select>

          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition"
            >
              Candidatar-se na vaga
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-white/10 bg-[#12141C] p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${scoreBadgeColor(
                  match.overallScore
                )}`}
              >
                {match.overallScore}% Aderência Geral
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-slate-300 border border-white/10">
                {CONTRACT_LABELS[job.contractType]}
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-slate-300 border border-white/10">
                {job.scope === "international" ? "Internacional" : "Nacional"} &bull;{" "}
                {job.workModel}
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-white">{job.title}</h1>
            <div className="text-sm text-slate-400 mt-0.5">
              {job.company} &bull; {job.location} &bull;{" "}
              {formatOriginalSalary(job)}
            </div>
          </div>

          <div className="text-left md:text-right">
            <div className="text-xs text-slate-400">Líquido mensal simulado</div>
            <div className="text-2xl font-semibold text-emerald-400">
              {formatBrl(simResult.netMonthlyBrl)}
            </div>
            {fx && (
              <div className="text-[11px] text-slate-500">
                USD 1 = R$ {fx.USD_BRL} | EUR 1 = R$ {fx.EUR_BRL}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          {[
            ["Técnico (40%)", match.technicalScore],
            ["Senioridade (20%)", match.seniorityScore],
            ["Idioma/Modelo (15%)", match.languageModelScore],
            ["Financeiro (15%)", match.financialScore],
            ["Esforço/Retorno (10%)", match.effortReturnScore],
          ].map(([label, val]) => (
            <div
              key={String(label)}
              className="rounded-lg bg-[#1A1D28] p-3 border border-white/5"
            >
              <div className="text-[11px] text-slate-400">{label}</div>
              <div className="text-lg font-semibold text-white mt-0.5">
                {val}%
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-slate-300">{match.rationale}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <div className="text-xs font-medium text-emerald-300 mb-1.5">
              Requisitos atendidos
            </div>
            <div className="flex flex-wrap gap-1.5">
              {match.matchedSkills.map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-amber-300 mb-1.5">
              Lacunas / Pontos de atenção
            </div>
            <div className="flex flex-wrap gap-1.5">
              {match.missingSkills.length > 0 ? (
                match.missingSkills.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20"
                  >
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">
                  Nenhuma lacuna crítica detectada.
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Simulador Financeiro & Benefícios */}
        <section className="rounded-xl border border-white/10 bg-[#12141C] p-5 space-y-4">
          <h2 className="text-base font-semibold text-white">
            Simulador Salarial Líquido & Benefícios
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Regime simulado</label>
              <select
                value={simContract}
                onChange={(e) => setSimContract(e.target.value as ContractType)}
                className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
              >
                <option value="clt">CLT (Brasil)</option>
                <option value="pj">PJ (Brasil / B2B)</option>
                <option value="fixed_term">Tempo Determinado</option>
                <option value="freelance">Freelance / Projeto</option>
                <option value="part_time">Part-time / Fractional</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">
                Bruto mensal (R$)
              </label>
              <input
                type="number"
                value={simGross}
                onChange={(e) => setSimGross(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">
                Benefícios em dinheiro (R$/mês)
              </label>
              <input
                type="number"
                value={simBenefits}
                onChange={(e) => setSimBenefits(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">
                Alíquota PJ/Export (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={simTaxRate}
                onChange={(e) => setSimTaxRate(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
              />
            </div>
          </div>

          <div className="rounded-lg bg-[#1A1D28] p-4 border border-white/5 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Impostos/custos estimados:</span>
              <span className="text-rose-300">
                - {formatBrl(simResult.estimatedTaxesBrl)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                Equivalente líquido mensal:
              </span>
              <span className="text-emerald-400 font-semibold">
                {formatBrl(simResult.netMonthlyBrl)} (
                {formatBrl(simResult.effectiveHourlyNetBrl)}/h)
              </span>
            </div>
            <ul className="text-xs text-slate-400 pt-2 space-y-1 list-disc pl-4">
              {simResult.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>

          {job.benefits.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-300">
                Benefícios identificados na vaga
              </div>
              <div className="space-y-1">
                {job.benefits.map((b) => (
                  <div
                    key={b.name}
                    className="flex justify-between text-xs bg-white/5 px-3 py-2 rounded-lg"
                  >
                    <span className="text-slate-200">{b.name}</span>
                    <span className="text-emerald-300">
                      {b.estimatedBrl ? `~${formatBrl(b.estimatedBrl)}/mês` : "Incluso"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Gerador de Proposta Humanizada */}
        <section className="rounded-xl border border-white/10 bg-[#12141C] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-indigo-400" />
              Gerador de Proposta Humanizada
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              value={pitchFormat}
              onChange={(e) =>
                setPitchFormat(e.target.value as typeof pitchFormat)
              }
              className="px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
            >
              <option value="freelance_proposal">Proposta Freelance / B2B</option>
              <option value="recruiter_dm">DM Curta (LinkedIn/Recrutador)</option>
              <option value="cover_letter">Cover Letter Objetiva</option>
            </select>

            <select
              value={pitchLang}
              onChange={(e) => setPitchLang(e.target.value as "pt" | "en")}
              className="px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
            >
              <option value="pt">Português (BR)</option>
              <option value="en">English</option>
            </select>
          </div>

          <button
            onClick={handleGeneratePitch}
            disabled={loadingPitch}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-sm font-medium text-white cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            {loadingPitch ? "Escrevendo proposta..." : "Gerar texto pronto para envio"}
          </button>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {pitches.map((p) => (
              <div
                key={p.id}
                className="rounded-lg bg-[#1A1D28] border border-white/10 p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {p.format} &bull; {p.language.toUpperCase()} ({p.generatedBy})
                  </span>
                  <button
                    onClick={() => copyText(p.id, p.content)}
                    className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200 cursor-pointer"
                  >
                    {copiedId === p.id ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </>
                    )}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-200 leading-relaxed">
                  {p.content}
                </pre>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Raio-X da Empresa (5 dimensões da skill company) */}
      <section className="rounded-xl border border-white/10 bg-[#12141C] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-400" />
              Raio-X da Empresa ({job.company})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Mapeamento em 5 dimensões: faixa salarial, benefícios estimados,
              avaliações, plano de carreira e timing.
            </p>
          </div>
          <button
            onClick={handleGenerateXray}
            disabled={loadingXray}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium text-white cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-indigo-400" />
            {loadingXray
              ? "Gerando Raio-X..."
              : intel
                ? "Atualizar Raio-X"
                : "Gerar Raio-X da Empresa"}
          </button>
        </div>

        {intel && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 text-sm">
            <div className="rounded-lg bg-[#1A1D28] p-4 border border-white/5 space-y-1.5">
              <div className="text-xs font-semibold text-indigo-300 uppercase">
                1. Remuneração & Variável
              </div>
              <p className="text-slate-300">
                <strong>CLT:</strong> {intel.salaryBenchmark.cltRangeBrl}
              </p>
              <p className="text-slate-300">
                <strong>PJ / B2B:</strong>{" "}
                {intel.salaryBenchmark.pjOrContractorRange}
              </p>
              <p className="text-xs text-slate-400">
                {intel.salaryBenchmark.variablePay}
              </p>
            </div>

            <div className="rounded-lg bg-[#1A1D28] p-4 border border-white/5 space-y-1.5">
              <div className="text-xs font-semibold text-emerald-300 uppercase">
                2. Pacote de Benefícios
              </div>
              <p className="text-slate-300">
                <strong>VR/VA:</strong> {intel.benefitsEstimate.vrVaMonthlyBrl}
              </p>
              <p className="text-slate-300">
                <strong>Saúde:</strong> {intel.benefitsEstimate.healthDental}
              </p>
              <p className="text-xs text-slate-400">
                {intel.benefitsEstimate.homeOfficeAndEducation}
              </p>
            </div>

            <div className="rounded-lg bg-[#1A1D28] p-4 border border-white/5 space-y-1.5">
              <div className="text-xs font-semibold text-amber-300 uppercase">
                3. Cultura & Ex-funcionários
              </div>
              <p className="text-slate-300">
                <strong>Nota:</strong> {intel.cultureReviews.estimatedRating}
              </p>
              <p className="text-xs text-slate-300">
                <strong>Elogios:</strong>{" "}
                {intel.cultureReviews.praisedPoints.join("; ")}
              </p>
              <p className="text-xs text-slate-400">
                <strong>Sinais:</strong> {intel.cultureReviews.exEmployeeSignals}
              </p>
            </div>

            <div className="rounded-lg bg-[#1A1D28] p-4 border border-white/5 space-y-1.5">
              <div className="text-xs font-semibold text-cyan-300 uppercase">
                4. Plano de Carreira / Renovação
              </div>
              <p className="text-slate-300">
                {intel.careerGrowth.yTrackOrSpecialist}
              </p>
              <p className="text-xs text-slate-400">
                {intel.careerGrowth.renewalPotentialForContracts}
              </p>
            </div>

            <div className="rounded-lg bg-[#1A1D28] p-4 border border-white/5 space-y-1.5 md:col-span-2">
              <div className="text-xs font-semibold text-white uppercase">
                5. Diagnóstico de Timing
              </div>
              <p className="text-slate-200">{intel.marketTiming.verdict}</p>
              <p className="text-xs text-slate-400">
                <strong>Alertas:</strong>{" "}
                {intel.marketTiming.alertSignals.join(" | ")}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

