import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CertidaoIssueResultDTO, CertidaoSummaryDTO, CompanyCertidaoDTO } from '../models/certidao.model';

/** Certidão SEFAZ-PE: coluna da carteira, seção da empresa, PDF, "Emitir agora" e envio do PDF emitido no e-Fisco. */
@Injectable({ providedIn: 'root' })
export class CertidaoService {
  private readonly baseUrl = `${environment.apiUrl}/certidoes`;

  constructor(private readonly http: HttpClient) {}

  carteira(): Observable<CertidaoSummaryDTO[]> {
    return this.http.get<CertidaoSummaryDTO[]>(`${this.baseUrl}/carteira`);
  }

  ofCompany(companyId: string): Observable<CompanyCertidaoDTO> {
    return this.http.get<CompanyCertidaoDTO>(`${this.baseUrl}/empresa/${companyId}`);
  }

  pdf(certidaoId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${certidaoId}/pdf`, { responseType: 'blob' });
  }

  issue(companyId: string): Observable<CertidaoIssueResultDTO> {
    return this.http.post<CertidaoIssueResultDTO>(`${this.baseUrl}/empresa/${companyId}/emitir`, {});
  }

  upload(companyId: string, file: File): Observable<CompanyCertidaoDTO> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<CompanyCertidaoDTO>(`${this.baseUrl}/empresa/${companyId}/pdf`, formData);
  }
}

/** Abre o PDF (vem com o token, por isso não é um link direto) numa aba nova. */
export function openPdf(blob: Blob): void {
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
