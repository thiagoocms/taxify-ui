import { HttpClient } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FirmIntegrationStatusDTO, IntegrationType } from '../models/integration.model';

/** Integrações (SIEG, Acessórias, Conta Azul) do escritório do usuário logado. */
@Injectable({ providedIn: 'root' })
export class IntegrationService {
  private readonly baseUrl = `${environment.apiUrl}/integrations`;

  private readonly statuses = signal<FirmIntegrationStatusDTO[]>([]);
  readonly integrations = this.statuses.asReadonly();
  /** Acessórias liberado: o escritório tem o token salvo (mostra os botões de importação). */
  readonly hasAcessorias = computed(() => !!this.statuses().find((item) => item.type === 'ACESSORIAS')?.configured);

  constructor(private readonly http: HttpClient) {}

  load(): void {
    this.list().subscribe({ error: () => this.statuses.set([]) });
  }

  list(): Observable<FirmIntegrationStatusDTO[]> {
    return this.http.get<FirmIntegrationStatusDTO[]>(this.baseUrl).pipe(tap((list) => this.statuses.set(list)));
  }

  /** Salva (ou, vazia, remove) a chave de API de uma integração por chave. */
  saveApiKey(type: IntegrationType, apiKey: string): Observable<FirmIntegrationStatusDTO> {
    return this.http
      .put<FirmIntegrationStatusDTO>(`${this.baseUrl}/${type}/api-key`, { apiKey })
      .pipe(tap((status) => this.statuses.update((list) => [...list.filter((item) => item.type !== type), status])));
  }

  statusOf(type: IntegrationType): FirmIntegrationStatusDTO | undefined {
    return this.statuses().find((item) => item.type === type);
  }
}
