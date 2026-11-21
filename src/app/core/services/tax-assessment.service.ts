import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GuideUpdateDTO, TaxAssessmentDTO } from '../models/tax-assessment.model';

/** Apuração do período: faturamento, RBT12 e estimativa de impostos a partir das notas. */
@Injectable({ providedIn: 'root' })
export class TaxAssessmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/fiscal/apuracao`;

  /** Todas as empresas da carteira no mês ("2026-10"). */
  firm(month: string): Observable<TaxAssessmentDTO[]> {
    return this.http.get<TaxAssessmentDTO[]>(this.baseUrl, { params: new HttpParams().set('month', month) });
  }

  /** Fecha o mês: congela a apuração como está agora. */
  close(companyId: string, month: string): Observable<TaxAssessmentDTO> {
    return this.http.post<TaxAssessmentDTO>(`${this.baseUrl}/${companyId}/fechamento`, {}, { params: new HttpParams().set('month', month) });
  }

  /** Reabre o mês: volta a acompanhar as notas. */
  reopen(companyId: string, month: string): Observable<TaxAssessmentDTO> {
    return this.http.delete<TaxAssessmentDTO>(`${this.baseUrl}/${companyId}/fechamento`, { params: new HttpParams().set('month', month) });
  }

  /** Guia do mês (emitida, valor, vencimento) e observações. */
  updateGuide(companyId: string, month: string, guide: GuideUpdateDTO): Observable<TaxAssessmentDTO> {
    return this.http.put<TaxAssessmentDTO>(`${this.baseUrl}/${companyId}/guia`, guide, { params: new HttpParams().set('month', month) });
  }

  /** Uma empresa, com o histórico de 13 meses. */
  company(companyId: string, month: string): Observable<TaxAssessmentDTO> {
    return this.http.get<TaxAssessmentDTO>(`${this.baseUrl}/${companyId}`, { params: new HttpParams().set('month', month) });
  }
}
