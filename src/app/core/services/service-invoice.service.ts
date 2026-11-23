import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../models/page.model';
import {
  ServiceInvoiceDetailDTO,
  ServiceInvoiceFilter,
  ServiceInvoiceSummaryDTO,
  ServiceInvoiceTotalsDTO,
} from '../models/service-invoice.model';

@Injectable({ providedIn: 'root' })
export class ServiceInvoiceService {
  private readonly baseUrl = `${environment.apiUrl}/notas-servico`;

  constructor(private readonly http: HttpClient) {}

  search(filter: ServiceInvoiceFilter): Observable<Page<ServiceInvoiceSummaryDTO>> {
    return this.http.post<Page<ServiceInvoiceSummaryDTO>>(`${this.baseUrl}/buscar`, filter);
  }

  totals(filter: ServiceInvoiceFilter): Observable<ServiceInvoiceTotalsDTO> {
    return this.http.post<ServiceInvoiceTotalsDTO>(`${this.baseUrl}/totais`, filter);
  }

  detail(id: string): Observable<ServiceInvoiceDetailDTO> {
    return this.http.get<ServiceInvoiceDetailDTO>(`${this.baseUrl}/${id}`);
  }

  xml(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/xml`, { responseType: 'blob' });
  }

  /** Busca as NFS-e do período no SIEG em segundo plano. */
  fetchFromSieg(companyId: string, inicio: string, fim: string): Observable<{ iniciado: boolean }> {
    const params = new HttpParams().set('companyId', companyId).set('inicio', inicio).set('fim', fim);
    return this.http.post<{ iniciado: boolean }>(`${this.baseUrl}/sincronizar`, {}, { params });
  }
}
