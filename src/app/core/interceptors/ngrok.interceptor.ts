import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Ngrok free tier serves an HTML interstitial warning page to browser
 * requests that lack this header, which breaks JSON responses (and CORS,
 * since the interstitial doesn't carry the API's CORS headers).
 */
export const ngrokInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req.clone({ setHeaders: { 'ngrok-skip-browser-warning': 'true' } }));
};
