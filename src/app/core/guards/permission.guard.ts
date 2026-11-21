import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Permission } from '../models/access.model';
import { AuthService } from '../services/auth.service';

/**
 * Rota liberada só para quem tem a permissão (ou é ADMIN). Sem ela, volta para o início -
 * o menu já esconde o link, isto cobre quem digita a URL direto.
 */
export function permissionGuard(permission: Permission): CanActivateFn {
  return () => {
    if (inject(AuthService).can(permission)) {
      return true;
    }
    return inject(Router).createUrlTree(['/home']);
  };
}

/** Rota só de administrador (usuários, dados do escritório). */
export const adminGuard: CanActivateFn = () =>
  inject(AuthService).isAdmin ? true : inject(Router).createUrlTree(['/home']);
