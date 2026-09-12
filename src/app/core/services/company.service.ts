import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CompanyDTO, CompanyFilterDTO } from '../models/company.model';
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

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
