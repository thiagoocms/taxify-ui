import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page, Pageable } from '../models/page.model';
import { ProductFiscalDivergenceDTO, ProductFiscalRuleDTO, ProductFiscalRuleFilterDTO } from '../models/product-fiscal-rule.model';
import { buildParams } from './user.service';

@Injectable({ providedIn: 'root' })
export class ProductFiscalRuleService {
  private readonly baseUrl = `${environment.apiUrl}/product-fiscal-rules`;

  constructor(private readonly http: HttpClient) {}

  getAll(pageable: Pageable, filter: ProductFiscalRuleFilterDTO = {}): Observable<Page<ProductFiscalRuleDTO>> {
    const params = buildParams(pageable, filter);
    return this.http.get<Page<ProductFiscalRuleDTO>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<ProductFiscalRuleDTO> {
    return this.http.get<ProductFiscalRuleDTO>(`${this.baseUrl}/${id}`);
  }

  create(rule: ProductFiscalRuleDTO): Observable<ProductFiscalRuleDTO> {
    return this.http.post<ProductFiscalRuleDTO>(this.baseUrl, rule);
  }

  update(id: string, rule: ProductFiscalRuleDTO): Observable<ProductFiscalRuleDTO> {
    return this.http.put<ProductFiscalRuleDTO>(`${this.baseUrl}/${id}`, rule);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  divergencias(companyId: string, dataEmissaoInicio?: string, dataEmissaoFim?: string): Observable<ProductFiscalDivergenceDTO[]> {
    let params = new HttpParams().set('companyId', companyId);
    if (dataEmissaoInicio) {
      params = params.set('dataEmissaoInicio', dataEmissaoInicio);
    }
    if (dataEmissaoFim) {
      params = params.set('dataEmissaoFim', dataEmissaoFim);
    }
    return this.http.get<ProductFiscalDivergenceDTO[]>(`${this.baseUrl}/divergencias`, { params });
  }
}
