export interface ProductFiscalRuleDTO {
  id?: string;
  companyId: string;
  codigoProduto: string;
  descricaoProduto?: string;
  ncmCorreto?: string;
  cfopCorreto: string;
  observacoes?: string;
  deleted?: boolean;
  // Classificação tributária - todos opcionais: vazio = não conferir.
  /** 0 nacional, 1/2/3/8 importada... */
  origemMercadoria?: string | null;
  /** Comparado só com notas que usaram CST (regime normal). */
  cstIcms?: string | null;
  /** Comparado só com notas que usaram CSOSN (Simples). */
  csosn?: string | null;
  /** Alíquota de ICMS da operação interna, em %. */
  aliquotaIcms?: number | null;
  cest?: string | null;
  cstIpi?: string | null;
  aliquotaIpi?: number | null;
  cstPis?: string | null;
  aliquotaPis?: number | null;
  cstCofins?: string | null;
  aliquotaCofins?: number | null;
  cstIbsCbs?: string | null;
  classificacaoTributaria?: string | null;
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

export type DivergenceSeverity = 'ERROR' | 'WARNING';

/** Um achado da conferência fiscal - da nota inteira (numeroItem nulo) ou de um item. */
export interface FiscalCheckFindingDTO {
  documentId: string;
  accessKey?: string | null;
  issueDate?: string | null;
  emitenteNome?: string | null;
  numeroItem?: number | null;
  codigoProduto?: string | null;
  descricaoProduto?: string | null;
  /** Estável (RULE_CFOP, IBSCBS_RATE...) - para filtrar. */
  codigo: string;
  campo?: string | null;
  valorEncontrado?: string | null;
  valorEsperado?: string | null;
  severidade: DivergenceSeverity;
  mensagem: string;
}

export interface SuggestedValue {
  valor: string;
  ocorrencias: number;
  /** % dos itens que têm o campo com esse valor: 100 = as notas sempre concordam. */
  percentual: number;
}

/**
 * Regra sugerida para um produto a partir das notas em que a empresa é destinatária; campos com os
 * nomes da ProductFiscalRuleDTO. O cfopCorreto é o CFOP de entrada equivalente ao do fornecedor.
 */
export interface ProductRuleSuggestionDTO {
  codigoProduto: string;
  descricaoProduto?: string | null;
  ocorrencias: number;
  possuiRegra: boolean;
  campos: Partial<Record<keyof ProductFiscalRuleDTO, SuggestedValue>>;
  /** CFOP de saída do fornecedor mais usado nas notas (o cfopCorreto é a entrada equivalente). */
  cfopFornecedor?: SuggestedValue | null;
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
