import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ContaAzulAuthorizeUrlDTO, ContaAzulConnectionStatusDTO } from '../models/conta-azul.model';

@Injectable({ providedIn: 'root' })
export class ContaAzulService {
  private readonly baseUrl = `${environment.apiUrl}/integrations/conta-azul`;

  constructor(private readonly http: HttpClient) {}

  status(): Observable<ContaAzulConnectionStatusDTO> {
    return this.http.get<ContaAzulConnectionStatusDTO>(`${this.baseUrl}/status`);
  }

  /** URL de login da Conta Azul (com o state gerado para este escritório). */
  authorizeUrl(): Observable<ContaAzulAuthorizeUrlDTO> {
    return this.http.get<ContaAzulAuthorizeUrlDTO>(`${this.baseUrl}/authorize-url`);
  }

  /** Repassa ao backend o code/state que a Conta Azul devolveu no redirect. */
  completeAuthorization(code: string, state: string): Observable<ContaAzulConnectionStatusDTO> {
    return this.http.post<ContaAzulConnectionStatusDTO>(`${this.baseUrl}/callback`, { code, state });
  }

  disconnect(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/connection`);
  }
}
