/**
 * Comunicação entre a janela pop-up do login da Conta Azul e a aba que a abriu.
 * Usa BroadcastChannel (mesma origem) em vez de window.opener: a página de login da
 * Conta Azul pode cortar o vínculo com a aba de origem (Cross-Origin-Opener-Policy).
 */
export const CONTA_AZUL_CHANNEL = 'taxify-conta-azul';
export const CONTA_AZUL_POPUP_NAME = 'taxify-conta-azul-login';

export type ContaAzulPopupMessage =
  | { type: 'result'; ok: boolean; message?: string }
  | { type: 'ack' };

/** Abre a janela centralizada sobre a aba atual. Precisa ser chamada direto no clique (senão o navegador bloqueia). */
export function openContaAzulPopup(): Window | null {
  const width = 520;
  const height = 720;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
  return window.open('', CONTA_AZUL_POPUP_NAME, `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
}
