import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PasswordConfigDTO,
  PasswordForgotRequestDTO,
  PasswordResetCheckRequestDTO,
  PasswordResetRequestDTO,
} from '../models/password.model';

/**
 * "Esqueci a senha" (anônimo): config, pedido do link, conferência do link e definição da senha nova.
 * O interceptor não manda o token de sessão para estas rotas (um token velho no navegador não pode atrapalhar).
 */
@Injectable({ providedIn: 'root' })
export class PasswordService {
  private readonly baseUrl = `${environment.apiUrl}/auth/password`;

  /** A config muda só com deploy: uma leitura por carga da página (refeita se falhar). */
  private readonly config$: Observable<PasswordConfigDTO>;

  constructor(private readonly http: HttpClient) {
    this.config$ = this.http
      .get<PasswordConfigDTO>(`${this.baseUrl}/config`)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
  }

  getConfig(): Observable<PasswordConfigDTO> {
    return this.config$;
  }

  /** Sempre 202, exista ou não a conta; 503 com a feature desligada. */
  forgot(identifier: string): Observable<void> {
    const body: PasswordForgotRequestDTO = { identifier };
    return this.http.post<void>(`${this.baseUrl}/forgot`, body);
  }

  /** 204 se o link ainda vale; 400 `error.password.reset.token.invalid` senão. Não consome o link. */
  checkResetToken(token: string): Observable<void> {
    const body: PasswordResetCheckRequestDTO = { token };
    return this.http.post<void>(`${this.baseUrl}/reset/check`, body);
  }

  reset(token: string, newPassword: string): Observable<void> {
    const body: PasswordResetRequestDTO = { token, newPassword };
    return this.http.post<void>(`${this.baseUrl}/reset`, body);
  }
}
