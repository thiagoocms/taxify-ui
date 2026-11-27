import { convertToParamMap } from '@angular/router';
import { EMPTY_FILTER, filterFromParams, hasActiveFilter, paramsFromFilter, sameFilter, toggleValue } from './stock-credit-url';
import { STOCK_CREDIT_CLASSIFICATION_ORDER } from '../../../core/models/stock-credit.model';

describe('crédito de estoque: filtros na URL', () => {
  it('restaura a tela pela URL (lista repetida ou com vírgula, ordem canônica)', () => {
    const filter = filterFromParams(
      convertToParamMap({ classificacao: ['hypothesis_ii_iii,HYPOTHESIS_I'], situacao: 'NOTIFIED', cobertura: 'PARTIAL', busca: 'textil', sort: 'yearPurchases,desc', page: '2' }),
    );
    expect(filter).toEqual({
      classification: ['HYPOTHESIS_I', 'HYPOTHESIS_II_III'],
      status: ['NOTIFIED'],
      coverage: ['PARTIAL'],
      search: 'textil',
      sort: 'yearPurchases,desc',
      page: 2,
    });
  });

  it('valor desconhecido usa o padrão (inclusive chaves do protótipo no sort)', () => {
    const filter = filterFromParams(convertToParamMap({ classificacao: 'XYZ', sort: 'toString', page: '-3' }));
    expect(filter).toEqual(EMPTY_FILTER);
    expect(filterFromParams(convertToParamMap({ sort: 'nome,asc', page: 'abc' }))).toEqual(EMPTY_FILTER);
  });

  it('o padrão sai da URL e a ida e volta é estável', () => {
    expect(paramsFromFilter(EMPTY_FILTER)).toEqual({ classificacao: null, situacao: null, cobertura: null, busca: null, sort: null, page: null });
    const filter = { ...EMPTY_FILTER, status: ['NOT_EVALUATED' as const], page: 1 };
    expect(sameFilter(filterFromParams(convertToParamMap(paramsFromFilter(filter))), filter)).toBeTrue();
  });

  it('filtro ativo não conta ordem nem página', () => {
    expect(hasActiveFilter({ ...EMPTY_FILTER, sort: 'companyName,asc', page: 3 })).toBeFalse();
    expect(hasActiveFilter({ ...EMPTY_FILTER, search: 'abc' })).toBeTrue();
  });

  it('cartões ligam e desligam a classificação', () => {
    expect(toggleValue(['OUT_OF_SCOPE'], 'HYPOTHESIS_I', STOCK_CREDIT_CLASSIFICATION_ORDER)).toEqual(['HYPOTHESIS_I', 'OUT_OF_SCOPE']);
    expect(toggleValue(['OUT_OF_SCOPE'], 'OUT_OF_SCOPE', STOCK_CREDIT_CLASSIFICATION_ORDER)).toEqual([]);
  });
});
