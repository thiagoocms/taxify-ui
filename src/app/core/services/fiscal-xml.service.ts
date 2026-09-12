import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FiscalXmlDownloadFilterDTO, FiscalXmlDownloadResultDTO, FiscalXmlExportFilterDTO } from '../models/fiscal-xml.model';

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

  download(filter: FiscalXmlDownloadFilterDTO): Observable<FiscalXmlDownloadResultDTO> {
    return this.http
      .post<FiscalXmlDownloadResultResponse>(this.baseUrl, filter)
      .pipe(map(toDownloadResultDTO));
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
}
