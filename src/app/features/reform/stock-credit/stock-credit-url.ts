import { ParamMap, Params } from '@angular/router';
import {
  STOCK_CREDIT_CLASSIFICATION_ORDER,
  STOCK_CREDIT_COVERAGE_ORDER,
  STOCK_CREDIT_SORT_LABELS,
  STOCK_CREDIT_STATUS_ORDER,
  StockCreditFilter,
  StockCreditSort,
} from '../../../core/models/stock-credit.model';

/**
 * Filtros do levantamento na URL: `?classificacao=HYPOTHESIS_I,HYPOTHESIS_II_III&situacao=NOT_EVALUATED&cobertura=PARTIAL
 * &busca=textil&sort=yearPurchases,desc&page=2`, no mesmo formato do painel de captura (filtros com nome em pt,
 * `sort` e `page` como na API, página começando em 0). A API recebe os nomes em inglês
 * ({@link StockCreditService.filterParams}). Valor desconhecido é ignorado (fica o padrão).
 */

export const MAX_PAGE = 100000;

export const EMPTY_FILTER: StockCreditFilter = {
  classification: [],
  status: [],
  coverage: [],
  search: '',
  sort: null,
  page: 0,
};

/** Lista (repetida ou separada por vírgula), na ordem canônica, sem duplicatas e sem valores desconhecidos. */
function listOf<T extends string>(params: ParamMap, name: string, order: readonly T[]): T[] {
  const values = new Set(
    params
      .getAll(name)
      .flatMap((value) => (value ?? '').split(','))
      .map((value) => value.trim().toUpperCase()),
  );
  return order.filter((item) => values.has(item));
}

export function filterFromParams(params: ParamMap): StockCreditFilter {
  const sort = params.get('sort')?.trim() ?? '';
  const page = Number(params.get('page'));
  return {
    classification: listOf(params, 'classificacao', STOCK_CREDIT_CLASSIFICATION_ORDER),
    status: listOf(params, 'situacao', STOCK_CREDIT_STATUS_ORDER),
    coverage: listOf(params, 'cobertura', STOCK_CREDIT_COVERAGE_ORDER),
    search: (params.get('busca') ?? '').slice(0, 100),
    sort: Object.prototype.hasOwnProperty.call(STOCK_CREDIT_SORT_LABELS, sort) ? (sort as StockCreditSort) : null,
    page: Number.isInteger(page) && page > 0 && page <= MAX_PAGE ? page : 0,
  };
}

/** O que está no padrão sai da URL (null remove com `queryParamsHandling: 'merge'`). */
export function paramsFromFilter(filter: StockCreditFilter): Params {
  return {
    classificacao: filter.classification.length ? filter.classification.join(',') : null,
    situacao: filter.status.length ? filter.status.join(',') : null,
    cobertura: filter.coverage.length ? filter.coverage.join(',') : null,
    busca: filter.search.trim() || null,
    sort: filter.sort,
    page: filter.page > 0 ? filter.page : null,
  };
}

export function sameFilter(a: StockCreditFilter, b: StockCreditFilter): boolean {
  return JSON.stringify(paramsFromFilter(a)) === JSON.stringify(paramsFromFilter(b));
}

/** Algum filtro além da ordem e da página (para "Limpar filtros" e a mensagem de lista vazia). */
export function hasActiveFilter(filter: StockCreditFilter): boolean {
  return !!(filter.classification.length || filter.status.length || filter.coverage.length || filter.search.trim());
}

/** Liga ou desliga um valor de uma lista de filtro, mantendo a ordem canônica. */
export function toggleValue<T extends string>(current: T[], value: T, order: readonly T[]): T[] {
  const set = new Set(current);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return order.filter((item) => set.has(item));
}
