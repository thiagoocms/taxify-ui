import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page, Pageable } from '../models/page.model';
import {
  PlatformAccessAction,
  PlatformAccessActionRequestDTO,
  PlatformFirmContactRequestDTO,
  PlatformFirmEventDTO,
  PlatformFirmFilterDTO,
  PlatformFirmRowDTO,
} from '../models/platform-firm.model';
import { buildParams } from './user.service';

/** Console da plataforma: escritórios, ações de acesso/revisão e trilha. Só admin da plataforma (403 para os demais). */
@Injectable({ providedIn: 'root' })
export class PlatformFirmService {
  private readonly baseUrl = `${environment.apiUrl}/platform/firms`;

  constructor(private readonly http: HttpClient) {}

  /** `unreviewed` só vai quando marcado e a busca vai sem espaços nas pontas (vazia não vai). */
  getAll(pageable: Pageable, filter: PlatformFirmFilterDTO = {}): Observable<Page<PlatformFirmRowDTO>> {
    const params = buildParams(pageable, {
      status: filter.status,
      unreviewed: filter.unreviewed || undefined,
      q: filter.q?.trim(),
    });
    return this.http.get<Page<PlatformFirmRowDTO>>(this.baseUrl, { params });
  }

  applyAction(id: string, action: PlatformAccessAction, body: PlatformAccessActionRequestDTO = {}): Observable<PlatformFirmRowDTO> {
    return this.http.post<PlatformFirmRowDTO>(`${this.baseUrl}/${id}/access/${action}`, body);
  }

  /** Dados do escritório (CNPJ, e-mail financeiro, telefone); responde a linha atualizada. */
  updateContact(id: string, body: PlatformFirmContactRequestDTO): Observable<PlatformFirmRowDTO> {
    return this.http.put<PlatformFirmRowDTO>(`${this.baseUrl}/${id}/contact`, body);
  }

  getEvents(id: string): Observable<PlatformFirmEventDTO[]> {
    return this.http.get<PlatformFirmEventDTO[]>(`${this.baseUrl}/${id}/events`);
  }
}
