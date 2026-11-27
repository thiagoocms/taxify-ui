import { HttpErrorResponse } from '@angular/common/http';
import { FirmAccessStatus, FirmBlockedReason } from './firm-access.model';

/**
 * Corpo de erro da API: `{timestamp, status, code, message, details}` em todo 4xx/5xx. A tela decide pelo `code`;
 * a `message` é o texto pronto para o usuário (fallback genérico quando o `code` não é tratado).
 */
export interface ApiErrorBody {
  timestamp?: string;
  /** Status HTTP (também no 403 de escrita bloqueada; a situação do escritório vem em `firmStatus`). */
  status?: number;
  code?: string;
  message?: string;
  details?: string;
  [extra: string]: unknown;
}

/** 403 `error.firm.access.blocked`: escrita recusada com o escritório em somente leitura. */
export interface FirmAccessBlockedBody extends ApiErrorBody {
  code: 'error.firm.access.blocked';
  firmStatus: Extract<FirmAccessStatus, 'BLOCKED' | 'SUSPENDED' | 'CANCELED'>;
  reason: FirmBlockedReason | null;
  blockedSince: string | null;
}

/** 409 de limite do teste (`error.plan.limit.companies` / `error.plan.limit.users`). */
export interface PlanLimitBody extends ApiErrorBody {
  code: 'error.plan.limit.companies' | 'error.plan.limit.users';
  kind: 'COMPANY' | 'USER';
  limit: number;
  inUse: number;
  planName: string;
}

export const FIRM_ACCESS_BLOCKED = 'error.firm.access.blocked';
export const PLAN_LIMIT_COMPANIES = 'error.plan.limit.companies';
export const PLAN_LIMIT_USERS = 'error.plan.limit.users';
export const PLAN_LIMIT_BUSY = 'error.plan.limit.busy';

export function apiErrorBody(error: unknown): ApiErrorBody | null {
  if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
    return error.error as ApiErrorBody;
  }
  return null;
}

export function apiErrorCode(error: unknown): string | null {
  const code = apiErrorBody(error)?.code;
  return typeof code === 'string' ? code : null;
}

export function apiErrorMessage(error: unknown): string | null {
  const message = apiErrorBody(error)?.message;
  return typeof message === 'string' && message.trim() ? message : null;
}

export function httpStatusOf(error: unknown): number {
  return error instanceof HttpErrorResponse ? error.status : -1;
}

/**
 * Nome do plano no meio da frase: "Teste grátis" vira "teste grátis" ("O teste grátis permite..."). Só a primeira
 * letra muda; sem nome, "teste grátis".
 */
export function planNameInSentence(planName?: string | null): string {
  const name = planName?.trim();
  return name ? name.charAt(0).toLocaleLowerCase('pt-BR') + name.slice(1) : 'teste grátis';
}

/**
 * Frase da spec (F1-RN-10a): "O teste grátis permite {limite} empresas e o escritório já tem {emUso}. Fale com a
 * CS Hub para contratar." - no toast do 409 e, com uma observação a mais, no aviso das listas.
 */
export function planLimitSentence(
  kind: 'COMPANY' | 'USER',
  planName: string | null | undefined,
  limit: number | string,
  inUse: number | string,
): string {
  const what = kind === 'USER' ? 'usuários' : 'empresas';
  return `O ${planNameInSentence(planName)} permite ${limit} ${what} e o escritório já tem ${inUse}. Fale com a CS Hub para contratar.`;
}

/** Mensagem do 409 de limite: a da API ou, sem ela, montada com os números que vieram no corpo. */
export function planLimitMessage(body: Partial<PlanLimitBody>): string {
  if (typeof body.message === 'string' && body.message.trim()) {
    return body.message;
  }
  const kind = body.kind === 'USER' || body.code === PLAN_LIMIT_USERS ? 'USER' : 'COMPANY';
  return planLimitSentence(kind, body.planName, body.limit ?? '?', body.inUse ?? '?');
}
