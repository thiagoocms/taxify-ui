import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AcessoriasImportResultDTO, AcessoriasUserSummaryDTO } from '../models/acessorias.model';
import { SyncJobStatusDTO } from '../models/sync-job.model';

@Injectable({ providedIn: 'root' })
export class AcessoriasService {
  private readonly baseUrl = `${environment.apiUrl}/integrations/acessorias`;

  constructor(private readonly http: HttpClient) {}

  /**
   * Dispara em segundo plano a importação (cria/atualiza) das empresas do escritório a partir
   * do Acessórias, vinculando os responsáveis; acompanhe com {@link importStatus}.
   */
  startImport(): Observable<SyncJobStatusDTO<AcessoriasImportResultDTO>> {
    return this.http.post<SyncJobStatusDTO<AcessoriasImportResultDTO>>(`${this.baseUrl}/import`, {});
  }

  importStatus(): Observable<SyncJobStatusDTO<AcessoriasImportResultDTO>> {
    return this.http.get<SyncJobStatusDTO<AcessoriasImportResultDTO>>(`${this.baseUrl}/import`);
  }

  /** Usuários do Acessórias do escritório, indicando quais já existem no Taxify (por e-mail). */
  listUsers(): Observable<AcessoriasUserSummaryDTO[]> {
    return this.http.get<AcessoriasUserSummaryDTO[]>(`${this.baseUrl}/users`);
  }
}
