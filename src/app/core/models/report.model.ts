import { AssessmentAlertDTO, MonthRevenueDTO, TaxEstimateDTO } from './tax-assessment.model';

/** Relatórios e simulação (roadmap M12). */
export interface DirectionTotalsDTO {
  notes: number;
  total: number;
  icms: number;
  icmsSt: number;
  ipi: number;
  pis: number;
  cofins: number;
  canceled: number;
}

export interface MonthlyReportDTO {
  companyId: string;
  companyName: string;
  companyDocument?: string | null;
  competence: string;
  regime?: string | null;
  revenue?: MonthRevenueDTO | null;
  rbt12?: number | null;
  invoicesIssued: number;
  taxes: TaxEstimateDTO[];
  totalTaxes?: number | null;
  entries: DirectionTotalsDTO;
  exits: DirectionTotalsDTO;
  cfops: { direction: 'ENTRADA' | 'SAIDA'; cfop: string; total: number }[];
  retentions: { nature: string; total: number }[];
  pendencies: { severity: string; count: number }[];
  auditFindings: number;
  history: MonthRevenueDTO[];
  alerts: AssessmentAlertDTO[];
}

export interface AbcItemDTO {
  key: string;
  name?: string | null;
  detail?: string | null;
  value: number;
  notes: number;
  share: number;
  accumulated: number;
  curve: 'A' | 'B' | 'C';
}

export interface AbcDTO {
  by: 'PRODUTO' | 'FORNECEDOR';
  from: string;
  to: string;
  total: number;
  countA: number;
  countB: number;
  countC: number;
  items: AbcItemDTO[];
}

export interface RegimeResultDTO {
  regime: string;
  label: string;
  total: number;
  effectiveRate: number;
  taxes: { code: string; label: string; amount: number }[];
  notes: string[];
  cheapest: boolean;
}

export interface SimulationDTO {
  companyName: string;
  currentRegime?: string | null;
  from: string;
  to: string;
  revenue: number;
  profitMargin: number;
  issRate: number;
  regimes: RegimeResultDTO[];
  premises: string[];
}
