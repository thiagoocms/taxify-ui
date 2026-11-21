import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withNavigationErrorHandler, withViewTransitions } from '@angular/router';
import { provideToastr } from 'ngx-toastr';

import { authInterceptor } from './core/interceptors/auth.interceptor';
import { ngrokInterceptor } from './core/interceptors/ngrok.interceptor';
import { routes } from './app.routes';

const CHUNK_RELOAD_KEY = 'taxify:chunk-reload';

/**
 * Depois de um deploy, uma aba aberta ainda pede os chunks da versão anterior, que não
 * existem mais. Recarrega a página uma vez (pega o index.html novo); o flag evita loop
 * se o erro continuar por outro motivo.
 */
function reloadOnStaleChunk(error: { error?: unknown }): void {
  const message = String((error.error as Error | undefined)?.message ?? error.error ?? '');
  const staleChunk = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
  if (!staleChunk) {
    return;
  }
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    return;
  }
  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  window.location.reload();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withViewTransitions(), withNavigationErrorHandler(reloadOnStaleChunk)),
    provideHttpClient(withInterceptors([ngrokInterceptor, authInterceptor])),
    provideAnimations(),
    provideToastr({
      timeOut: 5000,
      positionClass: 'toast-top-right',
      preventDuplicates: true,
      closeButton: true,
    }),
  ],
};
