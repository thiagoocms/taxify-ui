import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../services/auth.service';
import { FirmAccessService } from '../services/firm-access.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let toastr: jasmine.SpyObj<ToastrService>;
  let firmAccess: jasmine.SpyObj<FirmAccessService>;

  beforeEach(() => {
    toastr = jasmine.createSpyObj<ToastrService>('ToastrService', ['warning', 'error', 'success']);
    firmAccess = jasmine.createSpyObj<FirmAccessService>('FirmAccessService', ['reload']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastrService, useValue: toastr },
        { provide: FirmAccessService, useValue: firmAccess },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('403 de escrita bloqueada: toast de somente leitura e atualiza a situação', () => {
    http.post('/api/companies', {}).subscribe({ error: () => undefined });
    controller.expectOne('/api/companies').flush(
      {
        timestamp: '2026-12-10T10:00:00',
        status: 403,
        code: 'error.firm.access.blocked',
        firmStatus: 'BLOCKED',
        message: 'Escritório em somente leitura.',
        reason: 'TRIAL_EXPIRED',
        blockedSince: '2026-12-10',
      },
      { status: 403, statusText: 'Forbidden' },
    );
    expect(toastr.warning).toHaveBeenCalledWith('Escritório em somente leitura.', 'Somente leitura');
    expect(firmAccess.reload).toHaveBeenCalled();
  });

  it('409 de limite do teste: mensagem com limite e uso', () => {
    http.post('/api/companies', {}).subscribe({ error: () => undefined });
    controller.expectOne('/api/companies').flush(
      { status: 409, code: 'error.plan.limit.companies', kind: 'COMPANY', limit: 5, inUse: 5, planName: 'Teste grátis' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(toastr.warning).toHaveBeenCalledWith(
      'O teste grátis permite 5 empresas e o escritório já tem 5. Fale com a CS Hub para contratar.',
      'Limite do teste grátis',
    );
    expect(firmAccess.reload).toHaveBeenCalled();
  });

  it('erros do cadastro e o login não verificado ficam com a tela (sem toast)', () => {
    http.post('/api/signup', {}).subscribe({ error: () => undefined });
    controller.expectOne('/api/signup').flush({ code: 'error.signup.rate.limited' }, { status: 429, statusText: 'Too Many' });
    http.post('/api/auth', {}).subscribe({ error: () => undefined });
    controller.expectOne('/api/auth').flush({ code: 'error.signup.email.not.verified' }, { status: 403, statusText: 'Forbidden' });
    expect(toastr.warning).not.toHaveBeenCalled();
    expect(toastr.error).not.toHaveBeenCalled();
  });

  it('401 nas telas que tratam o erro sozinhas (console) ainda leva ao login', () => {
    const auth = TestBed.inject(AuthService);
    spyOnProperty(auth, 'token', 'get').and.returnValue('token-ficticio');
    const logout = spyOn(auth, 'logout');
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    http.put('/api/platform/firms/f1/contact', {}).subscribe({ error: () => undefined });
    controller.expectOne('/api/platform/firms/f1/contact').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('login/CPF duplicado no /users fica com o formulário (sem toast); outros 409 continuam com toast', () => {
    http.post('/api/users', {}).subscribe({ error: () => undefined });
    controller.expectOne('/api/users').flush(
      { status: 409, code: 'error.user.login.already.exists', message: 'Já existe um usuário com esse login.' },
      { status: 409, statusText: 'Conflict' },
    );
    http.put('/api/users/u1', {}).subscribe({ error: () => undefined });
    controller.expectOne('/api/users/u1').flush(
      { status: 400, code: 'error.user.password.invalid' },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(toastr.warning).not.toHaveBeenCalled();
    http.post('/api/users', {}).subscribe({ error: () => undefined });
    controller.expectOne('/api/users').flush(
      { status: 409, code: 'error.plan.limit.users', kind: 'USER', limit: 2, inUse: 2, planName: 'Teste grátis' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(toastr.warning).toHaveBeenCalledTimes(1);
  });

  // Bloqueio por motivo e limite do teste (F1-3, F1-4, CA1-15, CT1-17, CT1-25, CT1-28).

  ['TRIAL_EXPIRED', 'ACCESS_EXPIRED', 'NON_PAYMENT', 'MANUAL'].forEach((reason) => {
    it(`403 bloqueado (${reason}) sem mensagem da API: toast de somente leitura em português e a faixa é recarregada`, () => {
      http.put('/api/users/u1', {}).subscribe({ error: () => undefined });
      controller.expectOne('/api/users/u1').flush(
        { status: 403, code: 'error.firm.access.blocked', firmStatus: 'BLOCKED', reason, blockedSince: '2026-12-10' },
        { status: 403, statusText: 'Forbidden' },
      );
      expect(toastr.warning).toHaveBeenCalledTimes(1);
      const [message, title] = toastr.warning.calls.mostRecent().args as [string, string];
      expect(title).toBe('Somente leitura');
      expect(message).toContain('somente leitura');
      expect(message).not.toContain('Acesso negado');
      expect(firmAccess.reload).toHaveBeenCalledTimes(1);
    });
  });

  it('403 comum (sem permissão) continua "Acesso negado" e NÃO recarrega a situação do escritório', () => {
    http.get('/api/companies').subscribe({ error: () => undefined });
    controller.expectOne('/api/companies').flush({ status: 403, code: 'error.access.denied' }, { status: 403, statusText: 'Forbidden' });
    expect(toastr.warning).toHaveBeenCalledWith('Você não tem permissão para executar esta ação.', 'Acesso negado');
    expect(firmAccess.reload).not.toHaveBeenCalled();
  });

  it('409 de limite de usuários sem mensagem da API: monta o texto com limite e uso reais (CT1-28: 2 e 2)', () => {
    http.post('/api/users', {}).subscribe({ error: () => undefined });
    controller.expectOne('/api/users').flush(
      { status: 409, code: 'error.plan.limit.users', kind: 'USER', limit: 2, inUse: 2, planName: 'Teste grátis' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(toastr.warning).toHaveBeenCalledWith(
      'O teste grátis permite 2 usuários e o escritório já tem 2. Fale com a CS Hub para contratar.',
      'Limite do teste grátis',
    );
    expect(firmAccess.reload).toHaveBeenCalled();
  });

  it('409 de limite usa a mensagem da API quando ela vem pronta', () => {
    http.post('/api/companies', {}).subscribe({ error: () => undefined });
    controller.expectOne('/api/companies').flush(
      { status: 409, code: 'error.plan.limit.companies', limit: 5, inUse: 5, planName: 'Teste grátis', message: 'O teste grátis permite 5 empresas e o escritório já tem 5. Fale com a CS Hub para contratar.' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(toastr.warning).toHaveBeenCalledWith(
      'O teste grátis permite 5 empresas e o escritório já tem 5. Fale com a CS Hub para contratar.',
      'Limite do teste grátis',
    );
  });

  it('409 "limit.busy" pede para tentar de novo e não recarrega a faixa', () => {
    http.post('/api/companies', {}).subscribe({ error: () => undefined });
    controller.expectOne('/api/companies').flush({ status: 409, code: 'error.plan.limit.busy' }, { status: 409, statusText: 'Conflict' });
    expect(toastr.warning.calls.mostRecent().args[1]).toBe('Tente de novo');
    expect(firmAccess.reload).not.toHaveBeenCalled();
  });

  it('a consulta de fundo /firm-access que falha (500) não enche a tela de toasts', () => {
    http.get('/api/firm-access').subscribe({ error: () => undefined });
    controller.expectOne('/api/firm-access').flush({}, { status: 500, statusText: 'Server Error' });
    expect(toastr.error).not.toHaveBeenCalled();
    expect(toastr.warning).not.toHaveBeenCalled();
  });

  it('403 de bloqueio decide pelo code: firmStatus SUSPENDED/CANCELED também é somente leitura', () => {
    ['SUSPENDED', 'CANCELED'].forEach((firmStatus) => {
      http.post('/api/companies', {}).subscribe({ error: () => undefined });
      controller.expectOne('/api/companies').flush(
        { status: 403, code: 'error.firm.access.blocked', firmStatus, reason: 'MANUAL', blockedSince: '2026-12-10' },
        { status: 403, statusText: 'Forbidden' },
      );
    });
    expect(toastr.warning.calls.allArgs().map((args) => args[1])).toEqual(['Somente leitura', 'Somente leitura']);
    expect(firmAccess.reload).toHaveBeenCalledTimes(2);
  });

  it('409 com code não tratado: toast com a message da API (fallback genérico)', () => {
    http.post('/api/plans', {}).subscribe({ error: () => undefined });
    controller.expectOne('/api/plans').flush(
      { status: 409, code: 'error.plan.name.already.exists', message: 'Já existe um plano com esse nome.' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(toastr.warning).toHaveBeenCalledWith('Já existe um plano com esse nome.', 'Conflito');
  });
});
