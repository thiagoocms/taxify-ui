export interface FiscalXmlDownloadFilterDTO {
  companyId?: string;
  xmlType: number;
  dataEmissaoInicio?: string;
  dataEmissaoFim?: string;
  take?: number;
  skip?: number;
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
