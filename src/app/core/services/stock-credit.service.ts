import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  STOCK_CREDIT_SEARCH_MIN,
  STOCK_CREDIT_YEAR,
  StockCreditDetailDTO,
  StockCreditEventDTO,
  StockCreditFilter,
  StockCreditListDTO,
  StockCreditRowDTO,
  StockCreditStatusSaveDTO,
} from '../models/stock-credit.model';

export const STOCK_CREDIT_PAGE_SIZE = 50;

/**
 * Levantamento do crédito de estoque (F5a): lista paginada no servidor com resumo, detalhe, histórico, "Atualizar
 * agora", situação do contato e CSV. Todas as chamadas levam `year` (só 2026). Com o recurso desligado no ambiente,
 * todas respondem 404 `error.reform.stock.disabled` (a tela explica).
 */
@Injectable({ providedIn: 'root' })
export class StockCreditService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/reform/stock-credit`;

  /** Filtros da lista e do CSV: listas separadas por vírgula; busca só com 3 caracteres ou mais (seção 7). */
  filterParams(filter: StockCreditFilter): HttpParams {
    let params = new HttpParams().set('year', STOCK_CREDIT_YEAR);
    if (filter.classification.length) params = params.set('classification', filter.classification.join(','));
    if (filter.status.length) params = params.set('status', filter.status.join(','));
    if (filter.coverage.length) params = params.set('coverage', filter.coverage.join(','));
    const search = filter.search.trim();
    if (search.length >= STOCK_CREDIT_SEARCH_MIN) params = params.set('search', search);
    if (filter.sort) params = params.set('sort', filter.sort);
    return params;
  }

  getAll(filter: StockCreditFilter, size = STOCK_CREDIT_PAGE_SIZE): Observable<StockCreditListDTO> {
    const params = this.filterParams(filter).set('page', filter.page).set('size', size);
    return this.http.get<StockCreditListDTO>(this.baseUrl, { params });
  }

  getById(companyId: string): Observable<StockCreditDetailDTO> {
    return this.http.get<StockCreditDetailDTO>(`${this.baseUrl}/${encodeURIComponent(companyId)}`, { params: this.yearParam() });
  }

  refresh(companyId: string): Observable<StockCreditDetailDTO> {
    return this.http.post<StockCreditDetailDTO>(`${this.baseUrl}/${encodeURIComponent(companyId)}/refresh`, {}, { params: this.yearParam() });
  }

  updateStatus(companyId: string, body: StockCreditStatusSaveDTO): Observable<StockCreditRowDTO> {
    return this.http.put<StockCreditRowDTO>(`${this.baseUrl}/${encodeURIComponent(companyId)}/status`, body);
  }

  history(companyId: string): Observable<StockCreditEventDTO[]> {
    return this.http.get<StockCreditEventDTO[]>(`${this.baseUrl}/${encodeURIComponent(companyId)}/history`, { params: this.yearParam() });
  }

  /** CSV com os mesmos filtros e ordem da lista, sem paginação (leitura: funciona no escritório bloqueado). */
  exportCsv(filter: StockCreditFilter): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.baseUrl}/export.csv`, {
      params: this.filterParams(filter),
      responseType: 'blob',
      observe: 'response',
    });
  }

  private yearParam(): HttpParams {
    return new HttpParams().set('year', STOCK_CREDIT_YEAR);
  }
}
