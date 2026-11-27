import { IbsCbsRateDTO, IbsCbsRatesResponseDTO } from '../../../core/models/ibs-cbs-rate.model';
import { formatPercent } from '../../../shared/utils/format';
import { missingLawFallbackText, missingLawNotices, rateReferenceText, yearOf, yearsInPeriod } from './ibs-cbs-reference';

const ROW_2026: IbsCbsRateDTO = {
  year: 2026, cbsRate: 0.9, ibsStateRate: 0.1, ibsMunicipalRate: 0, status: 'LAW', generatesFindings: true,
  legalBasis: 'LC 214/2025', sourceUrl: 'https://exemplo.test/ato',
};
// Números fictícios de teste (CT-AL-04).
const ROW_2027: IbsCbsRateDTO = {
  year: 2027, cbsRate: 8.8, ibsStateRate: 0.1, ibsMunicipalRate: 0, status: 'ESTIMATE', generatesFindings: false,
  legalBasis: null, sourceUrl: null,
};

describe('referência de IBS/CBS (F-AL-2)', () => {
  it('percentual com vírgula e sem zeros à direita', () => {
    expect(formatPercent(0.9)).toBe('0,9%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(11.3468)).toBe('11,3468%');
    expect(formatPercent(null)).toBe('—');
  });

  it('monta "Referência de {ano}: CBS x%, IBS UF y%, IBS Mun z% ({status})"', () => {
    expect(rateReferenceText(ROW_2026)).toBe('Referência de 2026: CBS 0,9%, IBS UF 0,1%, IBS Mun 0% (Lei)');
    expect(rateReferenceText({ ...ROW_2027, status: 'PENDING', ibsStateRate: null, ibsMunicipalRate: null })).toBe(
      'Referência de 2027: CBS 8,8%, IBS UF —, IBS Mun — (Pendente)',
    );
  });

  it('ano lido do texto, sem fuso (31/12 23:59 continua no ano)', () => {
    expect(yearOf('2026-12-31T23:59:00')).toBe(2026);
    expect(yearOf('2027-01-01')).toBe(2027);
    expect(yearOf(null)).toBeNull();
  });

  it('anos do período, a partir de 2026, em qualquer ordem de datas', () => {
    expect(yearsInPeriod('2026-12-01', '2027-01-31')).toEqual([2026, 2027]);
    expect(yearsInPeriod('2027-01-31', '2026-12-01')).toEqual([2026, 2027]);
    expect(yearsInPeriod('2025-11-01', '2025-11-30')).toEqual([]);
    expect(yearsInPeriod('2026-05-01', '')).toEqual([2026]);
    expect(yearsInPeriod(null, null)).toEqual([]);
  });

  it('CA-AL-07: período de 2027 sem LAW mostra o aviso com o texto do backend', () => {
    const response: IbsCbsRatesResponseDTO = {
      years: [ROW_2026, ROW_2027],
      warnings: [{ year: 2027, type: 'NO_LAW', text: 'Texto do backend para 2027.' }],
    };
    expect(missingLawNotices(response, [2027])).toEqual([{ year: 2027, text: 'Texto do backend para 2027.' }]);
    expect(missingLawNotices(response, [2026])).toEqual([]);
  });

  it('ano sem linha e sem aviso do backend (ex.: 2029) usa o texto da AL-RN-05', () => {
    const response: IbsCbsRatesResponseDTO = { years: [ROW_2026], warnings: [] };
    expect(missingLawNotices(response, [2029])).toEqual([{ year: 2029, text: missingLawFallbackText(2029) }]);
    expect(missingLawFallbackText(2029)).toContain('2029: sem alíquota oficial cadastrada');
  });

  it('quem decide é o generatesFindings: LAW sem as três alíquotas também avisa', () => {
    const response: IbsCbsRatesResponseDTO = { years: [{ ...ROW_2026, generatesFindings: false }], warnings: [] };
    expect(missingLawNotices(response, [2026]).length).toBe(1);
  });

  it('sem resposta da API, nenhum aviso (não afirma o que não sabe)', () => {
    expect(missingLawNotices(null, [2027])).toEqual([]);
  });
});
