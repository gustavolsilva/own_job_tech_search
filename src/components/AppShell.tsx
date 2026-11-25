"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BriefcaseBusiness,
  FileSearch,
  Kanban,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Radar,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Radar de Vagas", icon: Radar },
  { href: "/analisar", label: "Analisar Vaga", icon: FileSearch },
  { href: "/pipeline", label: "Pipeline & Renda", icon: Kanban },
  { href: "/perfil", label: "Meu Perfil & CV", icon: UserCheck },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [autoHide, setAutoHide] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isExpanded = !autoHide || hovered;

  return (
    <div className="min-h-screen relative flex flex-col lg:flex-row bg-[#06070B] text-slate-100">
      {/* Ambient Aurora Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="aurora-blob absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="aurora-blob absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-cyan-500/15 blur-[130px]" />
        <div className="aurora-blob absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      {/* Mobile Sticky Header (< lg) */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0B0D15]/90 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 p-[1px]">
            <div className="h-full w-full rounded-[7px] bg-[#0B0D15] flex items-center justify-center">
              <BriefcaseBusiness className="h-4 w-4 text-indigo-300" />
            </div>
          </div>
          <span className="text-sm font-bold bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent">
            Radar Pro
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/analisar"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Analisar
          </Link>
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Abrir menu"
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-200"
          >
            {mobileMenuOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-20 pt-14 bg-black/70 backdrop-blur-sm">
          <nav className="bg-[#0B0D15] border-b border-white/10 p-4 space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium ${
                    active
                      ? "bg-indigo-500/20 text-white border border-indigo-400/30"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <Icon className="h-4 w-4 text-indigo-300" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Desktop Autohide / Collapsible Sidebar (lg+) */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`hidden lg:flex relative z-20 shrink-0 border-r border-white/10 bg-[#0B0D15]/85 backdrop-blur-xl py-5 flex-col justify-between transition-all duration-300 ease-out ${
          isExpanded ? "w-68 px-4" : "w-20 px-3"
        }`}
      >
        <div>
          <div className="flex items-center justify-between mb-6 px-1">
            <Link href="/" className="flex items-center gap-3 group min-w-0">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 p-[1px] shadow-lg shadow-indigo-500/25">
                <div className="h-full w-full rounded-[11px] bg-[#0B0D15] flex items-center justify-center">
                  <BriefcaseBusiness className="h-5 w-5 text-indigo-300 group-hover:scale-110 transition-transform" />
                </div>
              </div>
              {isExpanded && (
                <div className="truncate">
                  <div className="text-sm font-bold tracking-tight bg-gradient-to-r from-white via-indigo-100 to-cyan-200 bg-clip-text text-transparent">
                    Radar Pro
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Carreira & Renda
                  </div>
                </div>
              )}
            </Link>

            {isExpanded && (
              <button
                onClick={() => setAutoHide((v) => !v)}
                title={
                  autoHide
                    ? "Fixar barra lateral aberta"
                    : "Ativar autohide da barra lateral"
                }
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                {autoHide ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          <Link
            href="/analisar"
            title="Analisar Nova Vaga / Freela"
            className={`flex items-center justify-center gap-2 w-full mb-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all ${
              isExpanded ? "px-3.5" : "px-0"
            }`}
          >
            <Plus className="h-4 w-4 shrink-0" />
            {isExpanded && <span>Analisar Nova Vaga</span>}
          </Link>

          <nav className="flex flex-col gap-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={!isExpanded ? item.label : undefined}
                  className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    isExpanded ? "px-3.5" : "px-0 justify-center"
                  } ${
                    active
                      ? "bg-gradient-to-r from-indigo-500/20 to-cyan-500/10 text-white border border-indigo-400/30 shadow-sm shadow-indigo-500/10"
                      : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? "text-indigo-300" : "text-slate-500"
                    }`}
                  />
                  {isExpanded && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {isExpanded ? (
          <div className="mt-8 rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-[#121524] to-cyan-500/5 p-3.5 text-xs text-slate-300 space-y-1.5">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              Modo Híbrido Ativo
            </div>
            <p className="leading-relaxed text-slate-400">
              {autoHide
                ? "Autohide ativo: recolhe ao sair com o mouse."
                : "Barra fixada: clique no ícone acima para ativar autohide."}
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <div
              title="Autohide ativo — passe o mouse para expandir"
              className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center text-indigo-300"
            >
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
        )}
      </aside>

      <main className="relative z-10 flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
