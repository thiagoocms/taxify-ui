import { FirmAccessStatus, FirmBlockedReason } from './firm-access.model';

/** Console da plataforma (spec 2026-11-26 taxify-saas, F1-RN-14 e F1-RN-15). Só admin da plataforma. */

export interface PlatformFirmAdminDTO {
  name: string;
  email: string;
}

/** Uma linha de `GET /platform/firms`: nunca traz dado de empresa cliente nem de colaborador que não seja ADMIN. */
export interface PlatformFirmRowDTO {
  id: string;
  name: string;
  documentNumber: string | null;
  createdDate: string | null;
  status: FirmAccessStatus;
  exempt: boolean;
  readOnly: boolean;
  reason: FirmBlockedReason | null;
  trialEndsOn: string | null;
  accessUntil: string | null;
  blockedSince: string | null;
  migrated: boolean;
  reviewed: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
  companiesInUse: number;
  companiesInactive: number;
  usersInUse: number;
  contactPhone: string | null;
  billingEmail: string | null;
  admins: PlatformFirmAdminDTO[];
}

export interface PlatformFirmFilterDTO {
  status?: FirmAccessStatus | '';
  unreviewed?: boolean;
  q?: string;
}

export type PlatformAccessAction =
  | 'extend-trial'
  | 'convert-to-trial'
  | 'release'
  | 'suspend'
  | 'reactivate'
  | 'cancel'
  | 'mark-reviewed';

export interface PlatformAccessActionRequestDTO {
  trialEndsOn?: string | null;
  accessUntil?: string | null;
  reason?: string | null;
}

/**
 * `PUT /platform/firms/{id}/contact`: campo nulo ou ausente mantém o valor (não dá para apagar); pelo menos um.
 * Não conta como revisão (use mark-reviewed) e grava o evento CONTACT_UPDATED.
 */
export interface PlatformFirmContactRequestDTO {
  documentNumber?: string;
  billingEmail?: string;
  contactPhone?: string;
}

/** Um item da trilha do escritório, mais novo primeiro. */
export interface PlatformFirmEventDTO {
  id: string;
  type: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  actor: string | null;
  createdDate: string | null;
}

/** Tipo do evento da trilha por extenso; tipo desconhecido aparece como veio. */
export const PLATFORM_EVENT_LABELS: Record<string, string> = {
  SIGNUP: 'Cadastro',
  EMAIL_VERIFIED: 'E-mail confirmado',
  TRIAL_STARTED: 'Teste iniciado',
  TRIAL_EXTENDED: 'Teste estendido',
  CONVERTED_TO_TRIAL: 'Convertido em teste',
  RELEASED: 'Liberado',
  REVIEWED: 'Revisado',
  SUSPENDED: 'Suspenso',
  REACTIVATED: 'Reativado',
  BLOCKED: 'Bloqueado',
  CANCELED: 'Cancelado',
  CONTACT_UPDATED: 'Dados do escritório alterados',
};
