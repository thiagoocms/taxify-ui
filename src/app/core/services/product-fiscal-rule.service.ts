import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page, Pageable } from '../models/page.model';
import {
  CompanyProductDTO,
  FiscalCheckFindingDTO,
  ProductFiscalDivergenceDTO,
  ProductFiscalRuleDTO,
  ProductFiscalRuleFilterDTO,
  ProductRuleSuggestionDTO,
} from '../models/product-fiscal-rule.model';
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

  /** Conferência fiscal do período: um achado por linha (regra do produto, cálculos, IBS/CBS...). */
  conferencia(companyId: string, dataEmissaoInicio?: string, dataEmissaoFim?: string): Observable<FiscalCheckFindingDTO[]> {
    let params = new HttpParams().set('companyId', companyId);
    if (dataEmissaoInicio) {
      params = params.set('dataEmissaoInicio', dataEmissaoInicio);
    }
    if (dataEmissaoFim) {
      params = params.set('dataEmissaoFim', dataEmissaoFim);
    }
    return this.http.get<FiscalCheckFindingDTO[]>(`${this.baseUrl}/conferencia`, { params });
  }

  /** Regras sugeridas a partir das notas (valor mais frequente de cada campo por produto). */
  /** Sugestões a partir das notas recebidas (empresa destinatária); codigoProduto = só esse produto. */
  sugestoes(companyId: string, somenteSemRegra = true, codigoProduto?: string): Observable<ProductRuleSuggestionDTO[]> {
    let params = new HttpParams().set('companyId', companyId).set('somenteSemRegra', somenteSemRegra);
    if (codigoProduto) {
      params = params.set('codigoProduto', codigoProduto);
    }
    return this.http.get<ProductRuleSuggestionDTO[]>(`${this.baseUrl}/sugestoes`, { params });
  }

  /** Produtos da empresa (códigos das notas importadas) que contêm o termo no código ou na descrição. */
  produtos(companyId: string, search: string): Observable<CompanyProductDTO[]> {
    const params = new HttpParams().set('companyId', companyId).set('search', search);
    return this.http.get<CompanyProductDTO[]>(`${this.baseUrl}/produtos`, { params });
  }
}
