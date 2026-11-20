import { HttpClient } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountingFirmDTO, AccountingFirmFilterDTO } from '../models/accounting-firm.model';
import { Page, Pageable } from '../models/page.model';
import { buildParams } from './user.service';

@Injectable({ providedIn: 'root' })
export class AccountingFirmService {
  private readonly baseUrl = `${environment.apiUrl}/accounting-firms`;

  /** Escritório do usuário logado (um usuário só enxerga o próprio escritório). */
  private readonly current = signal<AccountingFirmDTO | null>(null);
  readonly currentFirm = this.current.asReadonly();
  /** Integração com o Acessórias liberada: o escritório tem o token de API salvo. */
  readonly hasAcessoriasToken = computed(() => !!this.current()?.acessoriasApiToken?.trim());

  constructor(private readonly http: HttpClient) {}

  /** (Re)carrega o escritório do usuário logado em {@link currentFirm}. */
  loadCurrent(): void {
    this.getAll({ page: 0, size: 1 }).subscribe({
      next: (page) => this.current.set(page.content[0] ?? null),
      error: () => this.current.set(null),
    });
  }

  /** Atualiza {@link currentFirm} depois de salvar o escritório (ex.: token do Acessórias informado). */
  setCurrent(firm: AccountingFirmDTO | null): void {
    this.current.set(firm);
  }

  getAll(pageable: Pageable, filter: AccountingFirmFilterDTO = {}): Observable<Page<AccountingFirmDTO>> {
    const params = buildParams(pageable, filter);
    return this.http.get<Page<AccountingFirmDTO>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<AccountingFirmDTO> {
    return this.http.get<AccountingFirmDTO>(`${this.baseUrl}/${id}`);
  }

  create(firm: AccountingFirmDTO): Observable<AccountingFirmDTO> {
    return this.http.post<AccountingFirmDTO>(this.baseUrl, firm);
  }

  update(id: string, firm: AccountingFirmDTO): Observable<AccountingFirmDTO> {
    return this.http.put<AccountingFirmDTO>(`${this.baseUrl}/${id}`, firm);
  }
}
