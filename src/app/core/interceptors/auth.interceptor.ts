import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

interface ErrorDescription {
  title: string;
  message: string;
}

/** Generic, status-based fallback used whenever the API doesn't send its own message. */
function describeError(status: number): ErrorDescription {
  switch (status) {
    case 400:
      return { title: 'Requisição inválida', message: 'Os dados enviados são inválidos.' };
    case 401:
      return { title: 'Não autorizado', message: 'Você precisa estar autenticado para continuar.' };
    case 403:
      return { title: 'Acesso negado', message: 'Você não tem permissão para executar esta ação.' };
    case 404:
      return { title: 'Não encontrado', message: 'O recurso solicitado não foi encontrado.' };
    case 409:
      return { title: 'Conflito', message: 'Já existe um registro com esses dados.' };
    case 422:
      return { title: 'Dados inválidos', message: 'Verifique os dados informados e tente novamente.' };
    case 429:
      return { title: 'Muitas requisições', message: 'Aguarde um momento antes de tentar novamente.' };
    default:
      return { title: 'Erro no servidor', message: 'Ocorreu um erro inesperado no servidor. Tente novamente mais tarde.' };
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastr = inject(ToastrService);

  const token = authService.token;
  const authorizedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authorizedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isLoginAttempt = req.url.endsWith('/auth');

      if (error.status === 401 && isLoginAttempt) {
        toastr.warning('Login ou senha inválidos.', 'Falha no login');
        return throwError(() => error);
      }

      if (error.status === 401) {
        toastr.warning('Sua sessão expirou. Faça login novamente.', 'Sessão expirada');
        authService.logout();
        router.navigate(['/login']);
        return throwError(() => error);
      }

      if (error.status === 0) {
        toastr.error('Não foi possível conectar ao servidor. Verifique sua conexão.', 'Erro de conexão');
        return throwError(() => error);
      }

      const apiMessage: string | undefined =
        typeof error.error?.message === 'string' ? error.error.message : undefined;
      const { title, message } = describeError(error.status);

      // Family-based severity: 4xx are treated as warnings (the request itself
      // was rejected — bad input, not found, conflict...), 5xx as hard errors
      // (something broke on the server side).
      const isClientError = error.status >= 400 && error.status < 500;
      if (isClientError) {
        toastr.warning(apiMessage ?? message, title);
      } else {
        toastr.error(apiMessage ?? message, title);
      }

      return throwError(() => error);
    }),
  );
};
