import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FirmAccessDTO } from '../../../core/models/firm-access.model';
import { FirmAccessService } from '../../../core/services/firm-access.service';
import { AccessBannerComponent } from './access-banner.component';

function access(partial: Partial<FirmAccessDTO>): FirmAccessDTO {
  return {
    status: 'TRIAL',
    exempt: false,
    readOnly: false,
    reason: null,
    blockedSince: null,
    trialEndsOn: '2026-12-09',
    accessUntil: null,
    trialDaysLeft: 14,
    capturesStoppedDays: null,
    sefazRetentionDays: 90,
    limits: { planName: 'Teste grátis', maxCompanies: 5, companiesInUse: 3, maxUsers: 2, usersInUse: 1 },
    platformAdmin: false,
    capturePanelPlatformEnabled: false,
    ...partial,
  };
}

describe('AccessBannerComponent', () => {
  const state = signal<FirmAccessDTO | null>(null);

  function render(value: FirmAccessDTO | null): HTMLElement {
    state.set(value);
    const fixture = TestBed.createComponent(AccessBannerComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AccessBannerComponent],
      providers: [{ provide: FirmAccessService, useValue: { access: state.asReadonly() } }],
    });
  });

  it('mostra os dias restantes do teste e o uso do limite (CA1-22)', () => {
    const text = render(access({})).textContent ?? '';
    expect(text).toContain('Teste grátis: faltam 14 dias (até 09/12/2026).');
    expect(text).toContain('Empresas: 3 de 5');
    expect(text).toContain('Usuários: 1 de 2');
  });

  it('no último dia: "Seu teste termina hoje"', () => {
    expect(render(access({ trialDaysLeft: 1 })).textContent).toContain('Seu teste termina hoje.');
  });

  it('bloqueado: motivo, data, dias de captura parada e o aviso dos 90 dias da SEFAZ (CA1-11)', () => {
    const text =
      render(
        access({
          status: 'BLOCKED',
          readOnly: true,
          reason: 'TRIAL_EXPIRED',
          blockedSince: '2026-12-10',
          capturesStoppedDays: 10,
          trialDaysLeft: null,
          limits: null,
        }),
      ).textContent ?? '';
    expect(text).toContain('Somente leitura: o teste grátis terminou desde 10/12/2026.');
    expect(text).toContain('As capturas automáticas estão paradas há 10 dias.');
    expect(text).toContain('A SEFAZ disponibiliza as notas por cerca de 90 dias.');
    expect(text).toContain('Fale com a CS Hub');
  });

  it('liberado ou isento: sem faixa', () => {
    expect(render(access({ status: 'ACTIVE', trialDaysLeft: null, limits: null })).querySelector('.access-banner')).toBeNull();
    expect(render(access({ exempt: true })).querySelector('.access-banner')).toBeNull();
    expect(render(null).querySelector('.access-banner')).toBeNull();
  });
});

function blocked(partial: Partial<FirmAccessDTO>): FirmAccessDTO {
  return {
    status: 'BLOCKED',
    exempt: false,
    readOnly: true,
    reason: 'TRIAL_EXPIRED',
    blockedSince: '2026-12-10',
    trialEndsOn: '2026-12-09',
    accessUntil: null,
    trialDaysLeft: null,
    capturesStoppedDays: 10,
    sefazRetentionDays: 90,
    limits: null,
    platformAdmin: false,
    capturePanelPlatformEnabled: false,
    ...partial,
  };
}

/**
 * QA fase 1 (F1-3, F1-RN-09, CT1-18, CT1-19): a faixa de somente leitura para cada motivo e os extremos de dias,
 * sempre com data em dd/mm/aaaa e texto (nunca só cor).
 */
describe('AccessBannerComponent: motivos e extremos', () => {
  const state = signal<FirmAccessDTO | null>(null);

  function text(value: FirmAccessDTO | null): string {
    state.set(value);
    const fixture = TestBed.createComponent(AccessBannerComponent);
    fixture.detectChanges();
    return ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AccessBannerComponent],
      providers: [{ provide: FirmAccessService, useValue: { access: state.asReadonly() } }],
    });
  });

  const cases: [string, Partial<FirmAccessDTO>, string][] = [
    ['TRIAL_EXPIRED', { reason: 'TRIAL_EXPIRED' }, 'Somente leitura: o teste grátis terminou desde 10/12/2026.'],
    ['ACCESS_EXPIRED', { reason: 'ACCESS_EXPIRED' }, 'Somente leitura: o prazo de acesso liberado terminou desde 10/12/2026.'],
    ['NON_PAYMENT', { reason: 'NON_PAYMENT' }, 'Somente leitura: há fatura em aberto desde 10/12/2026.'],
    ['MANUAL (suspenso)', { status: 'SUSPENDED', reason: 'MANUAL' }, 'Somente leitura: o acesso foi suspenso pela CS Hub desde 10/12/2026.'],
    ['CANCELED sem motivo', { status: 'CANCELED', reason: null }, 'Somente leitura: a conta do escritório foi cancelada desde 10/12/2026.'],
  ];

  cases.forEach(([name, partial, expected]) => {
    it(`motivo ${name}: título, captura parada, aviso dos 90 dias e contato`, () => {
      const out = text(blocked(partial));
      expect(out).toContain(expected);
      expect(out).toContain('As capturas automáticas estão paradas há 10 dias.');
      expect(out).toContain('A SEFAZ disponibiliza as notas por cerca de 90 dias.');
      expect(out).toContain('Fale com a CS Hub');
    });
  });

  it('1 dia no singular, 0 dia "pararam hoje" e sem número só a frase geral', () => {
    expect(text(blocked({ capturesStoppedDays: 1 }))).toContain('paradas há 1 dia.');
    expect(text(blocked({ capturesStoppedDays: 0 }))).toContain('As capturas automáticas pararam hoje.');
    expect(text(blocked({ capturesStoppedDays: null }))).toContain('As capturas automáticas estão paradas.');
  });

  it('sem blockedSince não imprime "desde" nem "null"', () => {
    const out = text(blocked({ blockedSince: null }));
    expect(out).toContain('Somente leitura: o teste grátis terminou.');
    expect(out).not.toContain('null');
    expect(out).not.toContain('undefined');
  });

  it('o prazo da SEFAZ vem do backend (não fixa 90 no texto)', () => {
    expect(text(blocked({ sefazRetentionDays: 60 }))).toContain('cerca de 60 dias');
  });

  it('teste com faltam 2 dias usa o plural; 14 dias traz a data final em dd/mm/aaaa', () => {
    const trial: Partial<FirmAccessDTO> = { status: 'TRIAL', readOnly: false, reason: null, blockedSince: null, capturesStoppedDays: null };
    expect(text(blocked({ ...trial, trialDaysLeft: 2 }))).toContain('faltam 2 dias (até 09/12/2026)');
    expect(text(blocked({ ...trial, trialDaysLeft: 14 }))).toContain('faltam 14 dias (até 09/12/2026)');
  });

  it('PAST_DUE (fase 2): aviso em texto e acesso mantido, sem a faixa de somente leitura', () => {
    const out = text(blocked({ status: 'PAST_DUE', readOnly: false, reason: null }));
    expect(out).toContain('Pagamento em atraso');
    expect(out).not.toContain('Somente leitura');
  });

  it('a faixa é uma região com nome acessível e o link externo avisa que abre em outra aba', () => {
    state.set(blocked({}));
    const fixture = TestBed.createComponent(AccessBannerComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('section[aria-label]')).not.toBeNull();
    expect(host.querySelector('a[rel~="noopener"] .visually-hidden')?.textContent).toContain('outra aba');
  });
});
