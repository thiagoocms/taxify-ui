export type BillingProviderType = 'MANUAL' | 'CONTA_AZUL';
export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY';
export type SubscriptionStatus = 'ACTIVE' | 'INACTIVE' | 'CANCELED';
export type ChargeStatus = 'OPEN' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'RENEGOTIATED' | 'CANCELED';

export interface BillingSettingsDTO {
  provider: BillingProviderType;
  availableProviders: BillingProviderType[];
  connected: boolean;
  feeCategoryIds: string[];
  lastSyncAt?: string | null;
}

export interface BillingCategoryDTO {
  id: string;
  name: string;
}

export interface BillingSyncResultDTO {
  startedAt: string;
  companies: number;
  linked: number;
  newlyLinked: number;
  unmatched: string[];
  subscriptionsUpdated: number;
  withoutSubscription: string[];
  chargesSynced: number;
  warnings: string[];
  errors: string[];
}

export interface BillingChargeDTO {
  id: string;
  companyId: string;
  subscriptionId?: string | null;
  source: BillingProviderType;
  description?: string | null;
  competenceDate?: string | null;
  dueDate: string;
  amount: number;
  paidAmount?: number | null;
  openAmount?: number | null;
  status: ChargeStatus;
}

/** Vínculo da empresa com o cliente no sistema de cobrança. */
export interface ExternalLinkDTO {
  provider?: BillingProviderType;
  externalId: string;
  externalName?: string | null;
}

export interface CompanyBillingDTO {
  provider: BillingProviderType;
  externalCustomerId?: string | null;
  externalCustomerName?: string | null;
  openAmount: number;
  overdueAmount: number;
  overdueCount: number;
  charges: BillingChargeDTO[];
}

export const BILLING_PROVIDER_LABELS: Record<BillingProviderType, string> = {
  MANUAL: 'Manual (sem integração)',
  CONTA_AZUL: 'Conta Azul',
};

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  YEARLY: 'Anual',
};

export const BILLING_CYCLE_OPTIONS = (Object.keys(BILLING_CYCLE_LABELS) as BillingCycle[]).map((value) => ({
  value,
  label: BILLING_CYCLE_LABELS[value],
}));

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Ativa',
  INACTIVE: 'Inativa',
  CANCELED: 'Cancelada',
};

export const SUBSCRIPTION_STATUS_OPTIONS = (Object.keys(SUBSCRIPTION_STATUS_LABELS) as SubscriptionStatus[]).map(
  (value) => ({ value, label: SUBSCRIPTION_STATUS_LABELS[value] }),
);

export const CHARGE_STATUS_LABELS: Record<ChargeStatus, string> = {
  OPEN: 'Em aberto',
  PAID: 'Pago',
  PARTIALLY_PAID: 'Pago parcial',
  OVERDUE: 'Atrasado',
  RENEGOTIATED: 'Renegociado',
  CANCELED: 'Cancelado',
};
