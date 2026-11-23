/** Pendências (roadmap M13): o que falta em cada empresa, de todos os módulos. */
export type PendencyStatus = 'ABERTA' | 'RESOLVIDA' | 'DESCONSIDERADA';
export type PendencySeverity = 'ALTA' | 'MEDIA' | 'BAIXA' | 'INFO';

export interface PendencyDTO {
  id: string;
  companyId: string;
  companyName: string;
  companyDocument?: string | null;
  type: string;
  typeLabel: string;
  severity: PendencySeverity;
  /** "2026-11" — o mês a que pertence, quando pertence (emissão da nota). */
  competence?: string | null;
  /** COMPANY, NOTE (nota guardada) ou NOTE_KEY (só o resumo da SEFAZ). */
  objectType?: string | null;
  objectId?: string | null;
  title: string;
  detail?: string | null;
  status: PendencyStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  closedAt?: string | null;
  closedBy?: string | null;
  closeComment?: string | null;
  autoClosed: boolean;
}

export interface PendencyCounterDTO {
  type: string;
  label: string;
  total: number;
  alta: number;
  media: number;
  baixa: number;
  info: number;
}

export interface PendencySummaryDTO {
  counters: PendencyCounterDTO[];
  totalOpen: number;
}

/** Saúde da captura SEFAZ de uma empresa: última execução e os últimos 7 dias. */
export interface IntegrationHealthDTO {
  companyId: string;
  companyName: string;
  service: string;
  lastRunAt?: string | null;
  lastStatus?: string | null;
  lastDetail?: string | null;
  nextQueryAt?: string | null;
  runsLast7Days: number;
  errorsLast7Days: number;
}

export interface PendencyFilter {
  companyId?: string;
  /** ABERTA (padrão), RESOLVIDA, DESCONSIDERADA ou TODAS. */
  status?: string;
  severity?: PendencySeverity;
  type?: string;
  competence?: string;
  page?: number;
  size?: number;
}

export const SEVERITY_LABELS: Record<PendencySeverity, string> = {
  ALTA: 'Alta',
  MEDIA: 'Média',
  BAIXA: 'Baixa',
  INFO: 'Info',
};

export const PENDENCY_TYPE_LABELS: Record<string, string> = {
  CERTIFICATE_EXPIRED: 'Certificado A1 vencido',
  CERTIFICATE_EXPIRING: 'Certificado A1 vencendo',
  SEFAZ_CAPTURE_ERROR: 'Captura SEFAZ com erro',
  CIENCIA_REFUSED: 'Ciência recusada pela SEFAZ',
  MANIFESTATION_DEADLINE: 'Prazo de manifestação perto do fim',
  SOURCE_ONLY_SIEG: 'Nota só no SIEG',
  SOURCE_ONLY_SEFAZ: 'Nota só na SEFAZ',
  NOTE_DIVERGENT: 'Nota conferida com divergência',
  REGIME_MISSING: 'Regime tributário não informado',
};
