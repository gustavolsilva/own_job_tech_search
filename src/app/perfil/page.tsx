"use client";

import { useEffect, useState } from "react";
import { Code2, FileText, Save, Upload } from "lucide-react";
import { CONTRACT_LABELS } from "@/lib/formatters";
import type { ContractType, ProfileDTO } from "@/lib/types";

interface DocRecord {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

const ALL_CONTRACTS: ContractType[] = [
  "clt",
  "pj",
  "indeterminate",
  "fixed_term",
  "freelance",
  "part_time",
];

export default function PerfilPage() {
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [documents, setDocuments] = useState<DocRecord[]>([]);
  const [skillsInput, setSkillsInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function loadProfile() {
    const res = await fetch("/api/profile");
    const data = await res.json();
    if (data.profile) {
      setProfile(data.profile);
      setSkillsInput((data.profile.skills || []).join(", "));
      setGithubUsername(data.profile.githubUsername || "");
      setLinkedinUrl(data.profile.linkedinUrl || "");
    }
    setDocuments(data.documents || []);
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);
    setFeedback("");
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      if (rawText.trim()) fd.append("rawText", rawText);
      if (githubUsername.trim()) fd.append("githubUsername", githubUsername);
      if (linkedinUrl.trim()) fd.append("linkedinUrl", linkedinUrl);

      const res = await fetch("/api/profile/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao processar arquivo");

      setProfile(data.profile);
      setSkillsInput((data.profile.skills || []).join(", "));
      setDocuments(data.documents || []);
      setFile(null);
      setRawText("");
      setFeedback(
        `Perfil atualizado via ${data.parsedBy === "ai" ? "IA Gateway" : "extrator local"}. ${
          data.githubSkillsAdded?.length
            ? `Skills do GitHub adicionadas: ${data.githubSkillsAdded.join(", ")}.`
            : ""
        }`
      );
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Erro ao processar perfil");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setFeedback("");
    try {
      const skills = skillsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          skills,
          githubUsername,
          linkedinUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar");
      setProfile(data.profile);
      setFeedback("Preferências e perfil salvos com sucesso.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function toggleContract(contract: ContractType) {
    if (!profile) return;
    const exists = profile.acceptedContracts.includes(contract);
    const next = exists
      ? profile.acceptedContracts.filter((c) => c !== contract)
      : [...profile.acceptedContracts, contract];
    setProfile({ ...profile, acceptedContracts: next });
  }

  if (!profile) {
    return (
      <div className="text-sm text-slate-400 p-8">Carregando perfil...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Meu Perfil, Currículo & Metas
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Importe seu PDF do LinkedIn, currículos em <code>.pdf</code>,{" "}
          <code>.docx</code> ou <code>.doc</code>, ou sincronize seu GitHub
          para calibrar o Fit Score.
        </p>
      </div>

      {feedback && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleUpload}
          className="rounded-xl border border-white/10 bg-[#12141C] p-5 space-y-4"
        >
          <div className="flex items-center gap-2 text-base font-semibold text-white">
            <Upload className="h-4 w-4 text-indigo-400" />
            Importar LinkedIn / Currículo (.pdf, .docx, .doc)
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Arquivo (.pdf, .docx, .doc ou PDF exportado do LinkedIn)
            </label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex items-center gap-1">
                <Code2 className="h-3.5 w-3.5" /> Usuário GitHub (opcional)
              </label>
              <input
                type="text"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                placeholder="ex: gustavo-dev"
                className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">
                URL do LinkedIn (referência)
              </label>
              <input
                type="text"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Ou cole o texto do seu LinkedIn / Bio / Experiência
            </label>
            <textarea
              rows={5}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Cole aqui o resumo, experiências e stack do seu perfil..."
              className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white placeholder:text-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-sm font-medium text-white cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Extraindo e analisando..." : "Processar e atualizar perfil"}
          </button>

          {documents.length > 0 && (
            <div className="pt-3 border-t border-white/10 space-y-2">
              <div className="text-xs font-medium text-slate-400">
                Documentos processados ({documents.length})
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between text-xs bg-[#1A1D28] px-3 py-2 rounded-lg border border-white/5"
                  >
                    <span className="flex items-center gap-2 text-slate-200 truncate">
                      <FileText className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      {doc.fileName}
                    </span>
                    <span className="text-slate-500 uppercase ml-2">
                      {doc.fileType}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>

        <form
          onSubmit={handleSave}
          className="rounded-xl border border-white/10 bg-[#12141C] p-5 space-y-4"
        >
          <div className="text-base font-semibold text-white">
            Dados Estruturados & Metas de Renda
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Nome completo</label>
              <input
                type="text"
                value={profile.fullName}
                onChange={(e) =>
                  setProfile({ ...profile, fullName: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Senioridade</label>
              <select
                value={profile.seniority}
                onChange={(e) =>
                  setProfile({ ...profile, seniority: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
              >
                <option value="junior">Júnior</option>
                <option value="pleno">Pleno</option>
                <option value="senior">Sênior</option>
                <option value="staff">Staff / Principal</option>
                <option value="lead">Tech Lead / Head</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">Cargo / Headline</label>
            <input
              type="text"
              value={profile.headline}
              onChange={(e) =>
                setProfile({ ...profile, headline: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">
              Skills técnicas (separadas por vírgula)
            </label>
            <input
              type="text"
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">
              Contratos aceitos (incluindo renda extra)
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_CONTRACTS.map((c) => {
                const active = profile.acceptedContracts.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleContract(c)}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition cursor-pointer ${
                      active
                        ? "bg-indigo-500/20 text-indigo-200 border-indigo-500/40"
                        : "bg-[#1A1D28] text-slate-400 border-white/10"
                    }`}
                  >
                    {CONTRACT_LABELS[c]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">
                Meta líquida (R$/mês)
              </label>
              <input
                type="number"
                value={profile.minMonthlyNetBrl}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    minMonthlyNetBrl: Number(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">
                Valor/hora mín (USD)
              </label>
              <input
                type="number"
                value={profile.minHourlyUsd}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    minHourlyUsd: Number(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">
                Horas livres/semana
              </label>
              <input
                type="number"
                value={profile.weeklyFreeHours}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    weeklyFreeHours: Number(e.target.value) || 10,
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">Resumo profissional</label>
            <textarea
              rows={3}
              value={profile.summary}
              onChange={(e) =>
                setProfile({ ...profile, summary: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg bg-[#1A1D28] border border-white/10 text-sm text-white"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-sm font-medium text-white cursor-pointer"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar perfil e metas"}
          </button>
        </form>
      </div>
    </div>
  );
}
