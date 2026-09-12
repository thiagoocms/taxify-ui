import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page, Pageable } from '../models/page.model';
import { SubscriptionDTO, SubscriptionFilterDTO } from '../models/subscription.model';
import { buildParams } from './user.service';

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly baseUrl = `${environment.apiUrl}/subscriptions`;

  constructor(private readonly http: HttpClient) {}

  getAll(pageable: Pageable, filter: SubscriptionFilterDTO = {}): Observable<Page<SubscriptionDTO>> {
    const params = buildParams(pageable, filter);
    return this.http.get<Page<SubscriptionDTO>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<SubscriptionDTO> {
    return this.http.get<SubscriptionDTO>(`${this.baseUrl}/${id}`);
  }

  create(subscription: SubscriptionDTO): Observable<SubscriptionDTO> {
    return this.http.post<SubscriptionDTO>(this.baseUrl, subscription);
  }

  update(id: string, subscription: SubscriptionDTO): Observable<SubscriptionDTO> {
    return this.http.put<SubscriptionDTO>(`${this.baseUrl}/${id}`, subscription);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
