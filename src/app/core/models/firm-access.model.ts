/**
 * Situação de acesso do escritório (spec 2026-11-26 taxify-saas, F1-RN-07 a F1-RN-10a e F1-RN-16).
 * Contrato de `GET /firm-access`. Datas `LocalDate` chegam como "aaaa-mm-dd" e são só formatadas na tela.
 */
export type FirmAccessStatus =
  | 'PENDING_VERIFICATION'
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'BLOCKED'
  | 'SUSPENDED'
  | 'CANCELED';

export type FirmBlockedReason = 'TRIAL_EXPIRED' | 'ACCESS_EXPIRED' | 'NON_PAYMENT' | 'MANUAL';

/** Uso × limite do teste grátis; nulo fora do teste (sem limite). */
export interface FirmPlanLimitsDTO {
  planName: string;
  maxCompanies: number;
  companiesInUse: number;
  maxUsers: number;
  usersInUse: number;
}

export interface FirmAccessDTO {
  status: FirmAccessStatus;
  exempt: boolean;
  /** true = somente leitura: faixa de bloqueio e botões de escrita desabilitados. */
  readOnly: boolean;
  reason: FirmBlockedReason | null;
  blockedSince: string | null;
  trialEndsOn: string | null;
  accessUntil: string | null;
  /** No teste: "faltam X dias"; 1 = "Seu teste termina hoje". Calculado pelo backend. */
  trialDaysLeft: number | null;
  /** No bloqueio: há quantos dias as capturas automáticas estão paradas. */
  capturesStoppedDays: number | null;
  sefazRetentionDays: number;
  limits: FirmPlanLimitsDTO | null;
  platformAdmin: boolean;
  /**
   * Painel da captura da plataforma ligado no ambiente e usuário admin da plataforma
   * (`TAXIFY_CAPTURE_PANEL_PLATFORM_ENABLED`): mostra o item "Captura (plataforma)" no menu.
   */
  capturePanelPlatformEnabled: boolean;
}

/** Texto dos botões de escrita desabilitados com o escritório em somente leitura (F1-RN-08). */
export const READ_ONLY_HINT =
  'Somente leitura: o escritório está bloqueado. Dá para ver e exportar, mas não cadastrar nem editar.';

export const FIRM_STATUS_LABELS: Record<FirmAccessStatus, string> = {
  PENDING_VERIFICATION: 'Aguardando e-mail',
  TRIAL: 'Teste grátis',
  ACTIVE: 'Liberado',
  PAST_DUE: 'Pagamento em atraso',
  BLOCKED: 'Bloqueado',
  SUSPENDED: 'Suspenso',
  CANCELED: 'Cancelado',
};

export const FIRM_REASON_LABELS: Record<FirmBlockedReason, string> = {
  TRIAL_EXPIRED: 'teste grátis encerrado',
  ACCESS_EXPIRED: 'prazo de acesso encerrado',
  NON_PAYMENT: 'pagamento em aberto',
  MANUAL: 'decisão da CS Hub',
};
