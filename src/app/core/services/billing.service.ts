import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BillingCategoryDTO,
  BillingProviderType,
  BillingSettingsDTO,
  BillingSyncResultDTO,
  CompanyBillingDTO,
} from '../models/billing.model';

/** Contratos e honorários — independente do sistema de cobrança (Manual, Conta Azul...). */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly baseUrl = `${environment.apiUrl}/billing`;

  constructor(private readonly http: HttpClient) {}

  getSettings(): Observable<BillingSettingsDTO> {
    return this.http.get<BillingSettingsDTO>(`${this.baseUrl}/settings`);
  }

  updateSettings(provider: BillingProviderType, feeCategoryIds: string[]): Observable<BillingSettingsDTO> {
    return this.http.put<BillingSettingsDTO>(`${this.baseUrl}/settings`, { provider, feeCategoryIds });
  }

  /** Categorias de receita do sistema escolhido — para marcar quais são honorários. */
  listCategories(): Observable<BillingCategoryDTO[]> {
    return this.http.get<BillingCategoryDTO[]>(`${this.baseUrl}/categories`);
  }

  sync(): Observable<BillingSyncResultDTO> {
    return this.http.post<BillingSyncResultDTO>(`${this.baseUrl}/sync`, {});
  }

  companyBilling(companyId: string): Observable<CompanyBillingDTO> {
    return this.http.get<CompanyBillingDTO>(`${this.baseUrl}/companies/${companyId}`);
  }
}
