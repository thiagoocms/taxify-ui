import { BillingCycle } from './billing.model';

export type PlanServiceType =
  | 'FISCAL_XML_IMPORT'
  | 'INVOICE_AUDIT'
  | 'SIEG_INTEGRATION'
  | 'MULTI_USER_ACCESS'
  | 'REPORTS'
  | 'SEFAZ_INTEGRATION'
  | 'SEFAZ_MANIFESTATION'
  | 'NFSE_NATIONAL_INTEGRATION';

export interface PlanDTO {
  id?: string;
  name: string;
  description?: string;
  services?: PlanServiceType[];
  /** Preço de tabela; o honorário de cada assinatura pode ser diferente (negociado). */
  listPrice?: number | null;
  billingCycle?: BillingCycle | null;
  deleted?: boolean;
}

export interface PlanFilterDTO {
  id?: string;
  name?: string;
  deleted?: boolean;
}

/**
 * Importação de notas: "Importação de XML fiscal" coloca a empresa no agendador; a fonte vem das
 * integrações do plano — SIEG, SEFAZ ou as duas.
 */
export const PLAN_SERVICE_LABELS: Record<PlanServiceType, string> = {
  FISCAL_XML_IMPORT: 'Importação de XML fiscal',
  INVOICE_AUDIT: 'Auditoria de notas fiscais',
  SIEG_INTEGRATION: 'Integração SIEG',
  SEFAZ_INTEGRATION: 'Integração SEFAZ (certificado A1)',
  SEFAZ_MANIFESTATION: 'Manifestação do destinatário (Ciência automática na SEFAZ)',
  NFSE_NATIONAL_INTEGRATION: 'Integração NFS-e Nacional (Ambiente Nacional, certificado A1)',
  MULTI_USER_ACCESS: 'Acesso multiusuário',
  REPORTS: 'Relatórios',
};

export const PLAN_SERVICE_OPTIONS: { value: PlanServiceType; label: string }[] = (
  Object.keys(PLAN_SERVICE_LABELS) as PlanServiceType[]
).map((value) => ({ value, label: PLAN_SERVICE_LABELS[value] }));
