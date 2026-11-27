import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CapturePanelDetailDTO,
  CapturePanelFilter,
  CapturePanelResponseDTO,
  CaptureScope,
  CaptureSyncNowResponseDTO,
} from '../models/capture-panel.model';

export const CAPTURE_PANEL_PAGE_SIZE = 50;

/**
 * Painel de controle da captura de XML (spec 2026-11-27-painel-captura-xml): visão do escritório (`/capture-panel`,
 * ADMIN = escritório inteiro, FISCAL = carteira) e da plataforma (`/platform/capture-panel`, só o admin da
 * plataforma). A visão da plataforma pode estar desligada no ambiente (`TAXIFY_CAPTURE_PANEL_PLATFORM_ENABLED=false`):
 * a API responde 404 e a tela explica. O item do menu segue o `capturePanelPlatformEnabled` do `GET /firm-access`.
 */
@Injectable({ providedIn: 'root' })
export class CapturePanelService {
  private readonly http = inject(HttpClient);
  private readonly firmUrl = `${environment.apiUrl}/capture-panel`;
  private readonly platformUrl = `${environment.apiUrl}/platform/capture-panel`;

  private base(scope: CaptureScope): string {
    return scope === 'platform' ? this.platformUrl : this.firmUrl;
  }

  /** Só os filtros informados vão na query; `situacao` vai repetido (`?situacao=A&situacao=B`). */
  list(scope: CaptureScope, filter: CapturePanelFilter, size = CAPTURE_PANEL_PAGE_SIZE): Observable<CapturePanelResponseDTO> {
    let params = new HttpParams().set('page', filter.page).set('size', size);
    for (const status of filter.situacao) {
      params = params.append('situacao', status);
    }
    if (filter.canal) params = params.set('canal', filter.canal);
    if (filter.tipo) params = params.set('tipo', filter.tipo);
    const busca = filter.busca.trim();
    if (busca) params = params.set('busca', busca);
    if (filter.incluirInativas) params = params.set('incluirInativas', true);
    if (filter.sort) params = params.set('sort', filter.sort);
    if (scope === 'platform' && filter.firmId) params = params.set('firmId', filter.firmId);
    return this.http.get<CapturePanelResponseDTO>(this.base(scope), { params });
  }

  detail(scope: CaptureScope, companyId: string): Observable<CapturePanelDetailDTO> {
    return this.http.get<CapturePanelDetailDTO>(`${this.base(scope)}/companies/${encodeURIComponent(companyId)}`);
  }

  /** 202 com o pedido (o mesmo se já houver um aberto). Recusas: 403, 404, 409, 429 e 503 (CP-RN-17). */
  syncNow(scope: CaptureScope, companyId: string): Observable<CaptureSyncNowResponseDTO> {
    return this.http.post<CaptureSyncNowResponseDTO>(
      `${this.base(scope)}/companies/${encodeURIComponent(companyId)}/sync-now`,
      {},
    );
  }
}
