import type { ContractType, CurrencyCode, SalaryPeriod } from "./types";

export interface FxRates {
  USD_BRL: number;
  EUR_BRL: number;
  GBP_BRL: number;
  updatedAt: string;
  source: "live" | "fallback";
}

const FALLBACK_RATES: FxRates = {
  USD_BRL: 5.75,
  EUR_BRL: 6.15,
  GBP_BRL: 7.25,
  updatedAt: new Date().toISOString(),
  source: "fallback",
};

let cachedRates: { rates: FxRates; expiresAt: number } | null = null;

export async function getFxRates(): Promise<FxRates> {
  if (cachedRates && Date.now() < cachedRates.expiresAt) {
    return cachedRates.rates;
  }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      rates?: Record<string, number>;
    };
    const brl = data.rates?.BRL;
    const eur = data.rates?.EUR;
    const gbp = data.rates?.GBP;

    if (brl && eur && gbp) {
      const rates: FxRates = {
        USD_BRL: Number(brl.toFixed(2)),
        EUR_BRL: Number((brl / eur).toFixed(2)),
        GBP_BRL: Number((brl / gbp).toFixed(2)),
        updatedAt: new Date().toISOString(),
        source: "live",
      };
      cachedRates = {
        rates,
        expiresAt: Date.now() + 6 * 60 * 60 * 1000,
      };
      return rates;
    }
  } catch {
    // Fallback rates if offline
  }

  return FALLBACK_RATES;
}

export function toBrl(amount: number, currency: CurrencyCode, rates: FxRates): number {
  switch (currency) {
    case "BRL":
      return amount;
    case "USD":
      return amount * rates.USD_BRL;
    case "EUR":
      return amount * rates.EUR_BRL;
    case "GBP":
      return amount * rates.GBP_BRL;
    default:
      return amount * rates.USD_BRL;
  }
}

export function normalizeToMonthlyGrossBrl(
  amount: number,
  currency: CurrencyCode,
  period: SalaryPeriod,
  rates: FxRates,
  weeklyHours = 40
): number {
  const amountBrl = toBrl(amount, currency, rates);
  switch (period) {
    case "hourly":
      return Math.round(amountBrl * weeklyHours * 4.33);
    case "project":
      return Math.round(amountBrl); // Assume escopo mensal equivalente
    case "yearly":
      return Math.round(amountBrl / 12);
    case "monthly":
    default:
      return Math.round(amountBrl);
  }
}

export interface NetSimulationInput {
  grossMonthlyBrl: number;
  contractType: ContractType;
  isInternational: boolean;
  benefitsMonthlyBrl?: number;
  pjTaxRatePercent?: number; // ex: 6% a 11% Simples Nacional / exportação
  fxSpreadPercent?: number; // ex: 1.5%
}

export interface NetSimulationResult {
  grossMonthlyBrl: number;
  estimatedTaxesBrl: number;
  benefitsBrl: number;
  fgtsAndThirteenthMonthlyEquivalentBrl: number;
  netMonthlyBrl: number;
  effectiveHourlyNetBrl: number;
  notes: string[];
}

export function simulateMonthlyNetBrl(
  input: NetSimulationInput
): NetSimulationResult {
  const gross = Math.max(0, input.grossMonthlyBrl);
  const benefits = Math.max(0, input.benefitsMonthlyBrl ?? 0);

  if (input.contractType === "clt" || (input.contractType === "indeterminate" && !input.isInternational)) {
    // Estimativa realista CLT Brasil (INSS teto + IRRF 27.5% faixa alta)
    const inss = Math.min(gross * 0.14, 951.63);
    const irrfBase = Math.max(0, gross - inss);
    let irrf = 0;
    if (irrfBase > 4664.68) {
      irrf = irrfBase * 0.275 - 896.0;
    } else if (irrfBase > 3751.05) {
      irrf = irrfBase * 0.225 - 662.77;
    } else if (irrfBase > 2826.65) {
      irrf = irrfBase * 0.15 - 381.44;
    }
    irrf = Math.max(0, irrf);

    // Equivalente mensal de 13º + 1/3 férias + FGTS 8%
    const fgts = gross * 0.08;
    const thirteenthAndVacation = (gross + gross / 3) / 12;
    const netCash = gross - inss - irrf + benefits;
    const totalPackageEquivalent = Math.round(netCash + fgts + thirteenthAndVacation);

    return {
      grossMonthlyBrl: Math.round(gross),
      estimatedTaxesBrl: Math.round(inss + irrf),
      benefitsBrl: Math.round(benefits),
      fgtsAndThirteenthMonthlyEquivalentBrl: Math.round(fgts + thirteenthAndVacation),
      netMonthlyBrl: totalPackageEquivalent,
      effectiveHourlyNetBrl: Math.round(totalPackageEquivalent / 168),
      notes: [
        "Inclui desconto estimado de INSS + IRRF.",
        "Soma FGTS (8%) + provisão mensal de 13º e 1/3 de férias para comparação justa com PJ.",
        benefits > 0
          ? `Inclui R$ ${Math.round(benefits)}/mês em benefícios líquidos (VR/VA/auxílios).`
          : "Benefícios extras não especificados na vaga.",
      ],
    };
  }

  if (input.isInternational) {
    const spreadRate = (input.fxSpreadPercent ?? 1.5) / 100;
    const taxRate = (input.pjTaxRatePercent ?? 6.5) / 100; // Exportação de serviços (PIS/COFINS/ISS isentos em muitos casos)
    const fxCost = gross * spreadRate;
    const afterSpread = gross - fxCost;
    const taxes = afterSpread * taxRate;
    const accountant = 250;
    const net = Math.max(0, Math.round(afterSpread - taxes - accountant + benefits));

    return {
      grossMonthlyBrl: Math.round(gross),
      estimatedTaxesBrl: Math.round(taxes + fxCost + accountant),
      benefitsBrl: Math.round(benefits),
      fgtsAndThirteenthMonthlyEquivalentBrl: 0,
      netMonthlyBrl: net,
      effectiveHourlyNetBrl: Math.round(net / 160),
      notes: [
        `Considera spread cambial de ${(spreadRate * 100).toFixed(1)}% + alíquota média de exportação (${(taxRate * 100).toFixed(1)}%).`,
        "Inclui estimativa de R$ 250/mês de contabilidade.",
      ],
    };
  }

  // PJ Brasil / Contrato Determinado / Freelance
  const pjTax = (input.pjTaxRatePercent ?? 10.5) / 100;
  const taxes = gross * pjTax;
  const accountant = 250;
  const net = Math.max(0, Math.round(gross - taxes - accountant + benefits));

  return {
    grossMonthlyBrl: Math.round(gross),
    estimatedTaxesBrl: Math.round(taxes + accountant),
    benefitsBrl: Math.round(benefits),
    fgtsAndThirteenthMonthlyEquivalentBrl: 0,
    netMonthlyBrl: net,
    effectiveHourlyNetBrl: Math.round(net / 160),
    notes: [
      `Simples Nacional / Fator R estimado em ${(pjTax * 100).toFixed(1)}% + R$ 250/mês de contabilidade.`,
      "Sem provisão automática de férias/13º caso não haja PTO remunerado.",
    ],
  };
}

