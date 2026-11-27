import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, Injector, signal } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FirmAccessDTO } from '../models/firm-access.model';

/**
 * Situação de acesso do escritório do usuário logado (`GET /firm-access`): alimenta as faixas de teste e de
 * somente leitura, desabilita os botões de escrita e o limite do teste, e é a fonte do "admin da plataforma"
 * para o menu "Plataforma" e o platformAdminGuard.
 *
 * O backend calcula a situação a cada requisição; aqui ela é recarregada ao entrar no sistema, depois de um 403 de
 * escrita bloqueada ou de um 409 de limite, e depois das gravações que mudam o uso (criar/excluir empresa ou usuário).
 */
@Injectable({ providedIn: 'root' })
export class FirmAccessService {
  /** HttpClient só na hora de buscar: assim o app-button (que lê o readOnly) não depende de HTTP para existir. */
  private readonly injector = inject(Injector);
  private readonly url = `${environment.apiUrl}/firm-access`;

  private readonly state = signal<FirmAccessDTO | null>(null);
  private inFlight: Observable<FirmAccessDTO | null> | null = null;
  private loadedAt = 0;
  /** Sobe a cada clear(): uma resposta pedida antes do logout não regrava o estado do usuário anterior. */
  private generation = 0;

  readonly access = this.state.asReadonly();
  readonly loaded = computed(() => this.state() !== null);
  /** Somente leitura: faixa de bloqueio e botões de escrita desabilitados. */
  readonly readOnly = computed(() => this.state()?.readOnly === true);
  readonly platformAdmin = computed(() => this.state()?.platformAdmin === true);
  /** Item "Captura (plataforma)" do menu: a flag vem sempre do backend. */
  readonly capturePanelPlatformEnabled = computed(() => this.state()?.capturePanelPlatformEnabled === true);
  readonly limits = computed(() => this.state()?.limits ?? null);
  /** "Nova empresa" desabilitado: o teste já tem todas as empresas permitidas. */
  readonly companyLimitReached = computed(() => {
    const limits = this.limits();
    return !!limits && limits.companiesInUse >= limits.maxCompanies;
  });
  /** "Novo usuário" desabilitado: o teste já tem todos os usuários permitidos (o ADMIN conta). */
  readonly userLimitReached = computed(() => {
    const limits = this.limits();
    return !!limits && limits.usersInUse >= limits.maxUsers;
  });

  /** Busca de novo (as chamadas simultâneas compartilham a mesma requisição). Erro mantém o estado anterior. */
  refresh(): Observable<FirmAccessDTO | null> {
    if (!this.inFlight) {
      const generation = this.generation;
      const request = this.injector.get(HttpClient).get<FirmAccessDTO>(this.url).pipe(
        map((access) => {
          if (generation !== this.generation) {
            return null; // pedida por outra sessão: descarta
          }
          this.state.set(access);
          this.loadedAt = Date.now();
          return access;
        }),
        catchError(() => of(generation === this.generation ? this.state() : null)),
        tap({
          finalize: () => {
            if (this.inFlight === request) {
              this.inFlight = null;
            }
          },
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.inFlight = request;
    }
    return this.inFlight;
  }

  /** Dispara o {@link refresh} sem precisar assinar. */
  reload(): void {
    this.refresh().subscribe();
  }

  /** Recarrega se a última leitura passou de `maxAgeMs` (ex.: o teste vence à meia-noite com a tela aberta). */
  reloadIfStale(maxAgeMs: number): void {
    if (Date.now() - this.loadedAt > maxAgeMs) {
      this.reload();
    }
  }

  /** Já carregado: usa; senão busca. Para os guards. */
  ensureLoaded(): Observable<FirmAccessDTO | null> {
    const current = this.state();
    return current ? of(current) : this.refresh();
  }

  /** Saiu do sistema: nada da sessão anterior aparece para o próximo usuário. */
  clear(): void {
    this.generation++;
    this.inFlight = null;
    this.state.set(null);
    this.loadedAt = 0;
  }
}
