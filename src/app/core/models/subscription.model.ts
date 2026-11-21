import { BillingCycle, BillingProviderType, SubscriptionStatus } from './billing.model';

/**
 * Plano + período escolhidos no Taxify, mais contrato e honorário. Quando {@code source} é
 * um sistema integrado (não MANUAL), honorário, status, contrato e próximo vencimento vêm
 * de lá e não são editáveis aqui.
 */
export interface SubscriptionDTO {
  id?: string;
  companyId: string;
  planId: string;
  startDate: string;
  endDate: string;
  fee?: number | null;
  billingCycle?: BillingCycle | null;
  billingDay?: number | null;
  status?: SubscriptionStatus | null;
  /** Somente leitura. */
  source?: BillingProviderType;
  externalContractId?: string | null;
  externalContractNumber?: string | null;
  nextDueDate?: string | null;
  lastSyncedAt?: string | null;
  syncWarning?: string | null;
  deleted?: boolean;
}

export interface SubscriptionFilterDTO {
  id?: string;
  companyId?: string;
  planId?: string;
  deleted?: boolean;
}
