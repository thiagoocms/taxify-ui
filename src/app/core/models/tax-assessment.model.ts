/** Regime tributário estruturado (ver TaxRegime.java). */
export type TaxRegime = 'MEI' | 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL' | 'OTHER';
export type BusinessActivity = 'COMMERCE' | 'SERVICE' | 'COMMERCE_AND_SERVICE' | 'INDUSTRY';
export type SimplesAnnex = 'I' | 'II' | 'III' | 'IV' | 'V';

export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  MEI: 'MEI',
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
  OTHER: 'Outro',
};

export const BUSINESS_ACTIVITY_LABELS: Record<BusinessActivity, string> = {
  COMMERCE: 'Comércio',
  SERVICE: 'Serviço',
  COMMERCE_AND_SERVICE: 'Comércio e Serviço',
  INDUSTRY: 'Indústria',
};

/** Anexo do Simples para a receita de serviços (mercadorias seguem o CFOP: revenda → I, produção → II). */
export const SERVICE_ANNEX_LABELS: Record<'III' | 'IV' | 'V', string> = {
  III: 'Anexo III — serviços em geral',
  IV: 'Anexo IV — construção, limpeza, vigilância, advocacia',
  V: 'Anexo V — serviços intelectuais (fator R < 28%)',
};

export interface MonthRevenueDTO {
  /** "2026-10" */
  month: string;
  ownProductionSales: number;
  resales: number;
  services: number;
  salesReturns: number;
  net: number;
}

export interface TaxEstimateDTO {
  code: string;
  label: string;
  base?: number | null;
  /** Percentual: 6.5432 = 6,5432% */
  rate?: number | null;
  /** null = não estimável pelas notas (ver note). */
  amount?: number | null;
  note?: string | null;
}

export type AlertLevel = 'INFO' | 'WARNING' | 'DANGER';

export interface AssessmentAlertDTO {
  level: AlertLevel;
  code: string;
  message: string;
}

/** Fechamento do mês; status OPEN quando nunca foi fechado. */
export interface PeriodClosingDTO {
  status: 'OPEN' | 'CLOSED';
  closedAt?: string | null;
  closedBy?: string | null;
  guideIssued: boolean;
  guideAmount?: number | null;
  /** AAAA-MM-DD */
  guideDueDate?: string | null;
  notes?: string | null;
  /** Entradas do mês ainda a conferir. */
  pendingReviews: number;
}

export interface GuideUpdateDTO {
  guideIssued: boolean;
  guideAmount?: number | null;
  guideDueDate?: string | null;
  notes?: string | null;
}

export interface TaxAssessmentDTO {
  companyId: string;
  companyName: string;
  companyDocument?: string | null;
  month: string;
  taxRegime?: TaxRegime | null;
  taxRegimeLabel?: string | null;
  businessActivity?: BusinessActivity | null;
  simplesServiceAnnex?: SimplesAnnex | null;
  revenue: MonthRevenueDTO;
  invoicesIssued: number;
  rbt12: number;
  rbt12Proportional: boolean;
  yearToDate: number;
  taxes: TaxEstimateDTO[];
  totalTaxes: number;
  alerts: AssessmentAlertDTO[];
  /** 12 meses anteriores + o período; vazio na lista do escritório. */
  history: MonthRevenueDTO[];
  /** Quando CLOSED, todos os valores acima são os congelados no fechamento. */
  closing: PeriodClosingDTO;
}
