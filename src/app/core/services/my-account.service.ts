import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { defer, finalize, Observable, tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PasswordChangeRequestDTO, PasswordChangeResponseDTO } from '../models/password.model';
import {
  NotificationSettingsDTO,
  NotificationSettingsUpdateDTO,
} from '../models/notification-settings.model';
import { AuthService } from './auth.service';

/** Tempo máximo do PUT da troca de senha. */
export const PASSWORD_CHANGE_TIMEOUT_MS = 30_000;

/** "Minha conta" do usuário logado (`/users/me/*`): troca da própria senha e avisos por e-mail. */
@Injectable({ providedIn: 'root' })
export class MyAccountService {
  private readonly baseUrl = `${environment.apiUrl}/users/me`;

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
  ) {}

  /**
   * Troca a própria senha. O backend derruba as outras sessões e devolve um JWT novo para esta: ele substitui o
   * token salvo antes de qualquer outra chamada (a próxima com o token antigo daria 401).
   * Enquanto o PUT está no ar, o interceptor segura os 401 das outras chamadas (podem ser do token antigo) e só
   * decide quando ele termina. Sem resposta em 30 s, a chamada é cancelada (`TimeoutError`) e a espera acaba: os 401
   * segurados não ficam presos.
   */
  changePassword(currentPassword: string, newPassword: string): Observable<PasswordChangeResponseDTO> {
    const body: PasswordChangeRequestDTO = { currentPassword, newPassword };
    return defer(() => {
      this.authService.beginPasswordChange();
      return this.http.put<PasswordChangeResponseDTO>(`${this.baseUrl}/password`, body).pipe(
        timeout(PASSWORD_CHANGE_TIMEOUT_MS),
        tap((response) => this.authService.replaceToken(response.token)),
        finalize(() => this.authService.endPasswordChange()),
      );
    });
  }

  getNotificationSettings(): Observable<NotificationSettingsDTO> {
    return this.http.get<NotificationSettingsDTO>(`${this.baseUrl}/notification-settings`);
  }

  setPendencyHighDigest(enabled: boolean): Observable<NotificationSettingsDTO> {
    const body: NotificationSettingsUpdateDTO = { pendencyHighDigest: enabled };
    return this.http.put<NotificationSettingsDTO>(`${this.baseUrl}/notification-settings`, body);
  }
}
