/**
 * Avisos por e-mail do próprio usuário (spec 2026-11-27, AV-RN-08): `GET/PUT /users/me/notification-settings`.
 */

export interface PendencyHighDigestSettingDTO {
  /** Liga ou desliga o resumo diário (sem registro, vale o padrão do servidor). */
  enabled: boolean;
  /** `false` quando o usuário não tem `INVOICES_VIEW`: a chave fica desabilitada, com o motivo. */
  eligible: boolean;
}

/** Resposta do GET e do PUT. */
export interface NotificationSettingsDTO {
  pendencyHighDigest: PendencyHighDigestSettingDTO;
}

/** Corpo do PUT. */
export interface NotificationSettingsUpdateDTO {
  pendencyHighDigest: boolean;
}
