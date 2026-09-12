import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { InvoiceAuditLogDTO, InvoiceAuditLogFilterDTO } from '../models/invoice-audit-log.model';
import { Page, Pageable } from '../models/page.model';
import { buildParams } from './user.service';

@Injectable({ providedIn: 'root' })
export class InvoiceAuditLogService {
  private readonly baseUrl = `${environment.apiUrl}/invoice-audit-log`;

  constructor(private readonly http: HttpClient) {}

  getAll(pageable: Pageable, filter: InvoiceAuditLogFilterDTO = {}): Observable<Page<InvoiceAuditLogDTO>> {
    const params = buildParams(pageable, filter);
    return this.http.get<Page<InvoiceAuditLogDTO>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<InvoiceAuditLogDTO> {
    return this.http.get<InvoiceAuditLogDTO>(`${this.baseUrl}/${id}`);
  }

  create(log: InvoiceAuditLogDTO): Observable<InvoiceAuditLogDTO> {
    return this.http.post<InvoiceAuditLogDTO>(this.baseUrl, log);
  }

  update(id: string, log: InvoiceAuditLogDTO): Observable<InvoiceAuditLogDTO> {
    return this.http.put<InvoiceAuditLogDTO>(`${this.baseUrl}/${id}`, log);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
