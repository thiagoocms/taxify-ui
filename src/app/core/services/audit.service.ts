import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuditReportDTO, AuditRuleDTO } from '../models/audit.model';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly baseUrl = `${environment.apiUrl}/auditoria`;

  constructor(private readonly http: HttpClient) {}

  report(companyId: string, competencia: string): Observable<AuditReportDTO> {
    return this.http.get<AuditReportDTO>(this.baseUrl, { params: this.params(companyId, competencia) });
  }

  run(companyId: string, competencia: string): Observable<AuditReportDTO> {
    return this.http.post<AuditReportDTO>(`${this.baseUrl}/executar`, {}, { params: this.params(companyId, competencia) });
  }

  pdf(companyId: string, competencia: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/laudo.pdf`, { params: this.params(companyId, competencia), responseType: 'blob' });
  }

  csv(companyId: string, competencia: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/laudo.csv`, { params: this.params(companyId, competencia), responseType: 'blob' });
  }

  rules(): Observable<AuditRuleDTO[]> {
    return this.http.get<AuditRuleDTO[]>(`${this.baseUrl}/regras`);
  }

  review(code: string, conferida: boolean): Observable<AuditRuleDTO> {
    return this.http.post<AuditRuleDTO>(`${this.baseUrl}/regras/${code}/conferencia`, {}, {
      params: new HttpParams().set('conferida', conferida),
    });
  }

  enable(code: string, ativa: boolean): Observable<AuditRuleDTO> {
    return this.http.post<AuditRuleDTO>(`${this.baseUrl}/regras/${code}/ativa`, {}, { params: new HttpParams().set('ativa', ativa) });
  }

  private params(companyId: string, competencia: string): HttpParams {
    return new HttpParams().set('companyId', companyId).set('competencia', competencia);
  }
}
