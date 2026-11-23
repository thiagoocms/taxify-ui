import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  FiscalXmlDetailDTO,
  FiscalXmlDownloadResultDTO,
  FiscalXmlExportFilterDTO,
  FiscalXmlProdutoDTO,
  FiscalXmlRectificationResultDTO,
  FiscalXmlSearchFilterDTO,
  FiscalXmlSummaryDTO,
  FiscalXmlTotalsDTO,
  FiscalXmlEventDTO,
  ManifestationPendingDTO,
  ManifestationRequestDTO,
  ManifestationResultDTO,
  ReviewStatus,
} from '../models/fiscal-xml.model';
import { Page } from '../models/page.model';

interface FiscalXmlDownloadResultResponse extends Omit<FiscalXmlDownloadResultDTO, 'totalItemsFound'> {
  totalItemsFromSieg?: number;
}

function toDownloadResultDTO(response: FiscalXmlDownloadResultResponse): FiscalXmlDownloadResultDTO {
  const { totalItemsFromSieg, ...rest } = response;
  return { ...rest, totalItemsFound: totalItemsFromSieg };
}

@Injectable({ providedIn: 'root' })
export class FiscalXmlService {
  private readonly baseUrl = `${environment.apiUrl}/integrations/xmls`;

  /** Entradas que ainda devem manifestação conclusiva, prazo mais próximo primeiro. */
  manifestationPending(companyId: string): Observable<ManifestationPendingDTO> {
    return this.http.get<ManifestationPendingDTO>(`${this.baseUrl}/manifestacao`, { params: { companyId } });
  }

  /** Envia a manifestação escolhida para as notas; volta o retorno da SEFAZ por nota. */
  manifest(request: ManifestationRequestDTO): Observable<ManifestationResultDTO> {
    return this.http.post<ManifestationResultDTO>(`${this.baseUrl}/manifestacao`, request);
  }

  constructor(private readonly http: HttpClient) {}

  /** List rows of the XMLs already stored for a company (no live SIEG call, no XML content). */
  search(filter: FiscalXmlSearchFilterDTO): Observable<Page<FiscalXmlSummaryDTO>> {
    return this.http.post<Page<FiscalXmlSummaryDTO>>(this.baseUrl, filter);
  }

  /** Entradas e saídas do período (mesma empresa/período da lista), com os principais impostos. */
  totals(filter: FiscalXmlSearchFilterDTO): Observable<FiscalXmlTotalsDTO> {
    return this.http.post<FiscalXmlTotalsDTO>(`${this.baseUrl}/totais`, filter);
  }

  getDetail(documentId: string): Observable<FiscalXmlDetailDTO> {
    return this.http.get<FiscalXmlDetailDTO>(`${this.baseUrl}/${documentId}`);
  }

  /** Conferência de uma nota; DIVERGENT exige a descrição. */
  review(documentId: string, status: ReviewStatus, note?: string | null): Observable<FiscalXmlDetailDTO> {
    return this.http.put<FiscalXmlDetailDTO>(`${this.baseUrl}/${documentId}/conferencia`, { status, note });
  }

  /** Mesma situação para várias notas; retorna quantas foram atualizadas. */
  reviewMany(documentIds: string[], status: ReviewStatus): Observable<number> {
    return this.http.post<number>(`${this.baseUrl}/conferencia`, { documentIds, status });
  }

  /** Eventos SEFAZ da nota (cancelamento, carta de correção...). */
  getEvents(documentId: string): Observable<FiscalXmlEventDTO[]> {
    return this.http.get<FiscalXmlEventDTO[]>(`${this.baseUrl}/${documentId}/eventos`);
  }

  getProdutos(documentId: string): Observable<FiscalXmlProdutoDTO[]> {
    return this.http.get<FiscalXmlProdutoDTO[]>(`${this.baseUrl}/${documentId}/produtos`);
  }

  getXml(documentId: string): Observable<string> {
    return this.http.get(`${this.baseUrl}/${documentId}/xml`, { responseType: 'text' });
  }

  downloadXml(documentId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${documentId}/xml`, { responseType: 'blob' });
  }

  /** DANFE (PDF) rendered by the backend from the stored XML. */
  downloadPdf(documentId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${documentId}/pdf`, { responseType: 'blob' });
  }

  importarManual(companyId: string, file: File): Observable<FiscalXmlDownloadResultDTO> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<FiscalXmlDownloadResultResponse>(`${this.baseUrl}/importar`, formData, {
        params: { companyId },
      })
      .pipe(map(toDownloadResultDTO));
  }

  exportarZip(filter: FiscalXmlExportFilterDTO): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/exportar/zip`, filter, { responseType: 'blob' });
  }

  retificar(documentId: string): Observable<FiscalXmlRectificationResultDTO> {
    return this.http.post<FiscalXmlRectificationResultDTO>(`${this.baseUrl}/${documentId}/retificar`, {});
  }
}
