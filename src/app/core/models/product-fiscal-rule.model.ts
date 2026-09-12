export interface ProductFiscalRuleDTO {
  id?: string;
  companyId: string;
  codigoProduto: string;
  descricaoProduto?: string;
  ncmCorreto?: string;
  cfopCorreto: string;
  observacoes?: string;
  deleted?: boolean;
}

export interface ProductFiscalRuleFilterDTO {
  id?: string;
  companyId?: string;
  codigoProduto?: string;
  deleted?: boolean;
}

export interface ProductFiscalDivergenceDTO {
  documentId?: string;
  accessKey?: string;
  issueDate?: string;
  codigoProduto?: string;
  descricaoProduto?: string;
  cfopAtual?: string;
  cfopCorreto?: string;
  ncmAtual?: string;
  ncmCorreto?: string;
}
