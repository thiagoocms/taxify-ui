import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountingFirmDTO, AccountingFirmFilterDTO } from '../models/accounting-firm.model';
import { Page, Pageable } from '../models/page.model';
import { buildParams } from './user.service';

@Injectable({ providedIn: 'root' })
export class AccountingFirmService {
  private readonly baseUrl = `${environment.apiUrl}/accounting-firms`;

  constructor(private readonly http: HttpClient) {}

  getAll(pageable: Pageable, filter: AccountingFirmFilterDTO = {}): Observable<Page<AccountingFirmDTO>> {
    const params = buildParams(pageable, filter);
    return this.http.get<Page<AccountingFirmDTO>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<AccountingFirmDTO> {
    return this.http.get<AccountingFirmDTO>(`${this.baseUrl}/${id}`);
  }

  create(firm: AccountingFirmDTO): Observable<AccountingFirmDTO> {
    return this.http.post<AccountingFirmDTO>(this.baseUrl, firm);
  }

  update(id: string, firm: AccountingFirmDTO): Observable<AccountingFirmDTO> {
    return this.http.put<AccountingFirmDTO>(`${this.baseUrl}/${id}`, firm);
  }
}
