import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TaxAssessmentDTO } from '../models/tax-assessment.model';

/** Apuração do período: faturamento, RBT12 e estimativa de impostos a partir das notas. */
@Injectable({ providedIn: 'root' })
export class TaxAssessmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/fiscal/apuracao`;

  /** Todas as empresas da carteira no mês ("2026-10"). */
  firm(month: string): Observable<TaxAssessmentDTO[]> {
    return this.http.get<TaxAssessmentDTO[]>(this.baseUrl, { params: new HttpParams().set('month', month) });
  }

  /** Uma empresa, com o histórico de 13 meses. */
  company(companyId: string, month: string): Observable<TaxAssessmentDTO> {
    return this.http.get<TaxAssessmentDTO>(`${this.baseUrl}/${companyId}`, { params: new HttpParams().set('month', month) });
  }
}
