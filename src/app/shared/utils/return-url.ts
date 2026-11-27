/**
 * Tela para onde voltar depois do login (authGuard e sessão vencida). Só caminhos internos da aplicação.
 */

/** Rotas que nunca viram `returnUrl`: as de `/auth` e o retorno do OAuth da Conta Azul (a query leva o `code`). */
const NOT_RETURNABLE = [/^\/auth(\/|\?|$)/, /^\/integracoes\/conta-azul\/callback(\/|\?|#|$)/];

/**
 * A URL atual vale ser guardada para voltar depois do login? Devolve a própria URL ou `undefined` (raiz, telas de
 * `/auth` e o callback do OAuth, cujo `?code=` não pode ficar na barra de endereços nem ser reaproveitado).
 */
export function returnUrlToKeep(url: string | null | undefined): string | undefined {
  if (!url || url === '/' || NOT_RETURNABLE.some((pattern) => pattern.test(url))) {
    return undefined;
  }
  return url;
}

/**
 * Destino seguro depois do login: só caminho interno (começa com uma `/`, sem `//` nem `\`, que o navegador trataria
 * como outro site) e fora das rotas que não voltam. Qualquer outro valor vira `/home`.
 */
export function safeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/home';
  }
  return returnUrlToKeep(value) ?? '/home';
}
