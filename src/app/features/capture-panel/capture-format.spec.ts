import { HttpErrorResponse } from '@angular/common/http';
import { displayPosition } from '../../core/models/capture-panel.model';
import {
  failureText,
  formatMinutes,
  observedLapText,
  queueHealthView,
  shortDateTime,
  shortMonth,
  syncNowErrorView,
  theoreticalLapText,
} from './capture-format';

function httpError(status: number, body: object): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('capture-format', () => {
  it('posição da API começa em 0; a tela soma 1 (CT-CP-09, CT-CP-35, CA-CP-13)', () => {
    expect(displayPosition(0)).toBe(1);
    expect(displayPosition(37)).toBe(38);
    expect(displayPosition(41)).toBe(42);
    expect(displayPosition(null)).toBeNull();
  });

  it('volta teórica em horas e minutos (CT-CP-32, CT-CP-33)', () => {
    expect(formatMinutes(750)).toBe('12 h 30 min');
    expect(formatMinutes(1500)).toBe('25 h');
    expect(formatMinutes(45)).toBe('45 min');
    expect(theoreticalLapText(750)).toBe('Pelo menos 12 h 30 min');
    expect(theoreticalLapText(null)).toBeNull();
  });

  it('volta observada e volta incompleta (CT-CP-34, CA-CP-06)', () => {
    expect(observedLapText(1080, 0)).toBe('18 h');
    expect(observedLapText(60, 282)).toBe('Volta incompleta: 282 empresas nunca tentadas');
    expect(observedLapText(null, null)).toBeNull();
    // ADMIN do escritório: o backend manda nulo e a tela não mostra a volta, nem a "incompleta".
    expect(observedLapText(null, 3)).toBeNull();
    expect(observedLapText(null, 300, true)).toBe('Volta incompleta: 300 empresas nunca tentadas');
  });

  it('saúde da fila: rodando, parada desde a hora, desligada (CA-CP-20)', () => {
    expect(queueHealthView('RUNNING', null, null).label).toBe('Fila SIEG rodando');
    expect(queueHealthView('STALLED', '2026-11-27T09:20:00-03:00', '2026-11-27T10:05:00-03:00').label).toBe(
      'Fila SIEG parada desde 09:20',
    );
    expect(queueHealthView('STALLED', '2026-11-26T22:00:00-03:00', '2026-11-27T10:05:00-03:00').label).toBe(
      'Fila SIEG parada desde 26/11/2026 22:00',
    );
    expect(queueHealthView('DISABLED', null, null).label).toBe('Captura SIEG desligada neste ambiente');
  });

  it('datas sem conversão de fuso', () => {
    expect(shortDateTime('2026-11-27T09:40:00-03:00')).toBe('27/11 09:40');
    expect(shortMonth('2026-11')).toBe('nov/2026');
  });

  it('mensagem da falha: a do backend; sem ela, a da CP-RN-11 com o status só se for número', () => {
    expect(failureText('SIEG_UNAVAILABLE', 'Mensagem do backend', '503')).toBe('Mensagem do backend');
    expect(failureText('SIEG_UNAVAILABLE', null, '503')).toBe(
      'O SIEG respondeu com erro (HTTP 503). A próxima volta tenta de novo.',
    );
    expect(failureText('SIEG_REJECTED', null, '4O0')).toBe('O SIEG recusou a consulta (HTTP ?).');
    expect(failureText('XML_PARSE_ERRORS', null, null, 2)).toBe('2 XML(s) não puderam ser lidos nesta volta.');
    expect(failureText('SIEG_RECOVERY_GAVE_UP', null)).toContain('A recuperação dos meses bloqueados desistiu');
    expect(failureText('SIEG_RECOVERY_GAVE_UP', 'Texto da API')).toBe('Texto da API');
    expect(failureText('CODIGO_NOVO', null)).toBe('Falha na etapa (código CODIGO_NOVO).');
  });

  describe('erros do "Sincronizar agora" (CP-RN-17)', () => {
    it('429 cooldown com retryAt no topo do corpo (CA-CP-15)', () => {
      const view = syncNowErrorView(
        httpError(429, { code: 'error.capture.priority.cooldown', retryAt: '2026-11-27T11:05:00-03:00' }),
        'firm',
      );
      expect(view.message).toContain('a partir de 27/11 11:05');
    });

    it('429 teto diário com limit e retryAt dentro de details (CA-CP-16)', () => {
      const view = syncNowErrorView(
        httpError(429, {
          code: 'error.capture.priority.firm.daily.limit',
          details: { limit: 10, retryAt: '2026-11-28T00:00:00-03:00' },
        }),
        'firm',
      );
      expect(view.message).toContain('os 10 pedidos');
      expect(view.message).toContain('28/11/2026 00:00');
    });

    it('429 teto de abertos com limit', () => {
      const view = syncNowErrorView(httpError(429, { code: 'error.capture.priority.firm.open.limit', limit: 5 }), 'firm');
      expect(view.message).toContain('já tem 5 pedidos');
    });

    it('409 fora do plano e escritório bloqueado na plataforma (CA-CP-12, CA-CP-17)', () => {
      expect(syncNowErrorView(httpError(409, { code: 'error.capture.priority.not.in.plan' }), 'firm').title).toBe('Fora do plano');
      expect(syncNowErrorView(httpError(409, { code: 'error.capture.priority.firm.blocked' }), 'platform').message).toContain(
        'Reative o escritório',
      );
    });

    it('403 de somente leitura pede para recarregar a situação do escritório', () => {
      const view = syncNowErrorView(httpError(403, { code: 'error.firm.access.blocked' }), 'firm');
      expect(view.reloadFirmAccess).toBeTrue();
    });

    it('503 desligado, 403 sem permissão e 404', () => {
      const unavailable = syncNowErrorView(httpError(503, { code: 'error.capture.priority.unavailable' }), 'firm');
      expect(unavailable.message).toBe('Não foi possível registrar o pedido agora. Tente de novo em instantes.');
      expect(
        syncNowErrorView(httpError(503, { code: 'error.capture.priority.unavailable', message: 'Mensagem da API' }), 'firm').message,
      ).toBe('Mensagem da API');
      expect(syncNowErrorView(httpError(403, { code: 'error.access.denied' }), 'firm').message).toContain('administrador do escritório');
      expect(syncNowErrorView(httpError(404, {}), 'firm').title).toBe('Empresa não encontrada');
    });
  });
});
