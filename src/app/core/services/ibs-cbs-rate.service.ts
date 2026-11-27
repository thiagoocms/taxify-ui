import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  IbsCbsRateChangeDTO,
  IbsCbsRateDTO,
  IbsCbsRateSaveDTO,
  IbsCbsRatesResponseDTO,
} from '../models/ibs-cbs-rate.model';

/** Quanto a referência lida pelos escritórios fica guardada na sessão (texto de lei, muda poucas vezes por ano). */
const REFERENCE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Alíquotas de IBS/CBS por ano (F1a-0).
 * - Console da plataforma (`@PlatformAdminOnly`): {@link getAll}, {@link save} (upsert por ano com `version`) e
 *   {@link history}. Não há exclusão (AL-RN-04).
 * - Escritórios: {@link reference}, a mesma tabela sem `version` e sem auditoria, para a conferência e o detalhe da
 *   nota. A resposta é compartilhada entre as telas; falha vira `null` (a tela só deixa de mostrar a referência).
 */
@Injectable({ providedIn: 'root' })
export class IbsCbsRateService {
  private readonly http = inject(HttpClient);
  private readonly platformUrl = `${environment.apiUrl}/platform/ibs-cbs-rates`;
  private readonly referenceUrl = `${environment.apiUrl}/reform/ibs-cbs-rates`;

  private referenceCache: Observable<IbsCbsRatesResponseDTO | null> | null = null;
  private referenceLoadedAt = 0;

  getAll(): Observable<IbsCbsRatesResponseDTO> {
    return this.http.get<IbsCbsRatesResponseDTO>(this.platformUrl);
  }

  save(year: number, rate: IbsCbsRateSaveDTO): Observable<IbsCbsRateDTO> {
    this.invalidateReference();
    return this.http.put<IbsCbsRateDTO>(`${this.platformUrl}/${year}`, rate);
  }

  history(year: number): Observable<IbsCbsRateChangeDTO[]> {
    return this.http.get<IbsCbsRateChangeDTO[]>(`${this.platformUrl}/${year}/history`);
  }

  reference(): Observable<IbsCbsRatesResponseDTO | null> {
    if (!this.referenceCache || Date.now() - this.referenceLoadedAt > REFERENCE_MAX_AGE_MS) {
      this.referenceLoadedAt = Date.now();
      this.referenceCache = this.http.get<IbsCbsRatesResponseDTO>(this.referenceUrl).pipe(
        catchError(() => {
          this.referenceCache = null; // a próxima tela tenta de novo
          return of(null);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.referenceCache;
  }

  private invalidateReference(): void {
    this.referenceCache = null;
  }
}
