import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page, Pageable } from '../models/page.model';
import { UserDTO, UserFilterDTO } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly baseUrl = `${environment.apiUrl}/users`;

  constructor(private readonly http: HttpClient) {}

  getAll(pageable: Pageable, filter: UserFilterDTO = {}): Observable<Page<UserDTO>> {
    const params = buildParams(pageable, filter);
    return this.http.get<Page<UserDTO>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<UserDTO> {
    return this.http.get<UserDTO>(`${this.baseUrl}/${id}`);
  }

  create(user: UserDTO): Observable<UserDTO> {
    return this.http.post<UserDTO>(this.baseUrl, user);
  }

  update(id: string, user: UserDTO): Observable<UserDTO> {
    return this.http.put<UserDTO>(`${this.baseUrl}/${id}`, user);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}

export function buildParams<T extends object>(pageable: Pageable, filter: T): HttpParams {
  let params = new HttpParams()
    .set('page', pageable.page)
    .set('size', pageable.size);

  if (pageable.sort) {
    pageable.sort.forEach((s) => (params = params.append('sort', s)));
  }

  Object.entries(filter as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  });

  return params;
}
