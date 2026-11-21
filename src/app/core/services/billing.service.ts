import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BillingCategoryDTO,
  BillingProviderType,
  BillingSettingsDTO,
  BillingSyncResultDTO,
  BillingChargeDTO,
  CompanyBillingDTO,
  ExternalLinkDTO,
} from '../models/billing.model';
import { SyncJobStatusDTO } from '../models/sync-job.model';

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

  /** Dispara a sincronização em segundo plano; acompanhe com {@link syncStatus}. */
  startSync(): Observable<SyncJobStatusDTO<BillingSyncResultDTO>> {
    return this.http.post<SyncJobStatusDTO<BillingSyncResultDTO>>(`${this.baseUrl}/sync`, {});
  }

  syncStatus(): Observable<SyncJobStatusDTO<BillingSyncResultDTO>> {
    return this.http.get<SyncJobStatusDTO<BillingSyncResultDTO>>(`${this.baseUrl}/sync`);
  }

  companyBilling(companyId: string): Observable<CompanyBillingDTO> {
    return this.http.get<CompanyBillingDTO>(`${this.baseUrl}/companies/${companyId}`);
  }

  /** Cobrança manual (as sincronizadas só são alteradas no sistema de cobrança). */
  createCharge(charge: Partial<BillingChargeDTO>): Observable<BillingChargeDTO> {
    return this.http.post<BillingChargeDTO>(`${this.baseUrl}/charges`, charge);
  }

  updateCharge(id: string, charge: Partial<BillingChargeDTO>): Observable<BillingChargeDTO> {
    return this.http.put<BillingChargeDTO>(`${this.baseUrl}/charges/${id}`, { ...charge, id });
  }

  deleteCharge(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/charges/${id}`);
  }

  /** Vincula a empresa a um cliente do sistema de cobrança pelo ID dele. */
  saveLink(companyId: string, link: ExternalLinkDTO): Observable<ExternalLinkDTO> {
    return this.http.put<ExternalLinkDTO>(`${this.baseUrl}/companies/${companyId}/link`, link);
  }

  /** Procura o cliente no sistema de cobrança por outro CNPJ/CPF e vincula. */
  lookupLink(companyId: string, document: string): Observable<ExternalLinkDTO> {
    return this.http.post<ExternalLinkDTO>(`${this.baseUrl}/companies/${companyId}/link/lookup`, { document });
  }

  deleteLink(companyId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/companies/${companyId}/link`);
  }
}
