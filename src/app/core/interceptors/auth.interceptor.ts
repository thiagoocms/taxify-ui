import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { catchError, Observable, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { FirmAccessService } from '../services/firm-access.service';
import {
  FIRM_ACCESS_BLOCKED,
  FirmAccessBlockedBody,
  PLAN_LIMIT_BUSY,
  PLAN_LIMIT_COMPANIES,
  PLAN_LIMIT_USERS,
  PlanLimitBody,
  planLimitMessage,
} from '../models/api-error.model';
import { AUTH_ERRORS, SESSION_EXPIRED_MESSAGE } from '../models/password.model';
import { SIGNUP_ERRORS } from '../models/signup.model';
import { USER_ERRORS } from '../models/user.model';
import { returnUrlToKeep } from '../../shared/utils/return-url';

/** Telas que mostram o erro perto do formulário: o toast seria repetido. */
const INLINE_ERROR_URLS = [
  /\/signup(\/|$)/,
  /\/platform\/firms\/[^/]+\/(access\/|contact$)/,
  // "Esqueci a senha", redefinição pelo link e Minha conta (troca de senha e avisos por e-mail).
  /\/auth\/password\//,
  /\/users\/me\/(password|notification-settings)$/,
  // Painel de captura (escritório e plataforma): a tela explica cada erro (404 da plataforma = visão desligada;
  // recusas do "Sincronizar agora" com o limite e a hora para tentar de novo).
  /\/capture-panel(\/|$)/,
];
/** Troca da própria senha: o PUT que devolve o token novo. */
const PASSWORD_CHANGE_URL = /\/users\/me\/password$/;
/** Rotas anônimas de senha: vão sem o token (um token velho no navegador não pode derrubar o pedido com 401). */
const ANONYMOUS_URLS = [/\/auth\/password\//];
/** Erros de campo do formulário de usuário (POST/PUT /users): a tela marca o campo. */
const USERS_URL = /\/users(\/[^/]+)?$/;
const USER_FIELD_ERROR_CODES = new Set<string>(Object.values(USER_ERRORS));
/** Consulta de fundo (faixas da tela): falhar não deve encher a tela de toasts. */
const SILENT_URLS = [/\/firm-access$/];

const BLOCKED_DEFAULT_MESSAGE =
  'O escritório está em somente leitura: dá para ver e exportar, mas não cadastrar nem editar. Fale com a CS Hub.';

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
  const firmAccess = inject(FirmAccessService);

  const anonymous = ANONYMOUS_URLS.some((pattern) => pattern.test(req.url.split('?')[0]));
  const token = anonymous ? null : authService.token;
  const authorizedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  const isPasswordChange = PASSWORD_CHANGE_URL.test(req.url.split('?')[0]);

  /**
   * 401 fora do login: a sessão venceu ou foi revogada (senha trocada em outro navegador, usuário excluído:
   * `error.auth.session.expired`). Desloga e volta ao login, que mostra o aviso e depois traz de volta para a tela.
   * - Token trocado enquanto esta chamada estava no ar (troca da própria senha): o 401 é do token antigo e a sessão
   *   atual continua.
   * - Troca da própria senha ainda no ar: espera ela terminar e decide de novo (deu certo = token novo, ignora).
   * - Só o primeiro 401 age até o próximo login: sem toasts e navegações repetidos quando várias chamadas caem juntas.
   */
  const endSession = (error: HttpErrorResponse): Observable<never> => {
    if (token && authService.token && authService.token !== token) {
      return throwError(() => error);
    }
    if (authService.passwordChangeInFlight && !isPasswordChange) {
      return authService.passwordChangeSettled$.pipe(
        take(1),
        switchMap(() => endSession(error)),
      );
    }
    if (!authService.claimSessionEnd()) {
      return throwError(() => error);
    }
    toastr.warning(SESSION_EXPIRED_MESSAGE, 'Sessão expirada');
    const returnUrl = returnUrlToKeep(router.url);
    authService.logout();
    router.navigate(['/auth/login'], {
      queryParams: returnUrl ? { returnUrl } : undefined,
      state: { notice: AUTH_ERRORS.sessionExpired },
    });
    return throwError(() => error);
  };

  return next(authorizedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isLoginAttempt = req.url.endsWith('/auth');
      const path = req.url.split('?')[0];
      const code = typeof error.error?.code === 'string' ? (error.error.code as string) : null;

      // Sessão vencida volta ao login também nas consultas de fundo e nas telas que tratam o erro sozinhas
      // (antes de qualquer retorno antecipado); o resto dessas URLs a própria tela trata.
      const silent = SILENT_URLS.some((pattern) => pattern.test(path));
      const inline =
        INLINE_ERROR_URLS.some((pattern) => pattern.test(path)) ||
        (USERS_URL.test(path) && !!code && USER_FIELD_ERROR_CODES.has(code));
      if ((silent || inline) && error.status === 401 && token && !isLoginAttempt) {
        return endSession(error);
      }
      if (silent || inline) {
        return throwError(() => error);
      }

      // Login antes de confirmar o e-mail: a tela de login explica e oferece "Reenviar e-mail".
      if (isLoginAttempt && code === SIGNUP_ERRORS.emailNotVerified) {
        return throwError(() => error);
      }

      // Escrita com o escritório em somente leitura (a situação do escritório vem em firmStatus).
      if (error.status === 403 && code === FIRM_ACCESS_BLOCKED) {
        const body = error.error as FirmAccessBlockedBody;
        toastr.warning(body.message || BLOCKED_DEFAULT_MESSAGE, 'Somente leitura');
        firmAccess.reload();
        return throwError(() => error);
      }

      // Limite do teste grátis: a mensagem com o limite e o uso; atualiza a faixa e os botões.
      if (error.status === 409 && (code === PLAN_LIMIT_COMPANIES || code === PLAN_LIMIT_USERS)) {
        toastr.warning(planLimitMessage(error.error as PlanLimitBody), 'Limite do teste grátis');
        firmAccess.reload();
        return throwError(() => error);
      }

      if (error.status === 409 && code === PLAN_LIMIT_BUSY) {
        toastr.warning(
          'Outra gravação do escritório está em andamento (por exemplo, a importação do Acessórias). Tente de novo em instantes.',
          'Tente de novo',
        );
        return throwError(() => error);
      }

      if (error.status === 401 && isLoginAttempt) {
        toastr.warning('Login ou senha inválidos.', 'Falha no login');
        return throwError(() => error);
      }

      if (error.status === 401) {
        return endSession(error);
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
