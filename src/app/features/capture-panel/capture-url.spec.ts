import { convertToParamMap } from '@angular/router';
import { EMPTY_FILTER, filterFromParams, hasActiveFilter, paramsFromFilter, toggleStatus } from './capture-url';

describe('capture-url (filtros na URL, CP-RN-13)', () => {
  it('lê os filtros da URL e ignora valores desconhecidos', () => {
    const filter = filterFromParams(
      convertToParamMap({ situacao: ['ATRASADA', 'COM_ERRO', 'XYZ'], canal: 'SIEG', tipo: 'nada', page: '2', firmId: 'f1' }),
      'firm',
    );
    expect(filter.situacao).toEqual(['COM_ERRO', 'ATRASADA']); // ordem da CP-RN-08
    expect(filter.canal).toBe('SIEG');
    expect(filter.tipo).toBeNull();
    expect(filter.page).toBe(2);
    expect(filter.firmId).toBeNull(); // firmId só na plataforma
  });

  it('aceita situação separada por vírgula e firmId na plataforma', () => {
    const filter = filterFromParams(convertToParamMap({ situacao: 'EM_DIA,pendente', firmId: 'f1', page: '-3' }), 'platform');
    expect(filter.situacao).toEqual(['PENDENTE', 'EM_DIA']);
    expect(filter.firmId).toBe('f1');
    expect(filter.page).toBe(0);
    expect(filterFromParams(convertToParamMap({ page: '100001' }), 'firm').page).toBe(0); // a API daria 400
    expect(filterFromParams(convertToParamMap({ page: '100000' }), 'firm').page).toBe(100000);
  });

  it('o padrão sai da URL', () => {
    expect(paramsFromFilter(EMPTY_FILTER)).toEqual({
      situacao: null,
      canal: null,
      tipo: null,
      busca: null,
      incluirInativas: null,
      sort: null,
      page: null,
      firmId: null,
    });
    const params = paramsFromFilter({ ...EMPTY_FILTER, situacao: ['COM_ERRO'], canal: 'SIEG', incluirInativas: true, sort: 'name', page: 1 });
    expect(params['situacao']).toEqual(['COM_ERRO']);
    expect(params['incluirInativas']).toBe('true');
    expect(params['sort']).toBe('name');
    expect(params['page']).toBe(1);
  });

  it('cartão do resumo liga e desliga a situação', () => {
    expect(toggleStatus([], 'COM_ERRO')).toEqual(['COM_ERRO']);
    expect(toggleStatus(['COM_ERRO', 'PENDENTE'], 'COM_ERRO')).toEqual(['PENDENTE']);
    expect(hasActiveFilter(EMPTY_FILTER)).toBeFalse();
    expect(hasActiveFilter({ ...EMPTY_FILTER, page: 3 })).toBeFalse();
    expect(hasActiveFilter({ ...EMPTY_FILTER, busca: 'textil' })).toBeTrue();
  });
});
