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

  constructor(private readonly http: HttpClient) {}

  /** List rows of the XMLs already stored for a company (no live SIEG call, no XML content). */
  search(filter: FiscalXmlSearchFilterDTO): Observable<Page<FiscalXmlSummaryDTO>> {
    return this.http.post<Page<FiscalXmlSummaryDTO>>(this.baseUrl, filter);
  }

  getDetail(documentId: string): Observable<FiscalXmlDetailDTO> {
    return this.http.get<FiscalXmlDetailDTO>(`${this.baseUrl}/${documentId}`);
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
