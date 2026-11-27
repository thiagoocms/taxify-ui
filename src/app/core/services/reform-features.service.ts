import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, Injector, signal } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ReformFeaturesDTO } from '../models/stock-credit.model';

/**
 * Recursos da Reforma Tributária ligados no ambiente (`GET /reform/features`, CE-RN-15): o menu "Reforma Tributária"
 * e o guard das rotas seguem o que o backend diz. Falha na leitura = nada ligado (o item não aparece). Limpo no
 * logout, como o {@link FirmAccessService}.
 */
@Injectable({ providedIn: 'root' })
export class ReformFeaturesService {
  private readonly injector = inject(Injector);
  private readonly url = `${environment.apiUrl}/reform/features`;

  private readonly state = signal<ReformFeaturesDTO | null>(null);
  private inFlight: Observable<ReformFeaturesDTO | null> | null = null;
  private generation = 0;

  readonly features = this.state.asReadonly();
  readonly stockCreditEnabled = computed(() => this.state()?.stockCredit?.enabled === true);
  /** A partir de 01/07/2027 (CE-RN-12): só consulta. */
  readonly stockCreditClosed = computed(() => this.state()?.stockCredit?.closed === true);
  readonly stockCreditClosesOn = computed(() => this.state()?.stockCredit?.closesOn ?? null);
  /** Algum recurso da Reforma ligado: o grupo do menu aparece. */
  readonly anyEnabled = computed(() => this.stockCreditEnabled());

  refresh(): Observable<ReformFeaturesDTO | null> {
    if (!this.inFlight) {
      const generation = this.generation;
      const request = this.injector.get(HttpClient).get<ReformFeaturesDTO>(this.url).pipe(
        map((features) => {
          if (generation !== this.generation) return null;
          this.state.set(features ?? {});
          return features;
        }),
        catchError(() => of(generation === this.generation ? this.state() : null)),
        tap({
          finalize: () => {
            if (this.inFlight === request) this.inFlight = null;
          },
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.inFlight = request;
    }
    return this.inFlight;
  }

  reload(): void {
    this.refresh().subscribe();
  }

  ensureLoaded(): Observable<ReformFeaturesDTO | null> {
    const current = this.state();
    return current ? of(current) : this.refresh();
  }

  clear(): void {
    this.generation++;
    this.inFlight = null;
    this.state.set(null);
  }
}
