import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page, Pageable } from '../models/page.model';
import { PlanDTO, PlanFilterDTO } from '../models/plan.model';
import { buildParams } from './user.service';

@Injectable({ providedIn: 'root' })
export class PlanService {
  private readonly baseUrl = `${environment.apiUrl}/plans`;

  constructor(private readonly http: HttpClient) {}

  getAll(pageable: Pageable, filter: PlanFilterDTO = {}): Observable<Page<PlanDTO>> {
    const params = buildParams(pageable, filter);
    return this.http.get<Page<PlanDTO>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<PlanDTO> {
    return this.http.get<PlanDTO>(`${this.baseUrl}/${id}`);
  }

  create(plan: PlanDTO): Observable<PlanDTO> {
    return this.http.post<PlanDTO>(this.baseUrl, plan);
  }

  update(id: string, plan: PlanDTO): Observable<PlanDTO> {
    return this.http.put<PlanDTO>(`${this.baseUrl}/${id}`, plan);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
