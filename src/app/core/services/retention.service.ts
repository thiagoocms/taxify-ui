import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RetentionScreenDTO } from '../models/retention.model';

export interface RetentionQuery {
  companyId?: string;
  competencia?: string;
  natureza?: string;
  busca?: string;
}

@Injectable({ providedIn: 'root' })
export class RetentionService {
  private readonly baseUrl = `${environment.apiUrl}/retencoes`;

  constructor(private readonly http: HttpClient) {}

  screen(query: RetentionQuery): Observable<RetentionScreenDTO> {
    return this.http.get<RetentionScreenDTO>(this.baseUrl, { params: this.params(query) });
  }

  csv(query: RetentionQuery): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/csv`, { params: this.params(query), responseType: 'blob' });
  }

  review(keys: string[], reviewed: boolean, companyId?: string): Observable<number> {
    return this.http.post<number>(`${this.baseUrl}/conferencia`, { companyId, keys, reviewed });
  }

  private params(query: RetentionQuery): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) {
        params = params.set(key, value);
      }
    }
    return params;
  }
}
