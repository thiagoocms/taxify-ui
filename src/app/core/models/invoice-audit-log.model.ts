/** Situações do histórico de auditoria (ver InvoiceAuditStatus.java). */
export type InvoiceAuditStatus =
  | 'OK'
  | 'NEEDS_RECTIFICATION'
  | 'PENDING_DOCUMENTATION'
  | 'REJECTED'
  | 'RECTIFIED'
  | 'DIVERGENT'
  | 'REVIEW_REOPENED'
  | 'CANCELED';

export const AUDIT_STATUS_LABELS: Record<InvoiceAuditStatus, string> = {
  OK: 'Conferida',
  NEEDS_RECTIFICATION: 'Precisa retificar',
  PENDING_DOCUMENTATION: 'Pendente de documentação',
  REJECTED: 'Recusada',
  RECTIFIED: 'Retificada',
  DIVERGENT: 'Com divergência',
  REVIEW_REOPENED: 'Voltou para a conferir',
  CANCELED: 'Cancelada na SEFAZ',
};

/** O que dá para registrar à mão (o resto o sistema registra sozinho). */
export const MANUAL_AUDIT_STATUSES: InvoiceAuditStatus[] = ['PENDING_DOCUMENTATION', 'NEEDS_RECTIFICATION', 'REJECTED', 'OK'];

/** Histórico de auditoria da nota — só inclusão: nada é editado nem excluído. */
export interface InvoiceAuditLogDTO {
  id?: string;
  externalInvoiceKey: string;
  /** Somente leitura: o autor é sempre o usuário logado. */
  userId?: string | null;
  companyId: string;
  status: InvoiceAuditStatus;
  notes: string;
  deleted?: boolean;
  createdDate?: string | null;
  /** null = rotina automática. */
  userLogin?: string | null;
}

export interface InvoiceAuditLogFilterDTO {
  id?: string;
  externalInvoiceKey?: string;
  userId?: string;
  companyId?: string;
  status?: string;
  notes?: string;
  deleted?: boolean;
}
