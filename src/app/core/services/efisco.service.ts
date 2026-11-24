import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** O certificado do contador (e-CPF) do escritório - nunca vem o arquivo nem a senha; o CPF vem mascarado. */
export interface FirmCertificateDTO {
  present: boolean;
  holder?: string | null;
  cpf?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  expired: boolean;
  lastSyncAt?: string | null;
  /** OK, PARCIAL, ERRO, BLOQUEADO. */
  lastSyncStatus?: string | null;
  lastSyncDetail?: string | null;
}

/** e-Fisco PE: o certificado do contador (Integrações) e a sincronização dos extratos do Fronteira. */
@Injectable({ providedIn: 'root' })
export class EfiscoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/integrations/efisco`;

  certificate(): Observable<FirmCertificateDTO> {
    return this.http.get<FirmCertificateDTO>(`${this.baseUrl}/certificado`);
  }

  /** Envia (ou troca) o e-CPF A1: o backend confere a senha e se é e-CPF antes de guardar, cifrado. */
  uploadCertificate(file: File, password: string): Observable<FirmCertificateDTO> {
    const form = new FormData();
    form.append('file', file);
    form.append('password', password);
    return this.http.post<FirmCertificateDTO>(`${this.baseUrl}/certificado`, form);
  }

  deleteCertificate(): Observable<FirmCertificateDTO> {
    return this.http.delete<FirmCertificateDTO>(`${this.baseUrl}/certificado`);
  }
}
