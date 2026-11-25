"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookmarkCheck,
  BookmarkPlus,
  ExternalLink,
  Flame,
  Globe,
  Layers,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { FitRing } from "@/components/FitRing";
import {
  CONTRACT_LABELS,
  formatBrl,
  formatOriginalSalary,
} from "@/lib/formatters";
import type { ApplicationDTO, JobDTO, MatchDTO } from "@/lib/types";

interface RadarItem {
  job: JobDTO;
  match: MatchDTO;
  application: ApplicationDTO | null;
}

interface Capabilities {
  openEngines: Array<{ id: string; name: string; active: boolean }>;
  keyedEngines: Array<{
    id: string;
    name: string;
    envKey: string;
    active: boolean;
  }>;
}

const QUICK_CONTRACT_CHIPS = [
  { value: "all", label: "Todos" },
  { value: "freelance", label: "Freelance" },
  { value: "pj", label: "PJ / B2B" },
  { value: "fixed_term", label: "Determinado" },
  { value: "clt", label: "CLT" },
  { value: "part_time", label: "Part-time" },
];

export default function RadarPage() {
  const [items, setItems] = useState<RadarItem[]>([]);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [profileQuery, setProfileQuery] = useState("Software Engineer");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncBanner, setSyncBanner] = useState<string>("");
  const [showEngines, setShowEngines] = useState(false);

  const [scope, setScope] = useState("all");
  const [contractType, setContractType] = useState("all");
  const [source, setSource] = useState("all");
  const [minScore, setMinScore] = useState("0");
  const [search, setSearch] = useState("");

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        scope,
        contractType,
        workModel: "all",
        source,
        minScore,
        search,
      });
      const res = await fetch(`/api/jobs?${params.toString()}`);
      const data = await res.json();
      setItems(data.items || []);
      setSourceCounts(data.sourceCounts || {});
      setCapabilities(data.capabilities || null);
      if (data.profileMeta) {
        const q = `${data.profileMeta.headline} ${
          (data.profileMeta.skills || []).slice(0, 2).join(" ")
        }`.trim();
        if (q) setProfileQuery(q);
      }
    } finally {
      setLoading(false);
    }
  }, [scope, contractType, source, minScore, search]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  async function handleSync() {
    setSyncing(true);
    setSyncBanner("");
    try {
      const res = await fetch("/api/jobs/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na sincronização");
      setSyncBanner(
        `Sincronização concluída: ${data.totalFetched} varridas, ${data.totalInserted} novas adicionadas (${data.deduplicatedCount || 0} duplicadas consolidadas).`
      );
      await loadJobs();
    } catch (err) {
      setSyncBanner(
        err instanceof Error ? err.message : "Erro ao sincronizar fontes"
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleSaveToPipeline(jobId: string) {
    await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, status: "saved" }),
    });
    await loadJobs();
  }

  const effectiveQuery = search.trim() || profileQuery;
  const encodedQ = encodeURIComponent(effectiveQuery);

  const metaSearchLinks = [
    {
      name: "LinkedIn Vagas",
      url: `https://www.linkedin.com/jobs/search/?keywords=${encodedQ}&f_WT=2`,
    },
    {
      name: "Glassdoor Brasil",
      url: `https://www.glassdoor.com.br/Vaga/brasil-${encodedQ}-vagas-SRCH_IL.0,6_IN36_KO7,${7 + encodedQ.length}.htm`,
    },
    {
      name: "Indeed Brasil",
      url: `https://br.indeed.com/jobs?q=${encodedQ}&l=Remoto`,
    },
    {
      name: "Indeed Global",
      url: `https://www.indeed.com/jobs?q=${encodedQ}&remotejob=032b3046-06a3-4876-8dfd-474eb5e7ed11`,
    },
    {
      name: "Upwork Freelance",
      url: `https://www.upwork.com/nx/search/jobs/?q=${encodedQ}`,
    },
    {
      name: "Workana",
      url: `https://www.workana.com/jobs?query=${encodedQ}`,
    },
  ];

  const highFitCount = items.filter((i) => i.match.overallScore >= 75).length;
  const withSalary = items.filter((i) => i.job.estimatedMonthlyNetBrl);
  const avgNetBrl =
    withSalary.length > 0
      ? Math.round(
          withSalary.reduce(
            (acc, i) => acc + (i.job.estimatedMonthlyNetBrl || 0),
            0
          ) / withSalary.length
        )
      : 0;
  const pipelineCount = items.filter(
    (i) => i.application && i.application.status !== "discarded"
  ).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-[11px] font-medium text-indigo-300 mb-2">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            Centralizador Multi-Motor ({Object.keys(sourceCounts).length} fontes no banco)
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            Radar de Oportunidades
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Vagas nacionais, internacionais e projetos freelance consolidados e
            ranqueados pela sua aderência.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowEngines((v) => !v)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-medium text-slate-200 transition cursor-pointer"
          >
            <Globe className="h-4 w-4 text-emerald-400" />
            Motores & LinkedIn/Glassdoor
          </button>
          <Link
            href="/analisar"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-medium text-slate-200 transition"
          >
            <Sparkles className="h-4 w-4 text-cyan-400" />
            Analisar vaga externa
          </Link>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar fontes"}
          </button>
        </div>
      </header>

      {syncBanner && (
        <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200 backdrop-blur-md">
          {syncBanner}
        </div>
      )}

      {showEngines && (
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Central de Motores de Busca & Meta-Links
              </h2>
              <p className="text-xs text-slate-400">
                8 motores abertos sincronizam automaticamente. LinkedIn,
                Glassdoor e Indeed sincronizam via JSearch/Adzuna/Jooble ou
                abrem pré-filtrados abaixo para importação em 1 clique.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {metaSearchLinks.map((m) => (
              <a
                key={m.name}
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-400/30 text-xs font-medium text-indigo-200 transition"
              >
                {m.name}
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>

          {capabilities && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-white/10 text-xs">
              <div className="space-y-1.5">
                <div className="font-semibold text-emerald-300">
                  Motores Abertos Ativos ({capabilities.openEngines.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {capabilities.openEngines.map((e) => (
                    <span
                      key={e.id}
                      className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-200 border border-emerald-500/20"
                    >
                      {e.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="font-semibold text-amber-300">
                  Agregadores LinkedIn / Glassdoor / Indeed (via API Key)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {capabilities.keyedEngines.map((e) => (
                    <span
                      key={e.id}
                      className={`px-2 py-0.5 rounded border ${
                        e.active
                          ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/25"
                          : "bg-white/5 text-slate-400 border-white/10"
                      }`}
                    >
                      {e.name}: {e.active ? "Ativo" : `Defina ${e.envKey}`}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Bento KPI Row */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-emerald-400/80 to-cyan-400/80" />
          <div className="text-xs text-slate-400">Alta Aderência (&ge; 75%)</div>
          <div className="text-3xl font-bold text-emerald-400 mt-1">
            {highFitCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            de {items.length} oportunidades filtradas
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-indigo-400/80 to-violet-400/80" />
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-400" />
            Média Líquida Estimada
          </div>
          <div className="text-3xl font-bold text-white mt-1">
            {avgNetBrl > 0 ? formatBrl(avgNetBrl) : "—"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            equivalente mensal pós-impostos
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-amber-400/80 to-rose-400/80" />
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-amber-400" />
            No seu Pipeline
          </div>
          <div className="text-3xl font-bold text-indigo-300 mt-1">
            {pipelineCount}
          </div>
          <Link
            href="/pipeline"
            className="text-xs text-cyan-300 hover:text-cyan-200 mt-1 inline-block"
          >
            Abrir Kanban & projeção de renda &rarr;
          </Link>
        </div>
      </section>

      {/* Search + Pill Filters */}
      <section className="glass-card rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cargo, tecnologia, empresa..."
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
            />
          </div>

          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-sm text-slate-200"
          >
            <option value="all">Nacional + Internacional</option>
            <option value="national">Nacional (Brasil)</option>
            <option value="international">Internacional</option>
          </select>

          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-sm text-slate-200"
          >
            <option value="all">Todas as fontes</option>
            {Object.entries(sourceCounts).map(([src, count]) => (
              <option key={src} value={src}>
                {src} ({count})
              </option>
            ))}
          </select>

          <select
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-sm text-slate-200"
          >
            <option value="0">Qualquer aderência</option>
            <option value="60">Fit Score &ge; 60%</option>
            <option value="75">Fit Score &ge; 75%</option>
            <option value="85">Fit Score &ge; 85%</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {QUICK_CONTRACT_CHIPS.map((chip) => {
            const active = contractType === chip.value;
            return (
              <button
                key={chip.value}
                onClick={() => setContractType(chip.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                  active
                    ? "bg-indigo-500/25 text-indigo-200 border-indigo-400/50 shadow-sm shadow-indigo-500/20"
                    : "bg-white/5 text-slate-400 border-white/10 hover:text-slate-200 hover:bg-white/10"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </section>

      {loading ? (
        <div className="glass-card rounded-2xl p-12 text-center text-sm text-slate-400">
          Carregando radar de oportunidades...
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center space-y-3 border-dashed">
          <div className="text-base font-semibold text-white">
            Nenhuma vaga encontrada com esses filtros
          </div>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Clique em <strong>Sincronizar fontes</strong> para buscar vagas
            reais nos 8+ motores integrados ou abra os meta-links do LinkedIn,
            Glassdoor e Indeed acima.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {items.map(({ job, match, application }) => (
            <article
              key={job.id}
              className="glass-card glass-card-hover rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
            >
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <FitRing score={match.overallScore} />

                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/15 text-indigo-200 border border-indigo-400/25">
                      {CONTRACT_LABELS[job.contractType] || job.contractType}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-white/5 text-slate-300 border border-white/10">
                      {job.scope === "international" ? (
                        <Globe className="h-3 w-3 text-cyan-400" />
                      ) : (
                        <MapPin className="h-3 w-3 text-emerald-400" />
                      )}
                      {job.scope === "international"
                        ? "Internacional"
                        : "Nacional"}
                    </span>
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider">
                      {job.source}
                    </span>
                  </div>

                  <div>
                    <Link
                      href={`/vagas/${job.id}`}
                      className="text-lg font-semibold text-white hover:text-cyan-300 transition inline-flex items-center gap-1.5"
                    >
                      {job.title}
                      <ArrowUpRight className="h-4 w-4 text-slate-500" />
                    </Link>
                    <div className="text-sm text-slate-400">
                      {job.company} &bull; {job.location} ({job.workModel})
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {job.tags.slice(0, 6).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md text-xs bg-black/35 text-slate-300 border border-white/10"
                      >
                        {tag}
                      </span>
                    ))}
                    {job.benefits.slice(0, 3).map((b) => (
                      <span
                        key={b.name}
                        className="px-2 py-0.5 rounded-md text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/25"
                      >
                        {b.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-white/10">
                <div className="text-left lg:text-right">
                  <div className="text-sm font-medium text-slate-200">
                    {formatOriginalSalary(job)}
                  </div>
                  <div className="text-xs text-emerald-400 font-semibold">
                    {job.estimatedMonthlyNetBrl
                      ? `~${formatBrl(job.estimatedMonthlyNetBrl)}/mês líq.`
                      : "Simular salário"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSaveToPipeline(job.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                      application
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
                        : "bg-white/5 text-slate-200 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {application ? (
                      <>
                        <BookmarkCheck className="h-3.5 w-3.5" />
                        No Pipeline
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="h-3.5 w-3.5" />
                        Salvar
                      </>
                    )}
                  </button>

                  <Link
                    href={`/vagas/${job.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition"
                  >
                    Abrir Análise
                  </Link>

                  {job.url && (
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir link direto de candidatura"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-xs font-semibold text-emerald-300 transition"
                    >
                      Candidatar-se
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
