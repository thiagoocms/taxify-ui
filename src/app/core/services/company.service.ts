import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CompanyCertificateDTO, CompanyDTO, CompanyFilterDTO, CompanyTaxRegimeDTO, NfseAdnStatusDTO, SefazNotesDTO } from '../models/company.model';
import { Page, Pageable } from '../models/page.model';
import { buildParams } from './user.service';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly baseUrl = `${environment.apiUrl}/companies`;

  constructor(private readonly http: HttpClient) {}

  getAll(pageable: Pageable, filter: CompanyFilterDTO = {}): Observable<Page<CompanyDTO>> {
    const params = buildParams(pageable, filter);
    return this.http.get<Page<CompanyDTO>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<CompanyDTO> {
    return this.http.get<CompanyDTO>(`${this.baseUrl}/${id}`);
  }

  create(company: CompanyDTO): Observable<CompanyDTO> {
    return this.http.post<CompanyDTO>(this.baseUrl, company);
  }

  update(id: string, company: CompanyDTO): Observable<CompanyDTO> {
    return this.http.put<CompanyDTO>(`${this.baseUrl}/${id}`, company);
  }

  /** Histórico de regime, do mais antigo ao atual. */
  getRegimes(id: string): Observable<CompanyTaxRegimeDTO[]> {
    return this.http.get<CompanyTaxRegimeDTO[]>(`${this.baseUrl}/${id}/regimes`);
  }

  /** Inclui (ou substitui) o período que começa em validFrom. */
  saveRegime(id: string, regime: CompanyTaxRegimeDTO): Observable<CompanyTaxRegimeDTO[]> {
    return this.http.post<CompanyTaxRegimeDTO[]>(`${this.baseUrl}/${id}/regimes`, regime);
  }

  deleteRegime(id: string, regimeId: string): Observable<CompanyTaxRegimeDTO[]> {
    return this.http.delete<CompanyTaxRegimeDTO[]>(`${this.baseUrl}/${id}/regimes/${regimeId}`);
  }

  getCertificate(id: string): Observable<CompanyCertificateDTO> {
    return this.http.get<CompanyCertificateDTO>(`${this.baseUrl}/${id}/certificado`);
  }

  /** Envia (ou troca) o certificado A1: o backend confere a senha antes de guardar. */
  uploadCertificate(id: string, file: File, password: string): Observable<CompanyCertificateDTO> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);
    return this.http.post<CompanyCertificateDTO>(`${this.baseUrl}/${id}/certificado`, formData);
  }

  deleteCertificate(id: string): Observable<CompanyCertificateDTO> {
    return this.http.delete<CompanyCertificateDTO>(`${this.baseUrl}/${id}/certificado`);
  }

  /** Captura agora na SEFAZ (respeita a pausa de 1h que a SEFAZ exige). */
  captureFromSefaz(id: string): Observable<CompanyCertificateDTO> {
    return this.http.post<CompanyCertificateDTO>(`${this.baseUrl}/${id}/sefaz/capturar`, {});
  }

  /** Captura de NFS-e pelo Ambiente Nacional: última execução e se o plano inclui. */
  getNfseAdnStatus(id: string): Observable<NfseAdnStatusDTO> {
    return this.http.get<NfseAdnStatusDTO>(`${this.baseUrl}/${id}/nfse-nacional`);
  }

  /** Roda a captura de NFS-e agora (respeitando a espera entre consultas). */
  captureNfseAdn(id: string): Observable<NfseAdnStatusDTO> {
    return this.http.post<NfseAdnStatusDTO>(`${this.baseUrl}/${id}/nfse-nacional/capturar`, {});
  }

  /** Notas que a SEFAZ entregou só como resumo, a ciência delas e o confronto SIEG × SEFAZ. */
  getSefazSummaries(id: string): Observable<SefazNotesDTO> {
    return this.http.get<SefazNotesDTO>(`${this.baseUrl}/${id}/sefaz/resumos`);
  }

  /** Recoloca na fila a ciência recusada de uma nota - vai na próxima captura. */
  retryCiencia(id: string, chave: string): Observable<SefazNotesDTO> {
    return this.http.post<SefazNotesDTO>(`${this.baseUrl}/${id}/sefaz/resumos/${chave}/reenviar-ciencia`, {});
  }

  /** Completa endereço, CNAE, IE e IM vazios pela última nota emitida pela empresa. */
  fillFromNotes(id: string): Observable<CompanyDTO> {
    return this.http.post<CompanyDTO>(`${this.baseUrl}/${id}/preencher-pelas-notas`, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
