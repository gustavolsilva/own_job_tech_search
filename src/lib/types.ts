export type ContractType =
  | "clt"
  | "pj"
  | "indeterminate"
  | "fixed_term"
  | "freelance"
  | "part_time";

export type WorkModel = "remote" | "hybrid" | "onsite";
export type JobScope = "national" | "international";
export type CurrencyCode = "BRL" | "USD" | "EUR" | "GBP";
export type SalaryPeriod = "hourly" | "project" | "monthly" | "yearly";
export type ApplicationStatus =
  | "saved"
  | "pitch_ready"
  | "applied"
  | "interview"
  | "active"
  | "discarded";

export interface ExperienceItem {
  role: string;
  company: string;
  period: string;
  highlights: string[];
}

export interface LanguageItem {
  language: string;
  level: string;
}

export interface BenefitItem {
  name: string;
  estimatedBrl: number | null;
  details: string;
}

export interface ProfileDTO {
  id: string;
  fullName: string;
  headline: string;
  seniority: string;
  summary: string;
  skills: string[];
  experiences: ExperienceItem[];
  languages: LanguageItem[];
  acceptedContracts: ContractType[];
  targetScope: "national" | "international" | "both";
  minMonthlyNetBrl: number;
  minHourlyUsd: number;
  weeklyFreeHours: number;
  githubUsername: string;
  linkedinUrl: string;
  updatedAt: string;
}

export interface JobDTO {
  id: string;
  externalId: string;
  source: string;
  title: string;
  company: string;
  url: string;
  scope: JobScope;
  contractType: ContractType;
  workModel: WorkModel;
  location: string;
  currency: CurrencyCode;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: SalaryPeriod;
  estimatedMonthlyNetBrl: number | null;
  benefits: BenefitItem[];
  tags: string[];
  languages: string[];
  descriptionRaw: string;
  summaryPt: string;
  postedAt: string;
  createdAt: string;
}

export interface MatchDTO {
  id: string;
  jobId: string;
  profileId: string;
  overallScore: number;
  technicalScore: number;
  seniorityScore: number;
  languageModelScore: number;
  financialScore: number;
  effortReturnScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  atsSuggestions: string[];
  rationale: string;
  analyzedBy: "ai" | "heuristic";
  updatedAt: string;
}

export interface CompanyIntelDTO {
  id: string;
  companyName: string;
  segment: string;
  salaryBenchmark: {
    cltRangeBrl: string;
    pjOrContractorRange: string;
    variablePay: string;
    dataOrigin: string;
  };
  benefitsEstimate: {
    vrVaMonthlyBrl: string;
    healthDental: string;
    homeOfficeAndEducation: string;
    wellhubAndOther: string;
  };
  cultureReviews: {
    estimatedRating: string;
    praisedPoints: string[];
    commonComplaints: string[];
    exEmployeeSignals: string;
  };
  careerGrowth: {
    yTrackOrSpecialist: string;
    reviewCycle: string;
    renewalPotentialForContracts: string;
  };
  marketTiming: {
    currentMomentum: string;
    favorableSignals: string[];
    alertSignals: string[];
    verdict: string;
  };
  generatedBy: "ai" | "heuristic";
  updatedAt: string;
}

export interface ApplicationDTO {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  negotiatedMonthlyBrl: number;
  estimatedWeeklyHours: number;
  notes: string;
  contactInfo: string;
  followUpDate: string;
  updatedAt: string;
}

