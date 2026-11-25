"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock, DollarSign, ExternalLink, GripVertical, Sparkles } from "lucide-react";
import { CONTRACT_LABELS, formatBrl, STATUS_LABELS } from "@/lib/formatters";
import type { ApplicationDTO, ApplicationStatus, JobDTO } from "@/lib/types";

interface PipelineItem {
  application: ApplicationDTO;
  job: JobDTO;
}

const COLUMNS: Array<{
  id: ApplicationStatus;
  accent: string;
}> = [
  { id: "saved", accent: "from-slate-400 to-slate-500" },
  { id: "pitch_ready", accent: "from-cyan-400 to-indigo-400" },
  { id: "applied", accent: "from-indigo-400 to-violet-400" },
  { id: "interview", accent: "from-amber-400 to-orange-400" },
  { id: "active", accent: "from-emerald-400 to-teal-400" },
];

export default function PipelinePage() {
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ApplicationStatus | null>(null);

  async function loadPipeline() {
    setLoading(true);
    try {
      const res = await fetch("/api/applications");
      const data = await res.json();
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPipeline();
  }, []);

  async function moveCard(jobId: string, status: ApplicationStatus) {
    setItems((prev) =>
      prev.map((i) =>
        i.job.id === jobId
          ? { ...i, application: { ...i.application, status } }
          : i
      )
    );
    await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, status }),
    });
    await loadPipeline();
  }

  const activeItems = items.filter((i) => i.application.status === "active");
  const negotiatingItems = items.filter(
    (i) => i.application.status === "interview"
  );

  const activeIncomeBrl = activeItems.reduce(
    (acc, i) => acc + (i.application.negotiatedMonthlyBrl || 0),
    0
  );
  const potentialIncomeBrl = negotiatingItems.reduce(
    (acc, i) => acc + (i.application.negotiatedMonthlyBrl || 0),
    0
  );
  const activeWeeklyHours = activeItems.reduce(
    (acc, i) => acc + (i.application.estimatedWeeklyHours || 0),
    0
  );
  const capacityPct = Math.min(100, Math.round((activeWeeklyHours / 50) * 100));

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-[11px] font-medium text-emerald-300 mb-2">
          <Sparkles className="h-3.5 w-3.5" />
          Arraste os cards entre colunas
        </div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-200 bg-clip-text text-transparent">
          Pipeline de Candidaturas & Fontes de Renda
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Gerencie contratos fixos, tempo determinado e projetos freelance em
          paralelo para compor sua renda mensal.
        </p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-emerald-400 to-teal-400" />
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
            Renda Mensal Ativa (Fechados)
          </div>
          <div className="text-3xl font-bold text-emerald-400 mt-1">
            {formatBrl(activeIncomeBrl)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {activeItems.length} contrato(s)/projeto(s) ativos
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-indigo-400 to-cyan-400" />
          <div className="text-xs text-slate-400">
            Em Negociação / Entrevista
          </div>
          <div className="text-3xl font-bold text-indigo-300 mt-1">
            + {formatBrl(potentialIncomeBrl)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            projeção potencial adicional
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-amber-400 to-rose-400" />
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            Alocação Semanal Ativa
          </div>
          <div className="text-3xl font-bold text-white mt-1">
            {activeWeeklyHours}h / sem
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 transition-all duration-500"
              style={{ width: `${capacityPct}%` }}
            />
          </div>
        </div>
      </section>

      {loading ? (
        <div className="glass-card rounded-2xl p-10 text-center text-sm text-slate-400">
          Carregando Kanban...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {COLUMNS.map((col) => {
            const colItems = items.filter((i) => i.application.status === col.id);
            const isOver = dragOverCol === col.id;
            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverCol(col.id);
                }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverCol(null);
                  if (draggingJobId) {
                    moveCard(draggingJobId, col.id);
                    setDraggingJobId(null);
                  }
                }}
                className={`glass-card rounded-2xl p-3.5 space-y-3 min-h-[360px] relative overflow-hidden transition-all ${
                  isOver
                    ? "ring-2 ring-indigo-400/70 bg-indigo-500/10"
                    : ""
                }`}
              >
                <div
                  className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${col.accent}`}
                />
                <div className="flex items-center justify-between border-b border-white/10 pb-2 pt-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">
                    {STATUS_LABELS[col.id]}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-medium">
                    {colItems.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {colItems.map(({ application, job }) => (
                    <div
                      key={application.id}
                      draggable
                      onDragStart={() => setDraggingJobId(job.id)}
                      onDragEnd={() => {
                        setDraggingJobId(null);
                        setDragOverCol(null);
                      }}
                      className="rounded-xl bg-black/40 hover:bg-black/55 border border-white/10 hover:border-indigo-400/40 p-3 space-y-2 cursor-grab active:cursor-grabbing transition-all"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <Link
                          href={`/vagas/${job.id}`}
                          className="text-sm font-semibold text-white hover:text-cyan-300 block leading-snug"
                        >
                          {job.title}
                        </Link>
                        <GripVertical className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
                      </div>
                      <div className="text-xs text-slate-400">
                        {job.company} &bull; {CONTRACT_LABELS[job.contractType]}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-emerald-400">
                          {application.negotiatedMonthlyBrl > 0
                            ? `${formatBrl(application.negotiatedMonthlyBrl)}/mês`
                            : "Valor a definir"}
                        </span>
                        {job.url && (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-300 hover:text-cyan-200"
                          >
                            Vaga <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      <select
                        value={application.status}
                        onChange={(e) =>
                          moveCard(job.id, e.target.value as ApplicationStatus)
                        }
                        className="w-full px-2 py-1 rounded-lg bg-[#12141C] border border-white/10 text-[11px] text-slate-300"
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.id} value={c.id}>
                            Mover: {STATUS_LABELS[c.id]}
                          </option>
                        ))}
                        <option value="discarded">Descartar</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
