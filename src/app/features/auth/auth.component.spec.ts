import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { environment } from '../../../environments/environment';
import { SignupConfigDTO } from '../../core/models/signup.model';
import { PasswordConfigDTO } from '../../core/models/password.model';
import { AuthComponent } from './auth.component';

const PASSWORD_CONFIG: PasswordConfigDTO = { available: true, resetMinutes: 60, minLength: 8 };

const CONFIG: SignupConfigDTO = {
  available: true,
  termsVersion: '2026-11',
  termsUrl: 'https://example.test/termos',
  privacyUrl: 'https://example.test/privacidade',
  dpaUrl: 'https://example.test/dpa',
  trialDays: 14,
  verificationHours: 24,
};

// Dados fictícios (CNPJ e CPF de teste com DV válido).
const VALID = {
  firmName: 'Escritório Fictício',
  firmDocument: '11222333000181',
  billingEmail: 'financeiro@example.test',
  contactPhone: '81999990000',
  name: 'Pessoa Fictícia',
  document: '52998224725',
  email: 'pessoa@example.test',
  login: 'pessoa.ficticia',
  password: 'segredo1',
  confirmPassword: 'segredo1',
  acceptTerms: true,
};

describe('AuthComponent (cadastro da fase 1)', () => {
  let fixture: ComponentFixture<AuthComponent>;
  let component: AuthComponent;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  function flushConfig(config: SignupConfigDTO, password: PasswordConfigDTO = PASSWORD_CONFIG): void {
    controller.expectOne(`${environment.apiUrl}/signup/config`).flush(config);
    controller.expectOne(`${environment.apiUrl}/auth/password/config`).flush(password);
    fixture.detectChanges();
  }

  function submitValidSignup(): void {
    component.registerForm.setValue(VALID);
    component.step.set(3);
    component.changeStep();
  }

  it('esconde "crie a conta" quando o cadastro está indisponível (CA1-13)', () => {
    flushConfig({ ...CONFIG, available: false });
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('crie a conta do seu escritório');
  });

  it('mostra "crie a conta" quando o cadastro está aberto', () => {
    flushConfig(CONFIG);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('crie a conta do seu escritório');
  });

  it('envia o cadastro novo sem profile, com a versão dos termos e só os dígitos', () => {
    flushConfig(CONFIG);
    submitValidSignup();
    const request = controller.expectOne(`${environment.apiUrl}/signup`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      firm: {
        name: 'Escritório Fictício',
        documentNumber: '11222333000181',
        billingEmail: 'financeiro@example.test',
        contactPhone: '81999990000',
      },
      user: {
        name: 'Pessoa Fictícia',
        document: '52998224725',
        login: 'pessoa.ficticia',
        email: 'pessoa@example.test',
        password: 'segredo1',
      },
      termsVersion: '2026-11',
    });
    expect('profile' in request.request.body).toBeFalse();
    request.flush({ status: 'PENDING_VERIFICATION', verificationHours: 24 }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();
    expect(component.registered()?.email).toBe('pessoa@example.test');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Verifique seu e-mail');
  });

  it('CNPJ já cadastrado volta para a etapa do escritório com a mensagem da API', () => {
    flushConfig(CONFIG);
    submitValidSignup();
    controller.expectOne(`${environment.apiUrl}/signup`).flush(
      { status: 409, code: 'error.signup.firm.document.exists', message: 'Este CNPJ já tem conta no Taxify. Fale com a CS Hub.' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(component.step()).toBe(1);
    expect(component.registerError()).toBe('Este CNPJ já tem conta no Taxify. Fale com a CS Hub.');
    expect(component.registerForm.controls.firmDocument.hasError('server')).toBeTrue();
  });

  it('login em uso (error.user.login.already.exists) marca o login na etapa 2', () => {
    flushConfig(CONFIG);
    submitValidSignup();
    controller.expectOne(`${environment.apiUrl}/signup`).flush(
      { status: 409, code: 'error.user.login.already.exists', message: 'Já existe um usuário com esse login.' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(component.step()).toBe(2);
    expect(component.registerForm.controls.login.hasError('server')).toBeTrue();
  });

  it('409 com code sem campo próprio: mostra a message da API no rodapé, sem marcar campo (fallback genérico)', () => {
    flushConfig(CONFIG);
    submitValidSignup();
    controller.expectOne(`${environment.apiUrl}/signup`).flush(
      { status: 409, code: 'error.signup.conflict', message: 'Não foi possível concluir o cadastro com esses dados.' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(component.registerError()).toBe('Não foi possível concluir o cadastro com esses dados.');
    expect(component.registerForm.controls.login.hasError('server')).toBeFalse();
    expect(component.registerForm.controls.document.hasError('server')).toBeFalse();
  });

  it('termos desatualizados: desmarca o aceite e busca a versão nova', () => {
    flushConfig(CONFIG);
    submitValidSignup();
    controller.expectOne(`${environment.apiUrl}/signup`).flush(
      { status: 409, code: 'error.signup.terms.outdated' },
      { status: 409, statusText: 'Conflict' },
    );
    controller.expectOne(`${environment.apiUrl}/signup/config`).flush({ ...CONFIG, termsVersion: '2026-12' });
    expect(component.registerForm.controls.acceptTerms.value).toBeFalse();
    expect(component.signupConfig()?.termsVersion).toBe('2026-12');
    expect(component.step()).toBe(3);
  });

  it('não avança com CNPJ de DV inválido', () => {
    flushConfig(CONFIG);
    component.registerForm.patchValue({ ...VALID, firmDocument: '11111111000111' });
    component.step.set(1);
    component.changeStep();
    expect(component.step()).toBe(1);
    expect(component.registerForm.controls.firmDocument.hasError('cnpjInvalid')).toBeTrue();
  });

  it('login antes de confirmar o e-mail oferece reenviar', () => {
    flushConfig(CONFIG);
    component.loginForm.setValue({ login: 'pessoa.ficticia', password: 'segredo1' });
    component.loginSubmit();
    controller.expectOne(`${environment.apiUrl}/auth`).flush(
      { status: 403, code: 'error.signup.email.not.verified' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();
    expect(component.loginNotVerified()).toBe('pessoa.ficticia');
    expect(component.loginError()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Reenviar e-mail');
  });

  it('CPF duplicado (error.user.document.already.exists) marca o CPF na etapa 2', () => {
    flushConfig(CONFIG);
    submitValidSignup();
    controller.expectOne(`${environment.apiUrl}/signup`).flush(
      { status: 409, code: 'error.user.document.already.exists', message: 'Já existe um documento com esse número e tipo.' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(component.step()).toBe(2);
    expect(component.registerForm.controls.document.hasError('server')).toBeTrue();
    expect(component.registerError()).toBe('Já existe um documento com esse número e tipo.');
  });

  it('senha acima de 72 bytes não avança (o BCrypt ignoraria o resto)', () => {
    flushConfig(CONFIG);
    const longa = 'ç'.repeat(37); // 74 bytes em UTF-8
    component.registerForm.setValue({ ...VALID, password: longa, confirmPassword: longa });
    component.step.set(3);
    component.changeStep();
    controller.expectNone(`${environment.apiUrl}/signup`);
    expect(component.registerForm.controls.password.hasError('maxBytes')).toBeTrue();
  });

  // ------------------------------------------------- Esqueci a senha (F-SN-1, SN-RN-01, SN-RN-14, CA-SN-20) --

  it('recuperação desligada (available=false): "Esqueceu a senha?" só mostra a quem pedir, sem formulário', () => {
    flushConfig(CONFIG, { ...PASSWORD_CONFIG, available: false });
    component.forgotClick();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(component.loginMode()).toBe('login');
    expect(text).toContain('Peça ao administrador do seu escritório');
    expect((fixture.nativeElement as HTMLElement).querySelector('#forgot-identifier')).toBeNull();
  });

  it('pede o link pelo login ou e-mail e mostra a mensagem fixa com a validade, sem dizer se a conta existe', () => {
    flushConfig(CONFIG, { ...PASSWORD_CONFIG, resetMinutes: 45 });
    component.loginForm.patchValue({ login: 'ana.ficticia' });
    component.forgotClick();
    fixture.detectChanges();
    expect(component.loginMode()).toBe('forgot');
    expect(component.forgotForm.controls.identifier.value).toBe('ana.ficticia');

    component.forgotForm.setValue({ identifier: '  contato@example.test  ' });
    component.forgotSubmit();
    const request = controller.expectOne(`${environment.apiUrl}/auth/password/forgot`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ identifier: 'contato@example.test' });
    request.flush(null, { status: 202, statusText: 'Accepted' });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Se existir uma conta com esses dados, enviamos um link para o e-mail cadastrado.');
    expect(text).toContain('Ele vale por 45 minutos.');
    // Espera antes de pedir de novo.
    expect(component.forgotCooldown()).toBeGreaterThan(0);
    component.forgotSubmit();
    controller.expectNone(`${environment.apiUrl}/auth/password/forgot`);
    component.ngOnDestroy();
  });

  it('campo vazio não envia o pedido', () => {
    flushConfig(CONFIG);
    component.forgotClick();
    component.forgotForm.setValue({ identifier: '   ' });
    component.forgotSubmit();
    controller.expectNone(`${environment.apiUrl}/auth/password/forgot`);
    expect(component.forgotForm.controls.identifier.hasError('required')).toBeTrue();
  });

  it('503 error.password.reset.unavailable volta ao "peça ao administrador"', () => {
    flushConfig(CONFIG);
    component.forgotClick();
    component.forgotForm.setValue({ identifier: 'ana.ficticia' });
    component.forgotSubmit();
    controller
      .expectOne(`${environment.apiUrl}/auth/password/forgot`)
      .flush({ status: 503, code: 'error.password.reset.unavailable' }, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(component.loginMode()).toBe('login');
    expect(component.forgotAvailable()).toBeFalse();
    expect(component.showForgotHelp()).toBeTrue();
  });

  it('o cadastro usa o minLength da config: 7 caracteres não avançam com mínimo 8', () => {
    flushConfig(CONFIG);
    component.registerForm.setValue({ ...VALID, password: 'Abc1234', confirmPassword: 'Abc1234' });
    component.step.set(3);
    component.changeStep();
    controller.expectNone(`${environment.apiUrl}/signup`);
    expect(component.registerForm.controls.password.hasError('minlength')).toBeTrue();
  });

  it('login novo com ":" não avança; error.user.login.invalid.char do backend marca o login (etapa 2)', () => {
    flushConfig(CONFIG);
    component.registerForm.patchValue({ ...VALID, login: 'ana:ficticia' });
    component.step.set(2);
    component.changeStep();
    expect(component.step()).toBe(2);
    expect(component.registerForm.controls.login.hasError('colon')).toBeTrue();

    submitValidSignup();
    controller.expectOne(`${environment.apiUrl}/signup`).flush(
      { status: 400, code: 'error.user.login.invalid.char', message: 'O login não pode ter dois-pontos.' },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.step()).toBe(2);
    expect(component.registerForm.controls.login.hasError('server')).toBeTrue();
  });

  it('senha curta recusada pelo backend (error.user.password.too.short) marca a senha na etapa 3', () => {
    flushConfig(CONFIG);
    submitValidSignup();
    controller.expectOne(`${environment.apiUrl}/signup`).flush(
      { status: 400, code: 'error.user.password.too.short' },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.step()).toBe(3);
    expect(component.registerForm.controls.password.hasError('server')).toBeTrue();
    expect(component.registerError()).toBe('A senha precisa ter pelo menos 8 caracteres.');
  });
});

describe('AuthComponent (volta para a tela pedida e avisos)', () => {
  let controller: HttpTestingController;

  function create(queryParams: Record<string, string>, state: unknown = null) {
    TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { routeConfig: { path: 'login' }, queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    spyOn(TestBed.inject(Location), 'getState').and.returnValue(state);
    controller = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AuthComponent);
    fixture.detectChanges();
    controller.expectOne(`${environment.apiUrl}/signup/config`).flush(CONFIG);
    controller.expectOne(`${environment.apiUrl}/auth/password/config`).flush(PASSWORD_CONFIG);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    controller.verify();
    localStorage.clear();
  });

  function login(fixture: ReturnType<typeof create>): jasmine.Spy {
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture.componentInstance.loginForm.setValue({ login: 'ana.ficticia', password: 'segredo123' });
    fixture.componentInstance.loginSubmit();
    controller.expectOne(`${environment.apiUrl}/auth`).flush({ token: 'x.e30.y', userId: 'u1', userName: 'Ana' });
    return navigate;
  }

  it('link do e-mail sem sessão: depois do login volta para /pendencias com os filtros', () => {
    const fixture = create({ returnUrl: '/pendencias?severidade=ALTA&status=ABERTA' });
    expect(login(fixture)).toHaveBeenCalledWith('/pendencias?severidade=ALTA&status=ABERTA');
  });

  it('returnUrl para outro site é ignorado (vai para /home)', () => {
    const fixture = create({ returnUrl: '//site-ficticio.example' });
    expect(login(fixture)).toHaveBeenCalledWith('/home');
  });

  it('sessão revogada (401 error.auth.session.expired): o login avisa "Sua sessão expirou. Entre de novo."', () => {
    const fixture = create({}, { notice: 'error.auth.session.expired' });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Sua sessão expirou. Entre de novo.');
  });

  it('depois da redefinição: "Senha alterada. Entre com a nova senha."', () => {
    const fixture = create({}, { notice: 'password-changed' });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Senha alterada. Entre com a nova senha.');
  });
});
