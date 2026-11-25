# Radar Pro — Busca de Vagas, Aderência e Fontes de Renda

Portal web full-stack (local-first com suporte a deploy contínuo na Vercel) para centralizar vagas **nacionais**, **internacionais** e **freelance / tempo determinado**, com leitura de currículo/LinkedIn, mapeamento salarial/benefícios, Raio-X de empresas e gerador de propostas humanizadas.

## Ambiente Virtualizado (`.venv`)

O Node.js `v22.14.0` e o Python estão isolados dentro de `.venv/`.

Para rodar localmente:

```bash
source .venv/bin/activate
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Modo Híbrido (Local + Vercel AI Gateway com Gemini e Grok)

- **Sem chaves configuradas:** o portal funciona 100% localmente com extração determinística de perfil/currículo, normalizador de salários/benefícios, cálculo de Fit Score em 5 pilares, Raio-X heurístico e gerador de propostas.
- **Com Vercel AI Gateway (Gemini + Grok):** copie `.env.example` para `.env.local` e defina `AI_GATEWAY_API_KEY` (ou rode `vercel link && vercel env pull .env.local`). Os modelos padrão são `google/gemini-3.8-flash` com fallback automático para `spacexai/grok-4.6`.
