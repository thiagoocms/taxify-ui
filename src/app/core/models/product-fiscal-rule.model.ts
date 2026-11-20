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

/** Produto da empresa: código distinto encontrado nos itens das notas importadas. */
export interface CompanyProductDTO {
  codigo: string;
  descricao: string | null;
  ncm: string | null;
  cfop: string | null;
  ocorrencias: number;
  /** A empresa já tem regra cadastrada para este código. */
  possuiRegra: boolean;
  /** "codigo - descricao", para exibição. */
  label: string;
}
