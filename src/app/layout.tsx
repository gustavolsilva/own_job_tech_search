import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radar de Oportunidades | Vagas, Aderência e Renda",
  description:
    "Portal pessoal de busca de vagas nacionais, internacionais e freelance com leitura de CV/LinkedIn, mapeamento salarial/benefícios, Raio-X de empresas e propostas humanizadas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark h-full antialiased">
      <body className="min-h-full bg-[#090A0F] text-slate-100 font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
