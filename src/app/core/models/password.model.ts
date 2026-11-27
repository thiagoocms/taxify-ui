/**
 * Contratos de senha (spec 2026-11-27 senha-e-avisos-de-pendencia, SN-RN-01 a SN-RN-14).
 * Rotas anônimas em `/auth/password/*`; a troca pelo usuário logado em `PUT /users/me/password`.
 */

/** `GET /auth/password/config`: com `available = false`, o login mantém o "peça ao administrador". */
export interface PasswordConfigDTO {
  available: boolean;
  /** Validade do link de redefinição, em minutos. */
  resetMinutes: number;
  /** Tamanho mínimo da senha nova (caracteres). */
  minLength: number;
}

/** `POST /auth/password/forgot`: login ou e-mail. Sempre 202 sem corpo (não revela se a conta existe). */
export interface PasswordForgotRequestDTO {
  identifier: string;
}

/** `POST /auth/password/reset/check`: 204 ou 400 `error.password.reset.token.invalid`. Não consome o token. */
export interface PasswordResetCheckRequestDTO {
  token: string;
}

/** `POST /auth/password/reset`: 204; 400 do token ou da regra de senha (o token só é consumido no sucesso). */
export interface PasswordResetRequestDTO {
  token: string;
  newPassword: string;
}

/** `PUT /users/me/password`. */
export interface PasswordChangeRequestDTO {
  currentPassword: string;
  newPassword: string;
}

/** 200 da troca: JWT novo para a sessão atual continuar (as outras sessões caem). */
export interface PasswordChangeResponseDTO {
  token: string;
}

export const PASSWORD_ERRORS = {
  /** 503: "Esqueci a senha" desligado (`TAXIFY_PASSWORD_RESET_ENABLED=false`). */
  resetUnavailable: 'error.password.reset.unavailable',
  /** 400: link desconhecido, usado, invalidado, vencido ou de conta excluída. */
  resetTokenInvalid: 'error.password.reset.token.invalid',
} as const;

export const AUTH_ERRORS = {
  /** 401: sessão revogada (senha trocada, usuário excluído) ou `sv` do token diferente do banco. */
  sessionExpired: 'error.auth.session.expired',
} as const;

/** Mínimo da spec (P-SN-04), enquanto a config não chega ou se ela falhar. */
export const PASSWORD_DEFAULT_MIN_LENGTH = 8;

/** Validade padrão do link (P-SN-01), enquanto a config não chega. */
export const PASSWORD_DEFAULT_RESET_MINUTES = 60;

export const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Entre de novo.';

export const PASSWORD_CHANGED_LOGIN_NOTICE = 'Senha alterada. Entre com a nova senha.';

/** Aviso que a redefinição deixa para o login (estado da navegação, não a URL). */
export const LOGIN_NOTICE_PASSWORD_CHANGED = 'password-changed';
