import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CompanyDTO, CompanyFilterDTO, CompanyTaxRegimeDTO } from '../models/company.model';
import { Page, Pageable } from '../models/page.model';
import { buildParams } from './user.service';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly baseUrl = `${environment.apiUrl}/companies`;

  constructor(private readonly http: HttpClient) {}

  getAll(pageable: Pageable, filter: CompanyFilterDTO = {}): Observable<Page<CompanyDTO>> {
    const params = buildParams(pageable, filter);
    return this.http.get<Page<CompanyDTO>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<CompanyDTO> {
    return this.http.get<CompanyDTO>(`${this.baseUrl}/${id}`);
  }

  create(company: CompanyDTO): Observable<CompanyDTO> {
    return this.http.post<CompanyDTO>(this.baseUrl, company);
  }

  update(id: string, company: CompanyDTO): Observable<CompanyDTO> {
    return this.http.put<CompanyDTO>(`${this.baseUrl}/${id}`, company);
  }

  /** Histórico de regime, do mais antigo ao atual. */
  getRegimes(id: string): Observable<CompanyTaxRegimeDTO[]> {
    return this.http.get<CompanyTaxRegimeDTO[]>(`${this.baseUrl}/${id}/regimes`);
  }

  /** Inclui (ou substitui) o período que começa em validFrom. */
  saveRegime(id: string, regime: CompanyTaxRegimeDTO): Observable<CompanyTaxRegimeDTO[]> {
    return this.http.post<CompanyTaxRegimeDTO[]>(`${this.baseUrl}/${id}/regimes`, regime);
  }

  deleteRegime(id: string, regimeId: string): Observable<CompanyTaxRegimeDTO[]> {
    return this.http.delete<CompanyTaxRegimeDTO[]>(`${this.baseUrl}/${id}/regimes/${regimeId}`);
  }

  /** Completa endereço, CNAE, IE e IM vazios pela última nota emitida pela empresa. */
  fillFromNotes(id: string): Observable<CompanyDTO> {
    return this.http.post<CompanyDTO>(`${this.baseUrl}/${id}/preencher-pelas-notas`, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
