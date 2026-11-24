import { FiscalXmlDivergenceSummaryDTO } from './fiscal-xml.model';

/** O que a linha do extrato tem de diferente. */
export type FronteiraFlag = 'SEM_XML' | 'SO_RESUMO' | 'FORA_DA_TAXA' | 'VALOR_DIFERENTE' | 'NOTA_CANCELADA' | 'DIVERGENCIA_FISCAL';

export const FRONTEIRA_FLAG_LABELS: Record<FronteiraFlag, string> = {
  FORA_DA_TAXA: 'Taxa diferente · a explicar',
  SEM_XML: 'Sem XML no Taxify',
  SO_RESUMO: 'Só o resumo da SEFAZ',
  VALOR_DIFERENTE: 'Valor diferente do XML',
  NOTA_CANCELADA: 'Nota cancelada',
  DIVERGENCIA_FISCAL: 'Divergência fiscal',
};

export const FRONTEIRA_FLAG_HINTS: Record<FronteiraFlag, string> = {
  FORA_DA_TAXA: 'Cobrada com percentual diferente do que o extrato aplica na maioria das notas. Não é erro por si: produto com ST, por exemplo, sai de outra forma. O cálculo do Taxify diz se confere.',
  SO_RESUMO: 'O Taxify só tem o resumo da SEFAZ desta nota — o XML completo ainda não veio (veja a Manifestação)',
  SEM_XML: 'O e-Fisco cobra uma nota que o Taxify não tem — busque o XML no SIEG / SEFAZ ou importe',
  VALOR_DIFERENTE: 'O valor da NF no extrato não bate com o total do XML',
  NOTA_CANCELADA: 'A nota foi cancelada, mas continua cobrada no extrato',
  DIVERGENCIA_FISCAL: 'As checagens fiscais acharam algo na nota (NCM, CFOP, CST...) — pode afetar a cobrança',
};

/** O cálculo do Taxify contra o que o e-Fisco cobrou. */
export type FronteiraResultado = 'CONFERE' | 'COBROU_A_MAIS' | 'COBROU_A_MENOS' | 'NAO_CALCULOU' | 'SEM_REGRA' | 'PENDENTE';

export const RESULTADO_LABELS: Record<FronteiraResultado, string> = {
  CONFERE: 'Confere',
  COBROU_A_MAIS: 'Cobrou a mais',
  COBROU_A_MENOS: 'Cobrou a menos',
  NAO_CALCULOU: 'SEFAZ não calculou',
  SEM_REGRA: 'Sem regra',
  PENDENTE: 'Pendente',
};

export const RESULTADO_HINTS: Record<FronteiraResultado, string> = {
  CONFERE: 'O valor cobrado cai na faixa dos métodos de arredondamento do Taxify (tolerância de R$ 0,03)',
  COBROU_A_MAIS: 'O e-Fisco cobrou acima do cálculo do Taxify — candidata a pedido de revisão (confira a memória de cálculo)',
  COBROU_A_MENOS: 'O e-Fisco cobrou abaixo do cálculo do Taxify — risco de cobrança posterior, não economia',
  NAO_CALCULOU: 'O e-Fisco não cobrou nada onde o Taxify calcula ICMS — risco de cobrança posterior',
  SEM_REGRA: 'Algum item não tem regra na tabela de ICMS — cadastre a alíquota, a ST ou uma fórmula própria',
  PENDENTE: 'Sem o XML completo não há o que calcular ainda',
};

export type FronteiraRuleKind = 'ALIQUOTA_INTERNA' | 'AGREGACAO' | 'ST_MVA' | 'SIMPLES_PERCENTUAL' | 'FORMULA';

export const RULE_KIND_LABELS: Record<FronteiraRuleKind, string> = {
  ALIQUOTA_INTERNA: 'Alíquota interna de PE',
  AGREGACAO: 'Mercadoria com agregação (sem carga líquida)',
  ST_MVA: 'ST com encerramento (MVA)',
  SIMPLES_PERCENTUAL: 'Carga líquida (credenciamento / Simples)',
  FORMULA: 'Fórmula própria',
};

/** O cálculo padrão que uma fórmula própria substitui; vazio = qualquer um. */
export type FronteiraAplicaEm = 'SEM_ENCERRAMENTO' | 'MERCADORIA' | 'ST' | 'CARGA_LIQUIDA' | 'USO_CONSUMO';

export const APLICA_EM_LABELS: Record<FronteiraAplicaEm, string> = {
  SEM_ENCERRAMENTO: 'Sem encerramento (regime normal)',
  MERCADORIA: 'Mercadoria com agregação',
  ST: 'Com encerramento (ST)',
  CARGA_LIQUIDA: 'Carga líquida (credenciamento / Simples)',
  USO_CONSUMO: 'Uso e consumo / ativo',
};

export interface FronteiraRuleDTO {
  id: string;
  companyId?: string | null;
  kind: FronteiraRuleKind;
  descricao?: string | null;
  ncm?: string | null;
  cest?: string | null;
  codigoProduto?: string | null;
  cnpjFornecedor?: string | null;
  aliquota?: number | null;
  mva?: number | null;
  percentual?: number | null;
  /** Mercadoria com agregação: % sobre a base (20 = coeficiente 1,20). */
  agregacao?: number | null;
  /** SUL_SUDESTE, DEMAIS ou vazio (qualquer origem). */
  regiaoOrigem?: string | null;
  /** true = só fornecedor do Simples; false = só quem não é; vazio = qualquer. */
  fornecedorSimples?: boolean | null;
  formula?: string | null;
  /** Fórmula: o cálculo padrão que ela substitui (vazio = todos; devolução, remessa e ST retido nunca). */
  aplicaEm?: FronteiraAplicaEm | null;
  fundamento?: string | null;
  link?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  enabled: boolean;
  reviewed: boolean;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdBy?: string | null;
  createdDate?: string | null;
}

export type FronteiraRuleInput = Omit<FronteiraRuleDTO, 'id' | 'enabled' | 'reviewed' | 'reviewedBy' | 'reviewedAt' | 'createdBy' | 'createdDate'>;

export interface FormulaCheckDTO {
  ok: boolean;
  message?: string | null;
  /** Campo → o que ele é. */
  variables: Record<string, string>;
  /** O valor da fórmula com {@link valores}. */
  resultado?: number | null;
  valores: Record<string, number>;
  /** true = valores de exemplo; false = os do item da nota. */
  exemplo: boolean;
}

/** Operadores e funções aceitos na fórmula — para o painel de ajuda. */
export const FORMULA_OPERATORS: { token: string; insert: string; label: string }[] = [
  { token: '+', insert: ' + ', label: 'soma' },
  { token: '−', insert: ' - ', label: 'subtrai (ou -)' },
  { token: '×', insert: ' * ', label: 'multiplica (ou *)' },
  { token: '÷', insert: ' / ', label: 'divide (ou /)' },
  { token: '( )', insert: '()', label: 'agrupa — resolve primeiro o que está dentro' },
  { token: '%', insert: '%', label: 'percentual: 5,5% = 0,055' },
];

export const FORMULA_FUNCTIONS: { token: string; insert: string; label: string }[] = [
  { token: 'min(a; b)', insert: 'min(; )', label: 'o menor dos valores' },
  { token: 'max(a; b)', insert: 'max(; )', label: 'o maior dos valores — ex.: max(conta; 0) nunca fica negativo' },
  { token: 'arred(x)', insert: 'arred()', label: 'arredonda a 2 casas' },
];

export const FORMULA_EXAMPLES: { label: string; formula: string }[] = [
  { label: 'Padrão do regime normal, como o e-Fisco', formula: 'partida * interna - credito' },
  { label: 'Mercadoria com agregação, como o e-Fisco', formula: 'partida * (1 + agregacao) * interna - credito' },
  { label: 'Diferencial de alíquotas simples', formula: 'partida * (interna - inter)' },
  { label: 'Carga líquida fixa de 5,5%', formula: 'partida * 5,5%' },
  { label: 'Carga líquida da regra', formula: 'partida * percentual' },
  { label: 'ST com MVA ajustada', formula: 'partida * (1 + mva_ajustada) * interna - credito' },
  { label: 'Base dupla (por dentro)', formula: '(partida - icms_origem) / (1 - interna) * interna - credito' },
  { label: 'Diferencial menos o crédito do Simples, nunca negativo', formula: 'max(partida * (interna - inter) - credito_sn; 0)' },
];

export interface FronteiraItemCalcDTO {
  numeroItem: number;
  codigo?: string | null;
  descricao?: string | null;
  ncm?: string | null;
  cfop?: string | null;
  tratamento: string;
  tratamentoLabel: string;
  partida: number;
  valor: number;
  minimo: number;
  maximo: number;
  conferido: boolean;
  regras: string[];
  memoria: string[];
  semRegraMotivo?: string | null;
  /** Os valores do item que uma fórmula pode usar (para testar a fórmula nele). */
  variaveis: Record<string, number>;
}

export interface FronteiraNoteCalcDTO {
  valor: number;
  minimo: number;
  maximo: number;
  conferido: boolean;
  semRegra: boolean;
  itens: FronteiraItemCalcDTO[];
}

export interface FronteiraPeriodDTO {
  periodo: string;
  numeroExtrato?: string | null;
  icmsDevido: number;
  notas: number;
  importedAt: string;
}

export interface FronteiraExtractDTO {
  periodo: string;
  numeroExtrato?: string | null;
  inscricaoEstadual?: string | null;
  razaoSocial?: string | null;
  are?: string | null;
  codigoReceita?: string | null;
  credenciamentoAntecipacao?: string | null;
  credenciamentoInterno?: string | null;
  dataVencimento?: string | null;
  emitidoEm?: string | null;
  icmsARecolher?: number | null;
  icmsPago?: number | null;
  icmsEmProcesso?: number | null;
  icmsAutuado?: number | null;
  icmsMandadoSeguranca?: number | null;
  icmsAnistiado?: number | null;
  icmsRegDebito?: number | null;
  fileName?: string | null;
  importedAt: string;
  importedBy: string;
}

export interface FronteiraSummaryDTO {
  notas: number;
  valorNotas: number;
  icmsDevido: number;
  /** % sobre o valor da NF que a maioria das notas pagou (o do credenciamento); null com poucas notas. */
  taxaPredominante?: number | null;
  foraDaTaxa: number;
  icmsForaDaTaxa: number;
  /** Quanto as notas fora da taxa pagaram acima (ou abaixo) da taxa predominante. */
  diferencaForaDaTaxa: number;
  semXml: number;
  valorDiferente: number;
  canceladas: number;
  comDivergencia: number;
  semCobranca: number;
  icmsCalculado: number;
  /** Soma do que o e-Fisco cobrou acima do cálculo do Taxify. */
  cobradoAMais: number;
  /** Soma do que cobrou abaixo (ou não cobrou) — risco, não economia. */
  cobradoAMenos: number;
  confere: number;
  aMais: number;
  aMenos: number;
  naoCalculou: number;
  semRegra: number;
  pendentes: number;
  aConferir: number;
}

export interface FronteiraNoteRefDTO {
  documentId: string;
  emitenteNome?: string | null;
  issueDate?: string | null;
  valorTotalNota?: number | null;
  naturezaOperacao?: string | null;
  cfops: string[];
  cancelada: boolean;
  divergencias?: FiscalXmlDivergenceSummaryDTO | null;
}

export interface FronteiraLineDTO {
  linha: number;
  registro?: string | null;
  dataPassagem?: string | null;
  numeroNota: string;
  uf?: string | null;
  cnpjEmitente: string;
  valorNota: number;
  icmsDevido: number;
  /** ICMS devido / valor da NF, em %. */
  taxa?: number | null;
  diferencaParaTaxa?: number | null;
  flags: FronteiraFlag[];
  nota?: FronteiraNoteRefDTO | null;
  resultado: FronteiraResultado;
  /** false = usou regra ainda "a conferir". */
  conferido: boolean;
  /** ICMS cobrado − cálculo do Taxify. */
  diferenca?: number | null;
  calculo?: FronteiraNoteCalcDTO | null;
}

export interface FronteiraUnchargedDTO {
  documentId: string;
  numero?: string | null;
  emitenteNome?: string | null;
  emitenteCnpj?: string | null;
  emitenteUf?: string | null;
  issueDate?: string | null;
  valorTotalNota?: number | null;
  cfops: string[];
  /** Prévia: o ICMS que o Taxify calcula para a nota. */
  calculo?: FronteiraNoteCalcDTO | null;
}

export interface FronteiraReportDTO {
  companyId: string;
  companyName: string;
  periodo: string;
  /** null = nenhum extrato importado para o período. */
  extract?: FronteiraExtractDTO | null;
  summary?: FronteiraSummaryDTO | null;
  lines: FronteiraLineDTO[];
  semCobranca: FronteiraUnchargedDTO[];
  /** Soma da prévia das entradas que o extrato ainda não cobra. */
  previaIcms: number;
  periodos: FronteiraPeriodDTO[];
}
