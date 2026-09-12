export type PlanServiceType =
  | 'FISCAL_XML_IMPORT'
  | 'INVOICE_AUDIT'
  | 'SIEG_INTEGRATION'
  | 'MULTI_USER_ACCESS'
  | 'REPORTS';

export interface PlanDTO {
  id?: string;
  name: string;
  description?: string;
  services?: PlanServiceType[];
  deleted?: boolean;
}

export interface PlanFilterDTO {
  id?: string;
  name?: string;
  deleted?: boolean;
}

export const PLAN_SERVICE_LABELS: Record<PlanServiceType, string> = {
  FISCAL_XML_IMPORT: 'Importação de XML fiscal',
  INVOICE_AUDIT: 'Auditoria de notas fiscais',
  SIEG_INTEGRATION: 'Integração SIEG',
  MULTI_USER_ACCESS: 'Acesso multiusuário',
  REPORTS: 'Relatórios',
};

export const PLAN_SERVICE_OPTIONS: { value: PlanServiceType; label: string }[] = (
  Object.keys(PLAN_SERVICE_LABELS) as PlanServiceType[]
).map((value) => ({ value, label: PLAN_SERVICE_LABELS[value] }));
