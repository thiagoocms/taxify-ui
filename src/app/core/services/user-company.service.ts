import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page, Pageable } from '../models/page.model';
import { UserCompanyDTO, UserCompanyFilterDTO } from '../models/user-company.model';
import { buildParams } from './user.service';

@Injectable({ providedIn: 'root' })
export class UserCompanyService {
  private readonly baseUrl = `${environment.apiUrl}/users`;

  constructor(private readonly http: HttpClient) {}

  getAll(
    userId: string,
    pageable: Pageable,
    filter: UserCompanyFilterDTO = {},
  ): Observable<Page<UserCompanyDTO>> {
    const params = buildParams(pageable, filter);
    return this.http.get<Page<UserCompanyDTO>>(`${this.baseUrl}/${userId}/companies`, { params });
  }

  /**
   * A chave do vínculo é composta (userId + companyId). Como o userId já
   * consta no caminho, usamos o companyId como identificador do vínculo
   * nas rotas de get/delete.
   */
  getById(userId: string, companyId: string): Observable<UserCompanyDTO> {
    return this.http.get<UserCompanyDTO>(`${this.baseUrl}/${userId}/companies/${companyId}`);
  }

  create(userId: string, link: UserCompanyDTO): Observable<UserCompanyDTO> {
    return this.http.post<UserCompanyDTO>(`${this.baseUrl}/${userId}/companies`, link);
  }

  delete(userId: string, companyId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${userId}/companies/${companyId}`);
  }
}
