import { PlatformFirmRowDTO } from '../../../core/models/platform-firm.model';
import { availableActions, eventChanges, situationText, todayIso } from './platform-actions';

function row(partial: Partial<PlatformFirmRowDTO>): PlatformFirmRowDTO {
  return {
    id: 'f1',
    name: 'Escritório Fictício',
    documentNumber: '11222333000181',
    createdDate: '2026-11-26T10:00:00',
    status: 'ACTIVE',
    exempt: false,
    readOnly: false,
    reason: null,
    trialEndsOn: null,
    accessUntil: null,
    blockedSince: null,
    migrated: true,
    reviewed: false,
    reviewedAt: null,
    reviewedBy: null,
    companiesInUse: 3,
    companiesInactive: 1,
    usersInUse: 2,
    contactPhone: '81999990000',
    billingEmail: 'financeiro@example.test',
    admins: [],
    ...partial,
  };
}

const actionsOf = (r: PlatformFirmRowDTO) => availableActions(r).map((spec) => spec.action);

describe('platform-actions', () => {
  it('isento só aceita a revisão', () => {
    expect(actionsOf(row({ exempt: true }))).toEqual(['mark-reviewed']);
  });

  it('migrado liberado pode virar teste, ser revisado, suspenso ou cancelado, mas não estendido nem reativado', () => {
    const actions = actionsOf(row({ status: 'ACTIVE' }));
    expect(actions).toContain('convert-to-trial');
    expect(actions).toContain('mark-reviewed');
    expect(actions).toContain('suspend');
    expect(actions).toContain('cancel');
    expect(actions).not.toContain('extend-trial');
    expect(actions).not.toContain('reactivate');
  });

  it('teste vencido pode ser estendido; suspenso só reativa (não suspende de novo)', () => {
    expect(actionsOf(row({ status: 'BLOCKED', reason: 'TRIAL_EXPIRED' }))).toContain('extend-trial');
    expect(actionsOf(row({ status: 'BLOCKED', reason: 'ACCESS_EXPIRED' }))).toContain('convert-to-trial');
    const suspended = actionsOf(row({ status: 'SUSPENDED', reason: 'MANUAL' }));
    expect(suspended).toContain('reactivate');
    expect(suspended).not.toContain('suspend');
  });

  it('suspender pede motivo e estender pede data', () => {
    const specs = availableActions(row({ status: 'TRIAL', trialEndsOn: '2026-12-09' }));
    expect(specs.find((s) => s.action === 'suspend')?.reasonRequired).toBeTrue();
    expect(specs.find((s) => s.action === 'extend-trial')?.dateRequired).toBeTrue();
  });

  it('descreve a situação com texto e data no formato brasileiro', () => {
    expect(situationText(row({ status: 'TRIAL', trialEndsOn: '2026-12-09' }))).toBe('Teste grátis até 09/12/2026');
    expect(situationText(row({ status: 'ACTIVE' }))).toBe('Liberado sem prazo');
    expect(situationText(row({ status: 'BLOCKED', reason: 'TRIAL_EXPIRED', blockedSince: '2026-12-10' }))).toBe(
      'Bloqueado desde 10/12/2026 (teste grátis encerrado)',
    );
    expect(situationText(row({ exempt: true }))).toBe('Isento (CS Hub)');
  });

  it('lista só o que mudou no evento', () => {
    const changes = eventChanges({
      id: 'e1',
      type: 'CONVERTED_TO_TRIAL',
      before: { status: 'ACTIVE', trialEndsOn: null, reviewed: false },
      after: { status: 'TRIAL', trialEndsOn: '2026-12-09', reviewed: true },
      reason: null,
      actor: 'csadmin',
      createdDate: '2026-11-26T10:00:00',
    });
    expect(changes).toEqual([
      'Situação: Liberado → Teste grátis',
      'Teste até: — → 09/12/2026',
      'Revisado: Não → Sim',
    ]);
  });

  it('hoje é o de Recife, não o do navegador nem o UTC', () => {
    // 02:59 UTC do dia 10 = 23:59 de Recife do dia 9 (CT1-15)
    expect(todayIso(new Date('2026-12-10T02:59:00Z'))).toBe('2026-12-09');
    expect(todayIso(new Date('2026-12-10T03:01:00Z'))).toBe('2026-12-10');
  });

  it('mostra o antes e depois do CONTACT_UPDATED com máscara', () => {
    expect(
      eventChanges({
        id: 'e2',
        type: 'CONTACT_UPDATED',
        before: { documentNumber: null, billingEmail: null, contactPhone: '81999990000' },
        after: { documentNumber: '11222333000181', billingEmail: 'financeiro@example.test', contactPhone: '81999990000' },
        reason: null,
        actor: 'csadmin',
        createdDate: '2026-11-26T10:00:00',
      }),
    ).toEqual(['CNPJ: — → 11.222.333/0001-81', 'E-mail financeiro: — → financeiro@example.test']);
  });
});
