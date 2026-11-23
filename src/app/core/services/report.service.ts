import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AbcDTO, MonthlyReportDTO, SimulationDTO } from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly baseUrl = `${environment.apiUrl}/relatorios`;

  constructor(private readonly http: HttpClient) {}

  monthly(companyId: string, competencia: string): Observable<MonthlyReportDTO> {
    return this.http.get<MonthlyReportDTO>(`${this.baseUrl}/mensal`, { params: { companyId, competencia } });
  }

  monthlyPdf(companyId: string, competencia: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/mensal.pdf`, { params: { companyId, competencia }, responseType: 'blob' });
  }

  abc(companyId: string, competencia: string, por: 'PRODUTO' | 'FORNECEDOR', meses: number): Observable<AbcDTO> {
    return this.http.get<AbcDTO>(`${this.baseUrl}/curva-abc`, { params: { companyId, competencia, por, meses } });
  }

  simulate(companyId: string, competencia: string, margem: number, iss: number): Observable<SimulationDTO> {
    const params = new HttpParams().set('companyId', companyId).set('competencia', competencia).set('margem', margem).set('iss', iss);
    return this.http.get<SimulationDTO>(`${this.baseUrl}/simulacao`, { params });
  }
}
