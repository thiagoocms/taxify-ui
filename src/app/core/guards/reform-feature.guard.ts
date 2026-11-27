import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { ReformFeaturesService } from '../services/reform-features.service';

/**
 * Crédito de estoque só com o recurso ligado no ambiente (`stockCredit.enabled` de `GET /reform/features`). Desligado
 * ou sem resposta: volta para o início (o menu já esconde o item; o backend responde 404 de qualquer jeito).
 */
export const stockCreditGuard: CanActivateFn = () => {
  const features = inject(ReformFeaturesService);
  const router = inject(Router);
  return features
    .ensureLoaded()
    .pipe(map((loaded) => (loaded?.stockCredit?.enabled === true ? true : router.createUrlTree(['/home']))));
};
