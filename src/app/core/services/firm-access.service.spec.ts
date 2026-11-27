import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { FirmAccessDTO } from '../models/firm-access.model';
import { FirmAccessService } from './firm-access.service';

const ACCESS: FirmAccessDTO = {
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
  limits: { planName: 'Teste grátis', maxCompanies: 5, companiesInUse: 5, maxUsers: 2, usersInUse: 1 },
  platformAdmin: false,
};

describe('FirmAccessService', () => {
  let service: FirmAccessService;
  let controller: HttpTestingController;
  const url = `${environment.apiUrl}/firm-access`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FirmAccessService);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('carrega a situação e calcula o limite atingido', () => {
    service.reload();
    controller.expectOne(url).flush(ACCESS);
    expect(service.access()?.status).toBe('TRIAL');
    expect(service.companyLimitReached()).toBeTrue();
    expect(service.userLimitReached()).toBeFalse();
  });

  it('resposta que chega depois do clear() (logout) não regrava o estado do usuário anterior', () => {
    service.reload();
    const pending = controller.expectOne(url);
    service.clear();
    pending.flush({ ...ACCESS, readOnly: true, platformAdmin: true });
    expect(service.access()).toBeNull();
    expect(service.readOnly()).toBeFalse();
    expect(service.platformAdmin()).toBeFalse();
  });

  it('depois do clear() uma busca nova é feita (não reaproveita a pendente)', () => {
    service.reload();
    const first = controller.expectOne(url);
    service.clear();
    service.reload();
    const second = controller.expectOne(url);
    first.flush({ ...ACCESS, platformAdmin: true });
    second.flush(ACCESS);
    expect(service.platformAdmin()).toBeFalse();
    expect(service.access()?.status).toBe('TRIAL');
  });
});

function dto(partial: Partial<FirmAccessDTO>): FirmAccessDTO {
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
    limits: { planName: 'Teste grátis', maxCompanies: 5, companiesInUse: 4, maxUsers: 2, usersInUse: 2 },
    platformAdmin: false,
    ...partial,
  };
}

/** QA fase 1 (F1-3, F1-4, CT1-25, CT1-28): limites nas bordas, somente leitura e erro de rede. */
describe('FirmAccessService: limites e erros', () => {
  let service: FirmAccessService;
  let controller: HttpTestingController;
  const url = `${environment.apiUrl}/firm-access`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FirmAccessService);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('4 de 5 empresas ainda cria; 5 de 5 não; usuários 2 de 2 não cria (o ADMIN conta)', () => {
    service.reload();
    controller.expectOne(url).flush(dto({}));
    expect(service.companyLimitReached()).toBeFalse();
    expect(service.userLimitReached()).toBeTrue();
  });

  it('acima do limite (migrado para teste com 6 de 5) também conta como atingido', () => {
    service.reload();
    controller.expectOne(url).flush(dto({ limits: { planName: 'Teste grátis', maxCompanies: 5, companiesInUse: 6, maxUsers: 2, usersInUse: 3 } }));
    expect(service.companyLimitReached()).toBeTrue();
    expect(service.userLimitReached()).toBeTrue();
  });

  it('sem limites (ACTIVE) nunca bloqueia a criação', () => {
    service.reload();
    controller.expectOne(url).flush(dto({ status: 'ACTIVE', limits: null, trialDaysLeft: null }));
    expect(service.companyLimitReached()).toBeFalse();
    expect(service.userLimitReached()).toBeFalse();
  });

  it('readOnly e platformAdmin vêm só do que o backend manda (não deduz de status)', () => {
    service.reload();
    controller.expectOne(url).flush(dto({ status: 'BLOCKED', readOnly: false, platformAdmin: true }));
    expect(service.readOnly()).toBeFalse();
    expect(service.platformAdmin()).toBeTrue();
    service.reload();
    controller.expectOne(url).flush(dto({ status: 'SUSPENDED', readOnly: true, reason: 'MANUAL' }));
    expect(service.readOnly()).toBeTrue();
    expect(service.platformAdmin()).toBeFalse();
  });

  it('antes de carregar: não é somente leitura, não é admin da plataforma e não há limite', () => {
    expect(service.readOnly()).toBeFalse();
    expect(service.platformAdmin()).toBeFalse();
    expect(service.companyLimitReached()).toBeFalse();
    expect(service.loaded()).toBeFalse();
  });

  it('erro de rede mantém o estado anterior (não vira "liberado" nem apaga o bloqueio)', () => {
    service.reload();
    controller.expectOne(url).flush(dto({ status: 'BLOCKED', readOnly: true, reason: 'TRIAL_EXPIRED', limits: null }));
    service.reload();
    controller.expectOne(url).error(new ProgressEvent('error'), { status: 0 });
    expect(service.readOnly()).toBeTrue();
  });

  it('ensureLoaded não busca de novo quando já tem a situação', () => {
    service.reload();
    controller.expectOne(url).flush(dto({}));
    let status: string | undefined;
    service.ensureLoaded().subscribe((value) => (status = value?.status));
    controller.expectNone(url);
    expect(status).toBe('TRIAL');
  });
});
