import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { FirmAccessService } from '../services/firm-access.service';

/**
 * Console da plataforma: só o admin da plataforma (CS Hub). A fonte é o `platformAdmin` de `GET /firm-access`;
 * sem ele, volta para o início. O backend também recusa (403) - o guard só evita abrir uma tela vazia.
 */
export const platformAdminGuard: CanActivateFn = () => {
  const firmAccess = inject(FirmAccessService);
  const router = inject(Router);
  return firmAccess
    .ensureLoaded()
    .pipe(map((access) => (access?.platformAdmin ? true : router.createUrlTree(['/home']))));
};
