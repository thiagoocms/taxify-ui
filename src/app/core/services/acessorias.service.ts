import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AcessoriasImportResultDTO, AcessoriasUserSummaryDTO } from '../models/acessorias.model';

@Injectable({ providedIn: 'root' })
export class AcessoriasService {
  private readonly baseUrl = `${environment.apiUrl}/integrations/acessorias`;

  constructor(private readonly http: HttpClient) {}

  /** Importa (cria/atualiza) as empresas do escritório a partir do Acessórias e vincula os responsáveis. */
  importCompanies(): Observable<AcessoriasImportResultDTO> {
    return this.http.post<AcessoriasImportResultDTO>(`${this.baseUrl}/import`, {});
  }

  /** Usuários do Acessórias do escritório, indicando quais já existem no Taxify (por e-mail). */
  listUsers(): Observable<AcessoriasUserSummaryDTO[]> {
    return this.http.get<AcessoriasUserSummaryDTO[]>(`${this.baseUrl}/users`);
  }
}
