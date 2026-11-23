import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../models/page.model';
import { IntegrationHealthDTO, PendencyDTO, PendencyFilter, PendencySummaryDTO } from '../models/pendency.model';

@Injectable({ providedIn: 'root' })
export class PendencyService {
  private readonly baseUrl = `${environment.apiUrl}/pendencias`;

  constructor(private readonly http: HttpClient) {}

  list(filter: PendencyFilter): Observable<Page<PendencyDTO>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<Page<PendencyDTO>>(this.baseUrl, { params });
  }

  summary(companyId?: string): Observable<PendencySummaryDTO> {
    return this.http.get<PendencySummaryDTO>(`${this.baseUrl}/resumo`, { params: this.companyParam(companyId) });
  }

  health(companyId?: string): Observable<IntegrationHealthDTO[]> {
    return this.http.get<IntegrationHealthDTO[]>(`${this.baseUrl}/integracoes`, { params: this.companyParam(companyId) });
  }

  resolve(id: string, comentario: string): Observable<PendencyDTO> {
    return this.http.post<PendencyDTO>(`${this.baseUrl}/${id}/resolver`, { comentario });
  }

  dismiss(id: string, comentario: string): Observable<PendencyDTO> {
    return this.http.post<PendencyDTO>(`${this.baseUrl}/${id}/desconsiderar`, { comentario });
  }

  reopen(id: string): Observable<PendencyDTO> {
    return this.http.post<PendencyDTO>(`${this.baseUrl}/${id}/reabrir`, {});
  }

  /** Recalcula agora: a empresa na hora, ou a carteira toda em segundo plano. */
  refresh(companyId?: string): Observable<{ abertas?: number; emSegundoPlano: boolean }> {
    return this.http.post<{ abertas?: number; emSegundoPlano: boolean }>(`${this.baseUrl}/atualizar`, {}, {
      params: this.companyParam(companyId),
    });
  }

  private companyParam(companyId?: string): HttpParams {
    return companyId ? new HttpParams().set('companyId', companyId) : new HttpParams();
  }
}
