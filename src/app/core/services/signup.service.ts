import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SignupConfigDTO,
  SignupRequestDTO,
  SignupResponseDTO,
  SignupVerifyResponseDTO,
} from '../models/signup.model';

/** Cadastro público do escritório (anônimo): config, cadastro, verificação do e-mail e reenvio do link. */
@Injectable({ providedIn: 'root' })
export class SignupService {
  private readonly baseUrl = `${environment.apiUrl}/signup`;

  constructor(private readonly http: HttpClient) {}

  getConfig(): Observable<SignupConfigDTO> {
    return this.http.get<SignupConfigDTO>(`${this.baseUrl}/config`);
  }

  create(request: SignupRequestDTO): Observable<SignupResponseDTO> {
    return this.http.post<SignupResponseDTO>(this.baseUrl, request);
  }

  verify(token: string): Observable<SignupVerifyResponseDTO> {
    return this.http.post<SignupVerifyResponseDTO>(`${this.baseUrl}/verify`, { token });
  }

  /** Sempre 202, exista ou não o login (não revela contas). */
  resend(login: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/resend`, { login });
  }
}
