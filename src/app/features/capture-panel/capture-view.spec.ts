import { CapturePanelRowDTO, CapturePriorityRequestDTO } from '../../core/models/capture-panel.model';
import { READ_ONLY_HINT } from '../../core/models/firm-access.model';
import { priorityRequestText, syncButtonView, SyncContext } from './capture-view';

// Dados fictícios.
function row(overrides: Partial<CapturePanelRowDTO> = {}, siegStatus: CapturePanelRowDTO['status'] = 'EM_DIA'): CapturePanelRowDTO {
  return {
    companyId: 'c1',
    companyName: 'Empresa Fictícia Ltda',
    establishment: '0001',
    active: true,
    firmId: null,
    firmName: null,
    status: siegStatus,
    statusReason: null,
    lastFailure: null,
    channels: {
      SIEG: {
        status: siegStatus,
        lastAttemptAt: null,
        verifiedAt: null,
        queuePosition: 10,
        nextAttemptEstimate: null,
        received: null,
        issued: null,
        eventsCheckedOn: null,
        serviceInvoicesCheckedOn: null,
        priorityRequest: null,
      },
      SEFAZ: { status: 'EM_DIA' },
      ADN: { status: 'FORA_DO_PLANO' },
    },
    ...overrides,
  };
}

const firmAdmin: SyncContext = { scope: 'firm', allowed: true, readOnly: false, queueHealth: 'RUNNING', busy: false };
const pending: CapturePriorityRequestDTO = {
  requestId: 'r1',
  status: 'PENDING',
  requestedAt: '2026-11-27T10:01:00-03:00',
  requestedByName: null,
  requestedByPlatform: true,
  position: 0,
  estimatedAt: '2026-11-27T10:05:00-03:00',
};

describe('capture-view (Sincronizar agora)', () => {
  it('ADMIN com empresa elegível: botão habilitado', () => {
    const view = syncButtonView(row(), firmAdmin);
    expect(view.show).toBeTrue();
    expect(view.disabled).toBeFalse();
    expect(view.write).toBeTrue();
  });

  it('FISCAL (sem permissão de pedir) não vê o botão (P-CP-02)', () => {
    expect(syncButtonView(row(), { ...firmAdmin, allowed: false }).show).toBeFalse();
  });

  it('escritório em somente leitura: desabilitado com o motivo da fase 1', () => {
    const view = syncButtonView(row({}, 'BLOQUEADA'), { ...firmAdmin, readOnly: true });
    expect(view.disabled).toBeTrue();
    expect(view.reason).toBe(READ_ONLY_HINT);
  });

  it('plataforma com empresa de escritório bloqueado e empresa fora do plano', () => {
    expect(syncButtonView(row({}, 'BLOQUEADA'), { ...firmAdmin, scope: 'platform' }).reason).toContain('somente leitura');
    expect(syncButtonView(row({}, 'FORA_DO_PLANO'), firmAdmin).reason).toContain('não tem importação de XML pelo SIEG');
  });

  it('pedido em aberto: "Na fila" com a posição somando 1 e "Pedido pela CS Hub" no escritório (CA-CP-13, CT-CP-55)', () => {
    const base = row();
    const withRequest = row({ channels: { ...base.channels, SIEG: { ...base.channels.SIEG, priorityRequest: pending } } });
    const view = syncButtonView(withRequest, firmAdmin);
    expect(view.disabled).toBeTrue();
    expect(view.queued).toBe('Na fila: posição 1 · estimativa 27/11 10:05 · Pedido pela CS Hub às 10:01');
  });

  it('usa o requestedByLabel pronto do backend no lugar de montar o texto', () => {
    expect(priorityRequestText({ ...pending, requestedByLabel: 'Pedido pela CS Hub às 10:01 (backend)' }, 'firm')).toBe(
      'Na fila: posição 1 · estimativa 27/11 10:05 · Pedido pela CS Hub às 10:01 (backend)',
    );
  });

  it('na plataforma o pedido mostra quem pediu pelo nome, se vier', () => {
    expect(priorityRequestText({ ...pending, requestedByPlatform: false, requestedByName: 'Pessoa Fictícia' }, 'platform')).toContain(
      'Pedido por Pessoa Fictícia às 10:01',
    );
    expect(priorityRequestText({ ...pending, status: 'RESERVED' }, 'platform')).toContain('Sendo atendida nesta rodada');
  });
});
