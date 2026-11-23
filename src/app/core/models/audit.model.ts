/** Auditoria tipo malha (roadmap M9). */
export type AuditGroup = 'INTEGRIDADE' | 'COERENCIA' | 'ANOMALIA';

export interface AuditRuleDTO {
  code: string;
  title: string;
  group: AuditGroup;
  severity: string;
  legalBasis?: string | null;
  link?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  enabled: boolean;
  /** O time fiscal conferiu a regra — senão os achados dela são "a conferir". */
  reviewed: boolean;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export interface AuditFindingDTO {
  /** A pendência (resolver / desconsiderar / reabrir usam as rotas de Pendências). */
  pendencyId: string;
  ruleCode: string;
  ruleTitle: string;
  group?: AuditGroup | null;
  severity: 'ALTA' | 'MEDIA' | 'BAIXA' | 'INFO';
  ruleReviewed: boolean;
  title: string;
  detail?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  status: 'ABERTA' | 'RESOLVIDA' | 'DESCONSIDERADA';
  firstSeenAt: string;
  closedAt?: string | null;
  closedBy?: string | null;
  closeComment?: string | null;
  autoClosed: boolean;
}

export interface AuditReportDTO {
  companyId: string;
  companyName: string;
  companyDocument?: string | null;
  competence: string;
  /** null = competência ainda não auditada. */
  run?: { ranAt: string; ranBy: string; findings: number; notesChecked: number } | null;
  findings: AuditFindingDTO[];
}

export const AUDIT_GROUP_LABELS: Record<AuditGroup, string> = {
  INTEGRIDADE: 'Integridade',
  COERENCIA: 'Coerência dos itens',
  ANOMALIA: 'Anomalias',
};
