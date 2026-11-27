import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { returnUrlToKeep } from '../../shared/utils/return-url';

/**
 * Só entra com sessão. Sem ela, vai para o login levando a tela pedida em `returnUrl` (ex.: o link do e-mail para
 * `/pendencias?severidade=ALTA&status=ABERTA` ou `/minha-conta`); depois do login a pessoa volta para ela. O
 * callback do OAuth da Conta Azul não é guardado (a query leva o `code`).
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  const returnUrl = returnUrlToKeep(state?.url);
  return router.createUrlTree(['/auth/login'], { queryParams: returnUrl ? { returnUrl } : undefined });
};
