"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";

export default function AnalisarPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [scope, setScope] = useState("auto");
  const [contractType, setContractType] = useState("auto");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/jobs/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          company,
          url,
          scope,
          contractType,
          rawText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao analisar vaga");
      router.push(`/vagas/${data.job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao analisar vaga");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Analisador Instantâneo de Vaga ou Projeto
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Cole o texto ou URL de qualquer oportunidade (LinkedIn, Upwork,
          Workana, 99Freelas, Gupy ou e-mail de recrutador) para extrair
          salário, benefícios, Fit Score e gerar sua proposta.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-white/10 bg-[#12141C] p-6 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-400">
              Título da vaga / projeto (opcional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: Senior Full-Stack Engineer (B2B)"
              className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">
              Empresa ou Cliente (opcional)
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="ex: Acme Corp"
              className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1 sm:col-span-1">
            <label className="text-xs text-slate-400">Escopo</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
            >
              <option value="auto">Detectar automático</option>
              <option value="national">Nacional (Brasil)</option>
              <option value="international">Internacional</option>
            </select>
          </div>

          <div className="space-y-1 sm:col-span-1">
            <label className="text-xs text-slate-400">Tipo de contrato</label>
            <select
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
            >
              <option value="auto">Detectar automático</option>
              <option value="clt">CLT</option>
              <option value="pj">PJ</option>
              <option value="indeterminate">Indeterminado</option>
              <option value="fixed_term">Tempo Determinado</option>
              <option value="freelance">Freelance / Projeto</option>
              <option value="part_time">Part-time / Fractional</option>
            </select>
          </div>

          <div className="space-y-1 sm:col-span-1">
            <label className="text-xs text-slate-400">URL da vaga (opcional)</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Descrição completa da vaga / projeto
          </label>
          <textarea
            rows={9}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Cole aqui a descrição, requisitos, faixa salarial (ex: $50 - $70/hr ou R$ 15.000 PJ + VR) e benefícios..."
            className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white placeholder:text-slate-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-sm font-medium text-white cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          {loading ? "Analisando aderência e salários..." : "Analisar e calcular Fit Score"}
        </button>
      </form>
    </div>
  );
}

