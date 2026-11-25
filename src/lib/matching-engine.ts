import { z } from "zod";
import { generateStructuredWithFallback, generateTextWithFallback } from "./ai";
import { humanizePitchText } from "./humanizer";
import type { CompanyIntelDTO, JobDTO, MatchDTO, ProfileDTO } from "./types";

const MatchAiSchema = z.object({
  overallScore: z.number().min(0).max(100),
  technicalScore: z.number().min(0).max(100),
  seniorityScore: z.number().min(0).max(100),
  languageModelScore: z.number().min(0).max(100),
  financialScore: z.number().min(0).max(100),
  effortReturnScore: z.number().min(0).max(100),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  atsSuggestions: z.array(z.string()),
  rationale: z.string(),
});

export async function calculateJobMatch(
  profile: ProfileDTO,
  job: JobDTO
): Promise<Omit<MatchDTO, "id" | "updatedAt">> {
  const aiResult = await generateStructuredWithFallback({
    schema: MatchAiSchema,
    operation: "job_match",
    system:
      "Você é um avaliador técnico de aderência entre candidato e vaga/projeto. Seja objetivo, realista e responda em português do Brasil.",
    prompt: `Avalie a aderência deste candidato para a oportunidade abaixo.
Perfil:
- Nome/Título: ${profile.headline} (${profile.seniority})
- Skills: ${profile.skills.join(", ")}
- Idiomas: ${profile.languages.map((l) => `${l.language} (${l.level})`).join(", ")}
- Contratos aceitos: ${profile.acceptedContracts.join(", ")}
- Meta líquida mensal (BRL): R$ ${profile.minMonthlyNetBrl}
- Horas livres/semana para projetos: ${profile.weeklyFreeHours}h

Vaga:
- Título: ${job.title} | Empresa: ${job.company}
- Escopo: ${job.scope} | Contrato: ${job.contractType} | Modelo: ${job.workModel}
- Tags: ${job.tags.join(", ")}
- Líquido estimado (BRL): ${job.estimatedMonthlyNetBrl ?? "Não informado"}
- Descrição: ${job.descriptionRaw.slice(0, 5000)}`,
  });

  if (aiResult) {
    return {
      jobId: job.id,
      profileId: profile.id,
      overallScore: Math.round(aiResult.data.overallScore),
      technicalScore: Math.round(aiResult.data.technicalScore),
      seniorityScore: Math.round(aiResult.data.seniorityScore),
      languageModelScore: Math.round(aiResult.data.languageModelScore),
      financialScore: Math.round(aiResult.data.financialScore),
      effortReturnScore: Math.round(aiResult.data.effortReturnScore),
      matchedSkills: aiResult.data.matchedSkills,
      missingSkills: aiResult.data.missingSkills,
      atsSuggestions: aiResult.data.atsSuggestions,
      rationale: aiResult.data.rationale,
      analyzedBy: "ai",
    };
  }

  // Fallback heurístico determinístico (5 pilares)
  const profileSkillsLower = new Set(profile.skills.map((s) => s.toLowerCase()));
  const jobTextLower = `${job.title} ${job.descriptionRaw}`.toLowerCase();
  const jobTags = job.tags.length > 0 ? job.tags : ["Software Engineering"];

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const tag of jobTags) {
    const tl = tag.toLowerCase();
    const has =
      profileSkillsLower.has(tl) ||
      Array.from(profileSkillsLower).some((ps) => ps.includes(tl) || tl.includes(ps));
    if (has) matchedSkills.push(tag);
    else missingSkills.push(tag);
  }

  // Também checa skills do candidato mencionadas na descrição
  for (const skill of profile.skills) {
    if (
      jobTextLower.includes(skill.toLowerCase()) &&
      !matchedSkills.some((m) => m.toLowerCase() === skill.toLowerCase())
    ) {
      matchedSkills.push(skill);
    }
  }

  const technicalScore =
    jobTags.length > 0
      ? Math.min(100, Math.round((matchedSkills.length / Math.max(jobTags.length, 3)) * 100))
      : 65;

  let seniorityScore = 78;
  const isSeniorJob = /(senior|sênior|sr\.?|staff|lead|principal)/i.test(job.title);
  const isJuniorJob = /(junior|júnior|jr\.?|estágio|intern)/i.test(job.title);
  if (isSeniorJob && ["senior", "staff", "lead"].includes(profile.seniority)) {
    seniorityScore = 92;
  } else if (isSeniorJob && profile.seniority === "junior") {
    seniorityScore = 45;
  } else if (isJuniorJob && ["senior", "staff", "lead"].includes(profile.seniority)) {
    seniorityScore = 70;
  }

  const hasEnglish = profile.languages.some((l) => /ingl|english/i.test(l.language));
  const languageModelScore =
    job.scope === "international" ? (hasEnglish ? 88 : 42) : 95;

  let financialScore = 72;
  if (job.estimatedMonthlyNetBrl) {
    const ratio = job.estimatedMonthlyNetBrl / Math.max(profile.minMonthlyNetBrl, 1);
    financialScore = Math.min(100, Math.max(35, Math.round(ratio * 82)));
  }
  if (!profile.acceptedContracts.includes(job.contractType) && job.contractType !== "indeterminate") {
    financialScore = Math.max(30, financialScore - 20);
  }

  const effortReturnScore =
    job.contractType === "freelance" || job.contractType === "part_time"
      ? profile.weeklyFreeHours >= 15
        ? 90
        : 65
      : 80;

  const overallScore = Math.round(
    technicalScore * 0.4 +
      seniorityScore * 0.2 +
      languageModelScore * 0.15 +
      financialScore * 0.15 +
      effortReturnScore * 0.1
  );

  const atsSuggestions = [
    missingSkills.length > 0
      ? `Inclua evidências práticas ou projetos com: ${missingSkills.slice(0, 3).join(", ")}.`
      : "Seu conjunto técnico cobre os principais requisitos listados.",
    job.scope === "international"
      ? "Destaque resultados mensuráveis em inglês (latência, receita, escala) logo no topo do CV."
      : "Adapte o título do currículo para espelhar exatamente o cargo da vaga.",
  ];

  return {
    jobId: job.id,
    profileId: profile.id,
    overallScore,
    technicalScore,
    seniorityScore,
    languageModelScore,
    financialScore,
    effortReturnScore,
    matchedSkills: matchedSkills.slice(0, 10),
    missingSkills: missingSkills.slice(0, 8),
    atsSuggestions,
    rationale: `Aderência calculada localmente: ${matchedSkills.length} competências compatíveis e alinhamento ${overallScore >= 75 ? "alto" : overallScore >= 55 ? "moderado" : "inicial"} com suas metas.`,
    analyzedBy: "heuristic",
  };
}

const CompanyXRaySchema = z.object({
  segment: z.string(),
  salaryBenchmark: z.object({
    cltRangeBrl: z.string(),
    pjOrContractorRange: z.string(),
    variablePay: z.string(),
    dataOrigin: z.string(),
  }),
  benefitsEstimate: z.object({
    vrVaMonthlyBrl: z.string(),
    healthDental: z.string(),
    homeOfficeAndEducation: z.string(),
    wellhubAndOther: z.string(),
  }),
  cultureReviews: z.object({
    estimatedRating: z.string(),
    praisedPoints: z.array(z.string()),
    commonComplaints: z.array(z.string()),
    exEmployeeSignals: z.string(),
  }),
  careerGrowth: z.object({
    yTrackOrSpecialist: z.string(),
    reviewCycle: z.string(),
    renewalPotentialForContracts: z.string(),
  }),
  marketTiming: z.object({
    currentMomentum: z.string(),
    favorableSignals: z.array(z.string()),
    alertSignals: z.array(z.string()),
    verdict: z.string(),
  }),
});

export async function generateCompanyXRay(
  companyName: string,
  roleTitle: string,
  jobContext: string
): Promise<Omit<CompanyIntelDTO, "id" | "updatedAt">> {
  const aiResult = await generateStructuredWithFallback({
    schema: CompanyXRaySchema,
    operation: "company_xray",
    system:
      "Você atua como analista de inteligência de mercado (metodologia Radar de Empresas). Estruture o Raio-X em 5 dimensões: remuneração, benefícios estimados em R$, avaliações de funcionários/ex-funcionários, plano de carreira e timing de mercado. Seja transparente diferenciando dados explícitos da vaga de estimativas de benchmark de mercado.",
    prompt: `Gere o Raio-X completo para a empresa "${companyName}" considerando o cargo "${roleTitle}".
Contexto da vaga:
${jobContext.slice(0, 3500)}`,
  });

  if (aiResult) {
    return {
      companyName,
      ...aiResult.data,
      generatedBy: "ai",
    };
  }

  const isIntl = /remote|usd|eur|global|english|inc\.|llc/i.test(jobContext);
  return {
    companyName,
    segment: isIntl ? "Tecnologia Global / Remoto" : "Tecnologia / Software Brasil",
    salaryBenchmark: {
      cltRangeBrl: isIntl
        ? "Geralmente contratação direta B2B/Contractor (sem CLT local)"
        : "R$ 11.000 – R$ 19.000/mês (benchmark Pleno/Sênior Tech BR)",
      pjOrContractorRange: isIntl
        ? "US$ 4.000 – US$ 8.500/mês (US$ 30 – US$ 65/h em contratos)"
        : "R$ 14.000 – R$ 24.000/mês (PJ)",
      variablePay: "PLR ou bônus de performance (1 a 2 salários/ano) ou equity em startups",
      dataOrigin: "Estimativa heurística de mercado (ative a IA Gateway para pesquisa contextual aprofundada)",
    },
    benefitsEstimate: {
      vrVaMonthlyBrl: isIntl ? "Geralmente embutido no rate (ou stipend remoto)" : "R$ 900 – R$ 1.400/mês (Caju/Flash/Swile)",
      healthDental: isIntl ? "Seguro saúde internacional ou reembolso (quando EOR)" : "Plano médico e odontológico nacional sem coparticipação padrão",
      homeOfficeAndEducation: "Auxílio setup / educação estimado entre R$ 200 e R$ 400/mês",
      wellhubAndOther: "Wellhub/TotalPass + PTO flexível conforme regime",
    },
    cultureReviews: {
      estimatedRating: "3.9 – 4.3 / 5.0 (faixa típica do setor)",
      praisedPoints: [
        "Autonomia técnica e trabalho assíncrono em times distribuídos",
        "Stack moderna e exposição a problemas de escala",
      ],
      commonComplaints: [
        "Processos de onboarding enxutos em contratações remotas/PJ",
        "Cobrança por entregas rápidas em contratos por prazo determinado",
      ],
      exEmployeeSignals:
        "Ex-funcionários costumam valorizar a flexibilidade e o ganho financeiro, apontando atenção necessária ao alinhamento de escopo.",
    },
    careerGrowth: {
      yTrackOrSpecialist: "Trilha técnica / especialista comum em times de produto",
      reviewCycle: "Avaliações semestrais ou renovação trimestral em contratos B2B",
      renewalPotentialForContracts:
        "Contratos determinados e freelas com boa entrega frequentemente evoluem para retainer mensal.",
    },
    marketTiming: {
      currentMomentum: "Demanda ativa para perfis com entrega autônoma e inglês/comunicação clara.",
      favorableSignals: [
        "Vaga aberta recentemente indicando orçamento aprovado",
        "Possibilidade de composição de renda em contratos remotos/freelance",
      ],
      alertSignals: [
        "Validar prazo de pagamento (Net-15/Net-30) e escopo fechado antes de assinar",
      ],
      verdict:
        "Vale avançar na candidatura confirmando na primeira conversa o teto orçamentário e a carga horária semanal esperada.",
    },
    generatedBy: "heuristic",
  };
}

export async function generateHumanizedPitch(params: {
  profile: ProfileDTO;
  job: JobDTO;
  format: "recruiter_dm" | "freelance_proposal" | "cover_letter";
  language: "pt" | "en";
}): Promise<{ content: string; generatedBy: "ai" | "heuristic" }> {
  const { profile, job, format, language } = params;
  const formatDesc =
    format === "recruiter_dm"
      ? "mensagem curta e direta para recrutador / LinkedIn DM (máximo 120 palavras)"
      : format === "freelance_proposal"
        ? "proposta comercial objetiva para projeto freelance ou contrato determinado focada em entregáveis, prazo e experiência relevante"
        : "cover letter enxuta e natural para vaga";

  const langLabel = language === "en" ? "English" : "Português do Brasil";

  const aiResult = await generateTextWithFallback({
    operation: "generate_pitch",
    system: `Escreva como um profissional experiente, direto e humano.
REGRAS RÍGIDAS DE ESTILO (humanizer):
- Não use travessões (— ou –).
- Não use clichês de IA ("Let's dive in", "delve", "testament", "pivotal", "seamless", "em um cenário em constante evolução", "desempenha um papel crucial").
- Sem saudações de chatbot ("Aqui está sua proposta:"). Entregue apenas o texto pronto para enviar.
- Cite habilidades e experiências reais do candidato conectadas às necessidades da vaga.`,
    prompt: `Escreva uma ${formatDesc} em ${langLabel}.

Candidato: ${profile.fullName}
Título: ${profile.headline} (${profile.seniority})
Principais skills: ${profile.skills.slice(0, 10).join(", ")}
Resumo: ${profile.summary.slice(0, 500)}

Vaga/Projeto: ${job.title} na ${job.company}
Contrato: ${job.contractType} | Escopo: ${job.scope}
Descrição resumida: ${job.descriptionRaw.slice(0, 1500)}`,
  });

  if (aiResult) {
    return {
      content: humanizePitchText(aiResult.text),
      generatedBy: "ai",
    };
  }

  const topSkills = profile.skills.slice(0, 4).join(", ");
  if (language === "en") {
    if (format === "recruiter_dm") {
      return {
        content: humanizePitchText(
          `Hi there, I saw the ${job.title} opening at ${job.company}. I have hands-on experience with ${topSkills} and recently focused on shipping reliable production systems. Happy to share my background and discuss how I can help the team.`
        ),
        generatedBy: "heuristic",
      };
    }
    return {
      content: humanizePitchText(
        `Hello ${job.company} team,\n\nI am applying for the ${job.title} role. With a background in ${topSkills}, I focus on delivering clean, maintainable code and hitting clear milestones.\n\nIf you are looking for someone who can ramp up quickly and communicate directly with stakeholders, I would glad to walk through relevant work and discuss availability.\n\nBest,\n${profile.fullName}`
      ),
      generatedBy: "heuristic",
    };
  }

  if (format === "recruiter_dm") {
    return {
      content: humanizePitchText(
        `Olá! Vi a oportunidade de ${job.title} na ${job.company} e ela conversa diretamente com a minha experiência em ${topSkills}. Tenho disponibilidade para conversar sobre o escopo e como posso contribuir com as entregas do time.`
      ),
      generatedBy: "heuristic",
    };
  }

  return {
    content: humanizePitchText(
      `Olá, time da ${job.company},\n\nTenho interesse na posição/projeto de ${job.title}. Atuo com ${topSkills} e foco em entregas objetivas, boa comunicação e previsibilidade de prazo.\n\nPosso compartilhar exemplos práticos de projetos semelhantes e alinhar minha disponibilidade semanal (${profile.weeklyFreeHours}h/semana para projetos paralelos ou dedicação conforme o contrato).\n\nAbraço,\n${profile.fullName}`
    ),
    generatedBy: "heuristic",
  };
}

