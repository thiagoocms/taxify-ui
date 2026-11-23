/** Retenções (roadmap M1): a recolher, a compensar e informativas, por competência. */
export type RetentionNature = 'A_RECOLHER' | 'A_COMPENSAR' | 'INFORMATIVO';

export interface RetentionRowDTO {
  /** "<empresa>|<documento>:<id>:<tributo>:<natureza>" — identifica a linha na conferência. */
  key: string;
  companyId: string;
  companyName: string;
  companyDocument?: string | null;
  /** NFSE ou NFE. */
  documentType: string;
  documentId: string;
  numero?: string | null;
  issueDate?: string | null;
  competence: string;
  counterpartName?: string | null;
  counterpartDocument?: string | null;
  nature: RetentionNature;
  tax: string;
  amount: number;
  serviceValue?: number | null;
  dueDate?: string | null;
  action?: string | null;
  undue: boolean;
  reviewed: boolean;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export interface RetentionCardDTO {
  nature: RetentionNature;
  total: number;
  notes: number;
  byTax: Record<string, number>;
  pendingReview: number;
}

export interface RetentionScreenDTO {
  competence: string;
  cards: RetentionCardDTO[];
  rows: RetentionRowDTO[];
}

export const NATURE_LABELS: Record<RetentionNature, string> = {
  A_RECOLHER: 'A recolher',
  A_COMPENSAR: 'A compensar',
  INFORMATIVO: 'Informativo',
};

export const NATURE_HINTS: Record<RetentionNature, string> = {
  A_RECOLHER: 'A empresa tomou o serviço e reteve — precisa recolher',
  A_COMPENSAR: 'A empresa prestou o serviço e sofreu a retenção — pode compensar',
  INFORMATIVO: 'ICMS-ST nas compras — vai para a conferência da fronteira',
};

export const TAX_LABELS: Record<string, string> = {
  ISS: 'ISS',
  IRRF: 'IRRF',
  PIS: 'PIS',
  COFINS: 'COFINS',
  CSLL: 'CSLL',
  INSS: 'INSS',
  ICMS_ST: 'ICMS-ST',
};
