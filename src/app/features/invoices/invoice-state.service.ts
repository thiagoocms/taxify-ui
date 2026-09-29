import { Injectable, signal } from '@angular/core';
import { CompanyDTO } from '../../core/models/company.model';
import { FiscalXmlSummaryDTO } from '../../core/models/fiscal-xml.model';

export interface InvoiceSearchState {
  company: CompanyDTO | null;
  dataEmissaoInicio: string;
  dataEmissaoFim: string;
  numero: string;
  period: string;
  pageIndex: number;
  totalPages: number;
  totalElements: number;
  xmls: FiscalXmlSummaryDTO[];
}

/**
 * Keeps the last search of the "Notas fiscais" list alive across navigation, so
 * opening a note's detail page and coming back lands on the same results/page
 * instead of an empty form.
 */
@Injectable({ providedIn: 'root' })
export class InvoiceStateService {
  readonly search = signal<InvoiceSearchState | null>(null);
}
