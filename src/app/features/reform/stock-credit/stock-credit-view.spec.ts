import { HttpErrorResponse } from '@angular/common/http';
import { READ_ONLY_HINT } from '../../../core/models/firm-access.model';
import {
  coverageText,
  csvFileName,
  isFuture,
  monthLabel,
  referenceRegimeText,
  refreshButtonView,
  statusEditView,
  stockCreditErrorView,
  timeOf,
  WriteContext,
} from './stock-credit-view';

const NOW = Date.parse('2026-12-10T10:04:00-03:00');
const ctx = (over: Partial<WriteContext> = {}): WriteContext => ({ canWrite: true, closed: false, readOnly: false, busy: false, now: NOW, ...over });
const httpError = (status: number, body: object = {}) => new HttpErrorResponse({ status, error: body });

describe('crédito de estoque: regras de exibição', () => {
  it('formata mês, hora e cobertura', () => {
    expect(monthLabel('2026-03')).toBe('mar/2026');
    expect(monthLabel('2026-12')).toBe('dez/2026');
    expect(timeOf('2026-12-10T10:10:00-03:00')).toBe('10:10');
    expect(coverageText({ monthsWithInbound: 2, monthsEvaluated: 11 })).toBe('2 de 11 meses com entrada'); // CA-CE-14
    expect(coverageText({ monthsWithInbound: 1, monthsEvaluated: 1 })).toBe('1 de 1 mês com entrada');
  });

  it('regime de referência com a origem (memória)', () => {
    expect(referenceRegimeText({ referenceRegime: 'LUCRO_PRESUMIDO', referenceRegimeSince: '2026-07-01', referenceRegimeSource: 'HISTORY' })).toBe(
      'Lucro Presumido desde 01/07/2026 (histórico de regime)',
    );
    expect(referenceRegimeText({ referenceRegime: null, referenceRegimeSince: null, referenceRegimeSource: 'REGISTRATION' })).toBe('Não informado (cadastro da empresa)');
  });

  it('CA-CE-10: "Atualizar agora" desabilitado até o cooldown liberar, com a hora', () => {
    const view = refreshButtonView({ refreshAvailableAt: '2026-12-10T10:10:00-03:00', closed: false }, ctx());
    expect(view).toEqual({ show: true, disabled: true, reason: 'Atualizado há pouco: disponível de novo às 10:10.' });
    expect(refreshButtonView({ refreshAvailableAt: '2026-12-10T10:00:00-03:00', closed: false }, ctx()).disabled).toBeFalse();
    expect(isFuture('lixo', NOW)).toBeFalse();
  });

  it('CA-CE-15: sem TAX_ASSESSMENT_CLOSE os botões de escrita não aparecem', () => {
    expect(refreshButtonView(null, ctx({ canWrite: false })).show).toBeFalse();
    expect(statusEditView(null, ctx({ canWrite: false })).show).toBeFalse();
  });

  it('encerrado e somente leitura: desabilitados com o motivo', () => {
    expect(refreshButtonView(null, ctx({ closed: true })).reason).toContain('encerrado em 30/06/2027');
    expect(statusEditView({ closed: true }, ctx()).disabled).toBeTrue();
    expect(statusEditView(null, ctx({ readOnly: true }))).toEqual({ show: true, disabled: true, reason: READ_ONLY_HINT });
  });

  it('cooldown: a mensagem da API mais a hora do retryAt (no topo do corpo)', () => {
    const view = stockCreditErrorView(
      httpError(409, { code: 'error.reform.stock.refresh.cooldown', message: 'Aguarde alguns minutos para atualizar de novo.', retryAt: '2026-12-10T10:10:00-03:00' }),
      'refresh',
    );
    expect(view.message).toBe('Aguarde alguns minutos para atualizar de novo. Disponível de novo às 10:10.');
  });

  it('sem message da API, usa o texto de reserva do code', () => {
    expect(stockCreditErrorView(httpError(409, { code: 'error.reform.stock.status.conflict' }), 'status')).toEqual(
      jasmine.objectContaining({ conflict: true, message: 'Outra pessoa alterou esta empresa. Recarregue e tente de novo.' }),
    );
    expect(stockCreditErrorView(httpError(404, { code: 'error.reform.stock.disabled' }), 'list').disabled).toBeTrue();
    expect(stockCreditErrorView(httpError(404, { code: 'error.reform.stock.survey.not.found' }), 'detail').notCalculated).toBeTrue();
    expect(stockCreditErrorView(httpError(400, { code: 'error.reform.stock.note.too.long' }), 'status').field).toBe('note');
  });

  it('cálculo que falhou: message da API ou o texto de reserva', () => {
    const fallback = stockCreditErrorView(httpError(409, { code: 'error.reform.stock.calculation.failed' }), 'refresh');
    expect(fallback.calculationFailed).toBeTrue();
    expect(fallback.message).toBe('Não foi possível calcular o levantamento desta empresa. Confira o regime tributário cadastrado e tente de novo.');
    expect(stockCreditErrorView(httpError(409, { code: 'error.reform.stock.calculation.failed', message: 'Regime inválido.' }), 'refresh').message).toBe('Regime inválido.');
  });

  it('403 de bloqueio recarrega a situação do escritório; 403 de permissão explica', () => {
    const blocked = stockCreditErrorView(httpError(403, { code: 'error.firm.access.blocked', firmStatus: 'BLOCKED' }), 'status');
    expect(blocked.reloadFirmAccess).toBeTrue();
    expect(stockCreditErrorView(httpError(403), 'status').message).toContain('só consulta');
  });

  it('nome do CSV: o do servidor ou o padrão com a data', () => {
    expect(csvFileName('attachment; filename="credito-estoque-2026-20261210.csv"', new Date())).toBe('credito-estoque-2026-20261210.csv');
    expect(csvFileName(null, new Date(2026, 11, 9))).toBe('credito-estoque-2026-20261209.csv');
  });
});
