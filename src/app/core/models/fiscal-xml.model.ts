export interface FiscalXmlDownloadFilterDTO {
  companyId?: string;
  xmlType: number;
  dataEmissaoInicio?: string;
  dataEmissaoFim?: string;
  // Unlike the other list endpoints, this one nests the page/size under a
  // "pagination" object in the request body instead of taking them flat.
  pagination?: { page: number; size: number };
  downloadEvent?: boolean;
}

export interface FiscalXmlExportFilterDTO {
  companyId: string;
  xmlType: number;
  dataEmissaoInicio?: string;
  dataEmissaoFim?: string;
}

export interface FiscalXmlItemDTO {
  accessKey?: string;
  documentType?: string;
  issuerCnpj?: string;
  recipientCnpj?: string;
  issueDate?: string;
  xmlContent?: string;
}

export interface FiscalXmlDownloadResultDTO {
  totalItemsFound?: number;
  totalXmlsCounted?: number;
  totalPersistedNew?: number;
  totalDuplicatedSkipped?: number;
  totalParseErrors?: number;
  persistedAccessKeys?: string[];
  xmls?: FiscalXmlItemDTO[];
}
