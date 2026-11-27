import { HttpErrorResponse } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { IbsCbsRateChangeDTO, IbsCbsRateDTO } from '../../../core/models/ibs-cbs-rate.model';
import {
  changeLines,
  httpsValidator,
  nextFreeYear,
  parseRate,
  rateFormRules,
  rateInputText,
  rateSaveErrorView,
  rateValidator,
} from './ibs-cbs-rate-view';

function httpError(status: number, body: object = {}): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('console de alíquotas: regras de exibição (F-AL-1)', () => {
  it('AL-RN-03: o que cada status exige', () => {
    expect(rateFormRules('LAW')).toEqual({ ratesRequired: true, basisRequired: true });
    expect(rateFormRules('ESTIMATE')).toEqual({ ratesRequired: true, basisRequired: false });
    expect(rateFormRules('PENDING')).toEqual({ ratesRequired: false, basisRequired: false });
  });

  it('alíquota aceita vírgula, nunca arredonda (mais de 4 casas = inválida)', () => {
    expect(parseRate('0,9')).toBe(0.9);
    expect(parseRate('11.3468')).toBe(11.3468);
    expect(parseRate('')).toBeNull();
    expect(parseRate('0,12345')).toBeNaN(); // CT-AL-08
    expect(parseRate('abc')).toBeNaN();
    expect(rateInputText(0.9)).toBe('0,9');
    expect(rateInputText(null)).toBe('');
  });

  it('CT-AL-08/09: validador de 0 a 100 com até 4 casas', () => {
    const valid = (value: string) => rateValidator(new FormControl(value)) === null;
    expect(valid('0')).toBeTrue();
    expect(valid('100')).toBeTrue();
    expect(valid('100,0001')).toBeFalse();
    expect(valid('-1')).toBeFalse();
    expect(valid('0,12345')).toBeFalse();
    expect(valid('')).toBeTrue();
  });

  it('CT-AL-11: link precisa começar com https://', () => {
    expect(httpsValidator(new FormControl('http://exemplo.test'))).not.toBeNull();
    expect(httpsValidator(new FormControl('https://exemplo.test/ato'))).toBeNull();
    expect(httpsValidator(new FormControl(''))).toBeNull();
  });

  it('400 error.reform.rate.invalid marca o campo do invalidField', () => {
    const view = rateSaveErrorView(httpError(400, { code: 'error.reform.rate.invalid', invalidField: 'cbsRate' }));
    expect(view.fields).toEqual(['cbsRate']);
    expect(view.message).toBe('Alíquota inválida: use de 0 a 100, com até 4 casas decimais.');
    expect(view.conflict).toBeFalse();
  });

  it('mostra a message da API quando vem; basis.required marca fundamento e link', () => {
    const view = rateSaveErrorView(httpError(400, { code: 'error.reform.rate.basis.required', message: 'Mensagem da API.' }));
    expect(view.message).toBe('Mensagem da API.');
    expect(view.fields).toEqual(['legalBasis', 'sourceUrl']);
  });

  it('basis.invalid (fundamento longo ou link sem https em status diferente de LAW) marca os dois campos', () => {
    const view = rateSaveErrorView(httpError(400, { code: 'error.reform.rate.basis.invalid' }));
    expect(view.fields).toEqual(['legalBasis', 'sourceUrl']);
    expect(view.message).toContain('https://');
  });

  it('404 not.found no PUT pede para recarregar', () => {
    expect(rateSaveErrorView(httpError(404, { code: 'error.reform.rate.not.found' })).message).toBe('Ano não cadastrado. Recarregue a lista.');
  });

  it('409 é conflito (a lista recarrega o ano)', () => {
    const view = rateSaveErrorView(httpError(409, { code: 'error.reform.rate.conflict', currentVersion: 2 }));
    expect(view.conflict).toBeTrue();
    expect(view.message).toContain('Outra pessoa alterou este ano');
  });

  it('CA-AL-08: 403 explica que é só do admin da plataforma', () => {
    expect(rateSaveErrorView(httpError(403)).message).toContain('administrador da plataforma');
  });

  it('histórico: só os campos que mudaram, com antes e depois', () => {
    const event: IbsCbsRateChangeDTO = {
      action: 'UPDATED', statusBefore: 'ESTIMATE', statusAfter: 'LAW', cbsBefore: 8.8, cbsAfter: 8.8,
      ibsStateBefore: 0.1, ibsStateAfter: 0.1, ibsMunicipalBefore: 0, ibsMunicipalAfter: 0,
      legalBasisAfter: 'Ato', sourceUrlAfter: 'https://exemplo.test/ato', changedBy: 'admin', changedAt: '2026-12-20T10:00:00-03:00',
    };
    expect(changeLines(event)).toEqual(['Status: Estimativa → Lei']);
    expect(changeLines({ ...event, action: 'CREATED', statusBefore: null, cbsBefore: null })).toEqual([
      'Status: Lei',
      'CBS: 8,8%',
      'IBS UF: 0,1%',
      'IBS Mun: 0%',
    ]);
  });

  it('"Novo ano" sugere o primeiro ano livre de 2026 a 2040', () => {
    const row = (year: number) => ({ year }) as IbsCbsRateDTO;
    expect(nextFreeYear([row(2026)])).toBe(2027);
    expect(nextFreeYear([])).toBe(2026);
    expect(nextFreeYear(Array.from({ length: 15 }, (_, i) => row(2026 + i)))).toBeNull();
  });
});
