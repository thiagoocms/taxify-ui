/**
 * Levantamento de quem pode ter crédito presumido de CBS sobre o estoque (spec 2026-11-27-credito-estoque-cbs-
 * levantamento, F5a). Contrato de `/reform/stock-credit` e de `GET /reform/features`. Nomes dos campos em inglês
 * (tradução direta da seção 7 da spec); valores de enum e codes de erro seguem a spec.
 *
 * **Não é cálculo de crédito** (CE-RN-13): classificação, motivo, compras, cobertura e memória chegam prontos do
 * backend. A tela só formata (R$, datas, CNPJ) e nunca reclassifica.
 */
import { TaxRegime } from './tax-assessment.model';

/** Ano de referência: só 2026 nesta fase (CE-RN-01). */
export const STOCK_CREDIT_YEAR = 2026;

export type StockCreditClassification = 'HYPOTHESIS_I' | 'HYPOTHESIS_II_III' | 'NO_REGIME' | 'OUT_OF_SCOPE';
export type StockCreditStatus = 'NOT_EVALUATED' | 'NOTIFIED' | 'INVENTORY_RECEIVED' | 'DISCARDED';
export type StockCreditCoverage = 'COMPLETE' | 'PARTIAL' | 'NO_INBOUND';
export type StockCreditRegimeSource = 'HISTORY' | 'REGISTRATION';

/** Ordens aceitas em `sort` (CE-RN-11); sem `sort`, a API usa a ordem padrão (classificação, compras, nome). */
export type StockCreditSortField = 'classification' | 'yearPurchases' | 'companyName' | 'statusChangedAt';
export type StockCreditSort = `${StockCreditSortField},${'asc' | 'desc'}`;

export interface StockCreditRowDTO {
  companyId: string;
  companyName: string;
  /** 14 dígitos, sem máscara. */
  cnpj: string | null;
  referenceRegime: TaxRegime | null;
  nextYearRegime: TaxRegime | null;
  classification: StockCreditClassification;
  classificationReason: string;
  yearPurchases: number;
  purchaseItems: number;
  inboundInvoices: number;
  monthsWithInbound: number;
  monthsEvaluated: number;
  coverage: StockCreditCoverage;
  firstInbound: string | null;
  lastInbound: string | null;
  status: StockCreditStatus;
  statusChangedBy: string | null;
  statusChangedAt: string | null;
  /** Observação do contato (CE-RN-10); a resposta do PUT de situação também traz. */
  note: string | null;
  version: number;
  calculatedAt: string | null;
}

export interface StockCreditMonthDTO {
  /** "2026-01". */
  month: string;
  amount: number;
  invoices: number;
}

export interface StockCreditBreakdownDTO {
  amount: number;
  items: number;
}

export interface StockCreditDetailDTO extends StockCreditRowDTO {
  notice: string | null;
  referenceRegimeSince: string | null;
  referenceRegimeSource: StockCreditRegimeSource | null;
  purchasesByMonth: StockCreditMonthDTO[];
  purchasesByPisCst: (StockCreditBreakdownDTO & { cst: string })[];
  topNcm: (StockCreditBreakdownDTO & { ncm: string })[];
  /** Memória de cálculo pronta (CE-RN-14), uma linha por item. */
  memory: string[];
  /** Quando o cooldown do "Atualizar agora" libera; nulo = já liberado. */
  refreshAvailableAt: string | null;
  closed: boolean;
}

export interface StockCreditSummaryDTO {
  companies: number;
  /** Empresas acessíveis sem linha calculada (não entram na página). */
  notCalculated: number;
  byClassification: Partial<Record<StockCreditClassification, number>>;
  byStatus: Partial<Record<StockCreditStatus, number>>;
  yearPurchasesTotal: number;
  oldestCalculatedAt: string | null;
}

export interface StockCreditPageDTO {
  content: StockCreditRowDTO[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface StockCreditListDTO {
  notice: string | null;
  summary: StockCreditSummaryDTO;
  page: StockCreditPageDTO;
}

export interface StockCreditStatusSaveDTO {
  year: number;
  status: StockCreditStatus;
  note: string | null;
  version: number;
}

export interface StockCreditEventDTO {
  from: StockCreditStatus | null;
  to: StockCreditStatus;
  note: string | null;
  changedBy: string;
  changedAt: string;
}

/** Filtros da lista (refletidos na URL). */
export interface StockCreditFilter {
  classification: StockCreditClassification[];
  status: StockCreditStatus[];
  coverage: StockCreditCoverage[];
  search: string;
  sort: StockCreditSort | null;
  page: number;
}

// ------------------------------------------------------- Recursos da Reforma --

/** `GET /reform/features` (CE-RN-15): o que o menu "Reforma Tributária" mostra. Outras specs acrescentam campos. */
export interface ReformFeaturesDTO {
  stockCredit?: {
    enabled: boolean;
    closed: boolean;
    /** "2027-06-30". */
    closesOn: string | null;
  } | null;
}

// --------------------------------------------------------------- Rótulos --

/** Texto fixo da CE-RN-13: de reserva, quando a API não manda o `notice`. */
export const STOCK_CREDIT_NOTICE =
  'Levantamento de quem pode ter direito ao crédito presumido de CBS sobre o estoque de 31/12/2026 (LC 214/2025, art. 381; Decreto 12.955/2026), pelo regime cadastrado. Não é cálculo de crédito: a elegibilidade de cada bem e o valor dependem do inventário e da análise do responsável técnico.';

export const STOCK_CREDIT_CLASSIFICATION_ORDER: StockCreditClassification[] = ['HYPOTHESIS_I', 'HYPOTHESIS_II_III', 'NO_REGIME', 'OUT_OF_SCOPE'];

export const STOCK_CREDIT_CLASSIFICATION_LABELS: Record<StockCreditClassification, string> = {
  HYPOTHESIS_I: 'Hipótese I',
  HYPOTHESIS_II_III: 'Hipóteses II e III',
  NO_REGIME: 'Sem regime',
  OUT_OF_SCOPE: 'Fora',
};

export const STOCK_CREDIT_CLASSIFICATION_HINTS: Record<StockCreditClassification, string> = {
  HYPOTHESIS_I: 'Lucro Presumido em dez/2026 (art. 381, I).',
  HYPOTHESIS_II_III: 'Lucro Real em dez/2026 (art. 381, II e III); só parte dos bens pode entrar.',
  NO_REGIME: 'Regime não informado: cadastre o regime da empresa para classificar.',
  OUT_OF_SCOPE: 'Simples Nacional/MEI em dez/2026 ou a partir de jan/2027.',
};

export const STOCK_CREDIT_CLASSIFICATION_TONES: Record<StockCreditClassification, string> = {
  HYPOTHESIS_I: 'ok',
  HYPOTHESIS_II_III: 'info',
  NO_REGIME: 'warn',
  OUT_OF_SCOPE: '',
};

export const STOCK_CREDIT_STATUS_ORDER: StockCreditStatus[] = ['NOT_EVALUATED', 'NOTIFIED', 'INVENTORY_RECEIVED', 'DISCARDED'];

export const STOCK_CREDIT_STATUS_LABELS: Record<StockCreditStatus, string> = {
  NOT_EVALUATED: 'Não avaliada',
  NOTIFIED: 'Avisada',
  INVENTORY_RECEIVED: 'Inventário recebido',
  DISCARDED: 'Descartada',
};

export const STOCK_CREDIT_STATUS_TONES: Record<StockCreditStatus, string> = {
  NOT_EVALUATED: 'warn',
  NOTIFIED: 'info',
  INVENTORY_RECEIVED: 'ok',
  DISCARDED: '',
};

export const STOCK_CREDIT_COVERAGE_ORDER: StockCreditCoverage[] = ['COMPLETE', 'PARTIAL', 'NO_INBOUND'];

export const STOCK_CREDIT_COVERAGE_LABELS: Record<StockCreditCoverage, string> = {
  COMPLETE: 'Completa',
  PARTIAL: 'Parcial',
  NO_INBOUND: 'Sem entradas',
};

export const STOCK_CREDIT_COVERAGE_HINTS: Record<StockCreditCoverage, string> = {
  COMPLETE: 'Todos os meses avaliados de 2026 têm nota de entrada no Taxify.',
  PARTIAL: 'Algum mês avaliado de 2026 não tem nota de entrada no Taxify: as compras podem estar subestimadas.',
  NO_INBOUND: 'Nenhuma nota de entrada de 2026 no Taxify.',
};

export const STOCK_CREDIT_COVERAGE_TONES: Record<StockCreditCoverage, string> = {
  COMPLETE: 'ok',
  PARTIAL: 'warn',
  NO_INBOUND: 'danger',
};

export const STOCK_CREDIT_SORT_LABELS: Record<StockCreditSort, string> = {
  'classification,asc': 'Classificação',
  'yearPurchases,desc': 'Maiores compras primeiro',
  'yearPurchases,asc': 'Menores compras primeiro',
  'companyName,asc': 'Nome da empresa',
  'statusChangedAt,desc': 'Situação alterada mais recente',
  'statusChangedAt,asc': 'Situação alterada mais antiga',
  'classification,desc': 'Classificação (inversa)',
  'companyName,desc': 'Nome da empresa (Z a A)',
};

/** Ordens oferecidas no seletor (as demais da URL continuam aceitas). */
export const STOCK_CREDIT_SORT_OPTIONS: StockCreditSort[] = [
  'yearPurchases,desc',
  'companyName,asc',
  'statusChangedAt,desc',
  'classification,asc',
];

export const STOCK_CREDIT_REGIME_SOURCE_LABELS: Record<StockCreditRegimeSource, string> = {
  HISTORY: 'histórico de regime',
  REGISTRATION: 'cadastro da empresa',
};

/** Limite da observação (CE-RN-10). */
export const STOCK_CREDIT_NOTE_MAX = 500;
/** Busca: mínimo de caracteres que a API aceita (seção 7). */
export const STOCK_CREDIT_SEARCH_MIN = 3;

export const STOCK_CREDIT_ERRORS = {
  disabled: 'error.reform.stock.disabled',
  yearInvalid: 'error.reform.stock.year.invalid',
  filterInvalid: 'error.reform.stock.filter.invalid',
  notFound: 'error.reform.stock.survey.not.found',
  cooldown: 'error.reform.stock.refresh.cooldown',
  /** "Atualizar agora" falhou no cálculo (ex.: regime inválido no histórico); o cooldown não é consumido. */
  calculationFailed: 'error.reform.stock.calculation.failed',
  statusInvalid: 'error.reform.stock.status.invalid',
  noteTooLong: 'error.reform.stock.note.too.long',
  conflict: 'error.reform.stock.status.conflict',
  closed: 'error.reform.stock.survey.closed',
  companyNotFound: 'error.Company.not.found',
} as const;

/** Textos de reserva (seção 7), usados só quando a API não manda a `message`. */
export const STOCK_CREDIT_ERROR_MESSAGES: Record<string, string> = {
  [STOCK_CREDIT_ERRORS.disabled]: 'Recurso não disponível.',
  [STOCK_CREDIT_ERRORS.yearInvalid]: 'Ano de referência inválido. Use 2026.',
  [STOCK_CREDIT_ERRORS.filterInvalid]: 'Filtro inválido.',
  [STOCK_CREDIT_ERRORS.notFound]: 'O levantamento desta empresa ainda não foi calculado. Use Atualizar agora.',
  [STOCK_CREDIT_ERRORS.cooldown]: 'Aguarde alguns minutos para atualizar de novo.',
  [STOCK_CREDIT_ERRORS.calculationFailed]:
    'Não foi possível calcular o levantamento desta empresa. Confira o regime tributário cadastrado e tente de novo.',
  [STOCK_CREDIT_ERRORS.statusInvalid]: 'Situação inválida.',
  [STOCK_CREDIT_ERRORS.noteTooLong]: 'A observação pode ter até 500 caracteres.',
  [STOCK_CREDIT_ERRORS.conflict]: 'Outra pessoa alterou esta empresa. Recarregue e tente de novo.',
  [STOCK_CREDIT_ERRORS.closed]: 'O levantamento foi encerrado em 30/06/2027. Os dados continuam disponíveis para consulta.',
  [STOCK_CREDIT_ERRORS.companyNotFound]: 'Empresa não encontrada (pode ter sido excluída ou não está na sua carteira).',
};
